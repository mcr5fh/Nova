/**
 * Tests for ConnectionStatus component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('should not render when connected', () => {
    const { container } = render(
      <ConnectionStatus
        connectionState="connected"
        isOnline={true}
        reconnectAttempts={0}
        lastError={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show offline message when not online', () => {
    render(
      <ConnectionStatus
        connectionState="disconnected"
        isOnline={false}
        reconnectAttempts={0}
        lastError={null}
      />
    );

    expect(screen.getByText('No internet connection')).toBeInTheDocument();
  });

  it('should show connecting state', () => {
    render(
      <ConnectionStatus
        connectionState="connecting"
        isOnline={true}
        reconnectAttempts={0}
        lastError={null}
      />
    );

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should show reconnecting state with attempt count', () => {
    render(
      <ConnectionStatus
        connectionState="reconnecting"
        isOnline={true}
        reconnectAttempts={2}
        maxReconnectAttempts={5}
        lastError={null}
      />
    );

    expect(screen.getByText(/Reconnecting\.\.\. \(attempt 2\/5\)/)).toBeInTheDocument();
  });

  it('should show disconnected state with retry button', () => {
    const onRetry = vi.fn();

    render(
      <ConnectionStatus
        connectionState="disconnected"
        isOnline={true}
        reconnectAttempts={0}
        lastError={null}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Disconnected from server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ConnectionStatus
        connectionState="disconnected"
        isOnline={true}
        reconnectAttempts={0}
        lastError={null}
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry connection/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should show connection failed message when max attempts reached', () => {
    render(
      <ConnectionStatus
        connectionState="disconnected"
        isOnline={true}
        reconnectAttempts={5}
        maxReconnectAttempts={5}
        lastError={new Event('error')}
      />
    );

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Unable to connect to the agent server')).toBeInTheDocument();
  });

  it('should show error message when lastError is provided', () => {
    render(
      <ConnectionStatus
        connectionState="disconnected"
        isOnline={true}
        reconnectAttempts={1}
        maxReconnectAttempts={5}
        lastError={new Event('error')}
      />
    );

    expect(screen.getByText('Unable to connect to the agent server')).toBeInTheDocument();
  });

  it('should not show retry button when onRetry is not provided', () => {
    render(
      <ConnectionStatus
        connectionState="disconnected"
        isOnline={true}
        reconnectAttempts={0}
        lastError={null}
      />
    );

    expect(screen.queryByRole('button', { name: /retry connection/i })).not.toBeInTheDocument();
  });
});
