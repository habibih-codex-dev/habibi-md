// ============================================================
//   HABIBIH BOT - Downloader (Aggregator)
//   Titik masuk tunggal untuk seluruh engine downloader.
//   Arsitektur modular & ter-decouple di lib/scrapers/* :
//   tiap platform punya fallback chain sendiri, sehingga error
//   di satu platform TIDAK mematikan platform lain.
//
//   Catatan kompatibilitas: file ini sengaja mempertahankan nama
//   ekspor lama agar plugin & lib/music.js tetap berjalan tanpa
//   perlu diubah import-nya.
// ============================================================

// ─── Util & core (re-export) ─────────────────────────────────
export {
  httpClient,
  UA,
  extractUrls,
  isValidUrl,
  decodeEntities,
  jsonUnescape,
  parseYoutubeId,
  formatDuration,
  streamToBuffer,
  detectMediaType,
  tryProviders,
  cobaltDownload,
} from "./scrapers/core.js"

// ─── Engine per platform (re-export) ─────────────────────────
import {
  httpClient,
  UA,
  extractUrls,
  isValidUrl,
  decodeEntities,
  parseYoutubeId,
  formatDuration,
  detectMediaType,
} from "./scrapers/core.js"
import { ytsearch, ytmp3, ytmp4, play } from "./scrapers/youtube.js"
import { tiktok, tiktokMp3 } from "./scrapers/tiktok.js"
import { spotify } from "./scrapers/spotify.js"
import { threads } from "./scrapers/threads.js"
import {
  instagram,
  facebook,
  twitter,
  pinterest,
  capcut,
  snackvideo,
  soundcloud,
  igStory,
  fbStory,
} from "./scrapers/social.js"
import {
  gdrive,
  mediafire,
  terabox,
  sfile,
  mega,
} from "./scrapers/files.js"

export {
  // youtube
  ytsearch,
  ytmp3,
  ytmp4,
  play,
  // tiktok
  tiktok,
  tiktokMp3,
  // spotify & threads
  spotify,
  threads,
  // social
  instagram,
  facebook,
  twitter,
  pinterest,
  capcut,
  snackvideo,
  soundcloud,
  igStory,
  fbStory,
  // files
  gdrive,
  mediafire,
  terabox,
  sfile,
  mega,
}

// ─── Default export (objek engine lengkap) ───────────────────
export default {
  // util
  extractUrls,
  isValidUrl,
  parseYoutubeId,
  formatDuration,
  detectMediaType,
  decodeEntities,
  // youtube
  ytsearch,
  ytmp3,
  ytmp4,
  play,
  // tiktok
  tiktok,
  tiktokMp3,
  // spotify & threads
  spotify,
  threads,
  // social
  instagram,
  facebook,
  twitter,
  pinterest,
  capcut,
  snackvideo,
  soundcloud,
  igStory,
  fbStory,
  // files
  gdrive,
  mediafire,
  terabox,
  sfile,
  mega,
}
