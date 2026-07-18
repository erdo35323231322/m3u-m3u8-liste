export interface PlaylistItem {
  id: number; // Sequential index 1, 2, 3...
  name: string;
  url: string;
  type: 'tv' | 'radyo';
  logo?: string;
  group?: string;
  userAgent?: string;
  status?: 'active' | 'broken' | 'testing';
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
}

export interface ExtractedChannel {
  name: string;
  url: string;
  type: 'tv' | 'radyo';
  logo?: string;
  group?: string;
}

export interface PlayerPreset {
  name: string;
  description: string;
  userAgent: string;
  headersString: string;
}
