import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import type {
  UserMessageEvent,
  AgentMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  AgentThinkingEvent,
  ErrorEvent,
  DiagramUpdateEvent,
  DiagramErrorEvent,
} from '@/types/chat';

describe('ChatMessage', () => {
  describe('UserMessageEvent', () => {
    it('renders user message with correct styling', () => {
      const event: UserMessageEvent = {
        type: 'user_message',
        message: 'Hello agent',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Hello agent')).toBeInTheDocument();

      // Check for right-aligned layout
      const messageContainer = container.querySelector('.justify-end');
      expect(messageContainer).toBeInTheDocument();

      // Check for accent color
      const bubble = container.querySelector('.bg-accent');
      expect(bubble).toBeInTheDocument();
    });

    it('preserves whitespace in user messages', () => {
      const event: UserMessageEvent = {
        type: 'user_message',
        message: 'Line 1\nLine 2\n\nLine 3',
      };

      render(<ChatMessage event={event} />);

      const messageDiv = screen.getByText(/Line 1/);
      expect(messageDiv).toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('AgentMessageEvent', () => {
    it('renders agent message with correct styling', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'Hi! How can I help?',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();

      // Check for left-aligned layout
      const messageContainer = container.querySelector('.justify-start');
      expect(messageContainer).toBeInTheDocument();

      // Check for secondary background
      const bubble = container.querySelector('.bg-bg-secondary');
      expect(bubble).toBeInTheDocument();
    });
  });

  describe('ToolCallEvent', () => {
    it('renders tool call with valid JSON args', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{"query":"weather"}',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Tool Call')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();

      // Check that the code element contains the query and weather text
      const codeElement = container.querySelector('code');
      expect(codeElement?.textContent).toContain('query');
      expect(codeElement?.textContent).toContain('weather');
    });

    it('renders tool call with invalid JSON args', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        tool_name: 'CustomTool',
        tool_args: 'not valid json',
      };

      render(<ChatMessage event={event} />);

      expect(screen.getByText('Tool Call')).toBeInTheDocument();
      expect(screen.getByText('CustomTool')).toBeInTheDocument();
      expect(screen.getByText('not valid json')).toBeInTheDocument();
    });

    it('applies syntax highlighting to tool args', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{"query":"test"}',
      };

      const { container } = render(<ChatMessage event={event} />);

      // Check for syntax highlighter element
      const codeElement = container.querySelector('code');
      expect(codeElement).toBeInTheDocument();
    });
  });

  describe('ToolResultEvent', () => {
    it('renders successful tool result', () => {
      const event: ToolResultEvent = {
        type: 'tool_result',
        tool_name: 'Search',
        result: 'Sunny, 70F',
        success: true,
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Tool Result')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Sunny, 70F')).toBeInTheDocument();

      // Check for success color
      const statusElement = container.querySelector('.text-status-completed');
      expect(statusElement).toBeInTheDocument();
    });

    it('renders failed tool result', () => {
      const event: ToolResultEvent = {
        type: 'tool_result',
        tool_name: 'FailedTool',
        result: 'Error: Connection timeout',
        success: false,
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Tool Result')).toBeInTheDocument();
      expect(screen.getByText('FailedTool')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Error: Connection timeout')).toBeInTheDocument();

      // Check for failure color
      const statusElement = container.querySelector('.text-status-failed');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('AgentThinkingEvent', () => {
    it('renders agent thinking message', () => {
      const event: AgentThinkingEvent = {
        type: 'agent_thinking',
        reasoning: 'Planning tool usage...',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(screen.getByText('Planning tool usage...')).toBeInTheDocument();

      // Check for subtle styling
      const bubble = container.querySelector('.italic');
      expect(bubble).toBeInTheDocument();
    });
  });

  describe('ErrorEvent', () => {
    it('renders error message with error styling', () => {
      const event: ErrorEvent = {
        type: 'error',
        error: 'Empty message received',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Empty message received')).toBeInTheDocument();

      // Check for error colors
      const errorDiv = container.querySelector('.text-status-failed');
      expect(errorDiv).toBeInTheDocument();
      const errorBorder = container.querySelector('.border-status-failed');
      expect(errorBorder).toBeInTheDocument();
    });
  });

  describe('DiagramUpdateEvent', () => {
    it('renders diagram update with diagram content', () => {
      const event: DiagramUpdateEvent = {
        type: 'diagram_update',
        diagram: 'graph TD;\n    A-->B;\n    B-->C;',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Diagram Updated')).toBeInTheDocument();

      // Check for code/pre element with diagram content
      const preElement = container.querySelector('pre');
      expect(preElement).toBeInTheDocument();
      expect(preElement).toHaveClass('whitespace-pre-wrap');
      expect(preElement?.textContent).toBe('graph TD;\n    A-->B;\n    B-->C;');
    });

    it('renders diagram with proper styling', () => {
      const event: DiagramUpdateEvent = {
        type: 'diagram_update',
        diagram: 'graph LR; Start-->End;',
      };

      const { container } = render(<ChatMessage event={event} />);

      // Check for secondary background
      const bubble = container.querySelector('.bg-bg-secondary');
      expect(bubble).toBeInTheDocument();

      // Check for left-aligned layout
      const messageContainer = container.querySelector('.justify-start');
      expect(messageContainer).toBeInTheDocument();
    });
  });

  describe('DiagramErrorEvent', () => {
    it('renders diagram error message with error styling', () => {
      const event: DiagramErrorEvent = {
        type: 'diagram_error',
        error: 'Failed to parse Mermaid syntax',
      };

      const { container } = render(<ChatMessage event={event} />);

      expect(screen.getByText('Diagram Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to parse Mermaid syntax')).toBeInTheDocument();

      // Check for error colors
      const errorDiv = container.querySelector('.text-status-failed');
      expect(errorDiv).toBeInTheDocument();
      const errorBorder = container.querySelector('.border-status-failed');
      expect(errorBorder).toBeInTheDocument();
    });

    it('preserves whitespace in diagram error messages', () => {
      const event: DiagramErrorEvent = {
        type: 'diagram_error',
        error: 'Line 1\nLine 2\n\nLine 3',
      };

      render(<ChatMessage event={event} />);

      const messageDiv = screen.getByText(/Line 1/);
      expect(messageDiv).toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('Layout and responsiveness', () => {
    it('applies max-width constraints to messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'Test message',
      };

      const { container } = render(<ChatMessage event={event} />);

      const messageDiv = container.querySelector('.max-w-\\[80\\%\\]');
      expect(messageDiv).toBeInTheDocument();
    });

    it('applies proper spacing between messages', () => {
      const event: UserMessageEvent = {
        type: 'user_message',
        message: 'Test',
      };

      const { container } = render(<ChatMessage event={event} />);

      const messageContainer = container.querySelector('.mb-4');
      expect(messageContainer).toBeInTheDocument();
    });
  });

  describe('Markdown rendering in agent messages', () => {
    it('renders markdown bold text in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'This is **bold** text',
      };

      const { container } = render(<ChatMessage event={event} />);

      const strongElement = container.querySelector('strong');
      expect(strongElement).toBeInTheDocument();
      expect(strongElement?.textContent).toBe('bold');
    });

    it('renders markdown italic text in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'This is *italic* text',
      };

      const { container } = render(<ChatMessage event={event} />);

      const emElement = container.querySelector('em');
      expect(emElement).toBeInTheDocument();
      expect(emElement?.textContent).toBe('italic');
    });

    it('renders markdown code blocks in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: '```javascript\nconst x = 42;\n```',
      };

      const { container } = render(<ChatMessage event={event} />);

      const codeElement = container.querySelector('code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement?.textContent).toContain('const x = 42');
    });

    it('renders markdown inline code in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'Use the `useState` hook',
      };

      const { container } = render(<ChatMessage event={event} />);

      const codeElement = container.querySelector('code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement?.textContent).toBe('useState');
    });

    it('renders markdown links in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'Check out [React](https://react.dev)',
      };

      const { container } = render(<ChatMessage event={event} />);

      const linkElement = container.querySelector('a');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement?.textContent).toBe('React');
      expect(linkElement?.getAttribute('href')).toBe('https://react.dev');
    });

    it('renders markdown lists in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: '- Item 1\n- Item 2\n- Item 3',
      };

      const { container } = render(<ChatMessage event={event} />);

      const listElement = container.querySelector('ul');
      expect(listElement).toBeInTheDocument();
      const listItems = container.querySelectorAll('li');
      expect(listItems).toHaveLength(3);
    });

    it('renders markdown headings in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: '# Heading 1\n## Heading 2',
      };

      const { container } = render(<ChatMessage event={event} />);

      const h1Element = container.querySelector('h1');
      const h2Element = container.querySelector('h2');
      expect(h1Element).toBeInTheDocument();
      expect(h2Element).toBeInTheDocument();
    });

    it('does not render markdown in user messages', () => {
      const event: UserMessageEvent = {
        type: 'user_message',
        message: 'This is **not bold**',
      };

      const { container } = render(<ChatMessage event={event} />);

      const strongElement = container.querySelector('strong');
      expect(strongElement).not.toBeInTheDocument();
      expect(screen.getByText('This is **not bold**')).toBeInTheDocument();
    });
  });

  describe('Copy-to-clipboard for code blocks', () => {
    it('renders copy button for code blocks in agent messages', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: '```javascript\nconst x = 42;\n```',
      };

      render(<ChatMessage event={event} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('does not render copy button for inline code', () => {
      const event: AgentMessageEvent = {
        type: 'agent_message',
        message: 'Use the `useState` hook',
      };

      const { container } = render(<ChatMessage event={event} />);

      const copyButton = container.querySelector('button');
      expect(copyButton).not.toBeInTheDocument();
    });

    it('renders copy button for tool call code', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{"query":"test"}',
      };

      render(<ChatMessage event={event} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe('Tool call and result height constraints', () => {
    it('limits tool call content height to 5 lines with overflow scroll', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{"query":"test","filter":"active","sort":"date","limit":100}',
      };

      const { container } = render(<ChatMessage event={event} />);

      // Find the content div (the one containing the CodeBlock)
      const contentDiv = container.querySelector('.max-h-\\[7\\.5rem\\]');
      expect(contentDiv).toBeInTheDocument();
      expect(contentDiv).toHaveClass('overflow-y-auto');
    });

    it('limits tool result content height to 5 lines with overflow scroll', () => {
      const event: ToolResultEvent = {
        type: 'tool_result',
        tool_name: 'Search',
        result: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7',
        success: true,
      };

      const { container } = render(<ChatMessage event={event} />);

      // Find the content div (the one containing the result pre)
      const contentDiv = container.querySelector('.max-h-\\[7\\.5rem\\]');
      expect(contentDiv).toBeInTheDocument();
      expect(contentDiv).toHaveClass('overflow-y-auto');
    });
  });
});
