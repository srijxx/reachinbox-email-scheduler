import { useState, useEffect } from 'react';
import type { SlackStatus } from '../types';
import { slackService } from '../services/slackService';
import { Button } from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export function SlackPage() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    slackService.getStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false, teamName: null, channel: null }))
      .finally(() => setLoading(false));

    // Check for redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack_connected') === 'true') {
      toast.success('Slack connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('slack_error')) {
      toast.error('Slack connection failed: ' + params.get('slack_error'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function handleConnect() {
    setActionLoading(true);
    try {
      await slackService.connectSlack();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to initiate Slack connection');
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    setActionLoading(true);
    try {
      await slackService.disconnectSlack();
      setStatus({ connected: false, teamName: null, channel: null });
      toast.success('Slack disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Slack Integration</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect Slack to receive rate-limit notifications
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          {/* Slack icon */}
          <div className="w-12 h-12 rounded-xl bg-[#4A154B] flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-100">Slack</h2>
              {status?.connected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-700">
                  Not connected
                </span>
              )}
            </div>

            {status?.connected ? (
              <div className="space-y-1 mb-4">
                {status.teamName && (
                  <p className="text-sm text-gray-400">
                    Workspace: <span className="text-gray-200">{status.teamName}</span>
                  </p>
                )}
                {status.channel && (
                  <p className="text-sm text-gray-400">
                    Channel: <span className="text-gray-200">{status.channel}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                Connect your Slack workspace to receive real-time notifications when a sender
                reaches their hourly rate limit.
              </p>
            )}

            {status?.connected ? (
              <Button
                variant="danger"
                size="sm"
                loading={actionLoading}
                onClick={handleDisconnect}
              >
                Disconnect Slack
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                onClick={handleConnect}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
                Connect Slack
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">What you'll get notified about</h3>
        <ul className="space-y-2">
          {[
            'When a sender reaches the hourly email limit',
            'How many emails were sent in the current window',
            'When excess emails have been rescheduled to the next hour',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
