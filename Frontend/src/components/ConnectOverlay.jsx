import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import { Spinner } from './UI';

export default function ConnectOverlay({ darkMode }) {
  const { userAddress, connect, connecting } = useWeb3();
  if (userAddress) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: darkMode ? 'rgba(0,0,0,0.96)' : 'rgba(245,245,245,0.96)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16, padding: '44px 40px',
        textAlign: 'center', maxWidth: 400, width: '90%',
        boxShadow: darkMode
          ? '0 0 0 1px rgba(34,211,238,0.10), 0 8px 60px rgba(34,211,238,0.10)'
          : 'var(--shadow)',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64,
          background: darkMode ? 'transparent' : 'var(--accent)',
          border: darkMode ? '1px solid var(--accent)' : 'none',
          borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 20px',
          color: darkMode ? 'var(--accent)' : '#fff',
          boxShadow: darkMode ? '0 0 24px rgba(34,211,238,0.25)' : 'none',
        }}>⛓</div>

        <h1 style={{
          fontSize: 26, fontWeight: 700, marginBottom: 8,
          color: 'var(--text)',
          textShadow: darkMode ? '0 0 20px rgba(34,211,238,0.22)' : 'none',
        }}>VaultChain</h1>

        <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 6, lineHeight: 1.5 }}>
          Decentralized Identity &amp; Asset Management
        </p>
        <p style={{ fontSize: 12, color: 'var(--slate-dim)', marginBottom: 32, lineHeight: 1.6 }}>
          Connect your MetaMask wallet to access the platform.<br />
          Your keys. Your identity. Your assets.
        </p>

        <button
          className="btn btn-primary"
          onClick={connect}
          disabled={connecting}
          style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px' }}
        >
          {connecting ? <><Spinner /> Connecting…</> : 'Connect MetaMask'}
        </button>

        <div style={{
          display: 'flex', gap: 20, justifyContent: 'center',
          marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)',
        }}>
          {[
            { icon: '🪪', label: 'DID Identity' },
            { icon: '🖼', label: 'NFT Assets' },
            { icon: '⏱', label: "Dead Man's Switch" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 10, color: 'var(--slate-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 18, fontSize: 10, color: 'var(--slate-dim)' }}>
          SIH 2024 · Sepolia Testnet · Built with Foundry + React
        </p>
      </div>
    </div>
  );
}
