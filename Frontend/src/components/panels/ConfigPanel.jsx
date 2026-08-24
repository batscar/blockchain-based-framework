import React, { useState } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { Alert, SectionHeader, InfoRow } from '../UI';

// Anvil default deploy order addresses (for local testing)
const ANVIL_DEFAULTS = {
  coordinator: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  registry:    '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  nft:         '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  factory:     '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
};

export default function ConfigPanel() {
  const { addresses, saveAddresses, userAddress, chainId, provider } = useWeb3();

  const [form, setForm]   = useState({
    coordinator: addresses.coordinator || '',
    registry:    addresses.registry    || '',
    nft:         addresses.nft         || '',
    factory:     addresses.factory     || '',
  });
  const [alert, setAlert] = useState(null);
  const [block, setBlock] = useState('—');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const show = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert(null), 5000); };

  async function save() {
    if (!form.coordinator) return show('VaultCoordinator address is required.', 'error');
    saveAddresses(form);
    show('Contracts connected!', 'success');
    if (provider) {
      const b = await provider.getBlockNumber();
      setBlock(b.toString());
    }
  }

  function loadAnvil() {
    setForm(ANVIL_DEFAULTS);
    show('Anvil defaults loaded. Replace with Sepolia addresses after deploy.', 'info');
  }

  const networkName = chainId === 11155111 ? 'Sepolia Testnet'
    : chainId === 137 ? 'Polygon Mainnet'
    : chainId === 31337 ? 'Localhost (Anvil)'
    : chainId ? `Chain ID ${chainId}`
    : 'Not connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Contract Configuration" sub="Paste deployed addresses after running Deploy.s.sol" />

      <div className="card">
        <div className="card-title">Contract Addresses</div>
        {[
          { key: 'coordinator', label: 'VaultCoordinator *' },
          { key: 'registry',    label: 'IdentityRegistry' },
          { key: 'nft',         label: 'VaultNFT' },
          { key: 'factory',     label: 'DeadManSwitchFactory' },
        ].map(({ key, label }) => (
          <div className="form-group" key={key}>
            <label>{label}</label>
            <input
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              placeholder="0x..."
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
            />
          </div>
        ))}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>Save & Connect</button>
          <button className="btn btn-ghost"   onClick={loadAnvil}>Load Anvil Defaults</button>
        </div>
        {alert && <Alert {...alert} />}
      </div>

      <div className="card">
        <div className="card-title">Network Status</div>
        <InfoRow label="Wallet"       value={userAddress || '—'} />
        <InfoRow label="Network"      value={networkName} />
        <InfoRow label="Chain ID"     value={chainId?.toString() || '—'} />
        <InfoRow label="Block"        value={block} />
        <InfoRow label="Coordinator"  value={form.coordinator ? form.coordinator.slice(0,16)+'…' : 'Not set'} />
      </div>

      <div className="card">
        <div className="card-title">Deployment Quickstart</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { step: '1', cmd: 'forge install', desc: 'Install dependencies' },
            { step: '2', cmd: 'cp .env.example .env && vim .env', desc: 'Add PRIVATE_KEY and SEPOLIA_RPC' },
            { step: '3', cmd: 'forge build', desc: 'Compile all contracts' },
            { step: '4', cmd: 'forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --verify', desc: 'Deploy to Sepolia' },
            { step: '5', cmd: 'cat deployments/sepolia.json', desc: 'Copy addresses here' },
            { step: '6', cmd: 'forge script script/Seed.s.sol --rpc-url $SEPOLIA_RPC --broadcast', desc: 'Load Arjun demo data' },
          ].map(({ step, cmd, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--amber-glow)', border: '1px solid rgba(232,160,32,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--amber)',
              }}>{step}</div>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)', marginBottom: 2, wordBreak: 'break-all' }}>{cmd}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
