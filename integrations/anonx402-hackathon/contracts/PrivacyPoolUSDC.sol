// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import './interfaces/IERC20.sol';
import './interfaces/IVerifier.sol';
import './MerkleTree.sol';

contract PrivacyPoolUSDC {
    using MerkleTree for MerkleTree.Tree;

    struct PublicInputs {
        bytes32 merkleRoot;
        bytes32 nullifier1;
        bytes32 nullifier2;
        address merchant;
        uint256 price;
        uint256 fee;
        address feeRecipient;
        bytes32 intentHash;
        uint256 expiry;
        uint256 noteCount;
        uint256 minConfirmations;
        uint256 changeDenom;
        bytes32 changeCommitment;
    }

    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    event Deposit(bytes32 indexed commitment, uint256 denom, uint32 index);
    event Spend(address indexed merchant, uint256 price, uint256 fee, bytes32 intentHash);
    event Change(bytes32 indexed commitment, uint256 denom, uint32 index);
    event FeesClaimed(address indexed to, uint256 amount);

    uint256 public constant FEE_BPS = 30;
    address public constant FEE_RECIPIENT = 0xBf395260f5780a2BC7C7A3321f59C39F4b91D27f;

    IERC20 public immutable usdc;
    IVerifier public immutable verifier;

    uint256 public immutable minAnonSet;
    uint256 public immutable minConfirmations;

    MerkleTree.Tree private tree;

    mapping(bytes32 => bool) public nullifierSpent;
    mapping(bytes32 => bool) public commitmentInserted;
    mapping(bytes32 => uint32) public commitmentIndex;
    mapping(uint256 => bool) public allowedDenoms;

    uint256 public feeAccrued;

    constructor(address usdcAddress, address verifierAddress, uint256 _minAnonSet, uint256 _minConfirmations) {
        require(usdcAddress != address(0), 'USDC');
        require(verifierAddress != address(0), 'VERIFIER');
        usdc = IERC20(usdcAddress);
        verifier = IVerifier(verifierAddress);
        minAnonSet = _minAnonSet;
        minConfirmations = _minConfirmations;

        tree.init();

        _setAllowedDenom(5 * 1e6);
        _setAllowedDenom(10 * 1e6);
        _setAllowedDenom(20 * 1e6);
        _setAllowedDenom(50 * 1e6);
        _setAllowedDenom(100 * 1e6);
    }

    function _setAllowedDenom(uint256 denom) internal {
        allowedDenoms[denom] = true;
    }

    function depositDenomination(uint256 denom, bytes32 commitment) external {
        require(allowedDenoms[denom], 'DENOM');
        require(!commitmentInserted[commitment], 'COMMITMENT');

        require(usdc.transferFrom(msg.sender, address(this), denom), 'TRANSFER');

        uint32 index = tree.insert(commitment);
        commitmentInserted[commitment] = true;
        commitmentIndex[commitment] = index;

        emit Deposit(commitment, denom, index);
    }

    function payMerchant(Proof calldata proof, PublicInputs calldata inputs) external {
        require(inputs.merkleRoot == MerkleTree.root(tree), 'ROOT');
        require(inputs.noteCount == MerkleTree.count(tree), 'COUNT');
        require(inputs.expiry >= block.timestamp, 'EXPIRED');
        require(inputs.feeRecipient == FEE_RECIPIENT, 'FEE_RECIPIENT');

        uint256 fee = (inputs.price * FEE_BPS) / 10000;
        require(inputs.fee == fee, 'FEE');
        require(MerkleTree.count(tree) >= minAnonSet, 'ANON_SET');

        _checkNullifier(inputs.nullifier1);
        _checkNullifier(inputs.nullifier2);
        require(inputs.minConfirmations == minConfirmations, 'MIN_CONFIRMATIONS');

        uint256[13] memory publicInputs;
        publicInputs[0] = uint256(inputs.merkleRoot);
        publicInputs[1] = uint256(uint160(inputs.merchant));
        publicInputs[2] = inputs.price;
        publicInputs[3] = inputs.fee;
        publicInputs[4] = uint256(uint160(inputs.feeRecipient));
        publicInputs[5] = uint256(inputs.intentHash);
        publicInputs[6] = inputs.expiry;
        publicInputs[7] = inputs.noteCount;
        publicInputs[8] = inputs.minConfirmations;
        publicInputs[9] = inputs.changeDenom;
        publicInputs[10] = uint256(inputs.nullifier1);
        publicInputs[11] = uint256(inputs.nullifier2);
        publicInputs[12] = uint256(inputs.changeCommitment);

        require(verifier.verifyProof(proof.a, proof.b, proof.c, publicInputs), 'PROOF');

        _markNullifier(inputs.nullifier1);
        _markNullifier(inputs.nullifier2);

        require(usdc.transfer(inputs.merchant, inputs.price), 'PAY');
        feeAccrued += inputs.fee;

        emit Spend(inputs.merchant, inputs.price, inputs.fee, inputs.intentHash);

        if (inputs.changeDenom > 0) {
            require(allowedDenoms[inputs.changeDenom], 'CHANGE_DENOM');
            require(!commitmentInserted[inputs.changeCommitment], 'CHANGE_COMMITMENT');
            uint32 index = tree.insert(inputs.changeCommitment);
            commitmentInserted[inputs.changeCommitment] = true;
            commitmentIndex[inputs.changeCommitment] = index;
            emit Change(inputs.changeCommitment, inputs.changeDenom, index);
        }
    }

    function _checkNullifier(bytes32 nullifier) internal view {
        if (nullifier == bytes32(0)) {
            return;
        }
        require(!nullifierSpent[nullifier], 'SPENT');
    }

    function _markNullifier(bytes32 nullifier) internal {
        if (nullifier == bytes32(0)) {
            return;
        }
        nullifierSpent[nullifier] = true;
    }

    function claimFees(address to, uint256 amount) external {
        require(msg.sender == FEE_RECIPIENT, 'NOT_FEE_RECIPIENT');
        require(amount <= feeAccrued, 'AMOUNT');
        feeAccrued -= amount;
        require(usdc.transfer(to, amount), 'FEE_TRANSFER');
        emit FeesClaimed(to, amount);
    }

    function root() external view returns (bytes32) {
        return MerkleTree.root(tree);
    }

    function noteCount() external view returns (uint32) {
        return MerkleTree.count(tree);
    }

    function params() external view returns (uint256, uint256) {
        return (minAnonSet, minConfirmations);
    }
}
