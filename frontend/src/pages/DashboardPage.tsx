import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../types';
import { emailService } from '../services/emailService';
import { Button } from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';

interface DashboardPageProps {
  user: User;
}

interface Stats {
  scheduled: number;
  sent: number;
  failed: number;
  processing: number;
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [scheduled, sent] = await Promise.all([
          emailService.getScheduledEmails(1, 1),
          emailService.getSentEmails(1, 1),
        ]);

        // We need to get actual totals across status types
        // scheduled endpoint returns scheduled+processing
        // sent endpoint returns sent+failed
        setStats({
          scheduled: scheduled.total,
          sent: sent.data.filter(e => e.status === 'sent').length,
          failed: sent.data.filter(e => e.status === 'failed').length,
          processing: 0,
        });
      } catch {
        setStats({ scheduled: 0, sent: 0, failed: 0, processing: 0 });
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Welcome back, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here's an overview of your email campaigns</p>
        </div>
        <Link to="/compose">
          <Button size="md">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose Email
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Scheduled"
          value={stats?.scheduled ?? 0}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Sent"
          value={stats?.sent ?? 0}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Failed"
          value={stats?.failed ?? 0}
          color="red"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Processing"
          value={stats?.processing ?? 0}
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          title="Schedule Emails"
          description="Upload a CSV and compose a new email campaign"
          to="/compose"
          icon="📧"
        />
        <QuickActionCard
          title="View Queue"
          description="Monitor BullMQ jobs in real-time"
          to="/admin/queues"
          external
          icon="📊"
        />
        <QuickActionCard
          title="Search Emails"
          description="Full-text search powered by Elasticsearch"
          to="/search"
          icon="🔍"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'yellow';
  icon: React.ReactNode;
}) {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={['w-10 h-10 rounded-xl flex items-center justify-center border', colorMap[color]].join(' ')}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-100">{value.toLocaleString()}</p>
    </div>
  );
}


function QuickActionCard({
  title,
  description,
  to,
  icon,
  external,
}: {
  title: string;
  description: string;
  to: string;
  icon: string;
  external?: boolean;
}) {
  const content = (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-all cursor-pointer group">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-200 group-hover:text-violet-400 transition-colors">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );

  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return <Link to={to}>{content}</Link>;
}
