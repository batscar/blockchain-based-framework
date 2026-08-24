import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import { Alert, SectionHeader, InfoRow } from '../UI';
import { parseError } from '../../utils';

export default function ClaimPanel() {
  const { coordinator, addLog } = useWeb3();
  const [ownerAddr, setOwnerAddr] = useState('');
  const [alert, setAlert]         = useState(null);
  const [loading, setLoading]     = useState(false);

  const show = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert(null), 8000); };

  async function claim() {
    if (!coordinator) return show('No contract connected.', 'error');
    if (!ethers.isAddress(ownerAddr)) return show('Invalid owner address.', 'error');
    setLoading(true);
    try {
      const tx = await coordinator.claimAssets(ownerAddr);
      show('Claiming assets…', 'info');
      await tx.wait();
      show('🎯 Assets claimed! Check your wallet.', 'success');
      addLog('claimAssets', `Claimed from ${ownerAddr.slice(0,10)}…`, 'success');
    } catch (e) {
      show(parseError(e), 'error');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Claim Inherited Assets" sub="Beneficiary claims all assets from a triggered vault" />

      <div className="card">
        <div className="card-title">Claim from Vault</div>
        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16, lineHeight: 1.5 }}>
          The switch must have been triggered first. Once you claim, all ETH and NFTs transfer to your wallet on-chain — permanently and irreversibly.
        </p>
        <div className="form-group">
          <label>Original Owner Address (whose vault to claim from)</label>
          <input
            value={ownerAddr}
            onChange={e => setOwnerAddr(e.target.value)}
            placeholder="0x... (e.g. Arjun's address)"
          />
        </div>
        <button className="btn btn-primary" onClick={claim} disabled={loading || !ownerAddr || !coordinator}>
          {loading ? '⏳ Claiming…' : '🎯 Claim Assets'}
        </button>
        {alert && <Alert {...alert} />}
      </div>

      {/* How it works */}
      <div className="card" style={{ borderColor: 'rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--amber)' }}>How the Switch Works</div>
        <InfoRow label="1. Owner sets up switch"      value="createVault(beneficiary, timeout)" />
        <InfoRow label="2. Owner checks in periodically" value="checkIn() — resets clock" />
        <InfoRow label="3. Owner stops checking in"   value="Timeout period elapses" />
        <InfoRow label="4. Anyone triggers switch"    value="triggerSwitch(ownerAddr)" />
        <InfoRow label="5. Beneficiary claims"        value="claimAssets(ownerAddr)" />
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--navy)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--white)' }}>No courts. No lawyers. No delays.</strong><br />
            The blockchain executes the transfer automatically once the conditions are met. The audit trail is immutable — every check-in, trigger, and claim is permanently recorded.
          </div>
        </div>
      </div>
    </div>
  );
}
