// ============================================================
//   HABIBIH BOT - Message Handler
//   Router pesan, permission system, plugin loader
//   Support: LID + JID WhatsApp terbaru
// ============================================================

import fs from "fs"
import path from "path"
import { pathToFileURL } from "url"
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
import { runProtection } from "./lib/protection.js"

// ─── Plugin Registry ──────────────────────────────────────────
const plugins = new Map()

/**
 * Load semua plugin dari folder plugins/
 * FIXED: Gunakan pathToFileURL agar valid di Node.js ESM
 */
export const loadPlugins = async () => {
  const pluginDir = path.resolve("./plugins")

  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true })
    return plugins
  }

  const files = fs
    .readdirSync(pluginDir)
    .filter((f) => f.endsWith(".js"))
    .sort()

  for (const file of files) {
    try {
      const fullPath = path.resolve(pluginDir, file)
      // Gunakan file URL agar valid di semua OS (Windows & Linux)
      const fileUrl = pathToFileURL(fullPath).href
      const mod = await import(fileUrl)

      if (mod.commands && Array.isArray(mod.commands)) {
        for (const cmd of mod.commands) {
          if (!cmd.pattern) continue
          plugins.set(cmd.pattern, cmd)
        }
        logMsg("PLUGIN", `✅ ${file} (${mod.commands.length} command)`)
      }
    } catch (err) {
      logError(`Gagal load plugin: ${file}`, err)
    }
  }

  logMsg("PLUGIN", `Total: ${plugins.size} command termuat`)
  return plugins
}

/**
 * Dapatkan semua plugin yang sudah di-load
 */
export const getPlugins = () => plugins

// ─── Extract Pesan ────────────────────────────────────────────

/**
 * Ekstrak konten teks dari berbagai tipe pesan Baileys v7
 */
const extractText = (msg) => {
  const m = msg.message
  if (!m) return ""

  // Baileys v7: viewOnceMessage wrapper
  const unwrapped =
    m?.viewOnceMessage?.message ||
    m?.viewOnceMessageV2?.message ||
    m?.ephemeralMessage?.message ||
    m?.documentWithCaptionMessage?.message ||
    m

  return (
    unwrapped?.conversation ||
    unwrapped?.extendedTextMessage?.text ||
    unwrapped?.imageMessage?.caption ||
    unwrapped?.videoMessage?.caption ||
    unwrapped?.documentMessage?.caption ||
    unwrapped?.buttonsResponseMessage?.selectedButtonId ||
    unwrapped?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    unwrapped?.templateButtonReplyMessage?.selectedId ||
    unwrapped?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ""
  )
}

/**
 * Ekstrak tipe pesan — skip metadata keys
 */
const extractType = (msg) => {
  const m = msg.message
  if (!m) return ""
  const skipKeys = new Set([
    "messageContextInfo",
    "senderKeyDistributionMessage",
    "deviceSentMessage",
  ])
  const keys = Object.keys(m).filter((k) => !skipKeys.has(k))
  return keys[0] || ""
}

/**
 * Ekstrak quoted message
 */
const extractQuoted = (msg) => {
  const m = msg.message
  if (!m) return null

  const ctx =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    m?.stickerMessage?.contextInfo ||
    m?.audioMessage?.contextInfo ||
    null

  if (!ctx?.quotedMessage) return null

  return {
    message: ctx.quotedMessage,
    sender: ctx.participant || ctx.remoteJid || "",
    stanzaId: ctx.stanzaId || "",
  }
}

// ─── Permission Checker ───────────────────────────────────────

const checkPermission = async (ctx, cmd) => {
  const {
    isOwnerSender,
    isGroupMsg,
    isAdminSender,
    isBotAdmin,
    isPremiumSender,
    isBanned: banned,
  } = ctx

  if (banned) return { allowed: false, reason: "banned" }
  if (cmd.owner && !isOwnerSender) return { allowed: false, reason: "owner" }
  if (cmd.group && !isGroupMsg) return { allowed: false, reason: "group" }
  if (cmd.private && isGroupMsg) return { allowed: false, reason: "private" }
  if (cmd.admin && !isAdminSender && !isOwnerSender)
    return { allowed: false, reason: "admin" }
  if (cmd.botAdmin && !isBotAdmin)
    return { allowed: false, reason: "botAdmin" }
  if (cmd.premium && !isPremiumSender && !isOwnerSender)
    return { allowed: false, reason: "premium" }

  return { allowed: true, reason: "" }
}

// ─── Reply Helper ─────────────────────────────────────────────

const createReply = (sock, msg) => {
  const jid = msg.key.remoteJid

  return {
    /** Kirim teks biasa */
    text: (text, opts = {}) =>
      sock.sendMessage(jid, { text: String(text), ...opts }, { quoted: msg }),

    /** Kirim gambar */
    image: (buffer, caption = "", opts = {}) =>
      sock.sendMessage(
        jid,
        { image: buffer, caption, ...opts },
        { quoted: msg }
      ),

    /** Kirim video */
    video: (buffer, caption = "", opts = {}) =>
      sock.sendMessage(
        jid,
        { video: buffer, caption, ...opts },
        { quoted: msg }
      ),

    /** Kirim sticker */
    sticker: (buffer, opts = {}) =>
      sock.sendMessage(jid, { sticker: buffer, ...opts }, { quoted: msg }),

    /** Kirim reaction emoji */
    react: (emoji) =>
      sock.sendMessage(jid, {
        react: { text: emoji, key: msg.key },
      }),

    /**
     * Kirim native flow button + fallback teks otomatis
     * @param {string} content
     * @param {Array<{id:string, text:string}>} buttons
     * @param {string} footer
     */
    nativeFlow: async (content, buttons = [], footer = config.footer) => {
      if (!config.button.useNativeFlow) {
        return _sendTextFallback(sock, jid, msg, content, buttons, footer)
      }
      try {
        const btnList = buttons.map((b, i) => ({
          buttonId: b.id || `btn_${i}`,
          buttonText: { displayText: b.text },
          type: 1,
        }))
        await sock.sendMessage(
          jid,
          { text: content, footer, buttons: btnList, headerType: 1 },
          { quoted: msg }
        )
      } catch {
        logWarn("Native flow gagal, fallback ke teks biasa")
        await _sendTextFallback(sock, jid, msg, content, buttons, footer)
      }
    },

    /** Kirim ke JID tanpa quoted */
    send: (content) => sock.sendMessage(jid, content),
  }
}

/** Helper internal fallback teks */
const _sendTextFallback = (sock, jid, msg, content, buttons, footer) => {
  const lines = [content, ""]
  if (buttons.length) {
    buttons.forEach((b, i) => lines.push(`${i + 1}. ${b.text}`))
    lines.push("")
  }
  lines.push(footer)
  return sock.sendMessage(
    jid,
    { text: lines.join("\n") },
    { quoted: msg }
  )
}

// ─── Build Context ────────────────────────────────────────────

const buildContext = async (sock, msg, store) => {
  const jid = msg.key.remoteJid || ""
  const isGroupMsg = isGroup(jid)

  // ─── Sender JID — handle LID & JID ───────────────────────
  let senderJid = ""
  if (isGroupMsg) {
    senderJid = msg.key.participant || msg.participant || ""
  } else {
    senderJid = msg.key.fromMe ? (sock.user?.id || "") : jid
  }
  senderJid = normalizeJID(senderJid)

  const senderNumber = fromJID(senderJid)
  const isOwnerSender = isOwner(senderJid)
  const fromMe = msg.key.fromMe || false

  // ─── Teks & Tipe ─────────────────────────────────────────
  const body = extractText(msg)
  const msgType = extractType(msg)
  const quoted = extractQuoted(msg)

  // ─── Prefix & Command ────────────────────────────────────
  const prefixMatch = body.match(config.prefix)
  const prefix = prefixMatch ? prefixMatch[0] : ""
  const isCmd = !!prefix
  const rawArgs = body.slice(prefix.length).trim().split(/\s+/)
  const command = rawArgs.shift()?.toLowerCase() || ""
  const args = rawArgs
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

        // Handle LID + JID — Baileys v7 bisa kembalikan LID
        admins = members
          .filter((p) => p.admin === "admin" || p.admin === "superadmin")
          .map((p) => p.id)

        const botJid = normalizeJID(sock.user?.id || "")

        isBotAdmin = members.some(
          (p) =>
            (p.admin === "admin" || p.admin === "superadmin") &&
            compareJID(p.id, botJid)
        )

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

// ─── Anti Delete Handler ──────────────────────────────────────

/**
 * Tangani pesan yang dihapus (revoke). Jika antidelete aktif,
 * kirim ulang pesan asli dari store ke grup.
 */
const handleAntiDelete = async (sock, msg, store) => {
  try {
    const jid = msg.key.remoteJid
    const groupData = getGroup(jid)
    if (!groupData?.antidelete) return

    const protocol = msg.message?.protocolMessage
    // type 0 = REVOKE
    if (!protocol || protocol.type !== 0) return

    const deletedKey = protocol.key
    if (!deletedKey?.id) return

    // Ambil pesan asli dari store
    const original = store.loadMessage(jid, deletedKey.id)
    if (!original?.message) return

    // Siapa yang menghapus
    const deleter = msg.key.participant || msg.participant || ""
    const sender = deletedKey.participant || original.key?.participant || ""

    await sock.sendMessage(jid, {
      text:
        `🗑️ *ANTI DELETE*\n\n` +
        `@${fromJID(deleter)} menghapus pesan dari @${fromJID(sender)}.\n` +
        `Berikut pesan yang dihapus:`,
      mentions: [deleter, sender].filter(Boolean),
    })

    // Kirim ulang pesan asli
    await sock.sendMessage(jid, { forward: original })
  } catch (err) {
    logError("Error pada anti delete", err)
  }
}

// ─── Main Handler ─────────────────────────────────────────────

const handler = async (sock, msg, store) => {
  try {
    if (!msg?.message) return
    if (msg.key?.remoteJid === "status@broadcast") return

    const dbSettings = getSettings()

    // Self mode — hanya respons pesan dari bot sendiri
    if (dbSettings.selfMode && !msg.key.fromMe) return

    // Auto read
    if (dbSettings.autoRead) {
      await sock.readMessages([msg.key]).catch(() => {})
    }

    incrementMessages()

    const ctx = await buildContext(sock, msg, store)

    // ─── ANTI DELETE — lacak pesan yang dihapus ──────────
    if (ctx.isGroupMsg && ctx.msgType === "protocolMessage") {
      await handleAntiDelete(sock, msg, store)
      return
    }

    // Auto typing saat command masuk
    if (dbSettings.autoTyping && ctx.isCmd) {
      await sock
        .sendPresenceUpdate("composing", ctx.jid)
        .catch(() => {})
      await sleep(300)
      await sock.sendPresenceUpdate("paused", ctx.jid).catch(() => {})
    }

    // Bot mode check
    const botMode = dbSettings.botMode || config.settings.botMode
    if (botMode === "group" && !ctx.isGroupMsg) return
    if (botMode === "private" && ctx.isGroupMsg) return

    // ─── PROTECTION — cek semua anti-* (semua pesan grup) ─
    if (ctx.isGroupMsg) {
      const handled = await runProtection(ctx)
      if (handled) return // pesan ditindak, hentikan proses
    }

    // ─── MUTE — bot diam di grup (kecuali admin & owner) ──
    if (
      ctx.isGroupMsg &&
      ctx.groupData?.mute &&
      !ctx.isAdminSender &&
      !ctx.isOwnerSender
    ) {
      return
    }

    if (!ctx.isCmd) return

    logMsg(ctx.senderNumber, `${ctx.prefix}${ctx.command}`)
    incrementCommands()

    // Cari plugin yang cocok
    for (const [pattern, cmd] of plugins) {
      let isMatch = false

      if (typeof pattern === "string") {
        isMatch = ctx.command === pattern.toLowerCase()
      } else if (pattern instanceof RegExp) {
        isMatch = pattern.test(ctx.command)
      }

      if (!isMatch) continue

      // Cek permission
      const { allowed, reason } = await checkPermission(ctx, cmd)
      if (!allowed) {
        await ctx.reply.text(config.msg[reason] || config.msg.error)
        return
      }

      // Jalankan command (tanpa reaction emoji — chat lebih bersih)
      try {
        await cmd.handler(ctx)
      } catch (err) {
        logError(`Error command: ${ctx.command}`, err)
        await ctx.reply.text(config.msg.error).catch(() => {})
      }

      break
    }
  } catch (err) {
    logError("Error pada handler utama", err)
  }
}

// ─── Group Participant Update ─────────────────────────────────

handler.onGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update
    const groupData = getGroup(id)

    let groupMeta = null
    try {
      groupMeta = await sock.groupMetadata(id)
    } catch {}

    const groupName = groupMeta?.subject || id
    const memberCount = groupMeta?.participants?.length || 0

    for (const participant of participants) {
      const number = fromJID(participant)

      // ─── WELCOME ───────────────────────────────────────
      if (action === "add" && groupData?.welcome) {
        // Ganti placeholder pada teks custom
        const template =
          groupData.welcomeText ||
          "👋 Selamat datang @user di grup *@group*!\n\nKamu anggota ke-@count. Semoga betah ya 😊"

        const text = template
          .replace(/@user/g, `@${number}`)
          .replace(/@group/g, groupName)
          .replace(/@count/g, memberCount)

        const content = { text, mentions: [participant] }

        if (groupData.welcomeImage) {
          await sock.sendMessage(id, {
            image: { url: groupData.welcomeImage },
            caption: text,
            mentions: [participant],
          })
        } else {
          await sock.sendMessage(id, content)
        }
      }

      // ─── GOODBYE ───────────────────────────────────────
      if ((action === "remove" || action === "leave") && groupData?.goodbye) {
        const template =
          groupData.goodbyeText ||
          "👋 Sampai jumpa @user, semoga sukses selalu!"

        const text = template
          .replace(/@user/g, `@${number}`)
          .replace(/@group/g, groupName)
          .replace(/@count/g, memberCount)

        if (groupData.goodbyeImage) {
          await sock.sendMessage(id, {
            image: { url: groupData.goodbyeImage },
            caption: text,
            mentions: [participant],
          })
        } else {
          await sock.sendMessage(id, { text, mentions: [participant] })
        }
      }
    }
  } catch (err) {
    logError("Error pada group update handler", err)
  }
}

export default handler
