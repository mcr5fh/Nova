import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VoiceControls from './VoiceControls';

describe('VoiceControls', () => {
  it('renders voice toggle button', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={false} />);

    expect(screen.getByRole('button', { name: /start voice/i })).toBeInTheDocument();
  });

  it('shows "Start Voice" text when inactive', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={false} />);

    expect(screen.getByText(/start voice/i)).toBeInTheDocument();
  });

  it('shows "Stop Voice" text when active', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={true} disabled={false} />);

    expect(screen.getByText(/stop voice/i)).toBeInTheDocument();
  });

  it('calls onToggle when button clicked', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={false} />);

    const button = screen.getByRole('button', { name: /start voice/i });
    fireEvent.click(button);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={true} />);

    const button = screen.getByRole('button', { name: /start voice/i });
    expect(button).toBeDisabled();
  });

  it('does not call onToggle when disabled button is clicked', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={true} />);

    const button = screen.getByRole('button', { name: /start voice/i });
    fireEvent.click(button);

    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it('applies correct styling when inactive', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={false} />);

    const button = screen.getByRole('button', { name: /start voice/i });
    expect(button).toHaveClass('bg-accent');
  });

  it('applies correct styling when active', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={true} disabled={false} />);

    const button = screen.getByRole('button', { name: /stop voice/i });
    expect(button).toHaveClass('bg-red-500');
  });

  it('shows voice state indicator when active', () => {
    const mockOnToggle = vi.fn();
    render(
      <VoiceControls
        onToggle={mockOnToggle}
        isActive={true}
        disabled={false}
        voiceState="listening"
      />
    );

    expect(screen.getByText(/listening/i)).toBeInTheDocument();
  });

  it('shows transcript when provided', () => {
    const mockOnToggle = vi.fn();
    render(
      <VoiceControls
        onToggle={mockOnToggle}
        isActive={true}
        disabled={false}
        transcript="Hello world"
      />
    );

    expect(screen.getByText(/Hello world/i)).toBeInTheDocument();
  });

  it('shows agent response when provided', () => {
    const mockOnToggle = vi.fn();
    render(
      <VoiceControls
        onToggle={mockOnToggle}
        isActive={true}
        disabled={false}
        agentResponse="I can help you"
      />
    );

    expect(screen.getByText(/I can help you/i)).toBeInTheDocument();
  });

  it('does not show voice state indicator when inactive', () => {
    const mockOnToggle = vi.fn();
    render(
      <VoiceControls
        onToggle={mockOnToggle}
        isActive={false}
        disabled={false}
        voiceState="listening"
      />
    );

    expect(screen.queryByText(/listening/i)).not.toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    const mockOnToggle = vi.fn();
    render(<VoiceControls onToggle={mockOnToggle} isActive={false} disabled={false} />);

    const button = screen.getByRole('button', { name: /start voice/i });
    expect(button).toHaveAttribute('aria-label');
  });
});
