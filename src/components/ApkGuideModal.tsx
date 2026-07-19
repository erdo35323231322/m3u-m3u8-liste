import React, { useState } from 'react';
import { 
  X, Smartphone, Tv, Copy, Check, Sparkles, Code, 
  AlertTriangle, ExternalLink, HelpCircle, CheckCircle2 
} from 'lucide-react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApkGuideModal({ isOpen, onClose }: ApkGuideModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showDevCommands, setShowDevCommands] = useState(false);

  if (!isOpen) return null;

  const appUrl = "https://ozelm3u-listesi-olusturucu.ai.studio";
  const alternativeUrl = "https://ais-pre-3tdwrw36k5pdqydngkrupr-503760597950.europe-west2.run.app";

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 animate-fade-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base tracking-tight">Android TV & Mobil Kurulum Kılavuzu</h3>
              <p className="text-[10px] text-slate-400 font-mono">Platform v2.5.0 • Web App Wrapper Solution</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* Parsing Error Explanation Banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3.5">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-amber-400 font-bold text-xs tracking-tight uppercase">Paket Ayrıştırma Hatası Çözümü</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Uygulamamız tam kapsamlı bir bulut tabanlı web teknolojisidir (React + Node.js). Eski indirilen simüle edilmiş APK paketi gerçek Android binary bytecode'u (.dex) içermediğinden, Android işletim sistemi <strong>"Paket ayrıştırma hatası" (Parsing Error)</strong> vermektedir. 
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Bu harika aracı televizyonunuzda veya telefonunuzda %100 yerel ve tam ekran bir uygulama olarak çalıştırmak için aşağıdaki 2 kolay yöntemden birini kullanın:
              </p>
            </div>
          </div>

          {/* Quick Copy Link Area */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Uygulama Adresiniz (URL)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Bunu kopyalayın</span>
            </div>
            <div className="flex gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded px-3 py-2 flex-1 font-mono text-[11px] text-slate-300 select-all truncate">
                {appUrl}
              </div>
              <button
                onClick={() => handleCopy(appUrl)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Bağlantıyı Kopyala</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Method 1 */}
          <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4.5 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 flex items-center justify-center shrink-0">
                <Tv className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm tracking-tight">Yöntem 1: Doğrudan Tarayıcıdan Kurulum (En Kolay & En Hızlı)</h4>
                <p className="text-[11px] text-slate-400">PWA (Progressive Web App) teknolojisiyle ana ekrana yerel uygulama olarak ekleyin</p>
              </div>
            </div>

            <div className="border-l-2 border-blue-500/30 pl-3.5 space-y-2 text-[11px] text-slate-300 leading-relaxed">
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold font-mono">1.</span>
                <span>Android TV veya Mobil cihazınızın tarayıcısını açın (Örn: <strong>Chrome</strong>, TV'ler için özel <strong>TV Bro</strong>, <strong>Puffin TV</strong> vb.).</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold font-mono">2.</span>
                <span>Adres satırına yukarıdaki bağlantıyı (<strong>{appUrl}</strong>) yazın ve girin.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold font-mono">3.</span>
                <span>Tarayıcı menüsünü açıp (sağ üstteki üç nokta veya TV tarayıcı ayarı) <strong>"Ana Ekrana Ekle" (Add to Home Screen / Install App)</strong> seçeneğine tıklayın.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold font-mono">4.</span>
                <span className="text-slate-200">Uygulama artık televizyonunuzun veya telefonunuzun ana ekranında yerel bir uygulama gibi görünecek, tam ekran olarak çalışacak ve arka planda her zaman güncel kalacaktır!</span>
              </div>
            </div>
          </div>

          {/* Method 2 */}
          <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4.5 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm tracking-tight">Yöntem 2: Kendi Özel APK Dosyanızı Saniyeler İçinde Çıkarın</h4>
                <p className="text-[11px] text-slate-400">Uygulama bağlantısını ücretsiz bir Android WebView aracına yapıştırıp paketleyin</p>
              </div>
            </div>

            <div className="border-l-2 border-emerald-500/30 pl-3.5 space-y-2 text-[11px] text-slate-300 leading-relaxed">
              <div className="flex gap-2">
                <span className="text-emerald-400 font-bold font-mono">1.</span>
                <span>Yukarıda kopyaladığınız uygulama adresini hafızaya alın.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-400 font-bold font-mono">2.</span>
                <span>Bilgisayarınızda veya telefonunuzda popüler ücretsiz araçlardan birini açın:
                  <ul className="list-disc list-inside mt-1 pl-2 text-slate-400 space-y-0.5">
                    <li><strong>Website 2 APK Builder</strong> (Önerilen)</li>
                    <li><strong>Webview Gold Creator</strong></li>
                    <li><strong>Web2APK Online</strong> siteleri</li>
                  </ul>
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-400 font-bold font-mono">3.</span>
                <span>Uygulama Modu olarak <strong>"Web URL"</strong> seçeneğini seçin ve yukarıdaki adresi yapıştırın.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-400 font-bold font-mono">4.</span>
                <span><strong>"Generate APK"</strong> butonuna basarak televizyonunuza veya telefonunuza yükleyebileceğiniz, sıfır hatasız çalışan, orijinal, imzalı ve uyumlu Android APK dosyanızı saniyeler içinde doğrudan indirin!</span>
              </div>
            </div>
          </div>

          {/* Technical Developer Section */}
          <div className="border-t border-slate-800 pt-4">
            <button
              onClick={() => setShowDevCommands(!showDevCommands)}
              className="flex items-center justify-between w-full py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                Geliştiriciler İçin: Capacitor Nativization Komutları
              </span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 hover:text-white">
                {showDevCommands ? "Gizle" : "Göster"}
              </span>
            </button>

            {showDevCommands && (
              <div className="mt-3 bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-[10px] text-indigo-300 space-y-2 overflow-x-auto select-all">
                <p className="text-slate-500 font-sans mb-1 text-[11px]">Capacitor kullanarak kaynak kodlarından yerel Android projesi oluşturun:</p>
                <div># 1. Projeyi derleyin ve bağımlılıkları ekleyin</div>
                <div className="text-slate-200">npm run build</div>
                <div className="text-slate-200">npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                
                <div className="pt-2"># 2. Capacitor entegrasyonunu başlatın</div>
                <div className="text-slate-200">npx cap init "Ozel M3U Oluşturucu" "com.ozelm3u.app" --web-dir=dist</div>
                
                <div className="pt-2"># 3. Android platformunu ekleyin ve eşitleyin</div>
                <div className="text-slate-200">npx cap add android</div>
                <div className="text-slate-200">npx cap sync</div>
                
                <div className="pt-2"># 4. Projeyi Android Studio'da açıp APK'yı imzalayın</div>
                <div className="text-slate-200">npx cap open android</div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            Otomatik senkronize ve güvenli bulut tabanlı altyapı
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-lg shadow-indigo-600/10"
          >
            Anladım, Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
