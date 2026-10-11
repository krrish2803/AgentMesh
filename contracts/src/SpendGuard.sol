// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IERC8004Identity} from "../interfaces/IERC8004Identity.sol";
import {IERC8004Reputation} from "../interfaces/IERC8004Reputation.sol";

/**
 * @title SpendGuard
 * @notice Passkey-secured spending envelope and state-channel settlement for AI agents.
 * @dev Enforces spending limits, rolling budgets, and ERC-8004 identity/reputation gating.
 */
contract SpendGuard is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Types ---

    struct Policy {
        uint256 maxPerChannel;
        uint256 budgetPerWindow;
        uint256 windowSecs;
        uint256 expiry;
        int128 minPayeeRep;
        bool requireRegisteredPayee;
        bool active;
    }

    struct WindowTracker {
        uint256 windowStart;
        uint256 windowSpent;
    }

    struct Channel {
        address agent;
        address payee;
        uint256 payeeAgentId;
        uint256 deposit;
        uint256 claimed;
        uint256 expiry;
        bool closed;
    }

    // EIP-712 TypeHash
    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("Voucher(bytes32 channelId,uint256 cumulativeAmount)");

    // --- State ---

    address public owner;
    address public pendingOwner;
    IERC20 public immutable usdc;
    IERC8004Identity public identityRegistry;
    IERC8004Reputation public reputationRegistry;

    uint256 public vaultBalance;
    uint256 public channelNonce;

    mapping(address => Policy) public policies;
    mapping(address => WindowTracker) public windowTrackers;
    mapping(bytes32 => Channel) public channels;

    // Optional local reputation counters fallback
    mapping(address => uint256) public settledVolume;
    mapping(address => mapping(address => bool)) public hasPaidPayee;
    mapping(address => uint256) public uniquePayers;

    // --- Custom Errors ---

    error OnlyOwner();
    error OnlyPayee();
    error ZeroAddress();
    error OverChannelCap(uint256 requested, uint256 maxAllowed);
    error WindowBudgetExceeded(uint256 requested, uint256 currentSpent, uint256 budget);
    error PayeeNotRegistered(address payee, uint256 payeeAgentId);
    error PayeeReputationTooLow(uint256 payeeAgentId, int128 actualRep, int128 minRep);
    error AgentRevoked(address agent);
    error PolicyExpired(address agent, uint256 expiry);
    error InvalidVoucher(bytes32 channelId, address recovered, address expected);
    error VoucherExceedsDeposit(uint256 cumulativeAmount, uint256 deposit);
    error ChannelNotOpen(bytes32 channelId);
    error ChannelExpired(bytes32 channelId);
    error InsufficientVaultBalance(uint256 requested, uint256 available);
    error InvalidCumulativeAmount(uint256 provided, uint256 currentClaimed);
    error ChannelNotExpirableYet(bytes32 channelId, uint256 expiry, uint256 currentTime);
    error OnlyPendingOwner();
    error InvalidChannelExpiry(uint256 provided, uint256 currentTime);
    error InvalidPolicyWindow(uint256 windowSecs);
    error InvalidPolicyBudget(uint256 budgetPerWindow);
    error InvalidPolicyExpiry(uint256 provided, uint256 currentTime);
    error ZeroAmount();

    // --- Events ---

    event VaultFunded(address indexed owner, uint256 amount, uint256 newBalance);
    event VaultWithdrawn(address indexed owner, uint256 amount, uint256 newBalance);
    event PolicySet(
        address indexed agent,
        uint256 maxPerChannel,
        uint256 budgetPerWindow,
        uint256 windowSecs,
        uint256 expiry,
        int128 minPayeeRep,
        bool requireRegisteredPayee
    );
    event AgentRevokedEvent(address indexed agent);
    event ChannelOpened(
        bytes32 indexed channelId,
        address indexed agent,
        address indexed payee,
        uint256 payeeAgentId,
        uint256 deposit,
        uint256 expiry
    );
    event Claimed(bytes32 indexed channelId, address indexed payee, uint256 cumulativeAmount, uint256 delta);
    event ChannelClosed(bytes32 indexed channelId, uint256 claimed, uint256 refunded);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Modifiers ---

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(
        address _usdc,
        address _identityRegistry,
        address _reputationRegistry
    ) EIP712("SpendGuard", "1") {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_identityRegistry == address(0) || _reputationRegistry == address(0)) revert ZeroAddress();
        owner = msg.sender;
        usdc = IERC20(_usdc);
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // --- Owner Vault Management ---

    /// @notice Starts a two-step ownership transfer. New owner must call acceptOwnership().
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes the ownership transfer initiated by transferOwnership().
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert OnlyPendingOwner();
        address previous = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, msg.sender);
    }

    function setRegistries(address _identityRegistry, address _reputationRegistry) external onlyOwner {
        if (_identityRegistry == address(0) || _reputationRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
    }

    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        // Credit actual received amount (defends against fee-on-transfer tokens)
        uint256 received = usdc.balanceOf(address(this)) - balanceBefore;
        vaultBalance += received;
        emit VaultFunded(msg.sender, received, vaultBalance);
    }

    /// @notice Credits any tokens sent directly to the contract (not via fund) into the vault accounting.
    function syncVault() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance > vaultBalance) {
            uint256 stray = balance - vaultBalance;
            vaultBalance = balance;
            emit VaultFunded(msg.sender, stray, vaultBalance);
        }
    }

    function withdraw(uint256 amount) external nonReentrant onlyOwner {
        if (amount > vaultBalance) revert InsufficientVaultBalance(amount, vaultBalance);
        vaultBalance -= amount;
        usdc.safeTransfer(owner, amount);
        emit VaultWithdrawn(owner, amount, vaultBalance);
    }

    function setPolicy(
        address agent,
        uint256 maxPerChannel,
        uint256 budgetPerWindow,
        uint256 windowSecs,
        uint256 expiry,
        int128 minPayeeRep,
        bool requireRegisteredPayee
    ) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (windowSecs == 0) revert InvalidPolicyWindow(windowSecs);
        if (budgetPerWindow == 0) revert InvalidPolicyBudget(budgetPerWindow);
        if (expiry <= block.timestamp) revert InvalidPolicyExpiry(expiry, block.timestamp);

        policies[agent] = Policy({
            maxPerChannel: maxPerChannel,
            budgetPerWindow: budgetPerWindow,
            windowSecs: windowSecs,
            expiry: expiry,
            minPayeeRep: minPayeeRep,
            requireRegisteredPayee: requireRegisteredPayee,
            active: true
        });

        // Always reset the rolling window when a policy is (re)placed so spend
        // from a previous policy/window never leaks into the new budget.
        windowTrackers[agent].windowStart = block.timestamp;
        windowTrackers[agent].windowSpent = 0;

        emit PolicySet(
            agent,
            maxPerChannel,
            budgetPerWindow,
            windowSecs,
            expiry,
            minPayeeRep,
            requireRegisteredPayee
        );
    }

    function revokeAgent(address agent) external onlyOwner {
        policies[agent].active = false;
        emit AgentRevokedEvent(agent);
    }

    // --- Channel Management ---

    function openChannel(
        address payee,
        uint256 payeeAgentId,
        uint256 deposit,
        uint256 channelExpiry
    ) external nonReentrant returns (bytes32 channelId) {
        address agent = msg.sender;
        Policy memory policy = policies[agent];

        // Input validation
        if (payee == address(0)) revert ZeroAddress();
        if (deposit == 0) revert ZeroAmount();
        if (channelExpiry <= block.timestamp) revert InvalidChannelExpiry(channelExpiry, block.timestamp);

        if (!policy.active) revert AgentRevoked(agent);
        if (block.timestamp > policy.expiry) revert PolicyExpired(agent, policy.expiry);
        if (deposit > policy.maxPerChannel) revert OverChannelCap(deposit, policy.maxPerChannel);
        if (deposit > vaultBalance) revert InsufficientVaultBalance(deposit, vaultBalance);

        // Rolling Window Budget Check
        WindowTracker storage tracker = windowTrackers[agent];
        if (block.timestamp >= tracker.windowStart + policy.windowSecs) {
            tracker.windowStart = block.timestamp;
            tracker.windowSpent = 0;
        }

        if (tracker.windowSpent + deposit > policy.budgetPerWindow) {
            revert WindowBudgetExceeded(deposit, tracker.windowSpent, policy.budgetPerWindow);
        }

        // ERC-8004 Payee Registration Check — the payee address must actually be
        // bound to payeeAgentId (owner or agent wallet), otherwise a caller could
        // cite any third party's registered/high-reputation agentId.
        if (policy.requireRegisteredPayee || policy.minPayeeRep > 0) {
            if (!_isBoundPayee(payee, payeeAgentId)) {
                revert PayeeNotRegistered(payee, payeeAgentId);
            }
        }

        // ERC-8004 Payee Reputation Check (normalized for registry decimals)
        if (policy.minPayeeRep > 0) {
            (bool repOk, int128 actualRep) = _reputationOf(payeeAgentId);
            if (!repOk || actualRep < policy.minPayeeRep) {
                revert PayeeReputationTooLow(payeeAgentId, repOk ? actualRep : int128(0), policy.minPayeeRep);
            }
        }

        // Deduct from vault and track spend
        vaultBalance -= deposit;
        tracker.windowSpent += deposit;

        channelNonce++;
        channelId = keccak256(
            abi.encodePacked(agent, payee, payeeAgentId, deposit, channelExpiry, channelNonce, block.chainid)
        );

        channels[channelId] = Channel({
            agent: agent,
            payee: payee,
            payeeAgentId: payeeAgentId,
            deposit: deposit,
            claimed: 0,
            expiry: channelExpiry,
            closed: false
        });

        emit ChannelOpened(channelId, agent, payee, payeeAgentId, deposit, channelExpiry);
    }

    function claim(
        bytes32 channelId,
        uint256 cumulativeAmount,
        bytes calldata sig
    ) external nonReentrant {
        Channel storage channel = channels[channelId];

        if (channel.closed) revert ChannelNotOpen(channelId);
        if (block.timestamp > channel.expiry) revert ChannelExpired(channelId);
        if (msg.sender != channel.payee) revert OnlyPayee();

        // Check agent revocation status
        if (!policies[channel.agent].active) revert AgentRevoked(channel.agent);

        if (cumulativeAmount <= channel.claimed) {
            revert InvalidCumulativeAmount(cumulativeAmount, channel.claimed);
        }
        if (cumulativeAmount > channel.deposit) {
            revert VoucherExceedsDeposit(cumulativeAmount, channel.deposit);
        }

        // Verify EIP-712 Voucher Signature (tryRecover never reverts on malformed sigs,
        // so InvalidVoucher is always reachable for bad signers / garbage signatures)
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, channelId, cumulativeAmount));
        bytes32 digest = _hashTypedDataV4(structHash);
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
        if (err != ECDSA.RecoverError.NoError || recovered != channel.agent) {
            revert InvalidVoucher(channelId, recovered, channel.agent);
        }

        uint256 delta = cumulativeAmount - channel.claimed;
        channel.claimed = cumulativeAmount;

        // Local reputation updates
        settledVolume[channel.payee] += delta;
        if (!hasPaidPayee[channel.payee][channel.agent]) {
            hasPaidPayee[channel.payee][channel.agent] = true;
            uniquePayers[channel.payee] += 1;
        }

        emit Claimed(channelId, channel.payee, cumulativeAmount, delta);

        usdc.safeTransfer(channel.payee, delta);
    }

    function closeChannel(bytes32 channelId) external nonReentrant {
        Channel storage channel = channels[channelId];
        if (channel.closed) revert ChannelNotOpen(channelId);

        // The payee (seller) may settle and release a channel at any time. The
        // agent (buyer) and any third party may only close once the channel has
        // expired, so a buyer can never cut off an in-flight seller claim.
        if (msg.sender != channel.payee && block.timestamp <= channel.expiry) {
            revert ChannelNotExpirableYet(channelId, channel.expiry, block.timestamp);
        }

        channel.closed = true;
        uint256 remainder = channel.deposit - channel.claimed;

        if (remainder > 0) {
            vaultBalance += remainder;
        }

        emit ChannelClosed(channelId, channel.claimed, remainder);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // --- Internal Gating Helpers ---

    /// @dev Returns true iff `payee` is the registered owner of `payeeAgentId`,
    ///      or the registry's agent wallet for that id. Reverts/zero/absent ids fail closed.
    function _isBoundPayee(address payee, uint256 payeeAgentId) internal view returns (bool) {
        if (payee == address(0) || payeeAgentId == 0) return false;
        address registered;
        try identityRegistry.ownerOf(payeeAgentId) returns (address owner_) {
            registered = owner_;
        } catch {
            return false;
        }
        if (registered == address(0)) return false;
        if (registered == payee) return true;
        try identityRegistry.getAgentWallet(payeeAgentId) returns (address wallet) {
            return wallet != address(0) && wallet == payee;
        } catch {
            return false;
        }
    }

    /// @dev Normalizes a registry summary to policy units: divides out `repDecimals`.
    ///      Returns 0 when there is no feedback or the registry reports unusable decimals (fail closed).
    function _normalizedRep(
        uint64 count,
        int128 summaryValue,
        uint8 repDecimals
    ) internal pure returns (int128) {
        if (count == 0) return 0;
        if (repDecimals > 18) return 0;
        if (repDecimals == 0) return summaryValue;
        return int128(int256(summaryValue) / int256(uint256(10) ** repDecimals));
    }

    // ERC-8004 registries require a non-empty client list for getSummary, so
    // resolve the feedback-givers first. Any failure fails closed.
    function _reputationOf(uint256 payeeAgentId) internal view returns (bool ok, int128 rep) {
        try reputationRegistry.getClients(payeeAgentId) returns (address[] memory clients) {
            if (clients.length == 0) return (false, 0);
            try reputationRegistry.getSummary(payeeAgentId, clients, "", "") returns (
                uint64 count,
                int128 summaryValue,
                uint8 repDecimals
            ) {
                return (true, _normalizedRep(count, summaryValue, repDecimals));
            } catch {
                return (false, 0);
            }
        } catch {
            return (false, 0);
        }
    }

    // --- Simulation View Function for Client/Server Rejection Pre-checks ---

    function checkOpenChannel(
        address agent,
        address payee,
        uint256 payeeAgentId,
        uint256 deposit
    ) external view returns (bool ok, string memory reason) {
        if (payee == address(0)) return (false, "ZeroAddress");
        if (deposit == 0) return (false, "ZeroAmount");

        Policy memory policy = policies[agent];
        if (!policy.active) return (false, "AgentRevoked");
        if (block.timestamp > policy.expiry) return (false, "PolicyExpired");
        if (deposit > policy.maxPerChannel) return (false, "OverChannelCap");
        if (deposit > vaultBalance) return (false, "InsufficientVaultBalance");

        WindowTracker memory tracker = windowTrackers[agent];
        uint256 currentSpent = tracker.windowSpent;
        if (block.timestamp >= tracker.windowStart + policy.windowSecs) {
            currentSpent = 0;
        }
        if (currentSpent + deposit > policy.budgetPerWindow) {
            return (false, "WindowBudgetExceeded");
        }

        if (policy.requireRegisteredPayee || policy.minPayeeRep > 0) {
            if (!_isBoundPayee(payee, payeeAgentId)) return (false, "PayeeNotRegistered");
        }

        if (policy.minPayeeRep > 0) {
            (bool repOk, int128 actualRep) = _reputationOf(payeeAgentId);
            if (!repOk || actualRep < policy.minPayeeRep) {
                return (false, "PayeeReputationTooLow");
            }
        }

        return (true, "");
    }
}
