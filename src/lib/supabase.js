/**
 * Supabase Client & Guest Session Manager
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pbmcoogenhkbueeijypd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibWNvb2dlbmhrYnVlZWlqeXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzU0MDksImV4cCI6MjA5MjAxMTQwOX0.chJsYo3VrUPnZNdYlG_8qs3R6WK6JIblL4OmxogHSdc';

export const isGuestMode = () => {
  return localStorage.getItem('anya_guest_mode') !== 'false';
};

export const setGuestMode = (enabled = true) => {
  localStorage.setItem('anya_guest_mode', enabled ? 'true' : 'false');
};

export const getActiveUser = () => {
  const customUser = localStorage.getItem('anya_user_profile');
  if (customUser) {
    try {
      return JSON.parse(customUser);
    } catch {}
  }
  return {
    id: 'boss-001',
    email: 'boss@anya.ai',
    name: 'Boss',
    role: 'Commander',
    mode: 'Executive Local Guest'
  };
};

export const saveUserProfile = (profile) => {
  localStorage.setItem('anya_user_profile', JSON.stringify(profile));
};
