// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import './poseidon/PoseidonT3.sol';

library MerkleTree {
    uint32 internal constant TREE_DEPTH = 20;

    struct Tree {
        uint32 nextIndex;
        bytes32[TREE_DEPTH] zeros;
        bytes32[TREE_DEPTH] filledSubtrees;
        bytes32 root;
    }

    function init(Tree storage self) internal {
        bytes32 zero = bytes32(0);
        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            self.zeros[i] = zero;
            self.filledSubtrees[i] = zero;
            uint[2] memory input = [uint256(zero), uint256(zero)];
            zero = bytes32(PoseidonT3.hash(input));
        }
        self.root = zero;
        self.nextIndex = 0;
    }

    function insert(Tree storage self, bytes32 leaf) internal returns (uint32 index) {
        index = self.nextIndex;
        require(index < uint32(1) << TREE_DEPTH, 'MERKLE_FULL');
        self.nextIndex = index + 1;

        bytes32 currentHash = leaf;
        uint32 currentIndex = index;

        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                self.filledSubtrees[i] = currentHash;
                uint[2] memory input = [uint256(currentHash), uint256(self.zeros[i])];
                currentHash = bytes32(PoseidonT3.hash(input));
            } else {
                uint[2] memory input = [uint256(self.filledSubtrees[i]), uint256(currentHash)];
                currentHash = bytes32(PoseidonT3.hash(input));
            }
            currentIndex /= 2;
        }

        self.root = currentHash;
    }

    function root(Tree storage self) internal view returns (bytes32) {
        return self.root;
    }

    function count(Tree storage self) internal view returns (uint32) {
        return self.nextIndex;
    }
}
