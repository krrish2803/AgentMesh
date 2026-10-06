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
        owner = msg.sender;
        usdc = IERC20(_usdc);
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
    }

    // --- Owner Vault Management ---

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function setRegistries(address _identityRegistry, address _reputationRegistry) external onlyOwner {
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
    }

    function fund(uint256 amount) external nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        vaultBalance += amount;
        emit VaultFunded(msg.sender, amount, vaultBalance);
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

        policies[agent] = Policy({
            maxPerChannel: maxPerChannel,
            budgetPerWindow: budgetPerWindow,
            windowSecs: windowSecs,
            expiry: expiry,
            minPayeeRep: minPayeeRep,
            requireRegisteredPayee: requireRegisteredPayee,
            active: true
        });

        // Initialize window start if not set
        if (windowTrackers[agent].windowStart == 0) {
            windowTrackers[agent].windowStart = block.timestamp;
            windowTrackers[agent].windowSpent = 0;
        }

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

        // ERC-8004 Payee Registration Check
        if (policy.requireRegisteredPayee && address(identityRegistry) != address(0)) {
            if (payeeAgentId == 0) revert PayeeNotRegistered(payee, payeeAgentId);
            try identityRegistry.ownerOf(payeeAgentId) returns (address regOwner) {
                if (regOwner == address(0)) revert PayeeNotRegistered(payee, payeeAgentId);
            } catch {
                revert PayeeNotRegistered(payee, payeeAgentId);
            }
        }

        // ERC-8004 Payee Reputation Check
        if (policy.minPayeeRep > 0 && address(reputationRegistry) != address(0)) {
            try reputationRegistry.getSummary(payeeAgentId, new address[](0), "", "") returns (
                uint64,
                int128 summaryValue,
                uint8
            ) {
                if (summaryValue < policy.minPayeeRep) {
                    revert PayeeReputationTooLow(payeeAgentId, summaryValue, policy.minPayeeRep);
                }
            } catch {
                // If reputation query fails or reverts
                revert PayeeReputationTooLow(payeeAgentId, 0, policy.minPayeeRep);
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

        // Verify EIP-712 Voucher Signature
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, channelId, cumulativeAmount));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, sig);

        if (recovered != channel.agent) {
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

        // Only agent, payee, or anyone after expiry can close
        if (msg.sender != channel.agent && msg.sender != channel.payee) {
            if (block.timestamp <= channel.expiry) {
                revert ChannelNotExpirableYet(channelId, channel.expiry, block.timestamp);
            }
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

    // --- Simulation View Function for Client/Server Rejection Pre-checks ---

    function checkOpenChannel(
        address agent,
        address /* payee */,
        uint256 payeeAgentId,
        uint256 deposit
    ) external view returns (bool ok, string memory reason) {
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

        if (policy.requireRegisteredPayee && address(identityRegistry) != address(0)) {
            if (payeeAgentId == 0) return (false, "PayeeNotRegistered");
            try identityRegistry.ownerOf(payeeAgentId) returns (address regOwner) {
                if (regOwner == address(0)) return (false, "PayeeNotRegistered");
            } catch {
                return (false, "PayeeNotRegistered");
            }
        }

        if (policy.minPayeeRep > 0 && address(reputationRegistry) != address(0)) {
            try reputationRegistry.getSummary(payeeAgentId, new address[](0), "", "") returns (
                uint64,
                int128 summaryValue,
                uint8
            ) {
                if (summaryValue < policy.minPayeeRep) {
                    return (false, "PayeeReputationTooLow");
                }
            } catch {
                return (false, "PayeeReputationTooLow");
            }
        }

        return (true, "");
    }
}
