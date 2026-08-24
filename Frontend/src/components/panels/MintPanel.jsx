import React, { useState } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { Alert, SectionHeader } from '../UI';
import { parseError } from '../../utils';

const ASSET_TYPES = ['LandTitle', 'Document', 'Credential', 'Property'];

export default function MintPanel() {
  const { coordinator, addLog } = useWeb3();
  const [form, setForm]     = useState({ to: '', did: '', type: 'LandTitle', desc: '', uri: '' });
  const [alert, setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const show = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert(null), 7000); };

  async function mint() {
    if (!coordinator) return show('No contract connected.', 'error');
    const { to, did, type, desc, uri } = form;
    if (!to || !did || !desc) return show('Fill all required fields.', 'error');
    setLoading(true);
    try {
      const tx = await coordinator.mintAsset(to, did, uri || 'ipfs://placeholder', type, desc);
      show('Transaction sent — waiting…', 'info');
      const receipt = await tx.wait();
      show(`NFT minted! Tx: ${receipt.hash.slice(0,14)}…`, 'success');
      addLog('mintAsset', `${type} → ${to.slice(0,10)}…`, 'success');
      setForm({ to: '', did: '', type: 'LandTitle', desc: '', uri: '' });
    } catch (e) {
      show(parseError(e), 'error');
      addLog('mintAsset REVERTED', parseError(e).slice(0, 60), 'error');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Mint NFT Asset" sub="Admin-only — create and assign a new token to a registered identity" />

      <div className="card">
        <div className="card-title">New Asset</div>
        <div className="form-group">
          <label>Recipient Address *</label>
          <input value={form.to} onChange={e => set('to', e.target.value)} placeholder="0x..." />
        </div>
        <div className="form-group">
          <label>Owner DID *</label>
          <input value={form.did} onChange={e => set('did', e.target.value)} placeholder="did:ethr:arjun-nashik-001" />
        </div>
        <div className="form-group">
          <label>Asset Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Description *</label>
          <input value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="4 acres farmland, Survey No. 42, Nashik" />
        </div>
        <div className="form-group">
          <label>Metadata URI (IPFS)</label>
          <input value={form.uri} onChange={e => set('uri', e.target.value)} placeholder="ipfs://Qm..." />
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={mint} disabled={loading || !coordinator}>
            {loading ? '⏳ Minting…' : '⚡ Mint Asset'}
          </button>
        </div>
        {alert && <Alert {...alert} />}
      </div>

      {/* Unauthorized demo */}
      <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--red)' }}>RBAC Demo — Force Revert</div>
        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14, lineHeight: 1.5 }}>
          Switch MetaMask to a non-admin account (Meera / Auditor), then click below. The transaction reverts and an <code style={{ color: 'var(--amber)', fontFamily: 'var(--mono)' }}>UnauthorizedAttempt</code> event is permanently written to the chain — visible in the Audit Log.
        </p>
        <UnauthorizedTest coordinator={coordinator} addLog={addLog} />
      </div>
    </div>
  );
}

function UnauthorizedTest({ coordinator, addLog }) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  async function attempt() {
    if (!coordinator) return;
    setLoading(true);
    addLog('🚫 Unauthorized attempt started', 'Expecting revert…', 'error');
    try {
      const tx = await coordinator.mintAsset(
        '0x000000000000000000000000000000000000dEaD',
        'did:ethr:hack', 'ipfs://hack', 'Hack', 'Unauthorized test mint'
      );
      await tx.wait();
      setAlert({ msg: 'Succeeded — this wallet IS admin.', type: 'info' });
    } catch (e) {
      setAlert({ msg: '✓ CORRECTLY BLOCKED: ' + parseError(e), type: 'error' });
      addLog('RBAC enforced ✓', 'Unauthorized mint blocked', 'error');
    } finally { setLoading(false); }
    setTimeout(() => setAlert(null), 8000);
  }

  return (
    <>
      <button className="btn btn-danger" onClick={attempt} disabled={loading || !coordinator}>
        {loading ? '⏳ Attempting…' : '🚫 Attempt Unauthorized Mint (will revert)'}
      </button>
      {alert && <Alert {...alert} />}
    </>
  );
}
