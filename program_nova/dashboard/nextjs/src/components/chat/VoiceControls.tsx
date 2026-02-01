'use client';

interface VoiceControlsProps {
  onToggle: () => void;
  isActive: boolean;
  disabled: boolean;
  voiceState?: "listening" | "processing" | "speaking" | "idle";
  transcript?: string;
  agentResponse?: string;
}

export default function VoiceControls({
  onToggle,
  isActive,
  disabled,
  voiceState,
  transcript,
  agentResponse,
}: VoiceControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isActive
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-accent hover:opacity-90 text-text-primary"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={isActive ? "Stop voice mode" : "Start voice mode"}
      >
        {isActive ? (
          <span className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Stop Voice
          </span>
        ) : (
          <span className="flex items-center gap-2 justify-center">
            🎤 Start Voice
          </span>
        )}
      </button>

      {/* Voice state indicator - only shown when active */}
      {isActive && (
        <div className="text-sm text-text-secondary">
          {voiceState && (
            <div className="flex items-center gap-2">
              <span>State:</span>
              <span className="font-medium capitalize">{voiceState}</span>
            </div>
          )}

          {transcript && (
            <div className="mt-2">
              <span className="font-medium">You:</span> {transcript}
            </div>
          )}

          {agentResponse && (
            <div className="mt-2">
              <span className="font-medium">Agent:</span> {agentResponse}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
