// ============================================================
//   HABIBIH BOT - Music & Audio Engine
//   Mesin untuk fitur musik & audio (KEYLESS / tanpa API key)
//
//   - Lirik lagu        : lrclib.net (publik, keyless)
//   - Kunci gitar (chord): scraper Ultimate-Guitar (js-store)
//   - Ringtone          : cari & unduh audio singkat dari YouTube
//   - Shazam/cari lagu  : node-shazam (fingerprint, butuh ffmpeg)
// ============================================================

import fs from "fs"
import os from "os"
import path from "path"
import { httpClient as http, UA, play, ytsearch, decodeEntities } from "./downloader.js"
import { randomString } from "./function.js"
import { logError, logWarn } from "./logger.js"

// ─── Lirik (lrclib.net) ──────────────────────────────────────

/**
 * Cari lirik lagu via lrclib.net (publik, keyless).
 * @param {string} query - judul lagu (boleh "judul - artis")
 * @returns {Promise<{ title:string, artist:string, album:string, lyrics:string, synced:boolean }>}
 */
export const lyrics = async (query) => {
  const q = String(query || "").trim()
  if (!q) throw new Error("Masukkan judul lagu.")

  const res = await http.get(
    `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA, Accept: "application/json" } }
  )

  const list = Array.isArray(res.data) ? res.data : []
  // Utamakan entri yang punya plainLyrics
  const hit =
    list.find((x) => x.plainLyrics && x.plainLyrics.trim()) ||
    list.find((x) => x.syncedLyrics && x.syncedLyrics.trim())

  if (!hit) throw new Error("Lirik tidak ditemukan.")

  // Bersihkan timestamp [00:00.00] bila hanya tersedia syncedLyrics
  let text = hit.plainLyrics
  let synced = false
  if (!text && hit.syncedLyrics) {
    text = hit.syncedLyrics.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, "").trim()
    synced = true
  }

  return {
    title: hit.trackName || q,
    artist: hit.artistName || "Unknown",
    album: hit.albumName || "",
    lyrics: (text || "").trim(),
    synced,
  }
}

// ─── Chord / Kunci Gitar (scraper Ultimate-Guitar) ───────────

/**
 * Ambil & parse JSON dari div.js-store pada halaman Ultimate-Guitar.
 * @param {string} html
 * @returns {object|null}
 */
const parseUgStore = (html) => {
  const m = html.match(/class=["']js-store["'][^>]*data-content=["']([^]*?)["']\s*>/i)
  if (!m) return null
  try {
    return JSON.parse(decodeEntities(m[1]))
  } catch (err) {
    logWarn(`Gagal parse js-store UG: ${err.message}`)
    return null
  }
}

/**
 * Bersihkan markup tab UG: [ch]Am[/ch] -> Am, [tab]..[/tab] -> isi.
 * @param {string} raw
 */
const cleanUgTab = (raw) =>
  String(raw || "")
    .replace(/\[\/?(ch|tab)\]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()

/**
 * Cari kunci gitar (chord) sebuah lagu via Ultimate-Guitar.
 * @param {string} query - judul lagu
 * @returns {Promise<{ title:string, artist:string, content:string, url:string }>}
 */
export const chord = async (query) => {
  const q = String(query || "").trim()
  if (!q) throw new Error("Masukkan judul lagu.")

  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  }

  // 1) Cari di UG (filter tipe Chords)
  const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(
    q
  )}`
  const sres = await http.get(searchUrl, { headers, responseType: "text" })
  const sStore = parseUgStore(String(sres.data))
  const results = sStore?.store?.page?.data?.results || []

  const candidate = results.find(
    (r) => r.tab_url && /chord/i.test(r.type || "")
  )
  if (!candidate) throw new Error("Chord tidak ditemukan.")

  // 2) Buka halaman chord & ambil kontennya
  const tres = await http.get(candidate.tab_url, { headers, responseType: "text" })
  const tStore = parseUgStore(String(tres.data))
  const data = tStore?.store?.page?.data || {}
  const content =
    data?.tab_view?.wiki_tab?.content ||
    data?.tab_view?.wikiTab?.content ||
    ""

  if (!content) throw new Error("Isi chord tidak tersedia.")

  return {
    title: data?.tab?.song_name || candidate.song_name || q,
    artist: data?.tab?.artist_name || candidate.artist_name || "Unknown",
    content: cleanUgTab(content),
    url: candidate.tab_url,
  }
}

// ─── Ringtone (cari & unduh audio singkat dari YouTube) ──────

/**
 * Cari & unduh ringtone (audio) dari YouTube.
 * @param {string} query
 * @returns {Promise<{
 *   buffer:Buffer|null, url:string|null, title:string, author:string,
 *   durationText:string, thumbnail:string, mimetype:string
 * }>}
 */
export const ringtone = async (query) => {
  const q = String(query || "").trim()
  if (!q) throw new Error("Masukkan nama ringtone.")
  // tambahkan keyword "ringtone" agar hasilnya pendek & relevan
  return play(`${q} ringtone`)
}

/**
 * Daftar judul ringtone (tanpa unduh) — opsional untuk preview.
 * @param {string} query
 * @param {number} [limit=5]
 */
export const ringtoneSearch = async (query, limit = 5) => {
  const q = String(query || "").trim()
  if (!q) throw new Error("Masukkan nama ringtone.")
  return ytsearch(`${q} ringtone`, limit)
}

// ─── Shazam / Cari Lagu (node-shazam, fingerprint) ───────────

let _shazam = null
const getShazam = async () => {
  if (_shazam) return _shazam
  try {
    const mod = await import("node-shazam")
    const Shazam = mod.Shazam || mod.default?.Shazam || mod.default
    if (!Shazam) throw new Error("Kelas Shazam tidak ditemukan.")
    _shazam = new Shazam()
    return _shazam
  } catch (err) {
    logError("Modul 'node-shazam' belum siap", err)
    throw new Error(
      "Fitur Shazam belum siap. Pastikan 'node-shazam' terpasang & ffmpeg tersedia."
    )
  }
}

/**
 * Kenali lagu dari buffer audio/video (VN, audio, atau video pendek).
 * Menyimpan buffer ke file sementara lalu memprosesnya via node-shazam
 * (butuh ffmpeg terpasang di server).
 *
 * @param {Buffer} buffer - data media
 * @param {string} [ext="mp3"] - ekstensi file sementara
 * @returns {Promise<{
 *   title:string, artist:string, album:string, genre:string,
 *   cover:string, link:string
 * }>}
 */
export const recognizeAudio = async (buffer, ext = "mp3") => {
  if (!buffer || !buffer.length) throw new Error("Media kosong / gagal diunduh.")

  const shazam = await getShazam()
  const tmpFile = path.join(
    os.tmpdir(),
    `shazam_${randomString(10)}.${ext.replace(/[^a-z0-9]/gi, "") || "mp3"}`
  )

  try {
    fs.writeFileSync(tmpFile, buffer)
    const res = await shazam.recognise(tmpFile, "en-US")

    const track = res?.track
    if (!track || !track.title) {
      throw new Error("Lagu tidak dikenali. Coba potongan audio yang lebih jelas.")
    }

    // Ambil metadata tambahan dari sections bila ada
    let album = ""
    let genre = ""
    try {
      const meta =
        track.sections?.find((s) => s.type === "SONG")?.metadata || []
      album = meta.find((x) => /album/i.test(x.title))?.text || ""
      genre = meta.find((x) => /genre/i.test(x.title))?.text || ""
    } catch {
      /* abaikan */
    }

    return {
      title: track.title,
      artist: track.subtitle || "Unknown",
      album,
      genre,
      cover:
        track.images?.coverarthq || track.images?.coverart || "",
      link: track.url || track.share?.href || "",
    }
  } finally {
    // Selalu bersihkan file sementara
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    } catch {
      /* abaikan */
    }
  }
}

// ─── Default export ──────────────────────────────────────────

export default {
  lyrics,
  chord,
  ringtone,
  ringtoneSearch,
  recognizeAudio,
}
