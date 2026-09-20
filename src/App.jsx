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
import { 
  thinkOnDevice, speakOnDevice, stopSpeaking, 
  getLocalChats, saveLocalChats, getSavedSettings, 
  saveSettings, getTokenUsage, triggerHaptic 
} from './lib/neuralEngine';
import { 
  parseToolCalls, executeAppLaunch, executeMediaControl, executeWebSearch, 
  playAlertChime, sendNotification, requestNotificationPermission, generatePDF,
  generatePPT, createFile, createFolder, readFile, listFiles, runCommand
} from './lib/toolDispatcher';
import { preprocess, preprocessAsync } from './lib/nlpProcessor';
import { initTelephonyBridge, getActiveCalls } from './lib/telephonyBridge';


export default function App() {
  // Global State
  const [settings, setSettings] = useState(getSavedSettings());
  const [threads, setThreads] = useState(getLocalChats());
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [tokenUsage, setTokenUsage] = useState(getTokenUsage());

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

  // Initialize or Select first thread
  useEffect(() => {
    if (threads.length > 0 && !activeThreadId) {
      setActiveThreadId(threads[0].id);
    } else if (threads.length === 0) {
      handleNewThread();
    }
    requestNotificationPermission();
  }, []);

  // Save persistent state
  useEffect(() => {
    saveLocalChats(threads);
  }, [threads]);

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
  const handleNewThread = () => {
    const newId = `thread_${Date.now()}`;
    const newThread = {
      id: newId,
      title: 'New Session',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: []
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  // Delete Thread
  const handleDeleteThread = (id) => {
    const updated = threads.filter(t => t.id !== id);
    setThreads(updated);
    if (activeThreadId === id) {
      setActiveThreadId(updated[0]?.id || null);
      if (updated.length === 0) {
        handleNewThread();
      }
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
        setNotes(prev => [newNote, ...prev]);
        toolWidgets.push({ tool: 'create_note', note: newNote });

        // Smart fallback: If content contains source code or project instructions, also autonomously write to ~/Desktop
        if (/#include|class\s+|def\s+|<!DOCTYPE|<html|function\s+|\bint\s+main\b/i.test(content) || /code|project|chess|c language|source/i.test(title)) {
          const cleanTitle = (title || 'project_source').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
          let ext = 'txt';
          if (content.includes('#include') || content.includes('main(')) ext = 'c';
          else if (content.includes('<!DOCTYPE') || content.includes('<html')) ext = 'html';
          else if (content.includes('import React') || content.includes('export default')) ext = 'jsx';
          else if (content.includes('def ') || content.includes('import ')) ext = 'py';

          const targetFile = `~/Desktop/${cleanTitle}/${cleanTitle}.${ext}`;
          createFile(targetFile, content);
          toolWidgets.push({
            tool: 'create_file',
            args: { filePath: targetFile, content },
            path: targetFile,
            success: true
          });
        }
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
        setTasks(prev => [newTask, ...prev]);
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
        const res = await generatePDF(title, content);
        toolWidgets.push({
          tool: 'generate_pdf',
          args: { title, content },
          path: res?.path,
          success: res?.success
        });
      }

      else if (tool === 'generate_ppt' || tool === 'create_ppt' || tool === 'generate_presentation') {
        const title = args.title || args.name || 'Aanya Presentation';
        const slides = args.slides || [];
        const htmlContent = args.htmlContent || '';
        const res = await generatePPT(title, slides, htmlContent);
        toolWidgets.push({
          tool: 'generate_ppt',
          args: { title, slides },
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

    // ── NLP Preprocessing: classify intent, fetch RAG data & inject context into prompt ────
    const { enhancedText, intent, isRetry } = await preprocessAsync(text || '', settings.assistantName || 'Aanya');

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,                // display original clean text in chat bubble
      attachment: attachment ? { ...attachment } : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Build messages for AI — use enhancedText (with NLP context) for last user turn
    // Model messages (with NLP context injected into last user turn)
    const modelMessages = [
      ...(currentThread.messages || []),
      { ...userMessage, content: enhancedText }
    ];
    // Display messages (clean, without NLP metadata — shown in chat bubbles)
    const displayMessages = [...(currentThread.messages || []), userMessage];
    const isFirstMessage = displayMessages.length === 1;

    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        return {
          ...t,
          title: isFirstMessage ? (text ? text.slice(0, 32) : 'Image Analysis') : t.title,
          messages: displayMessages   // store clean messages for display
        };
      }
      return t;
    }));

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
            conversation_id: activeThreadId,
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

      setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
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

      setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
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
    setNotes(prev => [newNote, ...prev]);
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
    setTasks(prev => [newTask, ...prev]);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#05070c] text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={(id) => setActiveThreadId(id)}
        onNewThread={handleNewThread}
        onDeleteThread={handleDeleteThread}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onQuickAction={(toolId) => {
          setShowWidgetsTray(true);
        }}
        tokenUsage={tokenUsage}
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
    </div>
  );
}
