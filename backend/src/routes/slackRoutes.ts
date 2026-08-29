import { Router } from 'express';
import {
  connectSlack,
  slackCallback,
  disconnectSlack,
  getSlackStatus,
} from '../controllers/slackController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/slack/connect - Get Slack OAuth URL
router.get('/connect', requireAuth, connectSlack);

// GET /api/slack/callback - Slack OAuth callback (no requireAuth — state param carries userId)
router.get('/callback', slackCallback);

// POST /api/slack/disconnect - Disconnect Slack
router.post('/disconnect', requireAuth, disconnectSlack);

// GET /api/slack/status - Get connection status
router.get('/status', requireAuth, getSlackStatus);

export default router;
