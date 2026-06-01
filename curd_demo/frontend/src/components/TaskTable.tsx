import type { Task } from '../types/task';

interface Props {
  tasks: Task[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function TaskTable({ tasks, onEdit, onDelete }: Props) {
  if (tasks.length === 0) {
    return <p style={{ marginTop: 16 }}>暂无任务，点击右上角“新增任务”创建第一条。</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>标题</th>
          <th>状态</th>
          <th>优先级</th>
          <th>截止时间</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td>{task.id}</td>
            <td>{task.title}</td>
            <td>{task.status}</td>
            <td>{task.priority}</td>
            <td>{formatDate(task.dueDate)}</td>
            <td>{formatDate(task.createdAt)}</td>
            <td>
              <div className="actions">
                <button onClick={() => onEdit(task.id)}>编辑</button>
                <button className="danger" onClick={() => onDelete(task.id)}>
                  删除
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
