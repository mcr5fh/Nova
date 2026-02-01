'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import VoiceControls from './VoiceControls';
import { useVoiceChat } from '@/hooks';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Type a message..."
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice chat hook
  const {
    voiceState,
    transcript,
    agentResponse,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoiceChat();

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      setMessage('');

      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
    // Allow plain Enter to insert newline (default behavior)
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleVoiceToggle = async () => {
    const isActive = voiceState !== 'disconnected' && voiceState !== 'connecting';

    if (!isActive) {
      // Start voice mode
      await connect();
      await startRecording();
    } else {
      // Stop voice mode
      stopRecording();
      disconnect();
    }
  };

  return (
    <div className="flex flex-col p-4 border-t border-border-color bg-bg-secondary">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setMode('text')}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            mode === 'text'
              ? 'bg-accent text-text-primary'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
          }`}
          aria-label="Text mode"
        >
          Text
        </button>
        <button
          onClick={() => setMode('voice')}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            mode === 'voice'
              ? 'bg-accent text-text-primary'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
          }`}
          aria-label="Voice mode"
        >
          Voice
        </button>
      </div>

      {/* Conditional rendering based on mode */}
      {mode === 'text' ? (
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="flex-1 px-3 py-2 bg-bg-tertiary text-text-primary placeholder:text-text-secondary border border-border-color rounded-lg text-sm font-mono resize-none overflow-hidden min-h-[40px] max-h-[200px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Chat message input"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="px-4 min-w-[60px] h-10 bg-accent text-text-primary font-medium rounded-lg text-sm transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-secondary disabled:bg-bg-tertiary disabled:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      ) : (
        <VoiceControls
          onToggle={handleVoiceToggle}
          isActive={voiceState !== 'disconnected' && voiceState !== 'connecting'}
          disabled={false}  // Voice has its own connection - don't inherit text chat disabled state
          voiceState={
            voiceState === 'listening'
              ? 'listening'
              : voiceState === 'processing'
              ? 'processing'
              : voiceState === 'speaking'
              ? 'speaking'
              : voiceState === 'connected'
              ? 'idle'
              : undefined
          }
          transcript={transcript}
          agentResponse={agentResponse}
        />
      )}
    </div>
  );
}
