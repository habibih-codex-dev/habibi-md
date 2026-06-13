// ============================================================
//   HABIBIH BOT - Protection System
//   Logika runtime semua anti-* yang dicek tiap pesan masuk
//   antilink (varian), antitoxic, antiforeign, antibot,
//   antispam, antitag, antivirtex, antimedia
// ============================================================

import config from "../config.js"
import { fromJID } from "./function.js"
import { logWarn } from "./logger.js"

// ─── Rate limiter untuk antispam (in-memory) ─────────────────
// key = `${jid}:${senderJid}` → { count, first }
const spamTracker = new Map()
const SPAM_WINDOW_MS = 7000 // jendela waktu
const SPAM_LIMIT = 6 // maks pesan dalam jendela

// ─── Daftar kata toxic (bisa ditambah) ───────────────────────
const toxicWords = [
  "anjing", "bangsat", "kontol", "memek", "ngentot", "jancok",
  "asu", "babi", "bajingan", "tolol", "goblok", "kampret",
  "pepek", "tai", "taik", "pantek", "lonte", "pelacur",
  "fuck", "bitch", "asshole", "bastard",
]

// ─── Pola link per platform ──────────────────────────────────
const linkPatterns = {
  wa: /chat\.whatsapp\.com\/[A-Za-z0-9]+/i,
  ch: /whatsapp\.com\/channel\/[A-Za-z0-9]+/i,
  tt: /(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i,
  yt: /(youtube\.com|youtu\.be)/i,
  ig: /instagram\.com/i,
  tg: /(t\.me|telegram\.me|telegram\.dog)/i,
}

// Pola link umum (untuk antilink & antilinkv2)
const generalLinkPattern =
  /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[A-Za-z0-9]+|wa\.me\/[0-9]+/i

// ─── Helper: hapus pesan ─────────────────────────────────────
const deleteMessage = async (sock, jid, msg) => {
  try {
    await sock.sendMessage(jid, { delete: msg.key })
  } catch (err) {
    logWarn("Gagal hapus pesan (apakah bot admin?)")
  }
}

// ─── Helper: kick member ─────────────────────────────────────
const kickMember = async (sock, jid, participantJid) => {
  try {
    await sock.groupParticipantsUpdate(jid, [participantJid], "remove")
  } catch (err) {
    logWarn("Gagal kick member (apakah bot admin?)")
  }
}

// ─── Helper: kirim peringatan dengan mention ─────────────────
const warn = async (sock, jid, senderJid, text) => {
  await sock.sendMessage(jid, {
    text: `@${fromJID(senderJid)} ${text}`,
    mentions: [senderJid],
  })
}

// ─── Helper: ambil mentioned JIDs dari pesan ─────────────────
const getMentions = (msg) => {
  const m = msg.message
  const ctx =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    null
  return ctx?.mentionedJid || []
}

/**
 * Jalankan semua proteksi terhadap satu pesan grup.
 * @param {Object} ctx - context dari handler
 * @returns {Promise<boolean>} true jika pesan ditindak (hentikan proses command)
 */
export const runProtection = async (ctx) => {
  const {
    sock,
    jid,
    msg,
    body,
    msgType,
    senderJid,
    senderNumber,
    isGroupMsg,
    isAdminSender,
    isOwnerSender,
    isBotAdmin,
    groupData,
    fromMe,
  } = ctx

  // Proteksi hanya berlaku di grup
  if (!isGroupMsg || !groupData) return false

  // Lewati pesan dari bot sendiri, owner, dan admin grup
  if (fromMe || isOwnerSender || isAdminSender) return false

  // Sebagian besar aksi butuh bot jadi admin
  const canAct = isBotAdmin

  // ─── ANTI FOREIGN (nomor luar negeri) ──────────────────
  if (groupData.antiforeign && canAct) {
    // Indonesia diawali 62. Selain itu dianggap asing.
    if (senderNumber && !senderNumber.startsWith("62")) {
      await warn(sock, jid, senderJid, "❌ Nomor luar negeri tidak diizinkan. Kamu dikeluarkan.")
      await deleteMessage(sock, jid, msg)
      await kickMember(sock, jid, senderJid)
      return true
    }
  }

  // ─── ANTI BOT (heuristik dari message id) ──────────────
  if (groupData.antibot && canAct) {
    const id = msg.key?.id || ""
    // ID khas bot/library: BAE5 (Baileys), 3EB0 (umum bot), panjang ganjil
    if (/^(BAE5|3EB0)/i.test(id) || id.length === 32) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "🤖 Terdeteksi bot. Pesan dihapus.")
      return true
    }
  }

  // ─── ANTI VIRTEX (pesan super panjang) ─────────────────
  if (groupData.antivirtex && canAct) {
    if (body && body.length > 4000) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "⚠️ Pesan terlalu panjang (virtex). Dihapus.")
      return true
    }
  }

  // ─── ANTI MEDIA (blokir foto/video/stiker/dokumen) ─────
  if (groupData.antimedia && canAct) {
    const mediaTypes = [
      "imageMessage",
      "videoMessage",
      "stickerMessage",
      "documentMessage",
      "audioMessage",
    ]
    if (mediaTypes.includes(msgType)) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "🚫 Kirim media tidak diizinkan di grup ini.")
      return true
    }
  }

  // ─── ANTI TAG (tag massal oleh non-admin) ──────────────
  if (groupData.antitag && canAct) {
    const mentions = getMentions(msg)
    if (mentions.length >= 5) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "🔕 Dilarang tag massal di grup ini.")
      return true
    }
  }

  // ─── ANTI TOXIC (kata kasar) ───────────────────────────
  if (groupData.antitoxic && canAct && body) {
    const lower = body.toLowerCase()
    const found = toxicWords.some((w) =>
      new RegExp(`\\b${w}\\b`, "i").test(lower)
    )
    if (found) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "🤬 Jaga bahasamu! Kata kasar tidak diizinkan.")
      return true
    }
  }

  // ─── ANTI SPAM (rate limit) ────────────────────────────
  if (groupData.antispam && canAct) {
    const key = `${jid}:${senderJid}`
    const now = Date.now()
    const entry = spamTracker.get(key)

    if (!entry || now - entry.first > SPAM_WINDOW_MS) {
      spamTracker.set(key, { count: 1, first: now })
    } else {
      entry.count++
      if (entry.count > SPAM_LIMIT) {
        spamTracker.delete(key)
        await deleteMessage(sock, jid, msg)
        await warn(sock, jid, senderJid, "⛔ Jangan spam! Pesanmu dihapus.")
        return true
      }
    }
  }

  // ─── ANTI LINK (berbagai varian) ───────────────────────
  if (body && canAct) {
    // 1) antilinkv2 — semua link → hapus + kick
    if (groupData.antilinkv2 && generalLinkPattern.test(body)) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "🔗 Dilarang kirim link! Kamu dikeluarkan.")
      await kickMember(sock, jid, senderJid)
      return true
    }

    // 2) antilink — semua link → hapus
    if (groupData.antilink && generalLinkPattern.test(body)) {
      await deleteMessage(sock, jid, msg)
      await warn(sock, jid, senderJid, "🔗 Dilarang kirim link di grup ini.")
      return true
    }

    // 3) varian spesifik per platform → hapus
    const variantMap = [
      ["antilinkwa", "wa", "link grup WhatsApp"],
      ["antilinkch", "ch", "link saluran WhatsApp"],
      ["antilinktt", "tt", "link TikTok"],
      ["antilinkyt", "yt", "link YouTube"],
      ["antilinkig", "ig", "link Instagram"],
      ["antilinktg", "tg", "link Telegram"],
    ]

    for (const [flag, patKey, label] of variantMap) {
      if (groupData[flag] && linkPatterns[patKey].test(body)) {
        await deleteMessage(sock, jid, msg)
        await warn(sock, jid, senderJid, `🔗 Dilarang kirim ${label} di grup ini.`)
        return true
      }
    }
  }

  return false
}

/**
 * Daftar semua key proteksi yang valid (untuk toggle command)
 */
export const protectionKeys = [
  "antilink", "antilinkv2", "antilinkwa", "antilinkch",
  "antilinktt", "antilinkyt", "antilinkig", "antilinktg",
  "antibot", "antitoxic", "antiforeign", "antispam",
  "antitag", "antidelete", "antivirtex", "antimedia",
]
