// ============================================================
//   HABIBIH BOT - Plugin Ping
//   Command: .ping | .speed | .tes
//   Cek kecepatan respons bot + info server
// ============================================================

import os from "os"
import { formatBytes, formatUptime } from "../lib/function.js"
import config from "../config.js"

// ─── Helper: Info RAM ─────────────────────────────────────────

const getRamInfo = () => {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  const usedPercent = ((used / total) * 100).toFixed(1)
  return {
    total: formatBytes(total),
    used: formatBytes(used),
    free: formatBytes(free),
    percent: usedPercent,
  }
}

// ─── Helper: Info CPU ─────────────────────────────────────────

const getCpuInfo = () => {
  const cpus = os.cpus()
  return {
    model: cpus[0]?.model?.trim() || "Unknown",
    cores: cpus.length,
    speed: `${cpus[0]?.speed || 0} MHz`,
  }
}

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  {
    pattern: /^(ping|speed|tes|test)$/,
    description: "Cek kecepatan dan status bot",
    category: "tools",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const { reply } = ctx

      // Hitung waktu respons
      const start = Date.now()

      // Kirim pesan awal
      const sentMsg = await ctx.sock.sendMessage(
        ctx.jid,
        { text: "🏓 *Pong!*\n⏳ Mengukur kecepatan..." },
        { quoted: ctx.msg }
      )

      const latency = Date.now() - start
      const ram = getRamInfo()
      const cpu = getCpuInfo()
      const uptime = formatUptime(Math.floor(process.uptime()))
      const platform = os.platform()
      const nodeVersion = process.version

      // Bar progress RAM
      const ramBarLength = 10
      const filledBars = Math.round((parseFloat(ram.percent) / 100) * ramBarLength)
      const ramBar = "█".repeat(filledBars) + "░".repeat(ramBarLength - filledBars)

      // Tentukan emoji kecepatan
      let speedEmoji = "🟢"
      if (latency > 1000) speedEmoji = "🔴"
      else if (latency > 500) speedEmoji = "🟡"

      const text = `
╔══════════════════════════╗
║   🏓 *PING - STATUS BOT*  ║
╚══════════════════════════╝

${speedEmoji} *Kecepatan:* ${latency} ms
⏱️ *Uptime:* ${uptime}

┌─── 💻 *SERVER INFO* ───
│
├ 🖥️ *Platform:* ${platform}
├ ⚙️  *CPU:* ${cpu.model}
├ 🔢 *Core:* ${cpu.cores} core @ ${cpu.speed}
├ 📦 *Node.js:* ${nodeVersion}
│
├ 💾 *RAM Total:* ${ram.total}
├ 📊 *RAM Terpakai:* ${ram.used} (${ram.percent}%)
├ 🆓 *RAM Bebas:* ${ram.free}
│ [${ramBar}] ${ram.percent}%
│
└──────────────────────────

> ${config.watermark}
      `.trim()

      // Edit pesan yang sudah dikirim dengan hasil aktual
      await ctx.sock.sendMessage(
        ctx.jid,
        { text },
        { quoted: ctx.msg }
      )
    },
  },

  // ─── .stats — statistik penggunaan bot ───────────────────
  {
    pattern: "stats",
    description: "Statistik penggunaan bot",
    category: "tools",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const { reply } = ctx
      const { getStats } = await import("../lib/database.js")
      const stats = getStats()
      const uptime = formatUptime(Math.floor(process.uptime()))

      const text = `
╔══════════════════════════╗
║   📊 *STATISTIK BOT*      ║
╚══════════════════════════╝

├ 💬 *Total Pesan:* ${stats.totalMessages || 0}
├ ⚡ *Total Command:* ${stats.totalCommands || 0}
├ ⏱️ *Uptime:* ${uptime}
├ 🕐 *Mulai Sejak:* ${stats.startedAt ? new Date(stats.startedAt).toLocaleString("id-ID") : "-"}

> ${config.watermark}
      `.trim()

      await reply.text(text)
    },
  },
]
