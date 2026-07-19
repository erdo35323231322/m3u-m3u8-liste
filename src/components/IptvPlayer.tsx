import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Square, Volume2, VolumeX, Shield, ShieldAlert, Zap, Radio, Tv, Settings, Globe, HelpCircle, RefreshCw, X, Maximize2, Minimize2, Move } from 'lucide-react';
import { PlaylistItem } from '../types';

interface IptvPlayerProps {
  currentStream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string };
  onAddressCreate?: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => void;
  isFloating?: boolean;
  onToggleFloating?: () => void;
  onClose?: () => void;
}

export default function IptvPlayer({ 
  currentStream, 
  onAddressCreate,
  isFloating = false,
  onToggleFloating,
  onClose
}: IptvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const [proxyUserAgent, setProxyUserAgent] = useState('VLC/3.0.18');
  const [proxyReferer, setProxyReferer] = useState('');
  const [showProxyConfig, setShowProxyConfig] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRadio, setIsRadio] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  // Predefined User-Agent Presets
  const userAgentPresets = [
    { name: 'VLC Media Player', value: 'VLC/3.0.18' },
    { name: 'TiviMate IPTV', value: 'TiviMate/4.7.0 (Xiaomi/MiBOX4)' },
    { name: 'IPTV Smarters Pro', value: 'IPTV-Smarters-Pro' },
    { name: 'Standard Browser', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  ];

  // Construct final playback URL depending on Proxy option and custom headers
  const getPlayableUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    if (useProxy) {
      let queryParams = `url=${encodeURIComponent(rawUrl)}`;
      if (proxyUserAgent) {
        queryParams += `&userAgent=${encodeURIComponent(proxyUserAgent)}`;
      }
      if (proxyReferer) {
        queryParams += `&referer=${encodeURIComponent(proxyReferer)}`;
      }
      
      if (rawUrl.includes('.m3u8') || rawUrl.includes('.m3u')) {
        return `/api/proxy-playlist?${queryParams}`;
      } else {
        return `/api/proxy?${queryParams}`;
      }
    }
    return rawUrl;
  };

  const streamUrl = currentStream.url;

  useEffect(() => {
    // Detect stream type (either by explicit type or url suffix)
    const urlLower = streamUrl.toLowerCase();
    const detectedRadio = currentStream.type === 'radyo' || 
      (urlLower.includes('.mp3') || urlLower.includes('.aac') || urlLower.includes('radio') || urlLower.includes('/stream') && !urlLower.includes('.m3u8'));
    setIsRadio(detectedRadio);
    setErrorMsg(null);
    setIsPlaying(false);
  }, [currentStream]);

  // Handle Video (TV) Stream Loading
  useEffect(() => {
    if (isRadio || !currentStream.url || !videoRef.current) return;

    const video = videoRef.current;
    const playUrl = getPlayableUrl(currentStream.url);

    // Reset previous HLS instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentStream.url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(playUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play()
            .then(() => setIsPlaying(true))
            .catch((e) => {
              console.log("Auto-play blocked:", e);
              setIsPlaying(false);
            });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!useProxy) {
                  setErrorMsg("Doğrudan bağlantı başarısız oldu. Güvenli Proxy modu otomatik olarak aktifleştirilip yeniden yükleniyor...");
                  setUseProxy(true);
                } else {
                  setErrorMsg("Yayın sunucusuna bağlanılamadı. Link geçersiz/çevrimdışı olabilir, veya özel User-Agent doğrulaması gerektiriyor olabilir. Lütfen 'CORS Güvenli Proxy' altındaki dişli simgesinden 'TiviMate IPTV' veya 'VLC Media Player' ayarını deneyin.");
                }
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setErrorMsg("Medya hatası: Akış formatı veya video codec bileşenleri bu tarayıcıyla uyumsuz.");
                hls.recoverMediaError();
                break;
              default:
                setErrorMsg("Yayın yüklenirken bir sorun oluştu. Bağlantı adresi (URL) geçersiz, süresi dolmuş veya ülke dışı kısıtlamalı olabilir.");
                hlsRef.current?.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native safari HLS support
        video.src = playUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        });
        video.onerror = () => {
          if (!useProxy) {
            setUseProxy(true);
            setErrorMsg("Güvenli Proxy modu otomatik olarak aktifleştiriliyor...");
          } else {
            setErrorMsg("Yayın yüklenemedi. Link çevrimdışı, şifreli ya da erişilemez durumda.");
          }
        };
      } else {
        setErrorMsg("Tarayıcınız HLS (.m3u8) yayınlarını desteklemiyor.");
      }
    } else {
      // Normal video (mp4, webm)
      video.src = playUrl;
      video.load();
      video.play()
        .then(() => {
          setIsPlaying(true);
          setErrorMsg(null);
        })
        .catch(() => {
          if (!useProxy) {
            setUseProxy(true);
            setErrorMsg("Proxy modu aktifleştirilip yeniden deneniyor...");
          } else {
            setErrorMsg("Medya başlatılamadı. Linki kontrol edin veya Proxy ayarlarından User-Agent değiştirmeyi deneyin.");
          }
        });
      video.onerror = () => {
        if (!useProxy) {
          setUseProxy(true);
        } else {
          setErrorMsg("Yayın adresi yanıt vermedi veya video formatı desteklenmiyor.");
        }
      };
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentStream.url, useProxy, isRadio]);

  // Handle Radio Stream Loading
  useEffect(() => {
    if (!isRadio || !currentStream.url || !audioRef.current) return;

    const audio = audioRef.current;
    const playUrl = getPlayableUrl(currentStream.url);
    
    audio.src = playUrl;
    audio.load();
    
    audio.play()
      .then(() => {
        setIsPlaying(true);
        setErrorMsg(null);
      })
      .catch((err) => {
        console.error("Audio error:", err);
        if (!useProxy) {
          setUseProxy(true);
          setErrorMsg("Radyo doğrudan bağlanamadı, Güvenli Proxy modu otomatik olarak aktifleştiriliyor...");
        } else {
          setErrorMsg("Radyo yayını başlatılamadı. Link geçersiz/çevrimdışı olabilir ya da tarayıcı formatıyla uyumsuz.");
        }
        setIsPlaying(false);
      });

    return () => {
      audio.pause();
    };
  }, [currentStream.url, useProxy, isRadio]);

  // Volume Control
  useEffect(() => {
    const media = isRadio ? audioRef.current : videoRef.current;
    if (media) {
      media.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, isRadio]);

  const togglePlay = () => {
    const media = isRadio ? audioRef.current : videoRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
      setIsPlaying(false);
    } else {
      media.play()
        .then(() => setIsPlaying(true))
        .catch(() => setErrorMsg("Oynatma başlatılamadı. Kullanıcı etkileşimi gerekiyor."));
    }
  };

  return (
    <div id="iptv-player-container" className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Player Premium Title Bar */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-850/60 select-none">
        <div className="flex items-center space-x-2 min-w-0">
          {isFloating ? (
            <Move className="w-4 h-4 text-blue-400 animate-pulse shrink-0 cursor-grab" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          )}
          <span className="text-xs font-bold text-slate-200 truncate">{currentStream.name || 'Önizleme Oynatıcı'}</span>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          {onToggleFloating && (
            <button
              onClick={onToggleFloating}
              className={`p-1 hover:bg-slate-800 rounded transition cursor-pointer ${isFloating ? 'text-blue-400' : 'text-slate-400 hover:text-blue-400'}`}
              title={isFloating ? "Sabitle (Gride Döndür)" : "Yüzen Oynatıcı Moduna Geç (Küçük Boyut)"}
            >
              {isFloating ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-rose-500/10 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
              title="Oynatıcıyı Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Player Screen */}
      <div className="relative flex-1 bg-black flex items-center justify-center min-h-[220px] max-h-[480px]">
        {isRadio ? (
          /* Radio Screen Visualizer */
          <div className="flex flex-col items-center justify-center space-y-6 text-center p-8 w-full h-full bg-gradient-to-b from-slate-950 to-slate-900">
            <div className="relative">
              {/* Radio Icon Container with Pulse effect */}
              <div className={`w-28 h-28 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}>
                <Radio className={`w-12 h-12 text-blue-400 ${isPlaying ? 'scale-110 transition-transform duration-700' : ''}`} />
              </div>
              {currentStream.logo && (
                <img 
                  src={currentStream.logo} 
                  alt="" 
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-lg border border-slate-800 bg-white object-contain p-0.5"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            
            <div className="max-w-md">
              <h4 className="text-lg font-medium text-slate-100 line-clamp-1">{currentStream.name || 'Bilinmeyen Radyo'}</h4>
              <p className="text-xs text-blue-400 mt-1 font-mono tracking-wider">
                {isPlaying ? 'CANLI YAYIN OYNATILIYOR' : 'DURDURULDU'}
              </p>
            </div>

            {/* Simulated Live Audio Waves */}
            <div className="flex items-center space-x-1 h-8">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-blue-400 rounded-full transition-all duration-300"
                  style={{
                    height: isPlaying ? `${Math.floor(Math.random() * 24) + 6}px` : '4px',
                    animation: isPlaying ? `bounce 1s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>

            <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
          </div>
        ) : (
          /* Video/TV Player Screen */
          <div className="relative w-full h-full aspect-video flex items-center justify-center bg-black">
            <video 
              ref={videoRef} 
              className="w-full h-full object-contain"
              playsInline
              crossOrigin="anonymous"
              onClick={togglePlay}
            />
            
            {/* Ambient Shadow Overlays */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-3 cursor-pointer" onClick={togglePlay}>
                <div className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transform transition hover:scale-105">
                  <Play className="w-8 h-8 fill-current ml-1" />
                </div>
                <span className="text-xs font-medium text-slate-300">Yayın Akışını Başlat</span>
              </div>
            )}

            {currentStream.logo && (
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1.5 rounded-lg border border-slate-800 flex items-center space-x-2">
                <img 
                  src={currentStream.logo} 
                  alt="Logo" 
                  className="w-8 h-8 rounded object-contain bg-white p-0.5"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              </div>
            )}
            
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800 text-[10px] text-slate-300 flex items-center space-x-1.5 font-medium uppercase tracking-wider">
              <Tv className="w-3.5 h-3.5 text-blue-400" />
              <span>TV CANLI</span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-950/90 border border-red-800/80 p-3 rounded-xl flex items-start space-x-3 text-red-200 text-xs backdrop-blur-md">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Bağlantı Hatası</p>
              <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-slate-900 border-t border-slate-800/80 p-4 space-y-4">
        {/* Info & Action Panel */}
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <h3 className="text-slate-100 font-medium text-base truncate flex items-center gap-2">
              {currentStream.name || 'Seçili Kanal Yok'}
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${currentStream.type === 'tv' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                {currentStream.type === 'tv' ? 'CANLI TV' : 'RADYO'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-mono truncate mt-1 select-all">{currentStream.url || 'Oynatılacak bir yayın seçin'}</p>
          </div>

          <div className="w-full">
            {/* Create Playlist Item Button */}
            {onAddressCreate && currentStream.url && (
              <button
                id="create-address-btn"
                onClick={() => onAddressCreate(currentStream)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-full flex items-center justify-center space-x-2 font-bold shadow-xl border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all cursor-pointer text-xs"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>ADRES OLUŞTUR VE LİSTEYE EKLE</span>
              </button>
            )}
          </div>
        </div>

        {/* Media Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-slate-300 text-xs">
          {/* Left: Play/Pause/Stop */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={togglePlay}
              disabled={!currentStream.url}
              className={`p-2.5 rounded-full transition cursor-pointer ${!currentStream.url ? 'text-slate-600 bg-slate-900' : 'text-slate-100 bg-slate-800 hover:bg-slate-700'}`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Volume controls */}
            <div className="flex items-center space-x-1.5">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-16 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Right: Proxy option */}
          <div className="flex items-center gap-2">
            {onToggleFloating && (
              <button
                onClick={onToggleFloating}
                className={`p-1.5 rounded transition ${isFloating ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400 hover:text-blue-450 border border-slate-700/60'} cursor-pointer`}
                title={isFloating ? "Sabitle (Gride Döndür)" : "Yüzen Oynatıcı Modu (Serbest Sürükle)"}
              >
                <Move className="w-4 h-4" />
              </button>
            )}

            {useProxy && (
              <button
                onClick={() => setShowProxyConfig(!showProxyConfig)}
                className={`p-1.5 rounded transition ${showProxyConfig ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700/60'}`}
                title="Gelişmiş Proxy Ayarları"
              >
                <Settings className="w-4 h-4 animate-spin-slow" />
              </button>
            )}

            <div className="flex items-center space-x-4 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
              <div className="flex items-center space-x-2">
                <Shield className={`w-4 h-4 ${useProxy ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className="text-[11px] font-medium text-slate-400">CORS Güvenli Proxy</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useProxy} 
                  onChange={() => {
                    const nextVal = !useProxy;
                    setUseProxy(nextVal);
                    if (nextVal) setShowProxyConfig(true);
                  }} 
                  className="sr-only peer" 
                />
                <div className="w-8 h-4.5 bg-slate-700 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-black peer-checked:after:border-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Expanded Proxy Options */}
        {useProxy && showProxyConfig && (
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-250">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-blue-400" />
                Proxy ve İstek Üstbilgi Seçenekleri (Proxy Headers)
              </span>
              <button 
                onClick={() => setShowProxyConfig(false)}
                className="text-[10px] text-slate-500 hover:text-slate-400"
              >
                Kapat
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Agent selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Globe className="w-3 h-3 text-blue-400" />
                  Tarayıcı Kimliği (User-Agent)
                </label>
                <select
                  value={proxyUserAgent}
                  onChange={(e) => setProxyUserAgent(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                >
                  {userAgentPresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.name}
                    </option>
                  ))}
                  <option value="">İletme (Boş Bırak)</option>
                </select>
                <p className="text-[9px] text-slate-600 leading-tight">
                  Bazı IPTV sağlayıcıları VLC dışındaki istemcileri engeller. Engellemeyi aşmak için VLC seçin.
                </p>
              </div>

              {/* Referer input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-blue-400" />
                  Referer (Yönlendiren Adres)
                </label>
                <input
                  type="text"
                  placeholder="Örn: https://canlitv.com/"
                  value={proxyReferer}
                  onChange={(e) => setProxyReferer(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-600"
                />
                <p className="text-[9px] text-slate-600 leading-tight">
                  Sadece belirli bir siteden gelen istekleri kabul eden yayınlar için sitenin adresini girin.
                </p>
              </div>
            </div>

            {/* Custom User Agent Manual Text Input if they want to override */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-slate-500">Seçili Tarayıcı Kimliği Değeri:</label>
              <input
                type="text"
                value={proxyUserAgent}
                onChange={(e) => setProxyUserAgent(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-850 text-slate-400 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
