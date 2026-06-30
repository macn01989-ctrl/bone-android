import type { NoteImage } from '../types';

export function readImageFile(file: File): Promise<NoteImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      compressImage(raw)
        .then((dataUrl) => {
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type || 'image/jpeg',
            dataUrl,
            createdAt: Date.now(),
          });
        })
        .catch(() => {
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type || 'image/jpeg',
            dataUrl: raw,
            createdAt: Date.now(),
          });
        });
    };
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 1280;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas failed'));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    image.onerror = () => reject(new Error('image failed'));
    image.src = dataUrl;
  });
}
