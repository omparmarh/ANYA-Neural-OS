/**
 * Database Service Layer
 * Handles all data operations with Supabase backend and localStorage fallback
 * Provides a unified interface for chats, messages, notes, tasks, and settings
 */

import { supabase } from './supabase.js';

// Storage keys for localStorage fallback
const STORAGE_KEYS = {
  LOCAL_CHATS: 'anya_local_chats',
  SETTINGS: 'anya_settings',
  NOTES: 'anya_quick_notes',
  TASKS: 'anya_tasks',
  ALARMS: 'anya_active_alarms',
  TOKEN_USAGE: 'anya_token_usage'
};

const DEFAULT_SETTINGS = {
  mode: 'autonomous',
  primaryProvider: 'freellmapi',
  useFreeLLMAPI: true,
  freellmapiUrl: 'http://localhost:3001/v1',
  freellmapiKey: 'freellmapi-3b01700d45e8abec3101dd07b2f4ce0fca08a4eed30f29e0',
  freellmapiModel: 'auto',
  remoteUrl: 'http://127.0.0.1:8000',
  persona: 'sharp',
  assistantName: 'Aanya',
  voiceEnabled: true,
  voiceProvider: 'browser',
  elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
  hapticsEnabled: true,
  userName: 'Boss',
  geminiModel: 'gemini-3.6-flash',
  groqModel: 'llama-3.3-70b-versatile',
};

const nGetLocalChats = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_CHATS) || '[]');
  } catch {
    return [];
  }
};

const nSaveLocalChats = (chats) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_CHATS, JSON.stringify(chats));
  } catch (e) {
    console.error('Failed to save local chats:', e);
  }
};

const nGetSavedSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const nSaveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
  }
};

// Cache for offline operations
const offlineQueue = [];
let isOnline = navigator.onLine;

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  processOfflineQueue();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

/**
 * Process queued operations when coming back online
 */
async function processOfflineQueue() {
  if (!isOnline || offlineQueue.length === 0) return;

  const queue = [...offlineQueue];
  offlineQueue.length = 0; // Clear queue

  for (const operation of queue) {
    try {
      await operation();
    } catch (error) {
      console.error('Failed to process offline operation:', error);
      // Re-queue failed operations
      offlineQueue.push(operation);
    }
  }
}

/**
 * Queue an operation for offline execution
 * @param {Function} operation - Async function to execute
 */
function queueOperation(operation) {
  offlineQueue.push(operation);
}

/**
 * CHATS OPERATIONS
 */

/**
 * Get all chats for the current user
 * @returns {Promise<Array>} - Array of chat objects
 */
export async function getChats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - return localStorage chats
      return nGetLocalChats().map(chat => ({
        ...chat,
        id: chat.id || `local_${Date.now()}`,
        isLocal: true
      }));
    }

    // Get chats from Supabase
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Format chats for consistency with localStorage format
    return (data || []).map(chat => ({
      id: chat.id,
      title: chat.title || 'New Session',
      timestamp: chat.updated_at,
      messageCount: 0 // Will be populated separately if needed
    }));
  } catch (error) {
    console.error('Error fetching chats from Supabase:', error);
    // Fallback to localStorage
    return nGetLocalChats().map(chat => ({
      ...chat,
      id: chat.id || `local_${Date.now()}`,
      isLocal: true
    }));
  }
}

/**
 * Create a new chat
 * @param {Object} chatData - Chat data (title, etc.)
 * @returns {Promise<Object>} - Created chat object
 */
export async function createChat(chatData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - save to localStorage
      const localChats = nGetLocalChats();
      const newChat = {
        id: `local_${Date.now()}`,
        title: chatData.title || 'New Session',
        timestamp: new Date().toISOString(),
        messages: []
      };
      nSaveLocalChats([newChat, ...localChats]);
      return newChat;
    }

    // Create chat in Supabase
    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        title: chatData.title || 'New Session'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      title: data.title,
      timestamp: data.updated_at
    };
  } catch (error) {
    console.error('Error creating chat:', error);
    // Fallback to localStorage
    const localChats = nGetLocalChats();
    const newChat = {
      id: `local_${Date.now()}`,
      title: chatData.title || 'New Session',
      timestamp: new Date().toISOString(),
      messages: []
    };
    nSaveLocalChats([newChat, ...localChats]);
    return newChat;
  }
}

/**
 * Update a chat
 * @param {string} chatId - Chat ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated chat object
 */
export async function updateChat(chatId, updates) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || chatId.startsWith('local_')) {
      // Guest mode or local chat - update localStorage
      const localChats = nGetLocalChats();
      const updatedChats = localChats.map(chat => {
        if (chat.id === chatId) {
          return { ...chat, ...updates, timestamp: new Date().toISOString() };
        }
        return chat;
      });
      nSaveLocalChats(updatedChats);
      return updatedChats.find(chat => chat.id === chatId);
    }

    // Update chat in Supabase
    const { data, error } = await supabase
      .from('chats')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      title: data.title,
      timestamp: data.updated_at
    };
  } catch (error) {
    console.error('Error updating chat:', error);
    // Fallback to localStorage
    const localChats = nGetLocalChats();
    const updatedChats = localChats.map(chat => {
      if (chat.id === chatId) {
        return { ...chat, ...updates, timestamp: new Date().toISOString() };
      }
      return chat;
    });
    nSaveLocalChats(updatedChats);
    return updatedChats.find(chat => chat.id === chatId);
  }
}

/**
 * Delete a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteChat(chatId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || chatId.startsWith('local_')) {
      // Guest mode or local chat - delete from localStorage
      const localChats = nGetLocalChats();
      const filteredChats = localChats.filter(chat => chat.id !== chatId);
      nSaveLocalChats(filteredChats);
      return true;
    }

    // Delete chat from Supabase
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    // Fallback to localStorage
    const localChats = nGetLocalChats();
    const filteredChats = localChats.filter(chat => chat.id !== chatId);
    nSaveLocalChats(filteredChats);
    return true;
  }
}

/**
 * MESSAGES OPERATIONS
 */

/**
 * Get messages for a specific chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<Array>} - Array of message objects
 */
export async function getMessages(chatId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || chatId.startsWith('local_')) {
      // Guest mode - messages are stored within chats in localStorage
      const localChats = nGetLocalChats();
      const chat = localChats.find(c => c.id === chatId);
      return chat ? chat.messages || [] : [];
    }

    // Get messages from Supabase
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Format messages for consistency
    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      attachment: msg.attachments,
      toolWidgets: msg.tool_calls,
      timestamp: msg.timestamp ? (isNaN(new Date(msg.timestamp).getTime()) ? msg.timestamp : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : ''
    }));
  } catch (error) {
    console.error('Error fetching messages:', error);
    // Fallback to localStorage
    const localChats = nGetLocalChats();
    const chat = localChats.find(c => c.id === chatId);
    return chat ? chat.messages || [] : [];
  }
}

/**
 * Add a message to a chat
 * @param {string} chatId - Chat ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} - Created message object
 */
export async function addMessage(chatId, messageData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || chatId.startsWith('local_')) {
      // Guest mode - add to localStorage chat
      const localChats = nGetLocalChats();
      const chatIndex = localChats.findIndex(c => c.id === chatId);

      if (chatIndex === -1) {
        throw new Error('Chat not found');
      }

      const newMessage = {
        id: `msg_${Date.now()}`,
        role: messageData.role,
        content: messageData.content,
        attachment: messageData.attachment || null,
        toolWidgets: messageData.toolWidgets || [],
        timestamp: messageData.timestamp || new Date().toISOString()
      };

      const updatedChat = {
        ...localChats[chatIndex],
        messages: [...(localChats[chatIndex].messages || []), newMessage],
        timestamp: new Date().toISOString()
      };

      const updatedChats = [...localChats];
      updatedChats[chatIndex] = updatedChat;
      nSaveLocalChats(updatedChats);

      return newMessage;
    }

    // Add message to Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id: user.id,
        role: messageData.role,
        content: messageData.content,
        attachments: messageData.attachment,
        tool_calls: messageData.toolWidgets
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      role: data.role,
      content: data.content,
      attachment: data.attachments,
      toolWidgets: data.tool_calls,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Error adding message:', error);
    // Fallback to localStorage
    const localChats = nGetLocalChats();
    const chatIndex = localChats.findIndex(c => c.id === chatId);

    if (chatIndex === -1) {
      throw new Error('Chat not found');
    }

    const newMessage = {
      id: `msg_${Date.now()}`,
      role: messageData.role,
      content: messageData.content,
      attachment: messageData.attachment || null,
      toolWidgets: messageData.toolWidgets || [],
      timestamp: messageData.timestamp || new Date().toISOString()
    };

    const updatedChat = {
      ...localChats[chatIndex],
      messages: [...(localChats[chatIndex].messages || []), newMessage],
      timestamp: new Date().toISOString()
    };

    const updatedChats = [...localChats];
    updatedChats[chatIndex] = updatedChat;
    nSaveLocalChats(updatedChats);

    return newMessage;
  }
}

/**
 * Update a message
 * @param {string} messageId - Message ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated message object
 */
export async function updateMessage(messageId, updates) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - update in localStorage (need to find which chat contains this message)
      const localChats = nGetLocalChats();
      for (const chat of localChats) {
        const msgIndex = chat.messages?.findIndex(m => m.id === messageId) || -1;
        if (msgIndex !== -1) {
          const updatedMessages = [...chat.messages];
          updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], ...updates };

          const updatedChat = {
            ...chat,
            messages: updatedMessages,
            timestamp: new Date().toISOString()
          };

          const updatedChats = localChats.map(c =>
            c.id === chat.id ? updatedChat : c
          );
          nSaveLocalChats(updatedChats);
          return updatedMessages[msgIndex];
        }
      }
      throw new Error('Message not found');
    }

    // Update message in Supabase
    const { data, error } = await supabase
      .from('messages')
      .update({ ...updates })
      .eq('id', messageId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      role: data.role,
      content: data.content,
      attachment: data.attachments,
      toolWidgets: data.tool_calls,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Error updating message:', error);
    // Fallback to localStorage (same logic as above)
    const localChats = nGetLocalChats();
    for (const chat of localChats) {
      const msgIndex = chat.messages?.findIndex(m => m.id === messageId) || -1;
      if (msgIndex !== -1) {
        const updatedMessages = [...chat.messages];
        updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], ...updates };

        const updatedChat = {
          ...chat,
          messages: updatedMessages,
          timestamp: new Date().toISOString()
        };

        const updatedChats = localChats.map(c =>
          c.id === chat.id ? updatedChat : c
        );
        nSaveLocalChats(updatedChats);
        return updatedMessages[msgIndex];
      }
    }
    throw new Error('Message not found');
  }
}

/**
 * Delete a message
 * @param {string} messageId - Message ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteMessage(messageId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - delete from localStorage
      const localChats = nGetLocalChats();
      let messageFound = false;

      const updatedChats = localChats.map(chat => {
        const msgIndex = chat.messages?.findIndex(m => m.id === messageId) || -1;
        if (msgIndex !== -1) {
          messageFound = true;
          const updatedMessages = [...chat.messages];
          updatedMessages.splice(msgIndex, 1);

          return {
            ...chat,
            messages: updatedMessages,
            timestamp: new Date().toISOString()
          };
        }
        return chat;
      });

      if (!messageFound) {
        throw new Error('Message not found');
      }

      nSaveLocalChats(updatedChats);
      return true;
    }

    // Delete message from Supabase
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    // Fallback to localStorage
    const localChats = nGetLocalChats();
    let messageFound = false;

    const updatedChats = localChats.map(chat => {
      const msgIndex = chat.messages?.findIndex(m => m.id === messageId) || -1;
      if (msgIndex !== -1) {
        messageFound = true;
        const updatedMessages = [...chat.messages];
        updatedMessages.splice(msgIndex, 1);

        return {
          ...chat,
          messages: updatedMessages,
          timestamp: new Date().toISOString()
        };
      }
      return chat;
    });

    if (!messageFound) {
      throw new Error('Message not found');
    }

    nSaveLocalChats(updatedChats);
    return true;
  }
}

/**
 * SETTINGS OPERATIONS
 */

/**
 * Get user settings
 * @returns {Promise<Object>} - Settings object
 */
export async function getSettings() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - return localStorage settings
      return nGetSavedSettings();
    }

    // Get settings from Supabase
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // If no settings exist yet, return default settings
      if (error.code === 'PGRST116') { // No rows returned
        return nGetSavedSettings();
      }
      throw error;
    }

    return data.settings || nGetSavedSettings();
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Fallback to localStorage
    return nGetSavedSettings();
  }
}

/**
 * Save user settings
 * @param {Object} settings - Settings object to save
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - save to localStorage
      nSaveSettings(settings);
      return;
    }

    // Upsert settings to Supabase
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving settings:', error);
    // Fallback to localStorage
    nSaveSettings(settings);
  }
}

/**
 * NOTES OPERATIONS
 */

/**
 * Get user notes
 * @returns {Promise<Array>} - Array of note objects
 */
export async function getNotes() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - notes are not currently implemented in localStorage for Jarvis
      // Return empty array for now
      return [];
    }

    // Get notes from Supabase
    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Format notes for consistency
    return (data || []).map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      timestamp: note.timestamp
    }));
  } catch (error) {
    console.error('Error fetching notes:', error);
    // Fallback to empty array
    return [];
  }
}

/**
 * Create a new note
 * @param {Object} noteData - Note data
 * @returns {Promise<Object>} - Created note object
 */
export async function createNote(noteData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - notes not implemented in localStorage
      // Return a local note object (not persisted)
      return {
        id: `note_${Date.now()}`,
        title: noteData.title || 'Quick Note',
        content: noteData.content || '',
        timestamp: new Date().toISOString(),
        isLocal: true
      };
    }

    // Create note in Supabase
    const { data, error } = await supabase
      .from('user_notes')
      .insert({
        user_id: user.id,
        title: noteData.title,
        content: noteData.content
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Error creating note:', error);
    // Fallback to local note
    return {
      id: `note_${Date.now()}`,
      title: noteData.title || 'Quick Note',
      content: noteData.content || '',
      timestamp: new Date().toISOString(),
      isLocal: true
    };
  }
}

/**
 * Update a note
 * @param {string} noteId - Note ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated note object
 */
export async function updateNote(noteId, updates) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - not implemented
      return { ...updates, id: noteId, isLocal: true };
    }

    // Update note in Supabase
    const { data, error } = await supabase
      .from('user_notes')
      .update({ ...updates })
      .eq('id', noteId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Error updating note:', error);
    // Fallback to local note
    return { ...updates, id: noteId, isLocal: true };
  }
}

/**
 * Delete a note
 * @param {string} noteId - Note ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteNote(noteId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - not implemented
      return true;
    }

    // Delete note from Supabase
    const { error } = await supabase
      .from('user_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', user.id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    // Fallback to success
    return true;
  }
}

/**
 * TASKS OPERATIONS
 */

/**
 * Get user tasks
 * @returns {Promise<Array>} - Array of task objects
 */
export async function getTasks() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - tasks are not currently implemented in localStorage for Jarvis
      return [];
    }

    // Get tasks from Supabase
    const { data, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created', { ascending: false });

    if (error) throw error;

    // Format tasks for consistency
    return (data || []).map(task => ({
      id: task.id,
      text: task.text,
      priority: task.priority,
      done: task.done,
      created: task.created
    }));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    // Fallback to empty array
    return [];
  }
}

/**
 * Create a new task
 * @param {Object} taskData - Task data
 * @returns {Promise<Object>} - Created task object
 */
export async function createTask(taskData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - tasks not implemented in localStorage
      // Return a local task object (not persisted)
      return {
        id: `task_${Date.now()}`,
        text: taskData.text || 'Task',
        priority: taskData.priority || 'normal',
        done: false,
        created: new Date().toISOString(),
        isLocal: true
      };
    }

    // Create task in Supabase
    const { data, error } = await supabase
      .from('user_tasks')
      .insert({
        user_id: user.id,
        text: taskData.text,
        priority: taskData.priority,
        done: taskData.done || false
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      text: data.text,
      priority: data.priority,
      done: data.done,
      created: data.created
    };
  } catch (error) {
    console.error('Error creating task:', error);
    // Fallback to local task
    return {
      id: `task_${Date.now()}`,
      text: taskData.text || 'Task',
      priority: taskData.priority || 'normal',
      done: false,
      created: new Date().toISOString(),
      isLocal: true
    };
  }
}

/**
 * Update a task
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated task object
 */
export async function updateTask(taskId, updates) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - not implemented
      return { ...updates, id: taskId, isLocal: true };
    }

    // Update task in Supabase
    const { data, error } = await supabase
      .from('user_tasks')
      .update({ ...updates })
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      text: data.text,
      priority: data.priority,
      done: data.done,
      created: data.created
    };
  } catch (error) {
    console.error('Error updating task:', error);
    // Fallback to local task
    return { ...updates, id: taskId, isLocal: true };
  }
}

/**
 * Delete a task
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteTask(taskId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Guest mode - not implemented
      return true;
    }

    // Delete task from Supabase
    const { error } = await supabase
      .from('user_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    // Fallback to success
    return true;
  }
}

/**
 * Utility function to check if user is authenticated
 * @returns {Promise<boolean>} - True if user is logged in
 */
export const isAuthenticated = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
};

/**
 * Utility function to get current user
 * @returns {Promise<Object|null>} - User object or null
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
  }
};

/**
 * Get the active user from the cached session (sync, no throw).
 * Supabase stores the session in localStorage under sb-<ref>-auth-token,
 * so we can read it synchronously for display purposes.
 * Returns null if no user is logged in.
 * @returns {Object|null}
 */
export const getActiveUser = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.includes('-auth-token'));
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const user = parsed?.user || parsed?.session?.user;
      if (user) {
        return {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: 'resident'
        };
      }
    }
  } catch {}
  return null;
};

/**
 * Utility functions for localStorage fallback compatibility
 */
export const getLocalChats = () => {
  return nGetLocalChats();
};

export const saveLocalChats = (chats) => {
  nSaveLocalChats(chats);
};

export const getSavedSettings = () => {
  return nGetSavedSettings();
};

export const saveLocalSettings = (settings) => {
  nSaveSettings(settings);
};

/**
 * Token usage functions
 */
export const recordTokenUsage = (provider, promptTokens = 0, completionTokens = 0) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TOKEN_USAGE);
    const data = raw ? JSON.parse(raw) : { gemini: { total: 0 }, groq: { total: 0 }, openrouter: { total: 0 }, freellmapi: { total: 0 } };
    if (!data[provider]) data[provider] = { total: 0 };
    data[provider].total = (data[provider].total || 0) + promptTokens + completionTokens;
    localStorage.setItem(STORAGE_KEYS.TOKEN_USAGE, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to record token usage:', e);
  }
};

export const getTokenUsage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TOKEN_USAGE);
    return raw ? JSON.parse(raw) : { gemini: { total: 0 }, groq: { total: 0 }, openrouter: { total: 0 }, freellmapi: { total: 0 } };
  } catch {
    return { gemini: { total: 0 }, groq: { total: 0 }, openrouter: { total: 0 }, freellmapi: { total: 0 } };
  }
};

export const clearTokenUsage = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN_USAGE);
  } catch (e) {
    console.error('Failed to clear token usage:', e);
  }
};