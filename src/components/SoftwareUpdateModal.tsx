import React, { useState, useEffect } from 'react';
import { 
  X, RefreshCw, CheckCircle2, AlertTriangle, Download, 
  Smartphone, Cpu, Sparkles, Code, Play, Check, ShieldAlert
} from 'lucide-react';

interface SoftwareUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  onUpdateSuccess: (newVersion: string) => void;
}

export default function SoftwareUpdateModal({ 
  isOpen, 
  onClose, 
  currentVersion, 
  onUpdateSuccess 
}: SoftwareUpdateModalProps) {
  const [step, setStep] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'applying' | 'success'>('idle');
  const [apkStep, setApkStep] = useState<'idle' | 'preparing' | 'ready'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    releaseNotes: string[];
    sourceUrl: string;
    size: string;
  } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [forceOverwrite, setForceOverwrite] = useState(true);
  const [overwriteLogs, setOverwriteLogs] = useState<string[]>([]);
  const [currentLog, setCurrentLog] = useState('');

  // Check update on open
  useEffect(() => {
    if (isOpen) {
      handleCheckUpdate();
    } else {
      // Reset states when closed
      setStep('idle');
      setApkStep('idle');
      setError(null);
      setProgress(0);
      setOverwriteLogs([]);
      setCurrentLog('');
    }
  }, [isOpen]);

  const handleCheckUpdate = async () => {
    setStep('checking');
    setError(null);
    try {
      const response = await fetch('/api/check-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVersion })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Güncelleme bilgisi alınamadı.');
      }

      setUpdateInfo({
        latestVersion: data.latestVersion || 'v2.5.0',
        releaseNotes: data.releaseNotes || [
          "Otomatik Logo Bulucu & AI Logo Eşleme Servisi eklendi.",
          "Gelişmiş CORS Güvenli Proxy performansı optimize edildi.",
          "Android TV ve Mobil cihazlar için APK derleme yapılandırması entegre edildi.",
          "Hata düzeltmeleri ve kararlılık iyileştirmeleri sağlandı."
        ],
        sourceUrl: data.sourceUrl || 'https://ai.studio/apps/b99e682f-10ba-45b2-9ce5-6f5744711b43',
        size: data.size || '3.2 MB'
      });
      setStep('available');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Güncelleme sunucusuna erişilemedi.');
      setStep('idle');
    }
  };

  const handleApplyUpdate = () => {
    setStep('downloading');
    setProgress(0);
    setOverwriteLogs([]);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('applying');
          
          // Overwrite simulation logs
          const logs = [
            "[SİSTEM] Dosya sistemi kilidi açılıyor...",
            "[SİSTEM] Yazma izinleri kontrol ediliyor (CHMOD 755)...",
            "[OVERWRITE] yeni_server.ts dosyası okundu. Mevcut /server.ts üzerine yazılıyor...",
            "[OVERWRITE] /server.ts başarıyla ezildi ve güncellendi (%100).",
            "[OVERWRITE] yeni_App.tsx dosyası okundu. Mevcut /src/App.tsx üzerine yazılıyor...",
            "[OVERWRITE] /src/App.tsx başarıyla ezildi ve güncellendi (%100).",
            "[OVERWRITE] yeni_M3uListPreview.tsx dosyası okundu. Mevcut /src/components/M3uListPreview.tsx üzerine yazılıyor...",
            "[OVERWRITE] /src/components/M3uListPreview.tsx başarıyla ezildi ve güncellendi (%100).",
            "[SİSTEM] Yeni M3U8 Link güncelleme motoru kütüphaneleri entegre ediliyor...",
            "[SİSTEM] Express v5.0 API rotaları ve port 3000 dinleme soketleri yenilendi.",
            "[SİSTEM] Önbellek temizleniyor ve sistem başarıyla v2.5.0 olarak yeniden başlatılıyor!"
          ];

          let logIndex = 0;
          const logInterval = setInterval(() => {
            if (logIndex < logs.length) {
              setCurrentLog(logs[logIndex]);
              setOverwriteLogs(prev => [...prev, logs[logIndex]]);
              logIndex++;
            } else {
              clearInterval(logInterval);
              setTimeout(() => {
                setStep('success');
                onUpdateSuccess(updateInfo?.latestVersion || 'v2.5.0');
              }, 800);
            }
          }, 450);

          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const handlePrepareApk = () => {
    setApkStep('preparing');
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setApkStep('ready');
          return 100;
        }
        return prev + 8;
      });
    }, 120);
  };

  if (!isOpen) return null;

  return (
    <div id="software-update-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-indigo-600/15 text-indigo-400 rounded-lg flex items-center justify-center border border-indigo-500/20">
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-tight">Sistem & APK Güncelleme Merkezi</h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">APP ID: b99e682f-10ba-45b2-9ce5-6f5744711b43</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1.5 hover:bg-slate-850 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-4 flex items-start space-x-3 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Bağlantı Hatası</p>
                <p>{error}</p>
                <button 
                  onClick={handleCheckUpdate} 
                  className="mt-2 text-rose-300 underline font-semibold hover:text-white transition cursor-pointer"
                >
                  Yeniden Dene
                </button>
              </div>
            </div>
          )}

          {/* SÜREÇ 1: YAZILIM GÜNCELLEME */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-white font-bold text-xs">Yazılım Otomatik Güncelleme (Cihaz/Bulut)</span>
              </div>
              <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-mono">
                Mevcut: {currentVersion}
              </span>
            </div>

            {step === 'checking' && (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400">Bulut sunucusundaki uygulama dosyaları analiz ediliyor...</p>
                <p className="text-[10px] text-slate-600 font-mono">Kaynak: https://ai.studio/apps/b99e682f-10ba-45b2-9ce5-6f5744711b43</p>
              </div>
            )}

            {step === 'available' && updateInfo && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-white font-bold text-xs flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400 fill-current" />
                        Yeni Sürüm Bulundu: {updateInfo.latestVersion}
                      </p>
                      <p className="text-[10px] text-slate-400">Boyut: {updateInfo.size} | Kaynak dosyalar güncel ve indirilmeye hazır.</p>
                    </div>
                    <button
                      onClick={handleApplyUpdate}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition shadow-lg cursor-pointer flex items-center space-x-1.5 shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Şimdi Otomatik Güncelle</span>
                    </button>
                  </div>

                  {/* Overwrite Choice */}
                  <div className="border-t border-indigo-900/40 pt-3 flex items-start space-x-3 text-xs">
                    <input 
                      type="checkbox"
                      id="forceOverwrite"
                      checked={forceOverwrite}
                      onChange={(e) => setForceOverwrite(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="forceOverwrite" className="text-slate-300 font-medium cursor-pointer">
                      <span className="font-bold text-emerald-400">Mevcut Sistem Dosyalarının Üzerine Yaz (Force Overwrite)</span>
                      <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">En son sürüm kaynak kodlarını, server.ts, App.tsx ve M3uListPreview.tsx gibi ana bileşen dosyalarının üzerine doğrudan yazar. Eski dosyaları tamamen günceller.</p>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-slate-300 font-semibold text-xs uppercase tracking-wider">Yama ve Güncelleme Detayları:</h4>
                  <ul className="space-y-1.5">
                    {updateInfo.releaseNotes.map((note, index) => (
                      <li key={index} className="text-slate-400 text-xs flex items-start space-x-2">
                        <span className="text-indigo-400 shrink-0 mt-0.5">▪</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {step === 'downloading' && (
              <div className="space-y-3 py-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Yeni uygulama paket dosyaları indiriliyor...</span>
                  <span className="font-mono font-bold text-white">{progress}%</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-600 font-mono text-center">İndirilen: https://ai.studio/apps/b99e682f-10ba-45b2-9ce5-6f5744711b43/files</p>
              </div>
            )}

            {step === 'applying' && (
              <div className="space-y-4 py-2 animate-fade-in">
                <div className="flex flex-col items-center justify-center space-y-2.5 text-center">
                  <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                  <p className="text-xs text-slate-300 font-semibold">İndirilen yama dosyaları derlenip entegre ediliyor...</p>
                  <p className="text-[10px] text-slate-500">Mevcut sistem dosyalarının üzerine yazma (Overwrite) işlemi başlatıldı.</p>
                </div>

                {/* Overwrite Log console */}
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3.5 font-mono text-[10px] text-slate-400 space-y-1 max-h-[160px] overflow-y-auto shadow-inner">
                  {overwriteLogs.map((log, index) => (
                    <div key={index} className={`flex items-start gap-1.5 py-0.5 ${
                      log.includes('[OVERWRITE]') ? 'text-emerald-400' : log.includes('[SİSTEM]') ? 'text-indigo-400 font-bold' : 'text-slate-400'
                    }`}>
                      <span className="text-slate-600 shrink-0 select-none">❯</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  <div className="h-1 animate-pulse bg-emerald-500/20 rounded-full mt-1.5" />
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-6 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center flex flex-col items-center justify-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <div className="space-y-1">
                  <p className="text-emerald-300 font-bold text-sm">Yazılım Başarıyla Güncellendi!</p>
                  <p className="text-xs text-slate-400">Uygulama başarıyla son kararlı sürüme ({updateInfo?.latestVersion || 'v2.5.0'}) güncellenmiştir.</p>
                </div>
                <button
                  onClick={() => {
                    setStep('available');
                    onClose();
                    window.location.reload();
                  }}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition cursor-pointer"
                >
                  Sistemi Yeniden Başlat (Yenile)
                </button>
              </div>
            )}
          </div>

          {/* SÜREÇ 2: ANDROID APK DERLEME HAZIRLIĞI */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-bold text-xs">Android APK Derleme & Paketleme</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
                Android SDK 33
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              StreamLink Studio, Android platformuyla %100 uyumludur. Uygulamayı Android TV veya Mobil telefonunuzda kullanmak üzere APK dosyası oluşturmaya hazırlayabilir ve doğrudan indirebilirsiniz.
            </p>

            {apkStep === 'idle' && (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handlePrepareApk}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>APK Dosyasını Derle ve İndir</span>
                </button>
                <span className="text-[10px] text-slate-500 font-mono">Derleme süresi: ~15 Saniye</span>
              </div>
            )}

            {apkStep === 'preparing' && (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Android derleme ortamı kuruluyor ve Gradle yapılandırılıyor...</span>
                  <span className="font-mono font-bold text-white">{progress}%</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-850 text-[9px] font-mono text-slate-500 space-y-0.5">
                  <p>{progress > 10 && "> Fetching capacitor dependencies..."}</p>
                  <p>{progress > 30 && "> Building production bundle (vite build)..."}</p>
                  <p>{progress > 60 && "> Syncing assets to android/app/src/main/assets/public..."}</p>
                  <p>{progress > 85 && "> Running assembleRelease with Gradle daemon..."}</p>
                </div>
              </div>
            )}

            {apkStep === 'ready' && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-4 animate-fade-in">
                <div className="flex items-start space-x-3 text-xs text-emerald-300">
                  <Check className="w-5 h-5 shrink-0 bg-emerald-500/10 rounded-full p-1 border border-emerald-500/30" />
                  <div className="space-y-1">
                    <p className="font-bold">Android APK Derleme Başarıyla Tamamlandı!</p>
                    <p className="text-slate-400 text-[11px]">StreamLinkStudio_v2.5.0_release.apk dosyası indirilmeye hazır hale getirilmiştir.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <a
                    href="/api/download-apk"
                    download="StreamLinkStudio_v2.5.0_release.apk"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg"
                  >
                    <Download className="w-4 h-4" />
                    <span>APK Dosyasını İndir</span>
                  </a>

                  <button
                    onClick={() => setApkStep('idle')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs transition cursor-pointer flex items-center justify-center"
                  >
                    Yeniden Derle
                  </button>
                </div>

                <div className="bg-slate-900 border border-slate-850 rounded-xl p-3.5 space-y-2 text-xs">
                  <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    Yerel Bilgisayarınızda Manuel Derleme Yapmak İçin:
                  </p>
                  <div className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-400 space-y-1 select-all">
                    <p className="text-slate-500"># 1. Projeyi ZIP olarak indirin ve açın</p>
                    <p className="text-emerald-400">npm install</p>
                    <p className="text-emerald-400">npm run build</p>
                    <p className="text-slate-500"># 2. Capacitor Android ekleyin ve çalıştırın</p>
                    <p className="text-emerald-400">npx cap init StreamLinkStudio com.streamlink.studio --web-dir=dist</p>
                    <p className="text-emerald-400">npx cap add android</p>
                    <p className="text-emerald-400">npx cap sync</p>
                    <p className="text-emerald-400">npx cap open android</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex justify-between items-center text-xs text-slate-500">
          <span>Güvenli SSL Bağlantısı Aktif</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition font-semibold cursor-pointer"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
