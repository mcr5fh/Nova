'use client';

interface ChatHeaderProps {
  isConnected: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClearChat: () => void;
}

export function ChatHeader({
  isConnected,
  isCollapsed,
  onToggleCollapse,
  onClearChat,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 pb-4 mb-4 border-b-2 border-border-color">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-text-primary">Agent Chat</h2>

        {/* Connection Status Indicator */}
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-status-completed' : 'bg-status-failed'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
          aria-label={isConnected ? 'Connected' : 'Disconnected'}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Clear Chat Button */}
        <button
          onClick={onClearChat}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
          aria-label="Clear chat"
        >
          Clear
        </button>

        {/* Collapse/Expand Button */}
        <button
          onClick={onToggleCollapse}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
          aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
        >
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>
    </header>
  );
}
