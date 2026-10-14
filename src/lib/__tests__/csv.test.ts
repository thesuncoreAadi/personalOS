import { describe, expect, it } from 'vitest';
import { headerIndex, numAt, parseCSV, strAt, toCSV } from '../csv';

describe('CSV parsing', () => {
  it('parses a simple table', () => {
    const rows = parseCSV('a,b\n1,2\n3,4');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles quoted fields containing commas, quotes and newlines', () => {
    const rows = parseCSV('hook,notes\n"He said ""hi""", "line one\nline two"\n');
    expect(rows[1][0]).toBe('He said "hi"');
    expect(rows[1][1]).toBe('line one\nline two');
  });

  it('normalises CRLF and drops blank lines', () => {
    const rows = parseCSV('a,b\r\n1,2\r\n\r\n3,4\r\n');
    expect(rows).toHaveLength(3);
  });

  it('round-trips values through toCSV', () => {
    const original = [
      ['date', 'views', 'notes'],
      ['2026-10-12', 1500, 'has, comma'],
      ['2026-10-19', 900, 'has "quotes"'],
    ];
    const parsed = parseCSV(toCSV(original));
    expect(parsed).toEqual(original.map((r) => r.map(String)));
  });
});

describe('CSV column access', () => {
  const header = ['Date', 'Views', 'Watch Time (minutes)', 'followers'];
  const map = headerIndex(header);

  it('normalises header names', () => {
    expect([...map.keys()]).toEqual(['date', 'views', 'watch_time_(minutes)', 'followers']);
  });

  it('reads numeric values, stripping formatting characters', () => {
    const row = ['2026-10-12', '1,500', '400', '2.1k'];
    expect(numAt(row, map, 'views')).toBe(1500);
    expect(numAt(row, map, 'followers')).toBe(2.1);
  });

  it('defaults missing columns safely', () => {
    expect(numAt(['x'], map, 'does_not_exist')).toBe(0);
    expect(strAt(['x'], map, 'does_not_exist')).toBe('');
  });
});
