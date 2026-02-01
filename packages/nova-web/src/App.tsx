import { useState, useEffect, useCallback } from 'react';
import { useNovaSession } from './hooks/useNovaSession';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { VoiceButton } from './components/VoiceButton';
import { ConversationView } from './components/ConversationView';
import { ProgressPanel } from './components/ProgressPanel';
import { ModeSelector } from './components/ModeSelector';
import type { VoiceState, SessionMode } from './types';
import './App.css';

export default function App() {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');

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

  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    interimTranscript,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    onSpeechEnd: (finalTranscript) => {
      if (finalTranscript.trim()) {
        setVoiceState('PROCESSING');
        sendMessage(finalTranscript);
      } else {
        setVoiceState('IDLE');
      }
    },
  });

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

  // Sync processing state
  useEffect(() => {
    if (isProcessing && voiceState !== 'PROCESSING') {
      setVoiceState('PROCESSING');
    }
  }, [isProcessing, voiceState]);

  // Sync listening state
  useEffect(() => {
    if (isListening && voiceState !== 'LISTENING') {
      setVoiceState('LISTENING');
    }
  }, [isListening, voiceState]);

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

          {(transcript || interimTranscript) && (
            <div className={`app__transcript ${interimTranscript ? 'app__transcript--interim' : 'app__transcript--final'}`}>
              {interimTranscript || transcript}
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
