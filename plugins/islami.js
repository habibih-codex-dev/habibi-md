// ============================================================
//   HABIBIH BOT - Plugin Islami
//   Jadwal sholat, autosholat, Quran, tafsir, asmaul husna,
//   doa, dzikir, hadits, niat puasa, kisah, imsak, kiblat, hijriah
//   API publik: aladhan.com & equran.id (gratis, tanpa key)
// ============================================================

import axios from "axios"
import https from "https"
import moment from "moment-timezone"
import config from "../config.js"
import { getChat, updateChat } from "../lib/database.js"
import { randomItem } from "../lib/function.js"
import { logError } from "../lib/logger.js"
import {
  dzikirPagi,
  dzikirPetang,
  niatPuasa,
  kisah,
} from "../lib/islamicData.js"

const DEFAULT_CITY = "Jakarta"
const DEFAULT_COUNTRY = "Indonesia"
const METHOD = 20 // Kemenag RI

// ─── HTTP helper ─────────────────────────────────────────────
// - User-Agent browser: lolos proteksi dasar Cloudflare
// - family: 4 + agent IPv4: cegah timeout akibat IPv6 menggantung
const ipv4Agent = new https.Agent({ family: 4, keepAlive: true })
const http = axios.create({
  timeout: 20000,
  httpsAgent: ipv4Agent,
  family: 4,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "id,en;q=0.9",
  },
})

// ─── Ambil jadwal sholat (aladhan → fallback myquran) ────────
export const fetchSholat = async (city, country = DEFAULT_COUNTRY) => {
  // 1) Coba API aladhan.com
  try {
    const { data } = await http.get(
      "https://api.aladhan.com/v1/timingsByCity",
      { params: { city, country, method: METHOD } }
    )
    if (data?.code === 200 && data?.data?.timings) {
      const d = data.data
      return {
        timings: d.timings,
        masehi: d.date?.gregorian?.date || "",
        hijri: d.date?.hijri
          ? `${d.date.hijri.day} ${d.date.hijri.month?.en} ${d.date.hijri.year} H`
          : "",
        lat: d.meta?.latitude,
        lng: d.meta?.longitude,
        city,
        source: "aladhan",
      }
    }
  } catch (e) {
    logError(`aladhan gagal (${city}), coba fallback myquran`, {
      reason: e?.message,
    })
  }

  // 2) Fallback API myquran.com (server Indonesia)
  const { data: cari } = await http.get(
    `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(city)}`
  )
  const kota = cari?.data?.[0]
  if (!kota) throw new Error("Kota tidak ditemukan")

  const now = moment().tz(config.settings.timezone)
  const y = now.format("YYYY")
  const m = now.format("MM")
  const d = now.format("DD")
  const { data: jad } = await http.get(
    `https://api.myquran.com/v2/sholat/jadwal/${kota.id}/${y}/${m}/${d}`
  )
  const j = jad?.data?.jadwal
  if (!j) throw new Error("Jadwal tidak tersedia")

  return {
    timings: {
      Imsak: j.imsak,
      Fajr: j.subuh,
      Sunrise: j.terbit,
      Dhuhr: j.dzuhur,
      Asr: j.ashar,
      Maghrib: j.maghrib,
      Isha: j.isya,
    },
    masehi: j.tanggal || `${d}-${m}-${y}`,
    hijri: "",
    lat: kota.lat,
    lng: kota.lon,
    city: kota.lokasi || city,
    source: "myquran",
  }
}

// ─── Format jadwal jadi teks ─────────────────────────────────
const formatSholat = (data) => {
  const t = data.timings
  const clean = (v) => String(v || "").split(" ")[0]

  return `╭─「 🕌 JADWAL SHOLAT 」
│ 📍 Kota   : ${data.city}
│ 📅 Masehi : ${data.masehi || "-"}
│ 🌙 Hijriah: ${data.hijri || "-"}
├────────────────
│ 🌄 Imsak   : ${clean(t.Imsak)}
│ 🌅 Subuh   : ${clean(t.Fajr)}
│ ☀️ Terbit  : ${clean(t.Sunrise)}
│ 🌞 Dzuhur  : ${clean(t.Dhuhr)}
│ 🌤️ Ashar   : ${clean(t.Asr)}
│ 🌇 Maghrib : ${clean(t.Maghrib)}
│ 🌃 Isya    : ${clean(t.Isha)}
╰────────────────
_Sumber: ${data.source}_

> ${config.watermark}`
}

// ─── Tentukan kota chat (DB / default) ───────────────────────
const cityOf = (ctx) => {
  const chat = getChat(ctx.jid)
  return { city: chat.city || DEFAULT_CITY, country: chat.country || DEFAULT_COUNTRY }
}

// ─── Properti umum (bisa di grup & private) ──────────────────
const openCmd = {
  category: "islami",
  owner: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,
  premium: false,
}

// ─── Commands Export ──────────────────────────────────────────
export const commands = [
  // ─── .sholat <kota> ──────────────────────────────────────
  {
    pattern: /^(sholat|jadwalsholat|shalat)$/,
    description: "Jadwal sholat hari ini",
    ...openCmd,
    handler: async (ctx) => {
      const { city, country } = ctx.query
        ? { city: ctx.query, country: DEFAULT_COUNTRY }
        : cityOf(ctx)
      try {
        const data = await fetchSholat(city, country)
        await ctx.reply.text(formatSholat(data))
      } catch (err) {
        logError(`Gagal memuat jadwal sholat untuk ${city}`, err)
        await ctx.reply.text(
          `❌ Gagal memuat jadwal untuk *${city}*.\n` +
            `Penyebab: ${err?.response?.status ? `HTTP ${err.response.status}` : err?.message || "koneksi"}\n` +
            `Pastikan internet server aktif & nama kota benar.\nContoh: *.sholat Bandung*`
        )
      }
    },
  },

  // ─── .setkota <kota> ─────────────────────────────────────
  {
    pattern: /^(setkota|setcity)$/,
    description: "Atur kota untuk chat ini",
    ...openCmd,
    handler: async (ctx) => {
      if (!ctx.query)
        return ctx.reply.text(
          `📍 *SET KOTA*\nKetik: *.setkota <nama kota>*\nContoh: .setkota Surabaya`
        )
      try {
        // Validasi dengan fetch
        await fetchSholat(ctx.query)
        updateChat(ctx.jid, { city: ctx.query })
        await ctx.reply.text(
          `✅ Kota chat ini diatur ke *${ctx.query}*.\nJadwal sholat & autosholat akan memakai kota ini.`
        )
      } catch (err) {
        logError(`Gagal validasi kota ${ctx.query}`, err)
        await ctx.reply.text(
          `❌ Kota *${ctx.query}* tidak ditemukan / gagal terhubung.\n` +
            `Penyebab: ${err?.response?.status ? `HTTP ${err.response.status}` : err?.message || "koneksi"}`
        )
      }
    },
  },

  // ─── .autosholat on/off ──────────────────────────────────
  {
    pattern: /^(autosholat|autoadzan)$/,
    description: "Pengingat otomatis waktu sholat",
    ...openCmd,
    handler: async (ctx) => {
      const arg = (ctx.args[0] || "").toLowerCase()
      const { city } = cityOf(ctx)

      if (arg === "on") {
        updateChat(ctx.jid, { autosholat: true })
        return ctx.reply.text(
          `✅ *Autosholat AKTIF* untuk chat ini.\n📍 Kota: *${city}*\n\nBot akan mengirim pengingat tiap masuk waktu sholat.\n_Ganti kota: .setkota <kota>_`
        )
      }
      if (arg === "off") {
        updateChat(ctx.jid, { autosholat: false })
        return ctx.reply.text("❌ *Autosholat NONAKTIF* untuk chat ini.")
      }

      const chat = getChat(ctx.jid)
      await ctx.reply.text(
        `🕐 *AUTOSHOLAT*\nStatus: ${chat.autosholat ? "✅ AKTIF" : "❌ NONAKTIF"}\n📍 Kota: *${city}*\n\nGunakan:\n◦ .autosholat on\n◦ .autosholat off`
      )
    },
  },

  // ─── .jadwalimsak <kota> ─────────────────────────────────
  {
    pattern: /^(imsak|jadwalimsak|imsakiyah)$/,
    description: "Jadwal imsak & berbuka",
    ...openCmd,
    handler: async (ctx) => {
      const { city, country } = ctx.query
        ? { city: ctx.query, country: DEFAULT_COUNTRY }
        : cityOf(ctx)
      try {
        const data = await fetchSholat(city, country)
        const t = data.timings
        const clean = (v) => (v || "").split(" ")[0]
        await ctx.reply.text(
          `╭─「 🌙 IMSAKIYAH 」\n│ 📍 ${city}\n├────────────────\n│ 🌄 Imsak   : ${clean(t.Imsak)}\n│ 🌅 Subuh   : ${clean(t.Fajr)}\n│ 🌇 Maghrib : ${clean(t.Maghrib)} (Buka)\n╰────────────────\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text(`❌ Gagal memuat imsak untuk *${city}*.`)
      }
    },
  },

  // ─── .kiblat <kota> ──────────────────────────────────────
  {
    pattern: /^(kiblat|qibla)$/,
    description: "Arah kiblat dari kota",
    ...openCmd,
    handler: async (ctx) => {
      const { city, country } = ctx.query
        ? { city: ctx.query, country: DEFAULT_COUNTRY }
        : cityOf(ctx)
      try {
        const data = await fetchSholat(city, country)
        const lat = data.lat
        const lng = data.lng
        if (lat == null || lng == null)
          return ctx.reply.text(
            `🧭 Koordinat *${city}* tidak tersedia dari sumber data. Coba kota lain.`
          )
        const { data: q } = await http.get(
          `https://api.aladhan.com/v1/qibla/${lat}/${lng}`
        )
        const dir = q?.data?.direction
        await ctx.reply.text(
          `🧭 *ARAH KIBLAT*\n📍 ${data.city}\n\nArah kiblat: *${dir?.toFixed(2)}°* dari Utara (searah jarum jam).\n\n> ${config.watermark}`
        )
      } catch (err) {
        logError(`Gagal kiblat ${city}`, err)
        await ctx.reply.text(`❌ Gagal menghitung kiblat untuk *${city}*.`)
      }
    },
  },

  // ─── .hijriah ────────────────────────────────────────────
  {
    pattern: /^(hijriah|hijriyah|kalenderhijriah)$/,
    description: "Tanggal hijriah hari ini",
    ...openCmd,
    handler: async (ctx) => {
      try {
        const { data } = await http.get(
          "https://api.aladhan.com/v1/gToH",
          { params: { date: new Date().toLocaleDateString("en-GB").replace(/\//g, "-") } }
        )
        const h = data?.data?.hijri
        await ctx.reply.text(
          `🌙 *TANGGAL HIJRIAH*\n\n${h.weekday?.en}, ${h.day} ${h.month?.en} ${h.year} H\n(${h.month?.ar})\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text("❌ Gagal memuat tanggal hijriah.")
      }
    },
  },

  // ─── .quran <surat>[:ayat] ───────────────────────────────
  {
    pattern: /^(quran|alquran|surah|surat)$/,
    description: "Baca Al-Qur'an (surat atau ayat)",
    ...openCmd,
    handler: async (ctx) => {
      if (!ctx.query)
        return ctx.reply.text(
          `📖 *AL-QUR'AN*\nKetik nomor surat (1-114):\n◦ .quran 1\n◦ .quran 2:255 (ayat tertentu)`
        )

      const [suratStr, ayatStr] = ctx.query.split(":")
      const surat = parseInt(suratStr)
      if (isNaN(surat) || surat < 1 || surat > 114)
        return ctx.reply.text("❌ Nomor surat harus 1-114.")

      try {
        const { data } = await http.get(
          `https://equran.id/api/v2/surat/${surat}`
        )
        const s = data.data

        // Ayat tertentu
        if (ayatStr) {
          const ayatNo = parseInt(ayatStr)
          const ayat = s.ayat?.find((a) => a.nomorAyat === ayatNo)
          if (!ayat) return ctx.reply.text(`❌ Ayat ${ayatNo} tidak ada di surat ini.`)
          return ctx.reply.text(
            `📖 *QS. ${s.namaLatin} : ${ayatNo}*\n\n${ayat.teksArab}\n\n_${ayat.teksLatin}_\n\n🇮🇩 ${ayat.teksIndonesia}\n\n> ${config.watermark}`
          )
        }

        // Info surat + beberapa ayat awal (hindari pesan terlalu panjang)
        const preview = s.ayat
          ?.slice(0, 5)
          .map((a) => `${a.nomorAyat}. ${a.teksArab}\n_${a.teksIndonesia}_`)
          .join("\n\n")

        await ctx.reply.text(
          `╭─「 📖 ${s.namaLatin} 」\n│ ${s.nama} • ${s.arti}\n│ Surat ke-${s.nomor} • ${s.jumlahAyat} ayat • ${s.tempatTurun}\n╰────────────────\n\n${preview}\n\n_...gunakan .quran ${surat}:<ayat> untuk ayat lain_\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text("❌ Gagal memuat surat. Coba lagi nanti.")
      }
    },
  },

  // ─── .tafsir <surat>:<ayat> ──────────────────────────────
  {
    pattern: /^(tafsir)$/,
    description: "Tafsir ayat Al-Qur'an",
    ...openCmd,
    handler: async (ctx) => {
      if (!ctx.query || !ctx.query.includes(":"))
        return ctx.reply.text(
          `📚 *TAFSIR*\nKetik: *.tafsir <surat>:<ayat>*\nContoh: .tafsir 2:255`
        )

      const [suratStr, ayatStr] = ctx.query.split(":")
      const surat = parseInt(suratStr)
      const ayatNo = parseInt(ayatStr)
      if (isNaN(surat) || isNaN(ayatNo))
        return ctx.reply.text("❌ Format salah. Contoh: .tafsir 2:255")

      try {
        const { data } = await http.get(
          `https://equran.id/api/v2/tafsir/${surat}`
        )
        const tafsir = data.data?.tafsir?.find((t) => t.ayat === ayatNo)
        if (!tafsir) return ctx.reply.text(`❌ Tafsir ayat ${ayatNo} tidak ditemukan.`)

        // Potong tafsir bila terlalu panjang
        let teks = tafsir.teks
        if (teks.length > 3500) teks = teks.slice(0, 3500) + "..."

        await ctx.reply.text(
          `📚 *TAFSIR QS. ${data.data.namaLatin} : ${ayatNo}*\n\n${teks}\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text("❌ Gagal memuat tafsir.")
      }
    },
  },

  // ─── .asmaulhusna [nomor] ────────────────────────────────
  {
    pattern: /^(asmaulhusna|asmaul|asmahusna)$/,
    description: "99 Asmaul Husna",
    ...openCmd,
    handler: async (ctx) => {
      try {
        const { data } = await http.get(
          "https://api.aladhan.com/v1/asmaAlHusna"
        )
        const list = data.data

        // Nomor tertentu
        const no = parseInt(ctx.args[0])
        if (!isNaN(no) && no >= 1 && no <= 99) {
          const a = list[no - 1]
          return ctx.reply.text(
            `✨ *ASMAUL HUSNA #${no}*\n\n${a.name}\n*${a.transliteration}*\n🇮🇩 ${a.en?.meaning}\n\n> ${config.watermark}`
          )
        }

        // Acak
        const a = randomItem(list)
        await ctx.reply.text(
          `✨ *ASMAUL HUSNA*\n\n${a.name}\n*${a.transliteration}*\n🇮🇩 ${a.en?.meaning}\n\n_Lihat nomor tertentu: .asmaulhusna 1-99_\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text("❌ Gagal memuat Asmaul Husna.")
      }
    },
  },

  // ─── .doa <nama> ─────────────────────────────────────────
  {
    pattern: /^(doa|doaharian)$/,
    description: "Doa harian",
    ...openCmd,
    handler: async (ctx) => {
      try {
        const { data } = await http.get(
          "https://doa-doa-api-ahmadramadhan.fly.dev/api"
        )
        const list = Array.isArray(data) ? data : []

        if (!ctx.query) {
          const names = list.slice(0, 30).map((d) => `◦ ${d.doa}`).join("\n")
          return ctx.reply.text(
            `🤲 *DOA HARIAN*\nKetik: *.doa <kata kunci>*\nContoh: .doa tidur\n\nBeberapa doa:\n${names}\n\n> ${config.watermark}`
          )
        }

        const q = ctx.query.toLowerCase()
        const found = list.find((d) => d.doa?.toLowerCase().includes(q))
        if (!found) return ctx.reply.text(`❌ Doa "${ctx.query}" tidak ditemukan.`)

        await ctx.reply.text(
          `🤲 *DOA ${found.doa.toUpperCase()}*\n\n${found.ayat}\n\n_${found.latin}_\n\n🇮🇩 ${found.artinya}\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text("❌ Gagal memuat doa.")
      }
    },
  },

  // ─── .dzikir [pagi/petang] ───────────────────────────────
  {
    pattern: /^(dzikir|zikir)$/,
    description: "Dzikir pagi/petang",
    ...openCmd,
    handler: async (ctx) => {
      const arg = (ctx.args[0] || "").toLowerCase()
      const set = arg === "petang" ? dzikirPetang : dzikirPagi
      const judul = arg === "petang" ? "DZIKIR PETANG" : "DZIKIR PAGI"

      const teks = set
        .map(
          (d, i) =>
            `${i + 1}. ${d.arab}\n_${d.latin}_\n🇮🇩 ${d.arti}`
        )
        .join("\n\n")

      await ctx.reply.text(
        `📿 *${judul}*\n_Ketik .dzikir petang untuk dzikir sore_\n\n${teks}\n\n> ${config.watermark}`
      )
    },
  },

  // ─── .hadits <perawi> ────────────────────────────────────
  {
    pattern: /^(hadits|hadis)$/,
    description: "Hadits acak dari perawi",
    ...openCmd,
    handler: async (ctx) => {
      const perawiList = ["bukhari", "muslim", "abu-daud", "tirmidzi", "nasai", "ibnu-majah", "ahmad", "malik", "darimi"]
      const perawi = (ctx.args[0] || "bukhari").toLowerCase()

      if (!perawiList.includes(perawi)) {
        return ctx.reply.text(
          `📜 *HADITS*\nKetik: *.hadits <perawi>*\nPerawi: ${perawiList.join(", ")}`
        )
      }

      try {
        // Ambil acak dari range awal
        const rand = Math.floor(Math.random() * 300) + 1
        const { data } = await http.get(
          `https://api.hadith.gading.dev/books/${perawi}?range=${rand}-${rand}`
        )
        const h = data.data?.hadiths?.[0]
        if (!h) return ctx.reply.text("❌ Hadits tidak ditemukan.")

        let arab = h.arab || ""
        if (arab.length > 1500) arab = arab.slice(0, 1500) + "..."

        await ctx.reply.text(
          `📜 *HADITS ${data.data.name} No.${h.number}*\n\n${arab}\n\n🇮🇩 ${h.id}\n\n> ${config.watermark}`
        )
      } catch {
        await ctx.reply.text("❌ Gagal memuat hadits.")
      }
    },
  },

  // ─── .niatpuasa [jenis] ──────────────────────────────────
  {
    pattern: /^(niatpuasa|niat)$/,
    description: "Niat puasa",
    ...openCmd,
    handler: async (ctx) => {
      const jenis = (ctx.args[0] || "").toLowerCase()
      const data = niatPuasa[jenis]

      if (!data) {
        const opsi = Object.keys(niatPuasa).join(", ")
        return ctx.reply.text(
          `🌙 *NIAT PUASA*\nKetik: *.niatpuasa <jenis>*\nJenis: ${opsi}`
        )
      }

      await ctx.reply.text(
        `🌙 *NIAT ${data.nama.toUpperCase()}*\n\n${data.arab}\n\n_${data.latin}_\n\n🇮🇩 ${data.arti}\n\n> ${config.watermark}`
      )
    },
  },

  // ─── .kisah ──────────────────────────────────────────────
  {
    pattern: /^(kisah|kisahnabi|cerita)$/,
    description: "Kisah nabi & sahabat",
    ...openCmd,
    handler: async (ctx) => {
      const k = randomItem(kisah)
      await ctx.reply.text(
        `📖 *${k.judul}*\n\n${k.isi}\n\n> ${config.watermark}`
      )
    },
  },
]
