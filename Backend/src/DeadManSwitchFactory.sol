// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DeadManSwitch.sol";
import "./IdentityRegistry.sol";
import "./VaultNFT.sol";

/// @title DeadManSwitchFactory
/// @notice Deploys a complete Dead Man Switch system for any user:
///         one DeadManSwitch vault + wires it to the shared
///         IdentityRegistry and VaultNFT contracts.
///
/// @dev The Factory is deployed once. IdentityRegistry and VaultNFT
///      are also deployed once (shared across all vaults).
///      Each user calls createVault() to get their own vault instance.
///
///      Deployment order:
///      1. Deploy IdentityRegistry
///      2. Deploy VaultNFT
///      3. Deploy DeadManSwitchFactory(identityRegistry, vaultNFT)
///      4. Users call factory.createVault(beneficiary, timeout)
contract DeadManSwitchFactory {

    // ─────────────────────────────────────────────────────────
    // 1. STATE
    // ─────────────────────────────────────────────────────────

    address public immutable admin;
    IdentityRegistry public immutable identityRegistry;
    VaultNFT public immutable vaultNFT;

    // All vaults ever deployed
    address[] public allVaults;

    // Owner address → their vault addresses
    mapping(address => address[]) public vaultsByOwner;

    // Vault address → owner address (reverse lookup)
    mapping(address => address) public ownerOfVault;

    // ─────────────────────────────────────────────────────────
    // 2. EVENTS
    // ─────────────────────────────────────────────────────────

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        address indexed beneficiary,
        uint256 timeoutPeriod,
        uint256 timestamp
    );

    event SystemDeployed(
        address indexed admin,
        address identityRegistry,
        address vaultNFT,
        address factory,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────
    // 3. CONSTRUCTOR
    // ─────────────────────────────────────────────────────────

    /// @param _identityRegistry Address of the deployed IdentityRegistry
    /// @param _vaultNFT         Address of the deployed VaultNFT
    constructor(address _identityRegistry, address _vaultNFT) {
        require(_identityRegistry != address(0), "zero registry address");
        require(_vaultNFT != address(0), "zero vaultNFT address");

        admin            = msg.sender;
        identityRegistry = IdentityRegistry(_identityRegistry);
        vaultNFT         = VaultNFT(_vaultNFT);

        emit SystemDeployed(
            msg.sender,
            _identityRegistry,
            _vaultNFT,
            address(this),
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────────────
    // 4. CORE — create a vault
    // ─────────────────────────────────────────────────────────

    /// @notice Deploy a new DeadManSwitch vault.
    ///         The caller becomes the vault owner automatically.
    /// @param _beneficiary   Address that receives assets when switch fires
    /// @param _timeoutPeriod Seconds before the switch fires (min 7 days for prod)
    /// @return vaultAddress  Address of the newly deployed vault
    function createVault(
        address _beneficiary,
        uint256 _timeoutPeriod
    ) external returns (address vaultAddress) {
        require(_beneficiary != address(0), "zero beneficiary");
        require(_timeoutPeriod > 0, "timeout must be > 0");

        // Pass msg.sender as the explicit owner so the vault grants
        // DEFAULT_ADMIN_ROLE to the real user, not to this factory contract.
        DeadManSwitch vault = new DeadManSwitch(
            msg.sender,
            _beneficiary,
            _timeoutPeriod
        );

        vaultAddress = address(vault);
        allVaults.push(vaultAddress);
        vaultsByOwner[msg.sender].push(vaultAddress);
        ownerOfVault[vaultAddress] = msg.sender;

        emit VaultCreated(
            msg.sender,
            vaultAddress,
            _beneficiary,
            _timeoutPeriod,
            block.timestamp
        );

        return vaultAddress;
    }

    // ─────────────────────────────────────────────────────────
    // 5. VIEW HELPERS
    // ─────────────────────────────────────────────────────────

    /// @notice Get all vaults created by a specific owner.
    function getVaultsByOwner(address _owner)
        external view returns (address[] memory)
    {
        return vaultsByOwner[_owner];
    }

    /// @notice Get every vault ever deployed through this factory.
    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }

    /// @notice Total number of vaults deployed.
    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Check if an address is a vault deployed by this factory.
    function isFactoryVault(address _vault) external view returns (bool) {
        return ownerOfVault[_vault] != address(0);
    }

    /// @notice Convenience — get the identity DID for any address via registry.
    function getIdentityOf(address _user) external view returns (string memory) {
        return identityRegistry.getDID(_user);
    }

    /// @notice Convenience — check if a user's identity is verified.
    function isUserVerified(address _user) external view returns (bool) {
        return identityRegistry.isVerified(_user);
    }
}
