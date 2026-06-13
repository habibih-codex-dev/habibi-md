# 🤖 Habibih Bot — WhatsApp Multi Device Bot

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![Baileys](https://img.shields.io/badge/baileys-7.0.0--rc13-orange)
![License](https://img.shields.io/badge/license-MIT-yellow)

**Bot WhatsApp Multi Device premium berbasis [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)**

👑 **Author:** Habibi Official
🌐 **Website:** [habibi-store-digital.vercel.app](https://habibi-store-digital.vercel.app)
📢 **Saluran WA:** [Klik di sini](https://whatsapp.com/channel/0029Vb6SDXJDDmFXx0cHwF3f)

</div>

---

## ✨ Fitur Base

- ✅ **Pairing Code** & **QR Code** (bisa diatur di `config.js`)
- ✅ **Auto Reconnect** dengan batas percobaan
- ✅ **LID + JID Support** — Admin grup tidak bug di WA terbaru
- ✅ **Plugin System** — Tambah fitur tanpa ubah core
- ✅ **Permission System** — Owner, Admin, BotAdmin, Group, Private, Premium
- ✅ **Database JSON** — Auto backup terjadwal
- ✅ **Native Flow Button** + fallback teks otomatis
- ✅ **Auto Read** & **Auto Typing**
- ✅ **Media Menu** dengan sistem cache lokal
- ✅ **Error Handling** lengkap — bot tidak crash
- ✅ **Logging** berwarna dengan pino-pretty

---

## 📋 Persyaratan

- **Node.js** v20.0.0 atau lebih baru
- **NPM** v9+
- Koneksi internet stabil

---

## 🚀 Cara Install

### 1. Clone repository

```bash
git clone https://github.com/habibih-codex-dev/habibi-md.git
cd habibi-md
```

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi bot

Edit file `config.js` sesuai kebutuhan:

```js
// Ganti nomor owner
ownerNumber: ["6285181576338"],

// Pilih metode koneksi: "pairing" atau "qr"
connection: {
  method: "pairing",
  phoneNumber: "6285181576338",
}
```

### 4. Jalankan bot

```bash
npm start
```

---

## 🔑 Metode Koneksi

### Pairing Code (Default)
```
Bot akan menampilkan kode 8 digit di terminal.
Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon
Masukkan kode yang muncul di terminal.
```

### QR Code
```js
// Di config.js, ubah:
connection: {
  method: "qr",
}
```
Scan QR yang muncul di terminal menggunakan WhatsApp.

---

## 📁 Struktur File

```
habibi-md/
├── index.js              ← Entry point utama
├── config.js             ← Semua konfigurasi bot
├── handler.js            ← Router pesan & permission
├── package.json
├── lib/
│   ├── connect.js        ← Koneksi Baileys
│   ├── database.js       ← CRUD database JSON
│   ├── function.js       ← Helper functions
│   └── logger.js         ← Logging system
├── plugins/
│   ├── menu.js           ← Command .menu
│   ├── ping.js           ← Command .ping & .stats
│   └── runtime.js        ← Command .runtime
├── database/
│   ├── db.json           ← Database utama
│   └── backups/          ← Auto backup
├── assets/               ← Cache media menu
└── session/              ← Session WhatsApp
```

---

## 🧩 Cara Tambah Plugin

Buat file baru di folder `plugins/`, contoh `plugins/halo.js`:

```js
export const commands = [
  {
    pattern: "halo",           // Command: .halo
    description: "Ucapan halo",
    category: "tools",
    owner: false,              // Khusus owner?
    group: false,              // Hanya di grup?
    private: false,            // Hanya di private?
    admin: false,              // Hanya admin?
    botAdmin: false,           // Bot harus admin?
    premium: false,            // Khusus premium?

    handler: async (ctx) => {
      await ctx.reply.text(`Halo, ${ctx.pushName}! 👋`)
    },
  },
]
```

Restart bot, plugin otomatis ter-load.

---

## ⚙️ Konfigurasi config.js

| Key | Keterangan |
|-----|-----------|
| `botName` | Nama bot |
| `ownerNumber` | Array nomor owner (tanpa +) |
| `prefix` | Regex prefix (default: `.`, `!`, `#`) |
| `connection.method` | `"pairing"` atau `"qr"` |
| `settings.botMode` | `"group"`, `"private"`, atau `"both"` |
| `settings.autoRead` | Auto read pesan masuk |
| `settings.autoTyping` | Auto typing saat proses command |
| `settings.selfMode` | Hanya respons pesan sendiri |
| `menu.mediaUrl` | URL video/gambar menu |
| `menu.useCache` | Cache media lokal |

---

## 📜 Prefix yang Didukung

| Prefix | Contoh |
|--------|--------|
| `.` | `.menu` |
| `!` | `!ping` |
| `#` | `#runtime` |

---

## 🔒 Permission System

| Level | Keterangan |
|-------|-----------|
| `owner` | Hanya owner bot |
| `admin` | Admin grup |
| `botAdmin` | Bot harus jadi admin grup |
| `group` | Hanya di grup |
| `private` | Hanya di chat pribadi |
| `premium` | Pengguna premium |

---

## 📞 Kontak & Support

- 🌐 Website: [habibi-store-digital.vercel.app](https://habibi-store-digital.vercel.app)
- 📢 Saluran WhatsApp: [Klik di sini](https://whatsapp.com/channel/0029Vb6SDXJDDmFXx0cHwF3f)

---

<div align="center">
Made with ❤️ by <b>Habibi Official</b>
</div>
