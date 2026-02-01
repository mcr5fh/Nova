import type { VoiceState } from '../types';

interface VoiceButtonProps {
  state: VoiceState;
  onClick: () => void;
  disabled?: boolean;
}

const stateLabels: Record<VoiceState, string> = {
  IDLE: 'Click to speak',
  LISTENING: 'Listening...',
  PROCESSING: 'Processing...',
  SPEAKING: 'Speaking...',
};

const stateIcons: Record<VoiceState, string> = {
  IDLE: '🎤',
  LISTENING: '🔴',
  PROCESSING: '⏳',
  SPEAKING: '🔊',
};

export function VoiceButton({ state, onClick, disabled }: VoiceButtonProps) {
  return (
    <button
      className={`voice-button voice-button--${state.toLowerCase()}`}
      onClick={onClick}
      disabled={disabled || state === 'PROCESSING'}
      aria-label={stateLabels[state]}
    >
      <span className="voice-button__icon">{stateIcons[state]}</span>
      <span className="voice-button__label">{stateLabels[state]}</span>
    </button>
  );
}
