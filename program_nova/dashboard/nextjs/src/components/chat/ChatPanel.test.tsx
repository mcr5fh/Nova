/**
 * Tests for ChatPanel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from './ChatPanel';

// Mock localStorage
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

describe('ChatPanel', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('should render with default width when no stored width', () => {
    const { container } = render(<ChatPanel>Test Content</ChatPanel>);

    const panel = container.querySelector('.relative.flex.flex-col');
    expect(panel).toBeDefined();
    const style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('400px'); // DEFAULT_WIDTH
  });

  it('should render children when not collapsed', () => {
    render(
      <ChatPanel>
        <div>Chat Content</div>
      </ChatPanel>
    );

    expect(screen.getByText('Chat Content')).toBeDefined();
  });

  it('should not render children when collapsed', () => {
    mockStorage.setItem('chatPanelCollapsed', 'true');

    render(
      <ChatPanel>
        <div>Chat Content</div>
      </ChatPanel>
    );

    expect(screen.queryByText('Chat Content')).toBeNull();
  });

  it('should toggle collapsed state when button clicked', () => {
    const { container } = render(
      <ChatPanel>
        <div>Chat Content</div>
      </ChatPanel>
    );

    const toggleButton = screen.getByLabelText(/collapse chat panel/i);
    expect(screen.getByText('Chat Content')).toBeDefined();

    // Click to collapse
    fireEvent.click(toggleButton);

    // Content should be hidden
    expect(screen.queryByText('Chat Content')).toBeNull();

    // Panel width should be 0
    const panel = container.querySelector('.relative.flex.flex-col');
    const style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('0px');
  });

  it('should save collapsed state to localStorage', () => {
    render(<ChatPanel>Test</ChatPanel>);

    const toggleButton = screen.getByLabelText(/collapse chat panel/i);
    fireEvent.click(toggleButton);

    expect(mockStorage.setItem).toHaveBeenCalledWith('chatPanelCollapsed', 'true');
  });

  it('should restore width from localStorage', () => {
    mockStorage.setItem('chatPanelWidth', '500');

    const { container } = render(<ChatPanel>Test</ChatPanel>);

    const panel = container.querySelector('.relative.flex.flex-col');
    const style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('500px');
  });

  it('should restore collapsed state from localStorage', () => {
    mockStorage.setItem('chatPanelCollapsed', 'true');

    const { container } = render(
      <ChatPanel>
        <div>Test Content</div>
      </ChatPanel>
    );

    expect(screen.queryByText('Test Content')).toBeNull();

    const panel = container.querySelector('.relative.flex.flex-col');
    const style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('0px');
  });

  it('should clamp width to min/max when restoring from localStorage', () => {
    // Test width below minimum
    mockStorage.setItem('chatPanelWidth', '100');

    const { container, unmount } = render(<ChatPanel>Test</ChatPanel>);

    let panel = container.querySelector('.relative.flex.flex-col');
    let style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('300px'); // MIN_WIDTH

    unmount();

    // Test width above maximum
    mockStorage.clear();
    mockStorage.setItem('chatPanelWidth', '1000');

    const { container: container2 } = render(<ChatPanel>Test</ChatPanel>);

    panel = container2.querySelector('.relative.flex.flex-col');
    style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('800px'); // MAX_WIDTH
  });

  it('should render resize handle', () => {
    const { container } = render(<ChatPanel>Test</ChatPanel>);

    const resizeHandle = container.querySelector('.cursor-col-resize');
    expect(resizeHandle).toBeDefined();
  });

  it('should render toggle button with correct aria-label', () => {
    render(<ChatPanel>Test</ChatPanel>);

    const toggleButton = screen.getByLabelText(/collapse chat panel/i);
    expect(toggleButton).toBeDefined();
  });

  it('should update aria-label when collapsed', () => {
    mockStorage.setItem('chatPanelCollapsed', 'true');

    render(<ChatPanel>Test</ChatPanel>);

    const toggleButton = screen.getByLabelText(/expand chat panel/i);
    expect(toggleButton).toBeDefined();
  });

  it('should handle resize start on mouse down', () => {
    const { container } = render(<ChatPanel>Test</ChatPanel>);

    const resizeHandle = container.querySelector('.cursor-col-resize');
    expect(resizeHandle).toBeDefined();

    if (resizeHandle) {
      fireEvent.mouseDown(resizeHandle, { clientX: 100 });

      // Check that panel is in resizing state
      const style = (resizeHandle as HTMLElement).style;
      expect(style.backgroundColor).toBe('var(--accent)');
    }
  });

  it('should apply transition when not resizing', () => {
    const { container } = render(<ChatPanel>Test</ChatPanel>);

    const panel = container.querySelector('.relative.flex.flex-col');
    const style = (panel as HTMLElement)?.style;
    expect(style.transition).toContain('ease-in-out');
  });

  it('should handle invalid localStorage width value', () => {
    mockStorage.setItem('chatPanelWidth', 'invalid');

    const { container } = render(<ChatPanel>Test</ChatPanel>);

    const panel = container.querySelector('.relative.flex.flex-col');
    const style = (panel as HTMLElement)?.style;
    expect(style.width).toBe('400px'); // Should fall back to DEFAULT_WIDTH
  });

  it('should apply correct CSS classes', () => {
    const { container } = render(<ChatPanel>Test</ChatPanel>);

    const panel = container.querySelector('.relative.flex.flex-col');
    expect(panel?.classList.contains('bg-bg-secondary')).toBe(true);
    expect(panel?.classList.contains('border-l')).toBe(true);
    expect(panel?.classList.contains('border-border-color')).toBe(true);
  });
});
