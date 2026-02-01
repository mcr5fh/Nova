/**
 * ChatPanel - A resizable, collapsible right sidebar chat panel
 *
 * Features:
 * - Resizable width between 300-800px via drag handle
 * - Collapsible with toggle button
 * - Persists width and collapsed state in localStorage
 * - Smooth transitions for expand/collapse
 * - Responsive to window size
 */
'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';

interface ChatPanelProps {
  children?: ReactNode;
  isFullScreen?: boolean;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const STORAGE_KEY_WIDTH = 'chatPanelWidth';
const STORAGE_KEY_COLLAPSED = 'chatPanelCollapsed';

// Helper function to get initial width from localStorage
function getInitialWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;

  const savedWidth = localStorage.getItem(STORAGE_KEY_WIDTH);
  if (savedWidth) {
    const parsedWidth = parseInt(savedWidth, 10);
    if (!isNaN(parsedWidth)) {
      return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsedWidth));
    }
  }
  return DEFAULT_WIDTH;
}

// Helper function to get initial collapsed state from localStorage
function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;

  const savedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED);
  return savedCollapsed === 'true';
}

export function ChatPanel({ children, isFullScreen = false }: ChatPanelProps) {
  const [width, setWidth] = useState(getInitialWidth);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDTH, width.toString());
  }, [width]);

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, isCollapsed.toString());
  }, [isCollapsed]);

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = width;
  };

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new width (drag left increases width, drag right decreases width)
      const deltaX = resizeStartX.current - e.clientX;
      const newWidth = resizeStartWidth.current + deltaX;

      // Clamp width between min and max
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Toggle collapsed state
  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  const displayWidth = isCollapsed ? 0 : width;

  // Full screen mode overrides
  if (isFullScreen) {
    return (
      <div
        ref={panelRef}
        className="relative flex flex-col bg-bg-secondary overflow-hidden w-full h-full"
      >
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="relative flex flex-col bg-bg-secondary border-l border-border-color overflow-hidden"
      style={{
        width: `${displayWidth}px`,
        minWidth: `${displayWidth}px`,
        maxWidth: `${displayWidth}px`,
        transition: isResizing ? 'none' : 'width 0.2s ease-in-out',
      }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent transition-colors"
        style={{
          backgroundColor: isResizing ? 'var(--accent)' : 'transparent',
        }}
        onMouseDown={handleResizeStart}
      />

      {/* Toggle button - positioned on the left edge */}
      <button
        onClick={toggleCollapsed}
        className="absolute -left-8 top-4 w-8 h-8 bg-bg-secondary border border-border-color rounded-l flex items-center justify-center hover:bg-bg-tertiary transition-colors"
        aria-label={isCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}
      >
        <svg
          className="w-4 h-4 text-text-primary"
          style={{
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease-in-out',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Panel content */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}
