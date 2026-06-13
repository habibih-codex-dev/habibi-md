// ============================================================
//   HABIBIH BOT - Plugin Runtime
//   Command: .runtime | .uptime
//   Tampilkan uptime bot secara detail
// ============================================================

import { formatUptime, getDate, getDay, getTime } from "../lib/function.js"
import config from "../config.js"
import { getStats } from "../lib/database.js"
import os from "os"

// ─── Helper: Bar Progress ─────────────────────────────────────

const buildBar = (value, max, length = 10) => {
  const filled = Math.round((value / max) * length)
  return "█".repeat(Math.min(filled, length)) + "░".repeat(Math.max(length - filled, 0))
}

// ─── Commands Export ──────────────────────────────────────────

export const commands = [
  {
    pattern: /^(runtime|uptime|rt)$/,
    description: "Tampilkan uptime bot secara detail",
    category: "tools",
    owner: false,
    group: false,
    private: false,
    admin: false,
    botAdmin: false,
    premium: false,

    handler: async (ctx) => {
      const { reply } = ctx

      const uptimeSeconds = Math.floor(process.uptime())
      const uptime = formatUptime(uptimeSeconds)

      // Hitung persentase hari (maks 7 hari dianggap 100%)
      const maxSeconds = 7 * 24 * 3600
      const uptimePercent = Math.min((uptimeSeconds / maxSeconds) * 100, 100).toFixed(1)
      const uptimeBar = buildBar(uptimeSeconds, maxSeconds)

      // Memori
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1)
      const memBar = buildBar(usedMem, totalMem)

      // Stats
      const stats = getStats()
      const now = `${getDay()}, ${getDate()} • ${getTime()} WIB`

      // Waktu terperinci
      const d = Math.floor(uptimeSeconds / (3600 * 24))
      const h = Math.floor((uptimeSeconds % (3600 * 24)) / 3600)
      const m = Math.floor((uptimeSeconds % 3600) / 60)
      const s = uptimeSeconds % 60

      const text = `
╔══════════════════════════╗
║   ⏱️ *RUNTIME ${config.botName}*
╚══════════════════════════╝

🕐 *Waktu Sekarang:*
   ${now}

⏳ *Bot Berjalan Selama:*
   ${d} hari, ${h} jam, ${m} menit, ${s} detik

📊 *Progress Uptime:*
   [${uptimeBar}] ${uptimePercent}%

💾 *Penggunaan RAM:*
   [${memBar}] ${memPercent}%
   ${(usedMem / 1024 / 1024).toFixed(0)} MB / ${(totalMem / 1024 / 1024).toFixed(0)} MB

📈 *Aktivitas:*
   💬 Pesan diproses : ${stats.totalMessages || 0}
   ⚡ Command dijalankan : ${stats.totalCommands || 0}

> ${config.watermark}
      `.trim()

      await reply.text(text)
    },
  },
]
