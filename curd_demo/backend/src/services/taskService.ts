import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorMiddleware';

const VALID_STATUS = ['todo', 'doing', 'done'];
const VALID_PRIORITY = ['low', 'medium', 'high'];

export interface TaskInput {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  dueDate?: unknown;
}

interface NormalizedTask {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
}

function normalizeAndValidate(input: TaskInput): NormalizedTask {
  const { title, description, status, priority, dueDate } = input;

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new AppError(4001, 'title is required');
  }
  if (title.length > 100) {
    throw new AppError(4002, 'title must be at most 100 characters');
  }

  let descriptionValue: string | null = null;
  if (description !== undefined && description !== null && description !== '') {
    if (typeof description !== 'string') {
      throw new AppError(4003, 'description must be a string');
    }
    if (description.length > 1000) {
      throw new AppError(4004, 'description must be at most 1000 characters');
    }
    descriptionValue = description;
  }

  if (typeof status !== 'string' || !VALID_STATUS.includes(status)) {
    throw new AppError(4005, `status must be one of ${VALID_STATUS.join(', ')}`);
  }

  if (typeof priority !== 'string' || !VALID_PRIORITY.includes(priority)) {
    throw new AppError(
      4006,
      `priority must be one of ${VALID_PRIORITY.join(', ')}`
    );
  }

  let dueDateValue: Date | null = null;
  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    if (typeof dueDate !== 'string') {
      throw new AppError(4007, 'dueDate must be an ISO string');
    }
    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      throw new AppError(4008, 'dueDate is not a valid date');
    }
    dueDateValue = parsed;
  }

  return {
    title: title.trim(),
    description: descriptionValue,
    status,
    priority,
    dueDate: dueDateValue,
  };
}

function parseId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(4009, 'invalid id');
  }
  return id;
}

export const taskService = {
  async list() {
    return prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async getById(rawId: string) {
    const id = parseId(rawId);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new AppError(4040, 'task not found', 404);
    }
    return task;
  },

  async create(input: TaskInput) {
    const data = normalizeAndValidate(input);
    return prisma.task.create({ data });
  },

  async update(rawId: string, input: TaskInput) {
    const id = parseId(rawId);
    const data = normalizeAndValidate(input);

    const exists = await prisma.task.findUnique({ where: { id } });
    if (!exists) {
      throw new AppError(4040, 'task not found', 404);
    }
    return prisma.task.update({ where: { id }, data });
  },

  async remove(rawId: string) {
    const id = parseId(rawId);
    const exists = await prisma.task.findUnique({ where: { id } });
    if (!exists) {
      throw new AppError(4040, 'task not found', 404);
    }
    await prisma.task.delete({ where: { id } });
    return { id };
  },
};
