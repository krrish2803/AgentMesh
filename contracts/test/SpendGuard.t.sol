// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SpendGuard} from "../src/SpendGuard.sol";
import {IERC8004Identity} from "../interfaces/IERC8004Identity.sol";
import {IERC8004Reputation} from "../interfaces/IERC8004Reputation.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract MockIdentityRegistry is IERC8004Identity {
    mapping(uint256 => address) public owners;
    mapping(uint256 => address) public wallets;
    uint256 public nextId = 1;

    function register() external returns (uint256) {
        uint256 id = nextId++;
        owners[id] = msg.sender;
        return id;
    }

    function register(string calldata) external returns (uint256) {
        uint256 id = nextId++;
        owners[id] = msg.sender;
        return id;
    }

    function registerFor(address agentOwner) external returns (uint256) {
        uint256 id = nextId++;
        owners[id] = agentOwner;
        return id;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = owners[tokenId];
        require(o != address(0), "Nonexistent token");
        return o;
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return wallets[agentId];
    }

    function setAgentWallet(uint256 agentId, address newWallet, uint256, bytes calldata) external {
        wallets[agentId] = newWallet;
    }
}

contract MockReputationRegistry is IERC8004Reputation {
    mapping(uint256 => int128) public scores;
    mapping(uint256 => uint64) public counts;

    function setScore(uint256 agentId, int128 score, uint64 count) external {
        scores[agentId] = score;
        counts[agentId] = count;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8,
        string calldata,
        string calldata,
        string calldata,
        string calldata,
        bytes32
    ) external {
        scores[agentId] += value;
        counts[agentId] += 1;
    }

    function getSummary(
        uint256 agentId,
        address[] calldata,
        string calldata,
        string calldata
    ) external view returns (uint64 count, int128 summaryValue, uint8 decimals) {
        return (counts[agentId], scores[agentId], 2);
    }
}

contract SpendGuardTest is Test {
    SpendGuard public guard;
    MockUSDC public usdc;
    MockIdentityRegistry public identityReg;
    MockReputationRegistry public reputationReg;

    address public owner = address(0xAA1);
    uint256 public agentPrivateKey = 0xA11CE;
    address public agent;
    address public payee = address(0xBB1);
    uint256 public payeeAgentId;

    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("Voucher(bytes32 channelId,uint256 cumulativeAmount)");

    function setUp() public {
        agent = vm.addr(agentPrivateKey);

        usdc = new MockUSDC();
        identityReg = new MockIdentityRegistry();
        reputationReg = new MockReputationRegistry();

        // Register payee in ERC-8004
        payeeAgentId = identityReg.registerFor(payee);
        reputationReg.setScore(payeeAgentId, 85, 10); // 85 score

        vm.startPrank(owner);
        guard = new SpendGuard(address(usdc), address(identityReg), address(reputationReg));

        // Fund owner with USDC and fund SpendGuard vault
        usdc.mint(owner, 10_000 * 10 ** 6);
        usdc.approve(address(guard), type(uint256).max);
        guard.fund(1_000 * 10 ** 6); // $1000

        // Set policy for agent: max $10 per channel, $50 per hour window, minRep 50
        guard.setPolicy(
            agent,
            10 * 10 ** 6,        // maxPerChannel: $10
            50 * 10 ** 6,        // budgetPerWindow: $50
            3600,                // windowSecs: 1 hour
            block.timestamp + 1 days,
            50,                  // minPayeeRep: 50
            true                 // requireRegisteredPayee: true
        );
        vm.stopPrank();
    }

    function _signVoucher(
        bytes32 channelId,
        uint256 cumulativeAmount,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, channelId, cumulativeAmount));
        bytes32 domainSeparator = guard.domainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // --- Happy Path Tests ---

    function test_HappyPath_ChannelOpenClaimAndClose() public {
        uint256 deposit = 5 * 10 ** 6; // $5
        uint256 expiry = block.timestamp + 1 hours;

        vm.prank(agent);
        bytes32 channelId = guard.openChannel(payee, payeeAgentId, deposit, expiry);

        assertEq(guard.vaultBalance(), 995 * 10 ** 6);

        // Buyer generates voucher for $1.50
        uint256 amount1 = 1500000;
        bytes memory sig1 = _signVoucher(channelId, amount1, agentPrivateKey);

        vm.prank(payee);
        guard.claim(channelId, amount1, sig1);
        assertEq(usdc.balanceOf(payee), 1500000);

        // Buyer generates voucher incrementing to $3.00
        uint256 amount2 = 3000000;
        bytes memory sig2 = _signVoucher(channelId, amount2, agentPrivateKey);

        vm.prank(payee);
        guard.claim(channelId, amount2, sig2);
        assertEq(usdc.balanceOf(payee), 3000000);

        // Close channel and refund remaining $2.00 to vault
        vm.prank(agent);
        guard.closeChannel(channelId);

        assertEq(guard.vaultBalance(), 997 * 10 ** 6); // $995 + $2 refund = $997
    }

    // --- Revert 1: OverChannelCap ---

    function test_Revert_OverChannelCap() public {
        uint256 deposit = 15 * 10 ** 6; // $15 (policy is $10 max)
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.OverChannelCap.selector, deposit, 10 * 10 ** 6));
        guard.openChannel(payee, payeeAgentId, deposit, block.timestamp + 1 hours);
    }

    // --- Revert 2: WindowBudgetExceeded ---

    function test_Revert_WindowBudgetExceeded() public {
        // Open 5 channels of $10 each ($50 total, hits budgetPerWindow)
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            guard.openChannel(payee, payeeAgentId, 10 * 10 ** 6, block.timestamp + 1 hours);
        }

        // 6th channel attempts $1 more in same window -> revert
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(SpendGuard.WindowBudgetExceeded.selector, 1 * 10 ** 6, 50 * 10 ** 6, 50 * 10 ** 6)
        );
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);

        // Warp time forward by 1 hour (window rollover) -> now should succeed
        vm.warp(block.timestamp + 3601);
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);
        assertTrue(chId != bytes32(0));
    }

    // --- Revert 3: PayeeNotRegistered ---

    function test_Revert_PayeeNotRegistered() public {
        address unregPayee = address(0xDEAD);
        uint256 nonExistentId = 9999;

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.PayeeNotRegistered.selector, unregPayee, nonExistentId));
        guard.openChannel(unregPayee, nonExistentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    // --- Revert 4: PayeeReputationTooLow ---

    function test_Revert_PayeeReputationTooLow() public {
        // Register seller with low reputation (score 30 vs min 50)
        address lowRepPayee = address(0x103);
        uint256 lowRepId = identityReg.registerFor(lowRepPayee);
        reputationReg.setScore(lowRepId, 30, 5);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.PayeeReputationTooLow.selector, lowRepId, 30, 50));
        guard.openChannel(lowRepPayee, lowRepId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    // --- Revert 5: AgentRevoked ---

    function test_Revert_AgentRevoked() public {
        // Owner revokes agent
        vm.prank(owner);
        guard.revokeAgent(agent);

        // openChannel reverts
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.AgentRevoked.selector, agent));
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    function test_Revert_ClaimAfterRevoke() public {
        // Open channel first
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        bytes memory sig = _signVoucher(chId, 1 * 10 ** 6, agentPrivateKey);

        // Revoke agent mid-flight
        vm.prank(owner);
        guard.revokeAgent(agent);

        // Claim fails
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.AgentRevoked.selector, agent));
        guard.claim(chId, 1 * 10 ** 6, sig);
    }

    // --- Revert 6: InvalidVoucher & Exceeds Deposit ---

    function test_Revert_VoucherExceedsDeposit() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        // Sign voucher for $6 (deposit is $5)
        bytes memory sig = _signVoucher(chId, 6 * 10 ** 6, agentPrivateKey);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.VoucherExceedsDeposit.selector, 6 * 10 ** 6, 5 * 10 ** 6));
        guard.claim(chId, 6 * 10 ** 6, sig);
    }

    function test_Revert_InvalidVoucherSignature() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        // Sign with a rogue private key
        uint256 rogueKey = 0xBADB01;
        bytes memory badSig = _signVoucher(chId, 1 * 10 ** 6, rogueKey);

        vm.prank(payee);
        vm.expectRevert();
        guard.claim(chId, 1 * 10 ** 6, badSig);
    }

    // --- Fuzz Testing Invariant: claimed + refunded == deposit ---

    function testFuzz_ClaimAndRefundMath(uint256 deposit, uint256 claimAmount) public {
        // Bound deposit to between $0.01 and $10
        deposit = bound(deposit, 10_000, 10 * 10 ** 6);
        claimAmount = bound(claimAmount, 1, deposit);

        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, deposit, block.timestamp + 1 hours);

        bytes memory sig = _signVoucher(chId, claimAmount, agentPrivateKey);

        vm.prank(payee);
        guard.claim(chId, claimAmount, sig);

        uint256 initialVault = guard.vaultBalance();

        vm.prank(agent);
        guard.closeChannel(chId);

        uint256 refund = guard.vaultBalance() - initialVault;

        assertEq(claimAmount + refund, deposit);
    }
}
