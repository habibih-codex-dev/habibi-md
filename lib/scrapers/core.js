// ============================================================
//   HABIBIH BOT - Downloader Core
//   Pondasi engine downloader: HTTP client, util, deteksi media,
//   runner multi-sumber (fallback), provider Cobalt & btch.
//
//   Filosofi: tiap platform punya beberapa "sumber" yang dicoba
//   berurutan. Bila satu mati/diblokir, otomatis pindah ke sumber
//   berikutnya -> tahan terhadap perubahan minor platform.
// ============================================================

import axios from "axios"
import https from "https"
import http from "http"
import { Readable } from "node:stream"
import config from "../../config.js"
import { logError, logWarn } from "../logger.js"

// ─── HTTP Client (paksa IPv4 + UA browser) ───────────────────

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const httpsAgent = new https.Agent({ family: 4, keepAlive: true })
const httpAgent = new http.Agent({ family: 4, keepAlive: true })

/** Instance axios bersama (IPv4 + header browser). */
export const httpClient = axios.create({
  timeout: 60000,
  httpsAgent,
  httpAgent,
  maxRedirects: 5,
  headers: {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  },
  validateStatus: (s) => s >= 200 && s < 500,
})

// ─── Util URL & teks ─────────────────────────────────────────

const URL_REGEX = /(https?:\/\/[^\s"'<>\\]+)/gi

/** Ambil semua URL dari objek/array/string bersarang (rekursif). */
export const extractUrls = (obj) => {
  const found = new Set()
  const walk = (node) => {
    if (node == null) return
    if (typeof node === "string") {
      const m = node.match(URL_REGEX)
      if (m) m.forEach((u) => found.add(u))
      return
    }
    if (typeof node === "number" || typeof node === "boolean") return
    if (Array.isArray(node)) return node.forEach(walk)
    if (typeof node === "object") Object.keys(node).forEach((k) => walk(node[k]))
  }
  walk(obj)
  return [...found]
}

/** Validasi URL http/https. */
export const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false
  try {
    const u = new URL(url.trim())
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** Bersihkan entity HTML & escape JSON umum. */
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

/** Unescape aman sebuah string hasil match JSON (\/, \uXXXX, dll). */
export const jsonUnescape = (raw) => {
  try {
    return JSON.parse(`"${raw}"`)
  } catch {
    return decodeEntities(raw)
  }
}

/** Ambil video ID dari berbagai bentuk URL YouTube. */
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
  if (/^[A-Za-z0-9_-]{11}$/.test(String(url).trim())) return String(url).trim()
  return null
}

/** Format durasi detik -> mm:ss / hh:mm:ss. */
export const formatDuration = (sec) => {
  if (!sec || sec < 0) return "?"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Konversi Web ReadableStream / Node stream / async-iterable -> Buffer. */
export const streamToBuffer = async (stream) => {
  if (!stream) throw new Error("Stream kosong.")
  const nodeStream =
    typeof stream.getReader === "function" ? Readable.fromWeb(stream) : stream
  const chunks = []
  for await (const chunk of nodeStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// ─── Deteksi tipe media (akurat via Content-Type) ────────────

/**
 * Deteksi tipe media URL via Content-Type (HEAD -> Range GET),
 * fallback ke ekstensi. Memperbaiki video IG/FB yang URL-nya tanpa
 * ekstensi sehingga sebelumnya terkirim sebagai gambar.
 * @returns {Promise<"video"|"image"|"audio"|"unknown">}
 */
export const detectMediaType = async (url) => {
  if (!isValidUrl(url)) return "unknown"
  const readCT = async () => {
    try {
      const r = await httpClient.head(url, { timeout: 15000 })
      if (r.headers?.["content-type"]) return r.headers["content-type"]
    } catch {
      /* sebagian CDN tolak HEAD */
    }
    try {
      const r = await httpClient.get(url, {
        timeout: 15000,
        responseType: "arraybuffer",
        headers: { Range: "bytes=0-1" },
      })
      return r.headers?.["content-type"] || ""
    } catch {
      return ""
    }
  }
  const ct = await readCT()
  if (/video\//i.test(ct)) return "video"
  if (/image\//i.test(ct)) return "image"
  if (/audio\//i.test(ct)) return "audio"
  if (/\.(mp4|mov|webm|mkv|m4v|3gp)(\?|$)/i.test(url)) return "video"
  if (/\.(jpg|jpeg|png|webp|gif|heic)(\?|$)/i.test(url)) return "image"
  if (/\.(mp3|m4a|ogg|opus|wav|aac|flac)(\?|$)/i.test(url)) return "audio"
  return "unknown"
}

// ─── Runner multi-sumber (inti decoupling & stabilitas) ──────

/**
 * Jalankan daftar provider berurutan; kembalikan hasil pertama yang
 * sukses & tidak kosong. Bila semua gagal, lempar error ringkas berisi
 * alasan tiap sumber. Inilah yang membuat satu sumber mati tidak
 * mematikan platform lain (tiap platform punya runner sendiri).
 *
 * @param {string} label - nama platform (utk pesan error)
 * @param {Array<{name:string, fn:Function}>} providers
 * @returns {Promise<any>}
 */
export const tryProviders = async (label, providers) => {
  const errors = []
  for (const p of providers) {
    try {
      const res = await p.fn()
      const empty =
        res == null ||
        (Array.isArray(res) && res.length === 0) ||
        (typeof res === "object" && !Array.isArray(res) && Object.keys(res).length === 0)
      if (!empty) return res
      errors.push(`${p.name}: kosong`)
    } catch (err) {
      errors.push(`${p.name}: ${err.message}`)
      logWarn(`[${label}] sumber '${p.name}' gagal: ${err.message}`)
    }
  }
  throw new Error(`Semua sumber ${label} gagal (${errors.join(" | ")}).`)
}

// ─── Provider: Cobalt (universal, disarankan self-host) ──────

/**
 * Minta media ke instance Cobalt (multi-instance fallback).
 * @param {string} url
 * @param {{mode?:"auto"|"audio", audioFormat?:string, videoQuality?:string}} [opts]
 * @returns {Promise<string[]>} daftar URL media langsung
 */
export const cobaltDownload = async (url, opts = {}) => {
  const instances = config.downloader?.cobaltInstances || []
  if (!instances.length) throw new Error("Cobalt belum dikonfigurasi")

  const apiKey = config.downloader?.cobaltApiKey || ""
  const timeout = config.downloader?.timeout || 45000
  let lastErr

  for (const base of instances) {
    try {
      const endpoint = base.replace(/\/+$/, "") + "/"
      const body = {
        url,
        videoQuality: opts.videoQuality || config.downloader?.videoQuality || "720",
        audioFormat: opts.audioFormat || "mp3",
        filenameStyle: "basic",
        downloadMode: opts.mode === "audio" ? "audio" : "auto",
      }
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
      }
      if (apiKey) headers.Authorization = `Api-Key ${apiKey}`

      const res = await httpClient.post(endpoint, body, { headers, timeout })
      const d = res.data
      if (!d || d.status === "error") {
        lastErr = new Error(d?.error?.code || "cobalt error")
        continue
      }
      if (["redirect", "tunnel", "stream"].includes(d.status) && d.url) {
        return [d.url]
      }
      if (d.status === "picker" && Array.isArray(d.picker)) {
        const urls = d.picker.map((p) => p.url).filter(isValidUrl)
        if (urls.length) return urls
      }
      lastErr = new Error(`status tak terduga: ${d.status}`)
    } catch (err) {
      lastErr = err
      logWarn(`Cobalt ${base} gagal: ${err.message}`)
    }
  }
  throw lastErr || new Error("Semua instance Cobalt gagal")
}

// ─── Provider: btch-downloader (lazy, opsional, sbg fallback) ─

let _btch = null
const getBtch = async () => {
  if (_btch) return _btch
  _btch = await import("btch-downloader").catch((err) => {
    logError("btch-downloader tidak tersedia", err)
    throw new Error("btch-downloader tidak terpasang")
  })
  return _btch
}

const resolveFn = (mod, names) => {
  for (const n of names) {
    const fn = mod[n] || mod.default?.[n]
    if (typeof fn === "function") return fn
  }
  return null
}

/**
 * Panggil btch-downloader lalu normalisasi hasilnya menjadi daftar URL
 * media (TIDAK menyertakan thumbnail -> mencegah salah kirim gambar).
 * @param {string[]} names - kandidat nama fungsi
 * @param {string} url
 * @returns {Promise<string[]>}
 */
export const btchMedia = async (names, url) => {
  const mod = await getBtch()
  const fn = resolveFn(mod, names)
  if (!fn) throw new Error(`fungsi (${names.join("/")}) tidak ada di btch`)

  const result = await fn(url)
  const items = Array.isArray(result) ? result : [result]
  const urls = []
  for (const it of items) {
    if (!it) continue
    if (typeof it === "string") {
      if (isValidUrl(it)) urls.push(it)
      continue
    }
    const direct =
      it.url || it.video || it.videoUrl || it.hd || it.sd ||
      it.download || it.downloadUrl || it.link || it.result
    if (direct && isValidUrl(direct)) urls.push(direct)
  }
  if (!urls.length) throw new Error("media kosong")
  return [...new Set(urls)]
}

/** Versi btch yang mengembalikan objek mentah (utk file: gdrive/mediafire). */
export const btchRaw = async (names, url) => {
  const mod = await getBtch()
  const fn = resolveFn(mod, names)
  if (!fn) throw new Error(`fungsi (${names.join("/")}) tidak ada di btch`)
  const result = await fn(url)
  if (!result || (Array.isArray(result) && !result.length)) {
    throw new Error("data kosong")
  }
  return Array.isArray(result) ? result[0] : result
}
