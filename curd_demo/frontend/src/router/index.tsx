import { createBrowserRouter, Navigate } from 'react-router-dom';
import { TaskListPage } from '../pages/TaskListPage';
import { TaskFormPage } from '../pages/TaskFormPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/tasks" replace /> },
  { path: '/tasks', element: <TaskListPage /> },
  { path: '/tasks/new', element: <TaskFormPage mode="create" /> },
  { path: '/tasks/:id/edit', element: <TaskFormPage mode="edit" /> },
  { path: '*', element: <Navigate to="/tasks" replace /> },
]);
