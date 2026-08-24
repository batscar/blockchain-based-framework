// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../lib/openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title IdentityRegistry
/// @notice Standalone decentralized identity registry.
///         Every user gets a DID (Decentralized Identifier) string
///         permanently recorded on-chain and linked to their address.
///
/// @dev RBAC roles defined here satisfy the PS requirement:
///      Admin    → DEFAULT_ADMIN_ROLE (deployer) — full control
///      Manager  → MANAGER_ROLE — can verify and revoke identities
///      Auditor  → AUDITOR_ROLE — read-only, queries the full user list
///      User     → USER_ROLE    — auto-granted when identity is registered
///
///      Deployed independently from DeadManSwitch.
///      DeadManSwitchFactory wires them together at deploy time.
contract IdentityRegistry is AccessControl {

    // ─────────────────────────────────────────────────────────
    // 1. ROLES
    // ─────────────────────────────────────────────────────────

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR");
    bytes32 public constant USER_ROLE    = keccak256("USER");

    // ─────────────────────────────────────────────────────────
    // 2. STATE
    // ─────────────────────────────────────────────────────────

    struct Identity {
        string   did;           // e.g. "did:ethr:0xABC..."
        bool     verified;      // set true by a Manager
        bool     active;        // false if revoked by Admin
        uint256  registeredAt;
        uint256  updatedAt;
    }

    mapping(address => Identity) private identities;
    address[] private allUsers;
    mapping(address => bool) private isRegistered;

    // ─────────────────────────────────────────────────────────
    // 3. EVENTS — every operation emits, satisfying PS audit trail
    // ─────────────────────────────────────────────────────────

    event IdentityRegistered(address indexed user, string did, uint256 timestamp);
    event IdentityUpdated(address indexed user, string newDid, uint256 timestamp);
    event IdentityVerified(address indexed user, address indexed manager, uint256 timestamp);
    event IdentityRevoked(address indexed user, address indexed admin, uint256 timestamp);
    event ManagerAdded(address indexed manager, address indexed admin);
    event ManagerRemoved(address indexed manager, address indexed admin);
    event AuditorAdded(address indexed auditor, address indexed admin);

    // ─────────────────────────────────────────────────────────
    // 4. CONSTRUCTOR
    // ─────────────────────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // 5. USER ACTIONS — anyone can register their own DID
    // ─────────────────────────────────────────────────────────

    /// @notice Register a decentralized identifier for your address.
    ///         Calling again updates the DID — does not create a duplicate.
    /// @param _did Format suggestion: "did:ethr:0xYOURADDRESS"
   // AFTER — add a _user parameter
function registerIdentity(address _user, string calldata _did) external {
    require(_user != address(0), "zero address");
    if (!isRegistered[_user]) {
        identities[_user] = Identity({
            did:          _did,
            verified:     false,
            active:       true,
            registeredAt: block.timestamp,
            updatedAt:    block.timestamp
        });
        allUsers.push(_user);
        isRegistered[_user] = true;
        _grantRole(USER_ROLE, _user);
        emit IdentityRegistered(_user, _did, block.timestamp);
    } else {
        identities[_user].did      = _did;
        identities[_user].updatedAt = block.timestamp;
        emit IdentityUpdated(_user, _did, block.timestamp);
    }
}

    // ─────────────────────────────────────────────────────────
    // 6. MANAGER ACTIONS — verify/revoke identities
    // ─────────────────────────────────────────────────────────

    /// @notice Mark an identity as verified (KYC-style confirmation).
    function verifyIdentity(address _user) external onlyRole(MANAGER_ROLE) {
        require(isRegistered[_user], "user not registered");
        require(identities[_user].active, "identity is revoked");
        identities[_user].verified = true;
        emit IdentityVerified(_user, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // 7. ADMIN ACTIONS — role assignment and revocation
    // ─────────────────────────────────────────────────────────

    /// @notice Permanently revoke an identity (only Admin).
    function revokeIdentity(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isRegistered[_user], "user not registered");
        identities[_user].active   = false;
        identities[_user].verified = false;
        _revokeRole(USER_ROLE, _user);
        emit IdentityRevoked(_user, msg.sender, block.timestamp);
    }

    /// @notice Grant MANAGER_ROLE to an address.
    function addManager(address _manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_manager != address(0), "zero address");
        _grantRole(MANAGER_ROLE, _manager);
        emit ManagerAdded(_manager, msg.sender);
    }

    /// @notice Revoke MANAGER_ROLE from an address.
    function removeManager(address _manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MANAGER_ROLE, _manager);
        emit ManagerRemoved(_manager, msg.sender);
    }

    /// @notice Grant AUDITOR_ROLE to an address.
    function addAuditor(address _auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_auditor != address(0), "zero address");
        _grantRole(AUDITOR_ROLE, _auditor);
        emit AuditorAdded(_auditor, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // 8. VIEW HELPERS
    // ─────────────────────────────────────────────────────────

    /// @notice Get the full identity record for any address.
    function getIdentity(address _user) external view returns (Identity memory) {
        return identities[_user];
    }

    /// @notice Quick check — is this address verified?
    function isVerified(address _user) external view returns (bool) {
        return identities[_user].verified && identities[_user].active;
    }

    /// @notice Quick check — is this address registered at all?
    function isUserRegistered(address _user) external view returns (bool) {
        return isRegistered[_user];
    }

    /// @notice Returns the DID string for any address (for frontend display).
    function getDID(address _user) external view returns (string memory) {
        return identities[_user].did;
    }

    /// @notice Full user list — only Auditors can call this.
    ///         Satisfies PS "transparent audit trail" requirement.
    function getAllUsers() external view onlyRole(AUDITOR_ROLE) returns (address[] memory) {
        return allUsers;
    }

    /// @notice Total number of registered identities.
    function totalUsers() external view returns (uint256) {
        return allUsers.length;
    }
}
