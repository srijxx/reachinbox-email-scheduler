import { useEffect, useState } from 'react';
import { useScheduledEmails } from '../hooks/useEmails';
import { EmailTable } from '../components/ui/EmailTable';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export function ScheduledEmailsPage() {
  const { data, loading, error, fetch } = useScheduledEmails();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetch(page, PAGE_SIZE);
  }, [page]);

  function handleRefresh() {
    fetch(page, PAGE_SIZE);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Scheduled Emails</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} emails in queue` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} loading={loading}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
          <Link to="/compose">
            <Button size="sm">+ New Campaign</Button>
          </Link>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            title="No scheduled emails"
            description="Start a new email campaign and your scheduled jobs will appear here."
            icon={
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            action={
              <Link to="/compose">
                <Button size="sm">Schedule Emails</Button>
              </Link>
            }
          />
        ) : (
          <>
            <EmailTable emails={data.data} type="scheduled" />
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
              total={data.total}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>
    </div>
  );
}
