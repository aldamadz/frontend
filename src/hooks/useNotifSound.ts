import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook untuk memutar suara notifikasi.
 * File: frontend/public/sounds/notif.WAV
 *
 * Pakai ref agar aman dipanggil dari dalam useEffect tanpa stale closure.
 */
export const useNotifSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inisialisasi Audio saat mount — sebelum ada interaksi user
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/notif.WAV');
      audioRef.current.volume = 0.6;
      // Preload agar tidak ada delay saat pertama diputar
      audioRef.current.load();
    } catch {
      // Browser tidak support — abaikan
    }
  }, []);

  const play = useCallback(() => {
    try {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Autoplay policy browser — hanya bisa diputar setelah user pernah klik
      });
    } catch {
      // Abaikan error audio
    }
  }, []);

  return play;
};