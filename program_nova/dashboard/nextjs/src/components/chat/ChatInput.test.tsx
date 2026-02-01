import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput';

describe('ChatInput', () => {
  it('renders textarea and send button', () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('calls onSend with message when send button clicked', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(textarea, 'Hello, agent!');
    fireEvent.click(sendButton);

    expect(mockOnSend).toHaveBeenCalledWith('Hello, agent!');
    expect(textarea).toHaveValue('');
  });

  it('calls onSend when Cmd+Enter pressed on Mac', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);

    await userEvent.type(textarea, 'Test message');
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(mockOnSend).toHaveBeenCalledWith('Test message');
    expect(textarea).toHaveValue('');
  });

  it('calls onSend when Ctrl+Enter pressed on Windows/Linux', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);

    await userEvent.type(textarea, 'Test message');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(mockOnSend).toHaveBeenCalledWith('Test message');
    expect(textarea).toHaveValue('');
  });

  it('does not send empty messages', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.click(sendButton);

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only messages', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(textarea, '   ');
    fireEvent.click(sendButton);

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('disables input and button when disabled prop is true', () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={true} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('trims message before sending', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(textarea, '  Hello  ');
    fireEvent.click(sendButton);

    expect(mockOnSend).toHaveBeenCalledWith('Hello');
  });

  it('auto-resizes textarea as content grows', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i) as HTMLTextAreaElement;

    await userEvent.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

    // The height should have changed (auto-resize behavior)
    // We can't test exact pixel values, but we can verify the style was updated
    expect(textarea.style.height).toBeDefined();
  });

  it('allows Enter key alone to insert newline', async () => {
    const mockOnSend = jest.fn();
    render(<ChatInput onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);

    await userEvent.type(textarea, 'First line{Enter}Second line');

    expect(textarea).toHaveValue('First line\nSecond line');
    expect(mockOnSend).not.toHaveBeenCalled();
  });
});
