import { useState, useEffect, useCallback, useRef } from 'react';
import { useNovaSession } from './hooks/useNovaSession';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useWhisperTranscription } from './hooks/useWhisperTranscription';
import { useHybridSpeechRecognition } from './hooks/useHybridSpeechRecognition';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { VoiceButton } from './components/VoiceButton';
import { ConversationView } from './components/ConversationView';
import { ProgressPanel } from './components/ProgressPanel';
import { ModeSelector } from './components/ModeSelector';
import type { VoiceState, SessionMode } from './types';
import './App.css';

// Speech recognition mode:
// - 'hybrid' (default): Web Speech API for real-time interim + Whisper for accurate final
// - 'whisper': Whisper only (no interim transcripts)
// - 'webspeech': Web Speech API only (faster but less accurate)
type SpeechMode = 'hybrid' | 'whisper' | 'webspeech';

const getSpeechMode = (): SpeechMode => {
  const mode = import.meta.env.VITE_SPEECH_MODE;
  if (mode === 'whisper' || mode === 'webspeech') {
    return mode;
  }
  // Legacy support: VITE_USE_WHISPER=false means webspeech mode
  if (import.meta.env.VITE_USE_WHISPER === 'false') {
    return 'webspeech';
  }
  // Default to hybrid mode
  return 'hybrid';
};

const SPEECH_MODE = getSpeechMode();

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

  // Hybrid speech recognition (Web Speech API for interim + Whisper for final)
  const {
    isListening: isHybridListening,
    isTranscribing: isHybridTranscribing,
    isSupported: isHybridSupported,
    interimTranscript: hybridInterimTranscript,
    start: startHybridListening,
    stop: stopHybridListening,
  } = useHybridSpeechRecognition({
    onFinalTranscript: (text) => {
      if (text.trim()) {
        setVoiceState('PROCESSING');
        sendMessage(text);
      } else {
        setVoiceState('IDLE');
      }
    },
    onError: (error) => {
      console.error('Hybrid transcription error:', error);
      setVoiceState('IDLE');
    },
  });

  // Web Speech API recognition (fallback/standalone mode)
  const {
    isListening: isWebSpeechListening,
    isSupported: isWebSpeechSupported,
    transcript: webSpeechTranscript,
    interimTranscript: webSpeechInterimTranscript,
    start: startWebSpeechListening,
    stop: stopWebSpeechListening,
  } = useSpeechRecognition({
    onSpeechEnd: (finalTranscript) => {
      if (SPEECH_MODE === 'webspeech' && finalTranscript.trim()) {
        setVoiceState('PROCESSING');
        sendMessage(finalTranscript);
      } else if (SPEECH_MODE === 'webspeech') {
        setVoiceState('IDLE');
      }
    },
  });

  // Whisper-only transcription (no interim transcripts)
  const {
    isRecording: isWhisperRecording,
    isTranscribing: isWhisperTranscribing,
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

  // Determine active transcription method based on mode
  const getActiveState = () => {
    switch (SPEECH_MODE) {
      case 'hybrid':
        return {
          isListening: isHybridListening,
          isTranscribing: isHybridTranscribing,
          isSupported: isHybridSupported,
          interimTranscript: hybridInterimTranscript,
          transcript: '', // Hybrid mode uses Whisper for final, no web speech transcript
          startListening: startHybridListening,
          stopListening: stopHybridListening,
          showRecordingIndicator: false, // Hybrid shows interim transcripts
        };
      case 'whisper':
        return {
          isListening: isWhisperRecording,
          isTranscribing: isWhisperTranscribing,
          isSupported: isWhisperSupported,
          interimTranscript: '',
          transcript: '',
          startListening: startWhisperRecording,
          stopListening: stopWhisperRecording,
          showRecordingIndicator: true, // Whisper-only shows "Recording..."
        };
      case 'webspeech':
        return {
          isListening: isWebSpeechListening,
          isTranscribing: false,
          isSupported: isWebSpeechSupported,
          interimTranscript: webSpeechInterimTranscript,
          transcript: webSpeechTranscript,
          startListening: startWebSpeechListening,
          stopListening: stopWebSpeechListening,
          showRecordingIndicator: false,
        };
    }
  };

  const activeState = getActiveState();
  const { isListening, isTranscribing, isSupported, interimTranscript, transcript, startListening, stopListening, showRecordingIndicator } = activeState;

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

  // Sync processing state (including transcribing)
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
    // Reset to IDLE when listening stops without triggering callback
    // Only for webspeech mode (hybrid and whisper handle this in their callbacks)
    if (SPEECH_MODE === 'webspeech' && !isListening && prevIsListeningRef.current && voiceState === 'LISTENING') {
      setVoiceState('IDLE');
    }
    prevIsListeningRef.current = isListening;
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

  // Determine what to show in the transcript area
  const getTranscriptDisplay = () => {
    if (showRecordingIndicator && isListening) {
      return 'Recording...';
    }
    if (interimTranscript) {
      return interimTranscript;
    }
    if (transcript) {
      return transcript;
    }
    return null;
  };

  const transcriptDisplay = getTranscriptDisplay();
  const isInterim = showRecordingIndicator || !!interimTranscript;

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

          {transcriptDisplay && (
            <div className={`app__transcript ${isInterim ? 'app__transcript--interim' : 'app__transcript--final'}`}>
              {transcriptDisplay}
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
          disabled={!isConnected || !isSupported || !mode}
        />
      </footer>
    </div>
  );
}
