// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/VaultCoordinator.sol";
import "../src/DeadManSwitch.sol";
import "../src/DeadManSwitchFactory.sol";

/// @title Seed
/// @notice Loads the Arjun demo scenario on Sepolia for the SIH presentation.
///         Run AFTER Deploy.s.sol has completed and addresses are in sepolia.json.
///
/// Demo scenario seeded:
///   - Arjun's identity registered + verified
///   - Vikram's identity registered (beneficiary)
///   - Auditor Meera registered
///   - Land title NFT minted to Arjun's DID
///   - Arjun's Dead Man's Switch created with Vikram as beneficiary
///     (SHORT timeout = 5 minutes so judges can see it fire live)
///
/// Usage:
///   forge script script/Seed.s.sol \
///     --rpc-url $SEPOLIA_RPC \
///     --broadcast \
///     -vvvv
contract Seed is Script {

    // ─────────────────────────────────────────────────────────
    // DEMO ADDRESSES — replace with your actual test wallets
    // These should match MetaMask accounts you'll switch between
    // during the live demo.
    // ─────────────────────────────────────────────────────────

    // Arjun — vault owner, will check in, then stop checking in
    address constant ARJUN   = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    // Vikram — Arjun's son, beneficiary, will call claimAssets
    address constant VIKRAM  = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    // Meera — Auditor, will query successfully but fail to mint
    address constant MEERA   = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    // ─────────────────────────────────────────────────────────
    // SHORT TIMEOUT for demo — 5 minutes
    // In production this would be 180 days.
    // ─────────────────────────────────────────────────────────
    uint256 constant DEMO_TIMEOUT = 5 minutes;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        // Load deployed coordinator address from env
        address coordinatorAddr = vm.envAddress("REACT_APP_COORDINATOR_ADDRESS");
        VaultCoordinator coordinator = VaultCoordinator(coordinatorAddr);

        console.log("===========================================");
        console.log("  SIH Demo Seed - Arjun Story");
        console.log("===========================================");
        console.log("Coordinator: ", coordinatorAddr);
        console.log("Deployer:    ", deployer);
        console.log("");

        vm.startBroadcast(deployerKey);

        // ─────────────────────────────────────────────────────
        // STEP 1 — Register identities
        // ─────────────────────────────────────────────────────

        // Arjun's DID
        vm.stopBroadcast();
        vm.startBroadcast(vm.envUint("ARJUN_KEY"));
        coordinator.registerIdentity("did:ethr:arjun-nashik-001");
        console.log("1. Arjun identity registered: did:ethr:arjun-nashik-001");

        // Vikram's DID
        vm.stopBroadcast();
        vm.startBroadcast(vm.envUint("VIKRAM_KEY"));
        coordinator.registerIdentity("did:ethr:vikram-nashik-001");
        console.log("2. Vikram identity registered: did:ethr:vikram-nashik-001");

        // Meera's DID (Auditor)
        vm.stopBroadcast();
        vm.startBroadcast(vm.envUint("MEERA_KEY"));
        coordinator.registerIdentity("did:ethr:meera-auditor-001");
        console.log("3. Meera identity registered:  did:ethr:meera-auditor-001");

        // ─────────────────────────────────────────────────────
        // STEP 2 — Admin: verify Arjun, assign Meera as Auditor
        // ─────────────────────────────────────────────────────
        vm.stopBroadcast();
        vm.startBroadcast(deployerKey);

        coordinator.verifyIdentity(ARJUN);
        console.log("4. Arjun identity verified (KYC confirmed)");

        coordinator.assignAuditor(MEERA);
        console.log("5. Meera assigned AUDITOR_ROLE");

        // ─────────────────────────────────────────────────────
        // STEP 3 — Mint land title NFT to Arjun
        //          Only admin (deployer) can do this
        // ─────────────────────────────────────────────────────
        uint256 tokenId = coordinator.mintAsset(
            ARJUN,
            "did:ethr:arjun-nashik-001",
            "ipfs://QmNashikSurvey42LandTitle",   // replace with real IPFS hash
            "LandTitle",
            "4 acres farmland, Survey No. 42, Nashik, Maharashtra"
        );
        console.log("6. Land title NFT minted - tokenId:", tokenId);
        console.log("   Owner DID: did:ethr:arjun-nashik-001");
        console.log("   IPFS URI:  ipfs://QmNashikSurvey42LandTitle");

        vm.stopBroadcast();

        // ─────────────────────────────────────────────────────
        // STEP 4 — Arjun creates his Dead Man's Switch
        //          Beneficiary = Vikram, timeout = 5 minutes (demo)
        // ─────────────────────────────────────────────────────
        vm.startBroadcast(vm.envUint("ARJUN_KEY"));

        address vaultAddr = coordinator.createVault(VIKRAM, DEMO_TIMEOUT);
        console.log("7. Arjun's Dead Man's Switch vault deployed:", vaultAddr);
        console.log("   Beneficiary: Vikram (", VIKRAM, ")");
        console.log("   Timeout:     5 minutes (demo mode)");

        // Arjun checks in (proves alive at setup)
        coordinator.checkIn();
        console.log("8. Arjun checked in -clock started");

        vm.stopBroadcast();

        // ─────────────────────────────────────────────────────
        // SUMMARY
        // ─────────────────────────────────────────────────────
        console.log("");
        console.log("===========================================");
        console.log("  SEED COMPLETE - Demo Ready");
        console.log("===========================================");
        console.log("");
        console.log("LIVE DEMO SEQUENCE:");
        console.log("-------------------------------------------");
        console.log("1. [ADMIN]    Show Arjun's identity on IdentityPanel");
        console.log("2. [ADMIN]    Show Token #", tokenId, "on AssetDashboard");
        console.log("3. [MEERA]    Query getAssetsByDID - succeeds (Auditor)");
        console.log("4. [MEERA]    Try mintAsset - REVERTS + UnauthorizedAttempt logged");
        console.log("5. [WAIT]     Wait 5 minutes (or warp in test)");
        console.log("6. [ANYONE]   Call triggerSwitch(ARJUN) - switch fires");
        console.log("7. [VIKRAM]   Call claimAssets(ARJUN) - inherits vault");
        console.log("8. [ADMIN]    Show full AuditLog on screen");
        console.log("");
        console.log("Vault address: ", vaultAddr);
        console.log("Token ID:      ", tokenId);
    }
}
