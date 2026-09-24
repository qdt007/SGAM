import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatFileSize, mimeTypeIcon, isImage, getExtension } from '../utils/fileUtils';
import { isOverdue, dueDateLabel, durationFromMinutes, formatDate } from '../utils/dateUtils';
import { getElapsedSeconds } from '../stores/timerStore';

describe('formatFileSize', () => {
  it('handles an empty file', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('steps through the units', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});

describe('file type helpers', () => {
  it('labels the common types', () => {
    expect(mimeTypeIcon('image/png')).toBe('IMG');
    expect(mimeTypeIcon('application/pdf')).toBe('PDF');
    expect(mimeTypeIcon('application/octet-stream')).toBe('FILE');
  });

  it('detects images', () => {
    expect(isImage('image/jpeg')).toBe(true);
    expect(isImage('text/plain')).toBe(false);
  });

  it('reads the extension in upper case', () => {
    expect(getExtension('report.final.docx')).toBe('DOCX');
    expect(getExtension('noextension')).toBe('NOEXTENSION');
  });
});

describe('date helpers', () => {
  afterEach(() => vi.useRealTimers());

  // Local time throughout: these labels are about the viewer's calendar day,
  // so UTC literals would make the test depend on the machine's timezone.
  const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

  const freeze = (date: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  };

  it('treats yesterday as overdue but not today', () => {
    freeze(local(2026, 6, 15));
    expect(isOverdue(local(2026, 6, 14))).toBe(true);
    expect(isOverdue(local(2026, 6, 15, 9))).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });

  it('names the near dates instead of printing them', () => {
    freeze(local(2026, 6, 15));
    expect(dueDateLabel(local(2026, 6, 15, 18))).toBe('Today');
    expect(dueDateLabel(local(2026, 6, 16, 18))).toBe('Tomorrow');
    expect(dueDateLabel(null)).toBe('No due date');
  });

  it('counts overdue days', () => {
    freeze(local(2026, 6, 15));
    expect(dueDateLabel(local(2026, 6, 12))).toBe('3 days overdue');
  });

  it('formats a missing date as a dash', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('turns minutes into hours and minutes', () => {
    expect(durationFromMinutes(45)).toBe('45m');
    expect(durationFromMinutes(60)).toBe('1h');
    expect(durationFromMinutes(135)).toBe('2h 15m');
  });
});

describe('timer elapsed', () => {
  afterEach(() => vi.useRealTimers());

  it('counts seconds since the timer started', () => {
    const started = new Date('2026-06-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(started.getTime() + 330_000));
    expect(getElapsedSeconds(started.toISOString())).toBe(330);
  });
});
