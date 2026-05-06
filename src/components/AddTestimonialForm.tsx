import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ImageUploader } from './ImageUploader';

export const AddTestimonialForm: React.FC = () => {
  const [text, setText] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !text.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'testimonials'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.email || 'Usuário',
        text: text,
        timestamp: Date.now(),
        imageUrls: imageUrls
      });
      setText('');
      setImageUrls([]);
      alert('Resultado enviado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar resultado.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.currentUser) return null;

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4 mt-8 max-w-2xl mx-auto">
      <h3 className="font-black uppercase tracking-widest text-brand-red">Deixe o seu resultado</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-red"
        placeholder="O que achou do QuantScanner?"
        maxLength={500}
      />
      <ImageUploader onUpload={setImageUrls} />
      {imageUrls.length > 0 && <p className="text-xs text-green-500">{imageUrls.length} imagem(ns) carregada(s) com sucesso!</p>}
      <button 
        disabled={submitting}
        type="submit" 
        className="bg-brand-red text-white py-2 px-4 rounded-lg font-bold hover:bg-opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Enviando...' : 'Enviar Resultado'}
      </button>
    </form>
  )
}
