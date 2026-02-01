'use client';

/**
 * DiagramPanel - Main container for managing and displaying diagrams
 *
 * Features:
 * - Manages state for flow, ERD, and system architecture diagrams
 * - Tab-based navigation between diagram types
 * - Visibility toggle to show/hide panel
 * - Loading and error state management
 * - WebSocket integration for diagram updates (placeholder)
 * - Integrates MermaidRenderer and DiagramTabs components
 */

import { useState, useEffect, useCallback } from 'react';
import MermaidRenderer from './MermaidRenderer';
import { DiagramTabs, DiagramType } from './DiagramTabs';
import type { ServerEvent } from '@/types/chat';
import { isDiagramUpdateEvent, isDiagramErrorEvent } from '@/types/chat';

interface DiagramState {
  code: string;
  loading: boolean;
  error: string | null;
}

interface DiagramPanelProps {
  /**
   * Optional className for styling
   */
  className?: string;

  /**
   * Initial visibility state
   * @default false
   */
  initialVisible?: boolean;

  /**
   * Initial active tab
   * @default 'flow'
   */
  initialTab?: DiagramType;

  /**
   * Optional WebSocket messages to listen to for diagram updates
   * Pass messages from useAgentChat hook
   */
  messages?: ServerEvent[];
}

const EMPTY_DIAGRAM: DiagramState = {
  code: '',
  loading: false,
  error: null,
};

export function DiagramPanel({
  className = '',
  initialVisible = false,
  initialTab = 'flow',
  messages = [],
}: DiagramPanelProps) {
  // State for each diagram type
  const [diagrams, setDiagrams] = useState<Record<DiagramType, DiagramState>>({
    flow: { ...EMPTY_DIAGRAM },
    erd: { ...EMPTY_DIAGRAM },
    system: { ...EMPTY_DIAGRAM },
  });

  // Active tab and visibility
  const [activeTab, setActiveTab] = useState<DiagramType>(initialTab);
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [processedMessageCount, setProcessedMessageCount] = useState(0);

  // Handle diagram updates from WebSocket messages
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Only process new messages
    const newMessages = messages.slice(processedMessageCount);
    if (newMessages.length === 0) return;

    // Process each new message
    newMessages.forEach((message) => {
      // Handle diagram_update event
      if (isDiagramUpdateEvent(message)) {
        const { diagram } = message;

        // TODO: Determine diagram type from the diagram string or add type to event
        // For now, update the active tab's diagram
        setDiagrams(prev => ({
          ...prev,
          [activeTab]: {
            code: diagram,
            loading: false,
            error: null,
          },
        }));
      }

      // Handle diagram_error event
      if (isDiagramErrorEvent(message)) {
        const { error } = message;

        setDiagrams(prev => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            loading: false,
            error,
          },
        }));
      }
    });

    // Update the count of processed messages
    setProcessedMessageCount(messages.length);
  }, [messages, activeTab, processedMessageCount]);

  // Toggle panel visibility
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  // Change active tab
  const handleTabChange = useCallback((tab: DiagramType) => {
    setActiveTab(tab);
  }, []);

  // Clear current diagram
  const handleClearDiagram = useCallback(() => {
    setDiagrams(prev => ({
      ...prev,
      [activeTab]: { ...EMPTY_DIAGRAM },
    }));
  }, [activeTab]);

  // Get current diagram state
  const currentDiagram = diagrams[activeTab];
  const hasDiagram = currentDiagram.code.length > 0;

  // Don't render if not visible
  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 bg-accent text-white px-4 py-2 rounded-md shadow-lg hover:bg-accent/90 transition-colors"
        aria-label="Show diagram panel"
      >
        Show Diagrams
      </button>
    );
  }

  return (
    <div
      className={`bg-bg-secondary border border-border-color rounded-lg shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-color">
        <h2 className="text-lg font-semibold text-text-primary">Diagrams</h2>
        <div className="flex items-center gap-2">
          {hasDiagram && (
            <button
              onClick={handleClearDiagram}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Clear current diagram"
            >
              Clear
            </button>
          )}
          <button
            onClick={toggleVisibility}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Hide diagram panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="p-4">
        <DiagramTabs activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Diagram content */}
      <div className="p-4">
        {currentDiagram.loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-text-secondary">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading diagram...</span>
            </div>
          </div>
        )}

        {currentDiagram.error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
            <p className="font-medium">Diagram Error</p>
            <p className="text-sm mt-1">{currentDiagram.error}</p>
          </div>
        )}

        {!currentDiagram.loading && !currentDiagram.error && hasDiagram && (
          <MermaidRenderer
            code={currentDiagram.code}
            diagramType={activeTab}
            className="min-h-[400px] max-h-[600px] overflow-auto"
          />
        )}

        {!currentDiagram.loading && !currentDiagram.error && !hasDiagram && (
          <div className="flex items-center justify-center py-8 text-text-secondary">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <p>No diagram to display</p>
              <p className="text-sm mt-1">
                Ask the agent to generate a {activeTab} diagram
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiagramPanel;
