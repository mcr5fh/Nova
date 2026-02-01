interface Props {
  isRecording: boolean;
  isPlaying: boolean;
  permissionDenied: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopSpeaking: () => void;
  disabled: boolean;
}

export function MicButton({
  isRecording,
  isPlaying,
  permissionDenied,
  onStartRecording,
  onStopRecording,
  onStopSpeaking,
  disabled,
}: Props) {
  if (permissionDenied) {
    return (
      <div className="mic-denied">
        Microphone access denied. Please enable in browser settings.
      </div>
    );
  }

  if (isPlaying) {
    return (
      <button className="mic-button stop" onClick={onStopSpeaking}>
        Stop Speaking
      </button>
    );
  }

  return (
    <button
      className={`mic-button ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? onStopRecording : onStartRecording}
      disabled={disabled}
    >
      {isRecording ? 'Stop' : 'Speak'}
    </button>
  );
}
