import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import { shortAddr } from '../utils';
import { Spinner } from './UI';

const ROLE_MAP = {
  admin:   { label: 'Admin',   cls: 'chip-red'    },
  manager: { label: 'Manager', cls: 'chip-blue'   },
  auditor: { label: 'Auditor', cls: 'chip-purple' },
  user:    { label: 'User',    cls: 'chip-green'  },
};

export default function Header({ role, darkMode, onToggleTheme }) {
  const { userAddress, chainId, connect, connecting } = useWeb3();
  const roleInfo = ROLE_MAP[role] || null;

  const networkLabel = chainId === 11155111 ? 'Sepolia'
    : chainId === 137   ? 'Polygon'
    : chainId === 31337 ? 'Localhost'
    : chainId ? `Chain ${chainId}` : null;

  return (
    <header style={{
      background: 'var(--bg-mid)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 56,
      flexShrink: 0,
      // NO position:sticky, NO z-index, NO transition —
      // sticky + z-index creates a stacking context that escapes
      // #app-root's opacity fade, causing the navbar to visibly
      // snap colors while the rest of the UI is fading out.
      // The layout is overflow:hidden so the header never scrolls anyway.
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30,
          background: darkMode ? 'transparent' : 'var(--accent)',
          border: darkMode ? '1px solid var(--accent)' : 'none',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700,
          color: darkMode ? 'var(--accent)' : 'var(--text-inv)',
          boxShadow: darkMode ? '0 0 14px rgba(34,211,238,0.30)' : 'none',
        }}>⛓</div>
        <div>
          <div style={{
            fontWeight: 700, fontSize: 15, letterSpacing: '0.03em',
            color: 'var(--text)',
            textShadow: darkMode ? '0 0 14px rgba(34,211,238,0.25)' : 'none',
          }}>VaultChain</div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--slate-dim)' }}>
            Decentralized Identity Platform
          </div>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {networkLabel && <span className="chip chip-amber" style={{ fontSize: 10 }}>{networkLabel}</span>}
        {roleInfo && <span className={`chip ${roleInfo.cls}`}>{roleInfo.label}</span>}

        <div className="theme-toggle-wrap">
          <span style={{ fontSize: 13 }}>{darkMode ? '🌙' : '☀️'}</span>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          />
        </div>

        <button
          className={`btn ${userAddress ? 'btn-ghost' : 'btn-primary'}`}
          onClick={connect}
          disabled={connecting}
          style={{ minWidth: 140 }}
        >
          {connecting ? <><Spinner /> Connecting…</> :
            userAddress ? shortAddr(userAddress) : 'Connect MetaMask'}
        </button>
      </div>
    </header>
  );
}
