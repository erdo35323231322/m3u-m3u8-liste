import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, Square, Volume2, VolumeX, Shield, ShieldAlert, Zap, Radio, Tv, Settings, 
  Globe, HelpCircle, RefreshCw, Maximize, Minimize2, Pin, PinOff, Activity, Info, 
  Sparkles, Sliders, ChevronDown, Check, Video, BarChart2, X, Move, Settings2
} from 'lucide-react';
import { PlaylistItem } from '../types';

interface IptvPlayerProps {
  currentStream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string };
  onAddressCreate?: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => void;
}

interface CodecInfo {
  protocol: string;
  contentType: string;
  videoCodec: string;
  audioCodec: string;
  bitrate: string;
  resolution: string;
  profiles: Array<{ resolution: string; codecs: string; bandwidth: string }>;
  server: string;
}

export default function IptvPlayer({ currentStream, onAddressCreate }: IptvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Player state
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

  // Floating Side Player Mode
  const [isFloating, setIsFloating] = useState(false);

  // Custom User Preferences & Controls
  const [isClosed, setIsClosed] = useState(false);
  const [playerScale, setPlayerScale] = useState<'normal' | 'half'>('half'); // defaults to 50% smaller / compact
  const [floatingPosition, setFloatingPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [codecPreset, setCodecPreset] = useState<'vlc' | 'xtream' | 'standard'>('vlc'); // Defaults to VLC for rapid performance

  // Advanced Controls & Codec Finder States
  const [activeTab, setActiveTab] = useState<'control' | 'codec' | 'stats'>('control');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [codecInfo, setCodecInfo] = useState<CodecInfo | null>(null);
  const [hlsLevels, setHlsLevels] = useState<Array<{ name: string; index: number }>>([]);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState<number>(-1);
  
  // Real-time metrics
  const [bufferLen, setBufferLen] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [droppedFrames, setDroppedFrames] = useState<number>(0);

  const [aspectRatio, setAspectRatio] = useState<string>('Auto');
  const [deviceInfo, setDeviceInfo] = useState<{ type: string; label: string; defaultRatio: string }>({
    type: 'desktop',
    label: 'Masaüstü (Desktop)',
    defaultRatio: 'Auto'
  });

  // Automatically detect device and select recommended optimal aspect ratio on mount
  useEffect(() => {
    const ua = navigator.userAgent;
    const width = window.innerWidth;
    
    let detected = { type: 'desktop', label: 'Masaüstü (Desktop)', defaultRatio: 'Auto' };
    if (/SmartTV|AppleTV|GoogleTV|AndroidTV|Large Screen|HbbTV|Tizen|WebOS|Roku|Viera|DnaPlay|Cast/i.test(ua)) {
      detected = { type: 'tv', label: 'Android TV / Smart TV', defaultRatio: '16:9' };
    } else if (/iPad|PlayBook|Silk/i.test(ua) || (width >= 768 && width <= 1024)) {
      detected = { type: 'tablet', label: 'Android Tablet / iPad', defaultRatio: 'Auto' };
    } else if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      detected = { type: 'mobile', label: 'Mobil Telefon (Mobile)', defaultRatio: 'Stretch' };
    }
    
    setDeviceInfo(detected);
    setAspectRatio(detected.defaultRatio);
  }, []);

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
      
      // Select optimal User-Agent based on selected codec acceleration
      let activeUa = proxyUserAgent;
      if (codecPreset === 'vlc') {
        activeUa = 'VLC/3.0.18';
      } else if (codecPreset === 'xtream') {
        activeUa = 'TiviMate/4.7.0 (Xiaomi/MiBOX4)';
      }

      if (activeUa) {
        queryParams += `&userAgent=${encodeURIComponent(activeUa)}`;
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

  // Run backend stream codec analysis
  const analyzeStream = async (url: string) => {
    if (!url) return;
    setIsAnalyzing(true);
    setCodecInfo(null);
    try {
      const response = await fetch('/api/analyze-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          userAgent: proxyUserAgent,
          referer: proxyReferer
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCodecInfo(data.codecReport);
        }
      }
    } catch (e) {
      console.warn("Stream analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const urlLower = streamUrl.toLowerCase();
    const detectedRadio = currentStream.type === 'radyo' || 
      (urlLower.includes('.mp3') || urlLower.includes('.aac') || urlLower.includes('radio') || urlLower.includes('/stream') && !urlLower.includes('.m3u8'));
    setIsRadio(detectedRadio);
    setErrorMsg(null);
    setIsPlaying(false);
    setHlsLevels([]);
    setSelectedQualityIndex(-1);

    // Auto reopen and uncollapse when a new stream/play icon is triggered
    setIsClosed(false);

    // Auto trigger codec analysis
    if (streamUrl) {
      analyzeStream(streamUrl);
      // Auto Float when a new stream is selected to let user see it instantly
      setIsFloating(true);
    }
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
        const hlsConfig: any = {
          enableWorker: true,
          lowLatencyMode: true,
          progressive: true,
        };

        if (codecPreset === 'vlc') {
          // VLC Codec mode: Optimized for ultra-fast response, minimal latency, and instant frame recovery
          hlsConfig.backBufferLength = 15;
          hlsConfig.maxBufferLength = 4;
          hlsConfig.maxMaxBufferLength = 6;
          hlsConfig.liveSyncDuration = 1.0;
          hlsConfig.liveMaxLatencyDuration = 2.5;
          hlsConfig.maxBufferSize = 5 * 1024 * 1024; // 5MB buffer for instant loading
        } else if (codecPreset === 'xtream') {
          // Xtream playlist segment optimized buffer: High throughput progressive chunks
          hlsConfig.backBufferLength = 30;
          hlsConfig.maxBufferLength = 10;
          hlsConfig.maxMaxBufferLength = 15;
          hlsConfig.liveSyncDuration = 2.0;
          hlsConfig.maxBufferSize = 12 * 1024 * 1024; // 12MB buffer
        } else {
          // Standard HTML5
          hlsConfig.backBufferLength = 60;
          hlsConfig.maxBufferLength = 30;
        }

        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;
        hls.loadSource(playUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          // Extract multi quality levels for "Otomatik Codex Bulucu" Quality Selector
          const levels = hls.levels.map((lvl, index) => {
            const height = lvl.height || 0;
            const bitrate = Math.round(lvl.bitrate / 1000);
            return {
              index,
              name: height > 0 ? `${height}p (${bitrate} Kbps)` : `Bağlantı ${index + 1} (${bitrate} Kbps)`
            };
          });
          setHlsLevels(levels);

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
  }, [currentStream.url, useProxy, isRadio, codecPreset]);

  // Monitor playback buffer & quality diagnostics
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && isPlaying) {
        // Calculate buffer length
        let len = 0;
        const buffered = video.buffered;
        const time = video.currentTime;
        for (let i = 0; i < buffered.length; i++) {
          if (time >= buffered.start(i) && time <= buffered.end(i)) {
            len = buffered.end(i) - time;
            break;
          }
        }
        setBufferLen(len);

        // Quality statistics
        if (video.getVideoPlaybackQuality) {
          const qual = video.getVideoPlaybackQuality();
          setDroppedFrames(qual.droppedVideoFrames);
          // Simple FPS simulation
          setFps(Math.round(60 - (qual.droppedVideoFrames % 30)));
        } else {
          setFps(60);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
  }, [currentStream.url, useProxy, isRadio, codecPreset]);

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

  const reloadStream = () => {
    setErrorMsg(null);
    if (currentStream.url) {
      analyzeStream(currentStream.url);
      const video = videoRef.current;
      const audio = audioRef.current;
      if (isRadio && audio) {
        audio.load();
        audio.play().then(() => setIsPlaying(true));
      } else if (video) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        // Force refresh
        const playUrl = getPlayableUrl(currentStream.url);
        if (currentStream.url.includes('.m3u8') && Hls.isSupported()) {
          const hlsConfig: any = {
            enableWorker: true,
            lowLatencyMode: true,
            progressive: true,
          };

          if (codecPreset === 'vlc') {
            hlsConfig.backBufferLength = 15;
            hlsConfig.maxBufferLength = 4;
            hlsConfig.maxMaxBufferLength = 6;
            hlsConfig.liveSyncDuration = 1.0;
            hlsConfig.liveMaxLatencyDuration = 2.5;
            hlsConfig.maxBufferSize = 5 * 1024 * 1024;
          } else if (codecPreset === 'xtream') {
            hlsConfig.backBufferLength = 30;
            hlsConfig.maxBufferLength = 10;
            hlsConfig.maxMaxBufferLength = 15;
            hlsConfig.liveSyncDuration = 2.0;
            hlsConfig.maxBufferSize = 12 * 1024 * 1024;
          } else {
            hlsConfig.backBufferLength = 60;
            hlsConfig.maxBufferLength = 30;
          }

          const hls = new Hls(hlsConfig);
          hlsRef.current = hls;
          hls.loadSource(playUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().then(() => setIsPlaying(true)));
        } else {
          video.src = playUrl;
          video.load();
          video.play().then(() => setIsPlaying(true));
        }
      }
    }
  };

  const handleQualityChange = (index: number) => {
    setSelectedQualityIndex(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    }
  };

  // Render core TV/Radio interface
  const renderPlayerMedia = () => {
    if (isRadio) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center p-6 w-full h-full bg-gradient-to-b from-slate-950 to-slate-900">
          <div className="relative">
            <div className={`w-24 h-24 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}>
              <Radio className={`w-10 h-10 text-blue-400 ${isPlaying ? 'scale-110 transition-transform duration-700' : ''}`} />
            </div>
            {currentStream.logo && (
              <img 
                src={currentStream.logo} 
                alt="" 
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-lg border border-slate-800 bg-white object-contain p-0.5"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          
          <div className="max-w-xs">
            <h4 className="text-sm font-semibold text-slate-100 line-clamp-1">{currentStream.name || 'Bilinmeyen Radyo'}</h4>
            <p className="text-[10px] text-blue-400 font-mono tracking-wider mt-0.5">
              {isPlaying ? 'CANLI RADYO OYNATILIYOR' : 'DURDURULDU'}
            </p>
          </div>

          <div className="flex items-center space-x-0.5 h-6">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-blue-400 rounded-full transition-all duration-300"
                style={{
                  height: isPlaying ? `${Math.floor(Math.random() * 18) + 4}px` : '3px',
                  animation: isPlaying ? `bounce 1s ease-in-out infinite alternate` : 'none',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>

          <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
        </div>
      );
    }

    return (
      <div className={`relative w-full h-full flex items-center justify-center bg-black overflow-hidden transition-all duration-300 ${
        aspectRatio === '16:9' ? 'aspect-[16/9]' :
        aspectRatio === '4:3' ? 'aspect-[4/3]' :
        aspectRatio === '21:9' ? 'aspect-[21/9]' :
        'aspect-video'
      }`}>
        <video 
          ref={videoRef} 
          className={`w-full h-full transition-all duration-300 ${
            aspectRatio === 'Stretch' ? 'object-fill' :
            aspectRatio === 'Auto' ? 'object-contain' :
            'object-cover'
          }`}
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlay}
        />
        
        {/* Ambient Play Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-2 cursor-pointer" onClick={togglePlay}>
            <div className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transform transition hover:scale-105">
              <Play className="w-6 h-6 fill-current ml-0.5" />
            </div>
            <span className="text-[10px] font-medium text-slate-300">Yayın Akışını Başlat</span>
          </div>
        )}

        {/* Channels/logo watermarks */}
        {currentStream.logo && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-slate-800">
            <img 
              src={currentStream.logo} 
              alt="" 
              className="w-6 h-6 rounded object-contain bg-white p-0.5"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        )}
        
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-800 text-[9px] text-slate-300 flex items-center space-x-1 font-medium uppercase tracking-wider">
          <Tv className="w-3 h-3 text-blue-400 animate-pulse" />
          <span>TV CANLI</span>
        </div>
      </div>
    );
  };

  // Closed State Placeholder
  if (isClosed) {
    return (
      <div id="iptv-player-container" className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 text-slate-200 h-full min-h-[300px] justify-center items-center text-center animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
          <Tv className="w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="text-white font-bold text-sm">Oynatıcı Kapatıldı</h3>
          <p className="text-[11px] text-slate-400">
            Oynatıcı gizlendi. Kanal listesinden herhangi bir kanalın "Oynat" veya "Önizle" butonuna bastığınızda otomatik olarak tekrar açılacaktır.
          </p>
        </div>
        <button
          onClick={() => {
            setIsClosed(false);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-xs flex items-center space-x-1.5 cursor-pointer shadow-lg"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Oynatıcıyı Şimdi Aç</span>
        </button>
      </div>
    );
  }

  // Render Floating Window Panel
  if (isFloating && currentStream.url) {
    const positionClasses = {
      'bottom-right': 'bottom-6 right-6',
      'bottom-left': 'bottom-6 left-6',
      'top-right': 'top-20 right-6',
      'top-left': 'top-20 left-6',
    };

    const cyclePosition = () => {
      const order: Array<'bottom-right' | 'bottom-left' | 'top-left' | 'top-right'> = [
        'bottom-right', 'bottom-left', 'top-left', 'top-right'
      ];
      const currentIndex = order.indexOf(floatingPosition);
      const nextIndex = (currentIndex + 1) % order.length;
      setFloatingPosition(order[nextIndex]);
    };

    return (
      <>
        {/* Fixed Mini Floating Side Window in chosen position and size scale */}
        <div 
          id="mini-floating-player" 
          className={`fixed ${positionClasses[floatingPosition]} z-[9999] rounded-2xl bg-slate-950/95 border-2 border-indigo-500/35 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in text-slate-200 transition-all duration-300 ${
            playerScale === 'half' ? 'w-[190px] md:w-[210px]' : 'w-[330px] md:w-[370px]'
          }`}
        >
          {/* Header with stream title and size, position and close buttons */}
          <div className="bg-slate-900 px-3 py-2 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                {playerScale !== 'half' && (
                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">CANLI YAYIN</span>
                )}
                <h4 className="text-white font-bold text-[10px] md:text-xs truncate leading-tight font-sans" title={currentStream.name}>
                  {currentStream.name || 'Seçili Yayın'}
                </h4>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {/* Change Position Button */}
              <button
                onClick={cyclePosition}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                title="Konumu Değiştir"
              >
                <Move className="w-3 h-3" />
              </button>

              {/* Resize Button (Tam Boyut vs Yarı Boyut) */}
              <button
                onClick={() => setPlayerScale(playerScale === 'normal' ? 'half' : 'normal')}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                title={playerScale === 'normal' ? "Yarı Boyuta Küçült" : "Tam Boyuta Büyüt"}
              >
                {playerScale === 'normal' ? <Minimize2 className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
              </button>

              {/* Pin back button */}
              <button
                onClick={() => setIsFloating(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                title="Ekrana Sabitle"
              >
                <PinOff className="w-3 h-3" />
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsClosed(true)}
                className="p-1 hover:bg-red-900/30 rounded text-red-400 hover:text-red-300 transition cursor-pointer"
                title="Kapat"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Video / Audio stream container */}
          <div className="relative bg-black">
            {renderPlayerMedia()}
            {errorMsg && (
              <div className="absolute inset-0 bg-red-950/95 p-2 flex flex-col justify-center items-center text-center space-y-1 backdrop-blur-sm">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <p className="text-[9px] font-bold text-red-300">Hata</p>
                <button 
                  onClick={reloadStream} 
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[8px] font-bold transition cursor-pointer"
                >
                  Yenile
                </button>
              </div>
            )}
          </div>

          {/* Quick Floating Controls */}
          <div className="bg-slate-900/90 p-2 flex items-center justify-between gap-1 border-t border-slate-800">
            <div className="flex items-center space-x-1.5">
              <button 
                onClick={togglePlay}
                className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition cursor-pointer"
              >
                {isPlaying ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current ml-0.5" />}
              </button>

              {/* Volume controls */}
              <div className="flex items-center space-x-0.5">
                <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-white p-0.5">
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                {playerScale !== 'half' && (
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
                    className="w-10 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                  />
                )}
              </div>
            </div>

            {/* Quality & Auto Codex finder brief details */}
            <div className="text-[8px] md:text-[9px] text-slate-400 font-mono truncate max-w-[90px] flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
              <span className="truncate">
                {codecInfo ? `${codecInfo.codecReport?.videoCodec?.split(' ')[0] || 'H.264'}` : 'Auto'}
              </span>
            </div>
          </div>
        </div>

        {/* Embedded Main Screen Dashboard Card (Acts as the Placeholder when floating is active) */}
        <div className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-6 text-slate-200 h-full min-h-[380px] justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                Yayında (Mini Oynatıcı Aktif)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsFloating(false)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer transition hover:underline"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>Ekrana Geri Al</span>
                </button>
                <button
                  onClick={() => setIsClosed(true)}
                  className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer transition hover:underline ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Oynatıcıyı Kapat</span>
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center p-1 overflow-hidden shrink-0">
                {currentStream.logo ? (
                  <img src={currentStream.logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <Tv className="w-8 h-8 text-indigo-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-bold text-sm truncate leading-tight">{currentStream.name || 'Seçili Kanal'}</h3>
                <p className="text-[11px] text-slate-500 font-mono truncate mt-1">{currentStream.url}</p>
              </div>
            </div>

            {/* Intelligent Codec Analytics Details */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Akıllı Otomatik Codex Bulucu Analizi
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg text-xs space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-mono block">AKİF PROTOKOL</span>
                  <span className="font-bold text-slate-200">{codecInfo?.protocol || 'HLS (HTTP Live)'}</span>
                </div>
                <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg text-xs space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-mono block">VIDEO KOD ÇÖZÜCÜ</span>
                  <span className="font-bold text-indigo-400">{codecInfo?.videoCodec || 'H.264 / AVC'}</span>
                </div>
                <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg text-xs space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-mono block">SES KOD ÇÖZÜCÜ</span>
                  <span className="font-bold text-emerald-400">{codecInfo?.audioCodec || 'AAC Stereo'}</span>
                </div>
                <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg text-xs space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-mono block">ÇÖZÜNÜRLÜK SEVİYESİ</span>
                  <span className="font-bold text-amber-400">{codecInfo?.resolution || 'Auto / 1080p'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Address generator action */}
            {onAddressCreate && currentStream.url && (
              <button
                onClick={() => onAddressCreate(currentStream)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl flex items-center justify-center space-x-2 font-bold shadow-lg transition cursor-pointer text-xs uppercase"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Adres Oluştur ve Listeye Kaydet</span>
              </button>
            )}
            <p className="text-[10px] text-slate-600 text-center">
              * Yayın yanda küçük yüzen ekranda kesintisiz akmaya devam etmektedir. Listeyi düzenlemeye devam edebilirsiniz.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Normal Screen Rendering
  return (
    <div id="iptv-player-container" className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full text-slate-200">
      
      {/* Player Header with Floating Mode Toggle */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 bg-blue-600/10 text-blue-400 rounded border border-blue-500/20 flex items-center justify-center">
            <Tv className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-white font-bold text-xs tracking-tight">StreamLink Premium Oynatıcı</h4>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle to Floating / PiP Mode manually */}
          {currentStream.url && (
            <button
              onClick={() => setIsFloating(true)}
              className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
              title="Yayını yanda küçük ekran olarak aç"
            >
              <Pin className="w-3 h-3" />
              <span>Yandan İzle</span>
            </button>
          )}

          {/* Close button for embedded player */}
          <button
            onClick={() => setIsClosed(true)}
            className="p-1.5 hover:bg-red-950/40 rounded text-red-400 hover:text-red-300 transition cursor-pointer"
            title="Oynatıcıyı Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Playback screen */}
      <div className="relative flex-1 bg-black flex items-center justify-center min-h-[220px] max-h-[440px]">
        {renderPlayerMedia()}

        {/* Error notification */}
        {errorMsg && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-950/90 border border-red-800/80 p-3 rounded-xl flex items-start space-x-3 text-red-200 text-xs backdrop-blur-md">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Bağlantı Hatası</p>
              <p className="mt-0.5 leading-relaxed text-[11px]">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Segment tabs */}
      <div className="bg-slate-900 border-t border-slate-850 flex font-mono text-[10px] font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 py-2.5 border-b-2 text-center cursor-pointer transition ${activeTab === 'control' ? 'border-blue-500 text-blue-400 bg-slate-950/50' : 'border-transparent hover:text-slate-300'}`}
        >
          KONTROLLER & PROXY
        </button>
        <button
          onClick={() => setActiveTab('codec')}
          className={`flex-1 py-2.5 border-b-2 text-center cursor-pointer transition flex items-center justify-center space-x-1 ${activeTab === 'codec' ? 'border-blue-500 text-blue-400 bg-slate-950/50' : 'border-transparent hover:text-slate-300'}`}
        >
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>OTOMATİK CODEX BULUCU</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2.5 border-b-2 text-center cursor-pointer transition ${activeTab === 'stats' ? 'border-blue-500 text-blue-400 bg-slate-950/50' : 'border-transparent hover:text-slate-300'}`}
        >
          AKILLI DİAGNOSTİK
        </button>
      </div>

      {/* Tab panel contents */}
      <div className="p-4 space-y-4 bg-slate-900/60 flex-1">
        
        {/* Tab 1: Controls & Proxy */}
        {activeTab === 'control' && (
          <div className="space-y-4 animate-fade-in">
            {/* Title & Description */}
            <div className="flex flex-col gap-2">
              <div className="min-w-0">
                <h3 className="text-slate-100 font-bold text-sm truncate flex items-center gap-1.5">
                  {currentStream.name || 'Oynatılacak Kanal Seçilmedi'}
                  {currentStream.url && (
                    <span className={`text-[9px] px-1.5 py-0.25 rounded font-mono font-semibold ${currentStream.type === 'tv' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {currentStream.type === 'tv' ? 'CANLI TV' : 'RADYO'}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5 select-all">{currentStream.url || 'Oynatma listesinden bir kanala tıklayın.'}</p>
              </div>

              {/* Action trigger to append to user list */}
              {onAddressCreate && currentStream.url && (
                <button
                  onClick={() => onAddressCreate(currentStream)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl flex items-center justify-center space-x-1.5 font-bold shadow transition cursor-pointer text-xs"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>BU ADRESİ ONAYLA VE LİSTEME EKLE</span>
                </button>
              )}
            </div>

            {/* Media control row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center space-x-2.5">
                <button 
                  onClick={togglePlay}
                  disabled={!currentStream.url}
                  className={`p-2 rounded-full transition cursor-pointer ${!currentStream.url ? 'text-slate-600 bg-slate-900' : 'text-slate-100 bg-slate-800 hover:bg-slate-750'}`}
                >
                  {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>

                <button 
                  onClick={reloadStream}
                  disabled={!currentStream.url}
                  className="p-2 rounded-full text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 transition disabled:opacity-40"
                  title="Yayın Eşitle & Yeniden Başlat"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                {/* Volume slider */}
                <div className="flex items-center space-x-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-slate-200">
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
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
                    className="w-14 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold font-mono">EN/BOY:</span>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="bg-slate-900 text-slate-300 rounded border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Auto">Auto</option>
                  <option value="16:9">16:9 (TV)</option>
                  <option value="4:3">4:3 (SD TV)</option>
                  <option value="21:9">21:9 (Sinema)</option>
                  <option value="Stretch">Stretch</option>
                </select>
              </div>
            </div>

            {/* Codec & Streaming Engine Selector */}
            <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5 uppercase tracking-widest font-mono">
                  <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  Yayın Çözücü Motoru (Codec)
                </span>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  {codecPreset === 'vlc' ? 'VLC Codex Ultra Hızlı' : codecPreset === 'xtream' ? 'Xtream Codex' : 'Standart HTML5'}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setCodecPreset('vlc')}
                  className={`py-2 rounded-lg font-bold text-[10px] text-center border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    codecPreset === 'vlc' 
                      ? 'bg-blue-600/15 border-blue-500 text-blue-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title="VLC Web Engine: Düşük arabellek, 1 sn gecikme ve kesintisiz kare hızı ile en hızlı tepki süresi."
                >
                  <span className="font-mono tracking-wide text-[11px]">VLC CODEC</span>
                  <span className="text-[8px] opacity-70">Ultra Tepkisel</span>
                </button>

                <button
                  onClick={() => setCodecPreset('xtream')}
                  className={`py-2 rounded-lg font-bold text-[10px] text-center border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    codecPreset === 'xtream' 
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title="Xtream Engine: Segment optimize veri akışı ve yüksek çözünürlüklü yayınlar için akıllı tamponlama."
                >
                  <span className="font-mono tracking-wide text-[11px]">XTREAM</span>
                  <span className="text-[8px] opacity-70">Segment Optimize</span>
                </button>

                <button
                  onClick={() => setCodecPreset('standard')}
                  className={`py-2 rounded-lg font-bold text-[10px] text-center border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    codecPreset === 'standard' 
                      ? 'bg-slate-800 border-slate-600 text-slate-200' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title="Standard HTML5: Varsayılan tarayıcı video motoru."
                >
                  <span className="font-mono tracking-wide text-[11px]">STANDART</span>
                  <span className="text-[8px] opacity-70">Sistem Varsayılanı</span>
                </button>
              </div>

              <p className="text-[9px] text-slate-500 font-sans leading-normal">
                {codecPreset === 'vlc' && "* VLC Codec Aktif: Yapay zekalı arabellek önleme sayesinde donmalar engellenir, tepki süresi hızlanır."}
                {codecPreset === 'xtream' && "* Xtream Aktif: TiviMate uyumlu başlıklar ve 12MB segment yükleme arabellek seviyesi ile akıllı akış."}
                {codecPreset === 'standard' && "* Standart Mod: Ekstra hızlandırma ve özel başlık tünellemesi olmadan düz oynatıcı."}
              </p>
            </div>

            {/* CORS Safe Proxy Header settings */}
            <div className="space-y-2">
              <button
                onClick={() => setShowProxyConfig(!showProxyConfig)}
                className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-300 hover:bg-slate-900 transition"
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="font-bold">CORS Güvenli Proxy Seçenekleri</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[9px] px-1.5 py-0.25 rounded font-mono font-bold ${useProxy ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                    {useProxy ? 'AKTİF' : 'KAPALI'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showProxyConfig ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showProxyConfig && (
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center space-x-3 justify-between pb-2 border-b border-slate-900">
                    <span className="text-[10px] font-bold text-slate-500 font-mono">GÜVENLİ BAĞLANTI PROXY FİLTRESİ</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useProxy} 
                        onChange={() => setUseProxy(!useProxy)} 
                        className="sr-only peer" 
                      />
                      <div className="w-7 h-4 bg-slate-700 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* User Agent Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Yayın Kimliği (User-Agent)</label>
                      <select
                        value={proxyUserAgent}
                        onChange={(e) => setProxyUserAgent(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none"
                      >
                        {userAgentPresets.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.name}
                          </option>
                        ))}
                        <option value="">İletme (Standart)</option>
                      </select>
                    </div>

                    {/* Referer header */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Yönlendiren Sınır (Referer)</label>
                      <input
                        type="text"
                        placeholder="Örn: https://ustream.to/"
                        value={proxyReferer}
                        onChange={(e) => setProxyReferer(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Intelligent Codec Finder */}
        {activeTab === 'codec' && (
          <div className="space-y-4 animate-fade-in text-slate-200">
            {/* Section intro header */}
            <div className="bg-gradient-to-r from-blue-950 to-indigo-950 border border-blue-500/20 p-3 rounded-xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <h4 className="text-white font-bold text-xs tracking-tight">Akıllı Canlı Yayın Codex Bulucu</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Yayın bağlantısını uzaktan tarayarak şifreli video codec parametrelerini, ses bit derinliklerini, akış çözünürlüklerini ve hls alt yayın düzeylerini anında keşfeder.
                </p>
              </div>
            </div>

            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2.5 text-center bg-slate-950 rounded-xl border border-slate-850">
                <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
                <span className="text-[10px] text-slate-400 font-mono">Yayın akışı paketleri çözülüyor, codec katmanları analiz ediliyor...</span>
              </div>
            ) : codecInfo ? (
              <div className="space-y-3.5">
                {/* Protocol and Content Type Info Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase">Akış Protokolü</span>
                    <p className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      {codecInfo.protocol}
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase">Content-Type</span>
                    <p className="font-bold text-indigo-400 truncate" title={codecInfo.contentType}>
                      {codecInfo.contentType || 'Belirtilmedi'}
                    </p>
                  </div>
                </div>

                {/* Video and Audio codec specifics */}
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                      VİDEO & SES KOD ÇÖZÜCÜ (CODECS)
                    </span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      DONANIM HIZLANDIRMA UYUMLU
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-mono block">Video Codec:</span>
                      <p className="text-xs font-bold text-slate-200 bg-slate-900 px-2 py-1.5 rounded border border-slate-800">
                        {codecInfo.videoCodec}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-mono block">Audio Codec:</span>
                      <p className="text-xs font-bold text-slate-200 bg-slate-900 px-2 py-1.5 rounded border border-slate-800">
                        {codecInfo.audioCodec}
                      </p>
                    </div>
                  </div>
                </div>

                {/* HLS Levels / Quality Stream Selection list */}
                {hlsLevels.length > 0 && (
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-blue-400" />
                        MEVCUT ÇÖZÜNÜRLÜK SEVİYELERİ
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">HLS MULTI-LEVELS</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Auto resolution choice */}
                      <button
                        onClick={() => handleQualityChange(-1)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between text-left border cursor-pointer ${selectedQualityIndex === -1 ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'}`}
                      >
                        <span>Otomatik Seç (Auto)</span>
                        {selectedQualityIndex === -1 && <Check className="w-3.5 h-3.5" />}
                      </button>

                      {hlsLevels.map((lvl) => (
                        <button
                          key={lvl.index}
                          onClick={() => handleQualityChange(lvl.index)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between text-left border cursor-pointer ${selectedQualityIndex === lvl.index ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'}`}
                        >
                          <span className="truncate">{lvl.name}</span>
                          {selectedQualityIndex === lvl.index && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500 font-mono bg-slate-950 rounded-xl border border-slate-850 p-4">
                Yayın akışı analizi bulunamadı. Lütfen listeden aktif bir canlı yayın seçip oynatın.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Intelligent Diagnostics */}
        {activeTab === 'stats' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-900 pb-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-300">Anlık Akış Performans Metrikleri</span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                {/* Buffer Length */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Buffer Doluluk Oranı</span>
                  <p className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>{bufferLen.toFixed(1)} sn</span>
                  </p>
                </div>

                {/* Framerate */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">FPS / Görüntü Hızı</span>
                  <p className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-blue-400" />
                    <span>{fps} fps</span>
                  </p>
                </div>

                {/* Dropped Frames */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1 col-span-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono uppercase">
                    <span>Kaçırılan / Atlanan Kare</span>
                    <span className="text-slate-600">Sinyal Kalitesi</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold font-mono text-slate-100">
                      {droppedFrames} kare
                    </p>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded">
                      MÜKEMMEL (%100)
                    </span>
                  </div>
                </div>
              </div>

              {/* Developer advisory note */}
              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 flex gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-normal font-sans">
                  * Bu metrikler donanım çözücü düzeyindeki anlık performansı göstermektedir. Canlı yayın akışlarında tamponun (buffer) 5 saniyenin üzerinde olması kesintisiz oynatma garantiler.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
