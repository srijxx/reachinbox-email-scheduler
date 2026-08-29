import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmailsHandler,
  getSentEmailsHandler,
  searchEmailsHandler,
} from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All email routes require authentication
router.use(requireAuth);

// POST /api/emails/schedule
router.post('/schedule', scheduleEmails);

// GET /api/emails/scheduled
router.get('/scheduled', getScheduledEmailsHandler);

// GET /api/emails/sent
router.get('/sent', getSentEmailsHandler);

// GET /api/emails/search?q=...
router.get('/search', searchEmailsHandler);

export default router;
