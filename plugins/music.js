// ============================================================
//   HABIBIH BOT - Plugin Musik & Audio
//   Command:
//     .lirik <judul>      — Cari lirik lagu
//     .chord <judul>      — Cari kunci gitar (chord)
//     .shazam / .carilagu — Kenali lagu dari VN/audio/video (reply)
//     .ringtone <nama>    — Cari & kirim nada dering singkat
//
//   Engine: lib/music.js (KEYLESS, tanpa API key)
//   Semua balasan dalam Bahasa Indonesia.
// ============================================================

import { downloadMediaMessage } from "@whiskeysockets/baileys"
import config from "../config.js"
import music from "../lib/music.js"
import { isValidUrl } from "../lib/downloader.js"
import logger, { logError } from "../lib/logger.js"

// ─── Helper ───────────────────────────────────────────────────

const foot = `\n\n📌 ${config.watermark}`

const startProcess = (ctx) => ctx.reply.react("⏳").catch(() => {})
const doneProcess = (ctx) => ctx.reply.react("✅").catch(() => {})

/** Pesan error sopan + log (tidak pernah crash). */
const fail = async (ctx, judul, err) => {
  logError(`Musik ${judul} gagal`, err)
  const detail =
    err?.message && err.message.length < 180 ? `\n\n_Alasan: ${err.message}_` : ""
  await ctx.reply
    .text(
      `⚠️ *Gagal memproses ${judul}.*\n` +
        `Sumber mungkin sedang sibuk atau data tidak ditemukan. ` +
        `Coba lagi sebentar lagi.${detail}`
    )
    .catch(() => {})
}

/**
 * Cari node media (audio/video/document) di dalam quoted message,
 * sekaligus tentukan ekstensi file sementara untuk Shazam.
 * @param {object} qmsg - ctx.quoted.message
 * @returns {{ kind:string, ext:string }|null}
 */
const pickQuotedMedia = (qmsg) => {
  if (!qmsg) return null
  // unwrap pembungkus umum
  const m =
    qmsg.viewOnceMessage?.message ||
    qmsg.viewOnceMessageV2?.message ||
    qmsg.ephemeralMessage?.message ||
    qmsg

  if (m.audioMessage) return { kind: "audioMessage", ext: "mp3" }
  if (m.videoMessage) return { kind: "videoMessage", ext: "mp4" }
  if (m.documentMessage) {
    const mime = m.documentMessage.mimetype || ""
    if (/audio|video/i.test(mime)) {
      return { kind: "documentMessage", ext: /video/i.test(mime) ? "mp4" : "mp3" }
    }
  }
  return null
}

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  // ════════════════════════════════════════════════════════
  //  LIRIK
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(lirik|lyrics)$/,
    description: "Cari lirik lagu",
    category: "musik",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) {
        return ctx.reply.text(
          `❌ Masukkan judul lagu.\n\nContoh:\n.lirik sajadah panjang`
        )
      }

      await startProcess(ctx)
      try {
        const data = await music.lyrics(query)
        // WhatsApp membatasi panjang teks; potong bila kelewat panjang
        let lyric = data.lyrics
        if (lyric.length > 3500) lyric = lyric.slice(0, 3500) + "\n\n_(...dipotong)_"

        const header =
          `🎼 *LIRIK LAGU*\n\n` +
          `📝 Judul  : ${data.title}\n` +
          `🎤 Artis  : ${data.artist}` +
          (data.album ? `\n💿 Album  : ${data.album}` : "")

        await ctx.reply.text(`${header}\n\n${lyric}${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Lirik", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  CHORD / KUNCI GITAR
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(chord|kunci|kuncigitar)$/,
    description: "Cari kunci gitar (chord) lagu",
    category: "musik",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) {
        return ctx.reply.text(
          `❌ Masukkan judul lagu.\n\nContoh:\n.chord wonderwall oasis`
        )
      }

      await startProcess(ctx)
      try {
        const data = await music.chord(query)
        let body = data.content
        if (body.length > 3500) body = body.slice(0, 3500) + "\n\n_(...dipotong)_"

        const header =
          `🎸 *CHORD GITAR*\n\n` +
          `📝 Judul : ${data.title}\n` +
          `🎤 Artis : ${data.artist}`

        await ctx.reply.text(`${header}\n\n\`\`\`${body}\`\`\`${foot}`)
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Chord", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  SHAZAM / CARI LAGU (reply VN/audio/video)
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(shazam|carilagu|whatmusic)$/,
    description: "Kenali judul lagu dari VN/audio/video (reply)",
    category: "musik",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const quoted = ctx.quoted
      const media = quoted ? pickQuotedMedia(quoted.message) : null

      if (!media) {
        return ctx.reply.text(
          `❌ Reply (balas) sebuah *voice note*, *audio*, atau *video pendek* lalu ketik *.shazam*.`
        )
      }

      await startProcess(ctx)
      try {
        // Unduh media yang di-reply menjadi buffer
        const fakeMsg = {
          key: {
            remoteJid: ctx.jid,
            id: quoted.stanzaId || undefined,
            participant: quoted.sender || undefined,
          },
          message: quoted.message,
        }

        const buffer = await downloadMediaMessage(
          fakeMsg,
          "buffer",
          {},
          { logger, reuploadRequest: ctx.sock.updateMediaMessage }
        )

        const data = await music.recognizeAudio(buffer, media.ext)

        const caption =
          `🎧 *LAGU DIKENALI!*\n\n` +
          `📝 Judul : ${data.title}\n` +
          `🎤 Artis : ${data.artist}` +
          (data.album ? `\n💿 Album : ${data.album}` : "") +
          (data.genre ? `\n🎵 Genre : ${data.genre}` : "") +
          (data.link ? `\n🔗 ${data.link}` : "") +
          `\n\n💡 Putar audio: *.play ${data.title} ${data.artist}*` +
          foot

        if (data.cover && isValidUrl(data.cover)) {
          await ctx.sock.sendMessage(
            ctx.jid,
            { image: { url: data.cover }, caption },
            { quoted: ctx.msg }
          )
        } else {
          await ctx.reply.text(caption)
        }
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Shazam", err)
      }
    },
  },

  // ════════════════════════════════════════════════════════
  //  RINGTONE
  // ════════════════════════════════════════════════════════
  {
    pattern: /^(ringtone|nada|nadadering)$/,
    description: "Cari & kirim nada dering singkat",
    category: "musik",
    owner: false, group: false, private: false,
    admin: false, botAdmin: false, premium: false,

    handler: async (ctx) => {
      const query = ctx.query?.trim()
      if (!query) {
        return ctx.reply.text(
          `❌ Masukkan nama ringtone.\n\nContoh:\n.ringtone adzan merdu`
        )
      }

      await startProcess(ctx)
      try {
        const data = await music.ringtone(query)
        const source = data.buffer ? data.buffer : { url: data.url }

        await ctx.sock.sendMessage(
          ctx.jid,
          {
            audio: source,
            mimetype: data.mimetype || "audio/mp4",
            fileName: `${data.title || query}.mp3`,
          },
          { quoted: ctx.msg }
        )
        await ctx.reply.text(
          `🔔 *RINGTONE*\n\n📝 ${data.title}\n⏱️ ${data.durationText || "-"}${foot}`
        )
        await doneProcess(ctx)
      } catch (err) {
        await fail(ctx, "Ringtone", err)
      }
    },
  },
]
