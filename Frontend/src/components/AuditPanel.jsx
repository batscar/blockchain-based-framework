import React from 'react';
import { useWeb3 } from '../context/Web3Context';

const TYPE_COLOR = {
  success: 'var(--green)',
  error:   'var(--red)',
  warn:    'var(--amber)',
  info:    'var(--blue)',
};

export default function AuditPanel() {
  const { auditLog } = useWeb3();

  return (
    <aside style={{
      width: 300, flexShrink: 0,
      background: 'var(--navy-mid)',
      borderLeft: '1px solid var(--navy-border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--navy-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span className="eyebrow">Audit Log</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--green)',
            animation: 'pulseGreen 1.5s infinite',
          }} />
          <span style={{ fontSize: 11, color: 'var(--slate)' }}>Live</span>
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {auditLog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--slate-dim)' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              Events appear here as transactions confirm on-chain.
            </div>
          </div>
        ) : auditLog.map(entry => (
          <div
            key={entry.id}
            className="fade-in"
            style={{
              background: 'var(--navy)',
              border: '1px solid var(--navy-border)',
              borderLeft: `3px solid ${TYPE_COLOR[entry.type] || 'var(--slate)'}`,
              borderRadius: 6,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--white)', marginBottom: 3 }}>
              {entry.action}
            </div>
            <div style={{ fontSize: 11, color: 'var(--slate)' }}>{entry.meta}</div>
            <div style={{ fontSize: 10, color: 'var(--slate-dim)', marginTop: 4, fontFamily: 'var(--mono)' }}>
              {entry.time}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
