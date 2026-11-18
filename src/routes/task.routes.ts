import { Router } from 'express';
import {
  getManualTasksHandler,
  createManualTaskHandler,
  updateManualTaskHandler,
  deleteManualTaskHandler,
  getSubTasksHandler,
  createSubTaskHandler,
  updateSubTaskHandler,
  deleteSubTaskHandler,
  upsertTaskStatusOverrideHandler,
  getTaskStatusOverrideHandler,
  batchGetTaskStatusOverridesHandler,
  deleteTaskStatusOverrideHandler,
} from '../controllers/task.controller.js';
import { flexibleAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(flexibleAuthenticate);

router.get('/', getManualTasksHandler);
router.post('/', createManualTaskHandler);
router.patch('/:id', updateManualTaskHandler);
router.delete('/:id', deleteManualTaskHandler);

router.post('/status/batch', batchGetTaskStatusOverridesHandler);
router.get('/:taskId/status', getTaskStatusOverrideHandler);
router.patch('/:taskId/status', upsertTaskStatusOverrideHandler);
router.delete('/:taskId/status', deleteTaskStatusOverrideHandler);

router.get('/:taskId/subtasks', getSubTasksHandler);
router.post('/:taskId/subtasks', createSubTaskHandler);
router.patch('/:taskId/subtasks/:subtaskId', updateSubTaskHandler);
router.delete('/:taskId/subtasks/:subtaskId', deleteSubTaskHandler);

export default router;
