// ============================================================
//   HABIBIH BOT - Message Handler
//   Router pesan, permission system, plugin loader
//   Support: LID + JID WhatsApp terbaru
// ============================================================

import fs from "fs"
import path from "path"
import config from "./config.js"
import {
  fromJID,
  isGroup,
  isOwner,
  normalizeJID,
  compareJID,
  sleep,
} from "./lib/function.js"
import {
  getUser,
  updateUser,
  getGroup,
  isBanned,
  isPremium,
  incrementMessages,
  incrementCommands,
  getSettings,
} from "./lib/database.js"
import { logError, logMsg, logWarn } from "./lib/logger.js"

// ─── Plugin Registry ──────────────────────────────────────────
const plugins = new Map()

/**
 * Load semua plugin dari folder plugins/
 */
export const loadPlugins = async () => {
  const pluginDir = path.resolve("./plugins")
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true })
    return
  }

  const files = fs.readdirSync(pluginDir).filter((f) => f.endsWith(".js"))

  for (const file of files) {
    try {
      const filePath = `./plugins/${file}`
      // Hapus cache agar bisa reload
      const mod = await import(`${path.resolve(filePath)}?t=${Date.now()}`)
      if (mod.commands && Array.isArray(mod.commands)) {
        for (const cmd of mod.commands) {
          plugins.set(cmd.pattern, cmd)
        }
      }
      logMsg("PLUGIN", `✅ Loaded: ${file}`)
    } catch (err) {
      logError(`Gagal load plugin: ${file}`, err)
    }
  }

  logMsg("PLUGIN", `Total plugin termuat: ${plugins.size} command`)
  return plugins
}

/**
 * Dapatkan semua plugin yang sudah di-load
 */
export const getPlugins = () => plugins

// ─── Extract Pesan ───────────────────────────────────────────

/**
 * Ekstrak konten teks dari berbagai tipe pesan
 * @param {Object} msg
 */
const extractText = (msg) => {
  const m = msg.message
  if (!m) return ""

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ""
  )
}

/**
 * Ekstrak tipe pesan
 * @param {Object} msg
 */
const extractType = (msg) => {
  const m = msg.message
  if (!m) return ""
  const keys = Object.keys(m).filter((k) => k !== "messageContextInfo" && k !== "senderKeyDistributionMessage")
  return keys[0] || ""
}

/**
 * Ekstrak quoted message
 * @param {Object} msg
 */
const extractQuoted = (msg) => {
  const m = msg.message
  const ctx =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    m?.stickerMessage?.contextInfo ||
    null

  if (!ctx?.quotedMessage) return null

  return {
    message: ctx.quotedMessage,
    sender: ctx.participant || ctx.remoteJid || "",
    stanzaId: ctx.stanzaId,
  }
}

// ─── Permission Checker ───────────────────────────────────────

/**
 * Cek permission sender terhadap command
 * @param {Object} ctx - Context pesan
 * @param {Object} cmd - Command definition
 * @returns {{ allowed: boolean, reason: string }}
 */
const checkPermission = async (ctx, cmd) => {
  const { isOwnerSender, isGroupMsg, isAdminSender, isBotAdmin, isPremiumSender, isBanned: banned } = ctx

  // Cek banned
  if (banned) return { allowed: false, reason: "banned" }

  // Cek owner only
  if (cmd.owner && !isOwnerSender) return { allowed: false, reason: "owner" }

  // Cek group only
  if (cmd.group && !isGroupMsg) return { allowed: false, reason: "group" }

  // Cek private only
  if (cmd.private && isGroupMsg) return { allowed: false, reason: "private" }

  // Cek admin only
  if (cmd.admin && !isAdminSender && !isOwnerSender) return { allowed: false, reason: "admin" }

  // Cek bot admin
  if (cmd.botAdmin && !isBotAdmin) return { allowed: false, reason: "botAdmin" }

  // Cek premium only
  if (cmd.premium && !isPremiumSender && !isOwnerSender) return { allowed: false, reason: "premium" }

  return { allowed: true, reason: "" }
}

// ─── Reply Helper ─────────────────────────────────────────────

/**
 * Buat fungsi reply yang mudah dipakai di plugin
 * @param {Object} sock
 * @param {Object} msg
 */
const createReply = (sock, msg) => {
  const jid = msg.key.remoteJid
  const quoted = msg

  return {
    /**
     * Kirim teks biasa
     */
    text: (text, opts = {}) =>
      sock.sendMessage(jid, { text: String(text), ...opts }, { quoted }),

    /**
     * Kirim gambar
     */
    image: (buffer, caption = "", opts = {}) =>
      sock.sendMessage(jid, { image: buffer, caption, ...opts }, { quoted }),

    /**
     * Kirim video
     */
    video: (buffer, caption = "", opts = {}) =>
      sock.sendMessage(jid, { video: buffer, caption, ...opts }, { quoted }),

    /**
     * Kirim sticker
     */
    sticker: (buffer, opts = {}) =>
      sock.sendMessage(jid, { sticker: buffer, ...opts }, { quoted }),

    /**
     * Kirim reaction emoji
     */
    react: (emoji) =>
      sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),

    /**
     * Kirim pesan dengan native flow button + fallback teks
     */
    nativeFlow: async (content, buttons, footer = config.footer) => {
      if (!config.button.useNativeFlow) {
        // Langsung fallback ke teks
        return sock.sendMessage(jid, { text: content }, { quoted })
      }

      try {
        // Coba kirim native flow
        const btnList = buttons.map((b, i) => ({
          buttonId: b.id || `btn_${i}`,
          buttonText: { displayText: b.text },
          type: 1,
        }))

        await sock.sendMessage(
          jid,
          {
            text: content,
            footer,
            buttons: btnList,
            headerType: 1,
          },
          { quoted }
        )
      } catch {
        // Fallback ke teks biasa jika native flow gagal
        logWarn("Native flow gagal, fallback ke teks biasa")
        const fallback = [
          content,
          "",
          buttons.map((b, i) => `${i + 1}. ${b.text}`).join("\n"),
          "",
          footer,
        ].join("\n")
        await sock.sendMessage(jid, { text: fallback }, { quoted })
      }
    },

    /**
     * Kirim ke JID tertentu (bukan quoted)
     */
    send: (content) =>
      sock.sendMessage(jid, content),
  }
}

// ─── Build Context ────────────────────────────────────────────

/**
 * Bangun context lengkap dari pesan masuk
 * @param {Object} sock
 * @param {Object} msg
 * @param {Object} store
 */
const buildContext = async (sock, msg, store) => {
  const jid = msg.key.remoteJid || ""
  const isGroupMsg = isGroup(jid)

  // ─── Sender JID (handle LID & JID) ──────────────────────
  let senderJid = ""
  if (isGroupMsg) {
    senderJid = msg.key.participant || msg.participant || ""
  } else {
    senderJid = msg.key.fromMe ? sock.user.id : jid
  }
  senderJid = normalizeJID(senderJid)

  const senderNumber = fromJID(senderJid)
  const isOwnerSender = isOwner(senderJid)
  const fromMe = msg.key.fromMe || false

  // ─── Teks & Tipe ────────────────────────────────────────
  const body = extractText(msg)
  const msgType = extractType(msg)
  const quoted = extractQuoted(msg)

  // ─── Prefix & Command ────────────────────────────────────
  const prefixMatch = body.match(config.prefix)
  const prefix = prefixMatch ? prefixMatch[0] : ""
  const isCmd = !!prefix
  const args = body.slice(prefix.length).trim().split(/\s+/)
  const command = args.shift()?.toLowerCase() || ""
  const text = args.join(" ")
  const query = text.trim()

  // ─── Group Info ──────────────────────────────────────────
  let groupMetadata = null
  let groupName = ""
  let members = []
  let admins = []
  let isBotAdmin = false
  let isAdminSender = false

  if (isGroupMsg) {
    try {
      groupMetadata = await sock.groupMetadata(jid).catch(() => null)
      if (groupMetadata) {
        groupName = groupMetadata.subject || ""
        members = groupMetadata.participants || []

        // ─── Handle LID + JID untuk deteksi admin ────────
        // Baileys terbaru: participant bisa berupa LID atau JID
        admins = members
          .filter((p) => p.admin === "admin" || p.admin === "superadmin")
          .map((p) => p.id)

        const botJid = normalizeJID(sock.user.id)

        // Cek bot admin: bandingkan dengan LID dan JID
        isBotAdmin = members.some(
          (p) =>
            (p.admin === "admin" || p.admin === "superadmin") &&
            compareJID(p.id, botJid)
        )

        // Cek sender admin: bandingkan dengan LID dan JID
        isAdminSender = members.some(
          (p) =>
            (p.admin === "admin" || p.admin === "superadmin") &&
            compareJID(p.id, senderJid)
        )
      }
    } catch (err) {
      logError("Gagal fetch group metadata", err)
    }
  }

  // ─── Database ────────────────────────────────────────────
  const userData = getUser(senderJid)
  const groupData = isGroupMsg ? getGroup(jid) : null
  const banned = isBanned(senderJid)
  const isPremiumSender = isPremium(senderJid)
  const dbSettings = getSettings()

  // ─── Push name ───────────────────────────────────────────
  const pushName = msg.pushName || userData.name || senderNumber

  // Update nama user jika berubah
  if (msg.pushName && msg.pushName !== userData.name) {
    updateUser(senderJid, { name: msg.pushName })
  }

  return {
    // Pesan
    msg,
    jid,
    body,
    msgType,
    quoted,
    fromMe,

    // Sender
    senderJid,
    senderNumber,
    pushName,
    isOwnerSender,

    // Command
    isCmd,
    prefix,
    command,
    args,
    text,
    query,

    // Group
    isGroupMsg,
    groupMetadata,
    groupName,
    members,
    admins,
    isBotAdmin,
    isAdminSender,

    // Database
    userData,
    groupData,
    isBanned: banned,
    isPremiumSender,
    dbSettings,

    // Helpers
    reply: createReply(sock, msg),
    sock,
    store,
    config,
  }
}

// ─── Main Handler ─────────────────────────────────────────────

/**
 * Handler utama — dipanggil untuk setiap pesan masuk
 * @param {Object} sock
 * @param {Object} msg
 * @param {Object} store
 */
const handler = async (sock, msg, store) => {
  try {
    // Skip pesan kosong
    if (!msg.message) return

    // Skip pesan dari status
    if (msg.key.remoteJid === "status@broadcast") return

    const dbSettings = getSettings()

    // ─── Self Mode ─────────────────────────────────────
    if (dbSettings.selfMode && !msg.key.fromMe) return

    // ─── Auto Read ─────────────────────────────────────
    if (dbSettings.autoRead) {
      await sock.readMessages([msg.key]).catch(() => {})
    }

    // ─── Increment Stats ────────────────────────────────
    incrementMessages()

    // ─── Build Context ──────────────────────────────────
    const ctx = await buildContext(sock, msg, store)

    // ─── Auto Typing ────────────────────────────────────
    if (dbSettings.autoTyping && ctx.isCmd) {
      await sock.sendPresenceUpdate("composing", ctx.jid).catch(() => {})
      await sleep(500)
      await sock.sendPresenceUpdate("paused", ctx.jid).catch(() => {})
    }

    // ─── Bot Mode Check ─────────────────────────────────
    const botMode = dbSettings.botMode || config.settings.botMode
    if (botMode === "group" && !ctx.isGroupMsg) return
    if (botMode === "private" && ctx.isGroupMsg) return

    // ─── Log Pesan ──────────────────────────────────────
    if (ctx.isCmd) {
      logMsg(ctx.senderNumber, `${ctx.prefix}${ctx.command}`)
      incrementCommands()
    }

    // ─── Cari & Jalankan Plugin ─────────────────────────
    if (ctx.isCmd) {
      let matched = false

      for (const [pattern, cmd] of plugins) {
        let isMatch = false

        if (typeof pattern === "string") {
          isMatch = ctx.command === pattern.toLowerCase()
        } else if (pattern instanceof RegExp) {
          isMatch = pattern.test(ctx.command)
        }

        if (!isMatch) continue
        matched = true

        // Cek permission
        const { allowed, reason } = await checkPermission(ctx, cmd)

        if (!allowed) {
          const errMsg = config.msg[reason] || config.msg.error
          await ctx.reply.text(errMsg)
          return
        }

        // Jalankan command
        try {
          await ctx.reply.react("⏳")
          await cmd.handler(ctx)
          await ctx.reply.react("✅")
        } catch (err) {
          logError(`Error pada command: ${ctx.command}`, err)
          await ctx.reply.react("❌")
          await ctx.reply.text(config.msg.error)
        }

        break
      }
    }
  } catch (err) {
    logError("Error pada handler utama", err)
  }
}

/**
 * Handler update participant grup (welcome/goodbye)
 * @param {Object} sock
 * @param {Object} update
 * @param {Object} store
 */
handler.onGroupUpdate = async (sock, update, store) => {
  try {
    const { id, participants, action } = update
    const groupData = getGroup(id)

    let groupMeta = null
    try {
      groupMeta = await sock.groupMetadata(id)
    } catch {}

    const groupName = groupMeta?.subject || id

    for (const participant of participants) {
      const number = fromJID(participant)

      if (action === "add" && groupData?.welcome) {
        await sock.sendMessage(id, {
          text: `👋 Selamat datang @${number} di grup *${groupName}*!\n\nSemoga betah ya 😊`,
          mentions: [participant],
        })
      }

      if (action === "remove" && groupData?.goodbye) {
        await sock.sendMessage(id, {
          text: `👋 Sampai jumpa @${number}, semoga sukses selalu!`,
          mentions: [participant],
        })
      }
    }
  } catch (err) {
    logError("Error pada group update handler", err)
  }
}

export default handler
