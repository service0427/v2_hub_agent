import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { validatePlatform, validateWorkflowRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { workflowService } from '../services/workflowService';
import { WorkflowRequest } from '../types';

const router = Router();

// Apply authentication
router.use(authenticateApiKey);

// Execute workflow
router.post('/:platform/execute',
  validatePlatform,
  validateWorkflowRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { workflow, params } = req.body;

    const request: WorkflowRequest = {
      platform: platform as any,
      workflow,
      params,
    };

    const result = await workflowService.executeWorkflow(request);
    res.json(result);
  })
);

// Get workflow status
router.get('/status/:workflowId', asyncHandler(async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const status = await workflowService.getWorkflowStatus(workflowId);

  res.json({
    success: true,
    data: status,
    timestamp: new Date(),
  });
}));

// Get available workflows
router.get('/available/:platform',
  validatePlatform,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const workflows = workflowService.getAvailableWorkflows(platform as any);

    res.json({
      success: true,
      data: workflows,
      timestamp: new Date(),
    });
  })
);

export default router;