// ============================================================
//   HABIBIH BOT - Plugin Ping
//   Command: .ping | .speed | .tes | .stats
//   Cek kecepatan respons bot + info server
// ============================================================

import os from "os"
import { formatBytes, formatUptime } from "../lib/function.js"
import { getStats } from "../lib/database.js"
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
    speed: cpus[0]?.speed ? `${cpus[0].speed} MHz` : "Unknown",
  }
}

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  // ─── .ping — cek kecepatan bot ───────────────────────────
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
      const start = Date.now()

      // Kirim pesan awal dulu untuk mengukur latency
      await ctx.sock.sendMessage(
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

      // Progress bar RAM
      const ramBarLength = 10
      const filledBars = Math.round(
        (parseFloat(ram.percent) / 100) * ramBarLength
      )
      const ramBar =
        "█".repeat(filledBars) +
        "░".repeat(ramBarLength - filledBars)

      // Emoji warna berdasarkan latency
      const speedEmoji =
        latency > 1000 ? "🔴" : latency > 500 ? "🟡" : "🟢"

      const text = `
╔══════════════════════════╗
║   🏓 *PING - STATUS BOT*  ║
╚══════════════════════════╝

${speedEmoji} *Kecepatan:* ${latency} ms
⏱️ *Uptime:* ${uptime}

┌─── 💻 *SERVER INFO* ───
│
├ 🖥️  *Platform:* ${platform}
├ ⚙️  *CPU:* ${cpu.model}
├ 🔢 *Core:* ${cpu.cores} core @ ${cpu.speed}
├ 📦 *Node.js:* ${nodeVersion}
│
├ 💾 *RAM Total:* ${ram.total}
├ 📊 *RAM Pakai:* ${ram.used} (${ram.percent}%)
├ 🆓 *RAM Bebas:* ${ram.free}
│    [${ramBar}] ${ram.percent}%
│
└──────────────────────────

> ${config.watermark}`.trim()

      await ctx.reply.text(text)
    },
  },

  // ─── .stats — statistik bot ──────────────────────────────
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
      // Import langsung di atas file, bukan dynamic import
      const stats = getStats()
      const uptime = formatUptime(Math.floor(process.uptime()))

      const startedAt = stats.startedAt
        ? new Date(stats.startedAt).toLocaleString("id-ID", {
            timeZone: config.settings.timezone,
          })
        : "-"

      const text = `
╔══════════════════════════╗
║   📊 *STATISTIK BOT*      ║
╚══════════════════════════╝

├ 💬 *Total Pesan:*   ${stats.totalMessages || 0}
├ ⚡ *Total Command:* ${stats.totalCommands || 0}
├ ⏱️ *Uptime:*        ${uptime}
├ 🕐 *Sejak:*         ${startedAt}

> ${config.watermark}`.trim()

      await ctx.reply.text(text)
    },
  },
]
