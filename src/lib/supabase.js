/**
 * Supabase Client & Auth Manager
 * Properly initialized Supabase client with authentication helpers
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and anon key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are available
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables are missing. Some features may not work.');
}

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Authentication Helpers
 */

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {object} metadata - Additional user metadata (name, etc.)
 * @returns {Promise<{data: object, error: object|null>}> - Supabase auth response
 */
export const signUp = async (email, password, metadata = {}) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Sign in a user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{data: object, error: object|null>}> - Supabase auth response
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Sign in with magic link (email)
 * @param {string} email - User's email
 * @returns {Promise<{data: object, error: object|null>}> - Supabase auth response
 */
export const signInWithMagicLink = async (email) => {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Sign out the current user
 * @returns {Promise<{error: object|null>}> - Supabase auth response
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return { error };
  }
};

/**
 * Get the current user session
 * @returns {Promise<{data: { session: object|null }, error: object|null>}> - Supabase auth response
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Get the current user
 * @returns {Promise<{data: { user: object|null }, error: object|null>}> - Supabase auth response
 */
export const getUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Update user profile data
 * @param {object} updates - Profile data to update
 * @returns {Promise<{data: object, error: object|null>}> - Supabase auth response
 */
export const updateUser = async (updates) => {
  try {
    const { data, error } = await supabase.auth.updateUser(updates);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Listen for auth state changes
 * @param {function} callback - Function to call when auth state changes
 * @returns {object} - Subscription object that can be used to unsubscribe
 */
export const onAuthStateChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
};

/**
 * Resend email verification
 * @returns {Promise<{error: object|null>}> - Supabase auth response
 */
export const resendVerification = async () => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup'
    });
    return { error };
  } catch (error) {
    return { error };
  }
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @returns {Promise<{error: object|null>}> - Supabase auth response
 */
export const resetPasswordForEmail = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  } catch (error) {
    return { error };
  }
};

/**
 * Guest Mode Functions (for offline/local usage)
 */

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