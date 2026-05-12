import { storage } from './firebase';
import { listAll, deleteObject, ref } from 'firebase/storage';

export const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // falha segura
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => resolve(file); // falha segura
    };
    reader.onerror = (err) => resolve(file); // falha segura
  });
};

export const cleanupStorage = async (path: string, maxFiles: number = 100) => {
  try {
    const listRef = ref(storage, path);
    const res = await listAll(listRef);
    if (res.items.length > maxFiles) {
      // Sort by name (which starts with Date.now()_filename, so alphabetical sort works as chronological sort)
      const items = res.items.sort((a, b) => a.name.localeCompare(b.name));
      // Delete older items (from beginning of sorted array)
      const itemsToDelete = items.slice(0, items.length - maxFiles);
      
      const deletePromises = itemsToDelete.map((itemRef) => deleteObject(itemRef));
      await Promise.all(deletePromises);
      console.log(`Cleaned up ${itemsToDelete.length} files from ${path}`);
    }
  } catch (error) {
    console.warn("Cleanup storage error:", error);
  }
};
