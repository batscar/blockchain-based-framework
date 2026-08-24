export const COORDINATOR_ABI = [
  // Identity
  "function registerIdentity(string calldata _did) external",
  "function verifyIdentity(address _user) external",
  "function revokeIdentity(address _user) external",
  "function getIdentity(address _user) external view returns (tuple(string did, bool verified, bool active, uint256 registeredAt, uint256 updatedAt))",
  // Roles
  "function assignManager(address _manager) external",
  "function assignAuditor(address _auditor) external",
  "function revokeCoordinatorRole(bytes32 _role, address _account) external",
  // NFT
  "function mintAsset(address _to, string calldata _did, string calldata _tokenURI, string calldata _assetType, string calldata _description) external returns (uint256)",
  "function getAssetsByDID(string calldata _did) external view returns (uint256[])",
  "function getAssetMetadata(uint256 _tokenId) external view returns (tuple(string did, string assetType, string description, address mintedBy, uint256 mintedAt))",
  // DMS
  "function createVault(address _beneficiary, uint256 _timeoutPeriod) external returns (address)",
  "function checkIn() external",
  "function triggerSwitch(address _vaultOwner) external",
  "function claimAssets(address _vaultOwner) external",
  "function freezeVault(address _vaultOwner) external",
  "function unfreezeVault(address _vaultAddress) external",
  "function getVaultsByOwner(address _owner) external view returns (address[])",
  "function getTimeRemaining(address _vaultOwner) external view returns (uint256)",
  "function isVaultTriggered(address _vaultOwner) external view returns (bool)",
  "function isVaultFrozen(address _vaultOwner) external view returns (bool)",
  // Stats
  "function totalIdentities() external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalVaults() external view returns (uint256)",
  // Events
  "event AuditLog(address indexed caller, string action, address target, uint256 timestamp)",
  "event UnauthorizedAttempt(address indexed caller, string action, uint256 timestamp)"
];

export const DMS_ABI = [
  "function owner() external view returns (address)",
  "function beneficiary() external view returns (address)",
  "function timeoutPeriod() external view returns (uint256)",
  "function lastCheckIn() external view returns (uint256)",
  "function status() external view returns (uint8)",
  "function frozen() external view returns (bool)",
  "function isExpired() external view returns (bool)",
  "function timeRemaining() external view returns (uint256)"
];
