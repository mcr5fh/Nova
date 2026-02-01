import { useEffect, useRef } from 'react';
import type { ConversationEntry } from '../../../shared/types';

interface Props {
  messages: ConversationEntry[];
}

export function ChatTranscript({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="transcript empty">
        <p className="empty-state">
          Start a conversation by typing a message or clicking the Speak button.
        </p>
      </div>
    );
  }

  return (
    <div className="transcript">
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          <span className="role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
          <p>{msg.content}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
