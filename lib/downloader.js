// ============================================================
//   HABIBIH BOT - Downloader Engine
//   Mesin downloader multi-platform (KEYLESS / tanpa API key)
//
//   - YouTube (search/mp3/mp4/play) : youtubei.js (InnerTube)
//   - TikTok (video/foto/mp3)       : tikwm.com
//   - Spotify                       : oEmbed metadata -> audio YouTube
//   - Threads                       : scraper OG-meta (keyless)
//   - Platform lain                 : library "btch-downloader"
//
//   Catatan:
//   - axios pakai https.Agent({ family: 4 }) untuk paksa IPv4
//     (anti-timeout & sebagian masalah Cloudflare di server).
//   - User-Agent browser agar tidak gampang diblokir.
//   - youtubei.js dipakai sebagai pengganti Piped (instance Piped
//     publik sering mati -> ENOTFOUND / 502).
// ============================================================

import axios from "axios"
import https from "https"
import http from "http"
import { Readable } from "node:stream"
import { logError, logWarn } from "./logger.js"

// ─── HTTP Client (paksa IPv4 + UA browser) ───────────────────

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

// family:4 -> paksa resolusi IPv4 (banyak server gagal lewat IPv6)
const httpsAgent = new https.Agent({ family: 4, keepAlive: true })
const httpAgent = new http.Agent({ family: 4, keepAlive: true })

/**
 * Instance axios siap pakai dengan agent IPv4 & header browser.
 */
const client = axios.create({
  timeout: 60000,
  httpsAgent,
  httpAgent,
  maxRedirects: 5,
  headers: {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  },
  // jangan throw untuk status < 500 supaya bisa baca pesan error API
  validateStatus: (s) => s >= 200 && s < 500,
})

// ─── Util ─────────────────────────────────────────────────────

const URL_REGEX = /(https?:\/\/[^\s"'<>\\]+)/gi

/**
 * Ambil SEMUA URL dari objek/array/string bersarang (rekursif).
 * Berguna untuk respons API yang strukturnya tidak konsisten.
 * @param {*} obj
 * @returns {string[]} daftar URL unik
 */
export const extractUrls = (obj) => {
  const found = new Set()

  const walk = (node) => {
    if (node == null) return
    if (typeof node === "string") {
      const matches = node.match(URL_REGEX)
      if (matches) matches.forEach((u) => found.add(u))
      return
    }
    if (typeof node === "number" || typeof node === "boolean") return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (typeof node === "object") {
      for (const key of Object.keys(node)) walk(node[key])
    }
  }

  walk(obj)
  return [...found]
}

/**
 * Validasi sederhana sebuah URL.
 * @param {string} url
 */
export const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false
  try {
    const u = new URL(url.trim())
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Bersihkan entity HTML umum (mis. &amp; -> &).
 * @param {string} str
 */
export const decodeEntities = (str) =>
  typeof str === "string"
    ? str
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/")
    : str

/**
 * Ambil video ID dari berbagai bentuk URL YouTube.
 * @param {string} url
 * @returns {string|null}
 */
export const parseYoutubeId = (url) => {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m && m[1]) return m[1]
  }
  // mungkin user kirim ID mentah
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim()
  return null
}

/**
 * Format durasi detik -> mm:ss / hh:mm:ss
 * @param {number} sec
 */
export const formatDuration = (sec) => {
  if (!sec || sec < 0) return "?"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Konversi Web ReadableStream / Node stream / async-iterable -> Buffer.
 * youtubei.js mengembalikan Web ReadableStream pada Node modern.
 * @param {*} stream
 * @returns {Promise<Buffer>}
 */
const streamToBuffer = async (stream) => {
  if (!stream) throw new Error("Stream kosong.")
  // Web ReadableStream -> Node Readable
  const nodeStream =
    typeof stream.getReader === "function" ? Readable.fromWeb(stream) : stream

  const chunks = []
  for await (const chunk of nodeStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Deteksi tipe media sebuah URL berdasarkan Content-Type (paling akurat),
 * dengan fallback ke ekstensi file. Memperbaiki kasus video Instagram
 * yang tidak punya ekstensi ".mp4" di URL CDN-nya.
 * @param {string} url
 * @returns {Promise<"video"|"image"|"audio"|"unknown">}
 */
export const detectMediaType = async (url) => {
  if (!isValidUrl(url)) return "unknown"

  // 1) Coba baca Content-Type via HEAD, lalu fallback GET range kecil
  const readContentType = async () => {
    try {
      const res = await client.head(url, { timeout: 15000 })
      const ct = res.headers?.["content-type"]
      if (ct) return ct
    } catch {
      /* sebagian CDN menolak HEAD */
    }
    try {
      const res = await client.get(url, {
        timeout: 15000,
        responseType: "arraybuffer",
        headers: { Range: "bytes=0-1" },
      })
      return res.headers?.["content-type"] || ""
    } catch {
      return ""
    }
  }

  const ct = await readContentType()
  if (/video\//i.test(ct)) return "video"
  if (/image\//i.test(ct)) return "image"
  if (/audio\//i.test(ct)) return "audio"

  // 2) Fallback: tebak dari ekstensi
  if (/\.(mp4|mov|webm|mkv|m4v|3gp)(\?|$)/i.test(url)) return "video"
  if (/\.(jpg|jpeg|png|webp|gif|heic)(\?|$)/i.test(url)) return "image"
  if (/\.(mp3|m4a|ogg|opus|wav|aac|flac)(\?|$)/i.test(url)) return "audio"
  return "unknown"
}

// ─── YouTube (youtubei.js / InnerTube) ───────────────────────

/**
 * Singleton instance InnerTube (di-import malas agar bot tetap jalan
 * walau modul belum terpasang).
 */
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
    throw new Error(
      "Engine YouTube belum siap. Jalankan: npm install youtubei.js"
    )
  }
}

/** Ambil teks dari node youtubei.js (Text object / string). */
const txt = (v) => {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (typeof v.text === "string") return v.text
  if (typeof v.toString === "function") {
    const s = v.toString()
    return s === "[object Object]" ? "" : s
  }
  return ""
}

/**
 * Cari video YouTube.
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Promise<Array<{
 *   id:string, title:string, url:string, author:string,
 *   duration:number, durationText:string, viewsText:string, thumbnail:string
 * }>>}
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
        thumbnail:
          v.thumbnails?.[0]?.url || v.best_thumbnail?.url || v.thumbnail?.[0]?.url || "",
      }
    })
    .filter((r) => r.id)

  if (!results.length) throw new Error("Video tidak ditemukan.")
  return results.slice(0, limit)
}

/**
 * Unduh stream YouTube (audio/video) menjadi Buffer.
 * Kalau download langsung gagal (mis. pembatasan YouTube), fallback
 * ke URL ter-decipher agar tetap bisa dicoba kirim oleh Baileys.
 *
 * @param {string} idOrUrl
 * @param {"audio"|"video"} kind
 * @returns {Promise<{
 *   id:string, title:string, author:string, duration:number,
 *   durationText:string, thumbnail:string,
 *   buffer:Buffer|null, url:string|null, mimetype:string
 * }>}
 */
const ytDownload = async (idOrUrl, kind) => {
  const id = parseYoutubeId(idOrUrl)
  if (!id) throw new Error("URL/ID YouTube tidak valid.")

  const yt = await getInnertube()
  const info = await yt.getInfo(id)
  const b = info.basic_info || {}

  const meta = {
    id,
    title: txt(b.title) || "YouTube",
    author: txt(b.author) || txt(b.channel?.name) || "Unknown",
    duration: b.duration || 0,
    durationText: formatDuration(b.duration || 0),
    thumbnail: b.thumbnail?.[0]?.url || "",
    mimetype: kind === "audio" ? "audio/mp4" : "video/mp4",
  }

  const dlOpts =
    kind === "audio"
      ? { type: "audio", quality: "best", format: "mp4" }
      : { type: "video+audio", quality: "best", format: "mp4" }

  // 1) Coba download langsung -> Buffer (paling andal utk playback WA)
  try {
    const stream = await info.download(dlOpts)
    const buffer = await streamToBuffer(stream)
    if (buffer?.length) return { ...meta, buffer, url: null }
  } catch (err) {
    logWarn(`youtubei download gagal (${err.message}), coba mode URL`)
  }

  // 2) Fallback: pilih format & decipher jadi URL langsung
  try {
    const fmt = info.chooseFormat({
      type: kind === "audio" ? "audio" : "video+audio",
      quality: "best",
    })
    const url =
      typeof fmt.decipher === "function"
        ? fmt.decipher(yt.session.player)
        : fmt.url
    if (url) return { ...meta, buffer: null, url }
  } catch (err) {
    logWarn(`chooseFormat gagal: ${err.message}`)
  }

  throw new Error(
    "Gagal mengunduh stream YouTube (kemungkinan pembatasan dari YouTube)."
  )
}

/** Download audio YouTube (untuk .ytmp3). */
export const ytmp3 = (idOrUrl) => ytDownload(idOrUrl, "audio")

/** Download video YouTube (untuk .ytmp4). */
export const ytmp4 = (idOrUrl) => ytDownload(idOrUrl, "video")

/**
 * ".play" — cari berdasarkan judul lalu ambil audio video pertama.
 * @param {string} query
 */
export const play = async (query) => {
  const results = await ytsearch(query, 1)
  const first = results[0]
  const audio = await ytDownload(first.id, "audio")
  return {
    ...audio,
    title: audio.title || first.title,
    author: audio.author || first.author,
    thumbnail: audio.thumbnail || first.thumbnail,
    durationText: audio.durationText || first.durationText,
  }
}

// ─── TikTok (tikwm.com, tanpa watermark) ─────────────────────

/**
 * Download konten TikTok tanpa watermark via tikwm.com.
 * @param {string} url - URL video/foto TikTok
 * @returns {Promise<{
 *   type:"video"|"image",
 *   title:string, author:string,
 *   video:string|null, audio:string|null,
 *   images:string[], cover:string|null,
 *   duration:number, music:string
 * }>}
 */
export const tiktok = async (url) => {
  if (!isValidUrl(url)) throw new Error("URL TikTok tidak valid.")

  const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(
    url
  )}&hd=1`

  const res = await client.get(endpoint)
  const data = res.data

  if (!data || data.code !== 0 || !data.data) {
    throw new Error(data?.msg || "Gagal mengambil data TikTok.")
  }

  const d = data.data
  const isImage = Array.isArray(d.images) && d.images.length > 0

  return {
    type: isImage ? "image" : "video",
    title: d.title || "",
    author: d.author?.nickname || d.author?.unique_id || "TikTok",
    video: d.hdplay || d.play || d.wmplay || null,
    audio: d.music || null,
    images: isImage ? d.images : [],
    cover: d.cover || d.origin_cover || null,
    duration: d.duration || 0,
    music: d.music_info?.title || "TikTok Audio",
  }
}

/**
 * Ambil HANYA audio/sound dari TikTok (untuk .tiktokmp3).
 * @param {string} url
 * @returns {Promise<{ url:string, title:string, author:string, cover:string|null }>}
 */
export const tiktokMp3 = async (url) => {
  const d = await tiktok(url)
  if (!d.audio) throw new Error("Audio TikTok tidak ditemukan.")
  return {
    url: d.audio,
    title: d.music || d.title || "TikTok Audio",
    author: d.author,
    cover: d.cover,
  }
}

// ─── Spotify (oEmbed metadata -> audio dari YouTube) ─────────

/**
 * Spotify tidak menyediakan file audio publik (DRM), jadi kita:
 *  1) ambil metadata (judul + artis) via oEmbed publik (keyless),
 *  2) cari & unduh audio yang sepadan dari YouTube.
 * @param {string} url - URL track Spotify
 * @returns {Promise<{
 *   buffer:Buffer|null, url:string|null, mimetype:string,
 *   title:string, author:string, thumbnail:string, source:"YouTube"
 * }>}
 */
export const spotify = async (url) => {
  if (!isValidUrl(url) || !/spotify\.com/i.test(url)) {
    throw new Error("URL Spotify tidak valid.")
  }

  let title = ""
  let thumbnail = ""
  try {
    const res = await client.get(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    )
    title = res.data?.title || ""
    thumbnail = res.data?.thumbnail_url || ""
  } catch (err) {
    logWarn(`Spotify oEmbed gagal: ${err.message}`)
  }

  if (!title) throw new Error("Gagal membaca metadata Spotify.")

  // Cari versi audio di YouTube
  const audio = await play(`${title} audio`)
  return {
    buffer: audio.buffer,
    url: audio.url,
    mimetype: "audio/mp4",
    title,
    author: audio.author,
    thumbnail: thumbnail || audio.thumbnail,
    source: "YouTube",
  }
}

// ─── Threads (scraper OG-meta, keyless) ──────────────────────

/**
 * Download media dari Threads (Meta) tanpa library eksternal.
 * Membaca HTML post lalu mengambil og:video / og:image, dengan
 * fallback memindai URL media CDN (fbcdn / cdninstagram).
 * @param {string} url
 * @returns {Promise<{ type:"video"|"image", url:string }>}
 */
export const threads = async (url) => {
  if (!isValidUrl(url) || !/threads\.(net|com)/i.test(url)) {
    throw new Error("URL Threads tidak valid.")
  }

  const res = await client.get(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    responseType: "text",
  })

  const html = typeof res.data === "string" ? res.data : JSON.stringify(res.data)

  // og:video (urutan atribut bisa terbalik)
  const ogVideo =
    html.match(
      /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i
    )
  if (ogVideo) return { type: "video", url: decodeEntities(ogVideo[1]) }

  // fallback: scan URL mp4 dari CDN Meta di dalam JSON ter-embed
  const urls = extractUrls(html).map(decodeEntities)
  const vid = urls.find(
    (u) => /\.mp4/i.test(u) && /(cdninstagram|fbcdn)/i.test(u)
  )
  if (vid) return { type: "video", url: vid }

  // og:image
  const ogImage =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )
  if (ogImage) return { type: "image", url: decodeEntities(ogImage[1]) }

  const img = urls.find(
    (u) =>
      /\.(jpg|jpeg|png|webp)/i.test(u) && /(cdninstagram|fbcdn)/i.test(u)
  )
  if (img) return { type: "image", url: img }

  throw new Error("Media tidak ditemukan (post privat atau tidak didukung).")
}

// ─── Platform lain via "btch-downloader" ─────────────────────

/**
 * Loader malas (lazy) untuk btch-downloader.
 * Di-import dinamis agar bot tetap jalan walau modul belum terpasang.
 */
let _btch = null
const getBtch = async () => {
  if (_btch) return _btch
  try {
    _btch = await import("btch-downloader")
    return _btch
  } catch (err) {
    logError("Modul 'btch-downloader' belum terpasang", err)
    throw new Error(
      "Modul downloader belum terpasang. Jalankan: npm install btch-downloader"
    )
  }
}

/**
 * Cari fungsi pertama yang tersedia pada modul btch-downloader.
 * Nama export sedikit berbeda antar versi, jadi kita coba beberapa kandidat.
 * @param {object} mod - modul btch-downloader
 * @param {string[]} names - daftar nama kandidat
 * @returns {Function|null}
 */
const resolveFn = (mod, names) => {
  for (const n of names) {
    const fn = mod[n] || mod.default?.[n]
    if (typeof fn === "function") return fn
  }
  return null
}

/**
 * Bungkus pemanggilan fungsi btch-downloader dengan error handling rapi.
 * @param {string|string[]} fnNames - nama fungsi (atau daftar kandidat)
 * @param {string} url
 * @param {string} label - nama platform untuk pesan error
 */
const btchCall = async (fnNames, url, label) => {
  if (!isValidUrl(url)) throw new Error(`URL ${label} tidak valid.`)
  const names = Array.isArray(fnNames) ? fnNames : [fnNames]
  const mod = await getBtch()
  const fn = resolveFn(mod, names)
  if (!fn) {
    throw new Error(
      `Fungsi (${names.join("/")}) tidak tersedia di btch-downloader.`
    )
  }
  const result = await fn(url)
  if (!result || (Array.isArray(result) && result.length === 0)) {
    throw new Error(`Konten ${label} tidak ditemukan.`)
  }
  return result
}

/** Instagram (reels, post, foto, video) */
export const instagram = (url) => btchCall(["igdl", "instagram"], url, "Instagram")

/** Facebook video */
export const facebook = (url) =>
  btchCall(["fbdown", "facebook", "fbdl"], url, "Facebook")

/** Twitter / X (video & gambar) */
export const twitter = (url) =>
  btchCall(["twitter", "twitterdl", "x"], url, "Twitter/X")

/** Pinterest (gambar & video pin) */
export const pinterest = (url) =>
  btchCall(["pinterest", "pin", "pindl"], url, "Pinterest")

/** CapCut (template video) */
export const capcut = (url) => btchCall(["capcut", "capcutdl"], url, "CapCut")

/** Google Drive */
export const gdrive = (url) => btchCall(["gdrive", "gdrivedl"], url, "Google Drive")

/** MediaFire */
export const mediafire = (url) =>
  btchCall(["mediafire", "mediafiredl"], url, "MediaFire")

/** SoundCloud */
export const soundcloud = (url) =>
  btchCall(["soundcloud", "soundclouddl", "scdl"], url, "SoundCloud")

/** SnackVideo */
export const snackvideo = (url) =>
  btchCall(["snackvideo", "snackvideodl", "snack"], url, "SnackVideo")

// ─── Default export (kumpulan engine) ────────────────────────

export default {
  // util
  extractUrls,
  isValidUrl,
  parseYoutubeId,
  formatDuration,
  detectMediaType,
  decodeEntities,
  // youtube
  ytsearch,
  ytmp3,
  ytmp4,
  play,
  // tiktok
  tiktok,
  tiktokMp3,
  // spotify & threads (engine khusus, keyless)
  spotify,
  threads,
  // btch-downloader
  instagram,
  facebook,
  twitter,
  pinterest,
  capcut,
  gdrive,
  mediafire,
  soundcloud,
  snackvideo,
}
