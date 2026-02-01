interface Props {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export function StatusIndicator({ status }: Props) {
  const labels = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error',
  };

  return (
    <span className={`status-indicator ${status}`}>
      {labels[status]}
    </span>
  );
}
