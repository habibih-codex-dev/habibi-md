// ============================================================
//   HABIBIH BOT - Plugin Downloader
//   Command:
//     .tiktok .tiktokmp3 .ytmp3 .ytmp4 .play .ytsearch
//     .ig .fb .twitter .pin .capcut .gdrive
//     .mediafire .spotify .soundcloud .threads .snackvideo
//
//   Engine: lib/downloader.js (KEYLESS, tanpa API key)
//   Semua balasan dalam Bahasa Indonesia.
// ============================================================

import config from "../config.js"
import dl, { extractUrls, isValidUrl, formatDuration } from "../lib/downloader.js"
import { logError } from "../lib/logger.js"

// ─── Helper kecil ────────────────────────────────────────────

/** Footer watermark (baris terpisah, rapi). */
const foot = `\n\n📌 ${config.watermark}`

/**
 * Bangun caption rapi dari pasangan [label, value].
 * Baris dengan value kosong otomatis di-skip.
 * @param {string} title - judul box
 * @param {Array<[string,string|number]>} rows
 */
const buildCaption = (title, rows = []) => {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && `${v}`.trim() !== "")
    .map(([label, v]) => `${label}: ${v}`)
    .join("\n")
  return `${title}${body ? `\n\n${body}` : ""}${foot}`
}

/** Pesan error sopan + log (tidak pernah crash). */
const fail = async (ctx, judul, err) => {
  logError(`Downloader ${judul} gagal`, err)
  const detail =
    err?.message && err.message.length < 160
      ? `\n\n_Alasan: ${err.message}_`
      : ""
  await ctx.reply
    .text(
      `⚠️ *Gagal mengunduh dari ${judul}.*\n` +
        `Server sumber mungkin sedang sibuk atau URL tidak didukung. ` +
        `Coba lagi beberapa saat lagi.${detail}`
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

const startProcess = (ctx) => ctx.reply.react("⏳").catch(() => {})
const doneProcess = (ctx) => ctx.reply.react("✅").catch(() => {})

/**
 * Ambil URL media pertama yang masuk akal dari hasil btch-downloader.
 * Mengutamakan field media utama, baru fallback ke extractUrls().
 * @param {*} item
 * @returns {string|null}
 */
const pickMediaUrl = (item) => {
  const data = Array.isArray(item) ? item[0] : item
  if (!data) return null
  if (typeof data === "string") return isValidUrl(data) ? data : null

  const candidates = [
    data.url,
    data.video,
    data.videoUrl,
    data.hd,
    data.sd,
    data.download,
    data.downloadUrl,
    data.link,
    data.result,
    data.audio,
    data.image,
    data.thumbnail,
  ].filter((u) => typeof u === "string" && isValidUrl(u))

  if (candidates.length) return candidates[0]
  const all = extractUrls(data)
  return all.length ? all[0] : null
}

/**
 * Kirim media dengan deteksi tipe yang benar (video/image/audio)
 * berdasarkan Content-Type — memperbaiki kasus video Instagram yang
 * sebelumnya terkirim sebagai gambar.
 * @param {object} ctx
 * @param {string} url
 * @param {string} caption - hanya dipakai utk video/image
 */
const sendSmartMedia = async (ctx, url, caption = "") => {
  const type = await dl.detectMediaType(url)
  if (type === "video") {
    return ctx.sock.sendMessage(
      ctx.jid,
      { video: { url }, caption },
      { quoted: ctx.msg }
    )
  }
  if (type === "audio") {
    return ctx.sock.sendMessage(
      ctx.jid,
      { audio: { url }, mimetype: "audio/mp4" },
      { quoted: ctx.msg }
    )
  }
  // image + unknown (mayoritas thumbnail/foto) dikirim sebagai gambar
  return ctx.sock.sendMessage(
    ctx.jid,
    { image: { url }, caption },
    { quoted: ctx.msg }
  )
}

/**
 * Kirim hasil YouTube (audio/video) yang bisa berupa Buffer ATAU URL.
 * @param {object} ctx
 * @param {"audio"|"video"} kind
 * @param {{buffer:Buffer|null,url:string|null,title:string,mimetype:string}} media
 * @param {string} caption
 */
const sendYtMedia = async (ctx, kind, media, caption = "") => {
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

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  // ════════════════════════════════════════════════════════
  //  TIKTOK (tanpa watermark)
  // ════════════════════════════════════════════════════════
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
        const caption = buildCaption("🎵 *TIKTOK DOWNLOADER*", [
          ["👤 Author", data.author],
          ["📝 Judul", data.title],
          ["⏱️ Durasi", data.duration ? formatDuration(data.duration) : ""],
        ])

        if (data.type === "image" && data.images.length) {
          // Slide foto -> album terurut
          for (let i = 0; i < data.images.length; i++) {
            await ctx.sock.sendMessage(
              ctx.jid,
              {
                image: { url: data.images[i] },
                caption:
                  i === 0
                    ? caption
                    : `🖼️ Slide ${i + 1}/${data.images.length}`,
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
          throw new Error("Media tidak ditemukan dalam respons.")
        }

        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "TikTok", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  TIKTOK MP3 (audio/sound saja)
  // ════════════════════════════════════════════════════════
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
          {
            audio: { url: data.url },
            mimetype: "audio/mp4",
            fileName: `${data.title}.mp3`,
          },
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

  // ════════════════════════════════════════════════════════
  //  YOUTUBE MP3
  // ════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════
  //  YOUTUBE MP4
  // ════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════
  //  PLAY (cari judul -> kirim audio playable)
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(play|ytplay)$/,
    description: "Cari & putar musik dari YouTube (audio)",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) {
        return ctx.reply.text(
          `❌ Masukkan judul lagu.\n\nContoh:\n.play sholawat nabi`
        )
      }

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

  // ════════════════════════════════════════════════════════
  //  YT SEARCH
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(ytsearch|yts|ytcari)$/,
    description: "Cari video di YouTube",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) {
        return ctx.reply.text(
          `❌ Masukkan kata kunci.\n\nContoh:\n.ytsearch murottal juz 30`
        )
      }

      await startProcess(ctx)
      try {
        const results = await dl.ytsearch(query, 8)

        let text = `🔎 *HASIL PENCARIAN YOUTUBE*\n_${query}_\n`
        results.forEach((r, i) => {
          const views = r.viewsText ? ` • 👁️ ${r.viewsText}` : ""
          text +=
            `\n*${i + 1}.* ${r.title}\n` +
            `   👤 ${r.author} • ⏱️ ${r.durationText}${views}\n` +
            `   🔗 ${r.url}\n`
        })
        text += `\n💡 Putar audio: *.play <judul>* atau *.ytmp3 <url>*`
        text += foot

        await ctx.reply.text(text)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "YouTube Search", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  INSTAGRAM
  // ════════════════════════════════════════════════════════
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
        const result = await dl.instagram(url)
        const items = Array.isArray(result) ? result : [result]
        let sent = 0

        for (const item of items) {
          const media = pickMediaUrl(item)
          if (!media) continue
          // deteksi video vs gambar via Content-Type (akurat untuk IG CDN)
          await sendSmartMedia(
            ctx,
            media,
            sent === 0 ? `📸 *INSTAGRAM*${foot}` : ""
          )
          sent++
        }

        if (!sent) throw new Error("Media tidak ditemukan.")
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Instagram", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  FACEBOOK
  // ════════════════════════════════════════════════════════
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
        const result = await dl.facebook(url)
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Video tidak ditemukan.")
        await sendSmartMedia(ctx, media, `📘 *FACEBOOK*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Facebook", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  TWITTER / X
  // ════════════════════════════════════════════════════════
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
        const result = await dl.twitter(url)
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Media tidak ditemukan.")
        await sendSmartMedia(ctx, media, `🐦 *TWITTER / X*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Twitter/X", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  PINTEREST
  // ════════════════════════════════════════════════════════
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
        const result = await dl.pinterest(url)
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Media tidak ditemukan.")
        await sendSmartMedia(ctx, media, `📌 *PINTEREST*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Pinterest", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  CAPCUT
  // ════════════════════════════════════════════════════════
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
        const result = await dl.capcut(url)
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Video tidak ditemukan.")
        await sendSmartMedia(ctx, media, `✂️ *CAPCUT*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "CapCut", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  GOOGLE DRIVE
  // ════════════════════════════════════════════════════════
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
        const result = await dl.gdrive(url)
        const data = Array.isArray(result) ? result[0] : result
        const media = pickMediaUrl(result)
        if (!media) throw new Error("File tidak ditemukan.")

        const fileName = data?.fileName || data?.name || "file"
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            document: { url: media },
            fileName,
            mimetype: data?.mimetype || "application/octet-stream",
            caption: buildCaption("📁 *GOOGLE DRIVE*", [["📝 Nama", fileName]]),
          },
          { quoted: ctx.msg }
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Google Drive", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  MEDIAFIRE
  // ════════════════════════════════════════════════════════
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
        const result = await dl.mediafire(url)
        const data = Array.isArray(result) ? result[0] : result
        const media = pickMediaUrl(result)
        if (!media) throw new Error("File tidak ditemukan.")

        const fileName = data?.fileName || data?.nama || data?.name || "file"
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            document: { url: media },
            fileName,
            mimetype: data?.mime || data?.mimetype || "application/octet-stream",
            caption: buildCaption("📁 *MEDIAFIRE*", [
              ["📝 Nama", fileName],
              ["📦 Ukuran", data?.size || data?.ukuran || ""],
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

  // ════════════════════════════════════════════════════════
  //  SPOTIFY (metadata Spotify -> audio dari YouTube)
  // ════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════
  //  SOUNDCLOUD
  // ════════════════════════════════════════════════════════
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
        const result = await dl.soundcloud(url)
        const data = Array.isArray(result) ? result[0] : result
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Audio tidak ditemukan.")

        const title = data?.title || data?.name || "SoundCloud Track"
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            audio: { url: media },
            mimetype: "audio/mp4",
            fileName: `${title}.mp3`,
          },
          { quoted: ctx.msg }
        )
        await ctx.reply.text(
          buildCaption("🔊 *SOUNDCLOUD*", [["📝 Judul", title]])
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "SoundCloud", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  THREADS (scraper keyless)
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(threads|thread)$/,
    description: "Download media dari Threads",
    category: "downloader",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const url = await needUrl(
        ctx,
        ".threads https://www.threads.net/@user/post/xxxx"
      )
      if (!url) return

      await startProcess(ctx)
      try {
        const data = await dl.threads(url)
        const caption = `🧵 *THREADS*${foot}`

        if (data.type === "video") {
          await ctx.sock.sendMessage(
            ctx.jid,
            { video: { url: data.url }, caption },
            { quoted: ctx.msg }
          )
        } else {
          await ctx.sock.sendMessage(
            ctx.jid,
            { image: { url: data.url }, caption },
            { quoted: ctx.msg }
          )
        }
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Threads", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  SNACKVIDEO
  // ════════════════════════════════════════════════════════
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
        const result = await dl.snackvideo(url)
        const media = pickMediaUrl(result)
        if (!media) throw new Error("Video tidak ditemukan.")
        await sendSmartMedia(ctx, media, `🍿 *SNACKVIDEO*${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "SnackVideo", err)
      }
    },
  },
]
