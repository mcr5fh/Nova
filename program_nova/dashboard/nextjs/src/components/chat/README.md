# ChatMessages Component

A scrollable message list component for displaying agent chat conversations.

## Features

- **Auto-scroll**: Automatically scrolls to bottom when new messages arrive
- **Message Types**: Supports all WebSocket event types:
  - User messages
  - Agent responses with markdown rendering
  - Tool calls with syntax highlighting
  - Tool results (success/failure)
  - Agent thinking/reasoning
  - Error messages
- **Markdown Rendering**: Agent messages support full markdown including:
  - Bold, italic, and inline code
  - Code blocks with syntax highlighting
  - Links, lists, and headings
- **Copy-to-Clipboard**: Code blocks include a copy button for easy copying
- **Syntax Highlighting**: Code blocks use VS Code Dark Plus theme
- **Loading State**: Animated typing indicator while waiting for agent response
- **Empty State**: Friendly message when no messages exist
- **Responsive**: Uses Tailwind CSS for styling

## Usage

```tsx
import { ChatMessages } from '@/components/chat';
import type { ServerEvent } from '@/types/chat';

function ChatContainer() {
  const [messages, setMessages] = useState<ServerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <ChatMessages
      messages={messages}
      isLoading={isLoading}
      autoScroll={true} // optional, defaults to true
    />
  );
}
```

## Props

- `messages`: Array of `ServerEvent` objects to display
- `isLoading`: Boolean indicating if agent is processing
- `autoScroll`: Optional boolean to enable/disable auto-scroll (default: true)

## Message Styling

- **User messages**: Blue background, right-aligned
- **Agent messages**: Default theme background, left-aligned
- **Tool calls**: Purple accent, shows tool name and arguments
- **Tool results**: Green (success) or red (failure) accent
- **Agent thinking**: Yellow accent, italic text
- **Error messages**: Red accent, centered

## Testing

Type validation tests are available in `ChatMessages.test.tsx` which verify:
- Component accepts all required props
- Optional props work correctly
- All message types render without errors
- Loading and empty states function properly
