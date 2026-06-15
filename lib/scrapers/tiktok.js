// ============================================================
//   HABIBIH BOT - TikTok Scraper
//   Sumber utama: tikwm.com (tanpa watermark, foto, & audio).
//   Fallback: Cobalt (bila dikonfigurasi).
// ============================================================

import { httpClient, cobaltDownload, tryProviders, isValidUrl } from "./core.js"

/** Provider A: tikwm.com (kaya metadata). */
const viaTikwm = async (url) => {
  const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
  const res = await httpClient.get(endpoint)
  const data = res.data
  if (!data || data.code !== 0 || !data.data) {
    throw new Error(data?.msg || "respons tikwm tidak valid")
  }
  const d = data.data
  const isImage = Array.isArray(d.images) && d.images.length > 0
  return {
    type: isImage ? "image" : "video",
    title: d.title || "",
    author: d.author?.nickname || d.author?.unique_id || "TikTok",
    video: d.hdplay || d.play || d.wmplay || null,
    audio: d.music || null,
    images: isImage ? d.images : [],
    cover: d.cover || d.origin_cover || null,
    duration: d.duration || 0,
    music: d.music_info?.title || "TikTok Audio",
  }
}

/** Provider B: Cobalt -> URL video (fallback bila tikwm down). */
const viaCobalt = async (url) => {
  const urls = await cobaltDownload(url)
  if (!urls.length) throw new Error("cobalt kosong")
  // Cobalt picker bisa mengembalikan banyak gambar (slide)
  const isImg = urls.every((u) => /\.(jpe?g|png|webp|heic)(\?|$)/i.test(u))
  return {
    type: isImg ? "image" : "video",
    title: "",
    author: "TikTok",
    video: isImg ? null : urls[0],
    audio: null,
    images: isImg ? urls : [],
    cover: null,
    duration: 0,
    music: "TikTok Audio",
  }
}

/**
 * Download konten TikTok (video/foto + audio), tanpa watermark.
 * @param {string} url
 */
export const tiktok = (url) => {
  if (!isValidUrl(url)) throw new Error("URL TikTok tidak valid.")
  return tryProviders("TikTok", [
    { name: "tikwm", fn: () => viaTikwm(url) },
    { name: "cobalt", fn: () => viaCobalt(url) },
  ])
}

/**
 * Ambil HANYA audio/sound TikTok (.tiktokmp3).
 * @param {string} url
 */
export const tiktokMp3 = async (url) => {
  const d = await tiktok(url)
  if (!d.audio) {
    // fallback: minta audio ke cobalt
    const urls = await cobaltDownload(url, { mode: "audio" }).catch(() => [])
    if (urls[0]) {
      return { url: urls[0], title: d.music || d.title || "TikTok Audio", author: d.author, cover: d.cover }
    }
    throw new Error("Audio TikTok tidak ditemukan.")
  }
  return {
    url: d.audio,
    title: d.music || d.title || "TikTok Audio",
    author: d.author,
    cover: d.cover,
  }
}
