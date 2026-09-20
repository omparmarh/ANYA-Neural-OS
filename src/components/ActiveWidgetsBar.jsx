import React, { useState } from 'react';
import { 
  X, Clock, Bell, FileText, CheckSquare, ChevronRight, 
  Plus, Play, Pause, Trash2 
} from 'lucide-react';
import TimerWidget from './TimerWidget';
import AlarmWidget from './AlarmWidget';
import NoteWidget from './NoteWidget';
import TodoWidget from './TodoWidget';

export default function ActiveWidgetsBar({
  isOpen,
  onClose,
  timers,
  alarms,
  notes,
  tasks,
  onToggleTimerPause,
  onAddMinuteToTimer,
  onCancelTimer,
  onToggleAlarmActive,
  onDeleteAlarm,
  onUpdateNote,
  onDeleteNote,
  onToggleTaskDone,
  onDeleteTask,
  onAddNewTask,
  onAddNewNote
}) {
  const [activeTab, setActiveTab] = useState('timers'); // 'timers' | 'alarms' | 'notes' | 'tasks'
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (newTaskInput.trim()) {
      onAddNewTask(newTaskInput.trim());
      setNewTaskInput('');
    }
  };

  const handleCreateNote = (e) => {
    e.preventDefault();
    if (newNoteContent.trim()) {
      onAddNewNote(newNoteTitle.trim() || 'Quick Note', newNoteContent.trim());
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowAddForm(false);
    }
  };

  return (
    <div className="fixed sm:absolute bottom-0 right-0 top-14 w-full sm:w-96 bg-obsidian-950/95 border-l border-cyan-500/20 z-20 flex flex-col backdrop-blur-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-obsidian-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <h3 className="text-xs font-mono uppercase font-bold tracking-widest text-white">
            Active Widgets
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-obsidian-950 px-2">
        {[
          { id: 'timers', label: `Timers (${timers.length})`, icon: Clock },
          { id: 'alarms', label: `Alarms (${alarms.length})`, icon: Bell },
          { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
          { id: 'notes', label: `Notes (${notes.length})`, icon: FileText },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowAddForm(false);
              }}
              className={`flex-1 py-2.5 text-[11px] font-semibold border-b-2 transition-all flex items-center justify-center gap-1 ${
                active 
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {activeTab === 'timers' && (
          <div>
            {timers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No active timers. Ask ANYA: "set a 5 minute timer".
              </div>
            ) : (
              timers.map(timer => (
                <TimerWidget
                  key={timer.id}
                  timer={timer}
                  onTogglePause={onToggleTimerPause}
                  onAddMinute={onAddMinuteToTimer}
                  onCancel={onCancelTimer}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'alarms' && (
          <div>
            {alarms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No alarms scheduled. Ask ANYA: "set alarm for 7:30 AM".
              </div>
            ) : (
              alarms.map(alarm => (
                <AlarmWidget
                  key={alarm.id}
                  alarm={alarm}
                  onToggleActive={onToggleAlarmActive}
                  onDelete={onDeleteAlarm}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <form onSubmit={handleCreateTask} className="flex gap-1.5">
              <input
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                placeholder="Add new task..."
                className="flex-1 bg-obsidian-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-cyan-500 text-slate-950 font-bold"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {tasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No tasks logged.
              </div>
            ) : (
              tasks.map(task => (
                <TodoWidget
                  key={task.id}
                  task={task}
                  onToggleDone={onToggleTaskDone}
                  onDelete={onDeleteTask}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-semibold border border-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel Note' : 'Create New Note'}</span>
            </button>

            {showAddForm && (
              <form onSubmit={handleCreateNote} className="p-3 bg-obsidian-900 rounded-xl border border-cyan-500/30 space-y-2">
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Note Title..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Note content..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Save Note
                </button>
              </form>
            )}

            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No notes created yet.
              </div>
            ) : (
              notes.map(note => (
                <NoteWidget
                  key={note.id}
                  note={note}
                  onUpdate={onUpdateNote}
                  onDelete={onDeleteNote}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
