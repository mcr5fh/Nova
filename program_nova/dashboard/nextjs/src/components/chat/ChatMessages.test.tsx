/**
 * Tests for ChatMessages component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessages } from './ChatMessages';
import type { ServerEvent } from '@/types/chat';

describe('ChatMessages', () => {
  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('should render empty state when no messages', () => {
    render(<ChatMessages messages={[]} isLoading={false} />);

    expect(screen.getByText(/No messages yet/i)).toBeDefined();
    expect(screen.getByText(/Start a conversation!/i)).toBeDefined();
  });

  it('should not show empty state when loading', () => {
    render(<ChatMessages messages={[]} isLoading={true} />);

    expect(screen.queryByText(/No messages yet/i)).toBeNull();
  });

  it('should render user messages', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'Hello, agent!' },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText('Hello, agent!')).toBeDefined();
  });

  it('should render agent messages', () => {
    const messages: ServerEvent[] = [
      { type: 'agent_message', message: 'Hello, how can I help?' },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText('Hello, how can I help?')).toBeDefined();
  });

  it('should render multiple messages in order', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'First message' },
      { type: 'agent_message', message: 'Second message' },
      { type: 'user_message', message: 'Third message' },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    const messageElements = screen.getAllByText(/message/i);
    expect(messageElements).toHaveLength(3);
  });

  it('should render loading indicator when isLoading is true', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'Test' },
    ];

    render(<ChatMessages messages={messages} isLoading={true} />);

    expect(screen.getByText(/Agent is typing/i)).toBeDefined();
  });

  it('should render tool call events', () => {
    const messages: ServerEvent[] = [
      {
        type: 'tool_call',
        tool_name: 'SearchDatabase',
        tool_args: '{"query":"test"}',
      },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText(/SearchDatabase/i)).toBeDefined();
  });

  it('should render tool result events', () => {
    const messages: ServerEvent[] = [
      {
        type: 'tool_result',
        tool_name: 'SearchDatabase',
        result: 'Found 5 results',
        success: true,
      },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText(/SearchDatabase/i)).toBeDefined();
    expect(screen.getByText(/Found 5 results/i)).toBeDefined();
  });

  it('should render agent thinking events', () => {
    const messages: ServerEvent[] = [
      {
        type: 'agent_thinking',
        reasoning: 'Analyzing the user request...',
      },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText(/Analyzing the user request/i)).toBeDefined();
  });

  it('should render error events', () => {
    const messages: ServerEvent[] = [
      {
        type: 'error',
        error: 'Connection timeout',
      },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText(/Connection timeout/i)).toBeDefined();
  });

  it('should call scrollIntoView on messages change when autoScroll is true', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'Test' },
    ];

    const { rerender } = render(
      <ChatMessages messages={messages} isLoading={false} autoScroll={true} />
    );

    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

    // Add a new message
    const updatedMessages: ServerEvent[] = [
      ...messages,
      { type: 'agent_message', message: 'Response' },
    ];

    rerender(
      <ChatMessages messages={updatedMessages} isLoading={false} autoScroll={true} />
    );

    expect(scrollSpy).toHaveBeenCalled();
  });

  it('should not scroll when autoScroll is false', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'Test' },
    ];

    const { rerender } = render(
      <ChatMessages messages={messages} isLoading={false} autoScroll={false} />
    );

    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    scrollSpy.mockClear(); // Clear any previous calls

    // Add a new message
    const updatedMessages: ServerEvent[] = [
      ...messages,
      { type: 'agent_message', message: 'Response' },
    ];

    rerender(
      <ChatMessages messages={updatedMessages} isLoading={false} autoScroll={false} />
    );

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('should handle mixed event types', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'Search for data' },
      { type: 'agent_thinking', reasoning: 'Planning search...' },
      { type: 'tool_call', tool_name: 'Search', tool_args: '{"q":"data"}' },
      { type: 'tool_result', tool_name: 'Search', result: 'Found results', success: true },
      { type: 'agent_message', message: 'Here are the results' },
    ];

    render(<ChatMessages messages={messages} isLoading={false} />);

    expect(screen.getByText('Search for data')).toBeDefined();
    expect(screen.getByText(/Planning search/i)).toBeDefined();
    expect(screen.getByText('Here are the results')).toBeDefined();
  });

  it('should apply correct CSS classes', () => {
    const messages: ServerEvent[] = [
      { type: 'user_message', message: 'Test' },
    ];

    const { container } = render(
      <ChatMessages messages={messages} isLoading={false} />
    );

    const chatContainer = container.querySelector('.overflow-y-auto');
    expect(chatContainer).toBeDefined();
    expect(chatContainer?.classList.contains('flex-1')).toBe(true);
    expect(chatContainer?.classList.contains('p-4')).toBe(true);
  });
});
