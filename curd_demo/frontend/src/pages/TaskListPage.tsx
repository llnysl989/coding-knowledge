import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskTable } from '../components/TaskTable';
import { deleteTask, getTasks } from '../services/taskService';
import type { Task } from '../types/task';

export function TaskListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    if (!window.confirm('确认删除该任务?')) return;
    try {
      await deleteTask(id);
      await load();
    } catch (e) {
      alert('删除失败: ' + (e as Error).message);
    }
  }

  return (
    <div className="container">
      <div className="toolbar">
        <h1>任务列表</h1>
        <button className="primary" onClick={() => navigate('/tasks/new')}>
          + 新增任务
        </button>
      </div>

      {loading && <p>加载中...</p>}
      {error && <p className="error">{error}</p>}

      <TaskTable
        tasks={tasks}
        onEdit={(id) => navigate(`/tasks/${id}/edit`)}
        onDelete={handleDelete}
      />
    </div>
  );
}
