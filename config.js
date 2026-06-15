// ============================================================
//   HABIBIH BOT - Configuration File
//   Author  : Habibi Official
//   GitHub  : https://github.com/habibih-codex-dev/habibi-md
// ============================================================

const config = {
  // ─── Identitas Bot ───────────────────────────────────────
  botName: "Habibih Bot",
  botVersion: "1.0.0",

  // ─── Owner ───────────────────────────────────────────────
  ownerName: "Habibi Official",
  ownerNumber: ["6285181576338"],

  // ─── Prefix ──────────────────────────────────────────────
  // Mendukung multi prefix: . ! #
  prefix: /^[.!#]/,
  prefixList: [".", "!", "#"],

  // ─── Link ────────────────────────────────────────────────
  website: "https://habibi-store-digital.vercel.app",
  channelWA: "https://whatsapp.com/channel/0029Vb6SDXJDDmFXx0cHwF3f",
  sourceCode: "https://github.com/habibih-codex-dev/habibi-md",

  // ─── Watermark ───────────────────────────────────────────
  watermark: "© Habibih Bot | Habibi Official",
  footer: "Habibih Bot | https://habibi-store-digital.vercel.app",

  // ─── Session Cookie (opsional — untuk Story IG/FB) ───────
  // DISARANKAN diisi via environment variable, JANGAN commit cookie asli!
  //   IG_COOKIE / IG_SESSIONID  -> cookie login Instagram
  //   FB_COOKIE                 -> cookie login Facebook
  // Cookie juga bisa diatur runtime oleh Owner via:
  //   .setigcookie <cookie> | .setfbcookie <cookie>  (disimpan ke database)
  session: {
    igCookie: process.env.IG_COOKIE || process.env.IG_SESSIONID || "",
    fbCookie: process.env.FB_COOKIE || "",
  },

  // ─── Media Menu ──────────────────────────────────────────
  menu: {
    mediaUrl: "https://files.catbox.moe/1p0ytd.mp4",
    mediaType: "video",   // "image" atau "video"
    useCache: true,       // true = cache lokal di assets/, false = selalu fetch
    cachePath: "./assets/menu.mp4",
  },

  // ─── Thumbnail ───────────────────────────────────────────
  thumbnail: "https://files.catbox.moe/1p0ytd.mp4",

  // ─── Koneksi ─────────────────────────────────────────────
  connection: {
    // "pairing" = Pairing Code | "qr" = QR Code
    method: "pairing",

    // Nomor yang digunakan untuk pairing code (tanpa +)
    phoneNumber: "6285181576338",

    // Nama session (folder di dalam session/)
    sessionName: "habibi-session",

    // Maksimal percobaan reconnect
    maxReconnectAttempts: 10,

    // Jeda antar reconnect (ms)
    reconnectDelay: 3000,

    // Print QR di terminal (hanya berlaku saat method: "qr")
    printQRInTerminal: true,
  },

  // ─── Pengaturan Bot ──────────────────────────────────────
  settings: {
    // Di mana bot bisa digunakan: "group" | "private" | "both"
    botMode: "both",

    // Auto read pesan masuk
    autoRead: true,

    // Auto typing saat memproses pesan
    autoTyping: true,

    // Auto recording saat memproses voice note
    autoRecording: false,

    // Self mode: hanya merespons pesan dari owner
    selfMode: false,

    // Bahasa bot
    language: "id",

    // Timezone
    timezone: "Asia/Jakarta",

    // Interval backup database (jam)
    backupInterval: 6,

    // Maksimal ukuran file yang diterima (MB)
    maxFileSize: 100,
  },

  // ─── Native Flow / Button ────────────────────────────────
  button: {
    // Native flow dimatikan — pakai tampilan teks rapi (lebih stabil)
    useNativeFlow: false,

    // Warna button (hex, khusus native flow)
    color: "#128C7E",
  },

  // ─── Logger ──────────────────────────────────────────────
  logger: {
    // "info" | "debug" | "warn" | "error" | "silent"
    level: "info",

    // Tampilkan log dengan warna (pino-pretty)
    pretty: true,
  },

  // ─── Pesan Otomatis ──────────────────────────────────────
  msg: {
    owner:    "❌ Perintah ini khusus Owner bot.",
    group:    "❌ Perintah ini hanya bisa digunakan di Grup.",
    private:  "❌ Perintah ini hanya bisa digunakan di Chat Pribadi.",
    admin:    "❌ Perintah ini hanya untuk Admin Grup.",
    botAdmin: "❌ Jadikan bot sebagai Admin terlebih dahulu.",
    premium:  "❌ Fitur ini hanya untuk pengguna Premium.",
    wait:     "⏳ Sedang diproses...",
    success:  "✅ Berhasil.",
    error:    "⚠️ Terjadi kesalahan saat menjalankan perintah.",
    invalid:  "❌ Format perintah salah.",
    noQuery:  "❌ Masukkan teks atau lampiran terlebih dahulu.",
    notFound: "❌ Data tidak ditemukan.",
    banned:   "❌ Kamu telah dibanned dari menggunakan bot ini.",
  },

  // ─── Emoji Dekorasi Menu ─────────────────────────────────
  emoji: {
    dot:    "•",
    arrow:  "➤",
    star:   "★",
    line:   "─",
    corner: "╔",
    check:  "✅",
    cross:  "❌",
    warn:   "⚠️",
    info:   "ℹ️",
    fire:   "🔥",
    crown:  "👑",
    bolt:   "⚡",
    clock:  "🕐",
  },
}

export default config
