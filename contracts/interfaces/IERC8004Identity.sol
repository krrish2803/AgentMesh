// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC8004Identity {
    function register() external returns (uint256 agentId);
    function register(string calldata agentURI) external returns (uint256 agentId);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
}
