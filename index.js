// ============================================================
//   HABIBIH BOT - Entry Point
//   Author  : Habibi Official
//   GitHub  : https://github.com/habibih-codex-dev/habibi-md
//   Website : https://habibi-store-digital.vercel.app
// ============================================================

import chalk from "chalk"
import figlet from "figlet"
import { promisify } from "util"

import config from "./config.js"
import connect, { getSocket } from "./lib/connect.js"
import handler, { loadPlugins } from "./handler.js"
import { logError, logLine, logSystem } from "./lib/logger.js"
import { ensureDir, formatUptime } from "./lib/function.js"
import { backupDB, getStats, loadDB, saveDB } from "./lib/database.js"
import { startAutoSholat } from "./lib/autosholat.js"

const figletAsync = promisify(figlet)

// ─── Banner ASCII ─────────────────────────────────────────────

const printBanner = async () => {
  try {
    const banner = await figletAsync("Habibih  Bot", {
      font: "Standard",
      horizontalLayout: "default",
    })
    console.log(chalk.cyan(banner))
  } catch {
    console.log(chalk.cyan("\n  ╔══════════════════════════╗"))
    console.log(chalk.cyan("  ║      HABIBIH BOT         ║"))
    console.log(chalk.cyan("  ╚══════════════════════════╝\n"))
  }

  logLine()
  console.log(chalk.green("  🤖 Bot     : ") + chalk.white(config.botName))
  console.log(chalk.green("  👑 Owner   : ") + chalk.white(config.ownerName))
  console.log(chalk.green("  📦 Versi   : ") + chalk.white(config.botVersion))
  console.log(chalk.green("  🔌 Metode  : ") + chalk.white(config.connection.method.toUpperCase()))
  console.log(chalk.green("  🌐 Website : ") + chalk.white(config.website))
  logLine()
}

// ─── Inisialisasi Direktori ───────────────────────────────────

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
  dirs.forEach(ensureDir)
  logSystem("Direktori berhasil diinisialisasi")
}

// ─── Inisialisasi Database ────────────────────────────────────

const initDatabase = () => {
  const db = loadDB()

  // Set startedAt jika belum ada
  if (!db.stats) db.stats = {}
  if (!db.stats.startedAt) {
    db.stats.startedAt = new Date().toISOString()
    db.stats.totalMessages = db.stats.totalMessages || 0
    db.stats.totalCommands = db.stats.totalCommands || 0
    saveDB(db)
    logSystem("Database diinisialisasi")
  }
}

// ─── Auto Backup ──────────────────────────────────────────────

const startAutoBackup = () => {
  const intervalMs = (config.settings.backupInterval || 6) * 60 * 60 * 1000
  setInterval(() => {
    logSystem("Menjalankan auto backup database...")
    backupDB()
  }, intervalMs)
  logSystem(
    `Auto backup aktif setiap ${config.settings.backupInterval} jam`
  )
}

// ─── Global Error Handlers ────────────────────────────────────

const setupErrorHandlers = () => {
  process.on("uncaughtException", (err) => {
    logError("UNCAUGHT EXCEPTION — Bot tetap berjalan", err)
  })

  process.on("unhandledRejection", (reason) => {
    logError("UNHANDLED REJECTION — Bot tetap berjalan", {
      reason: String(reason),
    })
  })

  process.on("SIGINT", () => {
    logLine()
    logSystem("Bot dihentikan (SIGINT)")
    logSystem(`Uptime: ${formatUptime(Math.floor(process.uptime()))}`)
    const stats = getStats()
    logSystem(`Pesan diproses: ${stats.totalMessages || 0}`)
    logSystem(`Command dijalankan: ${stats.totalCommands || 0}`)
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

// ─── Main ─────────────────────────────────────────────────────

const start = async () => {
  // 1. Tampilkan banner
  await printBanner()

  // 2. Pasang global error handlers
  setupErrorHandlers()

  // 3. Buat semua direktori
  initDirectories()

  // 4. Init database
  initDatabase()

  // 5. Load semua plugin
  logSystem("Memuat plugin...")
  await loadPlugins()

  // 6. Mulai auto backup
  startAutoBackup()

  // 7. Mulai scheduler autosholat
  startAutoSholat(getSocket)

  // 8. Koneksi ke WhatsApp
  logSystem(
    `Menghubungkan ke WhatsApp (metode: ${config.connection.method.toUpperCase()})...`
  )
  await connect(handler)
}

start().catch((err) => {
  logError("FATAL ERROR saat startup", err)
  process.exit(1)
})
