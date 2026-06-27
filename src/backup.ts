import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { scrubApiKeys } from './storage';
import type { AppSettings, BackupManifest, BoneNote } from './types';

type FavoritesBackup = {
  albums: unknown[];
  podcasts: unknown[];
};

type FavoriteRecord = Record<string, unknown>;

const APPLE_POOL_COVER_BACKUP_DIR = 'files/apple-album-covers';
const APPLE_POOL_COVER_DIR = 'apple-album-pool';
const BACKUP_COVER_FILE_KEY = '__boneBackupApplePoolCoverFile';
const BACKUP_COVER_DATA_KEY = '__boneBackupApplePoolCoverData';

function readFavoritesForBackup(): FavoritesBackup {
  const read = (key: string) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    albums: read('bone.album-favorites'),
    podcasts: read('bone.podcast-favorites'),
  };
}

function cloneFavorites(favorites: FavoritesBackup): FavoritesBackup {
  return {
    albums: favorites.albums.map((item) => (
      item && typeof item === 'object' ? { ...(item as FavoriteRecord) } : item
    )),
    podcasts: favorites.podcasts.map((item) => (
      item && typeof item === 'object' ? { ...(item as FavoriteRecord) } : item
    )),
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] || '' : value);
    };
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(blob);
  });
}

async function filesystemDataToBase64(data: string | Blob): Promise<string> {
  if (typeof data === 'string') return data.includes(',') ? data.split(',')[1] || '' : data;
  return blobToBase64(data);
}

function extensionFromPath(path: string) {
  const match = path.match(/\.([a-z0-9]+)$/i);
  const ext = match?.[1]?.toLowerCase();
  return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
}

async function addAppleFavoriteCoverFiles(zip: JSZip, favorites: FavoritesBackup): Promise<number> {
  let count = 0;
  for (const [index, item] of favorites.albums.entries()) {
    if (!item || typeof item !== 'object') continue;
    const album = item as FavoriteRecord;
    const coverPath = typeof album.applePoolCoverPath === 'string' ? album.applePoolCoverPath : '';
    if (!coverPath) continue;

    try {
      const file = await Filesystem.readFile({ path: coverPath, directory: Directory.Data });
      const data = await filesystemDataToBase64(file.data);
      if (!data) continue;

      const ext = extensionFromPath(coverPath);
      const backupPath = `${APPLE_POOL_COVER_BACKUP_DIR}/album-${index + 1}.${ext}`;
      zip.file(backupPath, data, { base64: true });
      album[BACKUP_COVER_FILE_KEY] = backupPath;
      count += 1;
    } catch {
      // If a cached cover was already cleaned by the OS, keep the JSON backup usable.
    }
  }
  return count;
}

function mergeByName(left: unknown[], right: unknown[], nameKeys: string[]) {
  const map = new Map<string, unknown>();
  for (const item of [...right, ...left]) {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : null;
    const name = record ? nameKeys.map((key) => record[key]).find((value) => typeof value === 'string') : null;
    const key = typeof name === 'string' && name.trim() ? name.trim() : JSON.stringify(item);
    map.set(key, item);
  }
  return Array.from(map.values());
}

export async function buildSettingsBackup(
  settings: AppSettings,
  includeApiKeys: boolean,
  notes: BoneNote[] = [],
): Promise<Blob> {
  const zip = new JSZip();
  const favorites = cloneFavorites(readFavoritesForBackup());
  const manifest: BackupManifest = {
    app: 'bone-android',
    version: 1,
    exportedAt: new Date().toISOString(),
    includesApiKeys: includeApiKeys,
    counts: {
      notes: notes.length,
      favorites: favorites.albums.length + favorites.podcasts.length,
      files: 0,
    },
  };
  manifest.counts.files = await addAppleFavoriteCoverFiles(zip, favorites);

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file(
    'settings.json',
    JSON.stringify(includeApiKeys ? settings : scrubApiKeys(settings), null, 2),
  );
  zip.file('notes.json', JSON.stringify(notes, null, 2));
  zip.file('favorites.json', JSON.stringify(favorites, null, 2));
  zip.folder('files');

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readSettingsFromBackup(
  file: File,
): Promise<{ settings: AppSettings; notes: BoneNote[]; favorites?: FavoritesBackup }> {
  const zip = await JSZip.loadAsync(file);
  const settingsEntry = zip.file('settings.json');

  if (!settingsEntry) {
    throw new Error('备份包缺少 settings.json');
  }

  const notesEntry = zip.file('notes.json');
  const favoritesEntry = zip.file('favorites.json');
  const favorites = favoritesEntry
    ? JSON.parse(await favoritesEntry.async('string')) as Partial<FavoritesBackup>
    : undefined;
  const restoredFavorites = favorites
    ? {
      albums: Array.isArray(favorites.albums) ? favorites.albums : [],
      podcasts: Array.isArray(favorites.podcasts) ? favorites.podcasts : [],
    }
    : undefined;

  if (restoredFavorites) {
    for (const item of restoredFavorites.albums) {
      if (!item || typeof item !== 'object') continue;
      const album = item as FavoriteRecord;
      const backupPath = typeof album[BACKUP_COVER_FILE_KEY] === 'string' ? album[BACKUP_COVER_FILE_KEY] : '';
      const entry = backupPath ? zip.file(backupPath) : null;
      if (!entry) continue;
      album[BACKUP_COVER_DATA_KEY] = await entry.async('base64');
    }
  }

  return {
    settings: JSON.parse(await settingsEntry.async('string')) as AppSettings,
    notes: notesEntry ? (JSON.parse(await notesEntry.async('string')) as BoneNote[]) : [],
    favorites: restoredFavorites,
  };
}

async function restoreAppleFavoriteCoverFiles(albums: unknown[]): Promise<unknown[]> {
  const restored: unknown[] = [];
  for (const [index, item] of albums.entries()) {
    if (!item || typeof item !== 'object') {
      restored.push(item);
      continue;
    }

    const album = { ...(item as FavoriteRecord) };
    const data = typeof album[BACKUP_COVER_DATA_KEY] === 'string' ? album[BACKUP_COVER_DATA_KEY] : '';
    const backupPath = typeof album[BACKUP_COVER_FILE_KEY] === 'string' ? album[BACKUP_COVER_FILE_KEY] : '';
    delete album[BACKUP_COVER_DATA_KEY];
    delete album[BACKUP_COVER_FILE_KEY];

    if (data) {
      try {
        const ext = extensionFromPath(backupPath);
        const coverPath = `${APPLE_POOL_COVER_DIR}/restored-${Date.now()}-${index + 1}.${ext}`;
        await Filesystem.writeFile({
          path: coverPath,
          data,
          directory: Directory.Data,
          recursive: true,
        });
        const { uri } = await Filesystem.getUri({ path: coverPath, directory: Directory.Data });
        album.applePoolCoverPath = coverPath;
        album.artworkUrl = Capacitor.convertFileSrc(uri);
      } catch {
        // Keep the original cover URL if the filesystem is unavailable.
      }
    }
    restored.push(album);
  }
  return restored;
}

export async function restoreFavoritesFromBackup(favorites: FavoritesBackup, mode: AppSettings['backupMode']) {
  const readCurrent = (key: string) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const restoredAlbums = await restoreAppleFavoriteCoverFiles(favorites.albums);
  const albums = mode === 'replace'
    ? restoredAlbums
    : mergeByName(restoredAlbums, readCurrent('bone.album-favorites'), ['albumTitle', 'title']);
  const podcasts = mode === 'replace'
    ? favorites.podcasts
    : mergeByName(favorites.podcasts, readCurrent('bone.podcast-favorites'), ['title', 'name']);
  window.localStorage.setItem('bone.album-favorites', JSON.stringify(albums));
  window.localStorage.setItem('bone.podcast-favorites', JSON.stringify(podcasts));
}
