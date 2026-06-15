// ============================================================
//   HABIBIH BOT - File Host Scraper
//   Platform: Google Drive, MediaFire, Terabox, Sfile.mobi, Mega.nz
//   Mengembalikan { fileName, url|buffer, size?, sizeText? }.
// ============================================================

import {
  httpClient,
  UA,
  btchRaw,
  extractUrls,
  decodeEntities,
  isValidUrl,
} from "./core.js"
import { formatBytes } from "../function.js"
import { logError } from "../logger.js"

// ─── Google Drive (btch) ─────────────────────────────────────

export const gdrive = async (url) => {
  if (!isValidUrl(url)) throw new Error("URL Google Drive tidak valid.")
  const d = await btchRaw(["gdrive", "gdrivedl"], url)
  const media =
    d.url || d.download || d.downloadUrl || d.link || extractUrls(d)[0]
  if (!media) throw new Error("File tidak ditemukan.")
  return {
    fileName: d.fileName || d.name || "gdrive-file",
    url: media,
    mimetype: d.mimetype || "application/octet-stream",
  }
}

// ─── MediaFire (btch) ────────────────────────────────────────

export const mediafire = async (url) => {
  if (!isValidUrl(url)) throw new Error("URL MediaFire tidak valid.")
  const d = await btchRaw(["mediafire", "mediafiredl"], url)
  const media =
    d.url || d.download || d.downloadUrl || d.link || extractUrls(d)[0]
  if (!media) throw new Error("File tidak ditemukan.")
  return {
    fileName: d.fileName || d.nama || d.name || "mediafire-file",
    url: media,
    sizeText: d.size || d.ukuran || "",
    mimetype: d.mime || d.mimetype || "application/octet-stream",
  }
}

// ─── Terabox (worker publik, keyless) ────────────────────────

const TERABOX_API = "https://terabox.hnn.workers.dev"
const TERABOX_HOSTS =
  /(terabox|teraboxapp|1024terabox|4funbox|momerybox|tibibox|nephobox|terasharelink|terafileshare)\./i

export const terabox = async (url) => {
  if (!isValidUrl(url) || !TERABOX_HOSTS.test(url)) {
    throw new Error("URL Terabox tidak valid.")
  }
  let surl = ""
  const q = url.match(/[?&]surl=([^&]+)/i)
  if (q) surl = q[1]
  else {
    const m = url.match(/\/s\/([A-Za-z0-9_-]+)/)
    if (m) surl = m[1]
  }
  if (!surl) throw new Error("Tidak bisa membaca kode share Terabox.")

  const info = await httpClient.get(
    `${TERABOX_API}/api/get-info?shorturl=${encodeURIComponent(surl)}&pwd=`
  )
  const d = info.data
  if (!d || d.ok === false || !Array.isArray(d.list) || !d.list.length) {
    throw new Error("File tidak ditemukan atau link privat.")
  }
  const file = d.list[0]
  const dl = await httpClient.post(`${TERABOX_API}/api/get-download`, {
    shareid: d.shareid,
    uk: d.uk,
    sign: d.sign,
    timestamp: d.timestamp,
    fs_id: file.fs_id,
  })
  const link =
    dl.data?.downloadLink || dl.data?.download_link || dl.data?.url || null
  if (!link) throw new Error("Gagal membuat link unduhan Terabox.")

  const size = Number(file.size) || 0
  return {
    fileName: file.filename || file.server_filename || "terabox-file",
    url: link,
    size,
    sizeText: size ? formatBytes(size) : "?",
  }
}

// ─── Sfile.mobi (scraper) ────────────────────────────────────

export const sfile = async (url) => {
  if (!isValidUrl(url) || !/sfile\.mobi/i.test(url)) {
    throw new Error("URL Sfile tidak valid.")
  }
  const page = await httpClient.get(url, {
    responseType: "text",
    headers: { "User-Agent": UA },
  })
  const html = String(page.data)
  const nameMatch =
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i)
  const fileName = nameMatch ? decodeEntities(nameMatch[1].trim()) : "sfile-download"

  const dlPage = html.match(/https?:\/\/sfile\.mobi\/download\/[^"'\s<>]+/i)
  if (!dlPage) throw new Error("Tombol unduh tidak ditemukan.")

  const dp = await httpClient.get(dlPage[0], {
    responseType: "text",
    headers: { "User-Agent": UA, Referer: url },
  })
  const dhtml = String(dp.data)
  const direct =
    dhtml.match(/<a[^>]+id=["']download["'][^>]+href=["']([^"']+)["']/i) ||
    dhtml.match(/<a[^>]+href=["']([^"']+)["'][^>]+id=["']download["']/i) ||
    dhtml.match(/(https?:\/\/[^"'\s<>]+\/[^"'\s<>]*key=[^"'\s<>]+)/i)
  const link = direct ? direct[1] || direct[0] : null
  if (!link) throw new Error("Link unduhan langsung tidak ditemukan.")
  return { fileName, url: decodeEntities(link) }
}

// ─── Mega.nz (megajs, terenkripsi -> buffer) ─────────────────

let _megajs = null
const getMega = async () => {
  if (_megajs) return _megajs
  try {
    _megajs = await import("megajs")
    return _megajs
  } catch (err) {
    logError("Modul 'megajs' belum terpasang", err)
    throw new Error("Modul Mega belum terpasang (npm install megajs)")
  }
}

const MEGA_MAX_MB = 100

export const mega = async (url) => {
  if (!isValidUrl(url) || !/mega\.(nz|co\.nz)/i.test(url)) {
    throw new Error("URL Mega tidak valid.")
  }
  const mod = await getMega()
  const File = mod.File || mod.default?.File
  if (!File) throw new Error("megajs tidak mengekspos kelas File.")

  const file = File.fromURL(url)
  await file.loadAttributes()
  const size = Number(file.size) || 0
  if (size && size > MEGA_MAX_MB * 1024 * 1024) {
    throw new Error(`Ukuran ${formatBytes(size)} melebihi batas ${MEGA_MAX_MB}MB.`)
  }
  const buffer = await file.downloadBuffer()
  return {
    fileName: file.name || "mega-file",
    buffer,
    size: size || buffer.length,
    sizeText: formatBytes(size || buffer.length),
  }
}
