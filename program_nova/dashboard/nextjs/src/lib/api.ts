import type { StatusResponse, Epic, TaskLogs, Task } from '@/types';

const API_BASE = '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchStatus(): Promise<StatusResponse> {
  return fetchJson<StatusResponse>(`${API_BASE}/status`);
}

export async function fetchTask(taskId: string): Promise<Task> {
  return fetchJson<Task>(`${API_BASE}/tasks/${encodeURIComponent(taskId)}`);
}

export async function fetchTaskLogs(taskId: string): Promise<TaskLogs> {
  return fetchJson<TaskLogs>(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/logs`);
}

export async function fetchEpics(): Promise<Epic[]> {
  return fetchJson<Epic[]>(`${API_BASE}/beads/epics`);
}

export async function fetchBeadStatus(epicId: string): Promise<StatusResponse> {
  return fetchJson<StatusResponse>(`${API_BASE}/beads/status/${encodeURIComponent(epicId)}`);
}

export async function startEpicExecution(epicId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/beads/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ epic_id: epicId }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
