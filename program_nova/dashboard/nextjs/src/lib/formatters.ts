/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1h 23m 45s" or "5m 30s" or "45s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Formats a cost value in USD
 * @param cost - Cost in USD
 * @returns Formatted string like "$1.23" or "$0.05"
 */
export function formatCost(cost: number): string {
  if (cost < 0.01 && cost > 0) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Formats a number with locale-appropriate thousand separators
 * @param num - Number to format
 * @returns Formatted string like "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Formats token counts for display
 * @param tokens - Number of tokens
 * @returns Formatted string like "1.2K" or "1.5M" or "123"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Formats a percentage value
 * @param value - Number between 0 and 1 (or 0-100)
 * @param isDecimal - If true, value is 0-1; if false, value is 0-100
 * @returns Formatted string like "75.5%"
 */
export function formatPercentage(value: number, isDecimal = true): string {
  const percentage = isDecimal ? value * 100 : value;
  return `${percentage.toFixed(1)}%`;
}
