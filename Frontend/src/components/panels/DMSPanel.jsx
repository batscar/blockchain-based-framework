import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import { Alert, EmptyState, SectionHeader, InfoRow } from '../UI';
import { parseError, formatDate, STATUS_LABELS } from '../../utils';
import { DMS_ABI } from '../../abis/coordinator';

export default function DMSPanel() {
  const { coordinator, userAddress, provider, addLog } = useWeb3();

  const [vaultAddr, setVaultAddr]     = useState('');
  const [vaultInfo, setVaultInfo]     = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFrozen, setIsFrozen]       = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);

  const [beneficiary, setBeneficiary]   = useState('');
  const [vaultTimeout, setVaultTimeout] = useState('300');
  const [triggerAddr, setTriggerAddr]   = useState('');

  const [createAlert, setCreateAlert] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);
  const [triggerAlert, setTriggerAlert] = useState(null);
  const [loading, setLoading]         = useState('');

  const intervalRef = useRef(null);

  const showCreate = (msg, type) => { setCreateAlert({ msg, type }); setTimeout(() => setCreateAlert(null), 6000); };
  const showAction = (msg, type) => { setActionAlert({ msg, type }); setTimeout(() => setActionAlert(null), 6000); };
  const showTrigger = (msg, type) => { setTriggerAlert({ msg, type }); setTimeout(() => setTriggerAlert(null), 6000); };

  const loadVaultStatus = useCallback(async () => {
    if (!coordinator || !userAddress) return;
    try {
      const vaults = await coordinator.getVaultsByOwner(userAddress);
      if (vaults.length === 0) { setVaultAddr(''); setVaultInfo(null); return; }
      const addr = vaults[vaults.length - 1];
      setVaultAddr(addr);

      const [remaining, triggered, frozen] = await Promise.all([
        coordinator.getTimeRemaining(userAddress),
        coordinator.isVaultTriggered(userAddress),
        coordinator.isVaultFrozen(userAddress),
      ]);
      setTimeRemaining(Number(remaining));
      setIsTriggered(triggered);
      setIsFrozen(frozen);

      if (provider) {
        const vault = new ethers.Contract(addr, DMS_ABI, provider);
        const [owner, ben, tp, lastCI, status] = await Promise.all([
          vault.owner(), vault.beneficiary(), vault.timeoutPeriod(),
          vault.lastCheckIn(), vault.status(),
        ]);
        setVaultInfo({ owner, beneficiary: ben, timeoutPeriod: tp.toString(), lastCheckIn: lastCI.toString(), status: Number(status) });
      }
    } catch (e) { console.error(e.message); }
  }, [coordinator, userAddress, provider]);

  useEffect(() => { loadVaultStatus(); }, [loadVaultStatus]);

  // Countdown tick
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (timeRemaining <= 0 || isFrozen || isTriggered) return;
    let rem = timeRemaining;
    intervalRef.current = setInterval(() => {
      rem -= 1;
      setTimeRemaining(Math.max(0, rem));
      if (rem <= 0) clearInterval(intervalRef.current);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [timeRemaining, isFrozen, isTriggered]);

  async function createVault() {
    if (!coordinator) return showCreate('No contract connected.', 'error');
    if (!ethers.isAddress(beneficiary)) return showCreate('Invalid beneficiary address.', 'error');
    if (!vaultTimeout || Number(vaultTimeout) < 1) return showCreate('Timeout must be > 0.', 'error');
    setLoading('create');
    try {
      const tx = await coordinator.createVault(beneficiary, vaultTimeout);
      showCreate('Deploying vault…', 'info');
      await tx.wait();
      showCreate('Vault deployed!', 'success');
      addLog('createVault', `Ben: ${beneficiary.slice(0,10)}…`, 'success');
      await loadVaultStatus();
    } catch (e) { showCreate(parseError(e), 'error'); }
    finally { setLoading(''); }
  }

  async function checkIn() {
    if (!coordinator) return;
    setLoading('checkin');
    try {
      const tx = await coordinator.checkIn();
      showAction('Checking in…', 'info');
      await tx.wait();
      showAction('✅ Checked in! Clock reset.', 'success');
      addLog('checkIn', 'Alive confirmed — clock reset', 'success');
      await loadVaultStatus();
    } catch (e) { showAction(parseError(e), 'error'); }
    finally { setLoading(''); }
  }

  async function freeze() {
    if (!coordinator) return;
    setLoading('freeze');
    try {
      const tx = await coordinator.freezeVault(userAddress);
      showAction('Freezing…', 'info');
      await tx.wait();
      showAction('🔒 Vault frozen!', 'success');
      addLog('freezeVault', 'All actions blocked', 'error');
      await loadVaultStatus();
    } catch (e) { showAction(parseError(e), 'error'); }
    finally { setLoading(''); }
  }

  async function trigger() {
    if (!coordinator) return;
    const owner = triggerAddr.trim();
    if (!ethers.isAddress(owner)) return showTrigger('Invalid address.', 'error');
    setLoading('trigger');
    try {
      const tx = await coordinator.triggerSwitch(owner);
      showTrigger('Triggering…', 'info');
      await tx.wait();
      showTrigger('⚡ Switch triggered! Beneficiary can claim.', 'success');
      addLog('triggerSwitch', `Owner: ${owner.slice(0,10)}…`, 'warn');
    } catch (e) { showTrigger(parseError(e), 'error'); }
    finally { setLoading(''); }
  }

  const statusName = vaultInfo ? STATUS_LABELS[vaultInfo.status] || 'Unknown' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader
        title="Dead Man's Switch"
        sub="Automatic, trustless asset inheritance — no courts, no lawyers"
        action={<button className="btn btn-ghost" onClick={loadVaultStatus}>↻ Refresh</button>}
      />

      {/* Countdown */}
      <Countdown
        seconds={timeRemaining}
        frozen={isFrozen}
        triggered={isTriggered}
        hasVault={!!vaultAddr}
      />

      {/* Status bar */}
      <StatusBar vaultAddr={vaultAddr} frozen={isFrozen} triggered={isTriggered} statusName={statusName} />

      {/* Create vault */}
      <div className="card">
        <div className="card-title">Deploy Vault</div>
        <div className="form-group">
          <label>Beneficiary Address</label>
          <input value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="0x... (e.g. Vikram's address)" />
        </div>
        <div className="form-group">
          <label>Timeout (seconds) — use 300 for demo (5 min)</label>
          <input type="number" value={vaultTimeout} onChange={e => setVaultTimeout(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={createVault} disabled={loading === 'create' || !coordinator}>
          {loading === 'create' ? '⏳ Deploying…' : 'Deploy Vault'}
        </button>
        {createAlert && <Alert {...createAlert} />}
      </div>

      {/* Actions */}
      <div className="card">
        <div className="card-title">Vault Actions</div>
        <div className="btn-row">
          <button className="btn btn-success" onClick={checkIn} disabled={loading === 'checkin' || !vaultAddr}>
            {loading === 'checkin' ? '⏳' : '✅'} Check In
          </button>
          <button className="btn btn-danger" onClick={freeze} disabled={loading === 'freeze' || !vaultAddr || isFrozen}>
            {loading === 'freeze' ? '⏳' : '🔒'} Freeze Vault
          </button>
        </div>
        {actionAlert && <Alert {...actionAlert} />}

        <div className="divider" />
        <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 10 }}>
          Trigger switch after timeout expires (anyone can call):
        </div>
        <div className="form-group">
          <label>Vault Owner Address</label>
          <input value={triggerAddr} onChange={e => setTriggerAddr(e.target.value)} placeholder="0x... (e.g. Arjun's address)" />
        </div>
        <button className="btn btn-ghost" onClick={trigger} disabled={loading === 'trigger'}>
          {loading === 'trigger' ? '⏳ Triggering…' : '⚡ Trigger Switch'}
        </button>
        {triggerAlert && <Alert {...triggerAlert} />}
      </div>

      {/* Vault info */}
      {vaultInfo && (
        <div className="card">
          <div className="card-title">Vault Details</div>
          <InfoRow label="Vault Address"   value={vaultAddr.slice(0,16)+'…'} />
          <InfoRow label="Beneficiary"     value={vaultInfo.beneficiary.slice(0,16)+'…'} />
          <InfoRow label="Timeout Period"  value={vaultInfo.timeoutPeriod + 's'} />
          <InfoRow label="Last Check-In"   value={formatDate(vaultInfo.lastCheckIn)} />
          <InfoRow label="Status"          value={statusName} />
          <InfoRow label="Frozen"          value={isFrozen ? '🔒 Yes' : '✓ No'} />
          <InfoRow label="Triggered"       value={isTriggered ? '⚡ Yes' : 'No'} />
        </div>
      )}

      {!vaultAddr && (
        <EmptyState icon="⏱" msg="No vault found. Deploy one above to activate your Dead Man's Switch." />
      )}
    </div>
  );
}

function Countdown({ seconds, frozen, triggered, hasVault }) {
  const warning = seconds < 60 && seconds > 0;
  const expired = seconds === 0 && hasVault;

  const h   = Math.floor(seconds / 3600);
  const m   = Math.floor((seconds % 3600) / 60);
  const s   = seconds % 60;
  const fmt = [h, m, s].map(v => String(v).padStart(2, '0')).join(':');

  let display = fmt;
  let sub = 'until switch fires — check in to reset';
  if (!hasVault) { display = '--:--:--'; sub = 'Deploy a vault to start'; }
  else if (frozen) { display = '🔒'; sub = 'Vault frozen'; }
  else if (triggered) { display = '⚡'; sub = 'Switch triggered — beneficiary can claim'; }
  else if (expired) { display = '00:00:00'; sub = 'Timeout expired — switch can be triggered'; }

  return (
    <div style={{
      background: 'var(--navy-mid)',
      border: '1px solid var(--navy-border)',
      borderRadius: 8, padding: '24px 20px',
      textAlign: 'center',
    }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Time remaining before switch fires</div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 700, letterSpacing: '0.04em',
        color: frozen ? 'var(--slate)' : triggered || expired ? 'var(--red)' : 'var(--amber)',
        animation: (warning && !triggered) ? 'pulseRed 1s infinite' : 'none',
      }}>
        {display}
      </div>
      <div style={{ fontSize: 12, color: 'var(--slate-dim)', marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function StatusBar({ vaultAddr, frozen, triggered, statusName }) {
  let dotColor = 'var(--slate-dim)';
  let label    = 'No vault found';
  let sub      = 'Deploy a vault to activate your switch';

  if (vaultAddr) {
    if (frozen)         { dotColor = 'var(--red)';   label = '🔒 Vault Frozen'; sub = 'Contact guardian to unfreeze'; }
    else if (triggered) { dotColor = 'var(--red)';   label = '⚡ Switch Triggered'; sub = 'Beneficiary can claim assets'; }
    else if (statusName === 'Claimed') { dotColor = 'var(--slate)'; label = 'Claimed'; sub = 'Assets transferred'; }
    else { dotColor = 'var(--green)'; label = 'Active — Monitoring'; sub = vaultAddr.slice(0,14)+'…'; }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', background: 'var(--navy)',
      border: '1px solid var(--navy-border)', borderRadius: 8,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: dotColor,
        boxShadow: dotColor !== 'var(--slate-dim)' ? `0 0 8px ${dotColor}` : 'none',
        animation: dotColor === 'var(--green)' ? 'pulseGreen 2s infinite' : 'none',
      }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'var(--mono)' }}>{sub}</div>
      </div>
    </div>
  );
}
