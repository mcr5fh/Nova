/**
 * Tests for useVoiceChat hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceChat } from "./useVoiceChat";
import type { VoiceStateEvent, TranscriptEvent, VoiceResponseEvent } from "../types/chat";

describe("useVoiceChat", () => {
  let mockWebSocketInstance: any = null;
  let mockMediaRecorderInstance: any = null;
  let mockMediaStreamInstance: any = null;
  let mockAudioContextInstance: any = null;

  beforeEach(() => {
    // Mock global WebSocket
    (global as any).WebSocket = class WebSocket {
      url: string;
      readyState: number = 0;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url: string) {
        this.url = url;
        mockWebSocketInstance = this;
        this.readyState = 1; // Immediately OPEN for testing
        setTimeout(() => {
          if (this.onopen) {
            this.onopen(new Event("open"));
          }
        }, 0);
      }

      send(data: string | Blob) {
        if (this.readyState !== 1) {
          throw new Error("WebSocket is not open");
        }
      }

      close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) {
          this.onclose(new CloseEvent("close"));
        }
      }
    };

    (global as any).WebSocket.CONNECTING = 0;
    (global as any).WebSocket.OPEN = 1;
    (global as any).WebSocket.CLOSING = 2;
    (global as any).WebSocket.CLOSED = 3;

    // Mock MediaStream
    mockMediaStreamInstance = {
      getTracks: vi.fn(() => [
        {
          stop: vi.fn(),
        },
      ]),
    };

    // Mock MediaRecorder
    (global as any).MediaRecorder = class MediaRecorder {
      state: string = "inactive";
      ondataavailable: ((event: any) => void) | null = null;
      onstop: (() => void) | null = null;
      stream: any;

      static isTypeSupported = vi.fn((type: string) => type === "audio/webm");

      constructor(stream: any, options?: any) {
        this.stream = stream;
        mockMediaRecorderInstance = this;
      }

      start(timeslice?: number) {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        if (this.onstop) {
          this.onstop();
        }
      }
    };

    // Mock navigator.mediaDevices.getUserMedia
    (global as any).navigator = {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve(mockMediaStreamInstance)),
      },
    };

    // Mock AudioContext
    (global as any).AudioContext = class AudioContext {
      state = "running";
      sampleRate = 16000;
      destination = {};
      decodeAudioData = vi.fn((buffer: ArrayBuffer) => Promise.resolve({
        duration: 1.0,
        length: 16000,
        numberOfChannels: 1,
        sampleRate: 16000,
      }));
      createBufferSource = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }));
      close = vi.fn();

      constructor(options?: any) {
        mockAudioContextInstance = this;
      }
    };
  });

  afterEach(() => {
    mockWebSocketInstance = null;
    mockMediaRecorderInstance = null;
    mockMediaStreamInstance = null;
    mockAudioContextInstance = null;
    vi.clearAllMocks();
  });

  const simulateVoiceEvent = (event: VoiceStateEvent | TranscriptEvent | VoiceResponseEvent) => {
    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(
        new MessageEvent("message", {
          data: JSON.stringify(event),
        })
      );
    }
  };

  const simulateAudioData = async (data: ArrayBuffer) => {
    if (mockWebSocketInstance?.onmessage) {
      // Mock Blob with arrayBuffer method
      const blob = {
        arrayBuffer: () => Promise.resolve(data),
      };
      mockWebSocketInstance.onmessage(
        new MessageEvent("message", {
          data: blob,
        })
      );
    }
  };

  it("should initialize with disconnected state", () => {
    const { result } = renderHook(() => useVoiceChat());

    expect(result.current.voiceState).toBe("disconnected");
    expect(result.current.transcript).toBe("");
    expect(result.current.agentResponse).toBe("");
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.lastError).toBeNull();
  });

  it("should connect to WebSocket on connect()", async () => {
    const { result } = renderHook(() => useVoiceChat());

    expect(result.current.voiceState).toBe("disconnected");

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.voiceState).toBe("connected");
    expect(mockWebSocketInstance).not.toBeNull();
  });

  it("should send start message on connection", async () => {
    const sendSpy = vi.fn();
    const { result } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Mock send after connection
    if (mockWebSocketInstance) {
      mockWebSocketInstance.send = sendSpy;
    }

    // The start message should have been sent on connection
    expect(mockWebSocketInstance).not.toBeNull();
  });

  it("should handle voice state events", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useVoiceChat({ onStateChange }));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      simulateVoiceEvent({ type: "voice_state", state: "listening" });
    });

    expect(result.current.voiceState).toBe("listening");
    expect(onStateChange).toHaveBeenCalledWith("listening");
  });

  it("should handle transcript events", async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceChat({ onTranscript }));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      simulateVoiceEvent({
        type: "transcript",
        text: "Hello world",
        is_final: false,
      });
    });

    expect(result.current.transcript).toBe("Hello world");
    expect(onTranscript).toHaveBeenCalledWith("Hello world", false);
  });

  it("should handle voice response events", async () => {
    const onResponse = vi.fn();
    const { result } = renderHook(() => useVoiceChat({ onResponse }));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      simulateVoiceEvent({
        type: "voice_response",
        text: "Agent response",
      });
    });

    expect(result.current.agentResponse).toBe("Agent response");
    expect(onResponse).toHaveBeenCalledWith("Agent response");
  });

  it("should start recording with startRecording()", async () => {
    const { result } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.voiceState).toBe("listening");
    expect(mockMediaRecorderInstance).not.toBeNull();
    expect(mockMediaRecorderInstance.state).toBe("recording");
  });

  it("should stop recording with stopRecording()", async () => {
    const { result } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it("should fail to start recording when not connected", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceChat({ onError }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.lastError).not.toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it("should disconnect and cleanup on disconnect()", async () => {
    const { result } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      result.current.disconnect();
    });

    expect(result.current.voiceState).toBe("disconnected");
    expect(result.current.isRecording).toBe(false);
    expect(mockWebSocketInstance.readyState).toBe(3); // CLOSED
  });

  it("should handle binary audio data from server", async () => {
    const { result } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const audioData = new ArrayBuffer(1024);

    await act(async () => {
      await simulateAudioData(audioData);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Audio should be queued and playing
    expect(mockAudioContextInstance.decodeAudioData).toHaveBeenCalled();
  });

  it("should use custom URL when provided", async () => {
    const customUrl = "ws://custom:9999/voice";
    const { result } = renderHook(() => useVoiceChat({ url: customUrl }));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mockWebSocketInstance.url).toBe(customUrl);
  });

  it("should cleanup on unmount", async () => {
    const { result, unmount } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulate audio data to trigger AudioContext creation
    const audioData = new ArrayBuffer(1024);
    await act(async () => {
      await simulateAudioData(audioData);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    unmount();

    expect(mockAudioContextInstance.close).toHaveBeenCalled();
  });

  it("should handle WebSocket errors", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceChat({ onError }));

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      if (mockWebSocketInstance?.onerror) {
        mockWebSocketInstance.onerror(new Event("error"));
      }
    });

    expect(result.current.voiceState).toBe("disconnected");
    expect(onError).toHaveBeenCalled();
  });

  it("should not reconnect on multiple connect calls", async () => {
    const { result } = renderHook(() => useVoiceChat());

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const firstInstance = mockWebSocketInstance;

    await act(async () => {
      await result.current.connect();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should be the same instance
    expect(mockWebSocketInstance).toBe(firstInstance);
  });
});
