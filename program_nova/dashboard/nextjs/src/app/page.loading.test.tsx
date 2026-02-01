/**
 * Tests for loading indicator integration in page component
 * Following TDD approach
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";
import * as hooks from "@/hooks";

// Mock the hooks module
vi.mock("@/hooks", () => ({
  useStatus: vi.fn(),
  useAgentChat: vi.fn(),
  useChatSession: vi.fn(),
}));

const mockUseStatus = hooks.useStatus as ReturnType<typeof vi.fn>;
const mockUseAgentChat = hooks.useAgentChat as ReturnType<typeof vi.fn>;
const mockUseChatSession = hooks.useChatSession as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockUseStatus.mockReturnValue({
    data: { all_tasks_completed: false },
    isLoading: false,
    error: null,
  });

  mockUseChatSession.mockReturnValue({
    sessionId: "test-session",
    clearSession: vi.fn(),
  });
});

// Mock the child components
vi.mock("@/components/layout", () => ({
  Header: () => <div>Header</div>,
  Breadcrumbs: () => <div>Breadcrumbs</div>,
  BackButton: () => <div>BackButton</div>,
  StatusIndicator: () => <div>StatusIndicator</div>,
}));

vi.mock("@/components/views", () => ({
  ViewRouter: () => <div>ViewRouter</div>,
}));

vi.mock("@/components/chat/ChatPanel", () => ({
  ChatPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chat-panel">{children}</div>
  ),
}));

vi.mock("@/components/chat/ChatHeader", () => ({
  ChatHeader: () => <div>ChatHeader</div>,
}));

vi.mock("@/components/chat/ChatMessages", () => ({
  ChatMessages: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="chat-messages" data-is-loading={isLoading}>
      ChatMessages
    </div>
  ),
}));

vi.mock("@/components/chat/ChatInput", () => ({
  default: () => <div>ChatInput</div>,
}));

describe("Home page - loading indicator integration", () => {
  it("should pass isLoading=false from useAgentChat to ChatMessages", () => {
    // Test with loading=false
    mockUseAgentChat.mockReturnValue({
      messages: [],
      isConnected: true,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
      isLoading: false,
    });

    render(<Home />);

    const chatMessages = screen.getByTestId("chat-messages");
    expect(chatMessages).toHaveAttribute("data-is-loading", "false");
  });

  it("should pass isLoading=true from useAgentChat to ChatMessages", () => {
    // Test with loading=true
    mockUseAgentChat.mockReturnValue({
      messages: [],
      isConnected: true,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
      isLoading: true,
    });

    render(<Home />);

    const chatMessages = screen.getByTestId("chat-messages");
    expect(chatMessages).toHaveAttribute("data-is-loading", "true");
  });
});
