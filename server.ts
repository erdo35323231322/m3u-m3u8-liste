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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
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
      }
    });

    const jsonText = response.text?.trim() || "[]";
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
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
      }
    });

    const jsonText = response.text?.trim() || "[]";
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
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
      }
    });

    const jsonText = response.text?.trim() || "[]";
    const logos = JSON.parse(jsonText);
    res.json({ success: true, logos });
  } catch (error: any) {
    res.status(500).json({ error: `Logo arama hatası: ${error.message}` });
  }
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
