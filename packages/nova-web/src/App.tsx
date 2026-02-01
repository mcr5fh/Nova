import { useState, useEffect, useCallback, useRef } from 'react';
import { useNovaSession } from './hooks/useNovaSession';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useWhisperTranscription } from './hooks/useWhisperTranscription';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { VoiceButton } from './components/VoiceButton';
import { ConversationView } from './components/ConversationView';
import { ProgressPanel } from './components/ProgressPanel';
import { ModeSelector } from './components/ModeSelector';
import type { VoiceState, SessionMode } from './types';
import './App.css';

// Use Whisper transcription by default, can be disabled via env var
const USE_WHISPER = import.meta.env.VITE_USE_WHISPER !== 'false';

export default function App() {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const prevIsListeningRef = useRef(false);

  const {
    connect,
    connectionState,
    isConnected,
    startSession,
    sessionId,
    mode,
    sendMessage,
    messages,
    currentResponse,
    isProcessing,
    progress,
  } = useNovaSession({
    onResponseComplete: (response) => {
      // Start speaking when response is complete
      speak(response);
      setVoiceState('SPEAKING');
    },
    onError: (error) => {
      console.error('Session error:', error);
      setVoiceState('IDLE');
    },
  });

  const { speak, stop: stopSpeaking, isSpeaking } = useTextToSpeech();

  // Web Speech API recognition (fallback)
  const {
    isListening: isWebSpeechListening,
    isSupported: isWebSpeechSupported,
    transcript: webSpeechTranscript,
    interimTranscript,
    start: startWebSpeechListening,
    stop: stopWebSpeechListening,
  } = useSpeechRecognition({
    onSpeechEnd: (finalTranscript) => {
      if (!USE_WHISPER && finalTranscript.trim()) {
        setVoiceState('PROCESSING');
        sendMessage(finalTranscript);
      } else if (!USE_WHISPER) {
        setVoiceState('IDLE');
      }
    },
  });

  // Whisper transcription (primary)
  const {
    isRecording: isWhisperRecording,
    isTranscribing,
    isSupported: isWhisperSupported,
    start: startWhisperRecording,
    stop: stopWhisperRecording,
  } = useWhisperTranscription({
    onTranscript: (text) => {
      if (text.trim()) {
        setVoiceState('PROCESSING');
        sendMessage(text);
      } else {
        setVoiceState('IDLE');
      }
    },
    onError: (error) => {
      console.error('Whisper transcription error:', error);
      setVoiceState('IDLE');
    },
  });

  // Determine which transcription method to use
  const useWhisper = USE_WHISPER && isWhisperSupported;
  const isListening = useWhisper ? isWhisperRecording : isWebSpeechListening;
  const isSpeechSupported = useWhisper ? isWhisperSupported : isWebSpeechSupported;
  const transcript = useWhisper ? '' : webSpeechTranscript; // Whisper doesn't provide interim transcripts

  const startListening = useCallback(() => {
    if (useWhisper) {
      startWhisperRecording();
    } else {
      startWebSpeechListening();
    }
  }, [useWhisper, startWhisperRecording, startWebSpeechListening]);

  const stopListening = useCallback(() => {
    if (useWhisper) {
      stopWhisperRecording();
    } else {
      stopWebSpeechListening();
    }
  }, [useWhisper, stopWhisperRecording, stopWebSpeechListening]);

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Sync speaking state
  useEffect(() => {
    if (!isSpeaking && voiceState === 'SPEAKING') {
      setVoiceState('IDLE');
    }
  }, [isSpeaking, voiceState]);

  // Sync processing state (including transcribing for Whisper)
  useEffect(() => {
    if ((isProcessing || isTranscribing) && voiceState !== 'PROCESSING') {
      setVoiceState('PROCESSING');
    }
  }, [isProcessing, isTranscribing, voiceState]);

  // Sync listening state
  useEffect(() => {
    if (isListening && voiceState !== 'LISTENING') {
      setVoiceState('LISTENING');
    }
    // Reset to IDLE when listening stops without triggering onSpeechEnd
    // (onSpeechEnd handles the case where there's a transcript)
    // Only reset if we were actually listening before (prevIsListeningRef.current === true)
    // to avoid resetting immediately after clicking the button but before recognition starts
    // For Whisper, don't reset to IDLE here - let the transcription callback handle it
    if (!useWhisper && !isListening && prevIsListeningRef.current && voiceState === 'LISTENING') {
      setVoiceState('IDLE');
    }
    prevIsListeningRef.current = isListening;
  }, [isListening, voiceState, useWhisper]);

  const handleVoiceButtonClick = useCallback(() => {
    switch (voiceState) {
      case 'IDLE':
        startListening();
        setVoiceState('LISTENING');
        break;
      case 'LISTENING':
        stopListening();
        break;
      case 'SPEAKING':
        stopSpeaking();
        setVoiceState('IDLE');
        break;
      case 'PROCESSING':
        // Cannot interrupt processing
        break;
    }
  }, [voiceState, startListening, stopListening, stopSpeaking]);

  const handleModeChange = useCallback(
    (newMode: SessionMode) => {
      if (isConnected) {
        startSession(newMode);
      }
    },
    [isConnected, startSession]
  );

  const getConnectionIndicatorClass = () => {
    if (connectionState === 'connected') return 'app__connection-indicator--connected';
    if (connectionState === 'connecting') return 'app__connection-indicator--connecting';
    return '';
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Nova</h1>
        <div className="app__connection">
          <div className={`app__connection-indicator ${getConnectionIndicatorClass()}`} />
          <span>{connectionState}</span>
          {sessionId && <span> | Session: {sessionId.slice(0, 8)}...</span>}
        </div>
      </header>

      <ModeSelector
        mode={mode}
        onModeChange={handleModeChange}
        disabled={!isConnected || isProcessing}
      />

      <main className="app__main">
        <div className="app__conversation-area">
          <ConversationView messages={messages} currentResponse={currentResponse} />

          {(transcript || interimTranscript || (useWhisper && isListening)) && (
            <div className={`app__transcript ${interimTranscript || (useWhisper && isListening) ? 'app__transcript--interim' : 'app__transcript--final'}`}>
              {useWhisper && isListening ? 'Recording...' : (interimTranscript || transcript)}
            </div>
          )}
        </div>

        <aside className="app__sidebar">
          <ProgressPanel dimensions={progress} />
        </aside>
      </main>

      <footer className="app__controls">
        <VoiceButton
          state={voiceState}
          onClick={handleVoiceButtonClick}
          disabled={!isConnected || !isSpeechSupported || !mode}
        />
      </footer>
    </div>
  );
}
