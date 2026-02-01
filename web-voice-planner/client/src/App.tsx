import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { ChatTranscript } from './components/ChatTranscript';
import { MicButton } from './components/MicButton';
import { TextInput } from './components/TextInput';
import { StatusIndicator } from './components/StatusIndicator';
import { SpecComplete } from './components/SpecComplete';
import { ErrorBanner } from './components/ErrorBanner';
import type { ConversationEntry } from '../../shared/types';
import './App.css';

const WS_URL = 'ws://localhost:3001';

interface ErrorPayload {
  message: string;
  code: string;
  fallbackMode?: 'text-only' | 'text-input';
}

function App() {
  const [messages, setMessages] = useState<ConversationEntry[]>([]);
  const [featureName, setFeatureName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [shouldShowGenerate, setShouldShowGenerate] = useState(false);
  const [specResult, setSpecResult] = useState<{ path: string | null; content: string; saveError?: string } | null>(null);
  const [currentError, setCurrentError] = useState<ErrorPayload | null>(null);
  const [voiceMode, setVoiceMode] = useState<'available' | 'text-only'>('available');

  const {
    status,
    session,
    lastMessage,
    startSession,
    sendText,
    sendAudioChunk,
    stopSpeaking,
    generateSpec,
    clearSession,
  } = useWebSocket(WS_URL);

  const { isPlaying, playChunk, stop: stopAudio } = useAudioPlayer();

  const {
    isRecording,
    permissionDenied,
    startRecording,
    stopRecording,
  } = useAudioRecorder(sendAudioChunk);

  const dismissError = useCallback(() => {
    setCurrentError(null);
  }, []);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'ai_response': {
        const { text, shouldGenerate } = lastMessage.payload as { text: string; shouldGenerate: boolean };
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
        }]);
        if (shouldGenerate) {
          setShouldShowGenerate(true);
        }
        break;
      }

      case 'ai_audio': {
        const { chunk } = lastMessage.payload as { chunk: string };
        playChunk(chunk);
        break;
      }

      case 'transcript_update': {
        const { text: transcript } = lastMessage.payload as { text: string };
        setMessages(prev => [...prev, {
          role: 'user',
          content: transcript,
          timestamp: new Date().toISOString(),
        }]);
        break;
      }

      case 'spec_generated': {
        const { path, content, saveError } = lastMessage.payload as { path: string | null; content: string; saveError?: string };
        setSpecResult({ path, content, saveError });
        if (saveError) {
          setCurrentError({
            message: saveError,
            code: 'SPEC_SAVE_ERROR',
          });
        }
        break;
      }

      case 'error': {
        const errorPayload = lastMessage.payload as ErrorPayload;
        setCurrentError(errorPayload);

        // Handle fallback modes
        if (errorPayload.fallbackMode === 'text-only') {
          setVoiceMode('text-only');
        }

        // For session errors, might need to reset state
        if (errorPayload.code === 'SESSION_LOCKED' || errorPayload.code === 'SESSION_NOT_FOUND') {
          // Clear local session to force fresh start
          clearSession();
          setHasStarted(false);
        }
        break;
      }
    }
  }, [lastMessage, playChunk, clearSession]);

  // Restore messages from session
  useEffect(() => {
    if (session?.conversationHistory) {
      setMessages(session.conversationHistory);
      setHasStarted(true);
    }
  }, [session]);

  // Reset voice mode when connection re-establishes
  useEffect(() => {
    if (status === 'connected') {
      setVoiceMode('available');
    }
  }, [status]);

  const handleStart = () => {
    if (featureName.trim()) {
      startSession(featureName.trim().toLowerCase().replace(/\s+/g, '-'));
      setHasStarted(true);
    }
  };

  const handleSendText = (text: string) => {
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }]);
    sendText(text);
  };

  const handleStopSpeaking = () => {
    stopAudio();
    stopSpeaking();
  };

  const handleNewSession = () => {
    clearSession();
    setMessages([]);
    setFeatureName('');
    setHasStarted(false);
    setShouldShowGenerate(false);
    setSpecResult(null);
    setCurrentError(null);
    setVoiceMode('available');
  };

  const handleGenerateSpec = () => {
    generateSpec();
  };

  if (!hasStarted) {
    return (
      <div className="app start-screen">
        <h1>Web Voice Planner</h1>
        <p>Design your next feature through conversation</p>
        <div className="start-form">
          <input
            type="text"
            value={featureName}
            onChange={(e) => setFeatureName(e.target.value)}
            placeholder="Feature name (e.g., user-onboarding)"
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
          <button onClick={handleStart} disabled={!featureName.trim()}>
            Start Session
          </button>
        </div>
        <StatusIndicator status={status} />
        <ErrorBanner error={currentError} onDismiss={dismissError} />
      </div>
    );
  }

  // Show spec completion screen
  if (specResult) {
    return (
      <div className="app">
        <header>
          <h1>Web Voice Planner</h1>
          <StatusIndicator status={status} />
        </header>
        <main>
          <ErrorBanner error={currentError} onDismiss={dismissError} />
          <SpecComplete
            specPath={specResult.path || '(save failed - copy content below)'}
            specContent={specResult.content}
            onNewSession={handleNewSession}
          />
          {specResult.saveError && (
            <p className="save-error-hint">
              The spec could not be saved to disk. Please copy the content above and save it manually.
            </p>
          )}
        </main>
      </div>
    );
  }

  const isVoiceDisabled = voiceMode === 'text-only' || permissionDenied;

  return (
    <div className="app">
      <header>
        <h1>Web Voice Planner</h1>
        <span className="session-name">{session?.slug}</span>
        <StatusIndicator status={status} />
      </header>

      <ErrorBanner error={currentError} onDismiss={dismissError} />

      <main>
        <ChatTranscript messages={messages} />

        <div className="input-area">
          <TextInput onSend={handleSendText} disabled={status !== 'connected'} />

          <MicButton
            isRecording={isRecording}
            isPlaying={isPlaying}
            permissionDenied={permissionDenied || isVoiceDisabled}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onStopSpeaking={handleStopSpeaking}
            disabled={status !== 'connected'}
          />
        </div>

        {voiceMode === 'text-only' && !permissionDenied && (
          <p className="text-mode-hint">
            Voice is temporarily unavailable. Using text mode.
          </p>
        )}

        {shouldShowGenerate && (
          <button className="generate-spec-btn" onClick={handleGenerateSpec}>
            Generate Specification
          </button>
        )}

        <button className="new-session-btn" onClick={handleNewSession}>
          New Session
        </button>
      </main>
    </div>
  );
}

export default App;
