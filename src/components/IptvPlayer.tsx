import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Square, Volume2, VolumeX, Shield, ShieldAlert, Zap, Radio, Tv, Settings, Globe, HelpCircle, RefreshCw, X, Maximize2, Minimize2, Move, Expand, Shrink, Sparkles, Cpu, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PlaylistItem } from '../types';

interface IptvPlayerProps {
  currentStream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string };
  onAddressCreate?: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => void;
  isFloating?: boolean;
  onToggleFloating?: () => void;
  onClose?: () => void;
  onAutoUpdateChannelUrl?: (originalUrl: string, newUrl: string, newLogo?: string) => void;
  onNextChannel?: () => void;
  onPrevChannel?: () => void;
}

interface CodecTrial {
  name: string;
  description: string;
  useProxy: boolean;
  userAgent: string;
  forceHls: boolean;
  hlsConfig?: any;
}

const codecTrials: CodecTrial[] = [
  {
    name: "1. Deneme (VLC Codec Motoru)",
    description: "VLC/3.0.18 User-Agent ve standart HLS akış çözücü",
    useProxy: true,
    userAgent: 'VLC/3.0.18',
    forceHls: true
  },
  {
    name: "2. Deneme (TiviMate IPTV Çözücü)",
    description: "TiviMate/4.7.0 Android emülasyonu ve ultra-düşük gecikmeli tamponlama",
    useProxy: true,
    userAgent: 'TiviMate/4.7.0 (Xiaomi/MiBOX4)',
    forceHls: true,
    hlsConfig: { lowLatencyMode: true, enableWorker: true }
  },
  {
    name: "3. Deneme (IPTV Smarters Pro)",
    description: "Smarters Player kimliği ve yüksek toleranslı hata giderme tamponu",
    useProxy: true,
    userAgent: 'IPTV-Smarters-Pro',
    forceHls: true,
    hlsConfig: { maxBufferLength: 30, maxMaxBufferLength: 600, enableWorker: false }
  },
  {
    name: "4. Deneme (Sistem Yerel Oynatıcı)",
    description: "Doğrudan tarayıcı yerel HTML5 m3u8/mp4 codec havuzu",
    useProxy: false,
    userAgent: '',
    forceHls: false
  },
  {
    name: "Dinamik Otomatik Codec Oluşturucu (AI)",
    description: "Yapay zeka uyumlu dinamik akış analizi ve yüksek boyutlu arabellek sentezleyicisi",
    useProxy: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 10; Mi Box) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    forceHls: true,
    hlsConfig: {
      enableWorker: true,
      maxBufferLength: 90,
      maxMaxBufferLength: 1800,
      maxBufferSize: 120 * 1024 * 1024, // 120MB auto-allocated streaming buffer
      liveSyncDurationCount: 8,
      liveMaxLatencyDurationCount: 20,
      nudgeMaxRetries: 15,
      nudgeDelay: 300,
      fragLoadingMaxRetry: 15,
      manifestLoadingMaxRetry: 15
    }
  }
];

export default function IptvPlayer({ 
  currentStream, 
  onAddressCreate,
  isFloating = false,
  onToggleFloating,
  onClose,
  onAutoUpdateChannelUrl,
  onNextChannel,
  onPrevChannel
}: IptvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [trialIndex, setTrialIndex] = useState<number>(-1);
  const [verifiedTrialIndex, setVerifiedTrialIndex] = useState<number | null>(null);
  const [isHalfSize, setIsHalfSize] = useState<boolean>(() => {
    return localStorage.getItem('streamlink_player_half_size') === 'true';
  });
  const [isCustomFullscreen, setIsCustomFullscreen] = useState(false);

  useEffect(() => {
    localStorage.setItem('streamlink_player_half_size', isHalfSize ? 'true' : 'false');
  }, [isHalfSize]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsCustomFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCustomFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          setIsCustomFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCustomFullscreen]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else {
          setIsCustomFullscreen(!isCustomFullscreen);
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Native fullscreen failed or blocked, falling back to viewport-fullscreen:", err);
      setIsCustomFullscreen(!isCustomFullscreen);
    }
  };

  const [useProxy, setUseProxy] = useState(true);
  const [proxyUserAgent, setProxyUserAgent] = useState('VLC/3.0.18');
  const [proxyReferer, setProxyReferer] = useState('');
  const [showProxyConfig, setShowProxyConfig] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRadio, setIsRadio] = useState(false);
  const [isAiSearchingForStream, setIsAiSearchingForStream] = useState(false);
  const [aiSearchResultMsg, setAiSearchResultMsg] = useState<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Predefined User-Agent Presets
  const userAgentPresets = [
    { name: 'VLC Media Player', value: 'VLC/3.0.18' },
    { name: 'TiviMate IPTV', value: 'TiviMate/4.7.0 (Xiaomi/MiBOX4)' },
    { name: 'IPTV Smarters Pro', value: 'IPTV-Smarters-Pro' },
    { name: 'Standard Browser', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  ];

  // Construct final playback URL depending on Proxy option, active trial and custom headers
  const getPlayableUrl = (rawUrl: string, activeTrialIdx: number = -1) => {
    if (!rawUrl) return '';

    // If an active trial is running, apply its user-agent and proxy setting
    if (activeTrialIdx >= 0 && activeTrialIdx < codecTrials.length) {
      const trial = codecTrials[activeTrialIdx];
      if (trial.useProxy) {
        let queryParams = `url=${encodeURIComponent(rawUrl)}`;
        if (trial.userAgent) {
          queryParams += `&userAgent=${encodeURIComponent(trial.userAgent)}`;
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
    }

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

  const triggerAiStreamSearch = async () => {
    if (isAiSearchingForStream || !currentStream.url) return;
    setIsAiSearchingForStream(true);
    setAiSearchResultMsg("Tüm oynatıcı codec motorları ve akıllı tamponlar denendi fakat yayın başlatılamadı. Şimdi internet üzerinde güncel ve aktif yayın adresi aranıyor...");
    setErrorMsg("Yayın başarısız. Yeni yayın adresi aranıyor...");

    try {
      const response = await fetch('/api/update-single-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: currentStream.name,
          currentUrl: currentStream.url,
          type: currentStream.type || 'tv',
          currentLogo: currentStream.logo
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.active && data.url && data.url !== currentStream.url) {
          setAiSearchResultMsg(`Uyumlu ve aktif yeni bir yayın adresi başarıyla bulundu!\n\nYeni Link: ${data.url}\n\nÇalma listeniz otomatik olarak güncelleniyor ve yayın başlatılıyor...`);
          
          if (onAutoUpdateChannelUrl) {
            onAutoUpdateChannelUrl(currentStream.url, data.url, data.logo);
          }
          
          setTimeout(() => {
            setIsAiSearchingForStream(false);
            setAiSearchResultMsg(null);
            setErrorMsg(null);
          }, 3500);
        } else {
          setAiSearchResultMsg("İnternette bu kanal için çalışan alternatif veya daha güncel bir canlı yayın akış adresi maalesef bulunamadı.");
          setErrorMsg("Çalışan güncel yayın adresi bulunamadı.");
          setTimeout(() => {
            setIsAiSearchingForStream(false);
          }, 5000);
        }
      } else {
        setAiSearchResultMsg("Arama servisi geçici olarak yanıt vermedi. Lütfen internet bağlantınızı kontrol edin.");
        setErrorMsg("Arama servisi hatası.");
        setTimeout(() => {
          setIsAiSearchingForStream(false);
        }, 5000);
      }
    } catch (err: any) {
      console.error(err);
      setAiSearchResultMsg("Arama işlemi sırasında bir bağlantı hatası oluştu.");
      setErrorMsg("Bağlantı hatası.");
      setIsAiSearchingForStream(false);
    }
  };

  const handlePlaybackFailure = () => {
    if (verifiedTrialIndex !== null) return; // already playing, ignore errors
    if (isAiSearchingForStream) return;

    setTrialIndex(prev => {
      const nextIdx = prev + 1;
      if (nextIdx < codecTrials.length) {
        console.log(`Codec denemesi basarisiz, sonraki adima geciliyor: ${codecTrials[nextIdx].name}`);
        setErrorMsg(`${codecTrials[nextIdx].name} deneniyor... (${codecTrials[nextIdx].description})`);
        return nextIdx;
      } else {
        setErrorMsg("Tüm oynatıcı motorları başarısız oldu. Güncel yayın linki aranıyor...");
        triggerAiStreamSearch();
        return prev;
      }
    });
  };

  useEffect(() => {
    // Detect stream type (either by explicit type or url suffix)
    const urlLower = streamUrl.toLowerCase();
    const detectedRadio = currentStream.type === 'radyo' || 
      (urlLower.includes('.mp3') || urlLower.includes('.aac') || urlLower.includes('radio') || urlLower.includes('/stream') && !urlLower.includes('.m3u8'));
    setIsRadio(detectedRadio);
    setErrorMsg(null);
    setIsPlaying(false);
    setTrialIndex(-1);
    setVerifiedTrialIndex(null);
  }, [currentStream]);

  // Handle Video (TV) Stream Loading
  useEffect(() => {
    if (isRadio || !currentStream.url || !videoRef.current) return;

    const video = videoRef.current;
    const activeTrial = (trialIndex >= 0 && trialIndex < codecTrials.length) ? codecTrials[trialIndex] : null;
    const playUrl = getPlayableUrl(currentStream.url, trialIndex);

    // Reset previous HLS instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }

    // Success event listener on actual rendering frame
    const handlePlaying = () => {
      setIsPlaying(true);
      setVerifiedTrialIndex(trialIndex);
      setErrorMsg(null);
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
    video.addEventListener('playing', handlePlaying);

    // Auto-fallback timeout if the stream hangs in infinite loading/buffering state
    playTimeoutRef.current = setTimeout(() => {
      if (!isPlaying && verifiedTrialIndex === null) {
        console.warn("Yayın yüklenme zaman aşımı. Alternatif codec deneniyor...");
        handlePlaybackFailure();
      }
    }, 6000);

    const isM3u8 = currentStream.url.includes('.m3u8') || (activeTrial && activeTrial.forceHls);

    if (isM3u8) {
      if (Hls.isSupported()) {
        const hlsConfig: any = {
          enableWorker: true,
          lowLatencyMode: true,
          ...(activeTrial?.hlsConfig || {})
        };

        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;
        hls.loadSource(playUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play()
            .then(() => {
              setIsPlaying(true);
              setVerifiedTrialIndex(trialIndex);
              setErrorMsg(null);
            })
            .catch((e) => {
              console.log("Auto-play blocked:", e);
              setIsPlaying(false);
            });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn("HLS Fatal error encountered:", data);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setErrorMsg(`Ağ hatası: Bağlantı kurulamadı. Alternatif codec deneniyor...`);
                hls.startLoad();
                handlePlaybackFailure();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setErrorMsg(`Codec hatası: Medya çözülemedi. Diğer oynatıcı motoru deneniyor...`);
                hls.recoverMediaError();
                handlePlaybackFailure();
                break;
              default:
                setErrorMsg(`Yükleme hatası. Sonraki codec konfigürasyonuna geçiliyor...`);
                hlsRef.current?.destroy();
                handlePlaybackFailure();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS support
        video.src = playUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play()
            .then(() => {
              setIsPlaying(true);
              setVerifiedTrialIndex(trialIndex);
              setErrorMsg(null);
            })
            .catch(() => setIsPlaying(false));
        });
        video.onerror = () => {
          console.warn("Native Safari HLS error, triggering next codec");
          handlePlaybackFailure();
        };
      } else {
        setErrorMsg("Tarayıcınız HLS (.m3u8) yayınlarını desteklemiyor.");
        handlePlaybackFailure();
      }
    } else {
      // Normal video (mp4, webm)
      video.src = playUrl;
      video.load();
      video.play()
        .then(() => {
          setIsPlaying(true);
          setVerifiedTrialIndex(trialIndex);
          setErrorMsg(null);
        })
        .catch(() => {
          console.warn("Direct HTML5 playback failed, triggering next codec");
          handlePlaybackFailure();
        });
      video.onerror = () => {
        console.warn("Normal video load error, triggering next codec");
        handlePlaybackFailure();
      };
    }

    return () => {
      video.removeEventListener('playing', handlePlaying);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
  }, [currentStream.url, useProxy, isRadio, trialIndex]);

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
    <div 
      ref={containerRef}
      id="iptv-player-container" 
      className={`bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ${
        isCustomFullscreen 
          ? 'fixed inset-0 z-[9999] w-screen h-screen m-0 p-0' 
          : isHalfSize 
            ? 'w-full max-w-[380px] mx-auto text-xs my-2' 
            : 'w-full h-full'
      }`}
    >
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
          {/* %50 Boyutlandırma / Küçültme Butonu */}
          {!isFloating && (
            <button
              onClick={() => setIsHalfSize(!isHalfSize)}
              className={`p-1 hover:bg-slate-850 rounded transition cursor-pointer ${isHalfSize ? 'text-blue-450 bg-blue-500/10 border border-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              title={isHalfSize ? "Normal Boyuta Dön (%100)" : "Küçük Boyuta Geç (%50 Oranında Küçült)"}
            >
              <Shrink className="w-4 h-4" />
            </button>
          )}

          {/* Tam Ekran Butonu */}
          <button
            onClick={toggleFullscreen}
            className={`p-1 hover:bg-slate-850 rounded transition cursor-pointer ${isCustomFullscreen ? 'text-blue-450 bg-blue-500/10 border border-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            title={isCustomFullscreen ? "Tam Ekrandan Çık (Esc)" : "Tam Ekran Yap"}
          >
            <Expand className="w-4 h-4" />
          </button>

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
      <div className={`relative bg-black flex items-center justify-center transition-all duration-300 ${
        isCustomFullscreen 
          ? 'flex-1 h-full min-h-0 max-h-none' 
          : isHalfSize 
            ? 'min-h-[140px] max-h-[220px] flex-1' 
            : 'min-h-[220px] max-h-[480px] flex-1'
      }`}>
        {/* Overlay Navigation Arrows */}
        {onPrevChannel && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onPrevChannel();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-900/60 hover:bg-blue-600/95 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition cursor-pointer border border-white/10 group"
            title="Önceki Kanal"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}

        {onNextChannel && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onNextChannel();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-900/60 hover:bg-blue-600/95 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition cursor-pointer border border-white/10 group"
            title="Sonraki Kanal"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
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
            
            {/* Trial Active Loading State overlay */}
            {trialIndex >= 0 && verifiedTrialIndex === null && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-20 space-y-4 animate-in fade-in duration-200">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-cyan-400 animate-spin absolute" />
                  <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <span className="text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 animate-bounce">
                    Otomatik Codec Denetimi
                  </span>
                  <h5 className="text-xs font-black text-slate-100">{codecTrials[trialIndex].name}</h5>
                  <p className="text-[10px] text-slate-400 leading-normal">{codecTrials[trialIndex].description}</p>
                </div>
                <div className="flex items-center justify-center space-x-1.5 text-[10px] font-bold text-slate-500 font-mono">
                  <span>Girişim Adımı:</span>
                  <span className="text-cyan-400">{trialIndex + 1} / {codecTrials.length}</span>
                </div>
              </div>
            )}

            {/* Trial Success Verification badge */}
            {verifiedTrialIndex !== null && isPlaying && (
              <div className="absolute top-4 left-24 bg-emerald-950/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-500/30 text-[9px] text-emerald-400 flex items-center space-x-1.5 font-bold tracking-wider uppercase z-10 animate-in fade-in zoom-in duration-300">
                <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Uyumlu Codec: {codecTrials[verifiedTrialIndex].name}</span>
              </div>
            )}

            {/* Ambient Shadow Overlays */}
            {!isPlaying && trialIndex === -1 && (
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
        {errorMsg && !isAiSearchingForStream && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-950/90 border border-red-800/80 p-3 rounded-xl flex items-start space-x-3 text-red-200 text-xs backdrop-blur-md">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Bağlantı Hatası</p>
              <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* AI Searching for stream Overlay */}
        {isAiSearchingForStream && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 space-y-4 animate-in fade-in duration-200">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-indigo-400 animate-spin absolute" />
              <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <div className="space-y-2 max-w-sm">
              <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 animate-bounce">
                Akıllı Alternatif Arama Motoru
              </span>
              <h5 className="text-sm font-black text-slate-100 uppercase tracking-tight">{currentStream.name}</h5>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium whitespace-pre-line">{aiSearchResultMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className={`bg-slate-900 border-t border-slate-800/80 transition-all duration-300 ${
        isHalfSize ? 'p-2.5 space-y-2.5' : 'p-4 space-y-4'
      }`}>
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
          {/* Left: Play/Pause/Stop & Navigation */}
          <div className="flex items-center space-x-2">
            {onPrevChannel && (
              <button 
                onClick={onPrevChannel}
                className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-full transition cursor-pointer flex items-center justify-center border border-slate-700/50"
                title="Önceki Kanal"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <button 
              onClick={togglePlay}
              disabled={!currentStream.url}
              className={`p-2.5 rounded-full transition cursor-pointer ${!currentStream.url ? 'text-slate-600 bg-slate-900' : 'text-slate-100 bg-slate-800 hover:bg-slate-700'}`}
              title={isPlaying ? "Durdur" : "Oynat"}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {onNextChannel && (
              <button 
                onClick={onNextChannel}
                className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-full transition cursor-pointer flex items-center justify-center border border-slate-700/50"
                title="Sonraki Kanal"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

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

            {/* Codec Trial Manual Trigger Button */}
            {currentStream.url && (
              <button
                onClick={() => {
                  setTrialIndex(0);
                  setVerifiedTrialIndex(null);
                  setErrorMsg("Otomatik Codec Çözümleme başvuru motoru başlatılıyor...");
                }}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black flex items-center space-x-1.5 transition shadow cursor-pointer uppercase tracking-wider ${
                  trialIndex >= 0 && verifiedTrialIndex === null
                    ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/35 animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:text-cyan-400 border-slate-700 hover:border-cyan-500/30'
                }`}
                title="Yayın açılmadığında alternatif oynatma codec ve proxy protokol kombinasyonlarını dener."
              >
                <Cpu className={`w-3.5 h-3.5 ${trialIndex >= 0 && verifiedTrialIndex === null ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
                <span>Codec Dene</span>
              </button>
            )}
          </div>

          {/* Right: Proxy option */}
          <div className="flex items-center gap-2">
            {!isFloating && (
              <button
                onClick={() => setIsHalfSize(!isHalfSize)}
                className={`p-1.5 rounded transition border cursor-pointer ${
                  isHalfSize 
                    ? 'bg-blue-600/20 text-blue-450 border border-blue-500/30' 
                    : 'bg-slate-800 text-slate-400 hover:text-blue-450 border border-slate-700/60'
                }`}
                title={isHalfSize ? "Normal Boyuta Dön (%100)" : "Küçük Boyuta Geç (%50 Oranında Küçült)"}
              >
                <Shrink className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className={`p-1.5 rounded transition border cursor-pointer ${
                isCustomFullscreen 
                  ? 'bg-blue-600/20 text-blue-450 border border-blue-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-blue-450 border border-slate-700/60'
              }`}
              title={isCustomFullscreen ? "Tam Ekrandan Çık (Esc)" : "Tam Ekran Yap"}
            >
              <Expand className="w-4 h-4" />
            </button>

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
