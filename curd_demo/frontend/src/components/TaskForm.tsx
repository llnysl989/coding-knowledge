import { FormEvent, useState } from 'react';
import type { TaskInput } from '../types/task';

interface Props {
  initialValue: TaskInput;
  submitting: boolean;
  submitText: string;
  onSubmit: (value: TaskInput) => void;
  onCancel: () => void;
}

export function TaskForm({
  initialValue,
  submitting,
  submitText,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<TaskInput>(initialValue);
  const [error, setError] = useState<string>('');

  function update<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('标题不能为空');
      return;
    }
    if (form.title.length > 100) {
      setError('标题最多 100 个字符');
      return;
    }
    setError('');
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label>标题 *</label>
        <input
          value={form.title}
          maxLength={100}
          onChange={(e) => update('title', e.target.value)}
        />
      </div>
      <div className="form-row">
        <label>描述</label>
        <textarea
          rows={4}
          value={form.description}
          maxLength={1000}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>
      <div className="form-row">
        <label>状态</label>
        <select
          value={form.status}
          onChange={(e) => update('status', e.target.value as TaskInput['status'])}
        >
          <option value="todo">todo</option>
          <option value="doing">doing</option>
          <option value="done">done</option>
        </select>
      </div>
      <div className="form-row">
        <label>优先级</label>
        <select
          value={form.priority}
          onChange={(e) =>
            update('priority', e.target.value as TaskInput['priority'])
          }
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </div>
      <div className="form-row">
        <label>截止时间</label>
        <input
          type="datetime-local"
          value={form.dueDate}
          onChange={(e) => update('dueDate', e.target.value)}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? '提交中...' : submitText}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}>
          取消
        </button>
      </div>
    </form>
  );
}
