import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { EmptyState, SectionHeader, Chip } from '../UI';
import { parseError, formatDate } from '../../utils';

export default function AssetsPanel() {
  const { coordinator, userAddress } = useWeb3();
  const [didInput, setDidInput] = useState('');
  const [assets, setAssets]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-load identity's DID on mount
  useEffect(() => {
    if (!coordinator || !userAddress) return;
    coordinator.getIdentity(userAddress)
      .then(id => { if (id.did) setDidInput(id.did); })
      .catch(() => {});
  }, [coordinator, userAddress]);

  const loadAssets = useCallback(async (did) => {
    if (!coordinator || !did) return;
    setLoading(true);
    setSearched(false);
    try {
      const tokenIds = await coordinator.getAssetsByDID(did);
      const metas = await Promise.all(
        tokenIds.map(id => coordinator.getAssetMetadata(id).then(m => ({ id: id.toString(), ...m })))
      );
      setAssets(metas);
    } catch (e) {
      console.error(parseError(e));
      setAssets([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [coordinator]);

  function handleSearch() { loadAssets(didInput.trim()); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader
        title="Asset Dashboard"
        sub="NFTs issued to a decentralized identity"
        action={
          <button className="btn btn-ghost" onClick={() => loadAssets(didInput)}>↻ Refresh</button>
        }
      />

      <div className="card">
        <div className="card-title">Query Assets by DID</div>
        <div className="form-group">
          <label>DID String</label>
          <input
            value={didInput}
            onChange={e => setDidInput(e.target.value)}
            placeholder="did:ethr:..."
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !didInput}>
          {loading ? '⏳ Loading…' : 'Search Assets'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate)' }}>Loading assets…</div>
      )}

      {!loading && searched && assets.length === 0 && (
        <EmptyState icon="🖼" msg="No assets found for this DID." />
      )}

      {!loading && assets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {assets.map(asset => <NFTCard key={asset.id} asset={asset} />)}
        </div>
      )}

      {!searched && !loading && (
        <EmptyState icon="🔍" msg="Enter a DID above and click Search, or Refresh to load your own assets." />
      )}
    </div>
  );
}

function NFTCard({ asset }) {
  const typeColor = {
    LandTitle:  'green',
    Document:   'blue',
    Credential: 'purple',
    Property:   'amber',
  }[asset.assetType] || 'slate';

  return (
    <div style={{
      background: 'var(--navy-mid)',
      border: '1px solid var(--navy-border)',
      borderRadius: 8,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, var(--amber), transparent)',
      }} />

      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)', marginBottom: 10 }}>
        Token #{asset.id}
      </div>

      <div style={{ marginBottom: 8 }}>
        <Chip label={asset.assetType} variant={typeColor} />
      </div>

      <div style={{ fontSize: 13, color: 'var(--white)', lineHeight: 1.45, marginBottom: 10 }}>
        {asset.description}
      </div>

      <div style={{ fontSize: 10, color: 'var(--slate-dim)', fontFamily: 'var(--mono)', marginBottom: 6, wordBreak: 'break-all' }}>
        {asset.did}
      </div>

      <div style={{ fontSize: 10, color: 'var(--slate-dim)' }}>
        Minted {formatDate(asset.mintedAt)}
      </div>
    </div>
  );
}
