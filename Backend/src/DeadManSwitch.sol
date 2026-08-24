// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC721/utils/ERC721Holder.sol";

/// @title DeadManSwitch — frontend-compatible
/// @notice Owner deposits ETH and must check in periodically.
///         If the timeout passes, the beneficiary can claim the funds.
/// @dev Expanded from the core version to match the frontend ABI:
///      - beneficiary and timeoutPeriod are mutable (owner-controlled)
///      - withdraw() alias for claim()
///      - trigger() alias for markExpired()
///      - setBeneficiary() with 48-hour timelock
///      - setTimeoutPeriod() with 48-hour timelock
///      - isTriggered() view helper
///      - CheckedIn event includes indexed owner address
///      - Triggered event emitted alongside Expired
///      - RBAC via OpenZeppelin AccessControl (Guardian, Auditor roles)
///      - ERC721 NFT deposit and claim
///      - DID identity managed externally via IdentityRegistry
///      - owner passed explicitly so Factory can deploy on behalf of users
contract DeadManSwitch is AccessControl, ERC721Holder {

    // ─────────────────────────────────────────────────────────
    // 1. STATE
    // ─────────────────────────────────────────────────────────

    enum Status { Active, Expired, Claimed }

    // -- RBAC Roles --
    // DEFAULT_ADMIN_ROLE is inherited from AccessControl (owner gets this)
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN");
    bytes32 public constant AUDITOR_ROLE  = keccak256("AUDITOR");
    bytes32 public constant MANAGER_ROLE  = keccak256("MANAGER");
    bytes32 public constant USER_ROLE     = keccak256("USER");

    // -- Roles --
    address public immutable owner;
    address public beneficiary;

    // -- Panic freeze --
    bool public frozen;

    // -- NFT tracking --
    struct NFTDeposit {
        address contractAddress;
        uint256 tokenId;
    }
    NFTDeposit[] public depositedNFTs;

    // -- Timing --
    uint256 public lastCheckIn;
    uint256 public timeoutPeriod;

    // -- Lifecycle --
    Status public status;

    // -- Timelocks for sensitive changes (48 hours) --
    uint256 private constant TIMELOCK_DELAY = 48 hours;

    address public pendingBeneficiary;
    uint256 public beneficiaryUnlockAt;

    uint256 public pendingTimeoutPeriod;
    uint256 public timeoutUnlockAt;

    // ─────────────────────────────────────────────────────────
    // 2. EVENTS
    // ─────────────────────────────────────────────────────────

    /// @dev Frontend expects: CheckedIn(address indexed owner, uint256 timestamp)
    event CheckedIn(address indexed owner, uint256 timestamp);

    event Deposited(address indexed sender, uint256 amount);

    /// @dev Frontend expects: Triggered(uint256 timestamp)
    event Triggered(uint256 timestamp);

    /// @dev Kept alongside Triggered for on-chain clarity
    event Expired(uint256 timestamp);

    /// @dev Frontend expects: Withdrawn(address indexed beneficiary, uint256 amount)
    event Withdrawn(address indexed beneficiary, uint256 amount);

    event BeneficiaryUpdated(address indexed newBeneficiary);
    event TimeoutUpdated(uint256 newPeriod);

    // NFT events
    event NFTDeposited(address indexed contractAddress, uint256 indexed tokenId, address indexed sender);
    event NFTClaimed(address indexed contractAddress, uint256 indexed tokenId, address indexed beneficiary);

    // Guardian / panic events
    event VaultFrozen(address indexed guardian, uint256 timestamp);
    event VaultUnfrozen(address indexed admin, uint256 timestamp);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);

    // Role management events
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);
    event UserAdded(address indexed user);
    event UserRemoved(address indexed user);
    event AuditorAdded(address indexed auditor);

    // Timelock queue events
    event BeneficiaryQueued(address indexed newBeneficiary, uint256 unlocksAt);
    event TimeoutQueued(uint256 newPeriod, uint256 unlocksAt);

    // Timelock cancellation events
    event BeneficiaryCancelled(address indexed cancelledPending);
    event TimeoutCancelled(uint256 cancelledPending);

    // ─────────────────────────────────────────────────────────
    // 3. MODIFIERS
    // ─────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "not beneficiary");
        _;
    }

    modifier inStatus(Status required) {
        require(status == required, "wrong status for this action");
        _;
    }

    modifier notFrozen() {
        require(!frozen, "vault_is_frozen - contact a guardian");
        _;
    }

    // ─────────────────────────────────────────────────────────
    // 4. CONSTRUCTOR
    // ─────────────────────────────────────────────────────────

    /// @param _owner         The real user who will own this vault.
    ///                       Passed explicitly so the Factory can deploy
    ///                       on behalf of a user without stealing ownership.
    /// @param _beneficiary   Address that receives assets when switch fires.
    /// @param _timeoutPeriod Seconds before the switch fires.
    constructor(address _owner, address _beneficiary, uint256 _timeoutPeriod) {
        require(_owner != address(0),       "owner cannot be zero address");
        require(_beneficiary != address(0), "beneficiary cannot be zero address");
        require(_timeoutPeriod > 0,         "timeout must be > 0");

        owner         = _owner;
        beneficiary   = _beneficiary;
        timeoutPeriod = _timeoutPeriod;
        lastCheckIn   = block.timestamp;
        status        = Status.Active;

        // Grant the real user (not the factory) full admin rights
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    // ─────────────────────────────────────────────────────────
    // 5. OWNER ACTIONS
    // ─────────────────────────────────────────────────────────

    /// @notice Proof of life. Resets the expiry clock.
    function checkIn() external onlyOwner inStatus(Status.Active) notFrozen {
        lastCheckIn = block.timestamp;
        emit CheckedIn(owner, block.timestamp);
    }

    /// @notice Add funds to the vault. Anyone can top it up.
    function deposit() external payable notFrozen {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Deposit an NFT into the vault.
    ///         Caller must have approved this contract first:
    ///         nftContract.approve(address(this), tokenId)
    function depositNFT(address _nftContract, uint256 _tokenId)
        external
        onlyOwner
        inStatus(Status.Active)
        notFrozen
    {
        IERC721(_nftContract).safeTransferFrom(msg.sender, address(this), _tokenId);
        depositedNFTs.push(NFTDeposit(_nftContract, _tokenId));
        emit NFTDeposited(_nftContract, _tokenId, msg.sender);
    }

    /// @notice View all NFTs currently held in the vault.
    function getDepositedNFTs() external view returns (NFTDeposit[] memory) {
        return depositedNFTs;
    }

    // ─────────────────────────────────────────────────────────
    // 6. GUARDIAN MANAGEMENT & PANIC BUTTON
    // ─────────────────────────────────────────────────────────

    /// @notice Owner adds a guardian (someone trusted to freeze the vault).
    function addGuardian(address _guardian) external onlyOwner {
        require(_guardian != address(0), "zero address");
        _grantRole(GUARDIAN_ROLE, _guardian);
        emit GuardianAdded(_guardian);
    }

    /// @notice Owner removes a guardian.
    function removeGuardian(address _guardian) external onlyOwner {
        _revokeRole(GUARDIAN_ROLE, _guardian);
        emit GuardianRemoved(_guardian);
    }

    /// @notice Any guardian can instantly freeze the vault.
    ///         Use this if a key is leaked or an attack is detected.
    function freeze() external onlyRole(GUARDIAN_ROLE) {
        frozen = true;
        emit VaultFrozen(msg.sender, block.timestamp);
    }

    /// @notice Only the owner (DEFAULT_ADMIN) can unfreeze.
    ///         Unfreezing is harder than freezing — intentional.
    function unfreeze() external onlyOwner {
        frozen = false;
        emit VaultUnfrozen(msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // 6b. MANAGER & USER ROLE MANAGEMENT
    //     Satisfies PS RBAC requirement: Admin, Manager, Auditor, User
    // ─────────────────────────────────────────────────────────

    /// @notice Admin adds a Manager.
    ///         Managers can add/remove Users and view vault state.
    function addManager(address _manager) external onlyOwner {
        require(_manager != address(0), "zero address");
        _grantRole(MANAGER_ROLE, _manager);
        emit ManagerAdded(_manager);
    }

    /// @notice Admin removes a Manager.
    function removeManager(address _manager) external onlyOwner {
        _revokeRole(MANAGER_ROLE, _manager);
        emit ManagerRemoved(_manager);
    }

    /// @notice Manager or Admin adds a User.
    function addUser(address _user) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(MANAGER_ROLE, msg.sender),
            "not admin or manager"
        );
        require(_user != address(0), "zero address");
        _grantRole(USER_ROLE, _user);
        emit UserAdded(_user);
    }

    /// @notice Manager or Admin removes a User.
    function removeUser(address _user) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(MANAGER_ROLE, msg.sender),
            "not admin or manager"
        );
        _revokeRole(USER_ROLE, _user);
        emit UserRemoved(_user);
    }

    /// @notice Admin adds an Auditor (read-only observer role).
    function addAuditor(address _auditor) external onlyOwner {
        require(_auditor != address(0), "zero address");
        _grantRole(AUDITOR_ROLE, _auditor);
        emit AuditorAdded(_auditor);
    }

    // ─────────────────────────────────────────────────────────
    // 7. BENEFICIARY MANAGEMENT (48-hour timelock)
    //    FIX: locked to Status.Active — once the switch has fired,
    //    the beneficiary slot can no longer be changed.
    // ─────────────────────────────────────────────────────────

    /// @notice Queue a beneficiary change. Takes effect after 48 hours.
    function setBeneficiary(address _new) external onlyOwner inStatus(Status.Active) {
        require(_new != address(0), "zero address");
        pendingBeneficiary  = _new;
        beneficiaryUnlockAt = block.timestamp + TIMELOCK_DELAY;
        emit BeneficiaryQueued(_new, beneficiaryUnlockAt);
    }

    /// @notice Finalise a queued beneficiary change after the timelock expires.
    function applyBeneficiary() external onlyOwner inStatus(Status.Active) {
        require(pendingBeneficiary != address(0), "no pending change");
        require(block.timestamp >= beneficiaryUnlockAt, "timelock not expired");
        beneficiary        = pendingBeneficiary;
        pendingBeneficiary = address(0);
        emit BeneficiaryUpdated(beneficiary);
    }

    /// @notice Cancel a queued beneficiary change before it finalises.
    ///         Use this the moment you spot a change you did not make.
    function cancelBeneficiaryChange() external onlyOwner {
        require(pendingBeneficiary != address(0), "no pending change");
        address cancelled   = pendingBeneficiary;
        pendingBeneficiary  = address(0);
        beneficiaryUnlockAt = 0;
        emit BeneficiaryCancelled(cancelled);
    }

    // ─────────────────────────────────────────────────────────
    // 7. TIMEOUT MANAGEMENT (48-hour timelock)
    //    FIX: also locked to Status.Active, same reasoning as above.
    // ─────────────────────────────────────────────────────────

    /// @notice Queue a timeout change. Takes effect after 48 hours.
    /// @param _seconds New timeout in seconds. Frontend sends days * 86400.
    function setTimeoutPeriod(uint256 _seconds) external onlyOwner inStatus(Status.Active) {
        require(_seconds >= 0, "timeout must be >= 0");
        pendingTimeoutPeriod = _seconds;
        timeoutUnlockAt      = block.timestamp + TIMELOCK_DELAY;
        emit TimeoutQueued(_seconds, timeoutUnlockAt);
    }

    /// @notice Finalise a queued timeout change after the timelock expires.
    function applyTimeoutPeriod() external onlyOwner inStatus(Status.Active) {
        require(pendingTimeoutPeriod > 0, "no pending change");
        require(block.timestamp >= timeoutUnlockAt, "timelock not expired");
        timeoutPeriod        = pendingTimeoutPeriod;
        pendingTimeoutPeriod = 0;
        emit TimeoutUpdated(timeoutPeriod);
    }

    /// @notice Cancel a queued timeout change before it finalises.
    function cancelTimeoutChange() external onlyOwner {
        require(pendingTimeoutPeriod > 0, "no pending change");
        uint256 cancelled    = pendingTimeoutPeriod;
        pendingTimeoutPeriod = 0;
        timeoutUnlockAt      = 0;
        emit TimeoutCancelled(cancelled);
    }

    // ─────────────────────────────────────────────────────────
    // 8. EXPIRY
    // ─────────────────────────────────────────────────────────

    function isExpired() public view returns (bool) {
        return status == Status.Active &&
               block.timestamp > lastCheckIn + timeoutPeriod;
    }

    /// @dev Shared logic for markExpired() and trigger() — avoids external self-call.
    function _doMarkExpired() private {
        require(isExpired(), "timeout has not passed yet");
        status = Status.Expired;
        emit Expired(block.timestamp);
        emit Triggered(block.timestamp);   // frontend listens for Triggered
    }

    /// @notice Permissionless — anyone can call once the deadline passes.
    ///         This is what Chainlink Automation will call via performUpkeep().
    function markExpired() external inStatus(Status.Active) {
        _doMarkExpired();
    }

    /// @notice Alias for markExpired() — matches frontend ABI.
    function trigger() external inStatus(Status.Active) {
        _doMarkExpired();
    }

    // ─────────────────────────────────────────────────────────
    // 9. BENEFICIARY ACTIONS
    //    FIX: claim() and withdraw() now share one private implementation
    //    instead of duplicating the transfer logic. Each external function
    //    keeps its own modifiers — modifiers are NOT bypassed by the
    //    internal call, they still run before _doWithdraw() executes.
    // ─────────────────────────────────────────────────────────

    /// @notice Pull-payment withdrawal. Beneficiary claims full balance after expiry.
    function claim() external onlyBeneficiary inStatus(Status.Expired) notFrozen {
        _doWithdraw();
    }

    /// @notice Alias for claim() — matches frontend ABI (`withdraw` key in useContract.js).
    function withdraw() external onlyBeneficiary inStatus(Status.Expired) notFrozen {
        _doWithdraw();
    }

    function _doWithdraw() private {
        uint256 amount = address(this).balance;
        status = Status.Claimed;

        // Transfer all deposited NFTs to beneficiary
        for (uint256 i = 0; i < depositedNFTs.length; i++) {
            IERC721(depositedNFTs[i].contractAddress).safeTransferFrom(
                address(this),
                beneficiary,
                depositedNFTs[i].tokenId
            );
            emit NFTClaimed(
                depositedNFTs[i].contractAddress,
                depositedNFTs[i].tokenId,
                beneficiary
            );
        }

        // Transfer ETH last (checks-effects-interactions pattern)
        emit Withdrawn(beneficiary, amount);
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "transfer failed");
    }

    // ─────────────────────────────────────────────────────────
    // 10. VIEW HELPERS
    // ─────────────────────────────────────────────────────────

    /// @notice Frontend polls this to show triggered/active state.
    function isTriggered() external view returns (bool) {
        return status == Status.Expired || status == Status.Claimed;
    }

    function timeRemaining() external view returns (uint256) {
        uint256 deadline = lastCheckIn + timeoutPeriod;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

//     function createVaultFor(
//     address _owner,
//     address _beneficiary,
//     uint256 _timeoutPeriod
// ) external returns (address vaultAddress) {
//     require(_beneficiary != address(0), "zero beneficiary");
//     require(_timeoutPeriod > 0, "timeout must be > 0");

//     DeadManSwitch vault = new DeadManSwitch (
//         _owner,           // real user, not the coordinator
//         _beneficiary,
//         _timeoutPeriod
//     );

//     vaultAddress = address(vault);
//     allVaults.push(vaultAddress);
//     vaultsByOwner[_owner].push(vaultAddress);  // stored under real user
//     ownerOfVault[vaultAddress] = _owner;

//     emit VaultCreated(_owner, vaultAddress, _beneficiary, _timeoutPeriod, block.timestamp);
//     return vaultAddress;
// }

}
