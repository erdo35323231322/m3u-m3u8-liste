import React from 'react';
import { Tv, Radio, Plus, Play, Sparkles } from 'lucide-react';
import { PlaylistItem } from '../types';

interface ChannelPresetsProps {
  onSelectStream: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => void;
  onAddStreamToList: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string; group?: string }) => void;
}

export const PRESET_CHANNELS = [
  // TV CHANNELS
  {
    name: "TRT 1 (Milli Kanal)",
    url: "https://tv-trt1.medya.trt.com.tr/trt/trt1/index.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/TRT_1_logo.svg",
    group: "TR: Ulusal"
  },
  {
    name: "TRT Spor",
    url: "https://tv-trtspor.medya.trt.com.tr/trt/trtspor/index.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/29/TRT_Spor_logo.svg",
    group: "TR: Spor"
  },
  {
    name: "TRT Haber",
    url: "https://tv-trthaber.medya.trt.com.tr/trt/trthaber/index.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b0/TRT_Haber_logo.svg",
    group: "TR: Haber"
  },
  {
    name: "TRT Belgesel",
    url: "https://tv-trtbelgesel.medya.trt.com.tr/trt/trtbelgesel/index.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/52/TRT_Belgesel_logo.svg",
    group: "TR: Belgesel"
  },
  {
    name: "TRT Müzik",
    url: "https://tv-trtmuzik.medya.trt.com.tr/trt/trtmuzik/index.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/be/TRT_M%C3%BCzik_logo.svg",
    group: "TR: Müzik"
  },
  {
    name: "TRT Çocuk",
    url: "https://tv-trtcocuk.medya.trt.com.tr/trt/trtcocuk/index.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/df/TRT_%C3%87ocuk_logo.svg",
    group: "TR: Çocuk"
  },
  {
    name: "Halk TV",
    url: "https://halktv.live-s.cdn.bitgravity.com/halktv/live/playlist.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Halk_TV_logo.svg",
    group: "TR: Haber"
  },
  {
    name: "Kral Pop TV",
    url: "https://dogus-live.daioncdn.net/kralpoptv/kralpoptv.m3u8",
    type: "tv" as const,
    logo: "https://upload.wikimedia.org/wikipedia/tr/6/65/Kral_Pop_TV_Logo.png",
    group: "TR: Müzik"
  },
  
  // RADIO CHANNELS
  {
    name: "Kral FM (Arabesk)",
    url: "https://dogus-live.daioncdn.net/kralfm/kralfm.m3u8",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/tr/4/4c/Kral_Fm_Logo.png",
    group: "TR: Radyo"
  },
  {
    name: "TRT FM",
    url: "https://radyo-trtfm.medya.trt.com.tr/trt/trtfm/index.m3u8",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5f/TRT_FM_logo.svg",
    group: "TR: Radyo"
  },
  {
    name: "Kral Pop Radyo",
    url: "https://dogus-live.daioncdn.net/kralpop/kralpop.m3u8",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/tr/8/8e/Kral_Pop_Logo.png",
    group: "TR: Radyo"
  },
  {
    name: "Metro FM (Yabancı Pop)",
    url: "https://shoutcast.radyogrup.com/metro",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Metro_FM_logo.png",
    group: "TR: Radyo"
  },
  {
    name: "Süper FM (Türkçe Pop)",
    url: "https://shoutcast.radyogrup.com/super",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/tr/1/1d/S%C3%BCper_Fm_Yeni_Logo.png",
    group: "TR: Radyo"
  },
  {
    name: "Power FM",
    url: "https://powerapp.listenpowerapp.com/powerfm/mpeg.128/playlist.m3u8",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/tr/6/62/Power_FM_Logo.png",
    group: "TR: Radyo"
  },
  {
    name: "Joy FM (Slow)",
    url: "https://shoutcast.radyogrup.com/joyfm",
    type: "radyo" as const,
    logo: "https://upload.wikimedia.org/wikipedia/tr/9/91/Joy_Fm_Yeni_Logo.png",
    group: "TR: Radyo"
  }
];

export default function ChannelPresets({ onSelectStream, onAddStreamToList }: ChannelPresetsProps) {
  return (
    <div id="channel-presets-panel" className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 fill-current animate-pulse" />
            Hazır Popüler Yayınlar Kütüphanesi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Test etmek veya listenize eklemek için hazır TRT kanallarını ve radyolarını kullanın</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PRESET_CHANNELS.map((channel, idx) => (
          <div 
            key={idx} 
            className="group relative bg-slate-900 border border-slate-800/80 hover:border-blue-500/30 p-3.5 rounded flex flex-col items-center justify-between text-center transition duration-200"
          >
            {/* Category badge */}
            <span className={`absolute top-2 left-2 text-[8px] font-mono px-1.5 py-0.5 rounded ${channel.type === 'tv' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {channel.type === 'tv' ? 'TV' : 'Radyo'}
            </span>

            {/* Logo container */}
            <div className="w-16 h-16 bg-white/5 rounded border border-slate-800 p-2 flex items-center justify-center my-2 group-hover:scale-105 transition-transform">
              {channel.logo ? (
                <img 
                  src={channel.logo} 
                  alt="" 
                  className="max-w-full max-h-full object-contain p-0.5 rounded bg-white"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Hide image and show fallback icon
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                channel.type === 'tv' ? <Tv className="w-7 h-7 text-blue-400" /> : <Radio className="w-7 h-7 text-emerald-400" />
              )}
            </div>

            {/* Title */}
            <div className="mt-1 mb-2.5">
              <p className="text-xs font-semibold text-slate-200 line-clamp-1">{channel.name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{channel.group}</p>
            </div>

            {/* Buttons */}
            <div className="flex w-full space-x-1.5 mt-auto">
              <button
                onClick={() => onSelectStream(channel)}
                title="Oynatıcıda Test Et"
                className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-medium border border-slate-800 transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test</span>
              </button>
              <button
                onClick={() => onAddStreamToList(channel)}
                title="M3U Listesine Ekle"
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition flex items-center justify-center space-x-0.5 cursor-pointer border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ekle</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
