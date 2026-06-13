// ============================================================
//   HABIBIH BOT - Plugin Group (Admin Grup)
//   kick, add, promote, demote, tagall, hidetag, totag,
//   open/close, mute/unmute, info, listadmin, link, revoke,
//   setname, setdesc
//   Support LID + JID WhatsApp terbaru
// ============================================================

import config from "../config.js"
import { fromJID } from "../lib/function.js"
import { updateGroup } from "../lib/database.js"

// ─── Helper: ambil target user (mention / reply / nomor) ─────
const getTarget = (ctx) => {
  // 1. Dari mention
  const mentioned =
    ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  if (mentioned.length) return mentioned[0]

  // 2. Dari reply
  if (ctx.quoted?.sender) return ctx.quoted.sender

  // 3. Dari argumen nomor
  if (ctx.args[0]) {
    const num = ctx.args[0].replace(/[^0-9]/g, "")
    if (num.length >= 5) return num + "@s.whatsapp.net"
  }

  return null
}

// ─── Properti permission standar admin grup ─────────────────
const adminCmd = {
  category: "group",
  owner: false,
  group: true,
  private: false,
  admin: true,
  botAdmin: true,
  premium: false,
}

// ─── Commands Export ──────────────────────────────────────────
export const commands = [
  // ─── .kick ───────────────────────────────────────────────
  {
    pattern: /^(kick|tendang)$/,
    description: "Keluarkan member dari grup",
    ...adminCmd,
    handler: async (ctx) => {
      const target = getTarget(ctx)
      if (!target)
        return ctx.reply.text(
          "❌ Tag, reply, atau ketik nomor member yang mau dikeluarkan.\nContoh: *.kick @user*"
        )

      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], "remove")
        await ctx.sock.sendMessage(ctx.jid, {
          text: `👢 @${fromJID(target)} telah dikeluarkan dari grup.`,
          mentions: [target],
        })
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .add (KHUSUS OWNER) ─────────────────────────────────
  {
    pattern: /^(add|tambah)$/,
    description: "Tambah member ke grup (khusus Owner)",
    category: "group",
    owner: true, // hanya owner bot
    group: true,
    private: false,
    admin: false,
    botAdmin: true,
    premium: false,
    handler: async (ctx) => {
      const num = ctx.args[0]?.replace(/[^0-9]/g, "")
      if (!num || num.length < 5)
        return ctx.reply.text(
          "❌ Masukkan nomor yang valid.\nContoh: *.add 628xxxx*"
        )

      const target = num + "@s.whatsapp.net"
      try {
        const res = await ctx.sock.groupParticipantsUpdate(
          ctx.jid,
          [target],
          "add"
        )
        const status = res?.[0]?.status
        if (status === "200") {
          await ctx.reply.text(`✅ Berhasil menambahkan @${num}`, {
            mentions: [target],
          })
        } else {
          await ctx.reply.text(
            `⚠️ Gagal menambahkan @${num}. Mungkin privasi mereka membatasi, atau perlu undangan manual.`,
            { mentions: [target] }
          )
        }
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .promote ─────────────────────────────────────────────
  {
    pattern: /^(promote|angkat)$/,
    description: "Jadikan member sebagai admin",
    ...adminCmd,
    handler: async (ctx) => {
      const target = getTarget(ctx)
      if (!target)
        return ctx.reply.text("❌ Tag/reply member yang mau dijadikan admin.")

      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], "promote")
        await ctx.sock.sendMessage(ctx.jid, {
          text: `⬆️ @${fromJID(target)} sekarang menjadi *Admin*! 🎉`,
          mentions: [target],
        })
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .demote ──────────────────────────────────────────────
  {
    pattern: /^(demote|turunkan)$/,
    description: "Copot admin menjadi member biasa",
    ...adminCmd,
    handler: async (ctx) => {
      const target = getTarget(ctx)
      if (!target)
        return ctx.reply.text("❌ Tag/reply admin yang mau dicopot.")

      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], "demote")
        await ctx.sock.sendMessage(ctx.jid, {
          text: `⬇️ @${fromJID(target)} sekarang menjadi *Member* biasa.`,
          mentions: [target],
        })
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .delete / .del ──────────────────────────────────────
  {
    pattern: /^(delete|del|d)$/,
    description: "Hapus pesan yang di-reply",
    ...adminCmd,
    handler: async (ctx) => {
      if (!ctx.quoted)
        return ctx.reply.text("❌ Reply pesan yang ingin dihapus, lalu ketik *.delete*")

      try {
        // Bangun key pesan yang di-reply untuk dihapus
        const delKey = {
          remoteJid: ctx.jid,
          fromMe: false,
          id: ctx.quoted.stanzaId,
          participant: ctx.quoted.sender,
        }
        await ctx.sock.sendMessage(ctx.jid, { delete: delKey })
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .tagall ──────────────────────────────────────────────
  {
    pattern: /^(tagall|everyone)$/,
    description: "Tag semua member (terlihat)",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      const members = ctx.members || []
      if (!members.length) return ctx.reply.text(config.msg.error)

      const note = ctx.query || "Tag Semua Member"
      const mentions = members.map((m) => m.id)
      const list = members
        .map((m, i) => `${i + 1}. @${fromJID(m.id)}`)
        .join("\n")

      await ctx.sock.sendMessage(ctx.jid, {
        text: `📢 *${note}*\n\n${list}\n\n> ${config.watermark}`,
        mentions,
      })
    },
  },

  // ─── .hidetag ─────────────────────────────────────────────
  {
    pattern: /^(hidetag|h)$/,
    description: "Tag semua member tanpa terlihat",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      const members = ctx.members || []
      if (!members.length) return ctx.reply.text(config.msg.error)

      // Teks dari argumen atau dari pesan yang di-reply
      const text =
        ctx.query ||
        ctx.quoted?.message?.conversation ||
        ctx.quoted?.message?.extendedTextMessage?.text ||
        "📢 Perhatian semua!"

      const mentions = members.map((m) => m.id)
      await ctx.sock.sendMessage(ctx.jid, { text, mentions })
    },
  },

  // ─── .totag (reply hidetag) ──────────────────────────────
  {
    pattern: /^(totag)$/,
    description: "Hidetag isi pesan yang di-reply",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      if (!ctx.quoted)
        return ctx.reply.text("❌ Reply sebuah pesan untuk di-totag.")

      const text =
        ctx.quoted.message?.conversation ||
        ctx.quoted.message?.extendedTextMessage?.text ||
        ""
      if (!text) return ctx.reply.text("❌ Pesan yang di-reply tidak berisi teks.")

      const mentions = (ctx.members || []).map((m) => m.id)
      await ctx.sock.sendMessage(ctx.jid, { text, mentions })
    },
  },

  // ─── .open / .close ──────────────────────────────────────
  {
    pattern: /^(open|buka)$/,
    description: "Buka grup (semua bisa kirim)",
    ...adminCmd,
    handler: async (ctx) => {
      await ctx.sock.groupSettingUpdate(ctx.jid, "not_announcement")
      await ctx.reply.text("🔓 Grup *dibuka*. Semua member bisa mengirim pesan.")
    },
  },
  {
    pattern: /^(close|tutup)$/,
    description: "Tutup grup (hanya admin bisa kirim)",
    ...adminCmd,
    handler: async (ctx) => {
      await ctx.sock.groupSettingUpdate(ctx.jid, "announcement")
      await ctx.reply.text("🔒 Grup *ditutup*. Hanya admin yang bisa mengirim pesan.")
    },
  },

  // ─── .mute / .unmute ─────────────────────────────────────
  {
    pattern: /^(mute)$/,
    description: "Bot diam di grup ini",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      updateGroup(ctx.jid, { mute: true })
      await ctx.reply.text("🔇 Bot di-*mute* di grup ini. Hanya admin/owner yang dilayani.")
    },
  },
  {
    pattern: /^(unmute)$/,
    description: "Aktifkan kembali bot di grup",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: true,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      updateGroup(ctx.jid, { mute: false })
      await ctx.reply.text("🔊 Bot di-*unmute*. Bot kembali aktif untuk semua.")
    },
  },

  // ─── .infogrup ───────────────────────────────────────────
  {
    pattern: /^(infogrup|infogroup|groupinfo)$/,
    description: "Informasi grup",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      const meta = ctx.groupMetadata
      if (!meta) return ctx.reply.text(config.msg.error)

      const totalAdmin = (ctx.admins || []).length
      const totalMember = (ctx.members || []).length
      const owner = meta.owner ? `@${fromJID(meta.owner)}` : "-"

      const text = `╭─「 ℹ️ INFO GRUP 」
│ ◦ Nama   : ${meta.subject}
│ ◦ ID     : ${meta.id}
│ ◦ Owner  : ${owner}
│ ◦ Member : ${totalMember}
│ ◦ Admin  : ${totalAdmin}
│ ◦ Dibuat : ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString("id-ID") : "-"}
╰────────────────
${meta.desc ? `\n📝 *Deskripsi:*\n${meta.desc}` : ""}

> ${config.watermark}`

      await ctx.sock.sendMessage(ctx.jid, {
        text,
        mentions: meta.owner ? [meta.owner] : [],
      })
    },
  },

  // ─── .listadmin ──────────────────────────────────────────
  {
    pattern: /^(listadmin|admins)$/,
    description: "Daftar admin grup",
    category: "group",
    owner: false,
    group: true,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,
    handler: async (ctx) => {
      const admins = ctx.admins || []
      if (!admins.length) return ctx.reply.text("❌ Tidak ada admin terdeteksi.")

      const list = admins.map((a, i) => `${i + 1}. @${fromJID(a)}`).join("\n")
      await ctx.sock.sendMessage(ctx.jid, {
        text: `👮 *DAFTAR ADMIN*\n\n${list}\n\n> ${config.watermark}`,
        mentions: admins,
      })
    },
  },

  // ─── .linkgrup ───────────────────────────────────────────
  {
    pattern: /^(linkgrup|linkgroup|grouplink)$/,
    description: "Dapatkan link undangan grup",
    ...adminCmd,
    handler: async (ctx) => {
      try {
        const code = await ctx.sock.groupInviteCode(ctx.jid)
        await ctx.reply.text(
          `🔗 *Link Grup ${ctx.groupName}*\n\nhttps://chat.whatsapp.com/${code}`
        )
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .revoke ─────────────────────────────────────────────
  {
    pattern: /^(revoke|resetlink)$/,
    description: "Reset link undangan grup",
    ...adminCmd,
    handler: async (ctx) => {
      try {
        await ctx.sock.groupRevokeInvite(ctx.jid)
        await ctx.reply.text("♻️ Link grup berhasil direset. Link lama tidak berlaku lagi.")
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .setname ────────────────────────────────────────────
  {
    pattern: /^(setname|setsubject|gantinama)$/,
    description: "Ganti nama grup",
    ...adminCmd,
    handler: async (ctx) => {
      if (!ctx.query) return ctx.reply.text("❌ Masukkan nama baru.\nContoh: *.setname Grup Keren*")
      try {
        await ctx.sock.groupUpdateSubject(ctx.jid, ctx.query)
        await ctx.reply.text(`✅ Nama grup diubah menjadi: *${ctx.query}*`)
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },

  // ─── .setdesc ────────────────────────────────────────────
  {
    pattern: /^(setdesc|setdeskripsi|gantidesc)$/,
    description: "Ganti deskripsi grup",
    ...adminCmd,
    handler: async (ctx) => {
      if (!ctx.query) return ctx.reply.text("❌ Masukkan deskripsi baru.")
      try {
        await ctx.sock.groupUpdateDescription(ctx.jid, ctx.query)
        await ctx.reply.text("✅ Deskripsi grup berhasil diperbarui.")
      } catch {
        await ctx.reply.text(config.msg.error)
      }
    },
  },
]
