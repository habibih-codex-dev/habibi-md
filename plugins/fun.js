// ============================================================
//   HABIBIH BOT - Plugin Fun & Game
//   Command: .dadu | .suit | .tebakangka | .tebak | .kerang
// ============================================================

import config from "../config.js"
import { randomItem } from "../lib/function.js"

// ─── State Game Tebak Angka (in-memory per chat) ─────────────
// key = jid, value = { answer, attempts }
const tebakGame = new Map()

// ─── Commands Export ──────────────────────────────────────────
export const commands = [
  // ─── .dadu — lempar dadu ─────────────────────────────────
  {
    pattern: /^(dadu|dice)$/,
    description: "Lempar dadu acak 1-6",
    category: "fun",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]
      const value = Math.floor(Math.random() * 6)

      await ctx.reply.text(
        `🎲 *LEMPAR DADU*\n\n` +
          `${faces[value]}  Kamu mendapat angka *${value + 1}*!\n\n` +
          `> ${config.watermark}`
      )
    },
  },

  // ─── .suit — batu gunting kertas ─────────────────────────
  {
    pattern: /^(suit|suten)$/,
    description: "Suit batu/gunting/kertas vs bot",
    category: "fun",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const choices = {
        batu: "🪨",
        gunting: "✂️",
        kertas: "📄",
      }
      const userPick = ctx.args[0]?.toLowerCase()

      if (!userPick || !choices[userPick]) {
        return ctx.reply.text(
          `✂️ *SUIT*\n\n` +
            `Pilih salah satu:\n` +
            `◦ .suit batu\n` +
            `◦ .suit gunting\n` +
            `◦ .suit kertas`
        )
      }

      const options = Object.keys(choices)
      const botPick = randomItem(options)

      // Tentukan pemenang
      let result
      if (userPick === botPick) {
        result = "🤝 *SERI!*"
      } else if (
        (userPick === "batu" && botPick === "gunting") ||
        (userPick === "gunting" && botPick === "kertas") ||
        (userPick === "kertas" && botPick === "batu")
      ) {
        result = "🎉 *KAMU MENANG!*"
      } else {
        result = "😎 *BOT MENANG!*"
      }

      await ctx.reply.text(
        `✂️ *SUIT*\n\n` +
          `Kamu : ${choices[userPick]} ${userPick}\n` +
          `Bot  : ${choices[botPick]} ${botPick}\n\n` +
          `${result}\n\n` +
          `> ${config.watermark}`
      )
    },
  },

  // ─── .tebakangka — mulai game ────────────────────────────
  {
    pattern: /^(tebakangka|tebakanga)$/,
    description: "Mulai game tebak angka 1-100",
    category: "game",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      if (tebakGame.has(ctx.jid)) {
        return ctx.reply.text(
          `🎯 Masih ada game tebak angka yang berjalan!\n` +
            `Tebak dengan: *.tebak <angka>*`
        )
      }

      const answer = Math.floor(Math.random() * 100) + 1
      tebakGame.set(ctx.jid, { answer, attempts: 0 })

      await ctx.reply.text(
        `🎯 *TEBAK ANGKA*\n\n` +
          `Aku sudah memilih angka antara *1 - 100*.\n` +
          `Tebak dengan perintah:\n*.tebak <angka>*\n\n` +
          `Contoh: .tebak 50`
      )
    },
  },

  // ─── .tebak — jawab game ─────────────────────────────────
  {
    pattern: /^(tebak)$/,
    description: "Jawab game tebak angka",
    category: "game",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const game = tebakGame.get(ctx.jid)

      if (!game) {
        return ctx.reply.text(
          `❌ Tidak ada game berjalan.\n` +
            `Mulai dulu dengan *.tebakangka*`
        )
      }

      const guess = parseInt(ctx.args[0])
      if (isNaN(guess) || guess < 1 || guess > 100) {
        return ctx.reply.text(
          `❌ Masukkan angka 1-100.\nContoh: *.tebak 42*`
        )
      }

      game.attempts++

      if (guess === game.answer) {
        tebakGame.delete(ctx.jid)
        return ctx.reply.text(
          `🎉 *BENAR!*\n\n` +
            `Angkanya memang *${game.answer}*.\n` +
            `Kamu berhasil dalam *${game.attempts}* tebakan!\n\n` +
            `> ${config.watermark}`
        )
      }

      const hint = guess < game.answer ? "📈 Lebih *besar*" : "📉 Lebih *kecil*"
      await ctx.reply.text(
        `${hint} dari ${guess}\n` +
          `Percobaan ke-${game.attempts}. Coba lagi: *.tebak <angka>*`
      )
    },
  },

  // ─── .kerang — bola ajaib ────────────────────────────────
  {
    pattern: /^(kerang|kerangajaib|8ball)$/,
    description: "Tanya kerang ajaib",
    category: "fun",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      if (!ctx.query) {
        return ctx.reply.text(
          `🐚 *KERANG AJAIB*\n\n` +
            `Ajukan pertanyaan!\nContoh: *.kerang apakah aku akan kaya?*`
        )
      }

      const answers = [
        "Ya, tentu saja! ✅",
        "Tidak. ❌",
        "Mungkin iya, mungkin tidak. 🤔",
        "Sudah pasti! 💯",
        "Jangan harap. 🙅",
        "Coba tanya lagi nanti. ⏳",
        "Sepertinya begitu. 👍",
        "Aku ragu... 😶",
        "Insya Allah. 🤲",
        "Tidak mungkin! 🚫",
      ]

      await ctx.reply.text(
        `🐚 *KERANG AJAIB*\n\n` +
          `❓ ${ctx.query}\n` +
          `💬 ${randomItem(answers)}\n\n` +
          `> ${config.watermark}`
      )
    },
  },
]
