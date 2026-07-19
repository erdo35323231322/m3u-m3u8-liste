import React, { useState, useRef } from 'react';
import { Search, Code, AlertCircle, Sparkles, Loader2, Play, Plus, Globe, ListPlus, Radio, FolderArchive, FileSearch, Trash2 } from 'lucide-react';
import { ExtractedChannel } from '../types';
import JSZip from 'jszip';

interface ExtractedApkUrl {
  url: string;
  sourceFile: string;
  category: 'playlist' | 'portal' | 'other';
  name: string;
}

interface BrowserInspectorProps {
  onSelectStream: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => void;
  onAddStreamToList: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string; group?: string }) => void;
}

export default function BrowserInspector({ onSelectStream, onAddStreamToList }: BrowserInspectorProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'html' | 'manual' | 'apk'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedChannels, setExtractedChannels] = useState<ExtractedChannel[]>([]);

  // APK Parser states
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [apkParsingProgress, setApkParsingProgress] = useState<string | null>(null);
  const [extractedApkUrls, setExtractedApkUrls] = useState<ExtractedApkUrl[]>([]);
  const [apkIsLoading, setApkIsLoading] = useState(false);
  const [apkFilter, setApkFilter] = useState<'all' | 'playlist' | 'portal' | 'other'>('all');
  const [apkSearchQuery, setApkSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual inputs
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualType, setManualType] = useState<'tv' | 'radyo'>('tv');
  const [manualLogo, setManualLogo] = useState('');
  const [manualGroup, setManualGroup] = useState('Ulusal');

  // Trigger server-side AI extraction
  const handleExtract = async (type: 'url' | 'html') => {
    setIsLoading(true);
    setErrorMsg(null);
    setExtractedChannels([]);

    try {
      const payload: any = {};
      if (type === 'url') {
        if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://')) {
          throw new Error('Lütfen "http://" veya "https://" ile başlayan geçerli bir URL girin.');
        }
        payload.url = urlInput;
      } else {
        if (!htmlInput.trim()) {
          throw new Error('Lütfen analiz edilecek HTML veya kaynak kodunu yapıştırın.');
        }
        payload.htmlContent = htmlInput;
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Yayın linkleri çıkarılırken hata oluştu.');
      }

      if (data.channels && data.channels.length > 0) {
        setExtractedChannels(data.channels);
      } else {
        setErrorMsg('Yazılım/metin içerisinde doğrudan oynatılabilir TV veya Radyo yayın linki tespit edilemedi. Farklı bir sayfa deneyebilirsiniz.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir bağlantı hatası oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddManual = () => {
    if (!manualName.trim() || !manualUrl.trim()) {
      alert('Kanal adı ve yayın linki (URL) alanları boş bırakılamaz!');
      return;
    }

    const item = {
      name: manualName,
      url: manualUrl,
      type: manualType,
      logo: manualLogo || undefined,
      group: manualGroup || undefined
    };

    onAddStreamToList(item);
    
    // Clear inputs after successful add
    setManualName('');
    setManualUrl('');
    setManualLogo('');
  };

  const cleanUrl = (rawUrl: string): string => {
    let url = rawUrl;
    // Remove any trailing delimiters often found in code/bytecode
    url = url.replace(/["'()\[\]{},;\\<>]+$/, '');
    return url;
  };

  const handleParseApk = async (file: File) => {
    setApkIsLoading(true);
    setApkParsingProgress('Dosya okunuyor...');
    setErrorMsg(null);
    setExtractedApkUrls([]);

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      const files = Object.keys(content.files);
      setApkParsingProgress(`Dosya açıldı. Toplam ${files.length} öge taranıyor...`);

      const discoveredUrls: ExtractedApkUrl[] = [];
      const seenUrls = new Set<string>();

      // Filter files to analyze (DEX files, and text/asset config files)
      const targetFiles = files.filter(name => {
        const lowerName = name.toLowerCase();
        // Skip common large image files, libraries, etc.
        if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp') || lowerName.endsWith('.gif')) {
          return false;
        }
        if (lowerName.endsWith('.so') || lowerName.endsWith('.ttf') || lowerName.endsWith('.otf') || lowerName.endsWith('.wav') || lowerName.endsWith('.mp3')) {
          return false;
        }
        return (
          lowerName.endsWith('.dex') ||
          lowerName.endsWith('.json') ||
          lowerName.endsWith('.xml') ||
          lowerName.endsWith('.txt') ||
          lowerName.endsWith('.cfg') ||
          lowerName.endsWith('.ini') ||
          lowerName.endsWith('.properties') ||
          lowerName.endsWith('.js') ||
          lowerName.endsWith('.html') ||
          lowerName.includes('assets/') ||
          lowerName.includes('res/raw/')
        );
      });

      let analyzedCount = 0;
      for (const name of targetFiles) {
        analyzedCount++;
        if (analyzedCount % 5 === 0 || analyzedCount === targetFiles.length) {
          setApkParsingProgress(`Taranıyor: ${name} (${analyzedCount}/${targetFiles.length})`);
        }

        const zipEntry = content.files[name];
        if (zipEntry.dir) continue;

        // Extract as Uint8Array then decode with utf-8 or latin1
        const rawBytes = await zipEntry.async('uint8array');
        if (rawBytes.length === 0) continue;

        // Decode using TextDecoder. Use 'utf-8' with non-fatal or 'latin1'
        const decodedText = new TextDecoder('latin1').decode(rawBytes);

        // Regex to extract URLs
        const urlRegex = /https?:\/\/[a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=%]+/g;
        let match;
        while ((match = urlRegex.exec(decodedText)) !== null) {
          const rawUrl = match[0];
          const url = cleanUrl(rawUrl);

          // Skip if we already saw this URL
          if (seenUrls.has(url)) continue;

          // Filter out typical Android/Google system schemas and metadata
          const lowerUrl = url.toLowerCase();
          if (
            lowerUrl.includes('schemas.android.com') ||
            lowerUrl.includes('schema.android.com') ||
            lowerUrl.includes('w3.org') ||
            lowerUrl.includes('kotlinlang.org') ||
            lowerUrl.includes('apache.org') ||
            lowerUrl.includes('github.com/google') ||
            lowerUrl.includes('google.com/search') ||
            lowerUrl.includes('crashlytics.com') ||
            lowerUrl.includes('firebaseio.com') ||
            lowerUrl.includes('onesignal.com') ||
            lowerUrl.includes('amplitude.com') ||
            lowerUrl.includes('mixpanel.com') ||
            lowerUrl.includes('facebook.com') ||
            lowerUrl.includes('twitter.com') ||
            lowerUrl.includes('play.google.com') ||
            lowerUrl.includes('android.com') ||
            lowerUrl.includes('apple.com') ||
            lowerUrl.includes('microsoft.com') ||
            lowerUrl.includes('youtube.com/embed') ||
            lowerUrl.includes('wikipedia.org') ||
            // Ignore localhost / dummy URLs unless they end in m3u/m3u8
            (lowerUrl.includes('localhost') && !lowerUrl.includes('.m3u')) ||
            (lowerUrl.includes('127.0.0.1') && !lowerUrl.includes('.m3u'))
          ) {
            continue;
          }

          // Make sure it looks like a valid URL with a TLD or an IP address
          if (!lowerUrl.includes('.') || lowerUrl.length < 12) {
            continue;
          }

          seenUrls.add(url);

          // Classify URL
          let category: 'playlist' | 'portal' | 'other' = 'other';
          let nameLabel = 'Yayın Sunucusu';

          if (lowerUrl.includes('.m3u8') || lowerUrl.includes('.m3u') || lowerUrl.includes('.ts') || lowerUrl.includes('.mp3') || lowerUrl.includes('.mp4')) {
            category = 'playlist';
            // Try to extract a name from the URL path
            const parts = url.split('/');
            const lastPart = parts[parts.length - 1].split('?')[0];
            nameLabel = lastPart ? decodeURIComponent(lastPart) : 'Canlı Yayın Akışı';
          } else if (
            lowerUrl.includes('player_api.php') ||
            lowerUrl.includes('get.php') ||
            lowerUrl.includes('portal.php') ||
            lowerUrl.includes('/c/') ||
            lowerUrl.includes('/client_area/') ||
            lowerUrl.includes('panel') ||
            lowerUrl.includes('xtream') ||
            lowerUrl.includes('xc')
          ) {
            category = 'portal';
            try {
              const parsed = new URL(url);
              nameLabel = `${parsed.hostname} (Xtream / Portal)`;
            } catch {
              nameLabel = 'Xtream Codes Portal';
            }
          } else {
            try {
              const parsed = new URL(url);
              nameLabel = `${parsed.hostname} (Potansiyel Sunucu)`;
            } catch {
              nameLabel = 'Yayın Sunucu Linki';
            }
          }

          discoveredUrls.push({
            url,
            sourceFile: name,
            category,
            name: nameLabel
          });
        }
      }

      setExtractedApkUrls(discoveredUrls);
      setApkParsingProgress(null);
      if (discoveredUrls.length === 0) {
        setErrorMsg('Seçilen APK dosyasının içinde doğrudan IPTV veya çalma listesi linki bulunamadı. Lütfen başka bir IPTV uygulaması APK\'sı deneyin.');
      }
    } catch (err: any) {
      setErrorMsg(`APK açılırken veya çözümlenirken hata oluştu: ${err.message}`);
      setApkParsingProgress(null);
    } finally {
      setApkIsLoading(false);
    }
  };

  return (
    <div id="browser-inspector-panel" className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Yayın Bulucu & Link Yakalayıcı
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Yayın sitelerinden veya kaynak kodlarından direkt yayın linklerini (.m3u8, .mp3 vb.) ayıklayın</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap md:flex-nowrap bg-slate-900 p-1 rounded-lg border border-slate-800 gap-1">
        <button
          onClick={() => setActiveTab('url')}
          className={`flex-1 min-w-[120px] py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${activeTab === 'url' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Yapay Zeka Web Tarayıcı</span>
        </button>
        <button
          onClick={() => setActiveTab('html')}
          className={`flex-1 min-w-[100px] py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${activeTab === 'html' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>HTML Kod Çözücü</span>
        </button>
        <button
          onClick={() => setActiveTab('apk')}
          className={`flex-1 min-w-[100px] py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${activeTab === 'apk' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
          <span>APK Link Yakala</span>
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 min-w-[120px] py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${activeTab === 'manual' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <ListPlus className="w-3.5 h-3.5" />
          <span>Manuel Yayın Ekle</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div className="bg-slate-900/40 p-3.5 rounded border border-slate-800/40 text-[11px] text-slate-400 leading-relaxed">
              İçinde canlı yayın barındıran veya linklerini paylaşan bir internet sitesinin URL'sini aşağıya yazın. Sunucumuz siteyi analiz edecek ve <span className="text-blue-400 font-medium">Gemini Yapay Zekası</span> ile doğrudan akış bağlantılarını (.m3u8 video veya ses akışları) saniyeler içinde çıkaracaktır.
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="https://canlitv-sitesi.com/trt-1-izle"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 placeholder-slate-600 text-xs px-3.5 py-3 rounded border border-slate-800 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
              <button
                onClick={() => handleExtract('url')}
                disabled={isLoading}
                className="px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-semibold rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Yayınları Bul</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'html' && (
          <div className="space-y-4">
            <div className="bg-slate-900/40 p-3.5 rounded border border-slate-800/40 text-[11px] text-slate-400 leading-relaxed">
              İnternet tarayıcınızın <span className="text-slate-200 font-medium font-semibold">"Öğeyi Denetle" (F12)</span> panelinden kopyaladığınız oynatıcı iframe kodunu, HTML kodlarını, Script bloklarını ya da doğrudan ham çalma listesi metnini buraya yapıştırıp analiz edin.
            </div>

            <div className="space-y-2">
              <textarea
                placeholder="Örn: <iframe src='https://embed.canliyayin.com/play?id=123'></iframe>..."
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                className="w-full h-32 bg-slate-950 text-slate-200 placeholder-slate-750 text-xs px-3.5 py-3 rounded border border-slate-800 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono resize-none"
              />
              <button
                onClick={() => handleExtract('html')}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-semibold rounded flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-lg"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-current" />}
                <span>Kodları Çözümle ve Yayın Çıkar</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="bg-slate-900/40 p-4 rounded border border-slate-800/60 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Yayın İsmi</label>
                <input
                  type="text"
                  placeholder="Örn: TRT 1 HD"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kategori / Tip</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as 'tv' | 'radyo')}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="tv">Televizyon (Video)</option>
                  <option value="radyo">Radyo (Ses)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Yayın Adresi (M3U8 / MP3 Linki)</label>
              <input
                type="text"
                placeholder="http://yayin-sunucusu.com/kanal/trt1/playlist.m3u8"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded border border-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grup / Kategori (Android için)</label>
                <input
                  type="text"
                  placeholder="Örn: Ulusal, Haber, Spor, Sinema"
                  value={manualGroup}
                  onChange={(e) => setManualGroup(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logo URL'si (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="https://logo-deposu.com/logo/trt1.png"
                  value={manualLogo}
                  onChange={(e) => setManualLogo(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (manualUrl) {
                    onSelectStream({ name: manualName || 'Test Akışı', url: manualUrl, type: manualType, logo: manualLogo || undefined });
                  } else {
                    alert('Lütfen test etmek için önce bir Yayın Adresi girin.');
                  }
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded border border-slate-850 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Oynatıcıda Test Et</span>
              </button>
              
              <button
                type="button"
                onClick={handleAddManual}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition cursor-pointer flex items-center justify-center space-x-1.5 shadow border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                <span>ADRESİ LİSTEYE EKLE</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'apk' && (
          <div className="space-y-4">
            <div className="bg-slate-900/40 p-3.5 rounded border border-slate-800/40 text-[11px] text-slate-400 leading-relaxed">
              İthal IPTV Android uygulamalarının <span className="text-blue-400 font-medium font-semibold">(.apk)</span> dosyalarını tarayarak içlerinde kodlanmış gizli <span className="text-slate-200 font-medium">m3u / m3u8</span> oynatma listelerini, Xtream Codes API sunucularını ve akış adreslerini yakalayın. Analiz tamamen tarayıcınızda ve <span className="text-blue-400">yerel olarak</span> saniyeler içinde gerçekleşir.
            </div>

            {!apkFile && !apkIsLoading && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-950/10'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-500', 'bg-blue-950/10'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-500', 'bg-blue-950/10');
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.name.endsWith('.apk') || file.name.endsWith('.zip'))) {
                    setApkFile(file);
                    handleParseApk(file);
                  } else {
                    alert('Lütfen geçerli bir .apk dosyası yükleyin!');
                  }
                }}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/45 hover:bg-slate-950 rounded-xl p-8 text-center cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <FolderArchive className="w-6 h-6 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-300">Uygulama (APK) Dosyasını Sürükleyin veya Seçin</p>
                  <p className="text-[10px] text-slate-500">Maksimum hız için tarayıcıda doğrudan işlenir</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".apk"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setApkFile(file);
                      handleParseApk(file);
                    }
                  }}
                  className="hidden" 
                />
              </div>
            )}

            {apkIsLoading && (
              <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-8 text-center space-y-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-300">APK Analiz Ediliyor...</p>
                  <p className="text-[11px] text-blue-400 font-mono leading-tight">{apkParsingProgress}</p>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900 max-w-xs mx-auto">
                  <div className="bg-blue-500 h-full w-4/5 animate-pulse rounded-full"></div>
                </div>
              </div>
            )}

            {extractedApkUrls.length > 0 && !apkIsLoading && (
              <div className="space-y-4">
                {/* APK Header Stats */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileSearch className="w-4 h-4 text-emerald-400" />
                      {apkFile?.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Boyut: {( (apkFile?.size || 0) / (1024 * 1024) ).toFixed(2)} MB • Toplam {extractedApkUrls.length} adres ayıklandı
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setApkFile(null);
                      setExtractedApkUrls([]);
                      setApkSearchQuery('');
                    }}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 px-3 py-1.5 rounded border border-rose-500/20 hover:border-rose-500/30 transition flex items-center justify-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Yeni APK Yükle
                  </button>
                </div>

                {/* Local Search and Pill Filters */}
                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Yakalanan linkler içinde ara... (m3u8, portal, isim, dosya vb.)"
                    value={apkSearchQuery}
                    onChange={(e) => setApkSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 placeholder-slate-700 text-xs px-3 py-2 rounded border border-slate-850 focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setApkFilter('all')}
                      className={`px-3 py-1.5 rounded text-[10px] font-semibold transition cursor-pointer border ${apkFilter === 'all' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
                    >
                      Tümü ({extractedApkUrls.length})
                    </button>
                    <button
                      onClick={() => setApkFilter('playlist')}
                      className={`px-3 py-1.5 rounded text-[10px] font-semibold transition cursor-pointer border ${apkFilter === 'playlist' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
                    >
                      Canlı Yayınlar ({extractedApkUrls.filter(u => u.category === 'playlist').length})
                    </button>
                    <button
                      onClick={() => setApkFilter('portal')}
                      className={`px-3 py-1.5 rounded text-[10px] font-semibold transition cursor-pointer border ${apkFilter === 'portal' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
                    >
                      Xtream Portallar ({extractedApkUrls.filter(u => u.category === 'portal').length})
                    </button>
                    <button
                      onClick={() => setApkFilter('other')}
                      className={`px-3 py-1.5 rounded text-[10px] font-semibold transition cursor-pointer border ${apkFilter === 'other' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
                    >
                      Diğer Sunucular ({extractedApkUrls.filter(u => u.category === 'other').length})
                    </button>
                  </div>
                </div>

                {/* Filtered List */}
                <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {extractedApkUrls.filter(item => {
                    const matchesCategory = apkFilter === 'all' || item.category === apkFilter;
                    const matchesSearch = item.url.toLowerCase().includes(apkSearchQuery.toLowerCase()) || 
                                          item.name.toLowerCase().includes(apkSearchQuery.toLowerCase()) ||
                                          item.sourceFile.toLowerCase().includes(apkSearchQuery.toLowerCase());
                    return matchesCategory && matchesSearch;
                  }).length === 0 ? (
                    <div className="text-center py-8 bg-slate-900/20 border border-slate-850 rounded text-[11px] text-slate-500">
                      Seçilen kriterlere uygun yakalanmış adres bulunamadı.
                    </div>
                  ) : (
                    extractedApkUrls.filter(item => {
                      const matchesCategory = apkFilter === 'all' || item.category === apkFilter;
                      const matchesSearch = item.url.toLowerCase().includes(apkSearchQuery.toLowerCase()) || 
                                            item.name.toLowerCase().includes(apkSearchQuery.toLowerCase()) ||
                                            item.sourceFile.toLowerCase().includes(apkSearchQuery.toLowerCase());
                      return matchesCategory && matchesSearch;
                    }).map((item, index) => (
                      <div key={index} className="bg-slate-900/60 border border-slate-850 p-3 rounded-lg flex flex-col space-y-2 hover:border-slate-800 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{item.name}</h4>
                            <span className="text-[9px] text-slate-500 font-mono">
                              Kaynak Dosya: <span className="text-blue-400">{item.sourceFile}</span>
                            </span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                            item.category === 'playlist' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            item.category === 'portal' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            'bg-slate-800 text-slate-400 border border-slate-750'
                          }`}>
                            {item.category === 'playlist' ? 'YAYIN' : item.category === 'portal' ? 'XTREAM' : 'SUNUCU'}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 bg-black/40 px-2 py-1 rounded font-mono select-all break-all leading-relaxed relative group">
                          {item.url}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => onSelectStream({ name: item.name, url: item.url, type: 'tv' })}
                            className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-300 text-[10px] font-bold rounded border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <Play className="w-3 h-3 fill-current text-blue-400" />
                            <span>Test Et</span>
                          </button>
                          
                          <button
                            onClick={() => onAddStreamToList({ name: item.name, url: item.url, type: 'tv', group: item.category === 'playlist' ? 'APK Playlist' : 'APK Portal' })}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded transition cursor-pointer flex items-center justify-center space-x-1 border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Listeye Ekle</span>
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.url);
                              setCopiedUrl(item.url);
                              setTimeout(() => setCopiedUrl(null), 2000);
                            }}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition shrink-0 cursor-pointer ${copiedUrl === item.url ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300 hover:border-slate-700'}`}
                          >
                            {copiedUrl === item.url ? 'Kopyalandı!' : 'Linki Kopyala'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Results Section */}
        {errorMsg && (
          <div className="mt-4 bg-red-950/20 border border-red-800/40 text-red-300 text-xs p-3.5 rounded flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {extractedChannels.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-300 font-bold text-xs uppercase tracking-widest flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 fill-current" />
                <span>Yapay Zekanın Bulduğu Yayınlar ({extractedChannels.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {extractedChannels.map((channel, index) => (
                <div key={index} className="bg-slate-900/80 border border-slate-800/80 p-3 rounded flex flex-col justify-between space-y-3 hover:border-slate-700 transition">
                  <div className="flex items-start space-x-2.5">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt=""
                        className="w-10 h-10 rounded object-contain bg-white p-0.5 border border-slate-800 shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                        <Radio className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-200 line-clamp-1">{channel.name}</p>
                      <span className="text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 font-mono tracking-wider inline-block mt-1">
                        {channel.group || (channel.type === 'tv' ? 'TV' : 'Radyo')}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono truncate select-all px-1 bg-black/40 rounded py-0.5">
                    {channel.url}
                  </div>

                  <div className="flex items-center space-x-1.5 pt-1">
                    <button
                      onClick={() => onSelectStream(channel)}
                      className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-200 text-[11px] font-medium rounded border border-slate-800 transition cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Test Et</span>
                    </button>
                    <button
                      onClick={() => onAddStreamToList(channel)}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded transition cursor-pointer flex items-center justify-center space-x-1 border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adres Oluştur</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
