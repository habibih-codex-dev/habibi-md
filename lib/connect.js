// ============================================================
//   HABIBIH BOT - Connection Handler (Baileys v7 rc13)
//   Support: Pairing Code & QR Code
//   Auto Reconnect, LID/JID Support, Error Handling Lengkap
//   FIXED:
//   - makeInMemoryStore dihapus di v7 → custom store
//   - printQRInTerminal deprecated → render QR manual
//   - Pairing code: timing & browser fingerprint diperbaiki
// ============================================================

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  isJidStatusBroadcast,
  Browsers,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import qrcode from "qrcode-terminal"
import path from "path"
import pino from "pino"

import config from "../config.js"
import {
  logConn,
  logError,
  logLine,
  logSystem,
  logWarn,
} from "./logger.js"
import { ensureDir } from "./function.js"

// ─── State Global ──────────────────────────────────────────────
let sock = null
let reconnectCount = 0
let isReconnecting = false
let pairingRequested = false

// ─── Simple In-Memory Message Store (pengganti makeInMemoryStore) ──
const messageStore = new Map()

export const store = {
  messages: messageStore,

  saveMessage(jid, msg) {
    if (!jid || !msg?.key?.id) return
    if (!messageStore.has(jid)) messageStore.set(jid, new Map())
    messageStore.get(jid).set(msg.key.id, msg)
  },

  loadMessage(jid, id) {
    return messageStore.get(jid)?.get(id) || undefined
  },

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

// ─── Helper sleep ──────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Validasi & normalisasi nomor untuk pairing ────────────────
const cleanPhoneNumber = (raw) => {
  // Hapus semua karakter non-digit (spasi, +, -, dll)
  let num = String(raw).replace(/[^0-9]/g, "")

  // Hapus leading zero jika ada (contoh: 0851... → 6285...)
  // Hanya jika dimulai dengan 0 (format lokal Indonesia)
  if (num.startsWith("0")) {
    num = "62" + num.slice(1)
  }

  return num
}

// ─── Render QR ke terminal secara manual ───────────────────────
const renderQR = (qr) => {
  logLine()
  logConn("📷 Scan QR Code berikut dengan WhatsApp kamu:")
  logConn("WhatsApp → Perangkat Tertaut → Tautkan Perangkat")
  console.log("")
  qrcode.generate(qr, { small: true })
  console.log("")
  logConn("QR berlaku ~20 detik, akan otomatis refresh jika kadaluarsa")
  logLine()
}

// ─── Main Connect Function ─────────────────────────────────────
const connect = async (handler) => {
  const sessionDir = path.resolve(
    `./session/${config.connection.sessionName}`
  )
  ensureDir(sessionDir)
  ensureDir("./assets")

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  // Apakah pakai metode pairing code?
  const usePairing = config.connection.method === "pairing"

  // Fetch versi WhatsApp Web terbaru (WAJIB agar tidak di-reject)
  let version
  try {
    const result = await fetchLatestBaileysVersion()
    version = result.version
    logSystem(
      `WhatsApp Web versi: ${version.join(".")} | Latest: ${result.isLatest}`
    )
  } catch {
    // Fallback ke versi yang relatif baru (bukan versi lama)
    version = [2, 3000, 1027934516]
    logWarn(
      "Gagal fetch versi terbaru, gunakan versi fallback. " +
        "Pastikan koneksi internet stabil untuk hasil terbaik."
    )
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

    // PENTING: printQRInTerminal sudah deprecated di v7.
    // QR di-render manual via event connection.update di bawah.
    // Saat pakai pairing, WAJIB false agar tidak konflik.
    printQRInTerminal: false,

    // Browser fingerprint:
    // - Pairing code paling stabil dengan Browsers.ubuntu("Chrome")
    // - Mismatch fingerprint sering jadi sebab "Gagal menautkan perangkat"
    browser: usePairing
      ? Browsers.ubuntu("Chrome")
      : Browsers.appropriate("Chrome"),

    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,

    getMessage: async (key) => {
      const msg = store.loadMessage(key.remoteJid, key.id)
      if (msg) return msg.message
      return { conversation: "" }
    },
  })

  store.bind(sock.ev)

  // ─── Request Pairing Code ─────────────────────────────────
  // Dilakukan SETELAH socket dibuat, dengan delay agar noise
  // handshake selesai. Hanya jika belum terdaftar.
  if (usePairing && !sock.authState.creds.registered && !pairingRequested) {
    pairingRequested = true

    const phoneNumber = cleanPhoneNumber(config.connection.phoneNumber)

    logLine()
    logConn("Metode: PAIRING CODE")
    logConn(`Nomor terdaftar: +${phoneNumber}`)
    logLine()

    // Validasi nomor minimal 8 digit
    if (phoneNumber.length < 8) {
      logError(
        `Nomor "${phoneNumber}" tidak valid. ` +
          "Periksa config.connection.phoneNumber (gunakan kode negara, tanpa +)."
      )
      process.exit(1)
    }

    // Tunggu socket benar-benar siap (3-4 detik aman)
    await sleep(4000)

    try {
      const code = await sock.requestPairingCode(phoneNumber)
      const formatted = code?.match(/.{1,4}/g)?.join("-") || code
      logLine()
      logConn(`🔑 PAIRING CODE: ${formatted}`)
      logConn("Langkah di HP:")
      logConn("1. Buka WhatsApp → Perangkat Tertaut")
      logConn("2. Tap 'Tautkan Perangkat'")
      logConn("3. Tap 'Tautkan dengan nomor telepon'")
      logConn("4. Masukkan kode di atas")
      logConn("⏳ Kode berlaku beberapa menit — segera masukkan!")
      logLine()
    } catch (err) {
      logError(
        "Gagal request pairing code. Pastikan nomor benar & internet stabil.",
        err
      )
    }
  }

  // ─── Connection Update ────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    // Render QR manual — hanya jika metode QR (bukan pairing)
    if (qr && !usePairing) {
      renderQR(qr)
    }

    if (connection === "connecting") {
      logConn("Menghubungkan ke WhatsApp...")
    }

    if (connection === "open") {
      reconnectCount = 0
      isReconnecting = false
      pairingRequested = false
      logLine()
      logConn("✅ Bot berhasil terhubung ke WhatsApp!")
      logConn(`👤 Nama : ${sock.user?.name || "Unknown"}`)
      logConn(`📱 JID  : ${sock.user?.id || "Unknown"}`)
      logLine()
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      logWarn(
        `Koneksi terputus. Status: ${statusCode} | Reconnect: ${shouldReconnect}`
      )

      // Reset flag agar bisa request pairing/QR baru saat reconnect
      pairingRequested = false

      if (!shouldReconnect) {
        logError(
          "Bot logout! Hapus folder session/ lalu jalankan ulang."
        )
        process.exit(1)
      }

      if (reconnectCount >= config.connection.maxReconnectAttempts) {
        logError(
          `Gagal reconnect ${reconnectCount}x. Bot berhenti.`
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

  sock.ev.on("creds.update", saveCreds)

  // ─── Message Handler ───────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return

    for (const msg of messages) {
      try {
        if (!msg.key?.remoteJid) continue
        if (msg.key.remoteJid === "status@broadcast") continue
        if (isJidBroadcast(msg.key.remoteJid)) continue
        if (isJidStatusBroadcast(msg.key.remoteJid)) continue

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
