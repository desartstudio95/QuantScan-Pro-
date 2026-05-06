import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../lib/firebase';

interface ImageUploaderProps {
  onUpload: (urls: string[]) => void;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onUpload, className }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !auth.currentUser) return;

    const files = Array.from(e.target.files) as File[];
    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `testimonials/${auth.currentUser!.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      });
      const urls = await Promise.all(uploadPromises);
      onUpload(urls);
    } catch (error) {
      console.error(error);
      alert('Erro ao fazer upload das imagens.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        disabled={uploading}
        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-red text-sm"
      />
      {uploading && <p className="text-xs text-brand-red mt-1">Enviando imagens...</p>}
    </div>
  );
};
