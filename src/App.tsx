import React, { useState, useEffect } from 'react';
import { PlaylistItem, Playlist } from './types';
import IptvPlayer from './components/IptvPlayer';
import BrowserInspector from './components/BrowserInspector';
import SoftwareUpdateModal from './components/SoftwareUpdateModal';
import M3uListPreview from './components/M3uListPreview';
import { Tv, Radio, HelpCircle, Check, Sparkles, Shield, Compass, Heart, Smartphone, RefreshCw, X, Minimize2, Maximize2, Move, Eye } from 'lucide-react';
import { findLogoForChannel } from './lib/logoDatabase';
import { motion } from 'motion/react';

export default function App() {
  // Multiple playlists state with localStorage fallback
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('streamlink_playlists');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error loading playlists from localStorage", e);
      }
    }
    // Default initial playlists
    return [
      {
        id: 'default',
        name: 'Ana Çalma Listesi',
        items: [
          {
            id: 1,
            name: "TRT 1 HD",
            url: "https://tv-trt1.medya.trt.com.tr/trt/trt1/index.m3u8",
            type: "tv",
            logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/TRT_1_logo.svg",
            group: "TR: Ulusal"
          },
          {
            id: 2,
            name: "TRT Spor",
            url: "https://tv-trtspor.medya.trt.com.tr/trt/trtspor/index.m3u8",
            type: "tv",
            logo: "https://upload.wikimedia.org/wikipedia/commons/2/29/TRT_Spor_logo.svg",
            group: "TR: Spor"
          },
          {
            id: 3,
            name: "Kral FM",
            url: "https://dogus-live.daioncdn.net/kralfm/kralfm.m3u8",
            type: "radyo",
            logo: "https://upload.wikimedia.org/wikipedia/tr/4/4c/Kral_Fm_Logo.png",
            group: "TR: Radyo"
          }
        ]
      }
    ];
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    const savedId = localStorage.getItem('streamlink_active_playlist_id');
    return savedId || 'default';
  });

  // Keep localStorage in sync
  useEffect(() => {
    localStorage.setItem('streamlink_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('streamlink_active_playlist_id', activePlaylistId);
  }, [activePlaylistId]);

  // Derive active playlist and items
  const activePlaylist = playlists.find(p => p.id === activePlaylistId) || playlists[0] || { id: 'default', name: 'Ana Çalma Listesi', items: [] };
  const items = activePlaylist.items;

  // Active stream currently loaded in the built-in media player
  const [activeStream, setActiveStream] = useState<{ name: string; url: string; type: 'tv' | 'radyo'; logo?: string }>({
    name: "TRT 1 HD",
    url: "https://tv-trt1.medya.trt.com.tr/trt/trt1/index.m3u8",
    type: "tv",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/TRT_1_logo.svg"
  });

  const [isFloating, setIsFloating] = useState<boolean>(() => {
    return localStorage.getItem('streamlink_player_floating') === 'true';
  });
  const [isPlayerVisible, setIsPlayerVisible] = useState<boolean>(() => {
    return localStorage.getItem('streamlink_player_visible') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('streamlink_player_floating', isFloating ? 'true' : 'false');
  }, [isFloating]);

  useEffect(() => {
    localStorage.setItem('streamlink_player_visible', isPlayerVisible ? 'true' : 'false');
  }, [isPlayerVisible]);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState(() => {
    return localStorage.getItem('streamlink_app_version') || 'v2.4.0';
  });
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Auto hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (text: string, type: 'success' | 'info' = 'success') => {
    setNotification({ text, type });
  };

  // Add stream to active list with auto sequential index
  const handleAddStream = (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string; group?: string }) => {
    // Check if URL already exists in active playlist
    const exists = items.some(item => item.url === stream.url);
    if (exists) {
      showNotification(`"${stream.name}" zaten "${activePlaylist.name}" listenizde bulunuyor!`, 'info');
      return;
    }

    // Auto find popular logo if missing
    let finalLogo = stream.logo;
    let finalGroup = stream.group;
    if (!finalLogo || finalLogo.trim() === "") {
      const matched = findLogoForChannel(stream.name);
      if (matched) {
        finalLogo = matched.logo;
        if (!finalGroup) {
          finalGroup = matched.group;
        }
      }
    }

    const newItem: PlaylistItem = {
      id: items.length + 1,
      name: stream.name,
      url: stream.url,
      type: stream.type,
      logo: finalLogo,
      group: finalGroup || (stream.type === 'tv' ? 'TV' : 'Radyo'),
    };

    setPlaylists(prev => prev.map(p => p.id === activePlaylistId ? { ...p, items: [...p.items, newItem] } : p));
    showNotification(`"${stream.name}" "${activePlaylist.name}" listesine sırayla (${newItem.id}. satır) eklendi!`);
  };

  const handleSelectStream = (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => {
    setActiveStream(stream);
    setIsPlayerVisible(true);
    showNotification(`"${stream.name}" önizleme oynatıcıya yüklendi.`, 'info');
  };

  const handleAutoUpdateChannelUrl = (originalUrl: string, newUrl: string, newLogo?: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === activePlaylistId) {
        return {
          ...p,
          items: p.items.map(item => {
            if (item.url === originalUrl) {
              return {
                ...item,
                url: newUrl,
                ...(newLogo ? { logo: newLogo } : {})
              };
            }
            return item;
          })
        };
      }
      return p;
    }));

    setActiveStream(prev => {
      if (prev.url === originalUrl) {
        return {
          ...prev,
          url: newUrl,
          ...(newLogo ? { logo: newLogo } : {})
        };
      }
      return prev;
    });

    showNotification(`"${activeStream.name}" için yeni çalışan link bulundu ve listeniz güncellendi!`, 'success');
  };

  const handleNextChannel = () => {
    if (!items || items.length === 0) return;
    const currentIndex = items.findIndex(item => item.url === activeStream.url);
    if (currentIndex === -1) {
      handleSelectStream(items[0]);
    } else {
      const nextIndex = (currentIndex + 1) % items.length;
      handleSelectStream(items[nextIndex]);
    }
  };

  const handlePrevChannel = () => {
    if (!items || items.length === 0) return;
    const currentIndex = items.findIndex(item => item.url === activeStream.url);
    if (currentIndex === -1) {
      handleSelectStream(items[items.length - 1]);
    } else {
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      handleSelectStream(items[prevIndex]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-400">
      
      {/* Dynamic Top Notification */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border text-xs font-semibold backdrop-blur-md ${
            notification.type === 'success' 
              ? 'bg-slate-950/90 border-emerald-500/30 text-emerald-300' 
              : 'bg-slate-950/90 border-blue-500/30 text-blue-300'
          }`}>
            <Check className="w-4 h-4 shrink-0" />
            <span>{notification.text}</span>
          </div>
        </div>
      )}

      {/* Main Premium Navbar */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2 justify-center sm:justify-start">
                <h1 className="text-white font-bold tracking-tight text-lg">StreamLink Studio</h1>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{appVersion}</span>
                {appVersion === 'v2.4.0' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Android M3U Optimizer</p>
            </div>
          </div>

          {/* Quick Platform Stats */}
          <div className="flex items-center space-x-3 flex-wrap justify-center sm:justify-end gap-y-2">
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shrink-0"
              title="Yazılımı otomatik güncelleyin veya Android APK dosyasını derleyip indirin"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Sistem & APK Güncelle</span>
              {appVersion === 'v2.4.0' && (
                <span className="bg-indigo-500 text-white font-bold text-[8px] px-1.5 py-0.25 rounded">YENİ</span>
              )}
            </button>

            <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800 flex items-center space-x-2 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-slate-400">Cihaz Hazır: Android TV / Mobile</span>
            </div>
            
            <a 
              href="#m3u-list-preview-panel" 
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded border border-blue-400/30 transition shadow-lg shrink-0"
            >
              Listeyi Dışa Aktar (.m3u)
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section Info Card */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-850 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-[10px] uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>Nasıl Çalışır?</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                Bu uygulama, Android cihazlar için özel M3U/M3U8 çalma listeleri oluşturmanuzu sağlar. Eklenen her yeni yayın otomatik olarak <span className="text-blue-400 font-mono font-bold">1, 2, 3</span> şeklinde sıralanarak yeni satıra yazılır. Listeyi Android TV'nize aktardığınızda kanallarınız tam belirttiğiniz düzende açılır.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0 border-t border-slate-900 md:border-0 pt-3 md:pt-0">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Ekli Kanallar</p>
                <p className="text-lg font-bold text-blue-400 mt-1 font-mono">{items.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Oynatıcı</p>
                <p className="text-xs font-bold text-indigo-400 mt-2 flex items-center justify-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>CORS Aktif</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        
        {/* Top Segment: Player and Utility Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: 5 Columns for the Built-In Media Player */}
          <div className="lg:col-span-5 h-full">
            {!isPlayerVisible ? (
              /* Player closed state placeholder */
              <div className="bg-slate-950/40 border border-slate-800 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[350px] space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <Tv className="w-6 h-6 text-slate-500" />
                </div>
                <div className="max-w-xs">
                  <p className="text-xs font-semibold text-slate-300">Oynatıcı Kapalı</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Önizleme oynatıcı kapatıldı. Kanal listesinden herhangi bir kanala tıklayarak oynatıcıyı açabilirsiniz veya aşağıdaki butona basabilirsiniz.
                  </p>
                </div>
                <button
                  onClick={() => setIsPlayerVisible(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-blue-500/10"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Oynatıcıyı Göster</span>
                </button>
              </div>
            ) : isFloating ? (
              /* Player in floating mode placeholder in the grid */
              <div className="bg-slate-950/40 border border-slate-800 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[350px] space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Move className="w-6 h-6 text-blue-400 animate-pulse" />
                </div>
                <div className="max-w-xs">
                  <p className="text-xs font-semibold text-blue-400">Yüzen Oynatıcı Aktif</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Oynatıcı şu an küçük boyutlu olarak ekranın üzerinde serbestçe gezdirilebilir (Yüzen Mod) durumdadır. Sürükleyerek konumlandırabilirsiniz.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setIsFloating(false)}
                    className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded text-[11px] font-bold transition cursor-pointer"
                  >
                    Normal Görünüme Döndür
                  </button>
                  <button
                    onClick={() => setIsPlayerVisible(false)}
                    className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-450 border border-rose-500/20 rounded text-[11px] font-bold transition cursor-pointer"
                  >
                    Oynatıcıyı Kapat
                  </button>
                </div>
              </div>
            ) : (
              /* Normal inline mode player */
              <IptvPlayer 
                currentStream={activeStream} 
                onAddressCreate={handleAddStream}
                isFloating={false}
                onToggleFloating={() => setIsFloating(true)}
                onClose={() => setIsPlayerVisible(false)}
                onAutoUpdateChannelUrl={handleAutoUpdateChannelUrl}
                onNextChannel={handleNextChannel}
                onPrevChannel={handlePrevChannel}
              />
            )}
          </div>

          {/* Right: 7 Columns for Advanced Web Sniffer & Inspector */}
          <div className="lg:col-span-7 flex flex-col h-full space-y-4">
            
            {/* Active Workspace Component */}
            <div className="flex-1">
              <BrowserInspector 
                onSelectStream={handleSelectStream}
                onAddStreamToList={handleAddStream}
              />
            </div>

          </div>

        </div>

        {/* Bottom Segment: The playlist compiler, code output, and sorting center */}
        <div className="border-t border-slate-800 pt-6">
          <M3uListPreview 
            items={items}
            onUpdateItems={(newItems) => {
              setPlaylists(prev => prev.map(p => p.id === activePlaylistId ? { ...p, items: newItems } : p));
            }}
            onSelectStream={handleSelectStream}
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            onSelectPlaylist={setActivePlaylistId}
            onUpdatePlaylists={setPlaylists}
          />
        </div>

      </main>

      {/* Elegant minimalist footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-6 text-center text-[10px] text-slate-600 tracking-wide mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Android M3U Çalma Listesi Oluşturucu. Tüm hakları saklıdır.</p>
          <div className="flex items-center space-x-4">
            <span>PLATFORM: ANDROID SDK 33</span>
            <span>BUFFER: 1024KB</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> 
              SUNUCU BAĞLI
            </span>
            <span>STREAMLINK {appVersion.toUpperCase()}</span>
          </div>
        </div>
      </footer>

      {/* Software Update and APK Builder Modal */}
      <SoftwareUpdateModal 
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={appVersion}
        onUpdateSuccess={(newVersion) => {
          setAppVersion(newVersion);
          localStorage.setItem('streamlink_app_version', newVersion);
          showNotification(`Yazılım başarıyla ${newVersion} sürümüne güncellendi!`, 'success');
        }}
      />

      {/* Floating Draggable Mini Player */}
      {isPlayerVisible && isFloating && (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.05}
          initial={{ x: 0, y: 0 }}
          className="fixed bottom-6 right-6 z-50 w-[320px] md:w-[360px] shadow-2xl rounded-2xl overflow-hidden border border-blue-500/30 bg-slate-950 flex flex-col"
          style={{ touchAction: 'none' }}
        >
          <IptvPlayer 
            currentStream={activeStream} 
            onAddressCreate={handleAddStream}
            isFloating={true}
            onToggleFloating={() => setIsFloating(false)}
            onClose={() => setIsPlayerVisible(false)}
            onAutoUpdateChannelUrl={handleAutoUpdateChannelUrl}
            onNextChannel={handleNextChannel}
            onPrevChannel={handlePrevChannel}
          />
        </motion.div>
      )}

    </div>
  );
}
