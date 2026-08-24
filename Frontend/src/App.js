import React, { useState, useEffect } from 'react';
import { Web3Provider } from './context/Web3Context';
import Header         from './components/Header';
import Sidebar        from './components/Sidebar';
import AuditPanel     from './components/AuditPanel';
import ConnectOverlay from './components/ConnectOverlay';
import IdentityPanel  from './components/panels/IdentityPanel';
import RBACPanel      from './components/panels/RBACPanel';
import AssetsPanel    from './components/panels/AssetsPanel';
import MintPanel      from './components/panels/MintPanel';
import DMSPanel       from './components/panels/DMSPanel';
import ClaimPanel     from './components/panels/ClaimPanel';
import ConfigPanel    from './components/panels/ConfigPanel';

const PANELS = {
  identity: IdentityPanel,
  rbac:     RBACPanel,
  assets:   AssetsPanel,
  mint:     MintPanel,
  dms:      DMSPanel,
  claim:    ClaimPanel,
  config:   ConfigPanel,
};

function AppInner() {
  const [active, setActive] = useState('identity');
  const [role, setRole]     = useState(null);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('vc_theme');
    return saved ? saved === 'dark' : true;
  });

  // On mount: apply the saved theme class with no animation
  useEffect(() => {
    if (!darkMode) document.documentElement.classList.add('light');
    else           document.documentElement.classList.remove('light');
  }, []); // eslint-disable-line

  // Theme toggle: opacity-flash technique.
  // CSS custom properties cannot be interpolated — per-property transitions
  // cause a desynchronised half-dark/half-light flicker because some elements
  // switch instantly while others lag. Instead we:
  //   1. Add .theme-switching → fades #app-root to opacity:0 over 150ms
  //   2. After 150ms: atomically swap the html class (all vars snap together)
  //   3. Two rAFs later: remove .theme-switching → fades back to opacity:1
  // Result: a clean, smooth crossfade with no mixed state visible.
  function toggleTheme() {
    const next = !darkMode;
    const root = document.getElementById('app-root');
    if (!root) return;

    root.classList.add('theme-switching');

    setTimeout(() => {
      if (next) document.documentElement.classList.remove('light');
      else      document.documentElement.classList.add('light');

      localStorage.setItem('vc_theme', next ? 'dark' : 'light');
      setDarkMode(next);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.classList.remove('theme-switching');
        });
      });
    }, 150);
  }

  const Panel = PANELS[active] || IdentityPanel;

  return (
    <div
      id="app-root"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      <ConnectOverlay darkMode={darkMode} />
      <Header
        role={role}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={active} onNav={setActive} darkMode={darkMode} />
        <main style={{
          flex: 1, overflowY: 'auto', padding: 24,
          background: 'var(--bg)',
          position: 'relative', zIndex: 1,
        }}>
          <Panel onRoleDetected={setRole} />
        </main>
        <AuditPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <AppInner />
    </Web3Provider>
  );
}
