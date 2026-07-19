import React, { useState, useEffect } from 'react';
import { 
  X, UploadCloud, CheckCircle2, AlertTriangle, FileArchive, 
  Loader2, FolderOpen, FileCheck2, RefreshCw, Terminal, Check
} from 'lucide-react';

interface SystemUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess: (message: string) => void;
}

interface UpdateStats {
  filesCount: number;
  updatedFiles: string[];
}

export default function SystemUpdateModal({ 
  isOpen, 
  onClose, 
  onUpdateSuccess 
}: SystemUpdateModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'idle' | 'reading' | 'uploading' | 'applying' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UpdateStats | null>(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setStep('idle');
      setProgress(0);
      setStatusMessage('');
      setError(null);
      setStats(null);
    }
  }, [isOpen]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.zip')) {
        setFile(droppedFile);
      } else {
        setError("Sadece .zip uzantılı sistem dosyaları kabul edilir.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Sadece .zip uzantılı sistem dosyaları kabul edilir.");
      }
    }
  };

  const simulateProgress = (start: number, end: number, duration: number, callback: () => void) => {
    const steps = end - start;
    const intervalTime = duration / steps;
    let current = start;

    const timer = setInterval(() => {
      current += 1;
      setProgress(current);
      if (current >= end) {
        clearInterval(timer);
        callback();
      }
    }, intervalTime);

    return timer;
  };

  const handleUpdate = async () => {
    if (!file) return;

    setError(null);
    setStep('reading');
    setStatusMessage('Güncelleme paketi okunuyor...');
    setProgress(0);

    // Step 1: Read File As Base64 (0% -> 25%)
    const reader = new FileReader();
    
    // Simulate loading progress during reading
    const readTimer = simulateProgress(0, 25, 600, () => {
      setStatusMessage('Sistem paketi çözümleniyor...');
    });

    reader.onload = async (e) => {
      clearInterval(readTimer);
      setProgress(25);

      const base64String = (e.target?.result as string)?.split(',')[1];
      if (!base64String) {
        setStep('error');
        setError('ZIP dosyası okunamadı veya boş.');
        return;
      }

      // Step 2: Uploading (25% -> 80%)
      setStep('uploading');
      setStatusMessage('Sistem dosyaları sunucuya yükleniyor...');
      
      const uploadTimer = simulateProgress(25, 80, 1500, () => {
        setStatusMessage('Güncelleme doğrulanıyor ve kuruluyor...');
      });

      try {
        const response = await fetch('/api/system-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ zipBase64: base64String })
        });

        clearInterval(uploadTimer);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Yükleme işlemi başarısız oldu.');
        }

        const data = await response.json();

        if (data.success) {
          // Step 3: Applying updates (80% -> 100%)
          setStep('applying');
          setStatusMessage('Sistem dosyaları yerleştiriliyor ve optimize ediliyor...');
          
          simulateProgress(80, 100, 800, () => {
            setStep('success');
            setStatusMessage('Sistem dosyaları başarıyla güncellendi!');
            setStats({
              filesCount: data.files.length,
              updatedFiles: data.files
            });
            onUpdateSuccess(`${data.files.length} sistem dosyası başarıyla güncellendi. Değişiklikler aktifleşti!`);
          });
        } else {
          throw new Error('Geçersiz güncelleme yanıtı.');
        }
      } catch (err: any) {
        clearInterval(uploadTimer);
        setStep('error');
        setError(err.message || 'Güncelleme paketi yüklenirken hata oluştu.');
      }
    };

    reader.onerror = () => {
      clearInterval(readTimer);
      setStep('error');
      setError('Sistem dosyası okunurken hata oluştu.');
    };

    // Read the file content
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  // Render Progress Icon based on the current step and percentage
  const renderProgressIcon = () => {
    if (step === 'success') {
      return (
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 border-2 border-emerald-500 animate-pulse" />
          <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
        </div>
      );
    }
    if (step === 'error') {
      return (
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-red-500/10 border-2 border-red-500" />
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
      );
    }

    // Circular progress stroke calculation
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* SVG Circle */}
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="6"
            fill="transparent"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-blue-500 transition-all duration-300"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center content */}
        <div className="flex flex-col items-center justify-center text-center z-10">
          {step === 'reading' && <FolderOpen className="w-5 h-5 text-amber-400 animate-pulse" />}
          {step === 'uploading' && <UploadCloud className="w-5 h-5 text-blue-400 animate-bounce" />}
          {step === 'applying' && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
          
          <span className="text-base font-bold text-white font-mono mt-1">{progress}%</span>
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">İlerleme</span>
        </div>
      </div>
    );
  };

  return (
    <div id="system-update-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-blue-600/15 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
              <FileArchive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-tight">Sistem Dosyaları Güncelleme Merkezi</h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">ZIP UPDATE & VERSION RE-DEPLOYER</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={step === 'reading' || step === 'uploading' || step === 'applying'}
            className="text-slate-400 hover:text-white transition p-1.5 hover:bg-slate-850 rounded-lg cursor-pointer disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {step === 'idle' ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/20 p-4 rounded-xl text-xs space-y-1.5">
                <span className="text-white font-bold block">Yönergeler:</span>
                <p className="text-slate-400 leading-relaxed">
                  Uygulamanın kaynak dosyalarını (örneğin <span className="text-blue-400 font-mono">src/</span>, <span className="text-blue-400 font-mono">server.ts</span>, <span className="text-blue-400 font-mono">package.json</span>) içeren bir ZIP arşiv dosyası yükleyerek uygulamayı anında canlı olarak güncelleyebilirsiniz.
                </p>
                <p className="text-slate-500 font-mono text-[10px]">
                  * Yüklenen ZIP dosyası içerisindeki klasör yapısı, projenin kök dizinine göre eşleşmelidir.
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                  dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 hover:border-slate-750 bg-slate-950/40'
                }`}
              >
                <input 
                  type="file" 
                  id="zip-upload-input" 
                  accept=".zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <UploadCloud className="w-10 h-10 text-slate-500 mb-3 animate-pulse" />
                
                {file ? (
                  <div className="space-y-1">
                    <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full font-mono font-bold inline-block">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <div>
                    <label 
                      htmlFor="zip-upload-input" 
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold cursor-pointer hover:underline"
                    >
                      Bir ZIP dosyası seçin
                    </label>
                    <span className="text-xs text-slate-500"> veya buraya sürükleyip bırakın</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-950/20 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {file && (
                <button
                  onClick={handleUpdate}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg cursor-pointer text-xs uppercase"
                >
                  Sistem Güncellemesini Başlat
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              
              {/* Circular 0-100% Progress Icon */}
              {renderProgressIcon()}

              {/* Status Info */}
              <div className="text-center space-y-1 max-w-sm">
                <h4 className="text-white font-bold text-xs">{statusMessage}</h4>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                  Aşama: {step === 'reading' && 'DOSYA OKUMA'}
                  {step === 'uploading' && 'SUNUCUYA GÖNDERİM'}
                  {step === 'applying' && 'PAKET AÇMA & UYGULAMA'}
                  {step === 'success' && 'GÜNCELLEME TAMAMLANDI'}
                  {step === 'error' && 'GÜNCELLEME BAŞARISIZ'}
                </p>
              </div>

              {/* Progress Line */}
              {step !== 'success' && step !== 'error' && (
                <div className="w-full max-w-xs bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Success Report */}
              {step === 'success' && stats && (
                <div className="w-full space-y-3 bg-slate-950 rounded-xl border border-slate-850 p-4">
                  <div className="flex items-center space-x-2 text-emerald-400 border-b border-slate-900 pb-2">
                    <FileCheck2 className="w-4 h-4" />
                    <span className="text-xs font-bold">Raporlanan Değişiklikler ({stats.filesCount} Dosya)</span>
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-1.5 font-mono text-[10px] text-slate-400">
                    {stats.updatedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5 border-b border-slate-900/40">
                        <span className="truncate max-w-[280px]">{f}</span>
                        <span className="text-emerald-500 font-bold shrink-0">GÜNCELLENDİ</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      // Trigger location reload to load updated assets/scripts
                      window.location.reload();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition text-xs uppercase cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Uygulamayı Yeniden Yükle</span>
                  </button>
                </div>
              )}

              {/* Error Recovery */}
              {step === 'error' && (
                <div className="w-full space-y-4">
                  <div className="bg-red-950/20 border border-red-500/20 text-red-300 p-4 rounded-xl text-xs space-y-1">
                    <span className="font-bold block">Hata Detayı:</span>
                    <p className="font-mono text-[11px] leading-relaxed">{error}</p>
                  </div>

                  <button
                    onClick={() => setStep('idle')}
                    className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold py-2 rounded-xl transition text-xs uppercase cursor-pointer"
                  >
                    Geri Dön ve Yeniden Dene
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500">
          <span className="font-mono flex items-center gap-1">
            <Terminal className="w-3 h-3" />
            SECURE ZIP EXTRACTOR V2
          </span>
          <span>Hatalı yüklemeler geri alınamaz. Yedek almayı unutmayın.</span>
        </div>

      </div>
    </div>
  );
}
