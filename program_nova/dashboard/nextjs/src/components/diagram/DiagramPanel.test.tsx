import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiagramPanel from './DiagramPanel';
import type { DiagramUpdateEvent, DiagramErrorEvent } from '@/types/chat';

// Mock the MermaidRenderer component
vi.mock('./MermaidRenderer', () => ({
  default: ({ code, diagramType }: { code: string; diagramType: string }) => (
    <div data-testid="mermaid-renderer" data-diagram-type={diagramType}>
      {code}
    </div>
  ),
}));

// Mock the DiagramTabs component
vi.mock('./DiagramTabs', () => ({
  DiagramTabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="diagram-tabs">
      <button onClick={() => onTabChange('flow')}>Flow</button>
      <button onClick={() => onTabChange('erd')}>ERD</button>
      <button onClick={() => onTabChange('system')}>System</button>
      <span data-testid="active-tab">{activeTab}</span>
    </div>
  ),
}));

describe('DiagramPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render toggle button when not visible', () => {
    render(<DiagramPanel initialVisible={false} />);

    const toggleButton = screen.getByLabelText('Show diagram panel');
    expect(toggleButton).toBeTruthy();
    expect(toggleButton.textContent).toBe('Show Diagrams');
  });

  it('should show panel when toggle button is clicked', async () => {
    render(<DiagramPanel initialVisible={false} />);

    const showButton = screen.getByLabelText('Show diagram panel');
    fireEvent.click(showButton);

    await waitFor(() => {
      expect(screen.getByText('Diagrams')).toBeTruthy();
    });
  });

  it('should render panel header with title and controls', () => {
    render(<DiagramPanel initialVisible={true} />);

    expect(screen.getByText('Diagrams')).toBeTruthy();
    expect(screen.getByLabelText('Hide diagram panel')).toBeTruthy();
  });

  it('should render diagram tabs', () => {
    render(<DiagramPanel initialVisible={true} />);

    expect(screen.getByTestId('diagram-tabs')).toBeTruthy();
  });

  it('should show empty state when no diagram is present', () => {
    render(<DiagramPanel initialVisible={true} />);

    expect(screen.getByText('No diagram to display')).toBeTruthy();
    expect(screen.getByText(/Ask the agent to generate/)).toBeTruthy();
  });

  it('should change active tab when tab is clicked', async () => {
    render(<DiagramPanel initialVisible={true} initialTab="flow" />);

    const activeTab = screen.getByTestId('active-tab');
    expect(activeTab.textContent).toBe('flow');

    const erdButton = screen.getByText('ERD');
    fireEvent.click(erdButton);

    await waitFor(() => {
      expect(activeTab.textContent).toBe('erd');
    });
  });

  it('should render diagram when code is provided via messages', async () => {
    const diagramCode = 'graph TD\nA-->B';
    const diagramUpdate: DiagramUpdateEvent = {
      type: 'diagram_update',
      diagram: diagramCode,
    };

    const { rerender } = render(
      <DiagramPanel initialVisible={true} messages={[]} />
    );

    // Update with diagram message
    rerender(<DiagramPanel initialVisible={true} messages={[diagramUpdate]} />);

    await waitFor(() => {
      const renderer = screen.getByTestId('mermaid-renderer');
      expect(renderer).toBeTruthy();
      expect(renderer.textContent).toBe(diagramCode);
    });
  });

  it('should show error when diagram_error event is received', async () => {
    const errorMessage = 'Invalid diagram syntax';
    const diagramError: DiagramErrorEvent = {
      type: 'diagram_error',
      error: errorMessage,
    };

    const { rerender } = render(
      <DiagramPanel initialVisible={true} messages={[]} />
    );

    // Update with error message
    rerender(<DiagramPanel initialVisible={true} messages={[diagramError]} />);

    await waitFor(() => {
      expect(screen.getByText('Diagram Error')).toBeTruthy();
      expect(screen.getByText(errorMessage)).toBeTruthy();
    });
  });

  it('should show clear button when diagram is present', async () => {
    const diagramCode = 'graph TD\nA-->B';
    const diagramUpdate: DiagramUpdateEvent = {
      type: 'diagram_update',
      diagram: diagramCode,
    };

    render(<DiagramPanel initialVisible={true} messages={[diagramUpdate]} />);

    await waitFor(() => {
      const clearButton = screen.getByLabelText('Clear current diagram');
      expect(clearButton).toBeTruthy();
    });
  });

  it('should clear diagram when clear button is clicked', async () => {
    const diagramCode = 'graph TD\nA-->B';
    const diagramUpdate: DiagramUpdateEvent = {
      type: 'diagram_update',
      diagram: diagramCode,
    };

    render(<DiagramPanel initialVisible={true} messages={[diagramUpdate]} />);

    await waitFor(() => {
      const clearButton = screen.getByLabelText('Clear current diagram');
      fireEvent.click(clearButton);
    });

    await waitFor(() => {
      expect(screen.getByText('No diagram to display')).toBeTruthy();
    });
  });

  it('should hide panel when close button is clicked', async () => {
    render(<DiagramPanel initialVisible={true} />);

    const hideButton = screen.getByLabelText('Hide diagram panel');
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Show diagram panel')).toBeTruthy();
    });
  });

  it('should maintain separate state for each diagram type', async () => {
    const flowDiagram: DiagramUpdateEvent = {
      type: 'diagram_update',
      diagram: 'graph TD\nA-->B',
    };

    const { rerender } = render(
      <DiagramPanel initialVisible={true} initialTab="flow" messages={[]} />
    );

    // Add flow diagram
    rerender(
      <DiagramPanel
        initialVisible={true}
        initialTab="flow"
        messages={[flowDiagram]}
      />
    );

    await waitFor(() => {
      const renderer = screen.getByTestId('mermaid-renderer');
      expect(renderer.getAttribute('data-diagram-type')).toBe('flow');
    });

    // Switch to ERD tab - should show empty state
    const erdButton = screen.getByText('ERD');
    fireEvent.click(erdButton);

    await waitFor(() => {
      expect(screen.getByText('No diagram to display')).toBeTruthy();
    });

    // Switch back to flow - should still have diagram
    const flowButton = screen.getByText('Flow');
    fireEvent.click(flowButton);

    await waitFor(() => {
      const renderer = screen.getByTestId('mermaid-renderer');
      expect(renderer).toBeTruthy();
    });
  });

  it('should use custom className when provided', () => {
    const customClass = 'custom-panel-class';
    render(
      <DiagramPanel initialVisible={true} className={customClass} />
    );

    // The custom class is applied to the root container, not the header
    const panel = screen.getByText('Diagrams').closest('div')?.parentElement;
    expect(panel?.className).toContain(customClass);
  });
});
