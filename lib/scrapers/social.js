// ============================================================
//   HABIBIH BOT - Social Media Scraper
//   Platform: Instagram, Facebook, Twitter/X, Pinterest, CapCut,
//   SnackVideo, SoundCloud, + IG/FB Story.
//
//   Tiap platform memakai fallback chain: Cobalt -> btch-downloader.
//   Hasil media platform foto/video dinormalisasi jadi string[] URL
//   (tanpa thumbnail) lalu plugin mendeteksi tipe via Content-Type.
// ============================================================

import {
  httpClient,
  UA,
  cobaltDownload,
  btchMedia,
  tryProviders,
  extractUrls,
  decodeEntities,
  jsonUnescape,
  isValidUrl,
} from "./core.js"

/**
 * Bangun fallback chain standar: Cobalt dulu, lalu btch-downloader.
 * @param {string} label
 * @param {string} url
 * @param {string[]} btchNames - kandidat nama fungsi btch
 * @param {{audio?:boolean}} [opts]
 * @returns {Promise<string[]>}
 */
const mediaChain = (label, url, btchNames, opts = {}) =>
  tryProviders(label, [
    {
      name: "cobalt",
      fn: () => cobaltDownload(url, opts.audio ? { mode: "audio" } : {}),
    },
    { name: "btch", fn: () => btchMedia(btchNames, url) },
  ])

/** Instagram (post/reels/foto/video) -> string[] URL media. */
export const instagram = (url) => {
  if (!isValidUrl(url)) throw new Error("URL Instagram tidak valid.")
  return mediaChain("Instagram", url, ["igdl", "instagram"])
}

/** Facebook video -> string[] URL. */
export const facebook = (url) => {
  if (!isValidUrl(url)) throw new Error("URL Facebook tidak valid.")
  return mediaChain("Facebook", url, ["fbdown", "facebook", "fbdl"])
}

/** Twitter / X -> string[] URL. */
export const twitter = (url) => {
  if (!isValidUrl(url)) throw new Error("URL Twitter/X tidak valid.")
  return mediaChain("Twitter/X", url, ["twitter", "twitterdl", "x"])
}

/** Pinterest -> string[] URL. */
export const pinterest = (url) => {
  if (!isValidUrl(url)) throw new Error("URL Pinterest tidak valid.")
  return mediaChain("Pinterest", url, ["pinterest", "pin", "pindl"])
}

/** CapCut -> string[] URL. */
export const capcut = (url) => {
  if (!isValidUrl(url)) throw new Error("URL CapCut tidak valid.")
  return mediaChain("CapCut", url, ["capcut", "capcutdl"])
}

/** SnackVideo -> string[] URL. */
export const snackvideo = (url) => {
  if (!isValidUrl(url)) throw new Error("URL SnackVideo tidak valid.")
  return mediaChain("SnackVideo", url, ["snackvideo", "snackvideodl", "snack"])
}

/** SoundCloud (audio) -> string[] URL. */
export const soundcloud = (url) => {
  if (!isValidUrl(url)) throw new Error("URL SoundCloud tidak valid.")
  return mediaChain("SoundCloud", url, ["soundcloud", "soundclouddl", "scdl"], {
    audio: true,
  })
}

// ─── Instagram Story (by username, best-effort keyless) ──────

const IG_APP_ID = "936619743392459"

/**
 * Ambil Story Instagram aktif berdasarkan username (best-effort, akun publik).
 * @param {string} username
 * @returns {Promise<Array<{ type:"video"|"image", url:string }>>}
 */
export const igStory = async (username) => {
  const user = String(username || "").replace(/^@/, "").trim()
  if (!user) throw new Error("Masukkan username Instagram.")

  const headers = {
    "User-Agent": UA,
    "x-ig-app-id": IG_APP_ID,
    Accept: "application/json",
  }

  const prof = await httpClient.get(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
      user
    )}`,
    { headers }
  )
  const uid = prof.data?.data?.user?.id
  if (!uid) throw new Error("Akun tidak ditemukan/privat atau dibatasi Instagram.")

  const reels = await httpClient.get(
    `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${uid}`,
    { headers }
  )
  const items =
    reels.data?.reels?.[uid]?.items || reels.data?.reels_media?.[0]?.items || []

  const media = items
    .map((it) => {
      if (it.video_versions?.length) return { type: "video", url: it.video_versions[0].url }
      const img = it.image_versions2?.candidates?.[0]?.url
      return img ? { type: "image", url: img } : null
    })
    .filter(Boolean)

  if (!media.length) throw new Error("Tidak ada story aktif (atau butuh login).")
  return media
}

// ─── Facebook Story/Reel/Video ───────────────────────────────

/** Provider scrape FB publik: parse URL video dari JSON ter-embed. */
const fbScrape = async (url) => {
  const res = await httpClient.get(url, {
    responseType: "text",
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
  })
  const html = String(res.data)
  const patterns = [
    /"browser_native_hd_url":"([^"]+)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /"hd_src(?:_no_ratelimit)?":"([^"]+)"/,
    /"sd_src(?:_no_ratelimit)?":"([^"]+)"/,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m && m[1]) {
      const link = jsonUnescape(m[1])
      if (isValidUrl(link)) return [link]
    }
  }
  const og = html.match(
    /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i
  )
  if (og) return [decodeEntities(og[1])]
  throw new Error("video tidak ditemukan di halaman")
}

/**
 * Facebook Story/Reel/Video -> string[] URL.
 * Chain: Cobalt -> btch(fbdown) -> scrape publik.
 * @param {string} url
 */
export const fbStory = (url) => {
  if (!isValidUrl(url)) throw new Error("URL Facebook tidak valid.")
  return tryProviders("Facebook Story", [
    { name: "cobalt", fn: () => cobaltDownload(url) },
    { name: "btch", fn: () => btchMedia(["fbdown", "facebook"], url) },
    { name: "scrape", fn: () => fbScrape(url) },
  ])
}
