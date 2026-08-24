// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDeadManSwitch
/// @notice Interface that all three contracts (DeadManSwitch, IdentityRegistry,
///         VaultNFT) implement or reference. The Factory uses this to wire them
///         together. The frontend can use this to understand the full ABI surface.
interface IDeadManSwitch {

    // ─────────────────────────────────────────────────────────
    // ENUMS
    // ─────────────────────────────────────────────────────────

    enum Status { Active, Expired, Claimed }

    // ─────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────

    event CheckedIn(address indexed owner, uint256 timestamp);
    event Deposited(address indexed sender, uint256 amount);
    event Triggered(uint256 timestamp);
    event Expired(uint256 timestamp);
    event Withdrawn(address indexed beneficiary, uint256 amount);
    event VaultFrozen(address indexed guardian, uint256 timestamp);
    event VaultUnfrozen(address indexed admin, uint256 timestamp);

    // ─────────────────────────────────────────────────────────
    // CORE FUNCTIONS
    // ─────────────────────────────────────────────────────────

    function checkIn() external;
    function deposit() external payable;

    // Expiry
    function markExpired() external;
    function trigger() external;
    function isExpired() external view returns (bool);

    // Claim
    function claim() external;
    function withdraw() external;

    // Freeze
    function freeze() external;
    function unfreeze() external;

    // ─────────────────────────────────────────────────────────
    // VIEW HELPERS
    // ─────────────────────────────────────────────────────────

    function isTriggered() external view returns (bool);
    function timeRemaining() external view returns (uint256);
    function status() external view returns (Status);
    function owner() external view returns (address);
    function beneficiary() external view returns (address);
    function lastCheckIn() external view returns (uint256);
    function timeoutPeriod() external view returns (uint256);
    function frozen() external view returns (bool);
}
