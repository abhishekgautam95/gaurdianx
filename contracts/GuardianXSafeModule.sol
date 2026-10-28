// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISafeAvatar
 * @notice Minimal Safe{Wallet} / Zodiac Avatar interface for executing module transactions.
 */
interface ISafeAvatar {
    enum Operation {
        Call,
        DelegateCall
    }

    /**
     * @notice Executes a transaction from the Safe / Avatar via an enabled module.
     * @param to Destination contract address.
     * @param value Native token value in wei.
     * @param data Calldata payload.
     * @param operation Must be 0 (Operation.Call); DelegateCall is strictly forbidden by GuardianX.
     * @return success True if the underlying call succeeded.
     */
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Operation operation
    ) external returns (bool success);
}

/**
 * @title IERC20Minimal
 * @notice Minimal ERC-20 interface for emergency token balance sweeping.
 */
interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title GuardianXSafeModule
 * @author GuardianX Security Engineering
 * @notice Non-custodial, Zodiac-compatible emergency circuit-breaker module for Safe{Wallet} and DeFi vaults.
 * @dev Enforces strict, mathematically bounded capabilities for the GuardianX operator:
 *      1. The operator can NEVER execute arbitrary calldata or `DelegateCall`.
 *      2. The operator can ONLY invoke `pause()` (0x8456cb59) or `freezeVault()` (0x62a5af3b) on registered protocol contracts.
 *      3. The operator can ONLY sweep native ETH or ERC-20 tokens strictly to the ` immutable SAFE_TREASURY` address
 *         fixed at contract deployment—making it impossible for a compromised GuardianX key to steal funds.
 */
contract GuardianXSafeModule {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddressNotAllowed();
    error UnauthorizedOperator(address caller);
    error UnauthorizedGovernance(address caller);
    error TargetNotProtected(address target);
    error ModuleExecutionFailed(address target, bytes4 selector);
    error CooldownActive(uint256 availableAt);
    error NothingToSweep();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event EmergencyPauseTriggered(
        address indexed operator,
        address indexed targetContract,
        bytes4 indexed selector,
        uint256 timestamp
    );

    event EmergencySweepExecuted(
        address indexed operator,
        address indexed token,
        address indexed safeTreasury,
        uint256 amount,
        uint256 timestamp
    );

    event ProtectedTargetUpdated(address indexed target, bool isProtected);
    event GuardianOperatorRotated(address indexed previousOperator, address indexed newOperator);

    /*//////////////////////////////////////////////////////////////
                           CONSTANTS & IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Standard OpenZeppelin Pausable `pause()` selector (0x8456cb59).
    bytes4 public constant PAUSE_SELECTOR = 0x8456cb59;

    /// @notice GuardianX Vault `freezeVault()` selector (0x62a5af3b).
    bytes4 public constant FREEZE_VAULT_SELECTOR = 0x62a5af3b;

    /// @notice ERC-20 `transfer(address,uint256)` selector (0xa9059cbb).
    bytes4 public constant ERC20_TRANSFER_SELECTOR = 0xa9059cbb;

    /// @notice The Safe{Wallet} / Avatar that holds protocol authority and assets.
    ISafeAvatar public immutable AVATAR;

    /// @notice Hardcoded, immutable cold recovery treasury where swept assets MUST go.
    address public immutable SAFE_TREASURY;

    /// @notice Minimum cooldown between emergency actions to prevent griefing (default: 60 seconds).
    uint256 public immutable MIN_COOLDOWN_SECONDS;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Address of the authorized GuardianX KMS / Circuit-Breaker relayer.
    address public guardianOperator;

    /// @notice Timestamp of the last emergency action executed by the module.
    uint256 public lastEmergencyTimestamp;

    /// @notice Whitelist of protocol contracts that the operator is permitted to pause/freeze.
    mapping(address => bool) public isProtectedTarget;

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyGuardianOperator() {
        if (msg.sender != guardianOperator) {
            revert UnauthorizedOperator(msg.sender);
        }
        _;
    }

    modifier onlyAvatarGovernance() {
        if (msg.sender != address(AVATAR)) {
            revert UnauthorizedGovernance(msg.sender);
        }
        _;
    }

    modifier checkAndUpdateCooldown() {
        uint256 nextAllowed = lastEmergencyTimestamp + MIN_COOLDOWN_SECONDS;
        if (lastEmergencyTimestamp != 0 && block.timestamp < nextAllowed) {
            revert CooldownActive(nextAllowed);
        }
        lastEmergencyTimestamp = block.timestamp;
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @param _avatar Address of the Safe{Wallet} or protocol Avatar contract.
     * @param _safeTreasury Immutable cold multisig address where swept assets are sent.
     * @param _guardianOperator Initial GuardianX KMS / Relayer operator address.
     * @param _initialTargets Initial list of protocol contracts eligible for emergency `pause()`.
     * @param _minCooldownSeconds Minimum delay between consecutive emergency actions.
     */
    constructor(
        address _avatar,
        address _safeTreasury,
        address _guardianOperator,
        address[] memory _initialTargets,
        uint256 _minCooldownSeconds
    ) {
        if (_avatar == address(0) || _safeTreasury == address(0) || _guardianOperator == address(0)) {
            revert ZeroAddressNotAllowed();
        }

        AVATAR = ISafeAvatar(_avatar);
        SAFE_TREASURY = _safeTreasury;
        guardianOperator = _guardianOperator;
        MIN_COOLDOWN_SECONDS = _minCooldownSeconds;

        uint256 len = _initialTargets.length;
        for (uint256 i = 0; i < len; ) {
            address target = _initialTargets[i];
            if (target == address(0)) revert ZeroAddressNotAllowed();
            isProtectedTarget[target] = true;
            emit ProtectedTargetUpdated(target, true);
            unchecked {
                ++i;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                     GOVERNANCE CONFIGURATION (SAFE ONLY)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Registers or revokes a target contract for emergency pausing.
     * @dev Can ONLY be called by the Safe `AVATAR` multisig itself.
     */
    function setProtectedTarget(address target, bool protected) external onlyAvatarGovernance {
        if (target == address(0)) revert ZeroAddressNotAllowed();
        isProtectedTarget[target] = protected;
        emit ProtectedTargetUpdated(target, protected);
    }

    /**
     * @notice Rotates the authorized GuardianX KMS operator address.
     * @dev Can ONLY be called by the Safe `AVATAR` multisig itself.
     */
    function rotateGuardianOperator(address newOperator) external onlyAvatarGovernance {
        if (newOperator == address(0)) revert ZeroAddressNotAllowed();
        address previous = guardianOperator;
        guardianOperator = newOperator;
        emit GuardianOperatorRotated(previous, newOperator);
    }

    /*//////////////////////////////////////////////////////////////
                SCOPED EMERGENCY CIRCUIT-BREAKER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Triggers an immediate `pause()` (0x8456cb59) on a protected protocol contract via the Safe Avatar.
     * @dev Calldata is constructed deterministically inside this contract; operator cannot pass arbitrary bytes.
     * @param targetContract The registered protocol contract to pause.
     */
    function triggerEmergencyPause(address targetContract)
        external
        onlyGuardianOperator
        checkAndUpdateCooldown
    {
        if (!isProtectedTarget[targetContract]) {
            revert TargetNotProtected(targetContract);
        }

        bool ok = AVATAR.execTransactionFromModule(
            targetContract,
            0,
            abi.encodeWithSelector(PAUSE_SELECTOR),
            ISafeAvatar.Operation.Call
        );

        if (!ok) {
            revert ModuleExecutionFailed(targetContract, PAUSE_SELECTOR);
        }

        emit EmergencyPauseTriggered(msg.sender, targetContract, PAUSE_SELECTOR, block.timestamp);
    }

    /**
     * @notice Triggers an immediate `freezeVault()` (0x62a5af3b) on a protected vault contract via the Safe Avatar.
     * @param targetVault The registered vault contract to freeze.
     */
    function triggerEmergencyFreezeVault(address targetVault)
        external
        onlyGuardianOperator
        checkAndUpdateCooldown
    {
        if (!isProtectedTarget[targetVault]) {
            revert TargetNotProtected(targetVault);
        }

        bool ok = AVATAR.execTransactionFromModule(
            targetVault,
            0,
            abi.encodeWithSelector(FREEZE_VAULT_SELECTOR),
            ISafeAvatar.Operation.Call
        );

        if (!ok) {
            revert ModuleExecutionFailed(targetVault, FREEZE_VAULT_SELECTOR);
        }

        emit EmergencyPauseTriggered(msg.sender, targetVault, FREEZE_VAULT_SELECTOR, block.timestamp);
    }

    /**
     * @notice Sweeps all native ETH held by the `AVATAR` strictly to the immutable `SAFE_TREASURY`.
     * @dev Recipient is hardcoded to `SAFE_TREASURY`; operator cannot redirect funds to any other address.
     */
    function sweepNativeToSafeTreasury()
        external
        onlyGuardianOperator
        checkAndUpdateCooldown
        returns (uint256 sweptAmount)
    {
        sweptAmount = address(AVATAR).balance;
        if (sweptAmount == 0) {
            revert NothingToSweep();
        }

        bool ok = AVATAR.execTransactionFromModule(
            SAFE_TREASURY,
            sweptAmount,
            "",
            ISafeAvatar.Operation.Call
        );

        if (!ok) {
            revert ModuleExecutionFailed(SAFE_TREASURY, bytes4(0));
        }

        emit EmergencySweepExecuted(
            msg.sender,
            address(0),
            SAFE_TREASURY,
            sweptAmount,
            block.timestamp
        );
    }

    /**
     * @notice Sweeps the entire ERC-20 token balance held by `AVATAR` strictly to the immutable `SAFE_TREASURY`.
     * @param token Address of the ERC-20 token contract.
     */
    function sweepERC20ToSafeTreasury(address token)
        external
        onlyGuardianOperator
        checkAndUpdateCooldown
        returns (uint256 sweptAmount)
    {
        if (token == address(0)) revert ZeroAddressNotAllowed();

        sweptAmount = IERC20Minimal(token).balanceOf(address(AVATAR));
        if (sweptAmount == 0) {
            revert NothingToSweep();
        }

        bytes memory transferCalldata = abi.encodeWithSelector(
            ERC20_TRANSFER_SELECTOR,
            SAFE_TREASURY,
            sweptAmount
        );

        bool ok = AVATAR.execTransactionFromModule(
            token,
            0,
            transferCalldata,
            ISafeAvatar.Operation.Call
        );

        if (!ok) {
            revert ModuleExecutionFailed(token, ERC20_TRANSFER_SELECTOR);
        }

        emit EmergencySweepExecuted(
            msg.sender,
            token,
            SAFE_TREASURY,
            sweptAmount,
            block.timestamp
        );
    }
}
