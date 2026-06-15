// ============================================================
//   HABIBIH BOT - YouTube Scraper
//   Sumber utama: youtubei.js (InnerTube) — library maintained,
//   keyless, tidak bergantung server pihak ketiga.
//   Fallback: Cobalt (bila dikonfigurasi).
// ============================================================

import {
  httpClient,
  cobaltDownload,
  tryProviders,
  streamToBuffer,
  parseYoutubeId,
  formatDuration,
  isValidUrl,
} from "./core.js"
import { logError, logWarn } from "../logger.js"

// ─── Singleton InnerTube ─────────────────────────────────────

let _yt = null
const getInnertube = async () => {
  if (_yt) return _yt
  try {
    const mod = await import("youtubei.js")
    const Innertube = mod.Innertube || mod.default?.Innertube || mod.default
    _yt = await Innertube.create({ retrieve_player: true })
    return _yt
  } catch (err) {
    logError("Gagal inisialisasi youtubei.js", err)
    throw new Error("Engine YouTube belum siap (npm install youtubei.js)")
  }
}

/** Ambil teks dari node youtubei.js (Text object / string). */
const txt = (v) => {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (typeof v.text === "string") return v.text
  const s = v.toString?.()
  return s && s !== "[object Object]" ? s : ""
}

// ─── Pencarian ───────────────────────────────────────────────

/**
 * Cari video YouTube.
 * @returns {Promise<Array<{id,title,url,author,duration,durationText,viewsText,thumbnail}>>}
 */
export const ytsearch = async (query, limit = 10) => {
  if (!query || !query.trim()) throw new Error("Kata kunci pencarian kosong.")
  const yt = await getInnertube()
  const search = await yt.search(query.trim(), { type: "video" })
  const items = search?.videos || search?.results || []

  const results = items
    .filter((v) => v && (v.id || v.video_id))
    .map((v) => {
      const id = v.id || v.video_id
      const seconds = v.duration?.seconds || 0
      return {
        id,
        title: txt(v.title) || "Tanpa judul",
        url: `https://www.youtube.com/watch?v=${id}`,
        author: txt(v.author?.name) || txt(v.author) || "Unknown",
        duration: seconds,
        durationText: v.duration?.text || formatDuration(seconds),
        viewsText: txt(v.view_count) || txt(v.short_view_count) || "",
        thumbnail: v.thumbnails?.[0]?.url || v.best_thumbnail?.url || "",
      }
    })
    .filter((r) => r.id)

  if (!results.length) throw new Error("Video tidak ditemukan.")
  return results.slice(0, limit)
}

// ─── Metadata + Download ─────────────────────────────────────

const getMeta = async (id, kind) => {
  const yt = await getInnertube()
  const info = await yt.getInfo(id)
  const b = info.basic_info || {}
  return {
    info,
    yt,
    meta: {
      id,
      title: txt(b.title) || "YouTube",
      author: txt(b.author) || txt(b.channel?.name) || "Unknown",
      duration: b.duration || 0,
      durationText: formatDuration(b.duration || 0),
      thumbnail: b.thumbnail?.[0]?.url || "",
      mimetype: kind === "audio" ? "audio/mp4" : "video/mp4",
    },
  }
}

/** Provider A: youtubei.js -> Buffer (paling andal utk playback WA). */
const viaInnertube = async (id, kind) => {
  const { info, yt, meta } = await getMeta(id, kind)
  const dlOpts =
    kind === "audio"
      ? { type: "audio", quality: "best", format: "mp4" }
      : { type: "video+audio", quality: "best", format: "mp4" }
  try {
    const stream = await info.download(dlOpts)
    const buffer = await streamToBuffer(stream)
    if (buffer?.length) return { ...meta, buffer, url: null }
  } catch (err) {
    logWarn(`youtubei download gagal (${err.message}), coba mode URL`)
  }
  // fallback internal: format ter-decipher -> URL
  const fmt = info.chooseFormat({
    type: kind === "audio" ? "audio" : "video+audio",
    quality: "best",
  })
  const url =
    typeof fmt.decipher === "function" ? fmt.decipher(yt.session.player) : fmt.url
  if (url) return { ...meta, buffer: null, url }
  throw new Error("stream tidak tersedia")
}

/** Provider B: Cobalt -> URL langsung. */
const viaCobalt = async (id, kind) => {
  const urls = await cobaltDownload(`https://www.youtube.com/watch?v=${id}`, {
    mode: kind === "audio" ? "audio" : "auto",
  })
  if (!urls.length) throw new Error("cobalt kosong")
  return {
    id,
    title: "YouTube",
    author: "Unknown",
    duration: 0,
    durationText: "?",
    thumbnail: "",
    mimetype: kind === "audio" ? "audio/mp4" : "video/mp4",
    buffer: null,
    url: urls[0],
  }
}

const ytDownload = (idOrUrl, kind) => {
  const id = parseYoutubeId(idOrUrl)
  if (!id) throw new Error("URL/ID YouTube tidak valid.")
  return tryProviders(`YouTube ${kind}`, [
    { name: "youtubei", fn: () => viaInnertube(id, kind) },
    { name: "cobalt", fn: () => viaCobalt(id, kind) },
  ])
}

/** Download audio YouTube (.ytmp3). */
export const ytmp3 = (idOrUrl) => ytDownload(idOrUrl, "audio")

/** Download video YouTube (.ytmp4). */
export const ytmp4 = (idOrUrl) => ytDownload(idOrUrl, "video")

/** Cari judul -> ambil audio video pertama (.play). */
export const play = async (query) => {
  const results = await ytsearch(query, 1)
  const first = results[0]
  const audio = await ytDownload(first.id, "audio")
  return {
    ...audio,
    title: audio.title && audio.title !== "YouTube" ? audio.title : first.title,
    author: audio.author && audio.author !== "Unknown" ? audio.author : first.author,
    thumbnail: audio.thumbnail || first.thumbnail,
    durationText:
      audio.durationText && audio.durationText !== "?"
        ? audio.durationText
        : first.durationText,
  }
}

export { isValidUrl }
