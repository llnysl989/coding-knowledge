import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/taskService';
import { success } from '../utils/response';

export const taskController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const tasks = await taskService.list();
      res.json(success(tasks));
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await taskService.getById(req.params.id);
      res.json(success(task));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await taskService.create(req.body);
      res.status(201).json(success(task, 'created'));
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await taskService.update(req.params.id, req.body);
      res.json(success(task, 'updated'));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await taskService.remove(req.params.id);
      res.json(success(result, 'deleted'));
    } catch (err) {
      next(err);
    }
  },
};
