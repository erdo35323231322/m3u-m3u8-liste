import React, { useState, useEffect } from 'react';
import { 
  X, RefreshCw, CheckCircle2, AlertTriangle, Search, 
  Check, Globe, Wifi, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { PlaylistItem } from '../types';

interface LinkListUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PlaylistItem[];
  onUpdateItems: (updatedItems: PlaylistItem[]) => void;
}

export default function LinkListUpdateModal({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateItems 
}: LinkListUpdateModalProps) {
  const [step, setStep] = useState<'idle' | 'running' | 'completed'>('idle');
  const [processedCount, setProcessedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentChannelName, setCurrentChannelName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset states when closed or opened
  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setProcessedCount(0);
      setUpdatedCount(0);
      setVerifiedCount(0);
      setFailedCount(0);
      setCurrentChannelName('');
      setError(null);
    }
  }, [isOpen]);

  const startUpdateProcess = async () => {
    if (items.length === 0) {
      setError('Listenizde güncellenecek kanal bulunmuyor. Lütfen önce kanal ekleyin.');
      return;
    }

    setStep('running');
    setError(null);
    setProcessedCount(0);
    setUpdatedCount(0);
    setVerifiedCount(0);
    setFailedCount(0);

    const workingList = [...items];

    for (let i = 0; i < workingList.length; i++) {
      const item = workingList[i];
      setCurrentChannelName(item.name);

      try {
        const response = await fetch('/api/update-single-stream-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: item.name, url: item.url })
        });

        if (!response.ok) {
          throw new Error('Sunucu hatası');
        }

        const data = await response.json();
        if (data.success) {
          workingList[i] = {
            ...item,
            url: data.url,
            status: data.status
          };

          if (data.isUpdated) {
            setUpdatedCount(prev => prev + 1);
          } else if (data.status === 'active') {
            setVerifiedCount(prev => prev + 1);
          } else {
            setFailedCount(prev => prev + 1);
          }
        } else {
          setFailedCount(prev => prev + 1);
        }
      } catch (err) {
        console.error(`Error updating link for ${item.name}:`, err);
        setFailedCount(prev => prev + 1);
      }

      setProcessedCount(i + 1);
    }

    onUpdateItems(workingList);
    setStep('completed');
  };

  if (!isOpen) return null;

  const totalItems = items.length;
  const progressPercent = totalItems > 0 ? Math.round((processedCount / totalItems) * 100) : 0;

  return (
    <div id="link-list-update-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-emerald-600/15 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/20">
              <RefreshCw className={`w-4 h-4 ${step === 'running' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-tight">Akıllı Link Tarayıcı ve Güncelleyici</h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">AI SEARCH GROUNDING & CORR TESTER</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={step === 'running'}
            className="text-slate-400 hover:text-white transition p-1.5 hover:bg-slate-850 rounded-lg cursor-pointer disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-4 flex items-start space-x-3 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Hata</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {step === 'idle' && (
            <div className="space-y-4 text-center py-6">
              <div className="w-16 h-16 bg-indigo-600/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/25">
                <Globe className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h4 className="text-white font-bold text-sm">Gelişmiş Web Link Güncelleme</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Listenizdeki tüm kanalları, internet sitelerini, IPTV listelerini ve Gemini AI arama motorunu tarayarak en güncel çalışan <span className="text-emerald-400 font-bold font-mono">.m3u8</span> bağlantı adreslerini otomatik bulur ve test eder.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left space-y-2 max-w-sm mx-auto">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Toplam taranacak kanal: <strong className="text-white font-mono">{totalItems}</strong></span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span>Otomatik canlı yayın doğrulama aktif</span>
                </div>
              </div>

              <button
                onClick={startUpdateProcess}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg inline-flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Güncellemeyi Başlat</span>
              </button>
            </div>
          )}

          {step === 'running' && (
            <div className="space-y-6">
              
              {/* Circular Progress & Percentage Counter (0/100 Icon Display) */}
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  
                  {/* Background Track */}
                  <svg className="absolute w-full h-full transform -rotate-95">
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      className="stroke-slate-800"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      className="stroke-emerald-500 transition-all duration-300"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 54}
                      strokeDashoffset={2 * Math.PI * 54 * (1 - progressPercent / 100)}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  {/* Percentage Core Display */}
                  <div className="text-center space-y-0.5">
                    <span className="text-2xl font-mono font-bold text-white tracking-tight">
                      {processedCount}/{totalItems}
                    </span>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tamamlandı</p>
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-300 font-semibold animate-pulse">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>"{currentChannelName}" taranıyor...</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">Tüm internet sayfaları ve M3U depoları taranıyor</p>
                </div>
              </div>

              {/* Status Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center space-y-0.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Yeni Bulunan</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">{updatedCount}</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center space-y-0.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Doğrulanan</span>
                  <span className="text-lg font-mono font-bold text-indigo-400">{verifiedCount}</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center space-y-0.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Çevrimdışı</span>
                  <span className="text-lg font-mono font-bold text-rose-400">{failedCount}</span>
                </div>
              </div>

              {/* Progress bar info */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Toplam İlerleme</span>
                  <span className="font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

            </div>
          )}

          {step === 'completed' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/25">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-emerald-300 font-bold text-sm">Tarama ve Güncelleme Tamamlandı!</h4>
                <p className="text-xs text-slate-400">Tüm oynatma listesindeki linkler başarıyla işlendi ve güncellendi.</p>
              </div>

              {/* Summary Stats Card */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 divide-y divide-slate-900 max-w-sm mx-auto text-left text-xs">
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Toplam Kanal Sayısı:</span>
                  <span className="text-white font-mono font-bold">{totalItems}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Bulunan / Güncellenen Yeni Linkler:
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">+{updatedCount}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    Doğrulanan Aktif Linkler:
                  </span>
                  <span className="text-indigo-400 font-mono font-bold">{verifiedCount}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Pasif / Kırık Çevrimdışı Linkler:
                  </span>
                  <span className="text-rose-400 font-mono font-bold">{failedCount}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-lg"
              >
                Kapat ve Listeye Dön
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex justify-between items-center text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Otomatik Test Aktif
          </span>
          <button 
            onClick={onClose}
            disabled={step === 'running'}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition font-semibold cursor-pointer disabled:opacity-30"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
