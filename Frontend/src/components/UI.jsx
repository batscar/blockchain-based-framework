import React from 'react';

export function Alert({ msg, type }) {
  if (!msg) return null;
  return <div className={`alert alert-${type} fade-in`}>{msg}</div>;
}

export function Spinner() {
  return <span className="spinner" />;
}

export function EmptyState({ icon, msg }) {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <div className="msg">{msg}</div>
    </div>
  );
}

export function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-key">{label}</span>
      <span className="info-value">{value ?? '—'}</span>
    </div>
  );
}

export function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: 'var(--slate)' }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Chip({ label, variant = 'slate' }) {
  return <span className={`chip chip-${variant}`}>{label}</span>;
}

export function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--mono)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--slate-dim)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
