// ============================================================
//   HABIBIH BOT - Plugin Menu (Gaya A - Box Garis Tegas)
//   Command: .menu (kategori) | .allmenu (semua fitur)
//   Header: hari, tanggal, jam, runtime, salam, sapa nama
//   Video dikirim duluan, menu teks di pesan terpisah
// ============================================================

import config from "../config.js"
import { getMenuMedia } from "../lib/function.js"
import { getPlugins } from "../handler.js"
import { logError } from "../lib/logger.js"
import {
  formatUptime,
  getDay,
  getFullDate,
  getTime,
  getSalamIslami,
  randomItem,
} from "../lib/function.js"

// ─── Quote Islami Acak untuk Footer ──────────────────────────
const quotes = [
  "Sebaik-baik manusia adalah yang bermanfaat bagi orang lain.",
  "Barangsiapa bersungguh-sungguh, pasti akan berhasil.",
  "Jangan menunda kebaikan, karena waktu tak pernah kembali.",
  "Senyummu di hadapan saudaramu adalah sedekah.",
  "Allah tidak membebani seseorang melainkan sesuai kesanggupannya.",
  "Doa adalah senjata seorang mukmin.",
  "Bersyukurlah, maka nikmatmu akan ditambah.",
  "Sabar itu indah, dan Allah bersama orang-orang yang sabar.",
]

// ─── Header Menu (dipakai semua menu) ────────────────────────
const buildHeader = (ctx) => {
  const uptime = formatUptime(Math.floor(process.uptime()))
  const role = ctx.isOwnerSender
    ? "👑 Owner"
    : ctx.isPremiumSender
      ? "⭐ Premium"
      : "👤 Member"

  return `┏━━━━━━━━━━━━━━━━━━━┓
┃   *HABIBIH BOT*
┗━━━━━━━━━━━━━━━━━━━┛
${getSalamIslami()}
Hai, *${ctx.pushName}* ${role}

╭─ ⚙️ *INFO BOT*
│ ◦ Owner   : ${config.ownerName}
│ ◦ Hari    : ${getDay()}
│ ◦ Tanggal : ${getFullDate()}
│ ◦ Jam     : ${getTime()} WIB
│ ◦ Runtime : ${uptime}
│ ◦ Prefix  : . ! #
│ ◦ Mode    : ${ctx.isGroupMsg ? "Grup" : "Private"}
╰────────────────`
}

// ─── Footer Menu ─────────────────────────────────────────────
const buildFooter = () => {
  return `╭─ 🔗 *LINK*
│ ◦ Web     : ${config.website}
│ ◦ Channel : ${config.channelWA}
╰────────────────

💬 _"${randomItem(quotes)}"_

> ${config.watermark}`
}

// ─── Hitung total fitur dari semua plugin ────────────────────
const countFeatures = () => {
  try {
    return getPlugins().size
  } catch {
    return 0
  }
}

// ─── Definisi Kategori & Fitur ───────────────────────────────
const categories = {
  game: {
    emoji: "🎮",
    title: "GAME",
    items: [
      ".tebakangka — Tebak angka 1-100",
      ".tebak <angka> — Jawab tebakan",
      ".suit <batu/gunting/kertas>",
    ],
  },
  fun: {
    emoji: "🎉",
    title: "FUN",
    items: [
      ".dadu — Lempar dadu",
      ".suit — Suit vs bot",
      ".kerang <pertanyaan> — Bola ajaib",
    ],
  },
  islami: {
    emoji: "🕌",
    title: "ISLAMI",
    items: [
      ".sholat <kota> — Jadwal sholat",
      ".quran <surat> — Baca Al-Qur'an",
      ".asmaul — Asmaul Husna",
      ".doa <nama> — Doa harian",
      ".dzikir — Dzikir pagi/petang",
      ".hadits — Hadits random",
    ],
    soon: true,
  },
  downloader: {
    emoji: "📥",
    title: "DOWNLOADER",
    items: [
      ".tiktok <url>",
      ".ytmp3 <url> / .ytmp4 <url>",
      ".play <judul> — Musik YouTube",
      ".ig <url> — Instagram",
      ".fb <url> — Facebook",
      ".pin <url> — Pinterest",
      ".capcut <url> — CapCut",
    ],
    soon: true,
  },
  tools: {
    emoji: "🛠️",
    title: "TOOLS",
    items: [
      ".ping — Cek kecepatan bot",
      ".runtime — Uptime bot",
      ".stats — Statistik bot",
      ".menu — Menu kategori",
      ".allmenu — Semua fitur",
    ],
  },
  sticker: {
    emoji: "🎭",
    title: "STICKER",
    items: [
      ".sticker — Gambar/video → stiker",
      ".stext <teks> — Stiker teks",
      ".toimg — Stiker → gambar",
    ],
    soon: true,
  },
  group: {
    emoji: "👥",
    title: "GROUP",
    items: [
      ".kick @user / .add <nomor>",
      ".promote / .demote @user",
      ".tagall / .hidetag <teks>",
      ".antilink on/off",
      ".welcome on/off / .goodbye on/off",
    ],
    soon: true,
  },
  owner: {
    emoji: "👑",
    title: "OWNER",
    items: [
      ".addprem / .delprem @user",
      ".ban / .unban @user",
      ".broadcast <teks>",
      ".backup — Backup database",
      ".setmode group/private/both",
    ],
    soon: true,
  },
}

// ─── Render satu kategori (Gaya A) ───────────────────────────
const renderCategory = (key) => {
  const cat = categories[key]
  if (!cat) return null

  const soonTag = cat.soon ? " _(Sebagian Segera Hadir)_" : ""
  const lines = cat.items.map((i) => `│ ◦ ${i}`).join("\n")

  return `╭─「 ${cat.emoji} ${cat.title} 」${soonTag}
${lines}
╰────────────────`
}

// ─── Menu utama (daftar kategori) ────────────────────────────
const buildMainMenu = (ctx) => {
  const total = countFeatures()
  const catList = Object.entries(categories)
    .map(([key, c]) => `│ ◦ .menu ${key}  ${c.emoji} ${c.title}`)
    .join("\n")

  return `${buildHeader(ctx)}

╭─「 📂 PILIH KATEGORI 」
${catList}
│
│ ◦ .allmenu  📜 Semua Fitur
╰────────────────
Total fitur aktif: *${total}*

${buildFooter()}`
}

// ─── Menu semua fitur ────────────────────────────────────────
const buildAllMenu = (ctx) => {
  const allCats = Object.keys(categories)
    .map((key) => renderCategory(key))
    .filter(Boolean)
    .join("\n\n")

  return `${buildHeader(ctx)}

${allCats}

${buildFooter()}`
}

// ─── Kirim menu (video dulu, lalu teks terpisah) ─────────────
const sendMenu = async (ctx, menuText) => {
  // 1. Kirim media dengan caption pendek (biar video kebuka penuh)
  try {
    const mediaBuffer = await getMenuMedia()
    const shortCaption = `🌙 *${config.botName}* siap melayani!\n_Menu lengkap di pesan berikutnya..._`

    if (config.menu.mediaType === "video") {
      await ctx.sock.sendMessage(
        ctx.jid,
        { video: mediaBuffer, caption: shortCaption, gifPlayback: false },
        { quoted: ctx.msg }
      )
    } else {
      await ctx.sock.sendMessage(
        ctx.jid,
        { image: mediaBuffer, caption: shortCaption },
        { quoted: ctx.msg }
      )
    }
  } catch (err) {
    logError("Gagal kirim media menu, lanjut teks saja", err)
  }

  // 2. Kirim menu teks lengkap di pesan terpisah
  await ctx.reply.text(menuText)
}

// ─── Commands Export ──────────────────────────────────────────
export const commands = [
  // ─── .menu — kategori ────────────────────────────────────
  {
    pattern: /^(menu|help|start)$/,
    description: "Tampilkan menu kategori",
    category: "tools",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const sub = ctx.args[0]?.toLowerCase() || ""

      // Jika ada sub kategori valid → tampilkan kategori itu (teks saja)
      if (sub && categories[sub]) {
        const text = `${buildHeader(ctx)}\n\n${renderCategory(sub)}\n\n${buildFooter()}`
        return ctx.reply.text(text)
      }

      // Default → menu utama (dengan media)
      await sendMenu(ctx, buildMainMenu(ctx))
    },
  },

  // ─── .allmenu — semua fitur ──────────────────────────────
  {
    pattern: /^(allmenu|menuall|listmenu)$/,
    description: "Tampilkan semua fitur",
    category: "tools",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      await sendMenu(ctx, buildAllMenu(ctx))
    },
  },
]
