import React, { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { updatePassword, updateProfile, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { Loader2, User, Mail, Save, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const ProfileView: React.FC<{
  user: any, 
  userData: any, 
  onUpdate: (data: any) => void,
  onDeleted: () => void 
}> = ({ user, userData, onUpdate, onDeleted }) => {
  const [name, setName] = useState(userData?.name || user?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [messages, setMessages] = useState<{ error?: string, success?: string }>({});

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    setMessages({});

    try {
      if (name !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName: name });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { name });
        onUpdate({ ...userData, name });
      }

      if (newPassword && currentPassword) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
      } else if (newPassword && !currentPassword) {
        throw new Error('Please enter your current password to set a new one.');
      }

      setMessages({ success: 'Profile updated successfully!' });
      setNewPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      console.error(err);
      setMessages({ error: err.message || 'Failed to update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!auth.currentUser || !currentPassword) {
       setMessages({ error: 'Please enter your current password to delete your account.' });
       return;
    }
    
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;

    setIsDeleting(true);
    setMessages({});
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      const uid = auth.currentUser.uid;

      // Delete storage folder
      try {
        const folderRef = ref(storage, `user_uploads/${uid}`);
        const listRes = await listAll(folderRef);
        const deletePromises = listRes.items.map((itemRef) => deleteObject(itemRef));
        await Promise.all(deletePromises);
      } catch (storageErr) {
        console.error('Error deleting user storage files:', storageErr);
      }

      // Delete document from firestore first
      await deleteDoc(doc(db, 'users', uid));
      
      // Then delete from auth
      await deleteUser(auth.currentUser);
      onDeleted();
    } catch (err: any) {
      console.error(err);
      setMessages({ error: err.message || 'Failed to delete account. Make sure your password is correct.' });
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3 space-y-6">
          <div className="glass-card p-6 border-zinc-800/50 flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 bg-brand-red/10 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{userData?.name || user?.displayName || 'User'}</h3>
              <p className="text-xs text-zinc-400 font-medium break-all">{user?.email}</p>
            </div>
            
            <div className="flex gap-2">
              {userData?.isPremium && (
                <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-500 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                  Pro
                </div>
              )}
              {userData?.isAdmin && (
                <div className="bg-brand-red/20 text-brand-red px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-red/20 flex items-center gap-1">
                  <ShieldCheck size={12} /> Admin
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full md:w-2/3 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-zinc-800/50">
            <h3 className="text-sm font-black italic uppercase text-white tracking-widest mb-6">Profile Settings</h3>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Email</label>
                <div className="relative opacity-60 pointer-events-none">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    type="email" 
                    value={user?.email || ''}
                    readOnly
                    className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4">
                 <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Change Password & Danger Zone</h4>
                 
                 <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Current Password (Required for deleting or changing password)</label>
                   <input 
                     type="password" 
                     value={currentPassword}
                     onChange={(e) => setCurrentPassword(e.target.value)}
                     placeholder="Current Password"
                     className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">New Password (Optional)</label>
                   <input 
                     type="password" 
                     value={newPassword}
                     onChange={(e) => setNewPassword(e.target.value)}
                     placeholder="New Password"
                     className="w-full bg-brand-dark/50 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-red/50 transition-colors"
                   />
                 </div>
              </div>

              {messages.error && <p className="text-brand-red text-xs font-bold">{messages.error}</p>}
              {messages.success && <p className="text-green-500 text-xs font-bold">{messages.success}</p>}

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all text-sm disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Update Profile</>}
                </button>

                <button 
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all text-sm disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <><AlertTriangle size={16} /> Delete Account</>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
