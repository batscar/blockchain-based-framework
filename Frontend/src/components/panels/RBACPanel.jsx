import React, { useState } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { Alert, SectionHeader, Chip } from '../UI';
import { parseError } from '../../utils';

const ROLES = [
  { value: 'manager', label: 'Manager', desc: 'Verify/revoke identities' },
  { value: 'auditor', label: 'Auditor', desc: 'Read-only observer' },
];

export default function RBACPanel() {
  const { coordinator, addLog } = useWeb3();
  const [roleAddr, setRoleAddr]   = useState('');
  const [roleType, setRoleType]   = useState('manager');
  const [verifyAddr, setVerifyAddr] = useState('');
  const [roleAlert, setRoleAlert]   = useState(null);
  const [verifyAlert, setVerifyAlert] = useState(null);
  const [loading, setLoading]     = useState('');

  const show = (setter, msg, type) => {
    setter({ msg, type });
    setTimeout(() => setter(null), 6000);
  };

  async function assignRole() {
    if (!coordinator) return show(setRoleAlert, 'No contract connected.', 'error');
    setLoading('role');
    try {
      let tx;
      if (roleType === 'manager') tx = await coordinator.assignManager(roleAddr);
      if (roleType === 'auditor') tx = await coordinator.assignAuditor(roleAddr);
      show(setRoleAlert, 'Sending transaction…', 'info');
      await tx.wait();
      show(setRoleAlert, `${roleType} role assigned to ${roleAddr.slice(0,10)}…`, 'success');
      addLog('assign' + roleType, roleAddr.slice(0, 12) + '…', 'success');
    } catch (e) {
      show(setRoleAlert, parseError(e), 'error');
      addLog('assignRole FAILED', parseError(e).slice(0,60), 'error');
    } finally { setLoading(''); }
  }

  async function verifyIdentity() {
    if (!coordinator) return show(setVerifyAlert, 'No contract connected.', 'error');
    setLoading('verify');
    try {
      const tx = await coordinator.verifyIdentity(verifyAddr);
      show(setVerifyAlert, 'Sending…', 'info');
      await tx.wait();
      show(setVerifyAlert, `Identity verified: ${verifyAddr.slice(0,10)}…`, 'success');
      addLog('verifyIdentity', verifyAddr.slice(0,12)+'…', 'success');
    } catch (e) {
      show(setVerifyAlert, parseError(e), 'error');
    } finally { setLoading(''); }
  }

  async function revokeIdentity() {
    if (!coordinator) return show(setVerifyAlert, 'No contract connected.', 'error');
    if (!window.confirm('Revoke identity for ' + verifyAddr + '?')) return;
    setLoading('revoke');
    try {
      const tx = await coordinator.revokeIdentity(verifyAddr);
      show(setVerifyAlert, 'Sending…', 'info');
      await tx.wait();
      show(setVerifyAlert, `Identity revoked: ${verifyAddr.slice(0,10)}…`, 'success');
      addLog('revokeIdentity', verifyAddr.slice(0,12)+'…', 'warn');
    } catch (e) {
      show(setVerifyAlert, parseError(e), 'error');
    } finally { setLoading(''); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Roles & Access Control" sub="Smart contract enforced — every attempt is logged on-chain" />

      {/* Assign role */}
      <div className="card">
        <div className="card-title">Assign Role (Admin only)</div>
        <div className="form-group">
          <label>Wallet Address</label>
          <input value={roleAddr} onChange={e => setRoleAddr(e.target.value)} placeholder="0x..." />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={roleType} onChange={e => setRoleType(e.target.value)}>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={assignRole} disabled={loading === 'role' || !roleAddr}>
          {loading === 'role' ? '⏳ Assigning…' : 'Assign Role'}
        </button>
        {roleAlert && <Alert {...roleAlert} />}
      </div>

      {/* Verify / revoke */}
      <div className="card">
        <div className="card-title">Identity Verification (Manager only)</div>
        <div className="form-group">
          <label>User Address</label>
          <input value={verifyAddr} onChange={e => setVerifyAddr(e.target.value)} placeholder="0x..." />
        </div>
        <div className="btn-row">
          <button className="btn btn-success" onClick={verifyIdentity} disabled={loading === 'verify' || !verifyAddr}>
            {loading === 'verify' ? '⏳' : '✓'} Verify Identity
          </button>
          <button className="btn btn-danger" onClick={revokeIdentity} disabled={loading === 'revoke' || !verifyAddr}>
            {loading === 'revoke' ? '⏳' : '✕'} Revoke Identity
          </button>
        </div>
        {verifyAlert && <Alert {...verifyAlert} />}
      </div>

      {/* RBAC table */}
      <div className="card">
        <div className="card-title">Role Permissions</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Role</th>
              <th>Permissions</th>
              <th>Assigned To</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><Chip label="Admin"   variant="red"    /></td>
              <td>Mint NFTs, assign roles, register DIDs, full access</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>Deployer wallet</td>
            </tr>
            <tr>
              <td><Chip label="Manager" variant="blue"   /></td>
              <td>Verify & revoke identities</td>
              <td style={{ color: 'var(--slate)' }}>Revenue Officers</td>
            </tr>
            <tr>
              <td><Chip label="Auditor" variant="purple" /></td>
              <td>Read-only — query any DID, NFT, or event</td>
              <td style={{ color: 'var(--slate)' }}>Court Officials</td>
            </tr>
            <tr>
              <td><Chip label="User"    variant="green"  /></td>
              <td>Own assets, configure & operate vault, check in</td>
              <td style={{ color: 'var(--slate)' }}>Citizens</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* RBAC demo block */}
      <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--red)' }}>RBAC Demo — Unauthorized Mint Test</div>
        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
          Switch to a non-admin wallet (e.g. Meera/Auditor) and click below. The transaction will revert and an <code style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>UnauthorizedAttempt</code> event is permanently written to the blockchain.
        </p>
        <UnauthorizedMintDemo coordinator={coordinator} addLog={addLog} />
      </div>
    </div>
  );
}

function UnauthorizedMintDemo({ coordinator, addLog }) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  async function attempt() {
    if (!coordinator) return;
    setLoading(true);
    addLog('🚫 Unauthorized mint attempt', 'Watch it revert…', 'error');
    try {
      const tx = await coordinator.mintAsset(
        '0x0000000000000000000000000000000000000001',
        'did:ethr:test', 'ipfs://test', 'Test', 'Unauthorized test'
      );
      await tx.wait();
      setAlert({ msg: 'Unexpectedly succeeded — this wallet is Admin.', type: 'info' });
    } catch (e) {
      setAlert({ msg: '✓ CORRECTLY BLOCKED: ' + parseError(e), type: 'error' });
      addLog('RBAC enforced', 'Mint blocked — insufficient role', 'error');
    } finally { setLoading(false); }
    setTimeout(() => setAlert(null), 8000);
  }

  return (
    <>
      <button className="btn btn-danger" onClick={attempt} disabled={loading || !coordinator}>
        {loading ? '⏳ Attempting…' : '🚫 Attempt Unauthorized Mint'}
      </button>
      {alert && <Alert {...alert} />}
    </>
  );
}
