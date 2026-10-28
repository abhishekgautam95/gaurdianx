// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/GuardianXSafeModule.sol";

/**
 * @notice Mock Safe{Wallet} / Zodiac Avatar for testing module execution bounds.
 */
contract MockSafeAvatar is ISafeAvatar {
    address public enabledModule;

    receive() external payable {}

    function setEnabledModule(address _module) external {
        enabledModule = _module;
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Operation operation
    ) external override returns (bool success) {
        require(msg.sender == enabledModule, "Module not enabled");
        require(operation == Operation.Call, "DelegateCall strictly prohibited");
        (success, ) = to.call{value: value}(data);
    }
}

/**
 * @notice Mock Pausable DeFi Vault target contract.
 */
contract MockProtectedVault {
    bool public paused;
    bool public frozen;

    function pause() external {
        paused = true;
    }

    function freezeVault() external {
        frozen = true;
    }
}

/**
 * @notice Mock ERC-20 Token for testing non-custodial sweep to SAFE_TREASURY.
 */
contract MockERC20 is IERC20Minimal {
    mapping(address => uint256) public override balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/**
 * @title GuardianXSafeModuleTest
 * @notice Foundry unit test suite verifying non-custodial execution bounds, cooldowns,
 *         immutable treasury destination guarantees, and unauthorized caller reverts.
 */
contract GuardianXSafeModuleTest is Test {
    MockSafeAvatar internal avatar;
    MockProtectedVault internal vault;
    MockERC20 internal usdc;
    GuardianXSafeModule internal module;

    address internal constant OPERATOR = address(0xA11CE);
    address internal constant SAFE_TREASURY = address(0x9999);
    address internal constant ATTACKER = address(0xBAD);

    function setUp() public {
        vm.warp(1_700_000_000);
        avatar = new MockSafeAvatar();
        vault = new MockProtectedVault();
        usdc = new MockERC20();

        address[] memory initialTargets = new address[](1);
        initialTargets[0] = address(vault);

        module = new GuardianXSafeModule(
            address(avatar),
            SAFE_TREASURY,
            OPERATOR,
            initialTargets,
            60 // 60-second cooldown
        );

        avatar.setEnabledModule(address(module));
        vm.deal(address(avatar), 500 ether);
        usdc.mint(address(avatar), 1_000_000e6);
    }

    function test_AuthorizedOperatorCanTriggerEmergencyPause() public {
        assertFalse(vault.paused());

        vm.prank(OPERATOR);
        module.triggerEmergencyPause(address(vault));

        assertTrue(vault.paused(), "Protected vault must be paused");
    }

    function test_AuthorizedOperatorCanTriggerFreezeVault() public {
        assertFalse(vault.frozen());

        vm.prank(OPERATOR);
        module.triggerEmergencyFreezeVault(address(vault));

        assertTrue(vault.frozen(), "Protected vault must be frozen");
    }

    function test_SweepNativeStrictlyToImmutableSafeTreasury() public {
        uint256 preTreasuryBal = SAFE_TREASURY.balance;
        assertEq(preTreasuryBal, 0);

        vm.prank(OPERATOR);
        uint256 swept = module.sweepNativeToSafeTreasury();

        assertEq(swept, 500 ether);
        assertEq(SAFE_TREASURY.balance, 500 ether, "100% of native balance must go to SAFE_TREASURY");
        assertEq(address(avatar).balance, 0);
    }

    function test_SweepERC20StrictlyToImmutableSafeTreasury() public {
        vm.prank(OPERATOR);
        uint256 swept = module.sweepERC20ToSafeTreasury(address(usdc));

        assertEq(swept, 1_000_000e6);
        assertEq(usdc.balanceOf(SAFE_TREASURY), 1_000_000e6);
        assertEq(usdc.balanceOf(address(avatar)), 0);
    }

    function test_RevertWhen_UnauthorizedCallerAttemptsPauseOrSweep() public {
        vm.startPrank(ATTACKER);

        vm.expectRevert(abi.encodeWithSelector(GuardianXSafeModule.UnauthorizedOperator.selector, ATTACKER));
        module.triggerEmergencyPause(address(vault));

        vm.expectRevert(abi.encodeWithSelector(GuardianXSafeModule.UnauthorizedOperator.selector, ATTACKER));
        module.sweepNativeToSafeTreasury();

        vm.stopPrank();
    }

    function test_RevertWhen_TargetContractNotWhitelisted() public {
        address unverifiedContract = address(0x123456);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(GuardianXSafeModule.TargetNotProtected.selector, unverifiedContract));
        module.triggerEmergencyPause(unverifiedContract);
    }

    function test_RevertWhen_CooldownIsStillActive() public {
        vm.startPrank(OPERATOR);
        module.triggerEmergencyPause(address(vault));

        // Attempt another action 10 seconds later (< 60s cooldown)
        vm.warp(block.timestamp + 10);
        vm.expectRevert(
            abi.encodeWithSelector(GuardianXSafeModule.CooldownActive.selector, block.timestamp + 50)
        );
        module.sweepNativeToSafeTreasury();

        // Advance past cooldown (61s) and verify execution succeeds
        vm.warp(block.timestamp + 51);
        module.sweepNativeToSafeTreasury();
        assertEq(SAFE_TREASURY.balance, 500 ether);
        vm.stopPrank();
    }

    function test_OnlyAvatarGovernanceCanRotateOperatorOrUpdateTargets() public {
        vm.prank(ATTACKER);
        vm.expectRevert(abi.encodeWithSelector(GuardianXSafeModule.UnauthorizedGovernance.selector, ATTACKER));
        module.rotateGuardianOperator(ATTACKER);

        address newOperator = address(0xB0B);
        vm.prank(address(avatar));
        module.rotateGuardianOperator(newOperator);
        assertEq(module.guardianOperator(), newOperator);
    }
}
