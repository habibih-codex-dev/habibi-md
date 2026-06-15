// ============================================================
//   HABIBIH BOT - Plugin Downloader Tambahan
//   Command:
//     .igstory <username> — Story Instagram
//     .fbstory <url>      — Story/Reel Facebook
//     .terabox <url>      — File/video Terabox
//     .sfile <url>        — File dari Sfile.mobi
//     .mega <url>         — File dari Mega.nz
//
//   Engine: lib/downloader.js (modular, multi-sumber/fallback).
//   Semua balasan dalam Bahasa Indonesia.
// ============================================================

import config from "../config.js"
import dl, { isValidUrl } from "../lib/downloader.js"
import { logError } from "../lib/logger.js"

// ─── Helper ───────────────────────────────────────────────────

const foot = `\n\n📌 ${config.watermark}`

const startProcess = (ctx) => ctx.reply.react("⏳").catch(() => {})
const doneProcess = (ctx) => ctx.reply.react("✅").catch(() => {})

const fail = async (ctx, judul, err) => {
  logError(`Downloader ${judul} gagal`, err)
  const detail =
    err?.message && err.message.length < 200 ? `\n\n_Alasan: ${err.message}_` : ""
  await ctx.reply
    .text(
      `⚠️ *Gagal mengunduh dari ${judul}.*\n` +
        `Sumber sibuk, link privat, atau tidak didukung. Coba lagi nanti.${detail}`
    )
    .catch(() => {})
}

const needUrl = async (ctx, contoh) => {
  const url = ctx.query?.trim()
  if (!url) {
    await ctx.reply.text(`❌ Masukkan URL terlebih dahulu.\n\nContoh:\n${contoh}`)
    return null
  }
  if (!isValidUrl(url)) {
    await ctx.reply.text(`❌ URL tidak valid.\n\nContoh:\n${contoh}`)
    return null
  }
  return url
}

/** Kirim satu URL dengan tipe benar (video/image/audio) via Content-Type. */
const sendSmartMedia = async (ctx, url, caption = "") => {
  const type = await dl.detectMediaType(url)
  if (type === "video") {
    return ctx.sock.sendMessage(ctx.jid, { video: { url }, caption }, { quoted: ctx.msg })
  }
  if (type === "audio") {
    return ctx.sock.sendMessage(
      ctx.jid,
      { audio: { url }, mimetype: "audio/mp4" },
      { quoted: ctx.msg }
    )
  }
  return ctx.sock.sendMessage(ctx.jid, { image: { url }, caption }, { quoted: ctx.msg })
}

/** Kirim daftar URL media; header hanya di item pertama. */
const sendMediaList = async (ctx, urls, header = "") => {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(isValidUrl)
  let sent = 0
  for (const url of list) {
    try {
      await sendSmartMedia(ctx, url, sent === 0 ? header : "")
      sent++
    } catch (err) {
      logError("Gagal kirim 1 media", err)
    }
  }
  if (!sent) throw new Error("Media tidak ditemukan / gagal dikirim.")
  return sent
}

// ─── Commands ─────────────────────────────────────────────────

export const commands = [
  // ── INSTAGRAM STORY ─────────────────────────────────────
  {
    pattern: /^(igstory|igstories|story|stalkstory)$/,
    description: "Download Story Instagram (by username)",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const username = ctx.query?.trim()
      if (!username) {
        return ctx.reply.text(`❌ Masukkan username Instagram.\n\nContoh:\n.igstory natgeo`)
      }
      await startProcess(ctx)
      try {
        const items = await dl.igStory(username)
        const uname = username.replace(/^@/, "")
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const caption = i === 0 ? `📸 *IG STORY* — @${uname}${foot}` : ""
          await ctx.sock.sendMessage(
            ctx.jid,
            it.type === "video"
              ? { video: { url: it.url }, caption }
              : { image: { url: it.url }, caption },
            { quoted: ctx.msg }
          )
        }
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Instagram Story", err)
      }
    },
  },

  // ── FACEBOOK STORY ──────────────────────────────────────
  {
    pattern: /^(fbstory|fbstories)$/,
    description: "Download Story/Reel Facebook",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".fbstory https://www.facebook.com/stories/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.fbStory(url)
        await sendMediaList(ctx, urls, `📘 *FACEBOOK STORY*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Facebook Story", err)
      }
    },
  },

  // ── TERABOX ─────────────────────────────────────────────
  {
    pattern: /^(terabox|tb|tbox)$/,
    description: "Download file/video dari Terabox",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".terabox https://terabox.com/s/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.terabox(url)
        const caption =
          `📦 *TERABOX*\n\n📝 Nama  : ${data.fileName}\n📁 Ukuran: ${data.sizeText}${foot}`
        const isVideo = /\.(mp4|mkv|mov|webm|avi)$/i.test(data.fileName)
        if (isVideo) {
          await ctx.sock.sendMessage(
            ctx.jid,
            { video: { url: data.url }, caption },
            { quoted: ctx.msg }
          )
        } else {
          await ctx.sock.sendMessage(
            ctx.jid,
            {
              document: { url: data.url },
              fileName: data.fileName,
              mimetype: "application/octet-stream",
              caption,
            },
            { quoted: ctx.msg }
          )
        }
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Terabox", err)
      }
    },
  },

  // ── SFILE.MOBI ──────────────────────────────────────────
  {
    pattern: /^(sfile|sfilemobi)$/,
    description: "Download file dari Sfile.mobi",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".sfile https://sfile.mobi/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.sfile(url)
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            document: { url: data.url },
            fileName: data.fileName,
            mimetype: "application/octet-stream",
            caption: `📁 *SFILE.MOBI*\n\n📝 ${data.fileName}${foot}`,
          },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Sfile.mobi", err)
      }
    },
  },

  // ── MEGA.NZ ─────────────────────────────────────────────
  {
    pattern: /^(mega|meganz)$/,
    description: "Download file dari Mega.nz",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".mega https://mega.nz/file/xxxx#key")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.mega(url)
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            document: data.buffer,
            fileName: data.fileName,
            mimetype: "application/octet-stream",
            caption: `☁️ *MEGA.NZ*\n\n📝 Nama  : ${data.fileName}\n📁 Ukuran: ${data.sizeText}${foot}`,
          },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Mega.nz", err)
      }
    },
  },
]
