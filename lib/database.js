// ============================================================
//   HABIBIH BOT - Database Manager (JSON)
//   CRUD untuk users, groups, chats, premium, banned, settings
// ============================================================

import fs from "fs"
import path from "path"
import { logError, logInfo, logWarn } from "./logger.js"

const DB_PATH = path.resolve("./database/db.json")
const BACKUP_DIR = path.resolve("./database/backups")

// ─── Load & Save ─────────────────────────────────────────────

/**
 * Baca database dari file JSON
 */
export const loadDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const defaultDB = {
        users: {},
        groups: {},
        chats: {},
        premium: {},
        banned: {},
        settings: {
          autoRead: true,
          autoTyping: true,
          selfMode: false,
          botMode: "both",
        },
        stats: {
          totalMessages: 0,
          totalCommands: 0,
          startedAt: new Date().toISOString(),
        },
      }
      saveDB(defaultDB)
      return defaultDB
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8")
    const parsed = JSON.parse(raw)

    // Migrasi: pastikan semua section utama selalu ada
    // (mencegah crash pada database lama yang belum punya section baru)
    if (!parsed.users) parsed.users = {}
    if (!parsed.groups) parsed.groups = {}
    if (!parsed.chats) parsed.chats = {}
    if (!parsed.premium) parsed.premium = {}
    if (!parsed.banned) parsed.banned = {}
    if (!parsed.settings) parsed.settings = {}
    if (!parsed.stats) parsed.stats = {}

    return parsed
  } catch (err) {
    logError("Gagal membaca database", err)
    // Kembalikan struktur kosong yang aman
    return {
      users: {},
      groups: {},
      chats: {},
      premium: {},
      banned: {},
      settings: {},
      stats: {},
    }
  }
}

/**
 * Simpan database ke file JSON
 * @param {Object} data
 */
export const saveDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8")
  } catch (err) {
    logError("Gagal menyimpan database", err)
  }
}

/**
 * Ambil database — instance tunggal yang selalu fresh
 */
let _db = null
export const getDB = () => {
  _db = loadDB()
  return _db
}

// ─── User ─────────────────────────────────────────────────────

/**
 * Dapatkan data user, buat jika belum ada
 * @param {string} jid
 */
export const getUser = (jid) => {
  const db = getDB()
  if (!db.users) db.users = {}
  const id = jid.split("@")[0]
  if (!db.users[id]) {
    db.users[id] = {
      jid,
      name: "",
      banned: false,
      premium: false,
      premiumExpired: null,
      limit: 25,
      totalMessages: 0,
      joinedAt: new Date().toISOString(),
    }
    saveDB(db)
  }
  return db.users[id]
}

/**
 * Update data user
 * @param {string} jid
 * @param {Object} data
 */
export const updateUser = (jid, data) => {
  const db = getDB()
  if (!db.users) db.users = {}
  const id = jid.split("@")[0]
  db.users[id] = { ...getUser(jid), ...data }
  saveDB(db)
  return db.users[id]
}

// ─── Group ────────────────────────────────────────────────────

/**
 * Dapatkan data grup, buat jika belum ada
 * @param {string} jid
 */
export const getGroup = (jid) => {
  const db = getDB()
  if (!db.groups) db.groups = {}
  const id = jid.split("@")[0]
  if (!db.groups[id]) {
    db.groups[id] = {
      jid,
      name: "",

      // Sambutan
      welcome: false,
      goodbye: false,
      welcomeText: null, // teks custom; null = default
      goodbyeText: null,
      welcomeImage: null, // url gambar custom; null = tanpa gambar
      goodbyeImage: null,

      // Anti-link (delete)
      antilink: false, // semua link → hapus
      antilinkv2: false, // semua link → hapus + kick
      antilinkwa: false, // link grup WA
      antilinkch: false, // link channel/saluran WA
      antilinktt: false, // TikTok
      antilinkyt: false, // YouTube
      antilinkig: false, // Instagram
      antilinktg: false, // Telegram

      // Proteksi lain
      antibot: false,
      antitoxic: false,
      antiforeign: false, // nomor luar negeri
      antispam: false,
      antitag: false, // anti tag massal
      antidelete: false, // lacak pesan dihapus
      antivirtex: false, // pesan super panjang
      antimedia: false, // blokir foto/video

      // Pengaturan
      onlyadmin: false, // hanya admin bisa kirim
      mute: false,

      joinedAt: new Date().toISOString(),
    }
    saveDB(db)
  } else {
    // Migrasi: lengkapi field baru pada grup lama
    const defaults = {
      welcomeText: null, goodbyeText: null,
      welcomeImage: null, goodbyeImage: null,
      antilink: false, antilinkv2: false, antilinkwa: false,
      antilinkch: false, antilinktt: false, antilinkyt: false,
      antilinkig: false, antilinktg: false,
      antibot: false, antitoxic: false, antiforeign: false,
      antispam: false, antitag: false, antidelete: false,
      antivirtex: false, antimedia: false,
      onlyadmin: false, mute: false,
    }
    let changed = false
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in db.groups[id])) {
        db.groups[id][k] = v
        changed = true
      }
    }
    if (changed) saveDB(db)
  }
  return db.groups[id]
}

/**
 * Update data grup
 * @param {string} jid
 * @param {Object} data
 */
export const updateGroup = (jid, data) => {
  const db = getDB()
  if (!db.groups) db.groups = {}
  const id = jid.split("@")[0]
  db.groups[id] = { ...getGroup(jid), ...data }
  saveDB(db)
  return db.groups[id]
}

// ─── Chat (kota & autosholat per chat) ───────────────────────

/**
 * Dapatkan data chat (grup/private), buat jika belum ada
 * @param {string} jid
 */
export const getChat = (jid) => {
  const db = getDB()
  if (!db.chats) db.chats = {}
  const id = jid.split("@")[0]
  if (!db.chats[id]) {
    db.chats[id] = {
      jid,
      city: null, // null = pakai kota default config
      country: "Indonesia",
      autosholat: false,
      lastReminder: null, // cegah pengingat dobel
    }
    saveDB(db)
  }
  return db.chats[id]
}

/**
 * Update data chat
 * @param {string} jid
 * @param {Object} data
 */
export const updateChat = (jid, data) => {
  const db = getDB()
  if (!db.chats) db.chats = {}
  const id = jid.split("@")[0]
  db.chats[id] = { ...getChat(jid), ...data }
  saveDB(db)
  return db.chats[id]
}

/**
 * Semua chat yang mengaktifkan autosholat
 */
export const getAutoSholatChats = () => {
  const db = getDB()
  if (!db.chats) return []
  return Object.values(db.chats).filter((c) => c.autosholat)
}

// ─── Premium ──────────────────────────────────────────────────

/**
 * Cek apakah user adalah premium (dan belum expired)
 * @param {string} jid
 */
export const isPremium = (jid) => {
  const db = getDB()
  if (!db.premium) db.premium = {}
  const id = jid.split("@")[0]
  const user = db.premium[id]
  if (!user) return false
  if (user.expired === "lifetime") return true
  if (new Date(user.expired) > new Date()) return true
  // Expired, hapus dari list
  delete db.premium[id]
  saveDB(db)
  return false
}

/**
 * Tambah user premium
 * @param {string} jid
 * @param {string|Date} expired - "lifetime" atau tanggal expired
 * @param {string} addedBy - JID yang menambahkan
 */
export const addPremium = (jid, expired = "lifetime", addedBy = "") => {
  const db = getDB()
  if (!db.premium) db.premium = {}
  const id = jid.split("@")[0]
  db.premium[id] = {
    jid,
    expired,
    addedBy,
    addedAt: new Date().toISOString(),
  }
  saveDB(db)
  logInfo(`Premium ditambahkan: ${id} | Expired: ${expired}`)
}

/**
 * Hapus user premium
 * @param {string} jid
 */
export const removePremium = (jid) => {
  const db = getDB()
  if (!db.premium) db.premium = {}
  const id = jid.split("@")[0]
  if (db.premium[id]) {
    delete db.premium[id]
    saveDB(db)
    logInfo(`Premium dihapus: ${id}`)
    return true
  }
  return false
}

/**
 * Daftar semua user premium
 */
export const listPremium = () => {
  const db = getDB()
  if (!db.premium) return []
  return Object.values(db.premium)
}

// ─── Banned ───────────────────────────────────────────────────

/**
 * Cek apakah user dibanned
 * @param {string} jid
 */
export const isBanned = (jid) => {
  const db = getDB()
  if (!db.banned) db.banned = {}
  const id = jid.split("@")[0]
  return !!db.banned[id]
}

/**
 * Ban user
 * @param {string} jid
 * @param {string} reason
 * @param {string} bannedBy
 */
export const banUser = (jid, reason = "Tidak ada alasan", bannedBy = "") => {
  const db = getDB()
  if (!db.banned) db.banned = {}
  const id = jid.split("@")[0]
  db.banned[id] = {
    jid,
    reason,
    bannedBy,
    bannedAt: new Date().toISOString(),
  }
  saveDB(db)
  logWarn(`User dibanned: ${id} | Alasan: ${reason}`)
}

/**
 * Unban user
 * @param {string} jid
 */
export const unbanUser = (jid) => {
  const db = getDB()
  if (!db.banned) db.banned = {}
  const id = jid.split("@")[0]
  if (db.banned[id]) {
    delete db.banned[id]
    saveDB(db)
    logInfo(`User di-unban: ${id}`)
    return true
  }
  return false
}

// ─── Settings ─────────────────────────────────────────────────

/**
 * Dapatkan settings bot dari database
 */
export const getSettings = () => {
  const db = getDB()
  return db.settings || {}
}

/**
 * Update settings bot
 * @param {Object} data
 */
export const updateSettings = (data) => {
  const db = getDB()
  db.settings = { ...db.settings, ...data }
  saveDB(db)
  return db.settings
}

// ─── Stats ────────────────────────────────────────────────────

/**
 * Tambah total pesan
 */
export const incrementMessages = () => {
  const db = getDB()
  if (!db.stats) db.stats = { totalMessages: 0, totalCommands: 0 }
  db.stats.totalMessages = (db.stats.totalMessages || 0) + 1
  saveDB(db)
}

/**
 * Tambah total command
 */
export const incrementCommands = () => {
  const db = getDB()
  if (!db.stats) db.stats = { totalMessages: 0, totalCommands: 0 }
  db.stats.totalCommands = (db.stats.totalCommands || 0) + 1
  saveDB(db)
}

/**
 * Dapatkan statistik bot
 */
export const getStats = () => {
  const db = getDB()
  return db.stats || {}
}

// ─── Backup ───────────────────────────────────────────────────

/**
 * Backup database ke folder backups/
 */
export const backupDB = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupPath = path.join(BACKUP_DIR, `db-backup-${timestamp}.json`)
    const raw = fs.readFileSync(DB_PATH, "utf-8")
    fs.writeFileSync(backupPath, raw)

    // Hapus backup lama (simpan 10 terbaru saja)
    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("db-backup-"))
      .sort()
    if (backups.length > 10) {
      const toDelete = backups.slice(0, backups.length - 10)
      toDelete.forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)))
    }

    logInfo(`Database di-backup ke: ${backupPath}`)
    return backupPath
  } catch (err) {
    logError("Gagal backup database", err)
    return null
  }
}
