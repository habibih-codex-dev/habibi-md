// ============================================================
//   HABIBIH BOT - Plugin Downloader Tambahan
//   Command:
//     .igstory <username> — Story Instagram
//     .fbstory <url>      — Story/Reel Facebook
//     .terabox <url>      — File/video Terabox
//     .sfile <url>        — File dari Sfile.mobi
//     .mega <url>         — File dari Mega.nz
//
//   Engine: lib/downloader.js (KEYLESS, tanpa API key)
//   Semua balasan dalam Bahasa Indonesia.
// ============================================================

import config from "../config.js"
import dl, { isValidUrl, extractUrls } from "../lib/downloader.js"
import { getSettings, updateSettings } from "../lib/database.js"
import { logError } from "../lib/logger.js"

// ─── Helper ───────────────────────────────────────────────────

const foot = `\n\n📌 ${config.watermark}`

/**
 * Ambil cookie sesi: prioritas database (diset Owner via command),
 * lalu fallback ke environment variable (config.session).
 */
const getIgCookie = () =>
  (getSettings().igCookie || config.session?.igCookie || "").trim()
const getFbCookie = () =>
  (getSettings().fbCookie || config.session?.fbCookie || "").trim()

const startProcess = (ctx) => ctx.reply.react("⏳").catch(() => {})
const doneProcess = (ctx) => ctx.reply.react("✅").catch(() => {})

/** Pesan error sopan + log (tidak pernah crash). */
const fail = async (ctx, judul, err) => {
  logError(`Downloader ${judul} gagal`, err)
  const detail =
    err?.message && err.message.length < 180 ? `\n\n_Alasan: ${err.message}_` : ""
  await ctx.reply
    .text(
      `⚠️ *Gagal mengunduh dari ${judul}.*\n` +
        `Server sumber mungkin sibuk, link privat, atau tidak didukung. ` +
        `Coba lagi sebentar lagi.${detail}`
    )
    .catch(() => {})
}

/** Validasi input URL, balas panduan bila kosong/invalid. */
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

/** Ambil URL media pertama yang valid dari hasil scraper. */
const pickMediaUrl = (item) => {
  const data = Array.isArray(item) ? item[0] : item
  if (!data) return null
  if (typeof data === "string") return isValidUrl(data) ? data : null

  const candidates = [
    data.url, data.video, data.videoUrl, data.hd, data.sd,
    data.download, data.downloadUrl, data.link, data.result,
  ].filter((u) => typeof u === "string" && isValidUrl(u))

  if (candidates.length) return candidates[0]
  const all = extractUrls(data)
  return all.length ? all[0] : null
}

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  // ════════════════════════════════════════════════════════
  //  INSTAGRAM STORY
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(igstory|igstories|story|stalkstory)$/,
    description: "Download Story Instagram (by username)",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const username = ctx.query?.trim()
      if (!username) {
        return ctx.reply.text(
          `❌ Masukkan username Instagram.\n\nContoh:\n.igstory natgeo`
        )
      }

      await startProcess(ctx)
      try {
        const items = await dl.igStory(username, { cookie: getIgCookie() })

        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const caption =
            i === 0 ? `📸 *IG STORY* — @${username.replace(/^@/, "")}${foot}` : ""
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

  // ════════════════════════════════════════════════════════
  //  FACEBOOK STORY
  // ════════════════════════════════════════════════════════
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
        const result = await dl.fbStory(url, { cookie: getFbCookie() })
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Media story tidak ditemukan.")

        await ctx.sock.sendMessage(
          ctx.jid,
          { video: { url: media }, caption: `📘 *FACEBOOK STORY*${foot}` },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Facebook Story", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  TERABOX
  // ════════════════════════════════════════════════════════
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

        const isVideo = /\.(mp4|mkv|mov|webm|avi)$/i.test(data.fileName)
        const caption =
          `📦 *TERABOX*\n\n` +
          `📝 Nama  : ${data.fileName}\n` +
          `📁 Ukuran: ${data.sizeText}${foot}`

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

  // ════════════════════════════════════════════════════════
  //  SFILE.MOBI
  // ════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════
  //  MEGA.NZ
  // ════════════════════════════════════════════════════════
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
            caption:
              `☁️ *MEGA.NZ*\n\n` +
              `📝 Nama  : ${data.fileName}\n` +
              `📁 Ukuran: ${data.sizeText}${foot}`,
          },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Mega.nz", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  SET COOKIE INSTAGRAM (Owner)
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(setigcookie|igcookie)$/,
    description: "Set cookie sesi Instagram (untuk .igstory)",
    category: "owner",
    owner: true, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const cookie = ctx.query?.trim()
      if (!cookie) {
        return ctx.reply.text(
          `❌ Masukkan cookie Instagram.\n\n` +
            `Contoh:\n.setigcookie sessionid=12345%3Aabc...\n\n` +
            `💡 *Kirim di chat pribadi* agar cookie tidak terlihat. ` +
            `Ambil dari browser: Application → Cookies → instagram.com → sessionid.`
        )
      }
      updateSettings({ igCookie: cookie })
      await ctx.reply.text(
        `✅ Cookie Instagram tersimpan. *.igstory* kini memakai sesi login.\n` +
          `_Hapus dengan: .delcookie ig_`
      )
    },
  },

  // ════════════════════════════════════════════════════════
  //  SET COOKIE FACEBOOK (Owner)
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(setfbcookie|fbcookie)$/,
    description: "Set cookie sesi Facebook (untuk .fbstory)",
    category: "owner",
    owner: true, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const cookie = ctx.query?.trim()
      if (!cookie) {
        return ctx.reply.text(
          `❌ Masukkan cookie Facebook.\n\n` +
            `Contoh:\n.setfbcookie c_user=100xxx; xs=xxxx; ...\n\n` +
            `💡 *Kirim di chat pribadi.* ` +
            `Ambil dari browser: Application → Cookies → facebook.com.`
        )
      }
      updateSettings({ fbCookie: cookie })
      await ctx.reply.text(
        `✅ Cookie Facebook tersimpan. *.fbstory* kini memakai sesi login.\n` +
          `_Hapus dengan: .delcookie fb_`
      )
    },
  },

  // ════════════════════════════════════════════════════════
  //  HAPUS COOKIE (Owner)
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(delcookie|hapuscookie)$/,
    description: "Hapus cookie sesi IG/FB",
    category: "owner",
    owner: true, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const which = (ctx.args[0] || "").toLowerCase()
      if (which === "ig") {
        updateSettings({ igCookie: "" })
        return ctx.reply.text("🗑️ Cookie Instagram dihapus.")
      }
      if (which === "fb") {
        updateSettings({ fbCookie: "" })
        return ctx.reply.text("🗑️ Cookie Facebook dihapus.")
      }
      updateSettings({ igCookie: "", fbCookie: "" })
      await ctx.reply.text(
        "🗑️ Semua cookie (IG & FB) dihapus.\n_Gunakan: .delcookie ig | .delcookie fb_"
      )
    },
  },

  // ════════════════════════════════════════════════════════
  //  STATUS COOKIE (Owner) — tidak menampilkan isi cookie
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(cookiestatus|cekcookie)$/,
    description: "Cek status cookie sesi IG/FB",
    category: "owner",
    owner: true, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const ig = getIgCookie() ? "✅ Aktif" : "❌ Belum diset"
      const fb = getFbCookie() ? "✅ Aktif" : "❌ Belum diset"
      await ctx.reply.text(
        `🍪 *STATUS COOKIE SESI*\n\n` +
          `📸 Instagram : ${ig}\n` +
          `📘 Facebook  : ${fb}\n\n` +
          `_Atur: .setigcookie / .setfbcookie • Hapus: .delcookie_${foot}`
      )
    },
  },
]
