/**
 * Mock Trace Data for MVP Testing
 *
 * Provides realistic sample data for development without a running backend
 */

import type {
  TraceEvent,
  TracesResponse,
  TaskSummary,
  TaskTreeNode,
  SessionSummary,
} from '../types/api';

// ============================================================================
// Mock Trace Events
// ============================================================================

const now = Date.now();
const oneHourAgo = now - 3600000;
const twoHoursAgo = now - 7200000;

export const mockTraces: TraceEvent[] = [
  {
    span_id: 'span-001',
    trace_id: 'trace-001',
    parent_id: null,
    session_id: 'session-abc123',
    task_id: 'Nova-100',
    task_status: 'in_progress',
    timestamp: twoHoursAgo,
    duration_ms: 2000,
    event_type: 'post_tool_use',
    hook_type: 'PostToolUse',
    tool_name: 'Read',
    tool_input: {
      file_path: '/Users/test/project/src/auth.ts',
    },
    tool_output: {
      content: 'export const authenticate...',
    },
    metrics: {
      files_read: 1,
      input_tokens: 150,
      output_tokens: 80,
      estimated_cost: 0.015,
    },
    tags: {
      task_title: 'Implement Authentication',
    },
    metadata: {},
  },
  {
    span_id: 'span-002',
    trace_id: 'trace-001',
    parent_id: 'span-001',
    session_id: 'session-abc123',
    task_id: 'Nova-100',
    task_status: 'in_progress',
    timestamp: twoHoursAgo + 60000,
    duration_ms: 1500,
    event_type: 'post_tool_use',
    hook_type: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: {
      file_path: '/Users/test/project/src/auth.ts',
      old_string: 'const authenticate',
      new_string: 'export const authenticate',
    },
    tool_output: null,
    metrics: {
      files_edited: 1,
      input_tokens: 200,
      output_tokens: 120,
      estimated_cost: 0.020,
    },
    tags: {
      task_title: 'Implement Authentication',
    },
    metadata: {},
  },
  {
    span_id: 'span-003',
    trace_id: 'trace-001',
    parent_id: 'span-002',
    session_id: 'session-abc123',
    task_id: 'Nova-100',
    task_status: 'in_progress',
    timestamp: oneHourAgo,
    duration_ms: 5000,
    event_type: 'post_tool_use',
    hook_type: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: {
      command: 'npm test auth.test.ts',
    },
    tool_output: {
      stdout: 'PASS src/auth.test.ts\n✓ authenticates user (25ms)',
      exit_code: 0,
    },
    metrics: {
      input_tokens: 100,
      output_tokens: 50,
      estimated_cost: 0.010,
    },
    tags: {
      task_title: 'Implement Authentication',
    },
    metadata: {},
  },
];

// ============================================================================
// Mock Traces Response
// ============================================================================

export const mockTracesResponse: TracesResponse = {
  traces: mockTraces,
  total: mockTraces.length,
  limit: 100,
  offset: 0,
};

// ============================================================================
// Mock Task Summary
// ============================================================================

export const mockTaskSummary: TaskSummary = {
  task_id: 'Nova-100',
  parent_task_id: null,
  task_description: 'Implement Authentication System',
  status: 'in_progress',
  start_time: twoHoursAgo,
  end_time: null,
  duration_ms: now - twoHoursAgo,
  total_tokens: 700,
  total_cost: 0.045,
  tool_calls: 3,
  files_modified: 2,
};

// ============================================================================
// Mock Task Tree
// ============================================================================

export const mockTaskTree: TaskTreeNode = {
  task_id: 'Nova-100',
  parent_task_id: null,
  summary: mockTaskSummary,
  children: [
    {
      task_id: 'Nova-101',
      parent_task_id: 'Nova-100',
      summary: {
        task_id: 'Nova-101',
        parent_task_id: 'Nova-100',
        task_description: 'JWT Token Generation',
        status: 'completed',
        start_time: twoHoursAgo,
        end_time: twoHoursAgo + 2700000,
        duration_ms: 2700000,
        total_tokens: 15000,
        total_cost: 1.2,
        tool_calls: 12,
        files_modified: 3,
      },
      children: [],
    },
    {
      task_id: 'Nova-102',
      parent_task_id: 'Nova-100',
      summary: {
        task_id: 'Nova-102',
        parent_task_id: 'Nova-100',
        task_description: 'Login Endpoint',
        status: 'in_progress',
        start_time: oneHourAgo,
        end_time: null,
        duration_ms: now - oneHourAgo,
        total_tokens: 22000,
        total_cost: 1.8,
        tool_calls: 18,
        files_modified: 4,
      },
      children: [],
    },
  ],
};

// ============================================================================
// Mock Session Summary
// ============================================================================

export const mockSessionSummary: SessionSummary = {
  session_id: 'session-abc123',
  start_time: twoHoursAgo,
  end_time: null,
  duration_ms: now - twoHoursAgo,
  total_cost: 3.5,
  total_tokens: 45000,
  tool_calls: 42,
  files_modified: 12,
  errors: 3,
  tasks_completed: 5,
  tasks_in_progress: 2,
  tasks_failed: 1,
  tasks_pending: 3,
  top_tools: [
    {
      tool_name: 'Read',
      count: 15,
      total_cost: 0.5,
      total_tokens: 5000,
    },
    {
      tool_name: 'Edit',
      count: 12,
      total_cost: 1.2,
      total_tokens: 12000,
    },
    {
      tool_name: 'Bash',
      count: 8,
      total_cost: 0.8,
      total_tokens: 8000,
    },
    {
      tool_name: 'Task',
      count: 5,
      total_cost: 0.9,
      total_tokens: 18000,
    },
    {
      tool_name: 'Glob',
      count: 2,
      total_cost: 0.1,
      total_tokens: 2000,
    },
  ],
};

// ============================================================================
// Mock API Responses (for testing without backend)
// ============================================================================

export const mockAPI = {
  getTraces: () => Promise.resolve(mockTracesResponse),
  getTask: () => Promise.resolve({ task: mockTaskSummary }),
  getTaskTree: () => Promise.resolve(mockTaskTree),
  getSessionSummary: () => Promise.resolve(mockSessionSummary),
  healthCheck: () => Promise.resolve(true),
};
