/** Dependency-free SVG charts. Rendered inline so they work in any context. */
import { useId } from 'react';

export interface Series {
  label: string;
  values: number[];
  color?: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

export function BarChart({
  labels,
  series,
  height = 150,
  unit = '',
  stacked = false,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  unit?: string;
  stacked?: boolean;
}) {
  const gid = useId().replace(/:/g, '');
  if (labels.length === 0 || series.length === 0) {
    return <div className="empty" style={{ padding: 18 }}>No data yet</div>;
  }
  const w = Math.max(280, labels.length * 46);
  const padL = 34;
  const padB = 22;
  const padT = 8;
  const innerH = height - padB - padT;
  const max = niceMax(
    stacked
      ? Math.max(...labels.map((_, i) => series.reduce((s, sr) => s + (sr.values[i] ?? 0), 0)))
      : Math.max(...series.flatMap((s) => s.values), 0),
  );
  const groupW = (w - padL) / labels.length;
  const barW = stacked ? Math.min(26, groupW * 0.6) : Math.min(18, (groupW * 0.72) / series.length);
  const palette = ['var(--accent)', 'var(--info)', 'var(--warn)', 'var(--ok)', 'var(--danger)'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`Bar chart: ${series.map((s) => s.label).join(', ')} across ${labels.length} periods`}
        style={{ display: 'block', minWidth: w }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL}
              x2={w}
              y1={padT + innerH * (1 - f)}
              y2={padT + innerH * (1 - f)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={padT + innerH * (1 - f) + 3.5}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-3)"
            >
              {fmtNum(max * f)}
            </text>
          </g>
        ))}
        {labels.map((label, i) => {
          const x0 = padL + groupW * i + groupW / 2;
          let acc = 0;
          return (
            <g key={label}>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = max > 0 ? (v / max) * innerH : 0;
                const x = stacked ? x0 - barW / 2 : x0 - (series.length * barW) / 2 + si * barW;
                const y = stacked ? padT + innerH - h - acc : padT + innerH - h;
                if (stacked) acc += h;
                return (
                  <rect
                    key={s.label}
                    x={x}
                    y={y}
                    width={Math.max(2, barW - 2)}
                    height={Math.max(v > 0 ? 1.5 : 0, h)}
                    rx="2"
                    fill={s.color ?? palette[si % palette.length]}
                    opacity={stacked ? 1 - si * 0.18 : 1}
                  >
                    <title>{`${label} · ${s.label}: ${v}${unit}`}</title>
                  </rect>
                );
              })}
              <text x={x0} y={height - 7} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">
                {label}
              </text>
            </g>
          );
        })}
        <defs>
          <clipPath id={`${gid}-clip`}>
            <rect x={padL} y={0} width={w - padL} height={height} />
          </clipPath>
        </defs>
      </svg>
      {series.length > 1 && (
        <div className="row-wrap" style={{ marginTop: 6, gap: 12 }}>
          {series.map((s, si) => (
            <span key={s.label} className="row" style={{ gap: 5, fontSize: 11, color: 'var(--text-3)' }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: s.color ?? palette[si % palette.length],
                  opacity: stacked ? 1 - si * 0.18 : 1,
                  display: 'inline-block',
                }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function LineChart({
  labels,
  series,
  height = 160,
  yFormat = (v: number) => `${Math.round(v * 100)}%`,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yFormat?: (v: number) => string;
}) {
  if (labels.length < 2 || series.length === 0) {
    return <div className="empty" style={{ padding: 18 }}>Need at least two data points</div>;
  }
  const w = Math.max(280, labels.length * 52);
  const padL = 40;
  const padB = 22;
  const padT = 10;
  const innerH = height - padB - padT;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0) || 1);
  const step = (w - padL) / Math.max(1, labels.length - 1);
  const palette = ['var(--accent)', 'var(--info)', 'var(--warn)', 'var(--ok)'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`Line chart: ${series.map((s) => s.label).join(', ')}`}
        style={{ display: 'block', minWidth: w }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL}
              x2={w}
              y1={padT + innerH * (1 - f)}
              y2={padT + innerH * (1 - f)}
              stroke="var(--border)"
            />
            <text x={padL - 6} y={padT + innerH * (1 - f) + 3.5} textAnchor="end" fontSize="9" fill="var(--text-3)">
              {yFormat(max * f)}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? palette[si % palette.length];
          const pts = s.values.map((v, i) => {
            const x = padL + step * i;
            const y = padT + innerH * (1 - (max > 0 ? v / max : 0));
            return `${x},${y}`;
          });
          return (
            <g key={s.label}>
              <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={padL + step * i} cy={padT + innerH * (1 - (max > 0 ? v / max : 0))} r="2.6" fill={color}>
                  <title>{`${labels[i]} · ${s.label}: ${yFormat(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={l} x={padL + step * i} y={height - 7} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function Sparkline({
  values,
  width = 92,
  height = 26,
  color = 'var(--accent)',
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${height - ((v - min) / span) * (height - 3) - 1.5}`);
  return (
    <svg width={width} height={height} role="img" aria-label={`Trend of ${values.length} points`}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * step} cy={height - ((values[values.length - 1] - min) / span) * (height - 3) - 1.5} r="2.2" fill={color} />
    </svg>
  );
}

export function FunnelBar({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="stack" style={{ gap: 7 }}>
      {steps.map((s) => (
        <div key={s.label} className="row" style={{ gap: 10 }}>
          <span style={{ width: 128, fontSize: 12, color: 'var(--text-2)', flex: 'none' }}>{s.label}</span>
          <div style={{ flex: 1, height: 18, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(s.value > 0 ? 3 : 0, (s.value / max) * 100)}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 4,
                transition: 'width .25s ease',
              }}
            />
          </div>
          <span className="progress-num" style={{ minWidth: 40 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
