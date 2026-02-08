pragma circom 2.0.0;

include "poseidon.circom";
include "comparators.circom";

template MerkleProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;
    signal output index;

    signal current[depth + 1];
    signal idx[depth + 1];
    current[0] <== leaf;
    idx[0] <== 0;

    component h[depth];
    signal left[depth];
    signal right[depth];
    signal left1[depth];
    signal left2[depth];
    signal right1[depth];
    signal right2[depth];

    for (var i = 0; i < depth; i++) {
        h[i] = Poseidon(2);

        left1[i] <== current[i] * (1 - pathIndices[i]);
        left2[i] <== pathElements[i] * pathIndices[i];
        left[i] <== left1[i] + left2[i];

        right1[i] <== pathElements[i] * (1 - pathIndices[i]);
        right2[i] <== current[i] * pathIndices[i];
        right[i] <== right1[i] + right2[i];

        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];

        current[i + 1] <== h[i].out;
        idx[i + 1] <== idx[i] + pathIndices[i] * (1 << i);
    }

    root <== current[depth];
    index <== idx[depth];
}

template IsAllowedDenom() {
    signal input denom;
    signal output ok;

    component eq5 = IsEqual();
    component eq10 = IsEqual();
    component eq20 = IsEqual();
    component eq50 = IsEqual();
    component eq100 = IsEqual();

    eq5.in[0] <== denom;
    eq5.in[1] <== 5000000;

    eq10.in[0] <== denom;
    eq10.in[1] <== 10000000;

    eq20.in[0] <== denom;
    eq20.in[1] <== 20000000;

    eq50.in[0] <== denom;
    eq50.in[1] <== 50000000;

    eq100.in[0] <== denom;
    eq100.in[1] <== 100000000;

    ok <== eq5.out + eq10.out + eq20.out + eq50.out + eq100.out;
}

template Spend(depth) {
    signal input secret1;
    signal input denom1;
    signal input secret2;
    signal input denom2;

    signal input pathElements1[depth];
    signal input pathIndices1[depth];
    signal input pathElements2[depth];
    signal input pathIndices2[depth];

    signal input changeSecret;

    signal input merkleRoot;
    signal input merchant;
    signal input price;
    signal input fee;
    signal input feeRecipient;
    signal input intentHash;
    signal input expiry;
    signal input noteCount;
    signal input minConfirmations;
    signal input changeDenom;

    signal input nullifier1;
    signal input nullifier2;
    signal input changeCommitment;

    component c1 = Poseidon(2);
    c1.inputs[0] <== secret1;
    c1.inputs[1] <== denom1;
    signal commitment1;
    commitment1 <== c1.out;

    component c2 = Poseidon(2);
    c2.inputs[0] <== secret2;
    c2.inputs[1] <== denom2;
    signal commitment2;
    commitment2 <== c2.out;

    component n1 = Poseidon(2);
    n1.inputs[0] <== secret1;
    n1.inputs[1] <== 1;
    nullifier1 === n1.out;

    component n2 = Poseidon(2);
    n2.inputs[0] <== secret2;
    n2.inputs[1] <== 1;
    nullifier2 === n2.out;

    component proof1 = MerkleProof(depth);
    proof1.leaf <== commitment1;
    for (var i = 0; i < depth; i++) {
        proof1.pathElements[i] <== pathElements1[i];
        proof1.pathIndices[i] <== pathIndices1[i];
    }

    component proof2 = MerkleProof(depth);
    proof2.leaf <== commitment2;
    for (var i = 0; i < depth; i++) {
        proof2.pathElements[i] <== pathElements2[i];
        proof2.pathIndices[i] <== pathIndices2[i];
    }

    proof1.root === merkleRoot;
    proof2.root === merkleRoot;

    component allowed1 = IsAllowedDenom();
    allowed1.denom <== denom1;
    allowed1.ok === 1;

    component allowed2 = IsAllowedDenom();
    allowed2.denom <== denom2;
    allowed2.ok === 1;

    component changeAllowed = IsAllowedDenom();
    changeAllowed.denom <== changeDenom;

    component changeIsZero = IsEqual();
    changeIsZero.in[0] <== changeDenom;
    changeIsZero.in[1] <== 0;

    changeAllowed.ok + changeIsZero.out === 1;

    component changeCommit = Poseidon(2);
    changeCommit.inputs[0] <== changeSecret;
    changeCommit.inputs[1] <== changeDenom;

    signal expectedChangeCommitment;
    expectedChangeCommitment <== changeCommit.out * (1 - changeIsZero.out);
    changeCommitment === expectedChangeCommitment;

    denom1 + denom2 === price + fee + changeDenom;

    component lt1 = LessThan(32);
    lt1.in[0] <== noteCount - proof1.index;
    lt1.in[1] <== minConfirmations;
    lt1.out === 0;

    component lt2 = LessThan(32);
    lt2.in[0] <== noteCount - proof2.index;
    lt2.in[1] <== minConfirmations;
    lt2.out === 0;

    // public inputs are bound by inclusion in the main component
}

component main {
    public [merkleRoot, merchant, price, fee, feeRecipient, intentHash, expiry, noteCount, minConfirmations, changeDenom, nullifier1, nullifier2, changeCommitment]
} = Spend(20);
