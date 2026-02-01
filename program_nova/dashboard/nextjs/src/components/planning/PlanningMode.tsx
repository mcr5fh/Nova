"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function PlanningMode() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to Planning Mode! I'm here to help you define and structure your project. Tell me about what you'd like to build, and I'll help you break it down into epics and tasks.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Placeholder for future integration
    // TODO: Connect to planning API
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I understand. Let me help you with that. (This is a placeholder - real AI integration coming soon)",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-color px-6 py-4">
        <h1 className="text-2xl font-bold text-text-primary">Planning Mode</h1>
        <p className="text-sm text-text-secondary mt-1">
          Define your project structure and create epics
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                message.role === "user"
                  ? "bg-accent text-white"
                  : "bg-bg-secondary border border-border-color text-text-primary"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {message.content}
              </div>
              <div
                className={`text-xs mt-1 ${
                  message.role === "user"
                    ? "text-blue-100 opacity-80"
                    : "text-text-secondary"
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-bg-secondary border-t border-border-color px-6 py-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project or ask a question..."
            className="flex-1 px-4 py-3 bg-bg-tertiary border border-border-color text-text-primary placeholder-text-secondary rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            rows={3}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/80 disabled:bg-bg-tertiary disabled:text-text-secondary disabled:cursor-not-allowed transition-colors font-medium self-end"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-text-secondary mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
