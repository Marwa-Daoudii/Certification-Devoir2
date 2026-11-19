// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Contrat reserve aux tests de callback ERC-721.
contract ReentrantReceiver {
    address public target;
    bytes public payload;
    bool public attackSucceeded;

    function configure(address destination, bytes calldata data) external {
        target = destination;
        payload = data;
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external returns (bytes4)
    {
        (attackSucceeded,) = target.call(payload);
        return this.onERC721Received.selector;
    }
}
