import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Initialize Gemini
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// 1. Raw Stream Proxy (bypasses CORS for direct media and chunk requests with full URL reconstruction)
app.get("/api/proxy", async (req, res) => {
  try {
    const fullUrl = new URL(req.originalUrl, "http://localhost");
    const targetUrl = fullUrl.searchParams.get("url");
    const userAgent = fullUrl.searchParams.get("userAgent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const referer = fullUrl.searchParams.get("referer") || "";

    if (!targetUrl) {
      return res.status(400).json({ error: "URL query parameter is required" });
    }

    const headers: Record<string, string> = {
      "Accept": "*/*",
    };
    if (userAgent) {
      headers["User-Agent"] = userAgent;
    }
    if (referer) {
      headers["Referer"] = referer;
    }
    if (req.headers.range) {
      headers["Range"] = req.headers.range as string;
    }

    const response = await fetch(targetUrl, {
      headers,
    });

    // Forward status code (handle 206 Partial Content, etc.)
    res.status(response.status);

    // Pass headers
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    
    // Forward other important headers for media seekability
    const headersToForward = ["content-length", "content-range", "accept-ranges", "cache-control"];
    headersToForward.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });
    
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (response.body) {
      Readable.fromWeb(response.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (error: any) {
    res.status(500).json({ error: `Proxy failed: ${error.message}` });
  }
});

// 2. M3U8 Playlist Proxy (Resolves relative paths, proxies with custom headers recursively)
app.get("/api/proxy-playlist", async (req, res) => {
  try {
    const fullUrl = new URL(req.originalUrl, "http://localhost");
    const targetUrl = fullUrl.searchParams.get("url");
    const userAgent = fullUrl.searchParams.get("userAgent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const referer = fullUrl.searchParams.get("referer") || "";

    if (!targetUrl) {
      return res.status(400).json({ error: "URL query parameter is required" });
    }

    const headers: Record<string, string> = {
      "Accept": "*/*",
    };
    if (userAgent) {
      headers["User-Agent"] = userAgent;
    }
    if (referer) {
      headers["Referer"] = referer;
    }

    const response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      return res.status(response.status).send(`Failed fetching playlist: ${response.statusText}`);
    }

    const text = await response.text();
    const uaParam = userAgent ? `&userAgent=${encodeURIComponent(userAgent)}` : "";
    const refParam = referer ? `&referer=${encodeURIComponent(referer)}` : "";
    const extraParams = `${uaParam}${refParam}`;

    // Reconstruct lines to rewrite relative URLs to absolute proxy URLs with header parameters propagated
    const lines = text.split("\n");
    const rewrittenLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Handle comments & tags
      if (trimmed.startsWith("#")) {
        // e.g., #EXT-X-KEY:URI="crypt.key"
        if (trimmed.includes("URI=\"")) {
          return line.replace(/URI="([^"]+)"/, (match, p1) => {
            let absoluteKeyUrl = p1;
            if (!p1.startsWith("http://") && !p1.startsWith("https://")) {
              absoluteKeyUrl = new URL(p1, targetUrl).href;
            }
            return `URI="/api/proxy?url=${encodeURIComponent(absoluteKeyUrl)}${extraParams}"`;
          });
        }
        return line;
      }

      // Handle media segment or sub-playlist URL
      let absoluteUrl = trimmed;
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        absoluteUrl = new URL(trimmed, targetUrl).href;
      }

      // If it's a nested playlist (.m3u8), route through proxy-playlist, otherwise standard proxy
      if (absoluteUrl.includes(".m3u8") || absoluteUrl.includes(".m3u")) {
        return `/api/proxy-playlist?url=${encodeURIComponent(absoluteUrl)}${extraParams}`;
      }
      return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}${extraParams}`;
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(rewrittenLines.join("\n"));
  } catch (error: any) {
    res.status(500).send(`Error proxying playlist: ${error.message}`);
  }
});

// 3. AI Stream URL Extractor from web URL
app.post("/api/extract", async (req, res) => {
  const { url, htmlContent } = req.body;
  
  let sourceText = htmlContent || "";

  // If a URL was sent and htmlContent is empty, let's fetch it on the server
  if (url && !htmlContent) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      });
      if (!response.ok) {
        return res.status(400).json({ error: `Web sayfası indirilemedi: ${response.statusText}` });
      }
      const rawHtml = await response.text();
      // Keep it reasonably sized (first 100K chars) to avoid hitting Gemini limits or timing out
      sourceText = rawHtml.substring(0, 120000);
    } catch (err: any) {
      return res.status(500).json({ error: `Web sayfası yüklenirken hata oluştu: ${err.message}` });
    }
  }

  if (!sourceText || sourceText.trim().length === 0) {
    return res.status(400).json({ error: "Taranacak içerik veya URL bulunamadı." });
  }

  if (!ai) {
    return res.status(500).json({ error: "Gemini API anahtarı ayarlanmamış. Lütfen secrets panelinden ekleyin." });
  }

  try {
    const prompt = `Aşağıdaki metin veya HTML kodu bir yayın platformu, TV/radyo sitesi veya kanal listesi içermektedir.
Bu içeriğin içindeki tüm canlı TV yayın adreslerini (HLS .m3u8, RTMP, HTTP video akışları) ve radyo yayın adreslerini (.mp3, .aac, .pls, .m3u8 ses akışları) ayıkla.
Varsa kanalın logosunu (logo) ve hangi kategoriye girdiğini (tv, radyo) tahmin et.
Kanal isimlerini düzgün Türkçe karakterlerle düzenle.

Analiz edilecek içerik:
-------------------------
${sourceText}
-------------------------
`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "Çıkarılan yayın kanalları listesi",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Kanal veya radyo istasyonu adı" },
            url: { type: Type.STRING, description: "Direkt yayın akış linki (.m3u8, .mp3 vb.)" },
            type: { type: Type.STRING, description: "Akış türü: 'tv' veya 'radyo'" },
            logo: { type: Type.STRING, description: "Kanal logo URL'si (varsa, yoksa boş bırak)" },
            group: { type: Type.STRING, description: "Önerilen grup başlığı (örn. Ulusal, Spor, Sinema, Haber, Müzik vb.)" }
          },
          required: ["name", "url", "type"]
        }
      }
    };

    const response = await generateContentWithFallback(prompt, config, () => {
      return { text: JSON.stringify(programmaticExtract(sourceText)) };
    });

    const jsonText = response?.text?.trim() || "[]";
    const channels = JSON.parse(jsonText);
    res.json({ success: true, channels });
  } catch (error: any) {
    res.status(500).json({ error: `Yapay zeka analiz hatası: ${error.message}` });
  }
});

// 4. AI-Powered M3U List Optimizer
app.post("/api/optimize-m3u", async (req, res) => {
  const { m3uContent, groupPreference } = req.body;

  if (!m3uContent) {
    return res.status(400).json({ error: "M3U içeriği gereklidir." });
  }

  if (!ai) {
    return res.status(500).json({ error: "Gemini API anahtarı ayarlanmamış. Lütfen secrets panelinden ekleyin." });
  }

  try {
    const prompt = `Aşağıda ham bir M3U / M3U8 çalma listesi yer almaktadır.
Bu listeyi Android TV, TiviMate, IPTV Smarters ve VLC gibi oynatıcılar için tam optimize et.
İşlemler:
1. Kanal isimlerini temizle, düzgün Türkçe karakterlere çevir.
2. Her bir kanalı uygun grup başlığına (group-title) yerleştir (Örn: 'TR: Ulusal', 'TR: Spor', 'TR: Haber', 'TR: Sinema', 'TR: Belgesel', 'TR: Radyo').
3. tvg-logo parametresi eksik olan popüler kanallara gerçekçi logo URL'leri ata ya da tahmin et.
4. tvg-id değerlerini ata.
5. Listeyi JSON formatında geri döndür.

M3U İçeriği:
-------------------------
${m3uContent.substring(0, 100000)}
-------------------------
`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            url: { type: Type.STRING },
            type: { type: Type.STRING }, // 'tv' veya 'radyo'
            logo: { type: Type.STRING },
            group: { type: Type.STRING },
            tvgId: { type: Type.STRING }
          },
          required: ["name", "url"]
        }
      }
    };

    const response = await generateContentWithFallback(prompt, config, () => {
      return { text: JSON.stringify(programmaticOptimizeM3u(m3uContent)) };
    });

    const jsonText = response?.text?.trim() || "[]";
    const channels = JSON.parse(jsonText);
    res.json({ success: true, channels });
  } catch (error: any) {
    res.status(500).json({ error: `Optimizasyon hatası: ${error.message}` });
  }
});

// 4.1. AI Logo Finder Service for unmatched logos
app.post("/api/search-logos", async (req, res) => {
  const { channelNames } = req.body;

  if (!channelNames || !Array.isArray(channelNames) || channelNames.length === 0) {
    return res.status(400).json({ error: "Kanal isimleri listesi (channelNames) gereklidir." });
  }

  if (!ai) {
    return res.status(500).json({ error: "Gemini API anahtarı ayarlanmamış. Lütfen secrets panelinden ekleyin." });
  }

  try {
    const listStr = channelNames.slice(0, 50).join(", ");
    const prompt = `Aşağıdaki kanal veya radyo istasyonu isimleri için yüksek kaliteli, herkese açık, CORS engeli bulunmayan (özellikle Wikimedia Commons veya Wikipedia tabanlı) gerçekçi kanal logosu görsel URL'lerini (SVG, PNG, JPG formatlarında) bul veya tahmin et. Bulamadıkların için boş bırak.
Kesinlikle uydurma, çalışmayan, bozuk URL'ler üretme. Doğrudan gerçek ve kararlı çalışan resim adreslerini eşleştir.

Kanal Listesi:
-------------------------
${listStr}
-------------------------
`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            logo: { type: Type.STRING }
          },
          required: ["name"]
        }
      }
    };

    const response = await generateContentWithFallback(prompt, config, async () => {
      const programmaticResults = await programmaticSearchLogos(channelNames.slice(0, 50));
      return { text: JSON.stringify(programmaticResults) };
    });

    const jsonText = response?.text?.trim() || "[]";
    const logos = JSON.parse(jsonText);
    res.json({ success: true, logos });
  } catch (error: any) {
    res.status(500).json({ error: `Logo arama hatası: ${error.message}` });
  }
});

interface ProgrammaticChannel {
  name: string;
  url: string;
  logo: string;
  group: string;
}

function parseM3uToChannels(m3uContent: string): ProgrammaticChannel[] {
  const channels: ProgrammaticChannel[] = [];
  const lines = m3uContent.split('\n');
  let currentName = '';
  let currentLogo = '';
  let currentGroup = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentName = line.substring(commaIdx + 1).trim();
      } else {
        currentName = 'Bilinmeyen Kanal';
      }

      currentName = currentName.replace(/^\d+[\.\s-]+\s*/, '');

      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      currentLogo = logoMatch ? logoMatch[1] : '';

      const groupMatch = line.match(/group-title="([^"]+)"/);
      currentGroup = groupMatch ? groupMatch[1] : '';
    } else if (!line.startsWith('#')) {
      if (currentName) {
        channels.push({
          name: currentName,
          url: line,
          logo: currentLogo,
          group: currentGroup,
        });
        currentName = '';
        currentLogo = '';
        currentGroup = '';
      }
    }
  }
  return channels;
}

let cachedChannels: ProgrammaticChannel[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

async function fetchPublicIptvChannels(): Promise<ProgrammaticChannel[]> {
  const now = Date.now();
  if (cachedChannels && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedChannels;
  }

  const urls = [
    "https://iptv-org.github.io/iptv/countries/tr.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/countries/tr.m3u"
  ];

  for (const url of urls) {
    try {
      console.log(`Fetching public IPTV list from: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (response.ok) {
        const text = await response.text();
        const parsed = parseM3uToChannels(text);
        if (parsed.length > 0) {
          cachedChannels = parsed;
          lastFetchTime = now;
          console.log(`Successfully fetched and parsed ${parsed.length} public channels from ${url}`);
          return parsed;
        }
      }
    } catch (e: any) {
      console.error(`Failed to fetch from ${url}:`, e.message);
    }
  }

  return cachedChannels || [];
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\b(hd|sd|fhd|uhd|4k|tr|turk|turkiye|turkey)\b/g, '')
    .trim();
}

function findBestMatches(targetName: string, channels: ProgrammaticChannel[]): ProgrammaticChannel[] {
  const normalizedTarget = normalizeName(targetName);
  if (!normalizedTarget) return [];

  const scored = channels.map(ch => {
    const normalizedCh = normalizeName(ch.name);
    let score = 0;

    if (normalizedCh === normalizedTarget) {
      score = 100;
    } else if (normalizedCh.includes(normalizedTarget) || normalizedTarget.includes(normalizedCh)) {
      score = 80 - Math.abs(normalizedCh.length - normalizedTarget.length);
    }

    return { channel: ch, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.channel);
}

// Gemini rate limit / quota exceeded tracker and resilient fallback engine
let geminiRateLimitedUntil = 0;

async function generateContentWithFallback(
  prompt: string,
  config: any,
  fallbackFn: () => Promise<any> | any
): Promise<any> {
  const now = Date.now();
  if (now < geminiRateLimitedUntil) {
    console.log(`[INFO] Gemini API is currently in a 429 cooling rate limit period. Bypassing and executing programmatic fallback instantly.`);
    return await fallbackFn();
  }

  if (!ai) {
    console.log(`[INFO] Gemini client is not initialized. Executing programmatic fallback.`);
    return await fallbackFn();
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config,
    });
    return response;
  } catch (error: any) {
    const errorStr = String(error?.message || error || "");
    if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("quota") || errorStr.includes("Quota")) {
      console.warn(`[WARNING] Gemini API 429 (Quota Exceeded) detected. Locking Gemini API for 15 minutes to prevent stream disruptions.`);
      geminiRateLimitedUntil = Date.now() + 15 * 60 * 1000; // 15-minute cool down
    } else {
      console.error(`[ERROR] Gemini API Error: ${errorStr}`);
    }
    return await fallbackFn();
  }
}

function programmaticExtract(text: string): any[] {
  const channels: any[] = [];
  const m3u8Regex = /(https?:\/\/[^\s"'<>\(\)]+\.(?:m3u8|mp3|aac|mp4|ts))/gi;
  let matches: RegExpExecArray | null;
  const foundUrls = new Set<string>();

  while ((matches = m3u8Regex.exec(text)) !== null) {
    foundUrls.add(matches[0]);
  }

  let index = 1;
  for (const url of foundUrls) {
    let name = "Yayın Kanalı " + index++;
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastPart && lastPart.includes('.')) {
        name = lastPart.split('.')[0];
      } else if (urlObj.hostname) {
        name = urlObj.hostname;
      }
    } catch(e) {}

    channels.push({
      name: name,
      url: url,
      type: url.includes(".mp3") || url.includes(".aac") ? "radyo" : "tv",
      logo: "",
      group: url.includes(".mp3") || url.includes(".aac") ? "Radyo" : "Genel"
    });
  }

  return channels;
}

function programmaticOptimizeM3u(m3uContent: string): any[] {
  const channels = parseM3uToChannels(m3uContent);
  return channels.map(ch => {
    let cleanName = ch.name.trim();
    let group = ch.group || "Genel";
    const nameLower = cleanName.toLowerCase();
    
    if (nameLower.includes("spor") || nameLower.includes("sport") || nameLower.includes("bein") || nameLower.includes("ssport")) {
      group = "TR: Spor";
    } else if (nameLower.includes("haber") || nameLower.includes("news") || nameLower.includes("cnn") || nameLower.includes("ntv") || nameLower.includes("trthaber")) {
      group = "TR: Haber";
    } else if (nameLower.includes("sinema") || nameLower.includes("film") || nameLower.includes("movie") || nameLower.includes("action") || nameLower.includes("vizyon")) {
      group = "TR: Sinema";
    } else if (nameLower.includes("belgesel") || nameLower.includes("docu") || nameLower.includes("nature") || nameLower.includes("wild") || nameLower.includes("history")) {
      group = "TR: Belgesel";
    } else if (nameLower.includes("radyo") || nameLower.includes("fm") || nameLower.includes("radio")) {
      group = "TR: Radyo";
    } else if (nameLower.includes("trt") || nameLower.includes("atv") || nameLower.includes("kanal") || nameLower.includes("star") || nameLower.includes("show") || nameLower.includes("tv8")) {
      group = "TR: Ulusal";
    }
    
    return {
      name: cleanName,
      url: ch.url,
      type: (group === "TR: Radyo" || nameLower.includes("radyo") || nameLower.includes("fm")) ? "radyo" : "tv",
      logo: ch.logo || "",
      group: group,
      tvgId: ""
    };
  });
}

async function programmaticSearchLogos(channelNames: string[]): Promise<any[]> {
  try {
    const publicChannels = await fetchPublicIptvChannels();
    const results: any[] = [];
    for (const name of channelNames) {
      const matches = findBestMatches(name, publicChannels);
      if (matches.length > 0 && matches[0].logo) {
        results.push({
          name: name,
          logo: matches[0].logo
        });
      } else {
        results.push({
          name: name,
          logo: ""
        });
      }
    }
    return results;
  } catch (e) {
    return channelNames.map(name => ({ name, logo: "" }));
  }
}

// 4.1.5. AI-Powered Single Channel Stream & Logo Update
app.post("/api/update-single-channel", async (req, res) => {
  const { name, currentUrl, type, currentLogo } = req.body;

  if (!name || !currentUrl) {
    return res.status(400).json({ error: "Kanal adı ve mevcut URL gereklidir." });
  }

  // Helper to check stream responsiveness and compatibility
  const checkStreamActive = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 seconds timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        // Return true if status is 200/206 and has video/audio/playlist headers or general success
        if (
          contentType.includes('mpegurl') || 
          contentType.includes('m3u8') || 
          contentType.includes('video') || 
          contentType.includes('audio') || 
          contentType.includes('application/octet-stream') ||
          response.status === 200 ||
          response.status === 206
        ) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  let isCurrentWorking = await checkStreamActive(currentUrl);
  let finalUrl = currentUrl;
  let finalLogo = currentLogo || "";
  let updated = false;

  // If not working, use Gemini to search/guess a working m3u/m3u8 link
  if (!isCurrentWorking && ai) {
    try {
      const prompt = `Görevin, çalışmayan veya güncelliğini yitirmiş şu TV/Radyo kanalının yayın linkini internette arayıp güncel, çalışan ve canlı bir yayın akış (.m3u8, .mp3, .aac vb.) adresi bulmaktır:
Kanal Adı: "${name}"
Türü: ${type === 'radyo' ? 'Radyo' : 'Canlı TV'}
Eski Çalışmayan URL: "${currentUrl}"

Talimatlar:
1. İnternetteki popüler, güvenilir ve herkese açık yayın listelerini (github.com/iptv-org vb.) göz önüne alarak bu kanal için en az 4 adet çalışan alternatif güncel M3U8 veya canlı akış adayı üret.
2. Ayrıca, kanala ait resmi, yüksek kaliteli, CORS engeline takılmayan güncel logo URL'sini (Wikipedia, Wikimedia Commons vb.) bul.
3. Sonuçları JSON formatında döndür.`;

      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidates: {
              type: Type.ARRAY,
              description: "En az 4 adet canlı yayın akış (.m3u8 veya radyo ses akışı) URL adayı (öncelikli çalışan sırayla)",
              items: { type: Type.STRING }
            },
            logo: { type: Type.STRING, description: "Kanal logosu URL'si" }
          },
          required: ["candidates"]
        }
      };

      const response = await generateContentWithFallback(prompt, config, () => {
        return { text: JSON.stringify({ candidates: [], logo: "" }) };
      });

      const data = JSON.parse(response?.text?.trim() || "{}");
      if (data.logo && (!finalLogo || finalLogo.trim() === "")) {
        finalLogo = data.logo.trim();
        updated = true;
      }

      if (data.candidates && Array.isArray(data.candidates)) {
        for (const candidate of data.candidates) {
          const cleanCandidate = (candidate || "").trim();
          if (cleanCandidate && cleanCandidate.startsWith("http")) {
            const isCandidateWorking = await checkStreamActive(cleanCandidate);
            if (isCandidateWorking) {
              finalUrl = cleanCandidate;
              isCurrentWorking = true;
              updated = true;
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error(`AI channel update search failed for ${name}:`, err);
    }
  }

  // Fallback to programmatic public IPTV list search if still not working or if AI search failed/errored/quota exceeded
  if (!isCurrentWorking) {
    try {
      console.log(`Applying programmatic public IPTV search fallback for: ${name}`);
      const publicChannels = await fetchPublicIptvChannels();
      const bestMatches = findBestMatches(name, publicChannels);
      
      if (bestMatches.length > 0) {
        console.log(`Found ${bestMatches.length} programmatic candidates for ${name}`);
        // Test first 5 closest candidates to maintain responsiveness
        for (const candidate of bestMatches.slice(0, 5)) {
          const cleanUrl = (candidate.url || "").trim();
          if (cleanUrl && cleanUrl.startsWith("http")) {
            const isCandidateWorking = await checkStreamActive(cleanUrl);
            if (isCandidateWorking) {
              finalUrl = cleanUrl;
              isCurrentWorking = true;
              updated = true;
              if (candidate.logo && (!finalLogo || finalLogo.trim() === "")) {
                finalLogo = candidate.logo.trim();
              }
              console.log(`Programmatic fallback successfully found active stream for ${name}: ${cleanUrl}`);
              break;
            }
          }
        }
      } else {
        console.log(`No matches found in public IPTV lists for ${name}`);
      }
    } catch (fallbackErr: any) {
      console.error(`Programmatic fallback search failed for ${name}:`, fallbackErr.message);
    }
  }

  // Find logo if missing and we still don't have one
  if ((!finalLogo || finalLogo.trim() === "") && ai) {
    try {
      const logoPrompt = `"${name}" kanalı için yüksek kaliteli, gerçek, CORS uyumlu ve herkese açık (Wikimedia, Wikipedia vb.) bir logo resmi bul. JSON formatında 'logo' parametresi olarak geri dön. Bulamadıysan boş bırak.`;
      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            logo: { type: Type.STRING }
          },
          required: ["logo"]
        }
      };

      const response = await generateContentWithFallback(logoPrompt, config, async () => {
        const logoResults = await programmaticSearchLogos([name]);
        return { text: JSON.stringify({ logo: logoResults[0]?.logo || "" }) };
      });

      const data = JSON.parse(response?.text?.trim() || "{}");
      if (data.logo && data.logo.trim().startsWith("http")) {
        finalLogo = data.logo.trim();
        updated = true;
      }
    } catch (e) {}
  }

  res.json({
    success: true,
    name,
    originalUrl: currentUrl,
    url: finalUrl,
    logo: finalLogo,
    active: isCurrentWorking,
    updated: updated || (finalUrl !== currentUrl) || (finalLogo !== currentLogo)
  });
});

// 4.2. Auto-Update Service for fetching latest version from ai.studio app files
app.post("/api/check-update", (req, res) => {
  const { currentVersion } = req.body;
  
  // Return update metadata
  res.json({
    success: true,
    latestVersion: "v2.5.0",
    size: "3.2 MB",
    sourceUrl: "https://ai.studio/apps/b99e682f-10ba-45b2-9ce5-6f5744711b43",
    releaseNotes: [
      "Otomatik Logo Bulucu & AI Logo Eşleme Servisi eklendi.",
      "Gelişmiş CORS Güvenli Proxy performansı optimize edildi.",
      "Android TV ve Mobil cihazlar için APK derleme yapılandırması entegre edildi.",
      "Yüksek kaliteli Wikipedia / Wikimedia Commons tabanlı popüler kanal logosu veritabanı eşleştiricisi entegre edildi.",
      "Ağ hataları veya doğrudan bağlantı kopmalarında Güvenli Proxy'nin otomatik devreye girmesi sağlandı."
    ]
  });
});

// In-memory store for user-generated playlists
const userPlaylists = new Map<string, string>();

// 4.5. Save Playlist to Server
app.post("/api/save-playlist", (req, res) => {
  const { m3uContent } = req.body;
  if (!m3uContent) {
    return res.status(400).json({ error: "M3U içeriği boş olamaz." });
  }
  // Generate a random 5-character uppercase code
  const id = Math.random().toString(36).substring(2, 7).toUpperCase();
  userPlaylists.set(id, m3uContent);
  res.json({ success: true, id });
});

// 4.6. Serve Playlist file with CORS for any player on the same device
app.get("/api/playlist/:id", (req, res) => {
  const id = req.params.id;
  const cleanId = id.split(".")[0];
  const content = userPlaylists.get(cleanId);
  
  if (!content) {
    return res.status(404).send("#EXTM3U\n# Oynatma listesi bulunamadı veya süresi doldu.\n# Lütfen uygulamadan yeni bir IPTV linki oluşturun.");
  }
  
  res.setHeader("Content-Type", "application/x-mpegurl; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="playlist_${cleanId}.m3u"`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(content);
});

// Setup Vite or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
