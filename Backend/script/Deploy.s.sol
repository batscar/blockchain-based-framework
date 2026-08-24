// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/IdentityRegistry.sol";
import "../src/VaultNFT.sol";
import "../src/DeadManSwitchFactory.sol";
import "../src/VaultCoordinator.sol";

/// @title Deploy
/// @notice Deploys the full platform in dependency order.
///         Run on Sepolia for demo, Polygon PoS for production.
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url $SEPOLIA_RPC \
///     --broadcast \
///     --verify \
///     -vvvv
///
/// After running, copy the logged addresses into frontend/.env
contract Deploy is Script {

    // ─────────────────────────────────────────────────────────
    // Deployed contract references (set during run)
    // ─────────────────────────────────────────────────────────
    IdentityRegistry     public identityRegistry;
    VaultNFT             public vaultNFT;
    DeadManSwitchFactory public factory;
    VaultCoordinator     public coordinator;

    function run() external {
        // Load deployer private key from .env
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("===========================================");
        console.log("  SIH Prototype - Full Deploy");
        console.log("===========================================");
        console.log("Deployer:   ", deployer);
        console.log("Chain ID:   ", block.chainid);
        console.log("Block:      ", block.number);
        console.log("");

        vm.startBroadcast(deployerKey);

        // ─────────────────────────────────────────────────────
        // STEP 1 — IdentityRegistry
        //          No dependencies. Deploy first.
        // ─────────────────────────────────────────────────────
        identityRegistry = new IdentityRegistry();
        console.log("1. IdentityRegistry:     ", address(identityRegistry));

        // ─────────────────────────────────────────────────────
        // STEP 2 — VaultNFT
        //          No dependencies. Deploy second.
        // ─────────────────────────────────────────────────────
        vaultNFT = new VaultNFT();
        console.log("2. VaultNFT:             ", address(vaultNFT));

        // ─────────────────────────────────────────────────────
        // STEP 3 — DeadManSwitchFactory
        //          Depends on: IdentityRegistry, VaultNFT
        // ─────────────────────────────────────────────────────
        factory = new DeadManSwitchFactory(
            address(identityRegistry),
            address(vaultNFT)
        );
        console.log("3. DeadManSwitchFactory: ", address(factory));

        // ─────────────────────────────────────────────────────
        // STEP 4 — VaultCoordinator
        //          Depends on: all three above
        // ─────────────────────────────────────────────────────
        coordinator = new VaultCoordinator(
            address(identityRegistry),
            address(vaultNFT),
            address(factory)
        );
        console.log("4. VaultCoordinator:     ", address(coordinator));

        // ─────────────────────────────────────────────────────
        // STEP 5 — Wire permissions
        //          VaultCoordinator needs MINTER_ROLE on VaultNFT
        //          so it can call mintAsset() on behalf of admins.
        //
        //          VaultCoordinator needs MANAGER_ROLE on IdentityRegistry
        //          so it can call verifyIdentity() and revokeIdentity().
        // ─────────────────────────────────────────────────────
        vaultNFT.addMinter(address(coordinator));
        console.log("5. Granted MINTER_ROLE   -> VaultCoordinator on VaultNFT");

        identityRegistry.addManager(address(coordinator));
        console.log("6. Granted MANAGER_ROLE  -> VaultCoordinator on IdentityRegistry");

        vm.stopBroadcast();

        // ─────────────────────────────────────────────────────
        // PRINT SUMMARY — copy these into frontend/.env
        // ─────────────────────────────────────────────────────
        console.log("");
        console.log("===========================================");
        console.log("  DEPLOYMENT COMPLETE - copy to .env");
        console.log("===========================================");
        console.log("");
        console.log("REACT_APP_COORDINATOR_ADDRESS=",      address(coordinator));
        console.log("REACT_APP_IDENTITY_REGISTRY_ADDRESS=", address(identityRegistry));
        console.log("REACT_APP_VAULT_NFT_ADDRESS=",         address(vaultNFT));
        console.log("REACT_APP_FACTORY_ADDRESS=",           address(factory));
        console.log("REACT_APP_CHAIN_ID=31337");
        console.log("REACT_APP_RPC_URL=http://127.0.0.1:8545");
        console.log("");
        console.log("===========================================");
        console.log("  Next: run Seed.s.sol to load demo data");
        console.log("===========================================");

        // Write addresses to a JSON file for automated frontend pickup
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "coordinator":       "', vm.toString(address(coordinator)),       '",\n',
            '  "identityRegistry":  "', vm.toString(address(identityRegistry)),  '",\n',
            '  "vaultNFT":          "', vm.toString(address(vaultNFT)),          '",\n',
            '  "factory":           "', vm.toString(address(factory)),           '",\n',
            '  "chainId":           "31337"\n',
            '}'
        ));
        vm.writeFile("deployments/sepolia.json", json);
        console.log("Addresses written to deployments/sepolia.json");
    }
}
