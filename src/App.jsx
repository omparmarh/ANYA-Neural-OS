import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputBar from './components/InputBar';
import ActiveWidgetsBar from './components/ActiveWidgetsBar';
import SettingsModal from './components/SettingsModal';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';
import CameraModal from './components/CameraModal';
import CallScreenerWidget from './components/CallScreenerWidget';
import AuthModal from './components/AuthModal';
import {
  getChats, createChat, updateChat, deleteChat,
  getMessages, addMessage, updateMessage, deleteMessage,
  getSettings, saveSettings,
  getNotes, createNote, updateNote, deleteNote,
  getTasks, createTask, updateTask, deleteTask,
  isAuthenticated, getCurrentUser, getActiveUser
} from './lib/db.js';
import {
  thinkOnDevice, speakOnDevice, stopSpeaking,
  getTokenUsage, triggerHaptic
} from './lib/neuralEngine';
import {
  parseToolCalls, executeAppLaunch, executeMediaControl, executeWebSearch,
  playAlertChime, sendNotification, requestNotificationPermission, generatePDF,
  generatePPT, createFile, createFolder, readFile, listFiles, runCommand,
  executeWhatsAppAction
} from './lib/toolDispatcher';
import { preprocess, preprocessAsync } from './lib/nlpProcessor';
import { initTelephonyBridge, getActiveCalls } from './lib/telephonyBridge';
import { supabase, onAuthStateChange } from './lib/supabase.js';

export default function App() {
  // Global State
  const [settings, setSettings] = useState({});
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [tokenUsage, setTokenUsage] = useState({});
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Modals & Panels
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showWidgetsTray, setShowWidgetsTray] = useState(false);

  // Active Widgets Data
  const [activeTelephonyCalls, setActiveTelephonyCalls] = useState([]);

  // Telephony bridge listener
  useEffect(() => {
    initTelephonyBridge(settings.remoteUrl || 'http://localhost:3001');

    const handleTelephonyUpdate = (e) => {
      setActiveTelephonyCalls(e.detail?.calls || []);
    };

    window.addEventListener('anya-telephony-update', handleTelephonyUpdate);
    return () => {
      window.removeEventListener('anya-telephony-update', handleTelephonyUpdate);
    };
  }, [settings.remoteUrl]);

  const [timers, setTimers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('anya_active_timers') || '[]');
    } catch {
      return [];
    }
  });

  const [alarms, setAlarms] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('anya_active_alarms') || '[]');
    } catch {
      return [];
    }
  });

  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('anya_quick_notes') || '[]');
    } catch {
      return [];
    }
  });

  const [tasks, setTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('anya_tasks') || '[]');
    } catch {
      return [];
    }
  });

  const recognitionRef = useRef(null);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      setIsAuthLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (user) {
          setIsAuthenticated(true);
          setCurrentUser({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: 'resident'
          });

          // Fetch user profile from profiles table
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile && !error) {
            setCurrentUser(prev => ({
              ...prev,
              role: profile.role || 'resident'
            }));
          }
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setShowAuthModal(true);
        }

        // Load initial data
        await loadInitialData();
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          role: 'resident'
        });

        // Fetch user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error }) => {
            if (profile && !error) {
              setCurrentUser(prev => ({
                ...prev,
                role: profile.role || 'resident'
              }));
            }
          });

        // Load data when user signs in
        loadInitialData();
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        resetToLocalState();
        setShowAuthModal(true);
      }
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  // Load initial data (chats, settings, etc.)
  const loadInitialData = async () => {
    try {
      // Load chats
      const chats = await getChats();
      if (chats.length > 0) {
        setThreads(chats.map(chat => ({
          id: chat.id,
          title: chat.title,
          timestamp: chat.timestamp
        })));

        // Set active thread to first chat if none selected
        if (!activeThreadId && chats.length > 0) {
          setActiveThreadId(chats[0].id);
          // Load messages for this chat
          loadChatMessages(chats[0].id);
        }
      } else {
        // No chats exist, create a default one
        const newChat = await createChat({ title: 'New Session' });
        setThreads([{
          id: newChat.id,
          title: newChat.title,
          timestamp: newChat.timestamp
        }]);
        setActiveThreadId(newChat.id);
        // Load messages for this new chat (will be empty)
        loadChatMessages(newChat.id);
      }

      // Load settings
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);

    } catch (error) {
      console.error('Error loading initial data:', error);
      // Fallback to localStorage
      const localChats = getLocalChats();
      if (localChats.length > 0) {
        setThreads(localChats.map(chat => ({
          id: chat.id,
          title: chat.title,
          timestamp: chat.timestamp
        })));
        if (!activeThreadId && localChats.length > 0) {
          setActiveThreadId(localChats[0].id);
        }
      } else {
        setThreads([{
          id: `local_${Date.now()}`,
          title: 'New Session',
          timestamp: new Date().toISOString()
        }]);
        setActiveThreadId(`local_${Date.now()}`);
      }

      setSettings(getSavedSettings());
    }
  };

  // Load messages for a specific chat
  const loadChatMessages = async (chatId) => {
    try {
      const messages = await getMessages(chatId);
      // Update the specific chat in threads with its messages
      setThreads(prev => prev.map(thread =>
        thread.id === chatId ? { ...thread, messages } : thread
      ));
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  // Reset to localStorage/guest state
  const resetToLocalState = () => {
    setThreads(getLocalChats().map(chat => ({
      id: chat.id,
      title: chat.title,
      timestamp: chat.timestamp
    })));
    setActiveThreadId(null);
    setSettings(getSavedSettings());
  };

  // Initialize or Select first thread
  useEffect(() => {
    if (threads.length > 0 && !activeThreadId) {
      setActiveThreadId(threads[0].id);
      loadChatMessages(threads[0].id);
    } else if (threads.length === 0 && !isAuthLoading) {
      // Create initial thread if none exists
      const handleNewThreadLocal = () => {
        const newId = `thread_${Date.now()}`;
        const newThread = {
          id: newId,
          title: 'New Session',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messages: []
        };
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(newId);
        loadChatMessages(newId);
      };

      if (isAuthenticated) {
        createChat({ title: 'New Session' }).then(newChat => {
          setThreads([{
            id: newChat.id,
            title: newChat.title,
            timestamp: newChat.timestamp
          }]);
          setActiveThreadId(newChat.id);
          loadChatMessages(newChat.id);
        });
      } else {
        handleNewThreadLocal();
      }
    }
  }, [threads, isAuthenticated, activeThreadId]);

  // Save persistent state to localStorage (for guest mode) and Supabase
  useEffect(() => {
    if (!isAuthenticated) {
      // Guest mode - save to localStorage
      saveLocalChats(threads);
      saveSettings(settings);
    }
    // Note: When authenticated, data is saved via db.js functions
  }, [threads, settings, isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('anya_active_timers', JSON.stringify(timers));
  }, [timers]);

  useEffect(() => {
    localStorage.setItem('anya_active_alarms', JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    localStorage.setItem('anya_quick_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('anya_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Listen to speech audio events & tokens
  useEffect(() => {
    const handleSpeechStart = () => setIsSpeaking(true);
    const handleSpeechStop = () => setIsSpeaking(false);
    const handleTokensUpdate = (e) => setTokenUsage(e.detail);
    const handleOpenCamera = () => setIsCameraOpen(true);

    window.addEventListener('anya-speech-started', handleSpeechStart);
    window.addEventListener('anya-speech-stopped', handleSpeechStop);
    window.addEventListener('anya-tokens-updated', handleTokensUpdate);
    window.addEventListener('anya-open-camera', handleOpenCamera);

    return () => {
      window.removeEventListener('anya-speech-started', handleSpeechStart);
      window.removeEventListener('anya-speech-stopped', handleSpeechStop);
      window.removeEventListener('anya-tokens-updated', handleTokensUpdate);
      window.removeEventListener('anya-open-camera', handleOpenCamera);
    };
  }, []);

  // Background Timers & Alarms Engine (1 second tick)
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Tick Timers
      setTimers(prevTimers => {
        let changed = false;
        const updated = prevTimers.map(timer => {
          if (timer.isPaused || timer.isFinished) return timer;
          changed = true;
          const nextSec = timer.remainingSeconds - 1;
          if (nextSec <= 0) {
            playAlertChime('timer_done');
            sendNotification('ANYA Timer Complete', `Timer "${timer.label}" of ${Math.round(timer.totalSeconds / 60)}m has finished!`);
            return { ...timer, remainingSeconds: 0, isFinished: true };
          }
          return { ...timer, remainingSeconds: nextSec };
        });
        return changed ? updated : prevTimers;
      });

      // 2. Check Alarms
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const currentSeconds = now.getSeconds();

      if (currentSeconds === 0) {
        alarms.forEach(alarm => {
          if (alarm.active && alarm.time === currentTimeStr && !alarm.isRinging) {
            playAlertChime('alarm');
            sendNotification('ANYA Scheduled Alarm', `Alarm: ${alarm.label || 'Scheduled Alert'}`);
            setAlarms(prev => prev.map(a => a.id === alarm.id ? { ...a, isRinging: true } : a));
          }
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [alarms]);

  // Active Thread Helper
  const currentThread = threads.find(t => t.id === activeThreadId) || { messages: [] };

  // Create New Thread
  const handleNewThread = async () => {
    if (isAuthenticated) {
      const newChat = await createChat({ title: 'New Session' });
      setThreads(prev => [newChat, ...prev]);
      setActiveThreadId(newChat.id);
      loadChatMessages(newChat.id);
    } else {
      // Guest mode
      const newId = `thread_${Date.now()}`;
      const newThread = {
        id: newId,
        title: 'New Session',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: []
      };
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newId);
      // No need to load messages for new empty thread in guest mode
    }
  };

  // Delete Thread
  const handleDeleteThread = async (id) => {
    if (isAuthenticated) {
      await deleteChat(id);
      const updated = threads.filter(t => t.id !== id);
      setThreads(updated);
      if (activeThreadId === id) {
        setActiveThreadId(updated[0]?.id || null);
        if (updated.length === 0) {
          handleNewThread();
        }
      }
    } else {
      // Guest mode
      const updated = threads.filter(t => t.id !== id);
      setThreads(updated);
      if (activeThreadId === id) {
        setActiveThreadId(updated[0]?.id || null);
        if (updated.length === 0) {
          // Create new thread in guest mode
          const newId = `thread_${Date.now()}`;
          const newThread = {
            id: newId,
            title: 'New Session',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            messages: []
          };
          setThreads(prev => [newThread, ...prev]);
          setActiveThreadId(newId);
        }
      }
      // Save to localStorage
      saveLocalChats(threads);
    }
  };

  // Dispatch and Execute Tool Actions
  const handleExecuteTools = async (toolList) => {
    const toolWidgets = [];

    for (const item of toolList) {
      const { tool, args = {} } = item;

      if (tool === 'set_timer') {
        const seconds = parseInt(args.seconds || args.duration || 300, 10);
        const label = args.label || `${Math.round(seconds / 60)} min timer`;
        const newTimer = {
          id: `timer_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          label,
          totalSeconds: seconds,
          remainingSeconds: seconds,
          isPaused: false,
          isFinished: false
        };
        setTimers(prev => [newTimer, ...prev]);
        toolWidgets.push({ tool: 'set_timer', timer: newTimer });
      }

      else if (tool === 'set_alarm') {
        const time = args.time || '07:00';
        const label = args.label || 'Scheduled Alarm';
        const newAlarm = {
          id: `alarm_${Date.now()}`,
          time,
          label,
          active: true,
          isRinging: false
        };
        setAlarms(prev => [newAlarm, ...prev]);
        toolWidgets.push({ tool: 'set_alarm', alarm: newAlarm });
      }

      else if (tool === 'create_note') {
        const title = args.title || 'Quick Note';
        const content = args.content || args.text || '';
        const newNote = {
          id: `note_${Date.now()}`,
          title,
          content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (isAuthenticated) {
          const savedNote = await createNote({ title, content });
          setNotes(prev => [savedNote, ...prev]);
        } else {
          setNotes(prev => [newNote, ...prev]);
          saveLocalChats(notes); // Actually should be saveNotes but reusing for now
        }

        toolWidgets.push({ tool: 'create_note', note: newNote });
      }

      else if (tool === 'add_task') {
        const taskText = args.task || args.text || 'Task';
        const priority = args.priority || 'normal';
        const newTask = {
          id: `task_${Date.now()}`,
          text: taskText,
          priority,
          done: false,
          created: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (isAuthenticated) {
          const savedTask = await createTask({ text: taskText, priority });
          setTasks(prev => [savedTask, ...prev]);
        } else {
          setTasks(prev => [newTask, ...prev]);
          saveLocalChats(tasks); // Reusing for now
        }

        toolWidgets.push({ tool: 'add_task', task: newTask });
      }

      else if (tool === 'open_app') {
        const res = await executeAppLaunch(args.app, args.query || '');
        toolWidgets.push({ tool: 'open_app', args, url: res?.url });
      }

      else if (tool === 'media_control' || tool === 'play_media') {
        const res = await executeMediaControl(args.action || 'play', args.app || 'ytmusic', args.query || args.song || '');
        toolWidgets.push({ tool: 'media_control', args, res, url: res?.url });
      }

      else if (tool === 'web_search') {
        const res = await executeWebSearch(args.query, args.engine || 'google', false);
        toolWidgets.push({ tool: 'web_search', args, url: res?.url, ragData: res?.ragData });
      }

      else if (tool === 'generate_pdf' || tool === 'create_pdf') {
        const title = args.title || args.name || 'Aanya Document';
        const content = args.content || args.text || args.markdown || '';
        const theme = args.theme || 'cyberpunk';
        const res = await generatePDF(title, content, theme);
        toolWidgets.push({
          tool: 'generate_pdf',
          args: { title, content, theme },
          path: res?.path,
          success: res?.success
        });
      }

      else if (tool === 'generate_ppt' || tool === 'create_ppt' || tool === 'generate_presentation') {
        const title = args.title || args.name || 'Aanya Presentation';
        const slides = args.slides || [];
        const htmlContent = args.htmlContent || '';
        const theme = args.theme || 'cyberpunk';
        const res = await generatePPT(title, slides, htmlContent, theme);
        toolWidgets.push({
          tool: 'generate_ppt',
          args: { title, slides, theme },
          pdfPath: res?.pdfPath,
          htmlPath: res?.htmlPath,
          success: res?.success
        });
      }

      else if (tool === 'create_file' || tool === 'write_file') {
        const filePath = args.filePath || args.path || args.filename || 'file.txt';
        const content = args.content || args.code || args.text || '';
        const res = await createFile(filePath, content);
        toolWidgets.push({
          tool: 'create_file',
          args: { filePath, content },
          path: res?.path,
          success: res?.success
        });
      }

      else if (tool === 'create_folder' || tool === 'mkdir') {
        const folderPath = args.folderPath || args.path || args.dirname || 'new_folder';
        const res = await createFolder(folderPath);
        toolWidgets.push({
          tool: 'create_folder',
          args: { folderPath },
          path: res?.path,
          success: res?.success
        });
      }

      else if (tool === 'run_command' || tool === 'execute_command') {
        const command = args.command || args.cmd || '';
        const cwd = args.cwd || '';
        const res = await runCommand(command, cwd);
        toolWidgets.push({
          tool: 'run_command',
          args: { command, cwd },
          output: res?.stdout || res?.error,
          success: res?.success
        });
      }

      else if (tool === 'whatsapp_action') {
        const contact = args.contact || '';
        const message = args.message || '';
        const action = args.action || 'message';
        const res = await executeWhatsAppAction(contact, message, action);
        toolWidgets.push({ tool: 'whatsapp_action', args, res, success: res?.success });
      }

      else if (tool === 'device_action') {
        if (args.action === 'vibrate') {
          triggerHaptic([100, 50, 100]);
        }
      }
    }

    return toolWidgets;
  };

  // Main Send Message Handler
  const handleSendMessage = async (text, attachment = null) => {
    if (!text && !attachment) return;
    // Prevent overlapping model calls — the live camera stream sends frames
    // continuously, so ignore new messages while the model is already working.
    if (isThinking) return;

    // Ensure authenticated user has a real database thread
    let currentChatId = activeThreadId;
    if (isAuthenticated && (!currentChatId || currentChatId.startsWith('local_') || currentChatId.startsWith('thread_'))) {
      try {
        const newChat = await createChat({ title: text ? text.slice(0, 32) : 'New Session' });
        currentChatId = newChat.id;
        setActiveThreadId(currentChatId);
        setThreads(prev => {
          const exists = prev.some(t => t.id === currentChatId);
          if (exists) return prev;
          return [{ id: newChat.id, title: newChat.title, timestamp: newChat.timestamp, messages: [] }, ...prev.filter(t => !t.id.startsWith('local_') && !t.id.startsWith('thread_'))];
        });
      } catch (e) {
        console.error('Failed to create DB chat thread:', e);
      }
    }

    // ── NLP Preprocessing: classify intent, fetch RAG data & inject context into prompt ────
    const { enhancedText, intent, isRetry } = await preprocessAsync(text || '', settings.assistantName || 'Aanya');

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,                // display original clean text in chat bubble
      attachment: attachment ? { ...attachment } : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Save user message to database if authenticated
    if (isAuthenticated && currentChatId && !currentChatId.startsWith('local_') && !currentChatId.startsWith('thread_')) {
      addMessage(currentChatId, userMessage).catch(err => console.error('Failed to save user message to DB:', err));
    }

    // Build messages for AI — use enhancedText (with NLP context) for last user turn
    const modelMessages = [
      ...(currentThread.messages || []),
      { ...userMessage, content: enhancedText }
    ];
    // Display messages (clean, without NLP metadata — shown in chat bubbles)
    const displayMessages = [...(currentThread.messages || []), userMessage];
    const isFirstMessage = displayMessages.length === 1;

    const chatTitle = isFirstMessage ? (text ? text.slice(0, 32) : 'Image Analysis') : currentThread.title;

    if (isFirstMessage && isAuthenticated && currentChatId && !currentChatId.startsWith('local_') && !currentChatId.startsWith('thread_')) {
      updateChat(currentChatId, { title: chatTitle }).catch(err => console.error('Failed to update chat title in DB:', err));
    }

    // Update threads optimistically
    setThreads(prev => prev.map(t => {
      if (t.id === (currentChatId || activeThreadId)) {
        return {
          ...t,
          title: chatTitle,
          messages: displayMessages   // store clean messages for display
        };
      }
      return t;
    }));

    // ── SILENT ACTION FAST PATH ──────────────────────────────────────────────
    if (intent.silentAction && intent.type !== 'retry') {
      let silentTools = [];
      let statusText = '';

      if (intent.type === 'web_search') {
        silentTools = [{ tool: 'web_search', args: { query: intent.query, engine: intent.engine || 'google' } }];
        statusText = `🔍 Searching for **${intent.query}**...`;
      } else if (intent.type === 'open_app' || intent.type === 'open_url') {
        const app = intent.app || 'browser';
        const url = intent.url || intent.query || '';
        silentTools = [{ tool: 'open_app', args: { app, query: url } }];
        statusText = `🚀 Opening **${app}**${url ? ` → ${url.length > 50 ? url.slice(0, 50) + '…' : url}` : ''}...`;
      } else if (intent.type === 'whatsapp_contact') {
        silentTools = [{ tool: 'whatsapp_action', args: { contact: intent.contact, message: intent.message || '', action: intent.action } }];
        statusText = intent.action === 'call'
          ? `📞 Calling **${intent.contact}** on WhatsApp...`
          : `💬 Sending WhatsApp message to **${intent.contact}**...`;
      } else if (intent.type === 'call') {
        silentTools = [{ tool: 'open_app', args: { app: 'phone', query: intent.phone } }];
        statusText = `📞 Dialling **${intent.phone}**...`;
      } else if (intent.type === 'sms') {
        silentTools = [{ tool: 'open_app', args: { app: 'sms', query: `${intent.phone}|${intent.body}` } }];
        statusText = `✉️ Sending SMS to **${intent.phone}**...`;
      } else if (intent.type === 'media_control') {
        silentTools = [{ tool: 'media_control', args: { action: intent.action, app: intent.app, query: intent.query || '' } }];
        statusText = `🎵 ${intent.action === 'play' ? 'Playing' : intent.action} on **${intent.app}**${intent.query ? `: ${intent.query}` : ''}...`;
      }

      if (silentTools.length > 0) {
        const toolWidgets = await handleExecuteTools(silentTools);
        const statusBubble = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: statusText,
          toolWidgets,
          isSilentAction: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (isAuthenticated && currentChatId && !currentChatId.startsWith('local_') && !currentChatId.startsWith('thread_')) {
          addMessage(currentChatId, statusBubble).catch(err => console.error('Failed to save silent action message to DB:', err));
        }
        setThreads(prev => prev.map(t => {
          if (t.id === (currentChatId || activeThreadId)) {
            return { ...t, messages: [...t.messages, statusBubble] };
          }
          return t;
        }));
        setIsThinking(false);
        return; // Do NOT call AI model
      }
    }
    // ── END SILENT ACTION FAST PATH ───────────────────────────────────────────

    setIsThinking(true);

    try {
      let rawReply = '';

      if (settings.mode === 'remote') {
        // Send to remote FastAPI daemon (use NLP-enhanced text)
        const res = await fetch(`${settings.remoteUrl || 'http://127.0.0.1:8000'}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: enhancedText || text,
            conversation_id: currentChatId || activeThreadId,
            file_path: attachment?.name || ''
          })
        });
        if (!res.ok) throw new Error(`Remote daemon returned status ${res.status}`);
        const data = await res.json();
        rawReply = data.reply;
      } else {
        // Execute in Autonomous On-Device Neural Engine (NLP context injected)
        rawReply = await thinkOnDevice(modelMessages, settings, attachment);
      }

      // Parse structured JSON tools
      const { cleanText, tools } = parseToolCalls(rawReply);
      const toolWidgets = await handleExecuteTools(tools);

      // Fallback: If user asked for PDF or intent was PDF, but model didn't emit a generate_pdf tool call, auto-generate PDF!
      const isPdfRequest = intent?.type === 'pdf' || /\bpdf\b/i.test(text);
      const hasPdfTool = tools.some(t => t.tool === 'generate_pdf' || t.tool === 'create_pdf');
      if (isPdfRequest && !hasPdfTool) {
        console.log('[ANYA] Auto-triggering PDF generation fallback from response text...');
        const pdfTitle = intent?.title || 'Aanya_Generated_Document';
        const pdfContent = cleanText || rawReply;
        const pdfRes = await generatePDF(pdfTitle, pdfContent);
        toolWidgets.push({
          tool: 'generate_pdf',
          args: { title: pdfTitle, content: pdfContent },
          path: pdfRes?.path,
          success: pdfRes?.success
        });
      }

      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: cleanText || rawReply,
        toolWidgets,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (isAuthenticated && currentChatId && !currentChatId.startsWith('local_') && !currentChatId.startsWith('thread_')) {
        addMessage(currentChatId, assistantMessage).catch(err => console.error('Failed to save assistant message to DB:', err));
      }

      setThreads(prev => prev.map(t => {
        if (t.id === (currentChatId || activeThreadId)) {
          return {
            ...t,
            messages: [...t.messages, assistantMessage]
          };
        }
        return t;
      }));

      // Speak response if voice enabled
      if (settings.voiceEnabled) {
        speakOnDevice(cleanText || rawReply, settings);
      }
    } catch (err) {
      console.error('[ANYA Error]:', err);
      const errorMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `⚠️ Neural Exception: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (isAuthenticated && currentChatId && !currentChatId.startsWith('local_') && !currentChatId.startsWith('thread_')) {
        addMessage(currentChatId, errorMessage).catch(err => console.error('Failed to save error message to DB:', err));
      }

      setThreads(prev => prev.map(t => {
        if (t.id === (currentChatId || activeThreadId)) {
          return { ...t, messages: [...t.messages, errorMessage] };
        }
        return t;
      }));
    } finally {
      setIsThinking(false);
    }
  };

  // Speech Recognition Mic Toggle
  const handleToggleSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech Recognition API is not supported in this browser.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        triggerHaptic(40);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(interim);

        if (final.trim()) {
          // Check wake word strip
          let cleanFinal = final.trim();
          const currentName = (settings.assistantName || 'Aanya').trim();
          const escapedName = currentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wakeWordRegex = new RegExp(`^(?:hey\\s+${escapedName}|${escapedName}|hey\\s+aanya|aanya|hey\\s+anya|anya|wake\\s+up)\\s*,?\\s*`, 'i');
          if (wakeWordRegex.test(cleanFinal)) {
            cleanFinal = cleanFinal.replace(wakeWordRegex, '');
          }
          if (cleanFinal) {
            handleSendMessage(cleanFinal);
            setInterimTranscript('');
          }
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
        setIsListening(false);
      }
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  };

  // Timer Handlers
  const handleToggleTimerPause = (id) => {
    setTimers(prev => prev.map(t => t.id === id ? { ...t, isPaused: !t.isPaused } : t));
  };

  const handleAddMinuteToTimer = (id) => {
    setTimers(prev => prev.map(t => t.id === id ? {
      ...t,
      remainingSeconds: t.remainingSeconds + 60,
      totalSeconds: t.totalSeconds + 60,
      isFinished: false
    } : t));
  };

  const handleCancelTimer = (id) => {
    setTimers(prev => prev.filter(t => t.id !== id));
  };

  // Alarm Handlers
  const handleToggleAlarmActive = (id) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, active: !a.active, isRinging: false } : a));
  };

  const handleDeleteAlarm = (id) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
  };

  // Note Handlers
  const handleUpdateNote = (id, updated) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updated } : n));
  };

  const handleDeleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleAddNewNote = (title, content) => {
    const newNote = {
      id: `note_${Date.now()}`,
      title,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isAuthenticated) {
      createNote({ title, content }).then(savedNote => {
        setNotes(prev => [savedNote, ...prev]);
      });
    } else {
      setNotes(prev => [newNote, ...prev]);
      saveLocalChats(notes); // Reusing for now
    }
  };

  // Task Handlers
  const handleToggleTaskDone = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddNewTask = (text) => {
    const newTask = {
      id: `task_${Date.now()}`,
      text,
      priority: 'normal',
      done: false,
      created: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isAuthenticated) {
      createTask({ text, priority: 'normal' }).then(savedTask => {
        setTasks(prev => [savedTask, ...prev]);
      });
    } else {
      setTasks(prev => [newTask, ...prev]);
      saveLocalChats(tasks); // Reusing for now
    }
  };

  // Handle auth modal
  const handleAuthClose = () => {
    setShowAuthModal(false);
  };

  // Handle guest login
  const handleGuestLogin = () => {
    setShowAuthModal(false);
    // Will be handled by auth state change
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowAuthModal(false);
    // Will reset to local state via auth state change
  };

  // Resolve the display user for the header/sidebar even in guest mode
  const activeUser = currentUser || getActiveUser() || { name: 'Boss', role: 'Commander' };

  if (isAuthLoading) {
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


  return (
    <div className="flex h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-[#05070c] text-slate-100 font-sans">
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={handleAuthClose}
        />
      )}

      {/* Main App (only show when authenticated) */}
      {isAuthenticated && (
        <>
          {/* Sidebar Navigation */}
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={(id) => {
              setActiveThreadId(id);
              loadChatMessages(id);
            }}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            onQuickAction={(toolId) => {
              setShowWidgetsTray(true);
            }}
            tokenUsage={tokenUsage}
            currentUser={activeUser}
            onLogout={handleLogout}
          />

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Top Header */}
            <Header
              settings={settings}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isListening={isListening}
              isSpeaking={isSpeaking}
              onEmergencyStop={stopSpeaking}
              activeTimersCount={timers.filter(t => !t.isFinished).length}
              onToggleWidgetsTray={() => setShowWidgetsTray(!showWidgetsTray)}
              showWidgetsTray={showWidgetsTray}
              currentUser={activeUser}
            />

            {/* Chat Message Stream */}
            <ChatArea
              messages={currentThread.messages || []}
              isThinking={isThinking}
              settings={settings}
              onSpeakMessage={(text) => speakOnDevice(text, settings)}
              onToggleTimerPause={handleToggleTimerPause}
              onAddMinuteToTimer={handleAddMinuteToTimer}
              onCancelTimer={handleCancelTimer}
              onToggleAlarmActive={handleToggleAlarmActive}
              onDeleteAlarm={handleDeleteAlarm}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onToggleTaskDone={handleToggleTaskDone}
              onDeleteTask={handleDeleteTask}
            />

            {/* Bottom Input Controls */}
            <InputBar
              onSendMessage={handleSendMessage}
              onOpenLiveCamera={() => setIsCameraOpen(true)}
              isListening={isListening}
              onToggleSpeechRecognition={handleToggleSpeech}
              interimTranscript={interimTranscript}
              disabled={isThinking}
              assistantName={settings.assistantName || 'Aanya'}
            />

            {/* Active Widgets Side/Bottom Panel */}
            <ActiveWidgetsBar
              isOpen={showWidgetsTray}
              onClose={() => setShowWidgetsTray(false)}
              timers={timers}
              alarms={alarms}
              notes={notes}
              tasks={tasks}
              onToggleTimerPause={handleToggleTimerPause}
              onAddMinuteToTimer={handleAddMinuteToTimer}
              onCancelTimer={handleCancelTimer}
              onToggleAlarmActive={handleToggleAlarmActive}
              onDeleteAlarm={handleDeleteAlarm}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onToggleTaskDone={handleToggleTaskDone}
              onDeleteTask={handleDeleteTask}
              onAddNewTask={handleAddNewTask}
              onAddNewNote={handleAddNewNote}
            />
          </div>

          {/* Modals */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onSaveSettings={(newSettings) => {
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
          />

          <PrivacyPolicyModal
            isOpen={isPrivacyOpen}
            onClose={() => setIsPrivacyOpen(false)}
          />

          <CameraModal
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            assistantName={settings.assistantName || 'Aanya'}
            onCapture={(imgData, livePrompt) => {
              const prompt = livePrompt || "Analyze this live camera view and describe what you observe or execute requested actions.";
              handleSendMessage(prompt, imgData);
            }}
          />

          {/* Real-time AI Call Screener HUD Modal */}
          {activeTelephonyCalls.length > 0 && (
            <CallScreenerWidget
              callSession={activeTelephonyCalls[0]}
              onClose={() => setActiveTelephonyCalls([])}
              assistantName={settings.assistantName || 'Aanya'}
            />
          )}
        </>
      )}

      {/* Guest Mode App (show when not authenticated but not showing auth modal) */}
      {!isAuthenticated && !showAuthModal && (
        <>
          {/* Sidebar Navigation */}
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={(id) => {
              setActiveThreadId(id);
              // Load messages for guest mode (from localStorage within chats)
              const chat = threads.find(t => t.id === id);
              // Messages are already stored in the chat object for guest mode
            }}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            onQuickAction={(toolId) => {
              setShowWidgetsTray(true);
            }}
            tokenUsage={tokenUsage}
            currentUser={getActiveUser() || { name: 'Boss', role: 'Commander' }}
            onLogout={handleLogout}
          />

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Top Header */}
            <Header
              settings={settings}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isListening={isListening}
              isSpeaking={isSpeaking}
              onEmergencyStop={stopSpeaking}
              activeTimersCount={timers.filter(t => !t.isFinished).length}
              onToggleWidgetsTray={() => setShowWidgetsTray(!showWidgetsTray)}
              showWidgetsTray={showWidgetsTray}
              currentUser={getActiveUser() || { name: 'Boss', role: 'Commander' }}
            />

            {/* Chat Message Stream */}
            <ChatArea
              messages={currentThread.messages || []}
              isThinking={isThinking}
              settings={settings}
              onSpeakMessage={(text) => speakOnDevice(text, settings)}
              onToggleTimerPause={handleToggleTimerPause}
              onAddMinuteToTimer={handleAddMinuteToTimer}
              onCancelTimer={handleCancelTimer}
              onToggleAlarmActive={handleToggleAlarmActive}
              onDeleteAlarm={handleDeleteAlarm}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onToggleTaskDone={handleToggleTaskDone}
              onDeleteTask={handleDeleteTask}
            />

            {/* Bottom Input Controls */}
            <InputBar
              onSendMessage={handleSendMessage}
              onOpenLiveCamera={() => setIsCameraOpen(true)}
              isListening={isListening}
              onToggleSpeechRecognition={handleToggleSpeech}
              interimTranscript={interimTranscript}
              disabled={isThinking}
              assistantName={settings.assistantName || 'Aanya'}
            />

            {/* Active Widgets Side/Bottom Panel */}
            <ActiveWidgetsBar
              isOpen={showWidgetsTray}
              onClose={() => setShowWidgetsTray(false)}
              timers={timers}
              alarms={alarms}
              notes={notes}
              tasks={tasks}
              onToggleTimerPause={handleToggleTimerPause}
              onAddMinuteToTimer={handleAddMinuteToTimer}
              onCancelTimer={handleCancelTimer}
              onToggleAlarmActive={handleToggleAlarmActive}
              onDeleteAlarm={handleDeleteAlarm}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onToggleTaskDone={handleToggleTaskDone}
              onDeleteTask={handleDeleteTask}
              onAddNewTask={handleAddNewTask}
              onAddNewNote={handleAddNewNote}
            />
          </div>

          {/* Modals */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onSaveSettings={(newSettings) => {
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
          />

          <PrivacyPolicyModal
            isOpen={isPrivacyOpen}
            onClose={() => setIsPrivacyOpen(false)}
          />

          <CameraModal
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            assistantName={getActiveUser()?.name || 'Aanya'}
            onCapture={(imgData, livePrompt) => {
              const prompt = livePrompt || "Analyze this live camera view and describe what you observe or execute requested actions.";
              handleSendMessage(prompt, imgData);
            }}
          />

          {/* Real-time AI Call Screener HUD Modal */}
          {activeTelephonyCalls.length > 0 && (
            <CallScreenerWidget
              callSession={activeTelephonyCalls[0]}
              onClose={() => setActiveTelephonyCalls([])}
              assistantName={getActiveUser()?.name || 'Aanya'}
            />
          )}
        </>
      )}
    </div>
  );
}