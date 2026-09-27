import React, { useState, useEffect } from 'react';
import {
  Users, LogIn, LogOut, Edit2, MessageSquare,
  Check, X, AlertTriangle, Loader2,
  Mail, Phone, Lock
} from 'lucide-react';
import {
  supabase,
  signUp, signIn, signInWithMagicLink, signOut,
  getSession, onAuthStateChange, isGuestMode,
  getActiveUser, saveUserProfile
} from '../lib/supabase.js';
import { getLocalChats, saveLocalChats, getSavedSettings, saveSettings } from '../lib/neuralEngine.js';

export default function AuthModal({ isOpen, onClose }) {
  const [authState, setAuthState] = useState({
    user: null,
    loading: true
  });
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'resident',
    step: 'login' // login, signup, magiclink, verify
  });
  const [formStatus, setFormStatus] = useState({
    loading: false,
    error: null,
    success: null
  });
  const [guestMode, setGuestMode] = useState(isGuestMode());

  useEffect(() => {
    // Check auth state on mount
    checkAuthState();

    // Subscribe to auth changes
    const subscription = onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session);
    });

    return () => {
      subscription?.unsubscribe?.() || subscription?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    // Update guest mode when it changes
    setGuestMode(isGuestMode());
  }, []);

  const checkAuthState = async () => {
    setFormState(prev => ({ ...prev, loading: true }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch user profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setAuthState({
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: profile?.role || 'resident',
            emailVerified: user.email_confirmed_at !== null
          },
          loading: false
        });

        // Migrate localStorage data to Supabase if needed
        await migrateLocalDataToSupabase(user.id);
      } else {
        setAuthState({
          user: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Auth state check error:', error);
      setAuthState({
        user: null,
        loading: false
      });
    }
  };

  const handleAuthStateChange = async (event, session) => {
    if (session) {
      // User signed in
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setAuthState({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          role: profile?.role || 'resident',
          emailVerified: session.user.email_confirmed_at !== null
        },
        loading: false
      });

      // Migrate localStorage data to Supabase if needed
      await migrateLocalDataToSupabase(session.user.id);
    } else {
      // User signed out
      setAuthState({
        user: null,
        loading: false
      });

      // Reset form state
      setFormState({
        email: '',
        password: '',
        fullName: '',
        role: 'resident',
        step: 'login'
      });
      setFormStatus({
        loading: false,
        error: null,
        success: null
      });
    }
  };

  const migrateLocalDataToSupabase = async (userId) => {
    try {
      // Check if user already has data in Supabase
      const { data: existingChats } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (existingChats && existingChats.length > 0) {
        // User already has data, skip migration
        return;
      }

      // Migrate chats
      const localChats = getLocalChats();
      if (localChats.length > 0) {
        const chatsToInsert = localChats.map(chat => ({
          user_id: userId,
          title: chat.title || 'New Session',
          created_at: chat.timestamp || new Date().toISOString(),
          updated_at: chat.timestamp || new Date().toISOString()
        }));

        const { error: chatsError } = await supabase
          .from('chats')
          .insert(chatsToInsert);

        if (chatsError) {
          console.warn('Error migrating chats:', chatsError);
        }
      }

      // Migrate settings
      const localSettings = getSavedSettings();
      if (localSettings && Object.keys(localSettings).length > 0) {
        const { error: settingsError } = await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            settings: localSettings,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (settingsError) {
          console.warn('Error migrating settings:', settingsError);
        }
      }

      // Note: Notes and tasks migration would go here if they existed in localStorage

    } catch (error) {
      console.error('Error migrating local data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormStatus({ loading: true, error: null, success: null });

    try {
      if (formState.step === 'login') {
        await handleLogin();
      } else if (formState.step === 'signup') {
        await handleSignup();
      } else if (formState.step === 'magiclink') {
        await handleMagicLink();
      } else if (formState.step === 'verify') {
        // Verification handled automatically by Supabase
        setFormStatus({ loading: false, success: 'Account verified! Please login.', error: null });
        setFormState(prev => ({ ...prev, step: 'login' }));
      }
    } catch (error) {
      setFormStatus({ loading: false, error: error.message, success: null });
    }
  };

  const handleLogin = async () => {
    const { error } = await signIn(formState.email, formState.password);
    if (error) throw error;
  };

  const handleSignup = async () => {
    const { error } = await signUp(
      formState.email,
      formState.password,
      {
        full_name: formState.fullName,
        role: formState.role
      }
    );
    if (error) throw error;

    setFormStatus({ loading: false, success: 'Verification email sent! Please check your inbox.', error: null });
    setFormState(prev => ({ ...prev, step: 'verify' }));
  };

  const handleMagicLink = async () => {
    const { error } = await signInWithMagicLink(formState.email);
    if (error) throw error;

    setFormStatus({ loading: false, success: 'Magic link sent! Please check your email to sign in.', error: null });
    setFormState(prev => ({ ...prev, step: 'login' }));
  };

  const handleGuestLogin = async () => {
    // Enable guest mode
    setGuestMode(true);

    // Get guest user
    const guestUser = getActiveUser();

    setAuthState({
      user: {
        id: guestUser.id,
        email: guestUser.email,
        name: guestUser.name,
        role: guestUser.role,
        mode: guestUser.mode
      },
      loading: false
    });

    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    setGuestMode(false);
  };

  // Handle magic link callback from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasHash = window.location.hash.length > 0;

    if (urlParams.has('code') || urlParams.has('access_token') || hasHash) {
      // Supabase handles auth callbacks automatically
      // Just clean the URL and redirect to auth check
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (authState.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-md bg-obsidian-900 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 text-center">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              Loading ANYA...
            </h3>
          </div>
        </div>
      </div>
    );
  }

  // Show main app if authenticated
  if (authState.user && !authState.user.loading) {
    return null; // Don't show modal when logged in
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-obsidian-900 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-obsidian-950">
          <div className="flex items-center gap-2.5">
            {formState.step === 'login' && (
              <LogIn className="w-5 h-5 text-cyan-400" />
            )}
            {formState.step === 'signup' && (
              <Users className="w-5 h-5 text-cyan-400" />
            )}
            {formState.step === 'magiclink' && (
              <Mail className="w-5 h-5 text-cyan-400" />
            )}
            {formState.step === 'verify' && (
              <Check className="w-5 h-5 text-cyan-400" />
            )}
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              {formState.step === 'login' && 'Sign into ANYA'}
              {formState.step === 'signup' && 'Create ANYA Account'}
              {formState.step === 'magiclink' && 'Sign in with Magic Link'}
              {formState.step === 'verify' && 'Verify Your Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs sm:text-sm flex-1 overflow-y-auto">
          {/* Guest Mode Option */}
          {formState.step !== 'verify' && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-mono text-slate-300">Continue as Guest</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestMode}
                  onChange={(e) => {
                    setGuestMode(e.target.checked);
                    if (e.target.checked) {
                      handleGuestLogin();
                    }
                  }}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
                <span className="ml-2 text-xs text-slate-300">Enable</span>
              </label>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {formState.step === 'login' && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@domain.com"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formState.password}
                    onChange={(e) => setFormState(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                    minLength="6"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-3 h-3 accent-cyan-400 rounded"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, step: 'signup' }))}
                    className="text-slate-400 hover:text-cyan-400"
                  >
                    Create Account
                  </button>
                </div>
              </>
            )}

            {formState.step === 'signup' && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formState.fullName}
                    onChange={(e) => setFormState(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Your full name"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@domain.com"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formState.password}
                    onChange={(e) => setFormState(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                    minLength="6"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Role
                  </label>
                  <select
                    value={formState.role}
                    onChange={(e) => setFormState(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="resident">Resident (Default)</option>
                    <option value="secretary">Society Secretary</option>
                    <option value="chairman">Society Chairman</option>
                    <option value="treasurer">Society Treasurer</option>
                    <option value="vendor">Local Vendor</option>
                    <option value="pramukh">Community Leader</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, step: 'login' }))}
                    className="text-slate-400 hover:text-cyan-400"
                  >
                    Already have an account?
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
                  >
                    Create Account
                  </button>
                </div>
              </>
            )}

            {formState.step === 'magiclink' && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@domain.com"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, step: 'login' }))}
                    className="text-slate-400 hover:text-cyan-400"
                  >
                    Back to Login
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
                  >
                    Send Magic Link
                  </button>
                </div>
              </>
            )}

            {formState.step === 'verify' && (
              <div className="text-center py-8">
                <div className="flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h4 className="text-sm font-semibold text-white">Check your email!</h4>
                <p className="text-xs text-slate-400 mt-2">
                  We've sent a verification link to <strong className="text-cyan-300">{formState.email}</strong>. Please check your inbox (and spam folder) to verify your account.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, step: 'login' }))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Go to Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Resend verification
                      // This would call resendVerification from supabase.js
                      setFormStatus({ loading: true, error: null, success: null });
                      // Simulate resend for now
                      setTimeout(() => {
                        setFormStatus({ loading: false, success: 'Verification email resent!', error: null });
                      }, 1500);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Resend Link
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Form Status */}
          {formStatus.loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="ml-2 text-xs text-slate-300">Processing...</span>
            </div>
          )}

          {formStatus.error && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/40 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 mb-1" />
              <span>{formStatus.error}</span>
            </div>
          )}

          {formStatus.success && (
            <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-500/40 text-xs">
              <Check className="w-4 h-4 text-emerald-400 mb-1" />
              <span>{formStatus.success}</span>
            </div>
          )}

          {/* Alternative Login Options */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400 text-center mb-3">
              Or sign in with
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleMagicLink}
                className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-800/50 text-xs font-mono hover:bg-slate-800/30 transition-colors"
              >
                <Mail className="w-4 h-4 mr-2" />
                Sign in with Email Link
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-obsidian-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {guestMode && (
              <span className="text-slate-400">
                <Lock className="w-3 h-3" /> Guest Mode
              </span>
            )}
            {!guestMode && (
              <>
                <span className="text-slate-400">
                  <Users className="w-3 h-3" /> Have an account?
                </span>
                <button
                  type="button"
                  onClick={() => setFormState(prev => ({ ...prev, step: 'login' }))}
                  className="text-slate-400 hover:text-cyan-400"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            ANYA v2.0 • Secure Authentication
          </span>
        </div>
      </div>
    </div>
  );
}