// ============================================================
//   HABIBIH BOT - Logger System
//   Menggunakan pino + pino-pretty untuk logging berwarna
// ============================================================

import pino from "pino"
import config from "../config.js"

const transport = config.logger.pretty
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:dd-mm-yyyy HH:MM:ss",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
        levelFirst: true,
      },
    })
  : undefined

const logger = pino(
  {
    level: config.logger.level || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
)

// ─── Custom log helpers ──────────────────────────────────────

/**
 * Log info berwarna hijau
 */
export const logInfo = (msg, data = {}) => {
  logger.info(data, `✅ ${msg}`)
}

/**
 * Log peringatan berwarna kuning
 */
export const logWarn = (msg, data = {}) => {
  logger.warn(data, `⚠️  ${msg}`)
}

/**
 * Log error berwarna merah
 */
export const logError = (msg, err = {}) => {
  logger.error(err, `❌ ${msg}`)
}

/**
 * Log debug (hanya tampil saat level = debug)
 */
export const logDebug = (msg, data = {}) => {
  logger.debug(data, `🔍 ${msg}`)
}

/**
 * Log koneksi WhatsApp
 */
export const logConn = (msg, data = {}) => {
  logger.info(data, `🔗 ${msg}`)
}

/**
 * Log pesan masuk
 */
export const logMsg = (from, cmd) => {
  logger.info(`💬 [MSG] ${from} → ${cmd}`)
}

/**
 * Log sistem (startup, shutdown, dll)
 */
export const logSystem = (msg) => {
  logger.info(`⚙️  [SYSTEM] ${msg}`)
}

/**
 * Separator garis untuk terminal
 */
export const logLine = () => {
  console.log("─".repeat(55))
}

export default logger
