import type { ReactNode } from 'react';

export function ErrorBanner({
  message,
  details,
}: {
  message: string;
  details?: Record<string, string[]>;
}) {
  return (
    <div className="alert alert-error" role="alert">
      <strong>{message}</strong>
      {details && (
        <ul>
          {Object.entries(details).map(([field, messages]) => (
            <li key={field}>{messages.join(' ')}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        ✂
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="page-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge badge-${status.replace('_', '-')}`}>{label}</span>;
}
