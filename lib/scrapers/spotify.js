// ============================================================
//   HABIBIH BOT - Spotify Scraper
//   Spotify tidak menyediakan file audio publik (DRM). Strategi:
//     1) ambil metadata (judul + artis) via oEmbed publik (keyless),
//     2) cari & unduh audio sepadan dari YouTube (engine youtube.js).
//   Stabil karena bersandar pada engine YouTube yang sudah robust.
// ============================================================

import { httpClient, UA, isValidUrl } from "./core.js"
import { play } from "./youtube.js"
import { logWarn } from "../logger.js"

/**
 * Download lagu Spotify (audio diambil dari YouTube).
 * @param {string} url - URL track Spotify
 * @returns {Promise<{
 *   buffer:Buffer|null, url:string|null, mimetype:string,
 *   title:string, author:string, thumbnail:string, source:"YouTube"
 * }>}
 */
export const spotify = async (url) => {
  if (!isValidUrl(url) || !/spotify\.com/i.test(url)) {
    throw new Error("URL Spotify tidak valid.")
  }

  let title = ""
  let thumbnail = ""
  try {
    const res = await httpClient.get(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { "User-Agent": UA, Accept: "application/json" } }
    )
    title = res.data?.title || ""
    thumbnail = res.data?.thumbnail_url || ""
  } catch (err) {
    logWarn(`Spotify oEmbed gagal: ${err.message}`)
  }

  if (!title) throw new Error("Gagal membaca metadata Spotify.")

  const audio = await play(`${title} audio`)
  return {
    buffer: audio.buffer,
    url: audio.url,
    mimetype: "audio/mp4",
    title,
    author: audio.author,
    thumbnail: thumbnail || audio.thumbnail,
    source: "YouTube",
  }
}
