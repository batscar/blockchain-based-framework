// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "../lib/openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title VaultNFT
/// @notice ERC721 contract where only authorized admins/managers can mint.
///         Each NFT is permanently linked to a user's DID on-chain.
///         Satisfies PS requirement: "only authorized administrators are
///         allowed to create NFTs and assign them to user identities."
///
/// @dev RBAC:
///      DEFAULT_ADMIN_ROLE → can add/remove minters, burn NFTs
///      MINTER_ROLE        → can mint new NFTs and assign to identities
///
///      NFTs deposited into DeadManSwitch vault transfer to beneficiary
///      on claim, using the existing ERC721 deposit/claim flow.
contract VaultNFT is ERC721, ERC721URIStorage, AccessControl {

    // ─────────────────────────────────────────────────────────
    // 1. ROLES
    // ─────────────────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE = keccak256("MINTER");

    // ─────────────────────────────────────────────────────────
    // 2. STATE
    // ─────────────────────────────────────────────────────────

    uint256 private _tokenIdCounter;

    struct AssetMetadata {
        string  did;              // DID of the identity this NFT belongs to
        string  assetType;        // e.g. "Document", "Property", "Credential"
        string  description;      // human-readable description
        address mintedBy;         // admin/manager who minted
        uint256 mintedAt;         // block timestamp of mint
    }

    // tokenId → metadata
    mapping(uint256 => AssetMetadata) public assetMetadata;

    // DID → list of tokenIds owned under that identity
    mapping(string => uint256[]) private didToTokens;

    // tokenId → whether it has been burned
    mapping(uint256 => bool) public isBurned;

    // ─────────────────────────────────────────────────────────
    // 3. EVENTS
    // ─────────────────────────────────────────────────────────

    event AssetMinted(
        address indexed to,
        uint256 indexed tokenId,
        string  did,
        string  assetType,
        address indexed mintedBy,
        uint256 timestamp
    );
    event AssetBurned(uint256 indexed tokenId, address indexed burnedBy, uint256 timestamp);
    event AssetTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event MinterAdded(address indexed minter, address indexed admin);
    event MinterRemoved(address indexed minter, address indexed admin);

    // ─────────────────────────────────────────────────────────
    // 4. CONSTRUCTOR
    // ─────────────────────────────────────────────────────────

    constructor() ERC721("VaultNFT", "VNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // 5. MINTER ACTIONS — only authorized roles can create NFTs
    // ─────────────────────────────────────────────────────────

    /// @notice Mint a new NFT and assign it to a user identity.
    /// @param _to          Address to receive the NFT
    /// @param _did         DID of the identity this NFT represents
    /// @param _tokenURI    Metadata URI (IPFS link or on-chain JSON)
    /// @param _assetType   Category — "Document", "Property", "Credential", etc.
    /// @param _description Human-readable description of the asset
    /// @return tokenId     The ID of the newly minted NFT
    function mintAsset(
        address _to,
        string  memory _did,
        string  memory _tokenURI,
        string  memory _assetType,
        string  memory _description
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(_to != address(0), "zero address");
        require(bytes(_did).length > 0, "DID required");
        require(bytes(_assetType).length > 0, "asset type required");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        assetMetadata[tokenId] = AssetMetadata({
            did:         _did,
            assetType:   _assetType,
            description: _description,
            mintedBy:    msg.sender,
            mintedAt:    block.timestamp
        });

        didToTokens[_did].push(tokenId);

        emit AssetMinted(_to, tokenId, _did, _assetType, msg.sender, block.timestamp);
        return tokenId;
    }

    // ─────────────────────────────────────────────────────────
    // 6. ADMIN ACTIONS
    // ─────────────────────────────────────────────────────────

    /// @notice Burn (permanently destroy) an NFT — admin only.
    function burn(uint256 _tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isBurned[_tokenId], "already burned");
        isBurned[_tokenId] = true;
        _burn(_tokenId);
        emit AssetBurned(_tokenId, msg.sender, block.timestamp);
    }

    /// @notice Grant MINTER_ROLE to an address (admin only).
    function addMinter(address _minter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minter != address(0), "zero address");
        _grantRole(MINTER_ROLE, _minter);
        emit MinterAdded(_minter, msg.sender);
    }

    /// @notice Revoke MINTER_ROLE from an address (admin only).
    function removeMinter(address _minter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, _minter);
        emit MinterRemoved(_minter, msg.sender);
    }

    // ─────────────────────────────────────────────────────────
    // 7. VIEW HELPERS
    // ─────────────────────────────────────────────────────────

    /// @notice Get full metadata for a token.
    function getAssetMetadata(uint256 _tokenId)
        external view returns (AssetMetadata memory)
    {
        return assetMetadata[_tokenId];
    }

    /// @notice Get all token IDs linked to a specific DID.
    function getTokensByDID(string calldata _did)
        external view returns (uint256[] memory)
    {
        return didToTokens[_did];
    }

    /// @notice Total number of NFTs minted (including burned ones).
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ─────────────────────────────────────────────────────────
    // 8. REQUIRED OVERRIDES
    // ─────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
