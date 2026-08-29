import { useState, useEffect } from 'react';
import type { User, SlackStatus } from '../types';
import { Button } from '../components/ui/Button';
import { slackService } from '../services/slackService';
import toast from 'react-hot-toast';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);

  useEffect(() => {
    slackService.getStatus().then(setSlack).catch(() => {});
  }, []);

  async function handleConnectSlack() {
    setSlackLoading(true);
    try {
      await slackService.connectSlack();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to connect Slack');
      setSlackLoading(false);
    }
  }

  async function handleDisconnectSlack() {
    setSlackLoading(true);
    try {
      await slackService.disconnectSlack();
      setSlack({ connected: false, teamName: null, channel: null });
      toast.success('Slack disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    } finally {
      setSlackLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await onLogout();
    } catch {
      // ignore
    }
  }

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between shrink-0">
      {/* Left: page context */}
      <div />

      {/* Right: Slack + user */}
      <div className="flex items-center gap-3">
        {/* Slack status */}
        {slack !== null && (
          <div className="flex items-center gap-2">
            {slack.connected ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Slack Connected {slack.teamName ? `· ${slack.teamName}` : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={slackLoading}
                  onClick={handleDisconnectSlack}
                  className="text-gray-500 hover:text-red-400"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={slackLoading}
                onClick={handleConnectSlack}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
                Connect Slack
              </Button>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-gray-800" />

        {/* User */}
        <div className="flex items-center gap-2.5">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full ring-2 ring-gray-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white">
              {user.name[0]}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-200 leading-none">{user.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </Button>
      </div>
    </header>
  );
}
