'use client';

import type { ServerEvent } from '@/types/chat';
import {
  isUserMessageEvent,
  isAgentMessageEvent,
  isToolCallEvent,
  isToolResultEvent,
  isAgentThinkingEvent,
  isErrorEvent,
  isDiagramUpdateEvent,
  isDiagramErrorEvent,
} from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './CodeBlock';

interface ChatMessageProps {
  event: ServerEvent;
}

/**
 * ChatMessage component renders different message types from the agent chat API
 * Supports: user_message, agent_message, tool_call, tool_result, agent_thinking, error
 */
export function ChatMessage({ event }: ChatMessageProps) {
  // User message - shown as user bubble
  if (isUserMessageEvent(event)) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-accent text-text-primary rounded-lg px-4 py-2">
          <div className="text-xs text-text-secondary mb-1">You</div>
          <div className="whitespace-pre-wrap">{event.message}</div>
        </div>
      </div>
    );
  }

  // Agent message - shown as agent bubble with markdown support
  if (isAgentMessageEvent(event)) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-bg-secondary text-text-primary rounded-lg px-4 py-2 border border-border-color">
          <div className="text-xs text-text-secondary mb-1">Agent</div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code(props) {
                  const { className, children, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || '');
                  const codeContent = String(children).replace(/\n$/, '');
                  const isInline = !match;

                  return !isInline && match ? (
                    <CodeBlock language={match[1]}>
                      {codeContent}
                    </CodeBlock>
                  ) : (
                    <code className="bg-bg-tertiary px-1 py-0.5 rounded text-sm" {...rest}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {event.message}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Tool call - shown as code block with tool name and args
  if (isToolCallEvent(event)) {
    let parsedArgs: object | null = null;
    try {
      parsedArgs = JSON.parse(event.tool_args);
    } catch {
      // If parsing fails, we'll show the raw string
    }

    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[90%] bg-bg-tertiary text-text-primary rounded-lg overflow-hidden border border-border-color">
          <div className="px-4 py-2 bg-bg-secondary border-b border-border-color">
            <div className="text-xs text-text-secondary">Tool Call</div>
            <div className="text-sm font-semibold text-accent">{event.tool_name}</div>
          </div>
          <div className="text-sm max-h-[7.5rem] overflow-y-auto">
            <CodeBlock language="json">
              {parsedArgs ? JSON.stringify(parsedArgs, null, 2) : event.tool_args}
            </CodeBlock>
          </div>
        </div>
      </div>
    );
  }

  // Tool result - shown with success/failure indicator
  if (isToolResultEvent(event)) {
    const statusColor = event.success ? 'text-status-completed' : 'text-status-failed';
    const statusText = event.success ? 'Success' : 'Failed';

    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[90%] bg-bg-tertiary text-text-primary rounded-lg overflow-hidden border border-border-color">
          <div className="px-4 py-2 bg-bg-secondary border-b border-border-color flex justify-between items-center">
            <div>
              <div className="text-xs text-text-secondary">Tool Result</div>
              <div className="text-sm font-semibold text-text-primary">{event.tool_name}</div>
            </div>
            <div className={`text-sm font-semibold ${statusColor}`}>{statusText}</div>
          </div>
          <div className="px-4 py-3 text-sm max-h-[7.5rem] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-mono text-text-secondary">{event.result}</pre>
          </div>
        </div>
      </div>
    );
  }

  // Agent thinking - shown as subtle info box
  if (isAgentThinkingEvent(event)) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-bg-secondary/50 text-text-secondary rounded-lg px-4 py-2 border border-border-color/50 italic">
          <div className="text-xs mb-1">Thinking...</div>
          <div className="text-sm whitespace-pre-wrap">{event.reasoning}</div>
        </div>
      </div>
    );
  }

  // Error - shown as error message
  if (isErrorEvent(event)) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-status-failed/10 text-status-failed rounded-lg px-4 py-2 border border-status-failed">
          <div className="text-xs font-semibold mb-1">Error</div>
          <div className="text-sm whitespace-pre-wrap">{event.error}</div>
        </div>
      </div>
    );
  }

  // Diagram update - shown as diagram visualization
  if (isDiagramUpdateEvent(event)) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[90%] bg-bg-secondary text-text-primary rounded-lg overflow-hidden border border-border-color">
          <div className="px-4 py-2 bg-bg-tertiary border-b border-border-color">
            <div className="text-xs text-text-secondary">Diagram Updated</div>
          </div>
          <div className="px-4 py-3">
            <div className="bg-bg-primary p-4 rounded border border-border-color">
              <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">
                {event.diagram}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Diagram error - shown as error message with diagram context
  if (isDiagramErrorEvent(event)) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-status-failed/10 text-status-failed rounded-lg px-4 py-2 border border-status-failed">
          <div className="text-xs font-semibold mb-1">Diagram Error</div>
          <div className="text-sm whitespace-pre-wrap">{event.error}</div>
        </div>
      </div>
    );
  }

  // Fallback for unknown event types (should never happen with proper types)
  return null;
}
