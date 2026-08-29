import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { exchangeSlackCode } from '../services/slackService';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function connectSlack(req: Request, res: Response): void {
  if (!env.SLACK_CLIENT_ID) {
    res.status(503).json({ message: 'Slack integration is not configured (missing SLACK_CLIENT_ID)' });
    return;
  }

  const scopes = 'chat:write,channels:read,groups:read,im:read,mpim:read';
  const state = (req.user as any).id; // Use userId as state for CSRF-like validation

  const slackAuthUrl =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${encodeURIComponent(env.SLACK_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(env.SLACK_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`;

  res.json({ url: slackAuthUrl });
}

export async function slackCallback(req: Request, res: Response): Promise<void> {
  const { code, state: userId, error } = req.query;
  const frontendUrl = env.FRONTEND_URL;

  if (error) {
    logger.warn('Slack OAuth error', { error });
    res.redirect(`${frontendUrl}/dashboard?slack_error=${error}`);
    return;
  }

  if (!code || !userId) {
    res.redirect(`${frontendUrl}/dashboard?slack_error=missing_params`);
    return;
  }

  try {
    const tokenData = await exchangeSlackCode(code as string);

    // Upsert Slack connection
    await prisma.slackConnection.upsert({
      where: { userId: userId as string },
      update: {
        accessToken: tokenData.accessToken,
        teamId: tokenData.teamId,
        teamName: tokenData.teamName,
        botUserId: tokenData.botUserId,
        channel: tokenData.incomingWebhookChannel ?? null,
        connected: true,
        updatedAt: new Date(),
      },
      create: {
        userId: userId as string,
        accessToken: tokenData.accessToken,
        teamId: tokenData.teamId,
        teamName: tokenData.teamName,
        botUserId: tokenData.botUserId,
        channel: tokenData.incomingWebhookChannel ?? null,
        connected: true,
      },
    });

    logger.info('Slack connected', { userId, teamId: tokenData.teamId });
    res.redirect(`${frontendUrl}/dashboard?slack_connected=true`);
  } catch (err) {
    logger.error('Slack callback error', { error: err });
    res.redirect(`${frontendUrl}/dashboard?slack_error=exchange_failed`);
  }
}

export async function disconnectSlack(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.user as any).id;

    const connection = await prisma.slackConnection.findUnique({ where: { userId } });

    if (connection) {
      // Revoke the token with Slack API
      try {
        await axios.post(
          'https://slack.com/api/auth.revoke',
          {},
          {
            headers: { Authorization: `Bearer ${connection.accessToken}` },
          }
        );
      } catch (revokeErr) {
        logger.warn('Failed to revoke Slack token with API (continuing anyway)', { revokeErr });
      }

      // Mark as disconnected in DB
      await prisma.slackConnection.update({
        where: { userId },
        data: { connected: false, updatedAt: new Date() },
      });
    }

    logger.info('Slack disconnected', { userId });
    res.json({ message: 'Slack disconnected successfully' });
  } catch (error) {
    logger.error('Slack disconnect failed', { error });
    res.status(500).json({ message: 'Failed to disconnect Slack' });
  }
}

export async function getSlackStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.user as any).id;
    const connection = await prisma.slackConnection.findUnique({ where: { userId } });

    res.json({
      connected: connection?.connected ?? false,
      teamName: connection?.teamName ?? null,
      channel: connection?.channel ?? null,
    });
  } catch (error) {
    logger.error('Get Slack status failed', { error });
    res.status(500).json({ message: 'Failed to get Slack status' });
  }
}
