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
} from "../lib/function.js"

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
      ".setkota <kota> — Set kota chat",
      ".autosholat on/off — Pengingat sholat",
      ".jadwalimsak <kota> — Imsak & buka",
      ".kiblat <kota> — Arah kiblat",
      ".hijriah — Tanggal hijriah",
      ".quran <surat>[:ayat] — Baca Qur'an",
      ".tafsir <surat>:<ayat> — Tafsir ayat",
      ".asmaulhusna [no] — 99 Asmaul Husna",
      ".doa <nama> — Doa harian",
      ".dzikir [pagi/petang] — Dzikir",
      ".hadits <perawi> — Hadits acak",
      ".niatpuasa <jenis> — Niat puasa",
      ".kisah — Kisah nabi & sahabat",
    ],
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
      ".kick @user — Keluarkan member",
      ".add <nomor> — Tambah member (Owner)",
      ".promote / .demote @user",
      ".delete — Hapus pesan (reply)",
      ".tagall <teks> — Tag semua (terlihat)",
      ".hidetag <teks> — Tag tersembunyi",
      ".totag — Hidetag pesan yang direply",
      ".open / .close — Buka/tutup grup",
      ".mute / .unmute — Bot diam/aktif",
      ".infogrup / .listadmin",
      ".linkgrup / .revoke",
      ".setname / .setdesc",
    ],
  },
  proteksi: {
    emoji: "🛡️",
    title: "PROTEKSI GRUP",
    items: [
      ".antilink on/off — hapus semua link",
      ".antilinkv2 on/off — hapus + kick",
      ".antilinkwa / .antilinkch on/off",
      ".antilinktt / .antilinkyt on/off",
      ".antilinkig / .antilinktg on/off",
      ".antibot / .antitoxic on/off",
      ".antiforeign / .antispam on/off",
      ".antitag / .antidelete on/off",
      ".antivirtex / .antimedia on/off",
      ".onlyadmin on/off — hanya admin pakai bot",
      ".welcome / .goodbye on/off",
      ".setwelcome / .setgoodbye <teks>",
      ".setwelcomeimg / .setgoodbyeimg <url>",
      ".proteksi — Lihat status proteksi",
    ],
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

// ─── Kirim menu (media + teks digabung jadi 1 pesan) ─────────
const sendMenu = async (ctx, menuText) => {
  try {
    const mediaBuffer = await getMenuMedia()

    if (config.menu.mediaType === "video") {
      await ctx.sock.sendMessage(
        ctx.jid,
        { video: mediaBuffer, caption: menuText, gifPlayback: false },
        { quoted: ctx.msg }
      )
    } else {
      await ctx.sock.sendMessage(
        ctx.jid,
        { image: mediaBuffer, caption: menuText },
        { quoted: ctx.msg }
      )
    }
  } catch (err) {
    // Jika media gagal dimuat, kirim teks saja sebagai fallback
    logError("Gagal kirim media menu, fallback teks", err)
    await ctx.reply.text(menuText)
  }
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
