// ============================================================
//   HABIBIH BOT - Threads Scraper
//   Membaca post publik Threads (Meta) tanpa library eksternal.
//   Strategi berlapis:
//     1) JSON ter-embed: video_versions / image_versions (multi-media),
//     2) meta OG: og:video / og:image,
//     3) pindai URL media CDN (fbcdn / cdninstagram).
//   Fallback: Cobalt (bila dikonfigurasi).
// ============================================================

import {
  httpClient,
  UA,
  cobaltDownload,
  tryProviders,
  extractUrls,
  decodeEntities,
  jsonUnescape,
  isValidUrl,
} from "./core.js"

/** Ambil HTML post Threads. */
const fetchHtml = async (url) => {
  const res = await httpClient.get(url, {
    responseType: "text",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    },
  })
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data)
}

/** Provider A: scrape HTML (JSON embed -> OG -> CDN scan). */
const viaScrape = async (url) => {
  const html = await fetchHtml(url)
  const media = []

  // 1) JSON ter-embed: video_versions[].url
  for (const m of html.matchAll(/"video_versions":\[(.*?)\]/g)) {
    const u = m[1].match(/"url":"([^"]+)"/)
    if (u) {
      const link = jsonUnescape(u[1])
      if (isValidUrl(link)) media.push({ type: "video", url: link })
    }
  }

  // 2) OG video / image
  if (!media.length) {
    const ogV =
      html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i)
    if (ogV) media.push({ type: "video", url: decodeEntities(ogV[1]) })

    const ogI = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )
    if (!media.length && ogI) media.push({ type: "image", url: decodeEntities(ogI[1]) })
  }

  // 3) Pindai URL CDN
  if (!media.length) {
    const urls = extractUrls(html).map(decodeEntities)
    const vid = urls.find((u) => /\.mp4/i.test(u) && /(cdninstagram|fbcdn)/i.test(u))
    if (vid) media.push({ type: "video", url: vid })
    else {
      const img = urls.find(
        (u) => /\.(jpe?g|png|webp)/i.test(u) && /(cdninstagram|fbcdn)/i.test(u)
      )
      if (img) media.push({ type: "image", url: img })
    }
  }

  if (!media.length) throw new Error("media tidak ditemukan di halaman")
  // unik berdasarkan URL
  const seen = new Set()
  return media.filter((m) => (seen.has(m.url) ? false : seen.add(m.url)))
}

/** Provider B: Cobalt. */
const viaCobalt = async (url) => {
  const urls = await cobaltDownload(url)
  if (!urls.length) throw new Error("cobalt kosong")
  return urls.map((u) => ({
    type: /\.(jpe?g|png|webp)(\?|$)/i.test(u) ? "image" : "video",
    url: u,
  }))
}

/**
 * Download media dari post Threads publik.
 * @param {string} url
 * @returns {Promise<Array<{ type:"video"|"image", url:string }>>}
 */
export const threads = (url) => {
  if (!isValidUrl(url) || !/threads\.(net|com)/i.test(url)) {
    throw new Error("URL Threads tidak valid.")
  }
  return tryProviders("Threads", [
    { name: "scrape", fn: () => viaScrape(url) },
    { name: "cobalt", fn: () => viaCobalt(url) },
  ])
}
