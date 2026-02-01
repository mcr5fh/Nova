'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  code: string;
  diagramType?: string;
  className?: string;
}

interface MermaidError {
  message: string;
  hash?: string;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  code,
  diagramType,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize mermaid once
  useEffect(() => {
    if (!isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'monospace',
      });
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Render diagram when code or type changes
  useEffect(() => {
    if (!isInitialized || !containerRef.current || !code) {
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);

        // Generate a unique ID for each diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        // Validate and render the diagram
        const { svg } = await mermaid.render(id, code);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        const error = err as MermaidError;
        console.error('Mermaid rendering error:', error);

        // Extract meaningful error message
        let errorMessage = 'Invalid diagram syntax';
        if (error.message) {
          errorMessage = error.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }

        setError(errorMessage);

        // Clear the container on error
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    };

    renderDiagram();
  }, [code, diagramType, isInitialized]);

  if (error) {
    return (
      <div
        className={`mermaid-error border border-red-500 bg-red-50 p-4 rounded-md ${className}`}
        role="alert"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Diagram Rendering Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            {diagramType && (
              <div className="mt-2 text-xs text-red-600">
                Diagram type: {diagramType}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-container ${className}`}
      data-diagram-type={diagramType}
    />
  );
};

// Error boundary wrapper component
class MermaidErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MermaidRenderer error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="border border-red-500 bg-red-50 p-4 rounded-md" role="alert">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Component Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Failed to render diagram component</p>
                {this.state.error && (
                  <p className="mt-1 text-xs">{this.state.error.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export wrapped component with error boundary
export const MermaidRendererWithBoundary: React.FC<MermaidRendererProps> = (props) => (
  <MermaidErrorBoundary>
    <MermaidRenderer {...props} />
  </MermaidErrorBoundary>
);

export default MermaidRenderer;
