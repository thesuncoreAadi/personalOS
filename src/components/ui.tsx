/** Shared UI primitives: layout, controls, feedback. No third-party component library. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconAlert, IconClose, IconInfo } from './icons';

/* ------------------------------ surfaces ------------------------------ */

export function Card({
  title,
  subtitle,
  actions,
  children,
  footer,
  className = '',
  bodyClass = '',
  as: As = 'section',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClass?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <As className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            {title && <h2>{title}</h2>}
            {subtitle && <span className="hint">{subtitle}</span>}
          </div>
          {actions && <div className="row" style={{ marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
      <div className={`card-body ${bodyClass}`}>{children}</div>
      {footer && <div className="card-foot">{footer}</div>}
    </As>
  );
}

/* ------------------------------ controls ------------------------------ */

type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'default',
  size,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'xs' }) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    variant === 'danger' ? 'btn-danger' : '',
    size === 'sm' ? 'btn-sm' : '',
    size === 'xs' ? 'btn-xs' : '',
    rest.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" {...rest} className={cls}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" {...rest} className={`icon-btn ${rest.className ?? ''}`} title={label} aria-label={label}>
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'plain',
  dot = false,
  title,
}: {
  children: ReactNode;
  tone?: 'plain' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';
  dot?: boolean;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone} ${dot ? 'badge-dot' : ''}`} title={title}>
      {children}
    </span>
  );
}

export function Progress({
  value,
  tone = 'accent',
  marker,
  label,
  showValue = true,
}: {
  value: number;
  tone?: 'accent' | 'ok' | 'warn' | 'danger';
  marker?: number;
  label?: string;
  showValue?: boolean;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="progress-row">
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(v * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'progress'}
        title={label}
      >
        <div className={`progress-fill ${tone === 'accent' ? '' : tone}`} style={{ width: `${v * 100}%` }} />
        {marker !== undefined && marker >= 0 && marker <= 1 && (
          <span className="progress-ghost" style={{ left: `${marker * 100}%` }} title="timeline elapsed" />
        )}
      </div>
      {showValue && <span className="progress-num">{Math.round(v * 100)}%</span>}
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Note({
  children,
  tone = 'info',
  title,
}: {
  children: ReactNode;
  tone?: 'info' | 'warn' | 'danger';
  title?: string;
}) {
  return (
    <div className={`note ${tone === 'info' ? '' : tone}`}>
      {title && <strong>{title} </strong>}
      {children}
    </div>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <div className="formula">{children}</div>;
}

/* ------------------------------ forms ------------------------------ */

interface ControlCtxValue {
  id: string;
  invalid?: boolean;
  describedBy?: string;
}
const ControlCtx = createContext<ControlCtxValue>({ id: '' });

export function Field({
  label,
  help,
  error,
  children,
  required,
  className = '',
}: {
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const describedBy = [help && !error ? helpId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <ControlCtx.Provider value={{ id, invalid: Boolean(error), describedBy }}>{children}</ControlCtx.Provider>
      {help && !error && (
        <span className="help" id={helpId}>
          {help}
        </span>
      )}
      {error && (
        <span className="error" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ctx = useContext(ControlCtx);
  return (
    <input
      {...props}
      id={props.id ?? ctx.id ?? undefined}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={props['aria-describedby'] ?? ctx.describedBy}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ctx = useContext(ControlCtx);
  return (
    <textarea
      {...props}
      id={props.id ?? ctx.id ?? undefined}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={props['aria-describedby'] ?? ctx.describedBy}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const ctx = useContext(ControlCtx);
  return (
    <select
      {...props}
      id={props.id ?? ctx.id ?? undefined}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={props['aria-describedby'] ?? ctx.describedBy}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ modal ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size,
  describedBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm';
  describedBy?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const nodes = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button');
      first?.focus();
    }, 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${size === 'sm' ? 'sm' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        ref={ref}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <div className="spacer" />
          <IconButton label="Close dialog" onClick={onClose}>
            <IconClose />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{message}</div>
    </Modal>
  );
}

/* ------------------------------ toasts ------------------------------ */

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone: 'info' | 'ok' | 'warn' | 'danger';
  action?: { label: string; run: () => void };
}

const ToastCtx = createContext<{ push: (t: Omit<ToastItem, 'id'>) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx).push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    window.clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      timers.current[id] = window.setTimeout(() => remove(id), t.action ? 9000 : 5200);
    },
    [remove],
  );

  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'danger' || t.tone === 'warn' ? <IconAlert size={15} /> : <IconInfo size={15} />}
            <div className="t-body">
              <div className="t-title">{t.title}</div>
              {t.body && <p>{t.body}</p>}
              {t.action && (
                <button
                  type="button"
                  className="btn btn-xs mt-8"
                  onClick={() => {
                    t.action!.run();
                    remove(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <IconButton label="Dismiss" onClick={() => remove(t.id)}>
              <IconClose size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ misc ------------------------------ */

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'plain'; label: string }> = {
    on_track: { tone: 'ok', label: 'On track' },
    at_risk: { tone: 'warn', label: 'At risk' },
    overdue: { tone: 'danger', label: 'Overdue' },
    completed: { tone: 'accent', label: 'Completed' },
    not_started: { tone: 'plain', label: 'Not started' },
    in_progress: { tone: 'info', label: 'In progress' },
    blocked: { tone: 'danger', label: 'Blocked' },
    archived: { tone: 'plain', label: 'Archived' },
    todo: { tone: 'plain', label: 'To do' },
    done: { tone: 'ok', label: 'Done' },
    dropped: { tone: 'plain', label: 'Dropped' },
  };
  const entry = map[status] ?? { tone: 'plain' as const, label: status };
  return <Badge tone={entry.tone} dot>{entry.label}</Badge>;
}

export function DeadlineChip({ label, tone }: { label: string; tone: string }) {
  const map: Record<string, 'ok' | 'warn' | 'danger' | 'plain'> = {
    ok: 'ok',
    soon: 'warn',
    critical: 'warn',
    overdue: 'danger',
    none: 'plain',
  };
  return <Badge tone={map[tone] ?? 'plain'}>{label}</Badge>;
}
