// Logo Database for Popular TV and Radio Channels
// Designed to keep standard Wikipedia / Wikimedia / high-quality public logo URLs for matching

export interface LogoMapping {
  name: string;
  logo: string;
  group?: string;
  keywords: string[]; // Keywords for fuzzy matching
}

export const POPULAR_LOGOS: LogoMapping[] = [
  // TRT Channels
  {
    name: "TRT 1",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/TRT_1_logo.svg",
    group: "TR: Ulusal",
    keywords: ["trt1", "trt 1", "trt one", "trt1hd"]
  },
  {
    name: "TRT Spor",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/29/TRT_Spor_logo.svg",
    group: "TR: Spor",
    keywords: ["trtspor", "trt spor", "trt spor 1", "trtsporhd"]
  },
  {
    name: "TRT Spor Yıldız",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/4e/TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg",
    group: "TR: Spor",
    keywords: ["trtspor2", "trt spor 2", "trtsporyildiz", "trt spor yildiz"]
  },
  {
    name: "TRT Haber",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b0/TRT_Haber_logo.svg",
    group: "TR: Haber",
    keywords: ["trthaber", "trt haber", "trthaberhd"]
  },
  {
    name: "TRT Belgesel",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/52/TRT_Belgesel_logo.svg",
    group: "TR: Belgesel",
    keywords: ["trtbelgesel", "trt belgesel", "trtbelgeselhd"]
  },
  {
    name: "TRT Müzik",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/be/TRT_M%C3%BCzik_logo.svg",
    group: "TR: Müzik",
    keywords: ["trtmuzik", "trt muzik", "trtmuzikhd"]
  },
  {
    name: "TRT Çocuk",
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/df/TRT_%C3%87ocuk_logo.svg",
    group: "TR: Çocuk",
    keywords: ["trtcocuk", "trt cocuk"]
  },
  {
    name: "TRT Haber",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b0/TRT_Haber_logo.svg",
    group: "TR: Haber",
    keywords: ["trthaber", "trt haber"]
  },
  {
    name: "TRT Türk",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/af/TRT_T%C3%BCrk_logo.svg",
    group: "TR: Ulusal",
    keywords: ["trtturk", "trt turk"]
  },
  {
    name: "TRT Avaz",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/87/TRT_Avaz_logo.svg",
    group: "TR: Ulusal",
    keywords: ["trtavaz", "trt avaz"]
  },
  {
    name: "TRT Kurdi",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b6/TRT_Kurd%C3%AE_logo.svg",
    group: "TR: Ulusal",
    keywords: ["trtkurdi", "trt kurdi"]
  },
  {
    name: "TRT World",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/80/TRT_World_logo.svg",
    group: "TR: Haber",
    keywords: ["trtworld", "trt world"]
  },
  {
    name: "TRT 2",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/07/TRT_2_logo_2024.svg",
    group: "TR: Belgesel",
    keywords: ["trt2", "trt 2"]
  },

  // National / Mainstream Turkish Channels
  {
    name: "ATV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Atv_logo_back.png",
    group: "TR: Ulusal",
    keywords: ["atv", "atvhd", "atvavrupa", "atv avrupa"]
  },
  {
    name: "Show TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Show_TV_logo_2011.png",
    group: "TR: Ulusal",
    keywords: ["showtv", "show tv", "showhd", "show max"]
  },
  {
    name: "Kanal D",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Kanal_D_logo_2018.svg",
    group: "TR: Ulusal",
    keywords: ["kanald", "kanal d", "kanaldhd"]
  },
  {
    name: "Star TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/18/Star_TV_logo_2012.png",
    group: "TR: Ulusal",
    keywords: ["startv", "star tv", "starhd"]
  },
  {
    name: "Now TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/03/NOW_logo_2024.svg",
    group: "TR: Ulusal",
    keywords: ["now", "nowtv", "now tv", "fox", "foxtv", "fox tv"]
  },
  {
    name: "TV8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/86/Tv8_logo_2014.png",
    group: "TR: Ulusal",
    keywords: ["tv8", "tv 8", "tv8hd"]
  },
  {
    name: "TV8.5",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/05/Tv8.5_logo_2016.png",
    group: "TR: Spor",
    keywords: ["tv8.5", "tv8,5", "tv 8.5", "tv8bucuk", "tv8 bucuk"]
  },
  {
    name: "Kanal 7",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Kanal_7_logo_2022.svg",
    group: "TR: Ulusal",
    keywords: ["kanal7", "kanal 7", "kanal7hd", "kanal 7 avrupa"]
  },
  {
    name: "Teve2",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Teve2_logo.png",
    group: "TR: Ulusal",
    keywords: ["teve2", "teve 2"]
  },
  {
    name: "A2",
    logo: "https://upload.wikimedia.org/wikipedia/commons/c/cd/A2_tv_logo.png",
    group: "TR: Ulusal",
    keywords: ["a2", "a2tv", "a2 tv"]
  },
  {
    name: "TLC",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/87/TLC_logo.svg",
    group: "TR: Belgesel",
    keywords: ["tlc", "tlctv", "tlc tv"]
  },
  {
    name: "DMAX",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/af/DMAX_logo_2019.svg",
    group: "TR: Belgesel",
    keywords: ["dmax", "dmaxtv", "dmax tv"]
  },

  // News Channels (TR: Haber)
  {
    name: "Halk TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Halk_TV_logo.svg",
    group: "TR: Haber",
    keywords: ["halktv", "halk tv", "halk"]
  },
  {
    name: "Sözcü TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8f/S%C3%B6zc%C3%BC_TV_logo.svg",
    group: "TR: Haber",
    keywords: ["sozcutv", "sozcu tv", "szc", "szctv", "szc tv"]
  },
  {
    name: "Habertürk",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/15/Habert%C3%BCrk_TV_logo_2013.svg",
    group: "TR: Haber",
    keywords: ["haberturk", "haberturk tv", "habertürktv"]
  },
  {
    name: "NTV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/e6/NTV_logo_2015.svg",
    group: "TR: Haber",
    keywords: ["ntv", "ntvhd", "ntvhaber"]
  },
  {
    name: "CNN Türk",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2c/CNN_T%C3%BCrk_logo.svg",
    group: "TR: Haber",
    keywords: ["cnnturk", "cnn turk", "cnn türk"]
  },
  {
    name: "A Haber",
    logo: "https://upload.wikimedia.org/wikipedia/commons/6/67/A_Haber_logo.svg",
    group: "TR: Haber",
    keywords: ["ahaber", "a haber", "ahaberhd"]
  },
  {
    name: "Ekol TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/36/Ekol_TV_logo.png",
    group: "TR: Haber",
    keywords: ["ekoltv", "ekol tv"]
  },
  {
    name: "Tele1",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/91/Tele1_logo.png",
    group: "TR: Haber",
    keywords: ["tele1", "tele 1"]
  },
  {
    name: "KRT TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b5/KRT_TV_logo.svg",
    group: "TR: Haber",
    keywords: ["krttv", "krt tv", "krt"]
  },
  {
    name: "TGRT Haber",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/52/TGRT_Haber_logo_2021.svg",
    group: "TR: Haber",
    keywords: ["tgrthaber", "tgrt haber"]
  },
  {
    name: "Ülke TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/29/%C3%9Clke_TV_logo.png",
    group: "TR: Haber",
    keywords: ["ulketv", "ulke tv", "ülke tv"]
  },
  {
    name: "Bloomberg HT",
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/df/Bloomberg_HT_logo.svg",
    group: "TR: Haber",
    keywords: ["bloomberght", "bloomberg", "bloomberg ht"]
  },
  {
    name: "A Para",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5d/A_Para_logo.png",
    group: "TR: Haber",
    keywords: ["apara", "a para"]
  },

  // Sports Channels (TR: Spor)
  {
    name: "A Spor",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/87/A_Spor_logo_2016.svg",
    group: "TR: Spor",
    keywords: ["aspor", "a spor", "asporhd"]
  },
  {
    name: "S Sport",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/38/S_Sport_logo_2021.svg",
    group: "TR: Spor",
    keywords: ["ssport", "s spor", "s sport 1", "ssport1"]
  },
  {
    name: "S Sport 2",
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/de/S_Sport_2_logo.png",
    group: "TR: Spor",
    keywords: ["ssport2", "s sport 2", "ssport 2"]
  },
  {
    name: "beIN Sports Haber",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/05/BeIN_Sports_logo.svg",
    group: "TR: Spor",
    keywords: ["beinsports", "beinsportshaber", "bein sports haber", "bein spor", "bein haber"]
  },
  {
    name: "beIN Sports 1",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/05/BeIN_Sports_logo.svg",
    group: "TR: Spor",
    keywords: ["beinsports1", "bein sports 1", "bein 1"]
  },
  {
    name: "beIN Sports 2",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/05/BeIN_Sports_logo.svg",
    group: "TR: Spor",
    keywords: ["beinsports2", "bein sports 2", "bein 2"]
  },
  {
    name: "Eurosport 1",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/90/Eurosport_logo_2015.svg",
    group: "TR: Spor",
    keywords: ["eurosport", "eurosport1", "euro sport 1", "eurosport 1"]
  },
  {
    name: "Eurosport 2",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/90/Eurosport_logo_2015.svg",
    group: "TR: Spor",
    keywords: ["eurosport2", "euro sport 2", "eurosport 2"]
  },
  {
    name: "Tivibu Spor",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Tivibu_Logo.svg",
    group: "TR: Spor",
    keywords: ["tivibuspor", "tivibu spor", "tivibu spor 1"]
  },

  // Music Channels (TR: Müzik)
  {
    name: "Kral Pop TV",
    logo: "https://upload.wikimedia.org/wikipedia/tr/6/65/Kral_Pop_TV_Logo.png",
    group: "TR: Müzik",
    keywords: ["kralpop", "kralpoptv", "kral pop tv"]
  },
  {
    name: "PowerTürk TV",
    logo: "https://upload.wikimedia.org/wikipedia/tr/e/e0/Power_T%C3%BCrk_TV_Yeni_Logo.png",
    group: "TR: Müzik",
    keywords: ["powerturk", "powerturktv", "powertürk tv", "powerturk tv"]
  },
  {
    name: "Dream Türk",
    logo: "https://upload.wikimedia.org/wikipedia/tr/4/4c/Dream_T%C3%BCrk_Logo.png",
    group: "TR: Müzik",
    keywords: ["dreamturk", "dream turk", "dreamtürk", "dream türk"]
  },
  {
    name: "Number One TV",
    logo: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Number_1_HD.png",
    group: "TR: Müzik",
    keywords: ["numberonetv", "numberone tv", "number one tv", "nr1 tv", "nr1tv"]
  },

  // Radio Channels (TR: Radyo)
  {
    name: "Kral FM",
    logo: "https://upload.wikimedia.org/wikipedia/tr/4/4c/Kral_Fm_Logo.png",
    group: "TR: Radyo",
    keywords: ["kralfm", "kral fm"]
  },
  {
    name: "TRT FM",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5f/TRT_FM_logo.svg",
    group: "TR: Radyo",
    keywords: ["trtfm", "trt fm"]
  },
  {
    name: "Kral Pop Radyo",
    logo: "https://upload.wikimedia.org/wikipedia/tr/8/8e/Kral_Pop_Logo.png",
    group: "TR: Radyo",
    keywords: ["kralpopradyo", "kral pop radyo", "kral pop fm", "kralpop fm"]
  },
  {
    name: "Metro FM",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Metro_FM_logo.png",
    group: "TR: Radyo",
    keywords: ["metrofm", "metro fm"]
  },
  {
    name: "Süper FM",
    logo: "https://upload.wikimedia.org/wikipedia/tr/1/1d/S%C3%BCper_Fm_Yeni_Logo.png",
    group: "TR: Radyo",
    keywords: ["superfm", "süper fm", "super fm"]
  },
  {
    name: "Power FM",
    logo: "https://upload.wikimedia.org/wikipedia/tr/6/62/Power_FM_Logo.png",
    group: "TR: Radyo",
    keywords: ["powerfm", "power fm"]
  },
  {
    name: "Joy FM",
    logo: "https://upload.wikimedia.org/wikipedia/tr/9/91/Joy_Fm_Yeni_Logo.png",
    group: "TR: Radyo",
    keywords: ["joyfm", "joy fm"]
  },
  {
    name: "Joy Türk",
    logo: "https://upload.wikimedia.org/wikipedia/tr/4/43/Joy_T%C3%BCrk_Yeni_Logo.png",
    group: "TR: Radyo",
    keywords: ["joyturk", "joy turk", "joytürk", "joy türk"]
  },
  {
    name: "Virgin Radio",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/10/Virgin_Radio_logo.svg",
    group: "TR: Radyo",
    keywords: ["virgin", "virginradio", "virgin radio", "virgin fm"]
  },
  {
    name: "Alem FM",
    logo: "https://upload.wikimedia.org/wikipedia/tr/1/1e/Alem_Fm_Logo.png",
    group: "TR: Radyo",
    keywords: ["alemfm", "alem fm"]
  },
  {
    name: "Radyo D",
    logo: "https://upload.wikimedia.org/wikipedia/tr/1/1a/Radyo_D_Logo.png",
    group: "TR: Radyo",
    keywords: ["radyod", "radyo d"]
  },
  {
    name: "Radyo Fenomen",
    logo: "https://upload.wikimedia.org/wikipedia/tr/a/a2/Radyo_Fenomen_Logo.png",
    group: "TR: Radyo",
    keywords: ["radyofenomen", "radyo fenomen", "fenomen", "fenomen fm"]
  }
];

// Helper to normalize strings for perfect comparisons (accent insensitive, punctuation stripped, suffix trimmed)
export function normalizeChannelName(name: string): string {
  if (!name) return "";

  let norm = name.toLowerCase();

  // Remove common prefix numbering like "1.", "01.", "1. ", etc.
  norm = norm.replace(/^\d+[\.\s-]+\s*/, "");

  // Turkish character translation
  const charMap: Record<string, string> = {
    "ş": "s", "ç": "c", "ı": "i", "ğ": "g", "ö": "o", "ü": "u",
    "â": "a", "î": "i", "û": "u"
  };
  
  let translated = "";
  for (let i = 0; i < norm.length; i++) {
    const char = norm[i];
    translated += charMap[char] || char;
  }
  norm = translated;

  // Remove common M3U/player tags & prefixes/suffixes
  norm = norm.replace(/\b(hd|sd|fhd|4k|uhd|hevc|h264|h265|canli|izle|stream|live|back|1080p|720p|576p|hq)\b/gi, "");

  // Strip all non-alphanumeric characters, except spaces (to allow keyword matching)
  norm = norm.replace(/[^a-z0-9\s]/g, "");

  // Reduce multiple spaces to a single space
  norm = norm.replace(/\s+/g, " ").trim();

  return norm;
}

// Find a logo mapping for a given channel name
export function findLogoForChannel(channelName: string): { logo?: string; group?: string } | null {
  const normalizedInput = normalizeChannelName(channelName);
  if (!normalizedInput) return null;

  // 1. Direct exact match in normalized names/keywords
  for (const item of POPULAR_LOGOS) {
    // If the input exactly matches the normalized name
    if (normalizeChannelName(item.name) === normalizedInput) {
      return { logo: item.logo, group: item.group };
    }

    // If the input is in the keyword list
    for (const kw of item.keywords) {
      if (normalizeChannelName(kw) === normalizedInput) {
        return { logo: item.logo, group: item.group };
      }
    }
  }

  // 2. Substring/Fuzzy match
  // E.g., if the user imports "TRT 1 HD [CANLI]", normalizedInput is "trt 1"
  // Let's check if normalizedInput starts with or contains any key keywords
  for (const item of POPULAR_LOGOS) {
    for (const kw of item.keywords) {
      const normKw = normalizeChannelName(kw);
      if (normKw.length > 2 && (normalizedInput.includes(normKw) || normKw.includes(normalizedInput))) {
        return { logo: item.logo, group: item.group };
      }
    }
  }

  return null;
}

// Batch assign logos to a playlist of channels
export function autoAssignLogos(items: any[]): any[] {
  return items.map(item => {
    // Only search/assign if there's no current logo
    if (!item.logo || item.logo.trim() === "") {
      const found = findLogoForChannel(item.name);
      if (found) {
        return {
          ...item,
          logo: found.logo,
          // Respect existing group if already present, otherwise set mapped one
          group: item.group || found.group
        };
      }
    }
    return item;
  });
}
