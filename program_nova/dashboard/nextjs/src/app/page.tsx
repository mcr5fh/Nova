'use client';

import { useState } from 'react';
import { useStatus, useAgentChat, useChatSession } from '@/hooks';
import { Header, Breadcrumbs, BackButton, StatusIndicator } from '@/components/layout';
import { ViewRouter } from '@/components/views';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import ChatInput from '@/components/chat/ChatInput';

// WebSocket URL for agent chat - using hardcoded port 8001 for agent loop server
const AGENT_CHAT_WS_URL = 'ws://localhost:8001/ws';

export default function Home() {
  const { data: status, isLoading, error } = useStatus();
  const { sessionId, clearSession } = useChatSession();
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  // Setup agent chat WebSocket connection
  const {
    messages,
    isConnected: isChatConnected,
    sendMessage,
    clearMessages,
    isLoading: isChatLoading,
  } = useAgentChat(AGENT_CHAT_WS_URL, {
    session_id: sessionId,
    autoReconnect: true,
  });

  const allTasksCompleted = status?.all_tasks_completed ?? false;

  const handleClearChat = () => {
    clearMessages();
    clearSession();
  };

  const handleToggleChatCollapse = () => {
    setIsChatCollapsed(!isChatCollapsed);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-6">
          {/* Connection status indicator */}
          <StatusIndicator
            isConnected={!isLoading && !error}
            isCompleted={allTasksCompleted}
            isError={!!error}
          />

          {/* Header with project info and mode selector */}
          <Header status={status} />

          {/* Navigation breadcrumbs */}
          <Breadcrumbs />

          {/* Back button for nested views */}
          <BackButton />

          {/* Main content - view router switches between L0/L1/L2/L3 */}
          <ViewRouter
            status={status}
            isLoading={isLoading}
            error={error as Error | null}
          />
        </div>
      </main>

      {/* Chat panel - resizable sidebar on the right */}
      <ChatPanel>
        <div className="flex flex-col h-full p-4">
          <ChatHeader
            isConnected={isChatConnected}
            isCollapsed={isChatCollapsed}
            onToggleCollapse={handleToggleChatCollapse}
            onClearChat={handleClearChat}
          />
          <ChatMessages
            messages={messages}
            isLoading={isChatLoading}
            autoScroll={true}
          />
          <ChatInput
            onSend={sendMessage}
            disabled={!isChatConnected}
            placeholder="Ask the agent..."
          />
        </div>
      </ChatPanel>
    </div>
  );
}
