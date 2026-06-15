// ============================================================
//   HABIBIH BOT - Downloader Engine
//   Mesin downloader multi-platform (KEYLESS / tanpa API key)
//
//   - TikTok (tanpa watermark) : tikwm.com
//   - YouTube (search/mp3/mp4) : Piped API multi-instance
//   - Platform lain            : library "btch-downloader"
//
//   Catatan:
//   - axios pakai https.Agent({ family: 4 }) untuk paksa IPv4
//     (anti-timeout & sebagian masalah Cloudflare di server).
//   - User-Agent browser agar tidak gampang diblokir.
// ============================================================

import axios from "axios"
import https from "https"
import http from "http"
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
 * Ambil video ID dari berbagai bentuk URL YouTube.
 * @param {string} url
 * @returns {string|null}
 */
export const parseYoutubeId = (url) => {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
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

// ─── TikTok (tikwm.com, tanpa watermark) ─────────────────────

/**
 * Download konten TikTok tanpa watermark via tikwm.com.
 * @param {string} url - URL video/foto TikTok
 * @returns {Promise<{
 *   type:"video"|"image",
 *   title:string, author:string,
 *   video:string|null, audio:string|null,
 *   images:string[], cover:string|null,
 *   duration:number
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
  }
}

// ─── YouTube (Piped API, multi-instance) ─────────────────────

// Daftar instance Piped publik (dicoba berurutan sampai ada yg jalan)
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.darkness.services",
  "https://piped-api.codespace.cz",
  "https://pipedapi.leptons.xyz",
]

/**
 * GET ke endpoint Piped dengan fallback antar-instance.
 * @param {string} pathname - mis. "/search?q=...&filter=videos"
 * @returns {Promise<any>}
 */
const pipedGet = async (pathname) => {
  let lastErr = null
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await client.get(`${base}${pathname}`)
      if (res.status >= 200 && res.status < 300 && res.data) {
        // Beberapa instance balas { error } meski status 200
        if (res.data.error) {
          lastErr = new Error(res.data.error)
          continue
        }
        return res.data
      }
      lastErr = new Error(`HTTP ${res.status} dari ${base}`)
    } catch (err) {
      lastErr = err
      logWarn(`Piped instance gagal: ${base} (${err.message})`)
    }
  }
  throw lastErr || new Error("Semua instance Piped tidak merespons.")
}

/**
 * Cari video YouTube.
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Promise<Array<{
 *   id:string, title:string, url:string, author:string,
 *   duration:number, durationText:string, views:number, thumbnail:string
 * }>>}
 */
export const ytsearch = async (query, limit = 10) => {
  if (!query || !query.trim()) throw new Error("Kata kunci pencarian kosong.")

  const data = await pipedGet(
    `/search?q=${encodeURIComponent(query.trim())}&filter=videos`
  )

  const items = Array.isArray(data?.items) ? data.items : []
  const results = items
    .filter((it) => it.url && (it.type === "stream" || it.url.includes("watch")))
    .map((it) => {
      const id = parseYoutubeId(it.url) || it.url?.split("v=")[1] || ""
      return {
        id,
        title: it.title || "Tanpa judul",
        url: `https://www.youtube.com/watch?v=${id}`,
        author: it.uploaderName || "Unknown",
        duration: it.duration || 0,
        durationText: formatDuration(it.duration || 0),
        views: it.views || 0,
        thumbnail: it.thumbnail || "",
      }
    })
    .filter((r) => r.id)

  if (!results.length) throw new Error("Video tidak ditemukan.")
  return results.slice(0, limit)
}

/**
 * Ambil detail stream dari sebuah video YouTube via Piped.
 * @param {string} idOrUrl - video ID atau URL YouTube
 * @returns {Promise<any>} respons /streams/{id}
 */
const getStreams = async (idOrUrl) => {
  const id = parseYoutubeId(idOrUrl)
  if (!id) throw new Error("URL/ID YouTube tidak valid.")
  const data = await pipedGet(`/streams/${id}`)
  if (!data || (!data.audioStreams && !data.videoStreams)) {
    throw new Error("Stream tidak tersedia untuk video ini.")
  }
  return { id, ...data }
}

/**
 * Download audio (mp3/m4a) dari YouTube.
 * Memilih audioStream bitrate tertinggi.
 * @param {string} idOrUrl
 * @returns {Promise<{
 *   id:string, title:string, author:string, duration:number,
 *   durationText:string, thumbnail:string,
 *   url:string, mimeType:string, bitrate:number
 * }>}
 */
export const ytmp3 = async (idOrUrl) => {
  const data = await getStreams(idOrUrl)
  const audios = (data.audioStreams || []).filter((a) => a.url)
  if (!audios.length) throw new Error("Audio stream tidak ditemukan.")

  // pilih bitrate tertinggi
  const best = audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]

  return {
    id: data.id,
    title: data.title || "Audio YouTube",
    author: data.uploader || "Unknown",
    duration: data.duration || 0,
    durationText: formatDuration(data.duration || 0),
    thumbnail: data.thumbnailUrl || "",
    url: best.url,
    mimeType: best.mimeType || "audio/mp4",
    bitrate: best.bitrate || 0,
  }
}

/**
 * Download video (mp4) dari YouTube.
 * Memilih videoStream mp4 progresif (punya audio) atau resolusi terbaik.
 * @param {string} idOrUrl
 * @param {number} [maxHeight=720] - batasi resolusi agar ukuran wajar utk WA
 * @returns {Promise<{
 *   id:string, title:string, author:string, duration:number,
 *   durationText:string, thumbnail:string,
 *   url:string, mimeType:string, quality:string
 * }>}
 */
export const ytmp4 = async (idOrUrl, maxHeight = 720) => {
  const data = await getStreams(idOrUrl)
  let videos = (data.videoStreams || []).filter((v) => v.url)
  if (!videos.length) throw new Error("Video stream tidak ditemukan.")

  // Utamakan stream yang TIDAK videoOnly (sudah ada audio) & format mp4
  const parseH = (q) => parseInt(String(q || "").replace(/[^0-9]/g, "")) || 0

  const progressive = videos.filter(
    (v) => v.videoOnly === false && /mp4/i.test(v.format || v.mimeType || "")
  )
  const pool = progressive.length ? progressive : videos

  // pilih resolusi tertinggi yang <= maxHeight, kalau tidak ada ambil terkecil di atasnya
  const sorted = pool.sort((a, b) => parseH(b.quality) - parseH(a.quality))
  const best =
    sorted.find((v) => parseH(v.quality) <= maxHeight) ||
    sorted[sorted.length - 1]

  return {
    id: data.id,
    title: data.title || "Video YouTube",
    author: data.uploader || "Unknown",
    duration: data.duration || 0,
    durationText: formatDuration(data.duration || 0),
    thumbnail: data.thumbnailUrl || "",
    url: best.url,
    mimeType: best.mimeType || "video/mp4",
    quality: best.quality || "",
  }
}

/**
 * ".play" — cari berdasarkan judul lalu ambil audio video pertama.
 * @param {string} query
 * @returns {Promise<ReturnType<typeof ytmp3> extends Promise<infer T> ? T : never>}
 */
export const play = async (query) => {
  const results = await ytsearch(query, 1)
  const first = results[0]
  const audio = await ytmp3(first.id)
  // lengkapi metadata dari hasil pencarian bila kosong
  return {
    ...audio,
    title: audio.title || first.title,
    author: audio.author || first.author,
    thumbnail: audio.thumbnail || first.thumbnail,
    durationText: audio.durationText || first.durationText,
  }
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
 * Nama export sedikit berbeda antar versi, jadi kita coba beberapa
 * kandidat (mis. "spotify" vs "spotifydl").
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

/** Spotify (track) */
export const spotify = (url) =>
  btchCall(["spotifydl", "spotify"], url, "Spotify")

/** SoundCloud */
export const soundcloud = (url) =>
  btchCall(["soundcloud", "soundclouddl", "scdl"], url, "SoundCloud")

/** Threads (Meta) */
export const threads = (url) => btchCall(["threads", "threadsdl"], url, "Threads")

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
  // tiktok
  tiktok,
  // youtube
  ytsearch,
  ytmp3,
  ytmp4,
  play,
  // btch-downloader
  instagram,
  facebook,
  twitter,
  pinterest,
  capcut,
  gdrive,
  mediafire,
  spotify,
  soundcloud,
  threads,
  snackvideo,
}
