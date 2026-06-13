// ============================================================
//   HABIBIH BOT - Connection Handler (Baileys)
//   Support: Pairing Code & QR Code
//   Auto Reconnect, LID/JID Support, Error Handling Lengkap
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
  makeInMemoryStore,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import readline from "readline"
import path from "path"
import fs from "fs"
import pino from "pino"

import config from "../config.js"
import { logConn, logError, logInfo, logLine, logSystem, logWarn } from "./logger.js"
import { ensureDir } from "./function.js"

// ─── State Global ─────────────────────────────────────────────
let sock = null
let reconnectCount = 0
let isReconnecting = false

// ─── In-Memory Store (untuk riwayat pesan, dll) ──────────────
const store = makeInMemoryStore({
  logger: pino({ level: "silent" }),
})

export { store }

// ─── Pairing Code via Terminal ───────────────────────────────
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

// ─── Main Connect Function ───────────────────────────────────
const connect = async (handler) => {
  // Pastikan folder session ada
  const sessionDir = path.resolve(`./session/${config.connection.sessionName}`)
  ensureDir(sessionDir)
  ensureDir("./assets")

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  // Fetch versi Baileys terbaru
  const { version, isLatest } = await fetchLatestBaileysVersion()
  logSystem(`Baileys versi: ${version.join(".")} | Latest: ${isLatest}`)

  // Buat socket Baileys
  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    logger: pino({ level: "silent" }),
    printQRInTerminal: config.connection.method === "qr" && config.connection.printQRInTerminal,
    browser: ["Habibih Bot", "Chrome", "130.0.0"],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id)
        return msg?.message || undefined
      }
      return proto.Message.fromObject({})
    },
  })

  // Bind store ke event socket
  store?.bind(sock.ev)

  // ─── Handle Pairing Code ──────────────────────────────────
  if (
    config.connection.method === "pairing" &&
    !sock.authState.creds.registered
  ) {
    const phoneNumber = config.connection.phoneNumber.replace(/[^0-9]/g, "")
    logLine()
    logConn("Menggunakan metode: PAIRING CODE")
    logConn(`Nomor: ${phoneNumber}`)
    logLine()

    await sleep(2000)

    try {
      const code = await sock.requestPairingCode(phoneNumber)
      const formatted = code?.match(/.{1,4}/g)?.join("-") || code
      logLine()
      logConn(`🔑 PAIRING CODE KAMU: ${formatted}`)
      logConn("Masukkan kode ini di WhatsApp > Perangkat Tertaut > Tautkan Perangkat")
      logLine()
    } catch (err) {
      logError("Gagal mendapatkan pairing code", err)
    }
  }

  // ─── Handle QR Code ──────────────────────────────────────
  if (config.connection.method === "qr") {
    logLine()
    logConn("Menggunakan metode: QR CODE")
    logConn("Scan QR Code yang muncul di terminal")
    logLine()
  }

  // ─── Connection Update ────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && config.connection.method === "qr") {
      logConn("QR Code baru digenerate, silakan scan!")
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut

      logWarn(`Koneksi terputus. Reason: ${reason}`)

      if (!shouldReconnect) {
        logError("Bot telah logout! Hapus folder session dan restart.")
        process.exit(1)
      }

      if (reconnectCount >= config.connection.maxReconnectAttempts) {
        logError(`Gagal reconnect setelah ${reconnectCount} percobaan. Bot berhenti.`)
        process.exit(1)
      }

      if (!isReconnecting) {
        isReconnecting = true
        reconnectCount++
        logWarn(`Mencoba reconnect... (${reconnectCount}/${config.connection.maxReconnectAttempts})`)
        setTimeout(async () => {
          isReconnecting = false
          await connect(handler)
        }, config.connection.reconnectDelay)
      }
    }

    if (connection === "open") {
      reconnectCount = 0
      isReconnecting = false
      logLine()
      logConn("✅ Bot berhasil terhubung ke WhatsApp!")
      logConn(`👤 Terhubung sebagai: ${sock.user?.name || "Unknown"}`)
      logConn(`📱 JID: ${sock.user?.id || "Unknown"}`)
      logLine()
    }

    if (connection === "connecting") {
      logConn("Menghubungkan ke WhatsApp...")
    }
  })

  // ─── Save Credentials ─────────────────────────────────────
  sock.ev.on("creds.update", saveCreds)

  // ─── Message Handler ──────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return

    for (const msg of messages) {
      try {
        // Filter broadcast dan status
        if (isJidBroadcast(msg.key?.remoteJid)) continue
        if (isJidStatusBroadcast(msg.key?.remoteJid)) continue
        if (msg.key?.remoteJid === "status@broadcast") continue

        // Panggil handler utama
        if (handler) await handler(sock, msg, store)
      } catch (err) {
        logError("Error saat memproses pesan", err)
      }
    }
  })

  // ─── Group Participant Update (untuk welcome/goodbye) ─────
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

// ─── Helper sleep lokal ───────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Getter socket aktif ──────────────────────────────────────
export const getSocket = () => sock

export default connect
