import React, { useState, useEffect } from 'react';
import { PlaylistItem, Playlist } from './types';
import IptvPlayer from './components/IptvPlayer';
import BrowserInspector from './components/BrowserInspector';
import ChannelPresets, { PRESET_CHANNELS } from './components/ChannelPresets';
import M3uListPreview from './components/M3uListPreview';
import { Tv, Radio, HelpCircle, Check, Sparkles, Shield, Compass, Heart } from 'lucide-react';
import { findLogoForChannel } from './lib/logoDatabase';

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

  const [activeRightTab, setActiveRightTab] = useState<'presets' | 'inspector'>('presets');
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
    showNotification(`"${stream.name}" önizleme oynatıcıya yüklendi.`, 'info');
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
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">v2.4.0</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Android M3U Optimizer</p>
            </div>
          </div>

          {/* Quick Platform Stats */}
          <div className="flex items-center space-x-4">
            <div className="bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 flex items-center space-x-2 text-xs">
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
            <IptvPlayer 
              currentStream={activeStream} 
              onAddressCreate={handleAddStream}
            />
          </div>

          {/* Right: 7 Columns for Presets & Advanced Web Inspectors */}
          <div className="lg:col-span-7 flex flex-col h-full space-y-4">
            
            {/* Tab Header Selector */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveRightTab('presets')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer ${activeRightTab === 'presets' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Compass className="w-4 h-4" />
                <span>Hazır Yayınlar Kütüphanesi</span>
              </button>
              
              <button
                onClick={() => setActiveRightTab('inspector')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer ${activeRightTab === 'inspector' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Yayın Linki Sniffer / Yakalayıcı</span>
              </button>
            </div>

            {/* Active Workspace Component */}
            <div className="flex-1">
              {activeRightTab === 'presets' ? (
                <ChannelPresets 
                  onSelectStream={handleSelectStream}
                  onAddStreamToList={handleAddStream}
                />
              ) : (
                <BrowserInspector 
                  onSelectStream={handleSelectStream}
                  onAddStreamToList={handleAddStream}
                />
              )}
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
            <span>STREAMLINK V2.4.0</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
