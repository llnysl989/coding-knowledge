import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TaskForm } from '../components/TaskForm';
import {
  createTask,
  getTaskById,
  updateTask,
} from '../services/taskService';
import type { TaskInput } from '../types/task';

interface Props {
  mode: 'create' | 'edit';
}

const EMPTY: TaskInput = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
};

function toFormDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskFormPage({ mode }: Props) {
  const navigate = useNavigate();
  const params = useParams();
  const id = mode === 'edit' ? Number(params.id) : undefined;

  const [initial, setInitial] = useState<TaskInput>(EMPTY);
  const [ready, setReady] = useState(mode === 'create');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    (async () => {
      try {
        const task = await getTaskById(id);
        setInitial({
          title: task.title,
          description: task.description ?? '',
          status: task.status,
          priority: task.priority,
          dueDate: toFormDateTime(task.dueDate),
        });
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [mode, id]);

  async function handleSubmit(value: TaskInput) {
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'create') {
        await createTask(value);
      } else if (id) {
        await updateTask(id, value);
      }
      navigate('/tasks');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="container">
        <p>加载中...</p>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="container">
      <h1>{mode === 'create' ? '新增任务' : '编辑任务'}</h1>
      {error && <p className="error">{error}</p>}
      <TaskForm
        initialValue={initial}
        submitting={submitting}
        submitText={mode === 'create' ? '创建' : '保存'}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tasks')}
      />
    </div>
  );
}
