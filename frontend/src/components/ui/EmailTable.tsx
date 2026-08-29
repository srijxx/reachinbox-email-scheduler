import type { Email } from '../../types';
import { StatusBadge } from './StatusBadge';
import { format } from 'date-fns';

interface EmailTableProps {
  emails: Email[];
  type: 'scheduled' | 'sent';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function EmailTable({ emails, type }: EmailTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Recipient
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Subject
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sender
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              {type === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            {type === 'sent' && (
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preview
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {emails.map((email) => (
            <tr key={email.id} className="hover:bg-gray-800/30 transition-colors">
              <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate" title={email.recipient}>
                {email.recipient}
              </td>
              <td className="px-4 py-3 text-gray-300 max-w-[220px] truncate" title={email.subject}>
                {email.subject}
              </td>
              <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate" title={email.sender}>
                {email.sender}
              </td>
              <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                {type === 'scheduled'
                  ? formatDate(email.scheduledAt)
                  : formatDate(email.sentAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={email.status} />
              </td>
              {type === 'sent' && (
                <td className="px-4 py-3">
                  {email.etherealPreviewUrl ? (
                    <a
                      href={email.etherealPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
                    >
                      View
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
