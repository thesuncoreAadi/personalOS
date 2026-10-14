import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysUntil,
  deadlineLabel,
  deadlineTone,
  diffDays,
  fmtDuration,
  isValidISO,
  startOfWeek,
  toISO,
} from '../date';

describe('date maths', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds months without overflowing the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', 6)).toBe('2026-07-15');
    expect(addMonths('2026-10-14', 3)).toBe('2027-01-14');
  });

  it('computes whole-day differences symmetrically', () => {
    expect(diffDays('2026-10-01', '2026-10-14')).toBe(13);
    expect(diffDays('2026-10-14', '2026-10-01')).toBe(-13);
    expect(diffDays('2026-10-14', '2026-10-14')).toBe(0);
  });

  it('validates ISO strings strictly', () => {
    expect(isValidISO('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isValidISO('2026-2-9')).toBe(false);
    expect(isValidISO('2026-02-28')).toBe(true);
    expect(isValidISO(undefined)).toBe(false);
  });

  it('finds the Monday-based start of week', () => {
    // 2026-10-14 is a Wednesday
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
  });

  it('round-trips a local date through toISO without timezone drift', () => {
    const d = new Date(2026, 9, 14, 1, 30);
    expect(toISO(d)).toBe('2026-10-14');
  });
});

describe('deadline labels and tones', () => {
  const now = new Date(2026, 9, 14); // 2026-10-14 local

  it('labels relative deadlines', () => {
    expect(deadlineLabel('2026-10-14', now)).toBe('due today');
    expect(deadlineLabel('2026-10-15', now)).toBe('due tomorrow');
    expect(deadlineLabel('2026-10-18', now)).toBe('in 4 days');
    expect(deadlineLabel('2026-10-11', now)).toBe('3 days overdue');
    expect(deadlineLabel('2026-10-13', now)).toBe('1 day overdue');
    expect(deadlineLabel(undefined, now)).toBe('no deadline');
  });

  it('classifies tone by urgency', () => {
    expect(deadlineTone('2026-10-11', now)).toBe('overdue');
    expect(deadlineTone('2026-10-15', now)).toBe('critical');
    expect(deadlineTone('2026-10-19', now)).toBe('soon');
    expect(deadlineTone('2026-11-20', now)).toBe('ok');
    expect(deadlineTone(undefined, now)).toBe('none');
  });

  it('counts days until from a fixed clock', () => {
    expect(daysUntil('2026-10-21', now)).toBe(7);
  });
});

describe('duration formatting', () => {
  it('formats minutes readably', () => {
    expect(fmtDuration(0)).toBe('0m');
    expect(fmtDuration(45)).toBe('45m');
    expect(fmtDuration(60)).toBe('1h');
    expect(fmtDuration(90)).toBe('1h 30m');
    expect(fmtDuration(-5)).toBe('0m');
  });
});
