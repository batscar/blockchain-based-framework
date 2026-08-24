import React from 'react';

const NAV = [
  { section: 'Identity' },
  { id: 'identity', icon: '🪪', label: 'My Identity' },
  { id: 'rbac',     icon: '🛡', label: 'Roles & Access' },
  { section: 'Assets' },
  { id: 'assets',   icon: '🖼', label: 'Asset Dashboard' },
  { id: 'mint',     icon: '⚡', label: 'Mint NFT' },
  { section: "Dead Man's Switch" },
  { id: 'dms',      icon: '⏱', label: 'My Switch' },
  { id: 'claim',    icon: '🎯', label: 'Claim Assets' },
  { section: 'System' },
  { id: 'config',   icon: '⚙', label: 'Config' },
];

export default function Sidebar({ active, onNav }) {
  return (
    <nav style={{
      background: 'var(--navy-mid)',
      borderRight: '1px solid var(--navy-border)',
      padding: '12px 0', width: 220,
      overflowY: 'auto', flexShrink: 0,
    }}>
      {NAV.map((item, i) => {
        if (item.section) {
          return (
            <div key={i} style={{
              padding: '12px 18px 4px',
              fontSize: 10, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--slate-dim)', fontWeight: 600,
            }}>
              {item.section}
            </div>
          );
        }
        const isActive = active === item.id;
        return (
          <div
            key={item.id}
            onClick={() => onNav(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 20px', cursor: 'pointer',
              borderLeft: `3px solid ${isActive ? 'var(--amber)' : 'transparent'}`,
              background: isActive ? 'var(--amber-glow)' : 'transparent',
              color: isActive ? 'var(--amber)' : 'var(--slate)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'all 0.14s',
            }}
          >
            <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </div>
        );
      })}
    </nav>
  );
}
