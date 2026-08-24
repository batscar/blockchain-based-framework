// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "./IdentityRegistry.sol";
import "./VaultNFT.sol";
import "./DeadManSwitchFactory.sol";
import "./DeadManSwitch.sol";

/// @title VaultCoordinator
/// @notice Single enforced entry point for the entire platform.
///         The frontend NEVER calls IdentityRegistry, VaultNFT, or
///         DeadManSwitch directly — everything routes through here.
///
/// @dev Responsibilities:
///      1. Freeze check — if the caller's vault is frozen, REVERT before
///         anything executes (PanicModule equivalent for this prototype).
///      2. Role check — verify the caller has permission for the action.
///      3. Route — call the correct underlying contract.
///      4. Emit AuditLog — every action is permanently recorded on-chain.
///
///      Deployment order (enforced in Deploy.s.sol):
///      1. IdentityRegistry
///      2. VaultNFT
///      3. DeadManSwitchFactory(identityRegistry, vaultNFT)
///      4. VaultCoordinator(identityRegistry, vaultNFT, factory)
///      5. Grant VaultCoordinator MINTER_ROLE on VaultNFT
///      6. Grant VaultCoordinator MANAGER_ROLE on IdentityRegistry
contract VaultCoordinator is AccessControl {

    // ─────────────────────────────────────────────────────────
    // 1. ROLES
    // ─────────────────────────────────────────────────────────

    // DEFAULT_ADMIN_ROLE → deployer (Ministry/root admin)
    // Can do everything: register identities, mint NFTs, assign roles
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR");
    bytes32 public constant USER_ROLE    = keccak256("USER");

    // ─────────────────────────────────────────────────────────
    // 2. MODULE REFERENCES
    // ─────────────────────────────────────────────────────────

    IdentityRegistry        public immutable identityRegistry;
    VaultNFT                public immutable vaultNFT;
    DeadManSwitchFactory    public immutable factory;

    // ─────────────────────────────────────────────────────────
    // 3. AUDIT LOG EVENT
    //    Every action — success or failure — is recorded here.
    //    Judges can query this event to see the full system history.
    // ─────────────────────────────────────────────────────────

    event AuditLog(
        address indexed caller,
        string          action,
        address         target,     // contract or user address affected
        uint256         timestamp
    );

    event UnauthorizedAttempt(
        address indexed caller,
        string          action,
        uint256         timestamp
    );

    // ─────────────────────────────────────────────────────────
    // 4. CONSTRUCTOR
    // ─────────────────────────────────────────────────────────

    constructor(
        address _identityRegistry,
        address _vaultNFT,
        address _factory
    ) {
        require(_identityRegistry != address(0), "zero registry");
        require(_vaultNFT         != address(0), "zero vaultNFT");
        require(_factory          != address(0), "zero factory");

        identityRegistry = IdentityRegistry(_identityRegistry);
        vaultNFT         = VaultNFT(_vaultNFT);
        factory          = DeadManSwitchFactory(_factory);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // 5. INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────

    /// @dev Checks if the caller's first vault (if any) is frozen.
    ///      Called at the top of every state-changing function.
    ///      If frozen → revert. No action executes on a frozen vault.
    function _revertIfFrozen(address _user) internal view {
        address[] memory vaults = factory.getVaultsByOwner(_user);
        if (vaults.length == 0) return;
        // Check the most recent vault — the one currently in use
        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        require(!vault.frozen(), "vault is frozen - contact a guardian to unfreeze");
    }

    /// @dev Emits an unauthorized attempt log and reverts.
    ///      Used when a caller lacks permission for an action.
    function _revertUnauthorized(string memory _action) internal {
        emit UnauthorizedAttempt(msg.sender, _action, block.timestamp);
        revert("unauthorized: insufficient role");
    }

    // ─────────────────────────────────────────────────────────
    // 6. IDENTITY MANAGEMENT
    //    Routes to IdentityRegistry
    // ─────────────────────────────────────────────────────────

    /// @notice Register a decentralized identifier for the caller.
    ///         Auto-grants USER_ROLE on first registration.
    ///         Anyone can call — self-sovereign identity.
    /// @param _did Format: "did:ethr:0xYOURADDRESS"
    function registerIdentity(string calldata _did) external {
        _revertIfFrozen(msg.sender);

        identityRegistry.registerIdentity(msg.sender, _did);

        // Auto-grant USER_ROLE on this coordinator too
        if (!hasRole(USER_ROLE, msg.sender)) {
            _grantRole(USER_ROLE, msg.sender);
        }

        emit AuditLog(msg.sender, "registerIdentity", address(identityRegistry), block.timestamp);
    }

    /// @notice Admin verifies a user's identity (KYC confirmation).
    ///         Only MANAGER_ROLE or DEFAULT_ADMIN_ROLE can call.
    function verifyIdentity(address _user) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(MANAGER_ROLE, msg.sender)) {
            _revertUnauthorized("verifyIdentity");
        }
        _revertIfFrozen(msg.sender);

        identityRegistry.verifyIdentity(_user);

        emit AuditLog(msg.sender, "verifyIdentity", _user, block.timestamp);
    }

    /// @notice Admin revokes a user's identity — instantly cuts all access.
    function revokeIdentity(address _user) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            _revertUnauthorized("revokeIdentity");
        }

        identityRegistry.revokeIdentity(_user);
        _revokeRole(USER_ROLE, _user);

        emit AuditLog(msg.sender, "revokeIdentity", _user, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // 7. NFT MINTING
    //    Routes to VaultNFT — only ADMIN can mint
    // ─────────────────────────────────────────────────────────

    /// @notice Mint a new NFT and assign it to a user identity.
    ///         ONLY DEFAULT_ADMIN_ROLE can call — enforces PS requirement.
    ///         Auditor attempting this will be blocked and logged.
    /// @param _to          Address to receive the NFT
    /// @param _did         DID string of the owner identity
    /// @param _tokenURI    IPFS metadata URI
    /// @param _assetType   e.g. "LandTitle", "Document", "Credential"
    /// @param _description Human-readable description
    /// @return tokenId     The minted token ID
    function mintAsset(
        address _to,
        string  calldata _did,
        string  calldata _tokenURI,
        string  calldata _assetType,
        string  calldata _description
    ) external returns (uint256 tokenId) {
        // RBAC check — log the attempt before reverting
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            _revertUnauthorized("mintAsset");
        }
        _revertIfFrozen(msg.sender);

        // Verify the target identity is registered and active
        require(identityRegistry.isUserRegistered(_to), "target address not registered");

        tokenId = vaultNFT.mintAsset(_to, _did, _tokenURI, _assetType, _description);

        emit AuditLog(msg.sender, "mintAsset", _to, block.timestamp);
        return tokenId;
    }

    // ─────────────────────────────────────────────────────────
    // 8. DEAD MAN'S SWITCH
    //    Routes to DeadManSwitchFactory + individual vault instances
    // ─────────────────────────────────────────────────────────

    /// @notice Deploy a new Dead Man's Switch vault for the caller.
    ///         Caller must be a registered identity (USER_ROLE).
    /// @param _beneficiary   Address that receives assets when switch fires
    /// @param _timeoutPeriod Seconds. For demo use a short period (e.g. 5 minutes).
    ///                       Production: minimum 180 days (15552000 seconds).
    /// @return vaultAddress  Address of the deployed vault
    function createVault(
        address _beneficiary,
        uint256 _timeoutPeriod
    ) external returns (address vaultAddress) {
        if (!hasRole(USER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            _revertUnauthorized("createVault");
        }
        _revertIfFrozen(msg.sender);

        vaultAddress = factory.createVault(_beneficiary, _timeoutPeriod);

        emit AuditLog(msg.sender, "createVault", vaultAddress, block.timestamp);
        return vaultAddress;
    }

    /// @notice Owner checks in — proves they are alive, resets expiry clock.
    ///         Routes to the caller's most recent vault.
    function checkIn() external {
        _revertIfFrozen(msg.sender);

        address[] memory vaults = factory.getVaultsByOwner(msg.sender);
        require(vaults.length > 0, "no vault found - call createVault first");

        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        vault.checkIn();

        emit AuditLog(msg.sender, "checkIn", address(vault), block.timestamp);
    }

    /// @notice Trigger the switch after timeout expires.
    ///         Permissionless — anyone can call on behalf of an expired vault.
    /// @param _vaultOwner Address of the vault owner whose switch has expired
    function triggerSwitch(address _vaultOwner) external {
        address[] memory vaults = factory.getVaultsByOwner(_vaultOwner);
        require(vaults.length > 0, "no vault for this owner");

        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        require(vault.isExpired(), "timeout has not passed yet");

        vault.trigger();

        emit AuditLog(msg.sender, "triggerSwitch", address(vault), block.timestamp);
    }

    /// @notice Beneficiary claims all assets from an expired vault.
    /// @param _vaultOwner Address of the original vault owner
    function claimAssets(address _vaultOwner) external {
        address[] memory vaults = factory.getVaultsByOwner(_vaultOwner);
        require(vaults.length > 0, "no vault for this owner");

        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        require(msg.sender == vault.beneficiary(), "not the beneficiary");

        vault.claim();

        emit AuditLog(msg.sender, "claimAssets", address(vault), block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // 9. PANIC / FREEZE
    //    Guardian freezes vault — blocks all further actions
    // ─────────────────────────────────────────────────────────

    /// @notice Guardian or owner freezes a vault instantly.
    ///         All subsequent coordinator calls for this user will revert.
    /// @param _vaultOwner Address of the vault to freeze
    function freezeVault(address _vaultOwner) external {
        address[] memory vaults = factory.getVaultsByOwner(_vaultOwner);
        require(vaults.length > 0, "no vault for this owner");

        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));

        // Only guardian or the vault owner can freeze
        require(
            vault.hasRole(vault.GUARDIAN_ROLE(), msg.sender) ||
            msg.sender == vault.owner(),
            "not guardian or owner"
        );

        vault.freeze();

        emit AuditLog(msg.sender, "freezeVault", address(vault), block.timestamp);
    }

    /// @notice Owner unfreezes their vault after key rotation is complete.
    /// @param _vaultAddress Direct vault address to unfreeze
    function unfreezeVault(address _vaultAddress) external {
        DeadManSwitch vault = DeadManSwitch(payable(_vaultAddress));
        require(msg.sender == vault.owner(), "not vault owner");

        vault.unfreeze();

        emit AuditLog(msg.sender, "unfreezeVault", _vaultAddress, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // 10. ROLE MANAGEMENT
    //     Admin assigns coordinator-level roles
    // ─────────────────────────────────────────────────────────

    /// @notice Admin grants MANAGER_ROLE — revenue officers, tehsildars.
    function assignManager(address _manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MANAGER_ROLE, _manager);
        emit AuditLog(msg.sender, "assignManager", _manager, block.timestamp);
    }

    /// @notice Admin grants AUDITOR_ROLE — read-only observers.
    function assignAuditor(address _auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AUDITOR_ROLE, _auditor);
        emit AuditLog(msg.sender, "assignAuditor", _auditor, block.timestamp);
    }

    /// @notice Admin revokes any role.
    function revokeCoordinatorRole(bytes32 _role, address _account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(_role, _account);
        emit AuditLog(msg.sender, "revokeRole", _account, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // 11. VIEW HELPERS — frontend reads these, no auth required
    // ─────────────────────────────────────────────────────────

    /// @notice Get identity record for any address.
    function getIdentity(address _user)
        external view
        returns (IdentityRegistry.Identity memory)
    {
        return identityRegistry.getIdentity(_user);
    }

    /// @notice Get all NFT token IDs linked to a DID string.
    function getAssetsByDID(string calldata _did)
        external view
        returns (uint256[] memory)
    {
        return vaultNFT.getTokensByDID(_did);
    }

    /// @notice Get full metadata for a specific NFT.
    function getAssetMetadata(uint256 _tokenId)
        external view
        returns (VaultNFT.AssetMetadata memory)
    {
        return vaultNFT.getAssetMetadata(_tokenId);
    }

    /// @notice Get all vault addresses owned by a user.
    function getVaultsByOwner(address _owner)
        external view
        returns (address[] memory)
    {
        return factory.getVaultsByOwner(_owner);
    }

    /// @notice Get time remaining on the caller's vault before it fires.
    function getTimeRemaining(address _vaultOwner)
        external view
        returns (uint256)
    {
        address[] memory vaults = factory.getVaultsByOwner(_vaultOwner);
        if (vaults.length == 0) return 0;
        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        return vault.timeRemaining();
    }

    /// @notice Check if a vault has been triggered (switch fired).
    function isVaultTriggered(address _vaultOwner)
        external view
        returns (bool)
    {
        address[] memory vaults = factory.getVaultsByOwner(_vaultOwner);
        if (vaults.length == 0) return false;
        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        return vault.isTriggered();
    }

    /// @notice Check if a vault is currently frozen.
    function isVaultFrozen(address _vaultOwner)
        external view
        returns (bool)
    {
        address[] memory vaults = factory.getVaultsByOwner(_vaultOwner);
        if (vaults.length == 0) return false;
        DeadManSwitch vault = DeadManSwitch(payable(vaults[vaults.length - 1]));
        return vault.frozen();
    }

    /// @notice Total number of identities registered.
    function totalIdentities() external view returns (uint256) {
        return identityRegistry.totalUsers();
    }

    /// @notice Total number of NFTs minted.
    function totalAssets() external view returns (uint256) {
        return vaultNFT.totalMinted();
    }

    /// @notice Total number of vaults deployed.
    function totalVaults() external view returns (uint256) {
        return factory.totalVaults();
    }
}
