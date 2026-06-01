import { http } from './http';
import type { ApiResponse, Task, TaskInput } from '../types/task';

export async function getTasks(): Promise<Task[]> {
  const resp = await http.get<ApiResponse<Task[]>>('/tasks');
  return resp.data.data;
}

export async function getTaskById(id: number): Promise<Task> {
  const resp = await http.get<ApiResponse<Task>>(`/tasks/${id}`);
  return resp.data.data;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const payload = buildPayload(input);
  const resp = await http.post<ApiResponse<Task>>('/tasks', payload);
  return resp.data.data;
}

export async function updateTask(
  id: number,
  input: TaskInput
): Promise<Task> {
  const payload = buildPayload(input);
  const resp = await http.put<ApiResponse<Task>>(`/tasks/${id}`, payload);
  return resp.data.data;
}

export async function deleteTask(id: number): Promise<void> {
  await http.delete<ApiResponse<{ id: number }>>(`/tasks/${id}`);
}

function buildPayload(input: TaskInput) {
  return {
    title: input.title,
    description: input.description || null,
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
  };
}
