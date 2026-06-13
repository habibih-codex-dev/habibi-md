// ============================================================
//   HABIBIH BOT - Plugin Protection (Toggle)
//   Toggle semua anti-* + welcome/goodbye custom + onlyadmin
// ============================================================

import config from "../config.js"
import { updateGroup, getGroup } from "../lib/database.js"

// ─── Parse argumen on/off ────────────────────────────────────
const parseToggle = (arg) => {
  const a = (arg || "").toLowerCase()
  if (["on", "aktif", "enable", "1", "true", "nyala"].includes(a)) return true
  if (["off", "mati", "disable", "0", "false", "nonaktif"].includes(a)) return false
  return null
}

// ─── Properti permission standar (admin grup) ───────────────
const adminCmd = {
  category: "group",
  owner: false,
  group: true,
  private: false,
  admin: true,
  botAdmin: false,
  premium: false,
}

// ─── Builder command toggle proteksi ─────────────────────────
const makeToggle = (pattern, key, label) => ({
  pattern,
  description: `Aktif/nonaktif ${label}`,
  ...adminCmd,
  handler: async (ctx) => {
    const val = parseToggle(ctx.args[0])
    if (val === null) {
      const current = getGroup(ctx.jid)[key]
      return ctx.reply.text(
        `⚙️ *${label}*\n` +
          `Status saat ini: ${current ? "✅ AKTIF" : "❌ NONAKTIF"}\n\n` +
          `Gunakan:\n◦ .${Array.isArray(pattern) ? pattern[0] : key} on\n◦ .${Array.isArray(pattern) ? pattern[0] : key} off`
      )
    }
    updateGroup(ctx.jid, { [key]: val })
    await ctx.reply.text(
      `${val ? "✅" : "❌"} *${label}* telah ${val ? "diaktifkan" : "dinonaktifkan"}.`
    )
  },
})

// ─── Commands Export ──────────────────────────────────────────
export const commands = [
  // ─── Anti-link varian ────────────────────────────────────
  makeToggle("antilink", "antilink", "Anti Link (hapus)"),
  makeToggle("antilinkv2", "antilinkv2", "Anti Link v2 (hapus + kick)"),
  makeToggle("antilinkwa", "antilinkwa", "Anti Link Grup WA"),
  makeToggle("antilinkch", "antilinkch", "Anti Link Saluran WA"),
  makeToggle("antilinktt", "antilinktt", "Anti Link TikTok"),
  makeToggle("antilinkyt", "antilinkyt", "Anti Link YouTube"),
  makeToggle("antilinkig", "antilinkig", "Anti Link Instagram"),
  makeToggle("antilinktg", "antilinktg", "Anti Link Telegram"),

  // ─── Proteksi lain ───────────────────────────────────────
  makeToggle("antibot", "antibot", "Anti Bot"),
  makeToggle("antitoxic", "antitoxic", "Anti Toxic"),
  makeToggle(/^(antiforeign|antiforeignnumber|antilncn)$/, "antiforeign", "Anti Nomor Luar Negeri"),
  makeToggle("antispam", "antispam", "Anti Spam"),
  makeToggle("antitag", "antitag", "Anti Tag Massal"),
  makeToggle("antidelete", "antidelete", "Anti Delete"),
  makeToggle("antivirtex", "antivirtex", "Anti Virtex"),
  makeToggle("antimedia", "antimedia", "Anti Media"),
  makeToggle("onlyadmin", "onlyadmin", "Only Admin (hanya admin kirim)"),

  // ─── Welcome / Goodbye toggle ────────────────────────────
  makeToggle("welcome", "welcome", "Pesan Selamat Datang"),
  makeToggle("goodbye", "goodbye", "Pesan Perpisahan"),

  // ─── Set teks welcome custom ─────────────────────────────
  {
    pattern: /^(setwelcome|setwlcm)$/,
    description: "Atur teks welcome custom (@user @group @count)",
    ...adminCmd,
    handler: async (ctx) => {
      if (!ctx.query) {
        return ctx.reply.text(
          `📝 *SET WELCOME*\n\n` +
            `Ketik: *.setwelcome <teks>*\n\n` +
            `Placeholder:\n` +
            `◦ @user  → mention member\n` +
            `◦ @group → nama grup\n` +
            `◦ @count → jumlah member\n\n` +
            `Contoh:\n.setwelcome Halo @user! Selamat datang di @group 🎉\n\n` +
            `Reset ke default: *.setwelcome reset*`
        )
      }
      if (ctx.query.toLowerCase() === "reset") {
        updateGroup(ctx.jid, { welcomeText: null })
        return ctx.reply.text("♻️ Teks welcome dikembalikan ke default.")
      }
      updateGroup(ctx.jid, { welcomeText: ctx.query, welcome: true })
      await ctx.reply.text("✅ Teks welcome berhasil diatur & fitur welcome diaktifkan.")
    },
  },

  // ─── Set teks goodbye custom ─────────────────────────────
  {
    pattern: /^(setgoodbye|setbye)$/,
    description: "Atur teks goodbye custom (@user @group @count)",
    ...adminCmd,
    handler: async (ctx) => {
      if (!ctx.query) {
        return ctx.reply.text(
          `📝 *SET GOODBYE*\n\n` +
            `Ketik: *.setgoodbye <teks>*\n\n` +
            `Placeholder:\n` +
            `◦ @user  → mention member\n` +
            `◦ @group → nama grup\n` +
            `◦ @count → jumlah member\n\n` +
            `Contoh:\n.setgoodbye Selamat tinggal @user 👋\n\n` +
            `Reset ke default: *.setgoodbye reset*`
        )
      }
      if (ctx.query.toLowerCase() === "reset") {
        updateGroup(ctx.jid, { goodbyeText: null })
        return ctx.reply.text("♻️ Teks goodbye dikembalikan ke default.")
      }
      updateGroup(ctx.jid, { goodbyeText: ctx.query, goodbye: true })
      await ctx.reply.text("✅ Teks goodbye berhasil diatur & fitur goodbye diaktifkan.")
    },
  },

  // ─── Set gambar welcome ──────────────────────────────────
  {
    pattern: /^(setwelcomeimg|setwlcmimg)$/,
    description: "Atur gambar welcome (URL)",
    ...adminCmd,
    handler: async (ctx) => {
      const url = ctx.args[0]
      if (!url || !/^https?:\/\//.test(url)) {
        if (url?.toLowerCase() === "reset") {
          updateGroup(ctx.jid, { welcomeImage: null })
          return ctx.reply.text("♻️ Gambar welcome dihapus.")
        }
        return ctx.reply.text(
          "❌ Masukkan URL gambar.\nContoh: *.setwelcomeimg https://...*\nHapus: *.setwelcomeimg reset*"
        )
      }
      updateGroup(ctx.jid, { welcomeImage: url, welcome: true })
      await ctx.reply.text("✅ Gambar welcome berhasil diatur.")
    },
  },

  // ─── Set gambar goodbye ──────────────────────────────────
  {
    pattern: /^(setgoodbyeimg|setbyeimg)$/,
    description: "Atur gambar goodbye (URL)",
    ...adminCmd,
    handler: async (ctx) => {
      const url = ctx.args[0]
      if (!url || !/^https?:\/\//.test(url)) {
        if (url?.toLowerCase() === "reset") {
          updateGroup(ctx.jid, { goodbyeImage: null })
          return ctx.reply.text("♻️ Gambar goodbye dihapus.")
        }
        return ctx.reply.text(
          "❌ Masukkan URL gambar.\nContoh: *.setgoodbyeimg https://...*\nHapus: *.setgoodbyeimg reset*"
        )
      }
      updateGroup(ctx.jid, { goodbyeImage: url, goodbye: true })
      await ctx.reply.text("✅ Gambar goodbye berhasil diatur.")
    },
  },

  // ─── Status semua proteksi ───────────────────────────────
  {
    pattern: /^(protection|proteksi|antistatus)$/,
    description: "Lihat status semua proteksi grup",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      const g = getGroup(ctx.jid)
      const s = (v) => (v ? "✅" : "❌")

      const text = `╭─「 🛡️ STATUS PROTEKSI 」
│ ${s(g.antilink)} Anti Link
│ ${s(g.antilinkv2)} Anti Link v2 (kick)
│ ${s(g.antilinkwa)} Anti Link Grup WA
│ ${s(g.antilinkch)} Anti Link Saluran
│ ${s(g.antilinktt)} Anti Link TikTok
│ ${s(g.antilinkyt)} Anti Link YouTube
│ ${s(g.antilinkig)} Anti Link Instagram
│ ${s(g.antilinktg)} Anti Link Telegram
│ ${s(g.antibot)} Anti Bot
│ ${s(g.antitoxic)} Anti Toxic
│ ${s(g.antiforeign)} Anti Nomor LN
│ ${s(g.antispam)} Anti Spam
│ ${s(g.antitag)} Anti Tag Massal
│ ${s(g.antidelete)} Anti Delete
│ ${s(g.antivirtex)} Anti Virtex
│ ${s(g.antimedia)} Anti Media
│ ${s(g.onlyadmin)} Only Admin
│ ${s(g.welcome)} Welcome
│ ${s(g.goodbye)} Goodbye
│ ${s(g.mute)} Mute
╰────────────────

> ${config.watermark}`

      await ctx.reply.text(text)
    },
  },
]
