import React, { useState, useRef } from 'react';
import { PlaylistItem, Playlist } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Copy, Download, Trash2, Edit2, ArrowUp, ArrowDown, 
  Sparkles, Save, X, RefreshCw, Upload, Plus, Play, Check,
  ListMusic, FolderOpen, Copy as CopyIcon, PlusCircle, Layers, HelpCircle,
  GitMerge, Image
} from 'lucide-react';
import { autoAssignLogos, findLogoForChannel } from '../lib/logoDatabase';

interface M3uListPreviewProps {
  items: PlaylistItem[];
  onUpdateItems: (newItems: PlaylistItem[]) => void;
  onSelectStream: (stream: { name: string; url: string; type: 'tv' | 'radyo'; logo?: string }) => void;
  playlists?: Playlist[];
  activePlaylistId?: string;
  onSelectPlaylist?: (id: string) => void;
  onUpdatePlaylists?: (newPlaylists: Playlist[]) => void;
}

export default function M3uListPreview({ 
  items, 
  onUpdateItems, 
  onSelectStream,
  playlists = [],
  activePlaylistId = 'default',
  onSelectPlaylist,
  onUpdatePlaylists
}: M3uListPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isLogoSearching, setIsLogoSearching] = useState(false);
  
  // Channel single update state
  const [isUpdatingChannels, setIsUpdatingChannels] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  const [updateStatusText, setUpdateStatusText] = useState("");
  const isUpdatingRef = useRef(false);

  const [editingItem, setEditingItem] = useState<PlaylistItem | null>(null);
  
  // Custom headers options
  const [m3uType, setM3uType] = useState<'m3u' | 'm3u8'>('m3u8');
  const [prependNumbers, setPrependNumbers] = useState(true);
  const [customUserAgent, setCustomUserAgent] = useState('VLC/3.0.18');
  const [customTitle, setCustomTitle] = useState('Android TV Optimize Playlist');

  // Multi-playlist management states
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState<string>('');
  
  // Multi-playlist import modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importItems, setImportItems] = useState<PlaylistItem[] | null>(null);
  const [importName, setImportName] = useState<string>('');

  // Multi-playlist merge states
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [mergeNewName, setMergeNewName] = useState('Birleştirilmiş Liste');
  const [mergeRemoveDuplicates, setMergeRemoveDuplicates] = useState(true);

  // Same-device IPTV loading states
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Group and Sort state
  const [autoGroupAndSort, setAutoGroupAndSort] = useState(false);

  // Custom confirmation dialog state to bypass native blocked iframe confirm()
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Helper to group items by their group and sort alphabetically within
  const getGroupedAndSortedList = (list: PlaylistItem[]): PlaylistItem[] => {
    // 1. Get all unique groups in current list
    const groups = Array.from(new Set(list.map(item => item.group || (item.type === 'tv' ? 'TV' : 'Radyo'))));
    
    // 2. Sort groups (TV/Ulusal groups first, Radio/Radyo groups last)
    groups.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aIsRadio = aLower.includes('radyo') || aLower.includes('radio');
      const bIsRadio = bLower.includes('radyo') || bLower.includes('radio');
      if (aIsRadio && !bIsRadio) return 1;
      if (!aIsRadio && bIsRadio) return -1;
      return a.localeCompare(b, 'tr');
    });

    const sortedItems: PlaylistItem[] = [];
    groups.forEach(groupName => {
      const groupItems = list.filter(item => {
        const itemGroup = item.group || (item.type === 'tv' ? 'TV' : 'Radyo');
        return itemGroup === groupName;
      });
      // Sort alphabetically inside the group
      groupItems.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      sortedItems.push(...groupItems);
    });

    // Re-assign IDs sequentially starting from 1
    return sortedItems.map((item, index) => ({
      ...item,
      id: index + 1
    }));
  };

  const handleGroupAndSort = () => {
    if (items.length === 0) return;
    const sorted = getGroupedAndSortedList(items);
    onUpdateItems(sorted);
  };

  // Auto-group and sort whenever items change and option is checked
  React.useEffect(() => {
    if (!autoGroupAndSort || items.length === 0) return;

    const sorted = getGroupedAndSortedList(items);
    // Check if the list order/structure actually changed to avoid infinite loop
    const hasChanged = items.some((item, idx) => {
      const sItem = sorted[idx];
      return !sItem || sItem.name !== item.name || sItem.url !== item.url || sItem.group !== item.group;
    });

    if (hasChanged) {
      onUpdateItems(sorted);
    }
  }, [items, autoGroupAndSort]);

  // Auto-reset synced URL when list or settings change
  React.useEffect(() => {
    setPlaylistId(null);
    setSyncError(null);
  }, [items, m3uType, prependNumbers, customUserAgent]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate the M3U string
  const generateM3uString = (): string => {
    let output = m3uType === 'm3u8' ? '#EXTM3U x-tvg-url=""\n' : '#EXTM3U\n';
    
    // Add custom general player options if applicable
    if (customUserAgent) {
      output += `#EXTVLCOPT:http-user-agent=${customUserAgent}\n`;
    }

    items.forEach((item, index) => {
      const displayIndex = index + 1;
      const displayName = prependNumbers ? `${displayIndex}. ${item.name}` : item.name;
      const tvgLogo = item.logo ? ` tvg-logo="${item.logo}"` : '';
      const groupTitle = item.group ? ` group-title="${item.group}"` : ` group-title="${item.type === 'tv' ? 'TV' : 'Radyo'}"`;
      const tvgId = ` tvg-id="${displayIndex}"`;
      const tvgName = ` tvg-name="${item.name}"`;
      const userAgentOption = item.userAgent ? `\n#EXTVLCOPT:http-user-agent=${item.userAgent}` : '';

      output += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${displayName}${userAgentOption}\n${item.url}\n`;
    });

    return output;
  };

  const m3uContent = generateM3uString();

  const sendToBackup = async (content: string) => {
    try {
      fetch('/api/backup-m3u', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ m3uContent: content }),
      });
    } catch (e) {
      console.error('Background backup trigger failed:', e);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(m3uContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    sendToBackup(m3uContent);
  };

  const handleDownload = () => {
    const blob = new Blob([m3uContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `android_optimize_playlist.${m3uType}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    sendToBackup(m3uContent);
  };

  // Reordering functions
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= items.length) return;
    
    // Swap items
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    
    // Re-assign IDs sequentially
    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      id: idx + 1
    }));

    onUpdateItems(updatedItems);
  };

  const handleDelete = (index: number) => {
    const filtered = items.filter((_, idx) => idx !== index);
    // Re-index
    const updated = filtered.map((item, idx) => ({
      ...item,
      id: idx + 1
    }));
    onUpdateItems(updated);
  };

  // Editing logic
  const handleStartEdit = (item: PlaylistItem) => {
    setEditingItem({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const updated = items.map(item => item.id === editingItem.id ? editingItem : item);
    onUpdateItems(updated);
    setEditingItem(null);
  };

  // Multi-playlist action helpers
  const handleCreatePlaylist = (nameSuffix?: string) => {
    if (!onUpdatePlaylists || !playlists) return;
    const newId = `playlist_${Date.now()}`;
    const newName = nameSuffix || `Yeni Liste ${playlists.length + 1}`;
    const newPlaylist: Playlist = {
      id: newId,
      name: newName,
      items: []
    };
    onUpdatePlaylists([...playlists, newPlaylist]);
    onSelectPlaylist?.(newId);
  };

  const handleDuplicatePlaylist = (playlistToDup: Playlist) => {
    if (!onUpdatePlaylists || !playlists) return;
    const newId = `playlist_${Date.now()}`;
    const newPlaylist: Playlist = {
      id: newId,
      name: `${playlistToDup.name} (Kopya)`,
      items: playlistToDup.items.map(item => ({ ...item }))
    };
    onUpdatePlaylists([...playlists, newPlaylist]);
    onSelectPlaylist?.(newId);
  };

  const handleDeletePlaylist = (playlistIdToDelete: string) => {
    if (!onUpdatePlaylists || !playlists) return;
    const playlistToDelete = playlists.find(p => p.id === playlistIdToDelete);
    if (!playlistToDelete) return;

    if (playlists.length <= 1) {
      setConfirmDialog({
        title: "Son Çalma Listesini Sil",
        message: `"${playlistToDelete.name}" son kalan çalma listenizdir. Bu çalma listesini silip yeni, boş bir liste oluşturmak istediğinizden emin misiniz?`,
        onConfirm: () => {
          const newId = `playlist_${Date.now()}`;
          const newPlaylist: Playlist = {
            id: newId,
            name: 'Ana Çalma Listesi',
            items: []
          };
          onUpdatePlaylists([newPlaylist]);
          onSelectPlaylist?.(newId);
        }
      });
      return;
    }

    setConfirmDialog({
      title: "Çalma Listesini Sil",
      message: `"${playlistToDelete.name}" çalma listesini ve içindeki tüm kanalları silmek istediğinizden emin misiniz?`,
      onConfirm: () => {
        const filtered = playlists.filter(p => p.id !== playlistIdToDelete);
        onUpdatePlaylists(filtered);
        if (activePlaylistId === playlistIdToDelete) {
          onSelectPlaylist?.(filtered[0].id);
        }
      }
    });
  };

  const handleRenamePlaylist = (id: string, newName: string) => {
    if (!onUpdatePlaylists || !playlists || !newName.trim()) return;
    onUpdatePlaylists(playlists.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
    setEditingPlaylistId(null);
  };

  // Import choice handlers
  const handleImportAsNewPlaylist = () => {
    if (!onUpdatePlaylists || !playlists || !importItems) return;
    const newId = `playlist_${Date.now()}`;
    const newPlaylist: Playlist = {
      id: newId,
      name: importName || `İçe Aktarılan Liste`,
      items: importItems
    };
    onUpdatePlaylists([...playlists, newPlaylist]);
    onSelectPlaylist?.(newId);
    setIsImportModalOpen(false);
    setImportItems(null);
  };

  const handleImportReplaceActive = () => {
    if (!importItems) return;
    onUpdateItems(importItems);
    setIsImportModalOpen(false);
    setImportItems(null);
  };

  const handleImportMergeActive = () => {
    if (!importItems) return;
    const baseId = items.length;
    const mergedItems = [
      ...items,
      ...importItems.map((item, idx) => ({
        ...item,
        id: baseId + idx + 1
      }))
    ];
    onUpdateItems(mergedItems);
    setIsImportModalOpen(false);
    setImportItems(null);
  };

  const handleMergePlaylists = () => {
    if (!onUpdatePlaylists || !playlists || mergeSelectedIds.length < 2) {
      alert('Lütfen birleştirmek için en az iki çalma listesi seçin.');
      return;
    }

    const selectedPlaylists = playlists.filter(p => mergeSelectedIds.includes(p.id));
    
    let combinedItems: PlaylistItem[] = [];
    const seenUrls = new Set<string>();

    selectedPlaylists.forEach(p => {
      p.items.forEach(item => {
        if (mergeRemoveDuplicates) {
          if (seenUrls.has(item.url)) {
            return;
          }
          seenUrls.add(item.url);
        }
        combinedItems.push({ ...item });
      });
    });

    // Re-index all combined items sequentially
    combinedItems = combinedItems.map((item, index) => ({
      ...item,
      id: index + 1
    }));

    const newId = `playlist_merged_${Date.now()}`;
    const newPlaylist: Playlist = {
      id: newId,
      name: mergeNewName.trim() || 'Birleştirilmiş Çalma Listesi',
      items: combinedItems
    };

    onUpdatePlaylists([...playlists, newPlaylist]);
    onSelectPlaylist?.(newId);
    
    // Reset states
    setIsMergeModalOpen(false);
    setMergeSelectedIds([]);
    setMergeNewName('Birleştirilmiş Liste');
  };

  // Import existing M3U file
  const handleImportM3u = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const parsedItems: PlaylistItem[] = [];
      const lines = text.split('\n');
      
      let currentItem: Partial<PlaylistItem> = {};

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          currentItem = {};
          
          // Parse name (everything after the last comma)
          const commaIndex = line.lastIndexOf(',');
          let name = 'Bilinmeyen Kanal';
          if (commaIndex !== -1) {
            name = line.substring(commaIndex + 1).trim();
            // Remove prepended numbering if it already exists e.g. "1. TRT 1" -> "TRT 1"
            name = name.replace(/^\d+[\.\s-]+\s*/, '');
          }
          currentItem.name = name;

          // Parse tvg-logo
          const logoMatch = line.match(/tvg-logo="([^"]+)"/);
          if (logoMatch) currentItem.logo = logoMatch[1];

          // Parse group-title
          const groupMatch = line.match(/group-title="([^"]+)"/);
          if (groupMatch) currentItem.group = groupMatch[1];

          // Determine type based on logo or group
          const isRadio = (currentItem.group?.toLowerCase().includes('radio') || currentItem.group?.toLowerCase().includes('radyo'));
          currentItem.type = isRadio ? 'radyo' : 'tv';

        } else if (!line.startsWith('#')) {
          // This line is the URL
          if (currentItem.name) {
            currentItem.url = line;
            parsedItems.push({
              id: parsedItems.length + 1,
              name: currentItem.name,
              url: currentItem.url,
              type: currentItem.type || 'tv',
              logo: currentItem.logo,
              group: currentItem.group,
            });
            currentItem = {};
          }
        }
      }

      if (parsedItems.length > 0) {
        // Otomatik logo veritabanı eşleştirmesi ile zenginleştir
        const enrichedItems = autoAssignLogos(parsedItems);
        setImportItems(enrichedItems);
        setImportName(file.name.replace(/\.[^/.]+$/, ""));
        setIsImportModalOpen(true);
      } else {
        alert('Geçerli bir M3U dosyası bulunamadı. Lütfen dosya formatını kontrol edin.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // AI-Powered playlist restructure / clean
  const handleAiOptimize = async () => {
    if (items.length === 0) {
      alert('Optimizasyon yapmak için listenize en az bir kanal ekleyin.');
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/optimize-m3u', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ m3uContent: m3uContent }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Yapay zeka optimizasyonu başarısız oldu.');
      }

      if (data.channels && data.channels.length > 0) {
        const optimizedItems: PlaylistItem[] = data.channels.map((ch: any, idx: number) => ({
          id: idx + 1,
          name: ch.name,
          url: ch.url,
          type: ch.type || 'tv',
          logo: ch.logo || undefined,
          group: ch.group || undefined,
        }));
        onUpdateItems(optimizedItems);
        alert('Tebrikler! Listeniz Gemini Yapay Zekası tarafından tamamen optimize edildi, logolar atandı ve düzgünce gruplandırıldı!');
      } else {
        alert('Optimizasyon sonucu boş döndü.');
      }
    } catch (err: any) {
      alert(`Optimizasyon hatası: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Otomatik & AI destekli Logo Arama Servisi
  const handleAutoSearchLogos = async () => {
    if (items.length === 0) {
      alert('Logo araması yapmak için listenizde en az bir kanal bulunmalıdır.');
      return;
    }

    setIsLogoSearching(true);
    try {
      // 1. Önce popüler yerel logo veritabanından eşleştir
      const locallyMatched = autoAssignLogos(items);
      const newlyMatchedCount = locallyMatched.filter((item, idx) => !items[idx].logo && item.logo).length;

      // Hâlâ logosu olmayan kanalları belirle
      const missingLogoNames = locallyMatched
        .filter(item => !item.logo || item.logo.trim() === "")
        .map(item => item.name);

      if (missingLogoNames.length === 0) {
        onUpdateItems(locallyMatched);
        alert(`Tüm kanal logoları eşleştirildi! Toplam ${newlyMatchedCount} adet yeni logo popüler veritabanından başarıyla eklendi.`);
        setIsLogoSearching(false);
        return;
      }

      setIsLogoSearching(false);

      // 2. Kalan kanallar için Gemini Yapay Zeka logo arama servisini teklif et
      setConfirmDialog({
        title: "Yapay Zeka ile Logo Ara",
        message: `Popüler veritabanından ${newlyMatchedCount} adet logo başarıyla eşleştirildi. Hâlâ logosu bulunamayan ${missingLogoNames.length} adet kanal için Gemini Yapay Zekası ile internetten logo görseli aransın mı?`,
        onConfirm: async () => {
          setIsLogoSearching(true);
          try {
            const response = await fetch('/api/search-logos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channelNames: missingLogoNames }),
            });

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'Yapay zeka logo araması başarısız oldu.');
            }

            if (data.logos && Array.isArray(data.logos)) {
              const logoMap = new Map<string, string>();
              data.logos.forEach((item: any) => {
                if (item.name && item.logo && item.logo.trim() !== "") {
                  logoMap.set(item.name.toLowerCase().trim(), item.logo);
                }
              });

              let aiMatchedCount = 0;
              const fullyEnriched = locallyMatched.map(item => {
                if (!item.logo || item.logo.trim() === "") {
                  const cleanName = item.name.toLowerCase().trim();
                  let matchedLogo = logoMap.get(cleanName);
                  if (!matchedLogo) {
                    for (const [nameKey, urlVal] of logoMap.entries()) {
                      if (cleanName.includes(nameKey) || nameKey.includes(cleanName)) {
                        matchedLogo = urlVal;
                        break;
                      }
                    }
                  }

                  if (matchedLogo) {
                    aiMatchedCount++;
                    return { ...item, logo: matchedLogo };
                  }
                }
                return item;
              });

              onUpdateItems(fullyEnriched);
              alert(`Logo Arama Başarıyla Tamamlandı!\n\n- Popüler Veritabanından Bulunan: ${newlyMatchedCount}\n- Yapay Zeka ile İnternetten Bulunan: ${aiMatchedCount}\n\nToplam ${newlyMatchedCount + aiMatchedCount} adet kanala yeni logo atanmıştır.`);
            } else {
              onUpdateItems(locallyMatched);
              alert(`Popüler veritabanından ${newlyMatchedCount} logo eklendi. Yapay zeka araması ek sonuç bulamadı.`);
            }
          } catch (err: any) {
            alert(`Logo arama servisinde bir hata oluştu: ${err.message}`);
          } finally {
            setIsLogoSearching(false);
          }
        }
      });
    } catch (err: any) {
      alert(`Logo arama servisinde bir hata oluştu: ${err.message}`);
      setIsLogoSearching(false);
    }
  };

  const handleUpdateChannels = () => {
    if (items.length === 0) return;
    
    setConfirmDialog({
      title: "Kanalları Akıllı Güncelle & Doğrula",
      message: "Tüm kanal listeniz tek tek analiz edilecektir. Aktif yayınlar kontrol edilecek, çalışmayan yayınlar için otomatik olarak internetten (kanal adı + m3u/m3u8) güncel yayın linkleri ve yüksek kaliteli logolar aranacaktır. Eğer çalışan yeni bir yayın bulunamazsa o kanal listeden temizlenecektir. Devam etmek istiyor musunuz?",
      onConfirm: async () => {
        setIsUpdatingChannels(true);
        isUpdatingRef.current = true;
        setUpdateProgress({ current: 0, total: items.length });
        setUpdateStatusText("Kanal güncelleme işlemi başlatılıyor...");

        const originalItems = [...items];
        const total = originalItems.length;
        const finalUpdatedList: PlaylistItem[] = [];
        
        let current = 0;
        const chunkSize = 2; // balanced chunk size to keep things extremely responsive and fast
        
        for (let i = 0; i < total; i += chunkSize) {
          if (!isUpdatingRef.current) {
            break;
          }
          
          const chunk = originalItems.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (channel) => {
            if (!isUpdatingRef.current) return;
            
            try {
              setUpdateStatusText(`"${channel.name}" analiz ediliyor & güncelleniyor...`);
              const response = await fetch('/api/update-single-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: channel.name,
                  currentUrl: channel.url,
                  type: channel.type || 'tv',
                  currentLogo: channel.logo
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.active) {
                  finalUpdatedList.push({
                    ...channel,
                    url: data.url,
                    logo: data.logo || channel.logo,
                  });
                } else {
                  console.log(`Channel ${channel.name} is inactive and no working update found. Removing.`);
                }
              } else {
                // Server failed, keep channel to prevent accidental loss
                finalUpdatedList.push(channel);
              }
            } catch (err) {
              console.error(err);
              finalUpdatedList.push(channel);
            } finally {
              current++;
              setUpdateProgress({ current, total });
            }
          }));
        }

        if (isUpdatingRef.current) {
          // Re-index remaining channels
          const indexedList = finalUpdatedList.map((item, idx) => ({
            ...item,
            id: idx + 1
          }));
          onUpdateItems(indexedList);
          alert(`Güncelleme Tamamlandı!\n\nToplam ${originalItems.length} kanaldan ${indexedList.length} adet aktif kanal güncellenerek korundu. Çalışmayan ve güncel yayını bulunamayan ${originalItems.length - indexedList.length} kanal listeden kaldırıldı.`);
        }
        
        setIsUpdatingChannels(false);
        isUpdatingRef.current = false;
      }
    });
  };

  const handleStopUpdate = () => {
    isUpdatingRef.current = false;
    setIsUpdatingChannels(false);
    setUpdateStatusText("Güncelleme işlemi durduruldu.");
  };

  const handleClearAll = () => {
    setConfirmDialog({
      title: "Tüm Listeyi Temizle",
      message: "Tüm listeyi temizlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
      onConfirm: () => {
        onUpdateItems([]);
      }
    });
  };

  // Same-device IPTV loading functions
  const playlistUrl = playlistId 
    ? `${window.location.origin}/api/playlist/${playlistId}.${m3uType}` 
    : '';

  const handleSaveToServer = async () => {
    if (items.length === 0) {
      setSyncError('Bağlantı oluşturmak için listeniz boş olmamalıdır.');
      return;
    }
    
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch('/api/save-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ m3uContent: m3uContent }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Playlist sunucuya kaydedilemedi.');
      }
      setPlaylistId(data.id);
      sendToBackup(m3uContent);
    } catch (err: any) {
      setSyncError(`Bağlantı oluşturulurken hata oluştu: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyUrl = () => {
    if (!playlistUrl) return;
    navigator.clipboard.writeText(playlistUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    sendToBackup(m3uContent);
  };

  return (
    <div id="m3u-list-preview-panel" className="space-y-6">
      {/* ÇOKLU ÇALMA LİSTESİ YÖNETİM MERKEZİ */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div className="space-y-1">
            <h2 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500 animate-pulse" />
              <span>Çoklu Çalma Listesi Yönetim Merkezi</span>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">ÇOKLU LİSTE AKTİF</span>
            </h2>
            <p className="text-xs text-slate-500">Aynı anda birden fazla çalma listesi yönetin. <span className="text-amber-400 font-semibold">İpucu:</span> Herhangi bir listeyi <span className="text-rose-400 font-bold underline underline-offset-2">sağa veya sola kaydırarak</span> hızlıca silebilirsiniz!</p>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Add New Playlist Button */}
            <button
              onClick={() => handleCreatePlaylist()}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer border-b-2 border-blue-800 active:border-b-0 active:translate-y-0.5 shadow-lg shadow-blue-500/10"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Yeni Boş Liste Ekle</span>
            </button>
            
            {/* Create Playlist from Preset channels */}
            <button
              onClick={() => {
                if (!onUpdatePlaylists || !playlists) return;
                const newId = `playlist_${Date.now()}`;
                const newPlaylist: Playlist = {
                  id: newId,
                  name: `Hazır Ulusal Kanallar`,
                  items: [
                    {
                      id: 1,
                      name: "TRT 1 HD",
                      url: "https://tv-trt1.medya.trt.com.tr/trt/trt1/index.m3u8",
                      type: "tv",
                      logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/TRT_1_logo.svg",
                      group: "TR: Ulusal"
                    },
                    {
                      id: 2,
                      name: "TRT Spor",
                      url: "https://tv-trtspor.medya.trt.com.tr/trt/trtspor/index.m3u8",
                      type: "tv",
                      logo: "https://upload.wikimedia.org/wikipedia/commons/2/29/TRT_Spor_logo.svg",
                      group: "TR: Spor"
                    },
                    {
                      id: 3,
                      name: "Kral FM",
                      url: "https://dogus-live.daioncdn.net/kralfm/kralfm.m3u8",
                      type: "radyo",
                      logo: "https://upload.wikimedia.org/wikipedia/tr/4/4c/Kral_Fm_Logo.png",
                      group: "TR: Radyo"
                    }
                  ]
                };
                onUpdatePlaylists([...playlists, newPlaylist]);
                onSelectPlaylist?.(newId);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-850 text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400 fill-current" />
              <span>Hazır Kanal Listesi Ekle</span>
            </button>
 
            {/* Merge Playlists Button */}
            <button
              onClick={() => {
                if (playlists.length < 2) {
                  alert('Listeleri birleştirebilmek için en az 2 adet çalma listeniz olmalıdır.');
                  return;
                }
                // Pre-select active playlist and first other playlist
                const other = playlists.find(p => p.id !== activePlaylistId);
                setMergeSelectedIds(other ? [activePlaylistId, other.id] : [activePlaylistId]);
                setIsMergeModalOpen(true);
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer border-b-2 border-indigo-800 active:border-b-0 active:translate-y-0.5 shadow-lg shadow-indigo-500/10"
              title="Birden fazla çalma listesini tek bir çalma listesinde birleştirir"
            >
              <GitMerge className="w-4 h-4 text-white" />
              <span>Listeleri Birleştir</span>
            </button>
          </div>
        </div>
 
        {/* Playlists Tabs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {playlists.map((playlist) => {
            const isActive = playlist.id === activePlaylistId;
            const isEditing = playlist.id === editingPlaylistId;
            
            return (
              <div key={playlist.id} className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20 select-none">
                {/* Background Swipe Delete Action Layer */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-650 via-red-600 to-red-650 flex items-center justify-between px-4 text-white pointer-events-none rounded-xl">
                  <div className="flex items-center space-x-1 opacity-90">
                    <Trash2 className="w-4 h-4 text-white animate-bounce" />
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/90 font-sans">SİL</span>
                  </div>
                  <div className="flex items-center space-x-1 opacity-90">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/90 font-sans">SİL</span>
                    <Trash2 className="w-4 h-4 text-white animate-bounce" />
                  </div>
                </div>

                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
                  onDragEnd={(event, info) => {
                    // Trigger delete if swiped sufficiently left or right
                    if (info.offset.x < -120 || info.offset.x > 120) {
                      handleDeletePlaylist(playlist.id);
                    }
                  }}
                  onClick={() => !isEditing && onSelectPlaylist?.(playlist.id)}
                  className={`group p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-colors relative cursor-grab active:cursor-grabbing ${
                    isActive
                      ? 'bg-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/5 text-white'
                      : 'bg-slate-900/45 border-slate-850 hover:border-slate-800 hover:bg-slate-900/70 text-slate-300'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  {/* Active Indicator Pin */}
                  {isActive && (
                    <div className="absolute top-3 right-3 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </div>
                  )}
  
                  {/* Playlist Info */}
                  <div className="space-y-1.5 pr-4">
                    {isEditing ? (
                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingPlaylistName}
                          onChange={(e) => setEditingPlaylistName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenamePlaylist(playlist.id, editingPlaylistName);
                            if (e.key === 'Escape') setEditingPlaylistId(null);
                          }}
                          className="bg-slate-950 text-xs px-2 py-1 rounded border border-blue-500 focus:outline-none w-full font-semibold text-slate-200"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenamePlaylist(playlist.id, editingPlaylistName)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingPlaylistId(null)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <ListMusic className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className={`text-xs font-bold truncate max-w-[140px] ${isActive ? 'text-white' : 'text-slate-350'}`}>
                          {playlist.name}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-semibold font-mono">
                      <span>{playlist.items.length} Yayın</span>
                      <span>•</span>
                      <span>{playlist.items.filter(i => i.type === 'tv').length} TV</span>
                      <span>•</span>
                      <span>{playlist.items.filter(i => i.type === 'radyo').length} Radyo</span>
                    </div>
                  </div>
  
                  {/* Action Row */}
                  {!isEditing && (
                    <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5 mt-1 pointer-events-auto">
                      <span className="text-[9px] text-slate-600 font-bold uppercase font-mono">
                        ID: {playlist.id.substring(0, 8)}
                      </span>
                      
                      <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Rename */}
                        <button
                          onClick={() => {
                            setEditingPlaylistId(playlist.id);
                            setEditingPlaylistName(playlist.name);
                          }}
                          title="Yeniden Adlandır"
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
  
                        {/* Clone */}
                        <button
                          onClick={() => handleDuplicatePlaylist(playlist)}
                          title="Listeyi Çoğalt / Kopyala"
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                        >
                          <CopyIcon className="w-3.5 h-3.5" />
                        </button>
  
                        {/* Delete */}
                        <button
                          onClick={() => handleDeletePlaylist(playlist.id)}
                          title="Listeyi Sil"
                          className="p-1.5 hover:bg-rose-500/10 rounded text-rose-400/90 hover:text-rose-400 transition cursor-pointer border border-transparent hover:border-rose-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Columns: Interactive Playlist Editor */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Aktif M3U8 Kanal Listesi ({items.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Yayınların sırasını ayarlayın, isimleri düzenleyin ve Android TV için optimize edin</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import Button */}
            <input
              type="file"
              accept=".m3u,.m3u8,.txt"
              ref={fileInputRef}
              onChange={handleImportM3u}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded border border-slate-800 flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>M3U Yükle</span>
            </button>

            {/* Manual Group & Sort Button */}
            <button
              onClick={handleGroupAndSort}
              disabled={items.length === 0}
              className="px-3.5 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 disabled:opacity-40 text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer"
              title="Kanalları gruplandır ve alfabetik sırala"
            >
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Grupla ve Sırala</span>
            </button>

            {/* AI Optimize Button */}
            <button
              onClick={handleAiOptimize}
              disabled={isAiLoading || items.length === 0}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer shadow-lg"
            >
              {isAiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-current" />}
              <span>AI Optimize Et</span>
            </button>

            {/* Otomatik Logo Bulucu Button */}
            <button
              onClick={handleAutoSearchLogos}
              disabled={isLogoSearching || items.length === 0}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer shadow-lg"
              title="Kanal listesindeki eksik logoları otomatik veritabanından ve yapay zekadan bularak ekler"
            >
              {isLogoSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
              <span>Logo Bul & Eşle</span>
            </button>

            {/* Kanalları Güncelle Button */}
            <button
              onClick={handleUpdateChannels}
              disabled={isUpdatingChannels || items.length === 0}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer shadow-lg"
              title="Kanal listesini analiz eder, yayın linklerinin aktifliğini test eder, internetten güncel .m3u8/.m3u linklerini ve logoları bulur. Aktif olmayan kanalları siler."
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingChannels ? 'animate-spin' : ''}`} />
              <span>Kanalları Güncelle</span>
            </button>

            {/* Clear All Channels Button */}
            <button
              onClick={handleClearAll}
              disabled={items.length === 0}
              className="px-3.5 py-1.5 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-900/30 hover:border-rose-800/50 text-rose-400 disabled:opacity-30 disabled:hover:bg-rose-950/10 text-xs font-bold rounded flex items-center space-x-1.5 transition cursor-pointer"
              title="Aktif çalma listesindeki tüm kanalları temizler"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kanalları Temizle</span>
            </button>
          </div>
        </div>

        {/* Channel Table / List */}
        <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/20">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <FileText className="w-6 h-6" />
              </div>
              <div className="max-w-xs">
                <p className="text-sm font-semibold text-slate-300">Listeniz Boş</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Yukarıdaki popüler hazır kanallardan ekleyebilir, AI Sniffer ile web sitelerinden yayın linkleri çekebilir veya manuel ekleme yapabilirsiniz.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Logo warning banner */}
              {items.filter(item => !item.logo || item.logo.trim() === "").length > 0 && (
                <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-300 shadow-lg mb-3">
                  <div className="flex items-center space-x-2">
                    <Image className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>
                      💡 Listenizdeki <b>{items.filter(item => !item.logo || item.logo.trim() === "").length} adet kanalın</b> logosu eksik. Popüler logo veritabanından ve Yapay Zeka ile otomatik logoları bulmak ister misiniz?
                    </span>
                  </div>
                  <button
                    onClick={handleAutoSearchLogos}
                    disabled={isLogoSearching}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded text-[11px] transition cursor-pointer self-end sm:self-auto shrink-0 flex items-center space-x-1.5 shadow"
                  >
                    {isLogoSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-current" />}
                    <span>Logoları Otomatik Bul</span>
                  </button>
                </div>
              )}

              {items.map((item, index) => (
              <div 
                key={item.id} 
                className="group bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 p-3.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
              >
                {/* Left Side: Index & Details */}
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-6 h-6 shrink-0 bg-blue-500/10 text-blue-400 font-mono text-xs font-bold rounded-full flex items-center justify-center border border-blue-500/20">
                    {index + 1}
                  </span>

                  {item.logo ? (
                    <img 
                      src={item.logo} 
                      alt="" 
                      className="w-9 h-9 rounded bg-white object-contain p-0.5 border border-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-slate-600" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-100 truncate">{item.name}</h4>
                      <span className={`text-[8px] font-mono font-medium px-1.5 py-0.5 rounded tracking-wider ${item.type === 'tv' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {item.type === 'tv' ? 'TV' : 'RADYO'}
                      </span>
                      {item.group && (
                        <span className="text-[8px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                          {item.group}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate mt-1 max-w-[280px] select-all">{item.url}</p>
                  </div>
                </div>

                {/* Right Side: Reorder & Action Buttons */}
                <div className="flex items-center justify-end space-x-1.5 shrink-0 self-end sm:self-auto pt-2 sm:pt-0 border-t border-slate-950 sm:border-0">
                  {/* Play preview */}
                  <button
                    onClick={() => onSelectStream(item)}
                    title="Önizleme Oynat"
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-blue-400 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>

                  {/* Reorder Up */}
                  <button
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title="Yukarı Taşı"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Reorder Down */}
                  <button
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === items.length - 1}
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title="Aşağı Taşı"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleStartEdit(item)}
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-blue-400 hover:text-blue-300 transition cursor-pointer"
                    title="Düzenle"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-1.5 bg-slate-950 hover:bg-red-950/50 border border-slate-800 hover:border-red-900/40 rounded text-red-400 hover:text-red-300 transition cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/25 border border-red-950 rounded transition cursor-pointer"
            >
              Tüm Listeyi Sıfırla
            </button>
          </div>
        )}
      </div>

      {/* Right 5 Columns: Output & Android Settings */}
      <div className="lg:col-span-5 flex flex-col space-y-6">
        
        {/* Android Optimization Settings */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest text-blue-400">Android TV Optimizasyon Ayarları</h3>
          
          <div className="space-y-3.5">
            {/* Header Naming Prepends */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-200">Kanal İsimlerine Sıra Nolu Yazım</p>
                <p className="text-[10px] text-slate-500">Kanal adlarının başına otomatik '1. TRT' yazısı ekler</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={prependNumbers} 
                  onChange={() => setPrependNumbers(!prependNumbers)} 
                  className="sr-only peer" 
                />
                <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-black peer-checked:after:border-blue-500"></div>
              </label>
            </div>

            {/* Auto Group & Sort Toggle */}
            <div className="flex items-center justify-between border-t border-slate-900 pt-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-200">Otomatik Grupla ve Sırala</p>
                <p className="text-[10px] text-slate-500">Eklenen her yeni kanalı grubuna yerleştirip A'dan Z'ye sıralar</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoGroupAndSort} 
                  onChange={() => setAutoGroupAndSort(!autoGroupAndSort)} 
                  className="sr-only peer" 
                />
                <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-black peer-checked:after:border-blue-500"></div>
              </label>
            </div>

            {/* General User Agent Setting */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">M3U List Dosya Biçimi</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setM3uType('m3u8')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold border transition cursor-pointer ${m3uType === 'm3u8' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  .m3u8 (Önerilen)
                </button>
                <button
                  type="button"
                  onClick={() => setM3uType('m3u')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold border transition cursor-pointer ${m3uType === 'm3u' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  .m3u (Standart)
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Genel User-Agent (Oynatıcı İçin)</label>
              <input
                type="text"
                placeholder="Örn: VLC/3.0.18, TiviMate"
                value={customUserAgent}
                onChange={(e) => setCustomUserAgent(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[9px] text-slate-500">Engelli yayın sunucularını aşmak için oynatıcıyı (TiviMate/VLC/AndroidTV) simüle eder.</p>
            </div>
          </div>
        </div>

        {/* Live M3U File Code Output */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Hazır Çıktı Kod Yapısı
            </h3>
            
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleCopy}
                disabled={items.length === 0}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-40 text-blue-400 rounded transition cursor-pointer flex items-center space-x-1 text-[11px]"
                title="Kopyala"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={items.length === 0}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded transition cursor-pointer flex items-center space-x-1 text-[11px] font-bold shadow border-b-2 border-blue-800 active:border-b-0 active:translate-y-0.5"
                title="Dosya İndir"
              >
                <Download className="w-3.5 h-3.5" />
                <span>İndir</span>
              </button>
            </div>
          </div>

          <div className="relative bg-slate-950 border border-slate-850 p-4 rounded max-h-[220px] overflow-y-auto">
            <pre className="text-[10px] text-blue-400 font-mono leading-relaxed whitespace-pre select-all">
              {items.length === 0 ? '#EXTM3U\n# Listenize kanal ekledikçe\n# M3U formatındaki kodlar buraya otomatik sıralanacaktır...' : m3uContent}
            </pre>
          </div>
        </div>

        {/* Same Device IPTV Sync & Deep Links */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-4">
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <Plus className="w-4 h-4 rotate-45 text-emerald-400" />
              Aynı Cihazdaki IPTV Oynatıcıya Yükle
            </h3>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Bu cihazda yüklü olan IPTV oynatıcınıza (TiviMate, IPTV Smarters, VLC vb.) listeyi doğrudan yüklemek için tek tıkla canlı bağlantı adresi oluşturun veya deep-link ile açın.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-4 bg-slate-900/50 border border-slate-850 rounded text-xs text-slate-500">
              Uygulamayı oynatıcıya yüklemek için önce listenize kanal ekleyin.
            </div>
          ) : (
            <div className="space-y-4">
              {!playlistId ? (
                <button
                  onClick={handleSaveToServer}
                  disabled={isSyncing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center space-x-2 border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5 shadow-lg"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Canlı Bağlantı Oluşturuluyor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current text-white animate-pulse" />
                      <span>CANLI IPTV BAĞLANTI LİNKİ OLUŞTUR</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Direct URL output box */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      <span>IPTV Oynatıcı İçin M3U Linki:</span>
                      <span className="text-emerald-400 font-mono text-[9px] bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded">LİNK AKTİF</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={playlistUrl}
                        className="flex-1 bg-slate-900 text-slate-200 text-xs px-3 py-2.5 rounded border border-slate-800 font-mono truncate select-all focus:outline-none"
                      />
                      <button
                        onClick={handleCopyUrl}
                        className="px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-emerald-400 font-semibold transition cursor-pointer flex items-center space-x-1"
                        title="Bağlantıyı Kopyala"
                      >
                        {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedUrl ? 'Kopyalandı' : 'Kopyala'}</span>
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                      💡 Bu linki telefonunuzdaki veya TV'nizdeki herhangi bir IPTV oynatıcının (TiviMate, IPTV Smarters, VLC) çalma listesi ekleme kısmına yapıştırmanız yeterlidir.
                    </p>
                  </div>

                  {/* Deep link direct launch buttons */}
                  <div className="border-t border-slate-900 pt-3.5 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Tek Tıkla Bu Cihazdaki Oynatıcıda Aç:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`vlc://${playlistUrl}`}
                        className="py-2.5 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer text-center font-sans"
                        title="Cihazda yüklü VLC player ile oynat"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-orange-400" />
                        <span>VLC ile Oynat</span>
                      </a>
                      <a
                        href={`nplayer-${playlistUrl}`}
                        className="py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer text-center font-sans"
                        title="nPlayer ile oynat"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-blue-400" />
                        <span>nPlayer ile Aç</span>
                      </a>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <a
                        href={playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer text-center"
                      >
                        <span>Yeni Sekmede Listeyi Gör (.m3u)</span>
                      </a>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded border border-slate-850 text-[10px] text-slate-400 leading-relaxed space-y-1">
                    <p className="font-bold text-slate-300 flex items-center gap-1">
                      <span>📌 IPTV Player Kurulum Kılavuzu (Aynı Cihaz)</span>
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                      <li>Yukarıdaki <b>Kopyala</b> butonuyla çalma listesi bağlantısını kopyalayın.</li>
                      <li>Cihazınızda yüklü olan IPTV uygulamasını açın.</li>
                      <li>Kategori listesinde <b>"Çalma Listesi Ekle" (Add M3U Playlist URL)</b> seçeneğine gidin.</li>
                      <li>Kopyaladığınız adresi yapıştırıp kaydedin. Kanallarınız saniyeler içinde yüklenecektir!</li>
                    </ol>
                  </div>
                </div>
              )}

              {syncError && (
                <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded text-center">
                  {syncError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Modal Backdrop overlay */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-white font-bold text-base">Yayın Bilgilerini Düzenle</h3>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Yayın İsmi</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Yayın Linki (Akış URL'si)</label>
                <input
                  type="text"
                  value={editingItem.url}
                  onChange={(e) => setEditingItem({ ...editingItem, url: e.target.value })}
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grup Başlığı</label>
                  <input
                    type="text"
                    value={editingItem.group || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, group: e.target.value })}
                    placeholder="Örn: Ulusal"
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kanal Türü</label>
                  <select
                    value={editingItem.type}
                    onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value as 'tv' | 'radyo' })}
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none"
                  >
                    <option value="tv">Televizyon</option>
                    <option value="radyo">Radyo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logo URL'si</label>
                <input
                  type="text"
                  value={editingItem.logo || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, logo: e.target.value })}
                  placeholder="https://gorsel.com/logo.png"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Özel User-Agent (Yalnızca Bu Kanal İçin)</label>
                <input
                  type="text"
                  value={editingItem.userAgent || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, userAgent: e.target.value })}
                  placeholder="Sıfırlamak için boş bırakın"
                  className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded border border-slate-800 transition cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition cursor-pointer border-b-2 border-emerald-800 active:border-b-0 active:translate-y-0.5"
              >
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Choice Modal Backdrop overlay */}
      {isImportModalOpen && importItems && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-450" />
                <h3 className="text-white font-bold text-base">Dosyayı İçe Aktar</h3>
              </div>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportItems(null);
                }} 
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Seçtiğiniz <span className="text-blue-400 font-semibold font-mono">"{importName}.m3u"</span> dosyasında <span className="text-emerald-400 font-bold">{importItems.length} yayın kanalı</span> tespit edildi. 
                Bu listeyi uygulamanıza nasıl aktarmak istersiniz?
              </p>
              
              <div className="bg-slate-900/45 p-3 rounded border border-slate-850 text-[11px] text-slate-400 leading-relaxed">
                Tüm aktarım yöntemleri kanalları otomatik olarak analiz eder ve sıralı numaralandırma düzenine hazırlar.
              </div>
            </div>

            <div className="flex flex-col space-y-2.5 pt-2">
              <button
                onClick={handleImportAsNewPlaylist}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition cursor-pointer flex items-center justify-center space-x-2 border-b-2 border-blue-800 active:border-b-0 active:translate-y-0.5"
              >
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Yeni Çalma Listesi Olarak Ekle</span>
              </button>

              <button
                onClick={handleImportMergeActive}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-250 border border-slate-800 text-xs font-semibold rounded transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Mevcut Çalma Listesinin Sonuna Ekle</span>
              </button>

              <button
                onClick={handleImportReplaceActive}
                className="w-full py-3 bg-slate-900/40 hover:bg-rose-950/20 text-rose-300 border border-rose-950/20 hover:border-rose-900/40 text-xs font-semibold rounded transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Mevcut Listeyi Sil ve Üzerine Yaz</span>
              </button>
            </div>

            <div className="flex items-center justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportItems(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-300 text-xs font-semibold rounded transition cursor-pointer"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listeleri Birleştir Modal Backdrop overlay */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitMerge className="w-5 h-5 text-indigo-400" />
                <h3 className="text-white font-bold text-base">Çalma Listelerini Birleştir</h3>
              </div>
              <button 
                onClick={() => setIsMergeModalOpen(false)} 
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Birleştirmek istediğiniz çalma listelerini seçin. Seçilen listelerin içindeki tüm yayın kanalları yeni bir listede bir araya getirilecektir.
              </p>

              {/* List of playlists with checkboxes */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {playlists.map((playlist) => {
                  const isChecked = mergeSelectedIds.includes(playlist.id);
                  return (
                    <label
                      key={playlist.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-950/20 border-indigo-500/45 text-white'
                          : 'bg-slate-900/40 border-slate-850 hover:bg-slate-900/65 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setMergeSelectedIds(prev => prev.filter(id => id !== playlist.id));
                            } else {
                              setMergeSelectedIds(prev => [...prev, playlist.id]);
                            }
                          }}
                          className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500/50 bg-slate-950 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold block">{playlist.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono font-semibold">
                            {playlist.items.length} Yayın ({playlist.items.filter(i => i.type === 'tv').length} TV, {playlist.items.filter(i => i.type === 'radyo').length} Radyo)
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono font-bold">
                        ID: {playlist.id.substring(0, 8)}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Merge Options */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Yeni Çalma Listesi Adı</label>
                  <input
                    type="text"
                    value={mergeNewName}
                    onChange={(e) => setMergeNewName(e.target.value)}
                    placeholder="Birleştirilmiş Çalma Listesi"
                    className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <label className="flex items-center space-x-2.5 p-2 rounded bg-slate-900/35 border border-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeRemoveDuplicates}
                    onChange={(e) => setMergeRemoveDuplicates(e.target.checked)}
                    className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="text-slate-200 font-semibold block">Aynı Linke Sahip Çift Kanalları Temizle</span>
                    <span className="text-[10px] text-slate-500 block leading-tight">Aynı akış adresine (URL) sahip mükerrer yayınların yalnızca ilkini korur.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-300 text-xs font-semibold rounded transition cursor-pointer"
              >
                İptal Et
              </button>
              <button
                onClick={handleMergePlaylists}
                disabled={mergeSelectedIds.length < 2}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded transition cursor-pointer flex items-center space-x-1.5 border-b-2 border-indigo-800 active:border-b-0 active:translate-y-0.5"
              >
                <GitMerge className="w-4 h-4" />
                <span>Birleştirmeyi Başlat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Update Progress Modal */}
      {isUpdatingChannels && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Pulsing Sync Icon / 0/100 Indicator Circle */}
            <div className="relative flex items-center justify-center mx-auto h-24 w-24">
              <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-cyan-500 animate-spin absolute"></div>
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-850 flex flex-col items-center justify-center z-10 shadow-inner">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Kanal</span>
                <span className="text-sm font-black text-slate-100 font-mono">
                  {updateProgress.current}/{updateProgress.total}
                </span>
                <span className="text-[9px] font-bold text-cyan-400 font-mono mt-0.5">
                  %{Math.round((updateProgress.current / (updateProgress.total || 1)) * 100)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 z-10 relative">
              <h3 className="text-sm font-bold text-slate-200 tracking-tight">Kanalları Akıllı Güncelle</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Yayın akışları test ediliyor, çalışmayanlar internette aranıp yenileri ile güncelleniyor ve eksik logolar bulunuyor.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 z-10 relative">
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/60">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(updateProgress.current / (updateProgress.total || 1)) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-semibold font-mono text-slate-500 px-0.5">
                <span className="truncate max-w-[280px] text-left text-cyan-400">{updateStatusText}</span>
                <span className="shrink-0 font-bold text-slate-400">{updateProgress.current} / {updateProgress.total}</span>
              </div>
            </div>

            {/* Stop / Cancel Button */}
            <button
              onClick={handleStopUpdate}
              className="w-full py-2 bg-rose-950/20 hover:bg-rose-900/45 border border-rose-900/30 text-rose-400 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 border-b-2 border-rose-950 active:border-b-0 active:translate-y-0.5"
            >
              <X className="w-4 h-4" />
              <span>Güncellemeyi Durdur</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-500">
              <HelpCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-100">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-350 text-[11px] font-bold rounded transition cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded transition cursor-pointer"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
