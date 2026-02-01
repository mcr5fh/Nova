'use client';

import { useEffect, useRef } from 'react';
import type { ServerEvent } from '@/types/chat';
import { ChatMessage } from './ChatMessage';

interface ChatMessagesProps {
  messages: ServerEvent[];
  isLoading: boolean;
  autoScroll?: boolean;
}

export function ChatMessages({ messages, isLoading, autoScroll = true }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const renderMessage = (event: ServerEvent, index: number) => {
    return <ChatMessage key={index} event={event} />;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-2 bg-bg-primary"
    >
      {messages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-text-secondary text-sm text-center">
            No messages yet. Start a conversation!
          </div>
        </div>
      ) : (
        <>
          {messages.map((event, index) => renderMessage(event, index))}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="max-w-[80%] bg-bg-tertiary border border-border-color rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <span className="animate-bounce text-text-secondary" style={{ animationDelay: '0ms' }}>●</span>
                    <span className="animate-bounce text-text-secondary" style={{ animationDelay: '150ms' }}>●</span>
                    <span className="animate-bounce text-text-secondary" style={{ animationDelay: '300ms' }}>●</span>
                  </div>
                  <span className="text-sm text-text-secondary">Agent is typing...</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
