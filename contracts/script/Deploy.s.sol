// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpendGuard} from "../src/SpendGuard.sol";

contract DeploySpendGuard is Script {
    address constant MONAD_TESTNET_USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    address constant ERC8004_IDENTITY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address constant ERC8004_REPUTATION = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

    function run() external returns (SpendGuard guard) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address usdc = vm.envOr("USDC_ADDRESS", MONAD_TESTNET_USDC);
        address identity = vm.envOr("IDENTITY_REGISTRY_ADDRESS", ERC8004_IDENTITY);
        address reputation = vm.envOr("REPUTATION_REGISTRY_ADDRESS", ERC8004_REPUTATION);

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        guard = new SpendGuard(usdc, identity, reputation);
        console.log("SpendGuard deployed to:", address(guard));

        vm.stopBroadcast();
    }
}
