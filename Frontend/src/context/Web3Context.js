import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { COORDINATOR_ABI } from '../abis/coordinator';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider]       = useState(null);
  const [signer, setSigner]           = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [chainId, setChainId]         = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [addresses, setAddresses]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('vc_addresses') || '{}'); }
    catch { return {}; }
  });
  const [auditLog, setAuditLog]       = useState([]);
  const [connecting, setConnecting]   = useState(false);

  const addLog = useCallback((action, meta, type = 'info') => {
    setAuditLog(prev => [{
      id: Date.now() + Math.random(),
      action, meta, type,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 60));
  }, []);

  const initCoordinator = useCallback((addr, signerOrProvider) => {
    if (!addr || !ethers.isAddress(addr)) return null;
    try {
      const c = new ethers.Contract(addr, COORDINATOR_ABI, signerOrProvider);
      setCoordinator(c);
      return c;
    } catch { return null; }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      addLog('MetaMask not found', 'Install MetaMask to continue', 'error');
      return;
    }
    setConnecting(true);
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send('eth_requestAccounts', []);
      const _signer   = await _provider.getSigner();
      const _address  = await _signer.getAddress();
      const _network  = await _provider.getNetwork();

      setProvider(_provider);
      setSigner(_signer);
      setUserAddress(_address);
      setChainId(Number(_network.chainId));

      const saved = JSON.parse(localStorage.getItem('vc_addresses') || '{}');
      if (saved.coordinator) initCoordinator(saved.coordinator, _signer);

      addLog('Wallet connected', _address.slice(0,10)+'...', 'success');
    } catch (e) {
      addLog('Connection failed', e.message?.slice(0,60), 'error');
    } finally {
      setConnecting(false);
    }
  }, [addLog, initCoordinator]);

  const saveAddresses = useCallback((newAddrs) => {
    const merged = { ...addresses, ...newAddrs };
    setAddresses(merged);
    localStorage.setItem('vc_addresses', JSON.stringify(merged));
    if (merged.coordinator && signer) {
      initCoordinator(merged.coordinator, signer);
    }
  }, [addresses, signer, initCoordinator]);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = () => window.location.reload();
    const onChain    = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccounts);
    window.ethereum.on('chainChanged', onChain);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts);
      window.ethereum.removeListener('chainChanged', onChain);
    };
  }, []);

  // Live event listener
  useEffect(() => {
    if (!coordinator) return;
    const onAudit = (caller, action, target, timestamp) => {
      addLog(action, shortAddr(caller) + ' → ' + shortAddr(target), 'success');
    };
    const onUnauth = (caller, action) => {
      addLog('🚫 BLOCKED: ' + action, shortAddr(caller), 'error');
    };
    coordinator.on('AuditLog', onAudit);
    coordinator.on('UnauthorizedAttempt', onUnauth);
    return () => {
      coordinator.off('AuditLog', onAudit);
      coordinator.off('UnauthorizedAttempt', onUnauth);
    };
  }, [coordinator, addLog]);

  return (
    <Web3Context.Provider value={{
      provider, signer, userAddress, chainId,
      coordinator, addresses,
      auditLog, addLog,
      connect, connecting,
      saveAddresses
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside Web3Provider');
  return ctx;
}

function shortAddr(addr) {
  if (!addr) return '?';
  return addr.slice(0,6)+'...'+addr.slice(-4);
}
