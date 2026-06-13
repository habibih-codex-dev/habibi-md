// ============================================================
//   HABIBIH BOT - Connection Handler (Baileys v7 rc13)
//   Support: Pairing Code & QR Code
//   Auto Reconnect, LID/JID Support, Error Handling Lengkap
//   FIXED: makeInMemoryStore dihapus di v7 — pakai custom store
// ============================================================

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  isJidStatusBroadcast,
  proto,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import readline from "readline"
import path from "path"
import fs from "fs"
import pino from "pino"

import config from "../config.js"
import {
  logConn,
  logError,
  logInfo,
  logLine,
  logSystem,
  logWarn,
} from "./logger.js"
import { ensureDir } from "./function.js"

// ─── State Global ──────────────────────────────────────────────
let sock = null
let reconnectCount = 0
let isReconnecting = false

// ─── Simple In-Memory Message Store (pengganti makeInMemoryStore) ──
// makeInMemoryStore dihapus di Baileys v7 — buat manual sederhana
const messageStore = new Map()

export const store = {
  messages: messageStore,

  /**
   * Simpan pesan ke store
   * @param {string} jid
   * @param {Object} msg
   */
  saveMessage(jid, msg) {
    if (!jid || !msg?.key?.id) return
    if (!messageStore.has(jid)) {
      messageStore.set(jid, new Map())
    }
    messageStore.get(jid).set(msg.key.id, msg)
  },

  /**
   * Load pesan dari store berdasarkan key
   * @param {string} jid
   * @param {string} id
   */
  loadMessage(jid, id) {
    return messageStore.get(jid)?.get(id) || undefined
  },

  /**
   * Bind event socket untuk auto-save pesan
   * @param {Object} ev - sock.ev
   */
  bind(ev) {
    ev.on("messages.upsert", ({ messages }) => {
      for (const msg of messages) {
        if (msg.key?.remoteJid && msg.key?.id) {
          this.saveMessage(msg.key.remoteJid, msg)
        }
      }
    })
  },
}

// ─── Pairing Code via Terminal ─────────────────────────────────
const askQuestion = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ─── Helper sleep ──────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Main Connect Function ─────────────────────────────────────
const connect = async (handler) => {
  // Pastikan folder session ada
  const sessionDir = path.resolve(
    `./session/${config.connection.sessionName}`
  )
  ensureDir(sessionDir)
  ensureDir("./assets")

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  // Fetch versi Baileys terbaru yang kompatibel
  let version
  try {
    const result = await fetchLatestBaileysVersion()
    version = result.version
    logSystem(
      `Baileys versi: ${version.join(".")} | Latest: ${result.isLatest}`
    )
  } catch {
    // Fallback versi jika fetch gagal (misal offline)
    version = [2, 3000, 1023625222]
    logWarn("Gagal fetch versi Baileys, gunakan versi fallback")
  }

  // ─── Buat Socket Baileys ──────────────────────────────────
  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: "silent" })
      ),
    },
    logger: pino({ level: "silent" }),

    // Print QR hanya jika method = qr
    printQRInTerminal:
      config.connection.method === "qr" &&
      config.connection.printQRInTerminal,

    // Browser fingerprint — pakai Chrome agar stabil
    browser: ["Habibih Bot", "Chrome", "130.0.0"],

    // Tidak perlu sync seluruh history untuk hemat memori
    syncFullHistory: false,

    // Tandai online saat connect
    markOnlineOnConnect: true,

    // Generate link preview kualitas tinggi
    generateHighQualityLinkPreview: true,

    // getMessage — diperlukan untuk retry pesan
    // Gunakan custom store kita, bukan makeInMemoryStore
    getMessage: async (key) => {
      const msg = store.loadMessage(key.remoteJid, key.id)
      if (msg) return msg.message
      // Kembalikan proto kosong jika tidak ditemukan
      return { conversation: "" }
    },
  })

  // ─── Bind store ke event socket ───────────────────────────
  store.bind(sock.ev)

  // ─── Handle Pairing Code ──────────────────────────────────
  if (
    config.connection.method === "pairing" &&
    !sock.authState.creds.registered
  ) {
    const phoneNumber = config.connection.phoneNumber.replace(
      /[^0-9]/g,
      ""
    )
    logLine()
    logConn("Menggunakan metode: PAIRING CODE")
    logConn(`Nomor: +${phoneNumber}`)
    logLine()

    // Tunggu socket siap sebelum request pairing code
    await sleep(3000)

    try {
      const code = await sock.requestPairingCode(phoneNumber)
      const formatted =
        code?.match(/.{1,4}/g)?.join("-") || code
      logLine()
      logConn(`🔑 PAIRING CODE KAMU: ${formatted}`)
      logConn(
        "Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat"
      )
      logConn("→ Tautkan dengan nomor telepon → Masukkan kode di atas")
      logLine()
    } catch (err) {
      logError("Gagal mendapatkan pairing code", err)
    }
  }

  // ─── Handle QR Code ───────────────────────────────────────
  if (config.connection.method === "qr") {
    logLine()
    logConn("Menggunakan metode: QR CODE")
    logConn("Scan QR Code yang muncul di terminal dengan WhatsApp")
    logLine()
  }

  // ─── Connection Update ────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && config.connection.method === "qr") {
      logConn("QR Code baru digenerate — silakan scan!")
    }

    if (connection === "connecting") {
      logConn("Menghubungkan ke WhatsApp...")
    }

    if (connection === "open") {
      reconnectCount = 0
      isReconnecting = false
      logLine()
      logConn("✅ Bot berhasil terhubung ke WhatsApp!")
      logConn(`👤 Nama   : ${sock.user?.name || "Unknown"}`)
      logConn(`📱 JID    : ${sock.user?.id || "Unknown"}`)
      logLine()
    }

    if (connection === "close") {
      const statusCode =
        new Boom(lastDisconnect?.error)?.output?.statusCode

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut

      logWarn(
        `Koneksi terputus. Status: ${statusCode} | Reconnect: ${shouldReconnect}`
      )

      if (!shouldReconnect) {
        logError(
          "Bot telah logout! Hapus folder session/ lalu restart."
        )
        process.exit(1)
      }

      if (
        reconnectCount >= config.connection.maxReconnectAttempts
      ) {
        logError(
          `Gagal reconnect setelah ${reconnectCount}x percobaan. Bot berhenti.`
        )
        process.exit(1)
      }

      if (!isReconnecting) {
        isReconnecting = true
        reconnectCount++
        logWarn(
          `Reconnect ke-${reconnectCount}/${config.connection.maxReconnectAttempts} dalam ${config.connection.reconnectDelay / 1000}s...`
        )
        setTimeout(async () => {
          isReconnecting = false
          await connect(handler)
        }, config.connection.reconnectDelay)
      }
    }
  })

  // ─── Save Credentials ──────────────────────────────────────
  sock.ev.on("creds.update", saveCreds)

  // ─── Message Handler ───────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return

    for (const msg of messages) {
      try {
        // Skip pesan dari broadcast & status
        if (!msg.key?.remoteJid) continue
        if (msg.key.remoteJid === "status@broadcast") continue
        if (isJidBroadcast(msg.key.remoteJid)) continue
        if (isJidStatusBroadcast(msg.key.remoteJid)) continue

        // Panggil handler utama
        if (handler) await handler(sock, msg, store)
      } catch (err) {
        logError("Error saat memproses pesan", err)
      }
    }
  })

  // ─── Group Participant Update ──────────────────────────────
  sock.ev.on("group-participants.update", async (update) => {
    try {
      if (handler?.onGroupUpdate) {
        await handler.onGroupUpdate(sock, update, store)
      }
    } catch (err) {
      logError("Error pada group-participants.update", err)
    }
  })

  return sock
}

// ─── Getter socket aktif ───────────────────────────────────────
export const getSocket = () => sock

export default connect
