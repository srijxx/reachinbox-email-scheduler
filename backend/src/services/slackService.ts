import axios from 'axios';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const SLACK_API_BASE = 'https://slack.com/api';

/**
 * Sends a real Slack message using the stored access token for the user.
 * Uses Slack's chat.postMessage API.
 *
 * Error handling: Slack failures are logged but never throw to the caller.
 * Email processing must not fail because of a Slack issue.
 */
export async function sendSlackMessage(
  userId: string,
  message: string
): Promise<boolean> {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.connected || !connection.accessToken) {
      logger.info('No active Slack connection for user', { userId });
      return false;
    }

    const channel = connection.channel ?? '#general';

    const response = await axios.post(
      `${SLACK_API_BASE}/chat.postMessage`,
      {
        channel,
        text: message,
        mrkdwn: true,
      },
      {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    if (!response.data.ok) {
      logger.warn('Slack API returned error', {
        error: response.data.error,
        userId,
      });
      return false;
    }

    logger.info('Slack notification sent successfully', { userId, channel });
    return true;
  } catch (error) {
    logger.error('Slack message send failed', { userId, error });
    return false;
  }
}

/**
 * Sends a rate-limit notification to the Slack channel.
 * @param userId - the email campaign owner's user ID
 * @param sender - the sender email address that hit the limit
 * @param limit - the configured hourly limit
 * @param sentCount - how many were sent in this window
 */
export async function sendRateLimitNotification(
  userId: string,
  sender: string,
  limit: number,
  sentCount: number
): Promise<boolean> {
  const message =
    `⚠️ *ReachInbox rate limit reached.*\n\n` +
    `*Sender:* ${sender}\n` +
    `*Hourly limit:* ${limit}\n` +
    `*Emails sent in current window:* ${sentCount}\n\n` +
    `Remaining emails have been rescheduled to the next available hour.`;

  return sendSlackMessage(userId, message);
}

/**
 * Exchanges a Slack OAuth authorization code for an access token.
 */
export async function exchangeSlackCode(code: string): Promise<{
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  incomingWebhookChannel?: string;
}> {
  const params = new URLSearchParams({
    code,
    client_id: process.env.SLACK_CLIENT_ID ?? '',
    client_secret: process.env.SLACK_CLIENT_SECRET ?? '',
    redirect_uri: process.env.SLACK_REDIRECT_URI ?? '',
  });

  const response = await axios.post(
    `${SLACK_API_BASE}/oauth.v2.access`,
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  if (!response.data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${response.data.error}`);
  }

  return {
    accessToken: response.data.access_token,
    teamId: response.data.team?.id ?? '',
    teamName: response.data.team?.name ?? '',
    botUserId: response.data.bot_user_id ?? '',
    incomingWebhookChannel: response.data.incoming_webhook?.channel,
  };
}
