import { useState } from 'react';
import { useSearchEmails } from '../hooks/useEmails';
import { EmailTable } from '../components/ui/EmailTable';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const { data, loading, error, search } = useSearchEmails();
  const [submitted, setSubmitted] = useState(false);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setPage(1);
    setSubmitted(true);
    search(query, 1, PAGE_SIZE);
  }

  function handlePageChange(p: number) {
    setPage(p);
    search(query, p, PAGE_SIZE);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Search Emails</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Full-text search powered by Elasticsearch
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Search query"
            placeholder="Search by recipient, subject, sender, or status…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" loading={loading} disabled={!query.trim()}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </Button>
      </form>

      {/* Results */}
      {submitted && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <PageLoader />
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              title="No results found"
              description={`No emails matching "${query}" in your account.`}
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-800 text-xs text-gray-500">
                {data.total} result{data.total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              </div>
              <EmailTable emails={data.data as any} type="sent" />
              <Pagination
                page={page}
                totalPages={data.totalPages}
                onPageChange={handlePageChange}
                total={data.total}
                pageSize={PAGE_SIZE}
              />
            </>
          )}
        </div>
      )}

      {!submitted && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-gray-600 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Enter a search term to find emails by recipient, subject, sender, or status</p>
        </div>
      )}
    </div>
  );
}
