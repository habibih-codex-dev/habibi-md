// ============================================================
//   HABIBIH BOT - Plugin Menu
//   Command: .menu | .help | .start
//   Tampil dengan video/gambar + native flow fallback teks
// ============================================================

import fs from "fs"
import config from "../config.js"
import { getMenuMedia } from "../lib/function.js"
import { getStats } from "../lib/database.js"
import { logError } from "../lib/logger.js"
import { formatUptime, getDate, getDay, getTime, getSalamIslami } from "../lib/function.js"
import os from "os"

// ─── Teks Menu Utama ─────────────────────────────────────────

const buildMenuText = (ctx) => {
  const { pushName, senderNumber, isOwnerSender, isPremiumSender, isGroupMsg, groupName } = ctx
  const stats = getStats()
  const uptime = formatUptime(Math.floor(process.uptime()))
  const now = `${getDay()}, ${getDate()} • ${getTime()}`
  const role = isOwnerSender ? "👑 Owner" : isPremiumSender ? "⭐ Premium" : "👤 Member"
  const location = isGroupMsg ? `📍 ${groupName}` : "📍 Private Chat"

  return `
╔══════════════════════════╗
║   🌙 *${config.botName}* 🌙   ║
╚══════════════════════════╝

${getSalamIslami()}, *${pushName}*!
${location} • ${role}

📅 *${now}*
⏱️ *Uptime:* ${uptime}

┌─── 📋 *DAFTAR MENU* ───
│
├ 🤖 *.menu ai*       — Menu AI & Chat
├ 📥 *.menu dl*       — Menu Downloader
├ 🕌 *.menu islami*   — Menu Islami
├ 🎭 *.menu sticker*  — Menu Sticker
├ 🔧 *.menu tools*    — Menu Tools
├ 👥 *.menu group*    — Menu Grup
├ 👑 *.menu owner*    — Menu Owner
├ ⭐ *.menu premium*  — Menu Premium
│
└─────────────────────────

*Prefix yang didukung:* \`.\` \`!\` \`#\`

🌐 ${config.website}
📢 ${config.channelWA}

> ${config.watermark}
`.trim()
}

// ─── Sub-Menu AI ─────────────────────────────────────────────

const buildMenuAI = () => `
╔══════════════════════════╗
║    🤖 *MENU AI & CHAT*    ║
╚══════════════════════════╝

├ 🧠 *.ai* [teks]       — Chat dengan AI
├ 💬 *.gpt* [teks]      — GPT Chat
├ 🎨 *.imagine* [teks]  — Buat gambar AI

> ${config.watermark}
`.trim()

// ─── Sub-Menu Downloader ──────────────────────────────────────

const buildMenuDL = () => `
╔══════════════════════════╗
║   📥 *MENU DOWNLOADER*   ║
╚══════════════════════════╝

├ 🎵 *.play* [judul]      — Play musik YouTube
├ 🎬 *.yta* [url]         — Download audio YT
├ 📹 *.ytv* [url]         — Download video YT
├ 🎭 *.tiktok* [url]      — Download TikTok
├ 📸 *.ig* [url]          — Download Instagram
├ 📘 *.fb* [url]          — Download Facebook
├ 📌 *.pin* [url]         — Download Pinterest
├ ✂️ *.capcut* [url]      — Download CapCut

> ${config.watermark}
`.trim()

// ─── Sub-Menu Islami ──────────────────────────────────────────

const buildMenuIslami = () => `
╔══════════════════════════╗
║    🕌 *MENU ISLAMI*       ║
╚══════════════════════════╝

├ 🕐 *.sholat* [kota]    — Jadwal sholat
├ 📖 *.quran* [surat:ayat]— Baca Al-Qur'an
├ 🌙 *.asmaul*           — Asmaul Husna
├ 🤲 *.doa* [nama doa]   — Doa harian
├ 📿 *.dzikir*           — Dzikir pagi/petang
├ 🗓️ *.hijriyah*         — Kalender hijriyah
├ 🕌 *.kiblat*           — Arah kiblat
├ 💫 *.hadits*           — Hadits random
├ 📜 *.surat* [nama]     — Info surat Al-Qur'an

> ${config.watermark}
`.trim()

// ─── Sub-Menu Sticker ─────────────────────────────────────────

const buildMenuSticker = () => `
╔══════════════════════════╗
║    🎭 *MENU STICKER*      ║
╚══════════════════════════╝

├ 🖼️ *.sticker*          — Gambar/video → sticker
├ ✏️ *.stext* [teks]     — Sticker teks
├ 🎞️ *.toimg*            — Sticker → gambar
├ 🏷️ *.rename* [nama|pack]— Rename sticker
├ ❌ *.delsticker*        — Hapus sticker WA

> ${config.watermark}
`.trim()

// ─── Sub-Menu Tools ───────────────────────────────────────────

const buildMenuTools = () => `
╔══════════════════════════╗
║     🔧 *MENU TOOLS*       ║
╚══════════════════════════╝

├ 🏓 *.ping*             — Cek kecepatan bot
├ ⏱️ *.runtime*          — Uptime bot
├ 📊 *.stats*            — Statistik bot
├ 🔍 *.whois* [@user]    — Info pengguna
├ 💾 *.getdb*            — Download database (Owner)
├ ♻️ *.setdb*            — Restore database (Owner)
├ 🗑️ *.clearcache*       — Hapus cache media
├ 🔄 *.reload*           — Reload plugin (Owner)

> ${config.watermark}
`.trim()

// ─── Sub-Menu Group ───────────────────────────────────────────

const buildMenuGroup = () => `
╔══════════════════════════╗
║     👥 *MENU GRUP*        ║
╚══════════════════════════╝

│ *— Admin Grup —*
├ 👢 *.kick* [@user]     — Kick member
├ ➕ *.add* [nomor]      — Tambah member
├ ⬆️ *.promote* [@user]  — Jadikan admin
├ ⬇️ *.demote* [@user]   — Copot admin
├ 📢 *.tagall*           — Tag semua member
├ 👻 *.hidetag* [teks]   — Tag tanpa notif
├ 🗑️ *.delete*           — Hapus pesan
├ 📝 *.mention* [@user]  — Mention user
│
│ *— Pengaturan Grup —*
├ 🔒 *.lock*             — Kunci grup
├ 🔓 *.unlock*           — Buka grup
├ 👤 *.onlyadmin* [on/off]— Hanya admin kirim
├ 🔗 *.antilink* [on/off] — Anti link
├ 🤖 *.antibot* [on/off]  — Anti bot
├ ☣️ *.antitoxic* [on/off]— Anti kata toxic
├ 🌍 *.antiforeignnum* [on/off] — Anti nomor LN
├ 👋 *.welcome* [on/off]  — Pesan sambutan
├ 🚪 *.goodbye* [on/off]  — Pesan perpisahan
│
│ *— Lokasi Aktif —*
│ 🔘 *.setmode* [group/private/both]

> ${config.watermark}
`.trim()

// ─── Sub-Menu Owner ───────────────────────────────────────────

const buildMenuOwner = () => `
╔══════════════════════════╗
║     👑 *MENU OWNER*       ║
╚══════════════════════════╝

│ *— Bot Settings —*
├ ⚙️ *.autoread* [on/off]   — Auto baca pesan
├ ⌨️ *.autotyping* [on/off] — Auto typing
├ 🙈 *.selfmode* [on/off]   — Self mode
├ 🌐 *.setmode* [group/private/both]
├ 🔄 *.reload*              — Reload plugin
├ 💾 *.backup*              — Backup database
├ 🚫 *.shutdown*            — Matikan bot
│
│ *— User Management —*
├ ⭐ *.addprem* [@user]     — Tambah premium
├ ❌ *.delprem* [@user]     — Hapus premium
├ 📋 *.listprem*            — List premium
├ 🚫 *.ban* [@user]         — Ban pengguna
├ ✅ *.unban* [@user]       — Unban pengguna
├ 📣 *.broadcast* [teks]    — Broadcast pesan
├ 🤖 *.jadibot* [@user]     — Jadikan bot

> ${config.watermark}
`.trim()

// ─── Sub-Menu Premium ─────────────────────────────────────────

const buildMenuPremium = () => `
╔══════════════════════════╗
║    ⭐ *MENU PREMIUM*      ║
╚══════════════════════════╝

│ Fitur eksklusif untuk pengguna Premium
│
├ 🔥 Semua fitur tanpa batas limit
├ ⚡ Prioritas respons lebih cepat
├ 🎁 Akses fitur beta terbaru
│
│ *Info Premium:*
├ 💰 *.cekprem*  — Cek status premium
│
│ *Cara beli premium:*
│ 🌐 ${config.website}
│ 📢 ${config.channelWA}

> ${config.watermark}
`.trim()

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  {
    pattern: /^(menu|help|start)$/,
    description: "Tampilkan menu utama",
    category: "main",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const { reply, args } = ctx
      const sub = args[0]?.toLowerCase() || ""

      // Sub-menu
      const subMenus = {
        ai: buildMenuAI(),
        dl: buildMenuDL(),
        downloader: buildMenuDL(),
        islami: buildMenuIslami(),
        sticker: buildMenuSticker(),
        tools: buildMenuTools(),
        group: buildMenuGroup(),
        grup: buildMenuGroup(),
        owner: buildMenuOwner(),
        premium: buildMenuPremium(),
      }

      if (sub && subMenus[sub]) {
        return reply.text(subMenus[sub])
      }

      // Menu utama dengan media
      const menuText = buildMenuText(ctx)

      try {
        // Coba kirim dengan media video
        const mediaBuffer = await getMenuMedia()
        const mediaType = config.menu.mediaType

        if (mediaType === "video") {
          await ctx.sock.sendMessage(
            ctx.jid,
            {
              video: mediaBuffer,
              caption: menuText,
              gifPlayback: false,
            },
            { quoted: ctx.msg }
          )
        } else {
          await ctx.sock.sendMessage(
            ctx.jid,
            {
              image: mediaBuffer,
              caption: menuText,
            },
            { quoted: ctx.msg }
          )
        }
      } catch (err) {
        logError("Gagal kirim media menu, fallback ke teks", err)
        // Fallback kirim teks saja
        await reply.text(menuText)
      }
    },
  },
]
