import { useEffect, useRef } from 'react';
import type { Message } from '../types';

interface ConversationViewProps {
  messages: Message[];
  currentResponse?: string;
}

export function ConversationView({ messages, currentResponse }: ConversationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  return (
    <div className="conversation-view" ref={containerRef}>
      {messages.length === 0 && !currentResponse && (
        <div className="conversation-view__empty">
          Start speaking to begin the conversation
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`conversation-view__message conversation-view__message--${message.role}`}
        >
          <div className="conversation-view__role">
            {message.role === 'user' ? 'You' : 'Nova'}
          </div>
          <div className="conversation-view__content">{message.content}</div>
        </div>
      ))}

      {currentResponse && (
        <div className="conversation-view__message conversation-view__message--assistant conversation-view__message--streaming">
          <div className="conversation-view__role">Nova</div>
          <div className="conversation-view__content">{currentResponse}</div>
        </div>
      )}
    </div>
  );
}
