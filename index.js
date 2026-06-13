// ============================================================
//   HABIBIH BOT - Entry Point
//   Author  : Habibi Official
//   GitHub  : https://github.com/habibih-codex-dev/habibi-md
//   Website : https://habibi-store-digital.vercel.app
// ============================================================

import chalk from "chalk"
import figlet from "figlet"
import { promisify } from "util"
import fs from "fs"
import path from "path"

import config from "./config.js"
import connect from "./lib/connect.js"
import handler, { loadPlugins } from "./handler.js"
import { logError, logInfo, logLine, logSystem, logWarn } from "./lib/logger.js"
import { ensureDir, formatUptime } from "./lib/function.js"
import { backupDB, getStats, updateSettings } from "./lib/database.js"

const figletAsync = promisify(figlet)

// ─── Banner ───────────────────────────────────────────────────

const printBanner = async () => {
  try {
    const banner = await figletAsync("Habibih Bot", {
      font: "Standard",
      horizontalLayout: "default",
    })
    console.log(chalk.cyan(banner))
  } catch {
    console.log(chalk.cyan("╔══════════════════════════╗"))
    console.log(chalk.cyan("║      HABIBIH BOT         ║"))
    console.log(chalk.cyan("╚══════════════════════════╝"))
  }

  logLine()
  console.log(chalk.green("  🤖 Bot    : ") + chalk.white(config.botName))
  console.log(chalk.green("  👑 Owner  : ") + chalk.white(config.ownerName))
  console.log(chalk.green("  📦 Versi  : ") + chalk.white(config.botVersion))
  console.log(chalk.green("  🌐 Web    : ") + chalk.white(config.website))
  console.log(chalk.green("  📢 Saluran: ") + chalk.white(config.channelWA))
  logLine()
}

// ─── Pastikan Direktori Penting Ada ───────────────────────────

const initDirectories = () => {
  const dirs = [
    "./session",
    `./session/${config.connection.sessionName}`,
    "./database",
    "./database/backups",
    "./assets",
    "./plugins",
    "./logs",
  ]
  dirs.forEach((dir) => ensureDir(dir))
  logSystem("Direktori berhasil diinisialisasi")
}

// ─── Auto Backup Database ─────────────────────────────────────

const startAutoBackup = () => {
  const intervalMs = (config.settings.backupInterval || 6) * 60 * 60 * 1000
  setInterval(() => {
    logSystem("Menjalankan auto backup database...")
    backupDB()
  }, intervalMs)
  logSystem(`Auto backup aktif setiap ${config.settings.backupInterval} jam`)
}

// ─── Global Error Handler ─────────────────────────────────────

const setupGlobalErrorHandlers = () => {
  process.on("uncaughtException", (err) => {
    logError("UNCAUGHT EXCEPTION — Bot tetap berjalan", err)
  })

  process.on("unhandledRejection", (reason) => {
    logError("UNHANDLED REJECTION — Bot tetap berjalan", { reason: String(reason) })
  })

  process.on("SIGINT", () => {
    logLine()
    logSystem("Bot dihentikan oleh user (SIGINT)")
    logSystem(`Uptime terakhir: ${formatUptime(Math.floor(process.uptime()))}`)
    const stats = getStats()
    logSystem(`Total pesan diproses: ${stats.totalMessages || 0}`)
    logSystem(`Total command dijalankan: ${stats.totalCommands || 0}`)
    logLine()
    backupDB()
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    logSystem("Bot dihentikan (SIGTERM)")
    backupDB()
    process.exit(0)
  })
}

// ─── Main Boot Function ───────────────────────────────────────

const start = async () => {
  // 1. Tampilkan banner
  await printBanner()

  // 2. Setup global error handlers
  setupGlobalErrorHandlers()

  // 3. Inisialisasi direktori
  initDirectories()

  // 4. Load semua plugin
  logSystem("Memuat plugin...")
  await loadPlugins()

  // 5. Set waktu mulai di database stats
  const db = (await import("./lib/database.js")).getDB()
  if (!db.stats?.startedAt) {
    updateSettings({}) // trigger load
    const { loadDB, saveDB } = await import("./lib/database.js")
    const d = loadDB()
    if (!d.stats) d.stats = {}
    d.stats.startedAt = new Date().toISOString()
    saveDB(d)
  }

  // 6. Start auto backup
  startAutoBackup()

  // 7. Koneksi ke WhatsApp
  logSystem(`Metode koneksi: ${config.connection.method.toUpperCase()}`)
  await connect(handler)
}

// ─── Jalankan ─────────────────────────────────────────────────

start().catch((err) => {
  logError("FATAL ERROR saat startup", err)
  process.exit(1)
})
