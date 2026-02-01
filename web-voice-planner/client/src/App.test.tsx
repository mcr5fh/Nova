import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';

// Mock WebSocket
let mockWsInstance: MockWebSocket | null = null;

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();

  constructor() {
    mockWsInstance = this;
    // Call onopen synchronously for immediate connection
    queueMicrotask(() => this.onopen?.());
  }
}

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
    onended: null,
  }));
  decodeAudioData = vi.fn().mockResolvedValue({});
  destination = {};
  resume = vi.fn();
  close = vi.fn();
}

// Mock MediaRecorder
class MockMediaRecorder {
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start = vi.fn(() => {
    this.state = 'recording';
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });

  static isTypeSupported = vi.fn(() => true);
}

vi.stubGlobal('WebSocket', MockWebSocket);
vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('MediaRecorder', MockMediaRecorder);

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('renders the title', () => {
    render(<App />);
    expect(screen.getByText('Web Voice Planner')).toBeInTheDocument();
  });

  it('shows start screen with feature name input initially', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/feature name/i)).toBeInTheDocument();
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });

  it('shows start session button disabled when no feature name', () => {
    render(<App />);
    const button = screen.getByText('Start Session');
    expect(button).toBeDisabled();
  });

  it('enables start session button when feature name entered', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(input, { target: { value: 'test-feature' } });

    const button = screen.getByText('Start Session');
    expect(button).not.toBeDisabled();
  });

  it('transitions to main view when session started', () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(input, { target: { value: 'test-feature' } });

    const button = screen.getByText('Start Session');
    fireEvent.click(button);

    // Should no longer show start screen
    expect(screen.queryByText('Start Session')).not.toBeInTheDocument();
    // Should show main interface elements
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByText('Speak')).toBeInTheDocument();
  });

  it('shows empty state message when no messages', () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Start Session'));

    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
  });

  it('clears text input after sending', async () => {
    render(<App />);

    // Wait for WebSocket to connect
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Start session first
    const featureInput = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(featureInput, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Start Session'));

    // Type a message
    const messageInput = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(messageInput, { target: { value: 'Hello world' } });

    // Wait for the send button to be enabled
    await waitFor(() => {
      const sendButton = screen.getByText('Send');
      expect(sendButton).not.toBeDisabled();
    });

    // Click send
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);

    // Input should be cleared after send
    expect(messageInput).toHaveValue('');
  });

  it('renders speak button in main view', () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Start Session'));

    expect(screen.getByText('Speak')).toBeInTheDocument();
  });

  it('renders new session button in main view', () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Start Session'));

    expect(screen.getByText('New Session')).toBeInTheDocument();
  });
});
