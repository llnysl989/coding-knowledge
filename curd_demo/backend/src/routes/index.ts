import { Router } from 'express';
import taskRoutes from './taskRoutes';
import { success } from '../utils/response';

const router = Router();

router.get('/health', (_req, res) => {
  res.json(success({ status: 'ok' }));
});

router.use('/tasks', taskRoutes);

export default router;
