// ============================================================
//   HABIBIH BOT - Plugin Downloader (Inti)
//   Command:
//     .tiktok .tiktokmp3 .ytmp3 .ytmp4 .play .ytsearch
//     .ig .fb .twitter .pin .capcut .gdrive .mediafire
//     .spotify .soundcloud .threads .snackvideo
//
//   Engine: lib/downloader.js (modular, multi-sumber/fallback).
//   Pengiriman media memakai deteksi Content-Type agar video tidak
//   pernah terkirim sebagai gambar/thumbnail.
//   Semua balasan dalam Bahasa Indonesia.
// ============================================================

import config from "../config.js"
import dl, { isValidUrl, formatDuration } from "../lib/downloader.js"
import { logError } from "../lib/logger.js"

// ─── Helper ───────────────────────────────────────────────────

const foot = `\n\n📌 ${config.watermark}`

/** Bangun caption rapi; baris dengan value kosong otomatis di-skip. */
const buildCaption = (title, rows = []) => {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && `${v}`.trim() !== "")
    .map(([label, v]) => `${label}: ${v}`)
    .join("\n")
  return `${title}${body ? `\n\n${body}` : ""}${foot}`
}

/** Error sopan + log (tidak pernah crash). */
const fail = async (ctx, judul, err) => {
  logError(`Downloader ${judul} gagal`, err)
  const detail =
    err?.message && err.message.length < 200 ? `\n\n_Alasan: ${err.message}_` : ""
  await ctx.reply
    .text(
      `⚠️ *Gagal mengunduh dari ${judul}.*\n` +
        `Semua sumber sedang sibuk / link tidak didukung. Coba lagi nanti.${detail}`
    )
    .catch(() => {})
}

/** Validasi URL input, balas panduan bila kosong/invalid. */
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

const startProcess = (ctx) => ctx.reply.react("⏳").catch(() => {})
const doneProcess = (ctx) => ctx.reply.react("✅").catch(() => {})

/**
 * Kirim satu URL media dengan tipe yang benar (video/image/audio),
 * dideteksi via Content-Type.
 */
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

/**
 * Kirim daftar URL media (string[]). Caption header hanya di item pertama.
 * @returns {Promise<number>} jumlah media terkirim
 */
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

/** Kirim hasil YouTube (audio/video) yang bisa Buffer ATAU URL. */
const sendYtMedia = (ctx, kind, media, caption = "") => {
  const source = media.buffer ? media.buffer : { url: media.url }
  if (kind === "audio") {
    return ctx.sock.sendMessage(
      ctx.jid,
      {
        audio: source,
        mimetype: media.mimetype || "audio/mp4",
        fileName: `${media.title || "audio"}.mp3`,
      },
      { quoted: ctx.msg }
    )
  }
  return ctx.sock.sendMessage(
    ctx.jid,
    { video: source, mimetype: media.mimetype || "video/mp4", caption },
    { quoted: ctx.msg }
  )
}

// ─── Commands ─────────────────────────────────────────────────

export const commands = [
  // ── TIKTOK ──────────────────────────────────────────────
  {
    pattern: /^(tiktok|tt|ttdl)$/,
    description: "Download video/foto TikTok tanpa watermark",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".tiktok https://vt.tiktok.com/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.tiktok(url)
        const caption = buildCaption("🎵 *TIKTOK*", [
          ["👤 Author", data.author],
          ["📝 Judul", data.title],
          ["⏱️ Durasi", data.duration ? formatDuration(data.duration) : ""],
        ])
        if (data.type === "image" && data.images.length) {
          for (let i = 0; i < data.images.length; i++) {
            await ctx.sock.sendMessage(
              ctx.jid,
              {
                image: { url: data.images[i] },
                caption: i === 0 ? caption : `🖼️ Slide ${i + 1}/${data.images.length}`,
              },
              { quoted: ctx.msg }
            )
          }
          if (data.audio) {
            await ctx.sock.sendMessage(
              ctx.jid,
              { audio: { url: data.audio }, mimetype: "audio/mp4" },
              { quoted: ctx.msg }
            )
          }
        } else if (data.video) {
          await ctx.sock.sendMessage(
            ctx.jid,
            { video: { url: data.video }, caption },
            { quoted: ctx.msg }
          )
        } else {
          throw new Error("Media tidak ditemukan.")
        }
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "TikTok", err)
      }
    },
  },

  // ── TIKTOK MP3 ──────────────────────────────────────────
  {
    pattern: /^(tiktokmp3|ttmp3|ttaudio)$/,
    description: "Download audio/sound dari TikTok",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".tiktokmp3 https://vt.tiktok.com/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.tiktokMp3(url)
        await ctx.sock.sendMessage(
          ctx.jid,
          { audio: { url: data.url }, mimetype: "audio/mp4", fileName: `${data.title}.mp3` },
          { quoted: ctx.msg }
        )
        await ctx.reply.text(
          buildCaption("🎧 *TIKTOK MP3*", [
            ["🎵 Judul", data.title],
            ["👤 Author", data.author],
          ])
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "TikTok MP3", err)
      }
    },
  },

  // ── YOUTUBE MP3 ─────────────────────────────────────────
  {
    pattern: /^(ytmp3|ytaudio|yta)$/,
    description: "Download audio (mp3) dari YouTube",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".ytmp3 https://youtu.be/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.ytmp3(url)
        await sendYtMedia(ctx, "audio", data)
        await ctx.reply.text(
          buildCaption("🎧 *YOUTUBE MP3*", [
            ["📝 Judul", data.title],
            ["👤 Channel", data.author],
            ["⏱️ Durasi", data.durationText],
          ])
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "YouTube MP3", err)
      }
    },
  },

  // ── YOUTUBE MP4 ─────────────────────────────────────────
  {
    pattern: /^(ytmp4|ytvideo|ytv)$/,
    description: "Download video (mp4) dari YouTube",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".ytmp4 https://youtu.be/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.ytmp4(url)
        const caption = buildCaption("🎬 *YOUTUBE MP4*", [
          ["📝 Judul", data.title],
          ["👤 Channel", data.author],
          ["⏱️ Durasi", data.durationText],
        ])
        await sendYtMedia(ctx, "video", data, caption)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "YouTube MP4", err)
      }
    },
  },

  // ── PLAY ─────────────────────────────────────────────────
  {
    pattern: /^(play|ytplay)$/,
    description: "Cari & putar musik dari YouTube (audio)",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) return ctx.reply.text(`❌ Masukkan judul lagu.\n\nContoh:\n.play sholawat nabi`)
      await startProcess(ctx)
      try {
        const data = await dl.play(query)
        const info = buildCaption("🎵 *PLAY - YOUTUBE*", [
          ["📝 Judul", data.title],
          ["👤 Channel", data.author],
          ["⏱️ Durasi", data.durationText],
        ])
        if (data.thumbnail && isValidUrl(data.thumbnail)) {
          await ctx.sock.sendMessage(
            ctx.jid,
            { image: { url: data.thumbnail }, caption: info },
            { quoted: ctx.msg }
          )
        } else {
          await ctx.reply.text(info)
        }
        await sendYtMedia(ctx, "audio", data)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Play (YouTube)", err)
      }
    },
  },

  // ── YT SEARCH ────────────────────────────────────────────
  {
    pattern: /^(ytsearch|yts|ytcari)$/,
    description: "Cari video di YouTube",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) return ctx.reply.text(`❌ Masukkan kata kunci.\n\nContoh:\n.ytsearch murottal juz 30`)
      await startProcess(ctx)
      try {
        const results = await dl.ytsearch(query, 8)
        let text = `🔎 *HASIL PENCARIAN YOUTUBE*\n_${query}_\n`
        results.forEach((r, i) => {
          const views = r.viewsText ? ` • 👁️ ${r.viewsText}` : ""
          text +=
            `\n*${i + 1}.* ${r.title}\n   👤 ${r.author} • ⏱️ ${r.durationText}${views}\n   🔗 ${r.url}\n`
        })
        text += `\n💡 Putar audio: *.play <judul>* atau *.ytmp3 <url>*${foot}`
        await ctx.reply.text(text)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "YouTube Search", err)
      }
    },
  },

  // ── INSTAGRAM ────────────────────────────────────────────
  {
    pattern: /^(ig|instagram|igdl)$/,
    description: "Download foto/video/reels Instagram",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".ig https://www.instagram.com/reel/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.instagram(url)
        await sendMediaList(ctx, urls, `📸 *INSTAGRAM*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Instagram", err)
      }
    },
  },

  // ── FACEBOOK ─────────────────────────────────────────────
  {
    pattern: /^(fb|facebook|fbdown)$/,
    description: "Download video Facebook",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".fb https://www.facebook.com/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.facebook(url)
        await sendMediaList(ctx, urls, `📘 *FACEBOOK*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Facebook", err)
      }
    },
  },

  // ── TWITTER / X ──────────────────────────────────────────
  {
    pattern: /^(twitter|x|twdl)$/,
    description: "Download video/gambar Twitter (X)",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".twitter https://x.com/user/status/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.twitter(url)
        await sendMediaList(ctx, urls, `🐦 *TWITTER / X*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Twitter/X", err)
      }
    },
  },

  // ── PINTEREST ────────────────────────────────────────────
  {
    pattern: /^(pin|pinterest|pindl)$/,
    description: "Download gambar/video Pinterest",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".pin https://pin.it/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.pinterest(url)
        await sendMediaList(ctx, urls, `📌 *PINTEREST*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Pinterest", err)
      }
    },
  },

  // ── CAPCUT ───────────────────────────────────────────────
  {
    pattern: /^(capcut|cc)$/,
    description: "Download video template CapCut",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".capcut https://www.capcut.com/t/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.capcut(url)
        await sendMediaList(ctx, urls, `✂️ *CAPCUT*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "CapCut", err)
      }
    },
  },

  // ── GOOGLE DRIVE ─────────────────────────────────────────
  {
    pattern: /^(gdrive|gdrivedl|drive)$/,
    description: "Download file dari Google Drive",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".gdrive https://drive.google.com/file/d/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.gdrive(url)
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            document: { url: data.url },
            fileName: data.fileName,
            mimetype: data.mimetype || "application/octet-stream",
            caption: buildCaption("📁 *GOOGLE DRIVE*", [["📝 Nama", data.fileName]]),
          },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Google Drive", err)
      }
    },
  },

  // ── MEDIAFIRE ────────────────────────────────────────────
  {
    pattern: /^(mediafire|mf|mfire)$/,
    description: "Download file dari MediaFire",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".mediafire https://www.mediafire.com/file/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.mediafire(url)
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            document: { url: data.url },
            fileName: data.fileName,
            mimetype: data.mimetype || "application/octet-stream",
            caption: buildCaption("📁 *MEDIAFIRE*", [
              ["📝 Nama", data.fileName],
              ["📦 Ukuran", data.sizeText || ""],
            ]),
          },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "MediaFire", err)
      }
    },
  },

  // ── SPOTIFY ──────────────────────────────────────────────
  {
    pattern: /^(spotify|spotifydl|spdl)$/,
    description: "Download lagu Spotify (audio via YouTube)",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".spotify https://open.spotify.com/track/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const data = await dl.spotify(url)
        const info = buildCaption("🎶 *SPOTIFY*", [
          ["🎵 Judul", data.title],
          ["👤 Channel", data.author],
          ["🔁 Sumber audio", data.source],
        ])
        if (data.thumbnail && isValidUrl(data.thumbnail)) {
          await ctx.sock.sendMessage(
            ctx.jid,
            { image: { url: data.thumbnail }, caption: info },
            { quoted: ctx.msg }
          )
        } else {
          await ctx.reply.text(info)
        }
        await sendYtMedia(ctx, "audio", data)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Spotify", err)
      }
    },
  },

  // ── SOUNDCLOUD ───────────────────────────────────────────
  {
    pattern: /^(soundcloud|scdl|sc)$/,
    description: "Download lagu dari SoundCloud",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".soundcloud https://soundcloud.com/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.soundcloud(url)
        const audio = (Array.isArray(urls) ? urls : [urls]).find(isValidUrl)
        if (!audio) throw new Error("Audio tidak ditemukan.")
        await ctx.sock.sendMessage(
          ctx.jid,
          { audio: { url: audio }, mimetype: "audio/mp4", fileName: "soundcloud.mp3" },
          { quoted: ctx.msg }
        )
        await ctx.reply.text(`🔊 *SOUNDCLOUD*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "SoundCloud", err)
      }
    },
  },

  // ── THREADS ──────────────────────────────────────────────
  {
    pattern: /^(threads|thread)$/,
    description: "Download media dari Threads",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".threads https://www.threads.net/@user/post/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const items = await dl.threads(url)
        const urls = (Array.isArray(items) ? items : [items]).map((it) =>
          typeof it === "string" ? it : it.url
        )
        await sendMediaList(ctx, urls, `🧵 *THREADS*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Threads", err)
      }
    },
  },

  // ── SNACKVIDEO ───────────────────────────────────────────
  {
    pattern: /^(snackvideo|snack|svdl)$/,
    description: "Download video SnackVideo",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,
    handler: async (ctx) => {
      const url = await needUrl(ctx, ".snackvideo https://www.snackvideo.com/xxxx")
      if (!url) return
      await startProcess(ctx)
      try {
        const urls = await dl.snackvideo(url)
        await sendMediaList(ctx, urls, `🍿 *SNACKVIDEO*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "SnackVideo", err)
      }
    },
  },
]
