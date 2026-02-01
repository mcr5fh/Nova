import { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import './Chat.css';

export function Chat() {
  const { messages, isConnected, sendMessage } = useWebSocket('ws://localhost:8000/ws');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Agent Loop Chat</h1>
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.type}`}>
            {msg.type === 'user_message' && (
              <div className="user-message">
                <strong>You:</strong> {msg.message}
              </div>
            )}
            {msg.type === 'agent_message' && (
              <div className="agent-message">
                <strong>Agent:</strong> {msg.message}
              </div>
            )}
            {msg.type === 'tool_call' && (
              <div className="tool-call">
                <strong>🔧 Tool Call:</strong> {msg.tool_name}
                {msg.tool_args && <pre>{msg.tool_args}</pre>}
              </div>
            )}
            {msg.type === 'tool_result' && (
              <div className="tool-result">
                <strong>✓ Result:</strong>
                <pre>{msg.tool_result}</pre>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to do something..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected}>
          Send
        </button>
      </form>
    </div>
  );
}
