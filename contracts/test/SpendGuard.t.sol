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
    uint8 public repDecimals = 0;

    function setScore(uint256 agentId, int128 score, uint64 count) external {
        scores[agentId] = score;
        counts[agentId] = count;
    }

    function setDecimals(uint8 newDecimals) external {
        repDecimals = newDecimals;
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

    function getClients(uint256 agentId) external view returns (address[] memory) {
        if (counts[agentId] == 0) return new address[](0);
        address[] memory clients = new address[](1);
        clients[0] = address(this);
        return clients;
    }

    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata,
        string calldata
    ) external view returns (uint64 count, int128 summaryValue, uint8 decimals) {
        require(clients.length > 0, "clientAddresses required");
        return (counts[agentId], scores[agentId], repDecimals);
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

        // Payee settles the channel (allowed at any time) and the remaining $2.00 refunds to the vault
        vm.prank(payee);
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
        vm.expectRevert(
            abi.encodeWithSelector(SpendGuard.InvalidVoucher.selector, chId, vm.addr(rogueKey), agent)
        );
        guard.claim(chId, 1 * 10 ** 6, badSig);
    }

    function test_Revert_InvalidVoucherMalformedSignature() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        // Garbage signature bytes must surface InvalidVoucher, not an OZ ECDSA revert
        bytes memory garbageSig = hex"deadbeef";

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.InvalidVoucher.selector, chId, address(0), agent));
        guard.claim(chId, 1 * 10 ** 6, garbageSig);
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

        vm.prank(payee);
        guard.closeChannel(chId);

        uint256 refund = guard.vaultBalance() - initialVault;

        assertEq(claimAmount + refund, deposit);
    }

    // --- Identity binding (payee must be bound to payeeAgentId) ---

    function test_Revert_PayeeAgentIdMismatch() public {
        // A different party's registered agentId must not be usable for this payee
        address otherOwner = address(0xC0FFEE);
        uint256 otherAgentId = identityReg.registerFor(otherOwner);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.PayeeNotRegistered.selector, payee, otherAgentId));
        guard.openChannel(payee, otherAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    function test_PayeeBinding_ViaAgentWallet() public {
        // NFT owner differs from the payee, but the registry's agent wallet matches
        address nftOwner = address(0xD00D);
        uint256 agentId = identityReg.registerFor(nftOwner);
        identityReg.setAgentWallet(agentId, payee, type(uint256).max, "");
        reputationReg.setScore(agentId, 85, 10);

        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, agentId, 1 * 10 ** 6, block.timestamp + 1 hours);
        assertTrue(chId != bytes32(0));
    }

    // --- Reputation decimals normalization ---

    function test_Reputation_NormalizedDecimals() public {
        // Registry reports score scaled by 10^2 (e.g. 85.00 -> 8500)
        reputationReg.setDecimals(2);
        reputationReg.setScore(payeeAgentId, 8500, 10);

        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
        assertTrue(chId != bytes32(0));
    }

    function test_Revert_Reputation_ScaledBelowMinimum() public {
        // 3000 with 2 decimals == 30.00, below minRep 50 (raw compare would wrongly pass)
        reputationReg.setDecimals(2);
        reputationReg.setScore(payeeAgentId, 3000, 5);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.PayeeReputationTooLow.selector, payeeAgentId, 30, 50));
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    function test_Revert_Reputation_ZeroCountFailsClosed() public {
        // Value without any feedback must not pass
        reputationReg.setScore(payeeAgentId, 85, 0);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.PayeeReputationTooLow.selector, payeeAgentId, 0, 50));
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    // --- openChannel input validation ---

    function test_Revert_ZeroPayee() public {
        vm.prank(agent);
        vm.expectRevert(SpendGuard.ZeroAddress.selector);
        guard.openChannel(address(0), payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    function test_Revert_ZeroDeposit() public {
        vm.prank(agent);
        vm.expectRevert(SpendGuard.ZeroAmount.selector);
        guard.openChannel(payee, payeeAgentId, 0, block.timestamp + 1 hours);
    }

    function test_Revert_ChannelExpiryInPast() public {
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                SpendGuard.InvalidChannelExpiry.selector, block.timestamp, block.timestamp
            )
        );
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp);
    }

    // --- setPolicy validation + window reset ---

    function test_Revert_PolicyWindowZero() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.InvalidPolicyWindow.selector, 0));
        guard.setPolicy(agent, 10 * 10 ** 6, 50 * 10 ** 6, 0, block.timestamp + 1 days, 50, true);
    }

    function test_Revert_PolicyBudgetZero() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.InvalidPolicyBudget.selector, 0));
        guard.setPolicy(agent, 10 * 10 ** 6, 0, 3600, block.timestamp + 1 days, 50, true);
    }

    function test_Revert_PolicyExpiryInPast() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SpendGuard.InvalidPolicyExpiry.selector, block.timestamp - 1, block.timestamp)
        );
        guard.setPolicy(agent, 10 * 10 ** 6, 50 * 10 ** 6, 3600, block.timestamp - 1, 50, true);
    }

    function test_SetPolicy_ResetsWindow() public {
        // Exhaust the window under the current policy
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            guard.openChannel(payee, payeeAgentId, 10 * 10 ** 6, block.timestamp + 1 hours);
        }

        // Replacing the policy must reset windowSpent instead of carrying it over
        vm.prank(owner);
        guard.setPolicy(agent, 10 * 10 ** 6, 50 * 10 ** 6, 3600, block.timestamp + 2 days, 50, true);

        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 10 * 10 ** 6, block.timestamp + 1 hours);
        assertTrue(chId != bytes32(0));
    }

    // --- Policy / channel lifecycle errors ---

    function test_Revert_PolicyExpired() public {
        vm.warp(block.timestamp + 2 days);

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                SpendGuard.PolicyExpired.selector, agent, block.timestamp - 1 days
            )
        );
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    function test_Revert_ChannelExpiredOnClaim() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);
        bytes memory sig = _signVoucher(chId, 1 * 10 ** 6, agentPrivateKey);

        vm.warp(block.timestamp + 2 hours);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.ChannelExpired.selector, chId));
        guard.claim(chId, 1 * 10 ** 6, sig);
    }

    function test_Revert_ChannelNotOpen_DoubleClose() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        vm.prank(payee);
        guard.closeChannel(chId);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.ChannelNotOpen.selector, chId));
        guard.closeChannel(chId);
    }

    function test_Revert_ChannelNotOpen_ClaimAfterClose() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);
        bytes memory sig = _signVoucher(chId, 1 * 10 ** 6, agentPrivateKey);

        vm.prank(payee);
        guard.closeChannel(chId);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.ChannelNotOpen.selector, chId));
        guard.claim(chId, 1 * 10 ** 6, sig);
    }

    function test_Revert_ChannelNotExpirableYet() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        // A third party cannot close before expiry
        vm.prank(address(0xBEEF));
        vm.expectRevert(
            abi.encodeWithSelector(
                SpendGuard.ChannelNotExpirableYet.selector, chId, block.timestamp + 1 hours, block.timestamp
            )
        );
        guard.closeChannel(chId);

        // Anyone may close after expiry
        vm.warp(block.timestamp + 2 hours);
        vm.prank(address(0xBEEF));
        guard.closeChannel(chId);
    }

    // --- Buyers cannot close before expiry, but can afterwards ---

    function test_Revert_AgentCannotCloseBeforeExpiry() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        // The agent must not be able to cut off an in-flight seller claim early
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                SpendGuard.ChannelNotExpirableYet.selector, chId, block.timestamp + 1 hours, block.timestamp
            )
        );
        guard.closeChannel(chId);

        // Once expired, the agent may reclaim the unspent remainder
        vm.warp(block.timestamp + 2 hours);
        vm.prank(agent);
        guard.closeChannel(chId);
        assertEq(guard.vaultBalance(), 1000 * 10 ** 6);
    }

    function test_PayeeCanCloseBeforeExpiry() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        // Payee settles immediately, no need to wait for expiry
        vm.prank(payee);
        guard.closeChannel(chId);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.ChannelNotOpen.selector, chId));
        guard.closeChannel(chId);
    }

    function test_Revert_InvalidCumulativeAmount() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);

        bytes memory sig = _signVoucher(chId, 2 * 10 ** 6, agentPrivateKey);
        vm.prank(payee);
        guard.claim(chId, 2 * 10 ** 6, sig);

        // Replaying the same cumulative amount must fail
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.InvalidCumulativeAmount.selector, 2 * 10 ** 6, 2 * 10 ** 6));
        guard.claim(chId, 2 * 10 ** 6, sig);

        // A lower cumulative amount must also fail
        bytes memory sigLower = _signVoucher(chId, 1 * 10 ** 6, agentPrivateKey);
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(SpendGuard.InvalidCumulativeAmount.selector, 1 * 10 ** 6, 2 * 10 ** 6));
        guard.claim(chId, 1 * 10 ** 6, sigLower);
    }

    function test_Revert_OnlyPayee() public {
        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, 5 * 10 ** 6, block.timestamp + 1 hours);
        bytes memory sig = _signVoucher(chId, 1 * 10 ** 6, agentPrivateKey);

        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyPayee.selector);
        guard.claim(chId, 1 * 10 ** 6, sig);
    }

    function test_Revert_InsufficientVaultBalance_OpenChannel() public {
        // Drain the vault
        uint256 all = guard.vaultBalance();
        vm.prank(owner);
        guard.withdraw(all);

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(SpendGuard.InsufficientVaultBalance.selector, 1 * 10 ** 6, 0)
        );
        guard.openChannel(payee, payeeAgentId, 1 * 10 ** 6, block.timestamp + 1 hours);
    }

    // --- Vault / admin ---

    function test_FundAndWithdraw() public {
        uint256 vaultBefore = guard.vaultBalance();

        vm.prank(owner);
        guard.fund(100 * 10 ** 6);
        assertEq(guard.vaultBalance(), vaultBefore + 100 * 10 ** 6);

        vm.prank(owner);
        guard.withdraw(100 * 10 ** 6);
        assertEq(guard.vaultBalance(), vaultBefore);
    }

    function test_Revert_FundZero() public {
        vm.prank(owner);
        vm.expectRevert(SpendGuard.ZeroAmount.selector);
        guard.fund(0);
    }

    function test_Revert_WithdrawExceedsVault() public {
        uint256 vault = guard.vaultBalance();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SpendGuard.InsufficientVaultBalance.selector, 1_000_000 * 10 ** 6, vault)
        );
        guard.withdraw(1_000_000 * 10 ** 6);
    }

    function test_Withdraw_RespectsVaultBalance() public {
        uint256 vaultBefore = guard.vaultBalance();
        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        guard.withdraw(100 * 10 ** 6);
        assertEq(guard.vaultBalance(), vaultBefore - 100 * 10 ** 6);
        assertEq(usdc.balanceOf(owner), ownerBefore + 100 * 10 ** 6);
    }

    function test_SyncVault_CreditsStrayTokens() public {
        uint256 vaultBefore = guard.vaultBalance();
        usdc.transfer(address(guard), 5 * 10 ** 6); // direct transfer, not via fund()

        vm.prank(owner);
        guard.syncVault();
        assertEq(guard.vaultBalance(), vaultBefore + 5 * 10 ** 6);
    }

    function test_Revert_OnlyOwner_AdminFunctions() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyOwner.selector);
        guard.setPolicy(agent, 1, 1, 1, block.timestamp + 1, 0, false);

        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyOwner.selector);
        guard.withdraw(1);

        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyOwner.selector);
        guard.revokeAgent(agent);

        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyOwner.selector);
        guard.setRegistries(address(1), address(2));

        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyOwner.selector);
        guard.transferOwnership(address(0xBAD));

        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyOwner.selector);
        guard.syncVault();
    }

    function test_Revert_TransferOwnershipZero() public {
        vm.prank(owner);
        vm.expectRevert(SpendGuard.ZeroAddress.selector);
        guard.transferOwnership(address(0));
    }

    function test_TwoStep_OwnershipTransfer() public {
        address newOwner = address(0xABCD);

        vm.prank(owner);
        guard.transferOwnership(newOwner);
        assertEq(guard.owner(), owner); // not transferred yet

        // Random address cannot accept
        vm.prank(address(0xBAD));
        vm.expectRevert(SpendGuard.OnlyPendingOwner.selector);
        guard.acceptOwnership();

        vm.prank(newOwner);
        guard.acceptOwnership();
        assertEq(guard.owner(), newOwner);
        assertEq(guard.pendingOwner(), address(0));
    }

    function test_Revert_SetRegistriesZero() public {
        vm.prank(owner);
        vm.expectRevert(SpendGuard.ZeroAddress.selector);
        guard.setRegistries(address(0), address(reputationReg));
    }

    function test_Revert_ConstructorZeroRegistry() public {
        vm.expectRevert(SpendGuard.ZeroAddress.selector);
        new SpendGuard(address(usdc), address(0), address(reputationReg));

        vm.expectRevert(SpendGuard.ZeroAddress.selector);
        new SpendGuard(address(usdc), address(identityReg), address(0));
    }

    // --- checkOpenChannel pre-check view ---

    function test_CheckOpenChannel_OK() public {
        (bool ok, string memory reason) = guard.checkOpenChannel(agent, payee, payeeAgentId, 1 * 10 ** 6);
        assertTrue(ok);
        assertEq(reason, "");
    }

    function test_CheckOpenChannel_Rejections() public {
        (bool ok, string memory reason) =
            guard.checkOpenChannel(agent, payee, payeeAgentId, 100 * 10 ** 6);
        assertFalse(ok);
        assertEq(reason, "OverChannelCap");

        (ok, reason) = guard.checkOpenChannel(agent, address(0), payeeAgentId, 1 * 10 ** 6);
        assertFalse(ok);
        assertEq(reason, "ZeroAddress");

        (ok, reason) = guard.checkOpenChannel(agent, payee, payeeAgentId, 0);
        assertFalse(ok);
        assertEq(reason, "ZeroAmount");

        (ok, reason) = guard.checkOpenChannel(agent, payee, 9999, 1 * 10 ** 6);
        assertFalse(ok);
        assertEq(reason, "PayeeNotRegistered");

        vm.prank(owner);
        guard.revokeAgent(agent);
        (ok, reason) = guard.checkOpenChannel(agent, payee, payeeAgentId, 1 * 10 ** 6);
        assertFalse(ok);
        assertEq(reason, "AgentRevoked");
    }

    // --- Stateful-ish invariant: total payouts never exceed deposits ---

    function testFuzz_MultipleClaimsNeverExceedDeposit(uint256 deposit, uint256 a1, uint256 a2) public {
        deposit = bound(deposit, 10_000, 10 * 10 ** 6);
        a1 = bound(a1, 1, deposit);
        a2 = bound(a2, a1, deposit); // monotonic

        vm.prank(agent);
        bytes32 chId = guard.openChannel(payee, payeeAgentId, deposit, block.timestamp + 1 hours);

        uint256 paidBefore = usdc.balanceOf(payee);

        bytes memory sig1 = _signVoucher(chId, a1, agentPrivateKey);
        vm.prank(payee);
        guard.claim(chId, a1, sig1);

        if (a2 > a1) {
            bytes memory sig2 = _signVoucher(chId, a2, agentPrivateKey);
            vm.prank(payee);
            guard.claim(chId, a2, sig2);
        }

        uint256 totalPaid = usdc.balanceOf(payee) - paidBefore;
        assertLe(totalPaid, deposit);

        // Vault + payouts accounting balances against the original deposit
        uint256 vaultBeforeClose = guard.vaultBalance();
        vm.prank(payee);
        guard.closeChannel(chId);
        assertEq(totalPaid + (guard.vaultBalance() - vaultBeforeClose), deposit);
    }
}
