// ============================================================
//   HABIBIH BOT - Helper Functions
//   Kumpulan fungsi utilitas yang dipakai di seluruh bot
// ============================================================

import fs from "fs"
import path from "path"
import axios from "axios"
import moment from "moment-timezone"
import config from "../config.js"
import { logError, logInfo } from "./logger.js"

// ─── Format Waktu ────────────────────────────────────────────

/**
 * Dapatkan waktu sekarang dengan timezone Asia/Jakarta
 */
export const getTime = () => {
  return moment().tz(config.settings.timezone).format("HH:mm:ss")
}

/**
 * Dapatkan tanggal sekarang
 */
export const getDate = () => {
  return moment().tz(config.settings.timezone).format("DD/MM/YYYY")
}

/**
 * Dapatkan hari sekarang dalam Bahasa Indonesia
 */
export const getDay = () => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
  return days[moment().tz(config.settings.timezone).day()]
}

/**
 * Dapatkan tanggal lengkap dalam Bahasa Indonesia (contoh: 13 Juni 2026)
 */
export const getFullDate = () => {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ]
  const now = moment().tz(config.settings.timezone)
  return `${now.date()} ${months[now.month()]} ${now.year()}`
}

/**
 * Format durasi uptime menjadi string yang mudah dibaca
 * @param {number} seconds - Durasi dalam detik
 */
export const formatUptime = (seconds) => {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const parts = []
  if (d > 0) parts.push(`${d} hari`)
  if (h > 0) parts.push(`${h} jam`)
  if (m > 0) parts.push(`${m} menit`)
  parts.push(`${s} detik`)

  return parts.join(", ")
}

/**
 * Format bytes ke ukuran yang mudah dibaca
 * @param {number} bytes
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B"
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`
}

// ─── JID / Nomor ─────────────────────────────────────────────

/**
 * Konversi nomor telepon ke JID WhatsApp
 * @param {string} number - Nomor telepon (dengan atau tanpa +)
 */
export const toJID = (number) => {
  return number.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
}

/**
 * Ekstrak nomor dari JID
 * @param {string} jid
 */
export const fromJID = (jid) => {
  return jid?.replace(/(@s\.whatsapp\.net|@g\.us|@lid|@newsletter)/, "") || ""
}

/**
 * Cek apakah JID adalah grup
 * @param {string} jid
 */
export const isGroup = (jid) => {
  return jid?.endsWith("@g.us") || false
}

/**
 * Cek apakah JID adalah nomor personal
 * @param {string} jid
 */
export const isPrivate = (jid) => {
  return jid?.endsWith("@s.whatsapp.net") || jid?.endsWith("@lid") || false
}

/**
 * Normalisasi JID — handle LID dan JID biasa
 * Baileys terbaru menggunakan LID untuk beberapa akun
 * @param {string} jid
 */
export const normalizeJID = (jid) => {
  if (!jid) return ""
  // Jika LID, kembalikan apa adanya (baileys handle sendiri)
  if (jid.endsWith("@lid")) return jid
  // Bersihkan karakter aneh
  return jid.split(":")[0] + (jid.includes("@") ? "@" + jid.split("@")[1] : "@s.whatsapp.net")
}

/**
 * Bandingkan dua JID (handle perbedaan LID vs JID)
 * @param {string} jid1
 * @param {string} jid2
 */
export const compareJID = (jid1, jid2) => {
  return fromJID(jid1) === fromJID(jid2)
}

// ─── Text Utilities ───────────────────────────────────────────

/**
 * Ucapan salam berdasarkan waktu
 */
export const getSalam = () => {
  const hour = parseInt(moment().tz(config.settings.timezone).format("HH"))
  if (hour >= 4 && hour < 12) return "Selamat Pagi"
  if (hour >= 12 && hour < 15) return "Selamat Siang"
  if (hour >= 15 && hour < 18) return "Selamat Sore"
  return "Selamat Malam"
}

/**
 * Ucapan islami berdasarkan waktu
 */
export const getSalamIslami = () => {
  const hour = parseInt(moment().tz(config.settings.timezone).format("HH"))
  if (hour >= 4 && hour < 12) return "Ahlan wa Sahlan, Selamat Pagi 🌅"
  if (hour >= 12 && hour < 15) return "Ahlan wa Sahlan, Selamat Siang ☀️"
  if (hour >= 15 && hour < 18) return "Ahlan wa Sahlan, Selamat Sore 🌤️"
  return "Ahlan wa Sahlan, Selamat Malam 🌙"
}

/**
 * Capitalize huruf pertama setiap kata
 * @param {string} str
 */
export const titleCase = (str) => {
  return str?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || ""
}

/**
 * Potong teks jika melebihi batas karakter
 * @param {string} text
 * @param {number} limit
 */
export const truncate = (text, limit = 100) => {
  return text?.length > limit ? text.substring(0, limit) + "..." : text || ""
}

/**
 * Sleep / delay async
 * @param {number} ms - Milidetik
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Generate random string
 * @param {number} length
 */
export const randomString = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

// ─── File & Media ─────────────────────────────────────────────

/**
 * Pastikan direktori ada, buat jika belum ada
 * @param {string} dirPath
 */
export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    logInfo(`Direktori dibuat: ${dirPath}`)
  }
}

/**
 * Download file dari URL dan simpan ke path lokal
 * @param {string} url
 * @param {string} savePath
 */
export const downloadFile = async (url, savePath) => {
  try {
    ensureDir(path.dirname(savePath))
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })
    fs.writeFileSync(savePath, Buffer.from(response.data))
    logInfo(`File didownload: ${savePath}`)
    return savePath
  } catch (err) {
    logError(`Gagal download file dari ${url}`, err)
    throw err
  }
}

/**
 * Dapatkan media menu (dari cache lokal atau download dari URL)
 */
export const getMenuMedia = async () => {
  const { mediaUrl, useCache, cachePath } = config.menu

  if (useCache && fs.existsSync(cachePath)) {
    logInfo("Media menu diambil dari cache lokal")
    return fs.readFileSync(cachePath)
  }

  logInfo("Mendownload media menu dari URL...")
  await downloadFile(mediaUrl, cachePath)
  return fs.readFileSync(cachePath)
}

/**
 * Hapus file cache menu (untuk reset/update media)
 */
export const clearMenuCache = () => {
  const { cachePath } = config.menu
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath)
    logInfo("Cache media menu dihapus")
    return true
  }
  return false
}

// ─── Permission Checker ───────────────────────────────────────

/**
 * Cek apakah nomor adalah owner
 * @param {string} jid
 */
export const isOwner = (jid) => {
  const num = fromJID(jid)
  return config.ownerNumber.some((o) => o === num)
}

// ─── Random Utilities ─────────────────────────────────────────

/**
 * Pilih elemen random dari array
 * @param {Array} arr
 */
export const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)]

/**
 * Format angka dengan separator ribuan
 * @param {number} num
 */
export const formatNumber = (num) => {
  return new Intl.NumberFormat("id-ID").format(num)
}
