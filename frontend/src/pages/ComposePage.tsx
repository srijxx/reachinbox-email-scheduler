import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { FileUploader } from '../components/ui/FileUploader';
import type { ParseResult } from '../utils/csvParser';
import { emailService } from '../services/emailService';
import type { ScheduleEmailRequest } from '../types';
import toast from 'react-hot-toast';

interface FormState {
  subject: string;
  body: string;
  sender: string;
  startTime: string;
  delayBetweenEmails: string;
  hourlyLimit: string;
}

interface FormErrors {
  subject?: string;
  body?: string;
  sender?: string;
  startTime?: string;
  delayBetweenEmails?: string;
  hourlyLimit?: string;
  recipients?: string;
}

// Default start time: 5 minutes from now
function defaultStartTime(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  // Format for datetime-local input: YYYY-MM-DDTHH:mm
  return d.toISOString().slice(0, 16);
}

export function ComposePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    subject: '',
    body: '',
    sender: '',
    startTime: defaultStartTime(),
    delayBetweenEmails: '2000',
    hourlyLimit: '200',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);

  function setField(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.body.trim()) errs.body = 'Body is required';
    if (!form.sender.trim()) errs.sender = 'Sender is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.sender)) errs.sender = 'Enter a valid email';
    if (!form.startTime) errs.startTime = 'Start time is required';
    else if (new Date(form.startTime).getTime() < Date.now() - 30_000)
      errs.startTime = 'Start time must be in the future';

    const delay = parseInt(form.delayBetweenEmails, 10);
    if (isNaN(delay) || delay < 0) errs.delayBetweenEmails = 'Must be >= 0';
    else if (delay > 3_600_000) errs.delayBetweenEmails = 'Must be <= 1 hour (3600000 ms)';

    const limit = parseInt(form.hourlyLimit, 10);
    if (isNaN(limit) || limit < 1) errs.hourlyLimit = 'Must be >= 1';
    else if (limit > 10000) errs.hourlyLimit = 'Must be <= 10000';

    if (!parseResult || parseResult.valid.length === 0)
      errs.recipients = 'Upload a CSV/TXT with at least one valid email address';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload: ScheduleEmailRequest = {
        subject: form.subject.trim(),
        body: form.body.trim(),
        sender: form.sender.trim(),
        recipients: parseResult!.valid,
        startTime: new Date(form.startTime).toISOString(),
        delayBetweenEmails: parseInt(form.delayBetweenEmails, 10),
        hourlyLimit: parseInt(form.hourlyLimit, 10),
      };

      const result = await emailService.scheduleEmails(payload);
      toast.success(result.message ?? `${result.scheduled} emails scheduled successfully`);
      navigate('/scheduled');
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Failed to schedule emails';
      const details = err.response?.data?.details;
      if (details) {
        const detailMsg = Object.entries(details)
          .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
          .join('\n');
        toast.error(`${message}\n${detailMsg}`);
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Compose Email Campaign</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Schedule bulk emails with BullMQ delayed jobs
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        {/* Email content */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Email Content
          </h2>
          <Input
            label="Subject"
            placeholder="e.g. Welcome to ReachInbox"
            value={form.subject}
            onChange={(e) => setField('subject', e.target.value)}
            error={errors.subject}
          />
          <Textarea
            label="Body (HTML or plain text)"
            placeholder="Hello {{name}},&#10;&#10;Welcome to our platform…"
            value={form.body}
            onChange={(e) => setField('body', e.target.value)}
            error={errors.body}
            rows={6}
          />
          <Input
            label="Sender Email"
            type="email"
            placeholder="sender@example.com"
            value={form.sender}
            onChange={(e) => setField('sender', e.target.value)}
            error={errors.sender}
          />
        </div>

        {/* Scheduling config */}
        <div className="space-y-4 pt-2 border-t border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pt-2">
            Scheduling Configuration
          </h2>
          <Input
            label="Start Time"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setField('startTime', e.target.value)}
            error={errors.startTime}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Delay Between Emails (ms)"
              type="number"
              min="0"
              max="3600000"
              placeholder="2000"
              value={form.delayBetweenEmails}
              onChange={(e) => setField('delayBetweenEmails', e.target.value)}
              error={errors.delayBetweenEmails}
              hint="Minimum ms between sends"
            />
            <Input
              label="Hourly Limit"
              type="number"
              min="1"
              max="10000"
              placeholder="200"
              value={form.hourlyLimit}
              onChange={(e) => setField('hourlyLimit', e.target.value)}
              error={errors.hourlyLimit}
              hint="Max emails per hour per sender"
            />
          </div>
        </div>

        {/* CSV upload */}
        <div className="space-y-3 pt-2 border-t border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pt-2">
            Recipients
          </h2>
          <FileUploader
            onParsed={(result) => {
              setParseResult(result);
              setErrors((e) => ({ ...e, recipients: undefined }));
            }}
          />

          {/* Parse results */}
          {parseResult && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-emerald-400">
                  {parseResult.valid.length} email address{parseResult.valid.length !== 1 ? 'es' : ''} detected
                </p>
              </div>
              {parseResult.invalid.length > 0 && (
                <p className="text-xs text-yellow-400 pl-6">
                  {parseResult.invalid.length} invalid address{parseResult.invalid.length !== 1 ? 'es' : ''} skipped
                </p>
              )}
            </div>
          )}

          {errors.recipients && (
            <p className="text-xs text-red-400">{errors.recipients}</p>
          )}
        </div>

        {/* Summary before submit */}
        {parseResult && parseResult.valid.length > 0 && (
          <div className="bg-violet-600/10 border border-violet-600/25 rounded-xl p-4 text-sm space-y-1">
            <p className="font-medium text-violet-400">Campaign summary</p>
            <p className="text-gray-400">
              <span className="text-gray-200">{parseResult.valid.length}</span> recipients ·
              starts <span className="text-gray-200">{new Date(form.startTime).toLocaleString()}</span>
            </p>
            <p className="text-gray-400">
              Delay: <span className="text-gray-200">{form.delayBetweenEmails}ms</span> ·
              Limit: <span className="text-gray-200">{form.hourlyLimit}/hr</span>
            </p>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={!parseResult || parseResult.valid.length === 0}
        >
          {loading
            ? 'Scheduling…'
            : parseResult && parseResult.valid.length > 0
            ? `Schedule ${parseResult.valid.length} Email${parseResult.valid.length !== 1 ? 's' : ''}`
            : 'Schedule Emails'}
        </Button>
      </form>
    </div>
  );
}
