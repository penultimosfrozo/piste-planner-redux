import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Cache in memoria del worker: evita di rifare lo scraping a ogni render. */
const ogCache = new Map<string, string | null>();

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && /^https?:\/\//i.test(m[1])) return m[1];
  }
  return null;
}

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SkiScoreBot/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Recupera l'immagine reale dell'articolo (og:image) per ogni URL notizia.
 * Nessun placeholder: se non c'è metadato, restituiamo null e la UI mostra il fallback.
 */
export const newsImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ urls: z.array(z.string().url()).max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const unique = Array.from(new Set(data.urls));

    const results = await Promise.all(
      unique.map(async (url) => {
        if (ogCache.has(url)) return [url, ogCache.get(url) ?? null] as const;
        const html = await fetchText(url, 4500);
        const image = html ? extractOgImage(html.slice(0, 200_000)) : null;
        ogCache.set(url, image);
        return [url, image] as const;
      }),
    );

    return { images: Object.fromEntries(results) as Record<string, string | null> };
  });

/* ------------------------------------------------------------------ */
/* Aggregatore RSS multi-fonte                                        */
/* ------------------------------------------------------------------ */

const FEEDS: Array<{ source: string; url: string }> = [
  { source: "NeveItalia", url: "https://www.neveitalia.it/rss.xml" },
  { source: "Sciare Magazine", url: "https://www.sciaremag.it/feed/" },
  { source: "DoveSciare", url: "https://www.dovesciare.it/feed/" },
  { source: "Montagna.tv", url: "https://www.montagna.tv/feed/" },
  { source: "SkiForum", url: "https://www.skiforum.it/feed/" },
  { source: "Neve Appennino", url: "https://www.neveappennino.it/feed/" },
];

export interface SkiNewsItem {
  id: string;
  title: string;
  date: string;
  source: string;
  abstract: string;
  url: string;
  image: string | null;
  resorts: string[];
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;|&apos;|&#39;/g, "'")
    .replace(/&#8230;/g, "…")
    .replace(/&laquo;|&raquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1] ? decode(m[1]) : null;
}

function imageFromItem(block: string): string | null {
  const patterns = [
    /<enclosure[^>]+url=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i,
    /<media:content[^>]+url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m?.[1] && /^https?:\/\//i.test(m[1])) return decode(m[1]);
  }
  return null;
}

function parseFeed(xml: string, source: string): SkiNewsItem[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  const items: SkiNewsItem[] = [];
  for (const block of blocks.slice(0, 40)) {
    const title = tag(block, "title");
    let url = tag(block, "link");
    if (!url) {
      const alt = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      url = alt?.[1] ?? null;
    }
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const rawDate =
      tag(block, "pubDate") ?? tag(block, "updated") ?? tag(block, "published") ?? "";
    const parsed = rawDate ? new Date(rawDate) : null;
    const date =
      parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const abstract = (tag(block, "description") ?? tag(block, "summary") ?? "").slice(0, 260);
    items.push({
      id: `${source}-${url}`,
      title,
      date,
      source,
      abstract,
      url,
      image: imageFromItem(block),
      resorts: [],
    });
  }
  return items;
}

let cache: { at: number; items: SkiNewsItem[] } | null = null;
const CACHE_MS = 15 * 60 * 1000;

/**
 * Notizie in tempo reale aggregate dai principali feed di settore.
 * I feed non raggiungibili vengono semplicemente ignorati.
 */
export const fetchSkiNews = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { news: cache.items, error: null as string | null };
  }

  const feeds = await Promise.all(
    FEEDS.map(async (f) => {
      const xml = await fetchText(f.url);
      return xml ? parseFeed(xml, f.source) : [];
    }),
  );

  const seen = new Set<string>();
  const items: SkiNewsItem[] = [];
  for (const list of feeds) {
    for (const item of list) {
      const key = item.url.replace(/[?#].*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  // Mappa ogni notizia sui comprensori citati nel titolo/abstract.
  const { RESORT_CATALOG, normalizeName } = await import("./catalog");
  const names = RESORT_CATALOG.map((r) => ({
    name: r.name,
    tokens: normalizeName(r.name)
      .split(" ")
      .filter((t) => t.length >= 5),
  })).filter((n) => n.tokens.length > 0);

  for (const item of items) {
    const haystack = normalizeName(`${item.title} ${item.abstract}`);
    const matched: string[] = [];
    for (const n of names) {
      if (n.tokens.some((t) => haystack.includes(t))) matched.push(n.name);
      if (matched.length >= 3) break;
    }
    item.resorts = matched;
  }

  const limited = items.slice(0, 120);
  cache = { at: Date.now(), items: limited };
  return {
    news: limited,
    error: limited.length === 0 ? "Nessun feed raggiungibile in questo momento." : null,
  };
});
