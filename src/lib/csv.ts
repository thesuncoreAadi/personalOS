/** Minimal RFC-4180-ish CSV parse/serialise. Handles quoted fields, embedded commas and newlines. */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let pendingSpace = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const pushField = () => {
    row.push(pendingSpace + field);
    pendingSpace = '';
    field = '';
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      // whitespace before an opening quote is a separator, not content
      if (field === '') pendingSpace = '';
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushField();
      rows.push(row);
      row = [];
    } else if ((ch === ' ' || ch === '\t') && field === '' && pendingSpace === '') {
      pendingSpace = ch;
    } else {
      field += ch;
    }
  }
  pushField();
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function toCSV(rows: (string | number | undefined | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell === undefined || cell === null ? '' : String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function headerIndex(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(h.trim().toLowerCase().replace(/\s+/g, '_'), i));
  return map;
}

export function numAt(row: string[], map: Map<string, number>, key: string): number {
  const i = map.get(key);
  if (i === undefined) return 0;
  const n = Number(String(row[i] ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function strAt(row: string[], map: Map<string, number>, key: string): string {
  const i = map.get(key);
  return i === undefined ? '' : String(row[i] ?? '').trim();
}
