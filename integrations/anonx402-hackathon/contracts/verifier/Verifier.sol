// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 16818231325945311723810475226268342104198553560882555036882069683456564360190;
    uint256 constant alphay  = 3025025825069866710796734414276613014013662886934869490166330534747081807560;
    uint256 constant betax1  = 21732200759139617605958865986152383059769697553691760646114924133730744926719;
    uint256 constant betax2  = 16156720216508129871056457974318619112815514240620193246893041944822749324032;
    uint256 constant betay1  = 18519802923935951042144709361626881437109187931398704732902852615893672342020;
    uint256 constant betay2  = 1032765699754529612307129245498438772561916452485298711279992856936720885562;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 13663089556588994736548485556370191008452716714762707800283129128207793535447;
    uint256 constant deltax2 = 6989585179738147191426816063310654770530892391040834193006808448360911243479;
    uint256 constant deltay1 = 14513339414816563708774152754783721847579398862624238271101935797714923467243;
    uint256 constant deltay2 = 17490144280681632554086773698006980362727970678406904128911595895498171417175;

    
    uint256 constant IC0x = 9986997238844813539619945478923215696860924351810502902098694682992069721233;
    uint256 constant IC0y = 18164728632472631102616792758476607362542662894015401507400655659846296577838;
    
    uint256 constant IC1x = 1369963492808509054010834867431463187438606736584965802270722919999284240185;
    uint256 constant IC1y = 19399477070286979802792434415769202041209958918118998342698822908594614019199;
    
    uint256 constant IC2x = 19013427299830191701272529772569879738848718089112484045538893412450464588103;
    uint256 constant IC2y = 14909905508733953596638871996284964564892769487372536108216358084776728375054;
    
    uint256 constant IC3x = 13472948376832341432718336138725811342928458486418806412785389138988984334223;
    uint256 constant IC3y = 21566868269854554458382090173091467385184766127311355677664811105027755635371;
    
    uint256 constant IC4x = 1868303200243153834210363058791713640934461312982981569402702011243192317362;
    uint256 constant IC4y = 19400267861403843778253304203938040379173674765741617100238582645374898905618;
    
    uint256 constant IC5x = 3570770977870957223440467271737429081990505556374900711511296777089366175023;
    uint256 constant IC5y = 3878610315057892942184003058364805040223432268466269253538801129302475828738;
    
    uint256 constant IC6x = 16248414056470652287064649551262747929716454898124595310849457175194724216460;
    uint256 constant IC6y = 20890352112868083208574311636500028487051640260421662456105609730196969676716;
    
    uint256 constant IC7x = 13773571007400262686905600161299035550190750513823250568450072756848944046515;
    uint256 constant IC7y = 9207077018965454439921651147034525571939472868348742920902184105223645483900;
    
    uint256 constant IC8x = 17270652225930529263044706314282201372167772972730548511575693819979277713537;
    uint256 constant IC8y = 6180063612381866630434640873265710105451282613895343444200345768774319996578;
    
    uint256 constant IC9x = 12298251515188015019472417992291710642228098285162744100531942560921237794982;
    uint256 constant IC9y = 2844383354652333404586783968734854040123101177175743527231943664817345095496;
    
    uint256 constant IC10x = 10215477821882872818424700985411574399109248783921741413984142502844447845213;
    uint256 constant IC10y = 12091342471485382228912620404907793531283055323533869425180216728641042496456;
    
    uint256 constant IC11x = 16879241416482536266701584386742302057871466553230750142860150162023747077880;
    uint256 constant IC11y = 9927704412748246954987541085372268354582633863608522307024257007535839200087;
    
    uint256 constant IC12x = 18672157534319706054249753638538014419535965829283715918585476293632281634119;
    uint256 constant IC12y = 20974710014259464105648251759094030014319645485080041182698335403720756239859;
    
    uint256 constant IC13x = 21053925052514437301883682330405693108169947233408099493775249939549624910215;
    uint256 constant IC13y = 8889309506754158343453978068568213588013145749103824854564880543191845639646;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[13] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
