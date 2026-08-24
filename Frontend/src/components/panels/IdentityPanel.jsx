import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { Alert, EmptyState, InfoRow, SectionHeader, Chip, StatCard } from '../UI';
import { parseError, formatDate, shortAddr } from '../../utils';

export default function IdentityPanel({ onRoleDetected }) {
  const { coordinator, userAddress, addLog } = useWeb3();

  const [did, setDid]                 = useState('');
  const [identity, setIdentity]       = useState(null);
  const [queryAddr, setQueryAddr]     = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [alert, setAlert]             = useState(null);
  const [queryAlert, setQueryAlert]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [stats, setStats]             = useState({});

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 6000);
  };

  const loadIdentity = useCallback(async () => {
    if (!coordinator || !userAddress) return;
    try {
      const id = await coordinator.getIdentity(userAddress);
      setIdentity(id);
      if (id.did && onRoleDetected) onRoleDetected('user');
    } catch (e) { console.error(e); }
  }, [coordinator, userAddress, onRoleDetected]);

  const loadStats = useCallback(async () => {
    if (!coordinator) return;
    try {
      const [ids, assets, vaults] = await Promise.all([
        coordinator.totalIdentities(),
        coordinator.totalAssets(),
        coordinator.totalVaults(),
      ]);
      setStats({ ids: ids.toString(), assets: assets.toString(), vaults: vaults.toString() });
    } catch (e) {}
  }, [coordinator]);

  useEffect(() => { loadIdentity(); loadStats(); }, [loadIdentity, loadStats]);
  useEffect(() => { if (userAddress) setDid('did:ethr:' + userAddress.toLowerCase()); }, [userAddress]);

  async function registerIdentity() {
    if (!coordinator) return showAlert('No contract connected. Set address in Config.', 'error');
    if (!did.trim())  return showAlert('DID cannot be empty.', 'error');
    setLoading(true);
    try {
      const tx = await coordinator.registerIdentity(did.trim());
      showAlert('Transaction sent — waiting for confirmation…', 'info');
      await tx.wait();
      showAlert('Identity registered on-chain!', 'success');
      addLog('registerIdentity', did.slice(0, 30) + '…', 'success');
      await loadIdentity();
      await loadStats();
    } catch (e) {
      showAlert(parseError(e), 'error');
      addLog('registerIdentity FAILED', parseError(e).slice(0, 60), 'error');
    } finally { setLoading(false); }
  }

  async function queryIdentity() {
    if (!coordinator) return;
    try {
      const id = await coordinator.getIdentity(queryAddr.trim());
      setQueryResult(id);
      if (!id.did) setQueryAlert({ msg: 'No identity found for this address.', type: 'error' });
      else setQueryAlert(null);
    } catch (e) { setQueryAlert({ msg: parseError(e), type: 'error' }); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="My Identity" sub="Your on-chain decentralized identifier" />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <StatCard label="Total Identities" value={stats.ids}    sub="Registered on-chain" />
        <StatCard label="Total Assets"     value={stats.assets} sub="NFTs minted" />
        <StatCard label="Total Vaults"     value={stats.vaults} sub="DMS deployed" />
      </div>

      {/* Register */}
      <div className="card">
        <div className="card-title">Register / Update DID</div>
        <div className="form-group">
          <label>Decentralized Identifier</label>
          <input
            value={did}
            onChange={e => setDid(e.target.value)}
            placeholder="did:ethr:0x..."
          />
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={registerIdentity} disabled={loading || !coordinator}>
            {loading ? '⏳ Registering…' : 'Register Identity'}
          </button>
          <button className="btn btn-ghost" onClick={loadIdentity}>↻ Refresh</button>
        </div>
        {alert && <Alert {...alert} />}
      </div>

      {/* Identity display */}
      <div className="card">
        <div className="card-title">Identity Record</div>
        {!identity || !identity.did ? (
          <EmptyState icon="🪪" msg="No identity found. Register your DID above." />
        ) : (
          <IdentityCard identity={identity} address={userAddress} />
        )}
      </div>

      {/* Query any */}
      <div className="card">
        <div className="card-title">Query Any Identity</div>
        <div className="form-group">
          <label>Wallet Address</label>
          <input value={queryAddr} onChange={e => setQueryAddr(e.target.value)} placeholder="0x..." />
        </div>
        <button className="btn btn-ghost" onClick={queryIdentity}>Query</button>
        {queryAlert && <Alert {...queryAlert} />}
        {queryResult && queryResult.did && (
          <div style={{ marginTop: 16 }}>
            <IdentityCard identity={queryResult} address={queryAddr} />
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityCard({ identity, address }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <InfoRow label="DID" value={<span className="text-amber" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{identity.did}</span>} />
      <InfoRow label="Address" value={shortAddr(address)} />
      <InfoRow label="Verified" value={
        identity.verified
          ? <Chip label="✓ Verified" variant="green" />
          : <Chip label="Unverified" variant="slate" />
      } />
      <InfoRow label="Status" value={
        identity.active
          ? <Chip label="● Active" variant="green" />
          : <Chip label="✕ Revoked" variant="red" />
      } />
      <InfoRow label="Registered" value={formatDate(identity.registeredAt)} />
    </div>
  );
}
