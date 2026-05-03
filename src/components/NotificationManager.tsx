import React, { useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Signal, SignalType } from '../types';

export const NotificationManager: React.FC = () => {

  useEffect(() => {
    if (!auth.currentUser) return;

    // Check notification support and permission
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return;
    }

    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const startTime = Date.now();
    const q = query(
      collection(db, 'signals'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const signal = { id: change.doc.id, ...change.doc.data() } as Signal;
          
          if (signal.timestamp > startTime) {
            if (Notification.permission === 'granted') {
              new Notification('Novo Sinal de Trading!', {
                body: `${signal.type} em ${signal.pair} - Score: ${signal.score}%`,
                icon: 'https://i.ibb.co/9BwbV3M/FXBROS-WORLD-3.png'
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  return null;
};
