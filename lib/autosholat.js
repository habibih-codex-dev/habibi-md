// ============================================================
//   HABIBIH BOT - Auto Sholat Scheduler
//   Cek tiap menit; kirim pengingat saat masuk waktu sholat
//   ke chat yang mengaktifkan .autosholat on
// ============================================================

import moment from "moment-timezone"
import config from "../config.js"
import { getAutoSholatChats, updateChat } from "./database.js"
import { fetchSholat } from "../plugins/islami.js"
import { logError, logSystem } from "./logger.js"

// ─── Cache jadwal per kota per tanggal ───────────────────────
// key = `${city}|${date}` → timings
const sholatCache = new Map()

const WAKTU = [
  { key: "Fajr", label: "Subuh", emoji: "🌅" },
  { key: "Dhuhr", label: "Dzuhur", emoji: "🌞" },
  { key: "Asr", label: "Ashar", emoji: "🌤️" },
  { key: "Maghrib", label: "Maghrib", emoji: "🌇" },
  { key: "Isha", label: "Isya", emoji: "🌃" },
]

const DEFAULT_CITY = "Jakarta"

// ─── Ambil jadwal (pakai cache harian) ───────────────────────
const getTimings = async (city, country) => {
  const today = moment().tz(config.settings.timezone).format("YYYY-MM-DD")
  const cacheKey = `${city}|${today}`

  if (sholatCache.has(cacheKey)) return sholatCache.get(cacheKey)

  const data = await fetchSholat(city, country)
  const timings = data.timings
  sholatCache.set(cacheKey, timings)

  // Bersihkan cache lama (simpan hari ini saja)
  for (const k of sholatCache.keys()) {
    if (!k.endsWith(today)) sholatCache.delete(k)
  }
  return timings
}

// ─── Kirim pengingat ke chat ─────────────────────────────────
const sendReminder = async (sock, chat, waktu, jam) => {
  const text = `╭─「 ${waktu.emoji} WAKTU ${waktu.label.toUpperCase()} 」
│ Telah masuk waktu sholat *${waktu.label}*
│ untuk wilayah *${chat.city || DEFAULT_CITY}*
│ 🕐 Pukul ${jam}
├────────────────
│ Mari tunaikan sholat tepat waktu 🤲
│ "Sesungguhnya sholat itu mencegah
│  dari perbuatan keji dan mungkar."
╰────────────────

> ${config.watermark}`

  await sock.sendMessage(chat.jid, { text })
}

// ─── Loop pengecekan tiap menit ──────────────────────────────
const tick = async (getSocket) => {
  const sock = getSocket()
  if (!sock?.user) return // belum terhubung

  const now = moment().tz(config.settings.timezone)
  const currentTime = now.format("HH:mm")
  const today = now.format("YYYY-MM-DD")

  const chats = getAutoSholatChats()
  if (!chats.length) return

  for (const chat of chats) {
    try {
      const city = chat.city || DEFAULT_CITY
      const country = chat.country || "Indonesia"
      const timings = await getTimings(city, country)

      for (const waktu of WAKTU) {
        const jam = (timings[waktu.key] || "").split(" ")[0]
        if (!jam) continue

        if (jam === currentTime) {
          // Cegah pengingat dobel dalam menit yang sama
          const stamp = `${today} ${jam} ${waktu.key}`
          if (chat.lastReminder === stamp) continue

          await sendReminder(sock, chat, waktu, jam)
          updateChat(chat.jid, { lastReminder: stamp })
        }
      }
    } catch (err) {
      logError(`Autosholat gagal untuk ${chat.jid}`, err)
    }
  }
}

/**
 * Mulai scheduler autosholat.
 * @param {Function} getSocket - fungsi yang mengembalikan socket aktif
 */
export const startAutoSholat = (getSocket) => {
  // Cek tiap 60 detik, sinkron ke awal menit
  setInterval(() => tick(getSocket), 60 * 1000)
  logSystem("Scheduler autosholat aktif (cek tiap menit)")
}
