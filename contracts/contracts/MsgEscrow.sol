// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Opacus Message Escrow
/// @notice ERC20-based micropayment escrow for message routing / relay incentives
contract MsgEscrow is Ownable, ReentrancyGuard {
    constructor(address _paymentToken, address _protocolTreasury) Ownable(_msgSender()) {
        paymentToken = IERC20(_paymentToken);
        protocolTreasury = _protocolTreasury;
    }
    IERC20 public paymentToken;
    
    // Protocol fee system
    address public protocolTreasury;
    uint256 public protocolFeePercentage = 200; // 2% (basis points: 200/10000 = 2%)

    struct Lock {
        bytes32 id;
        address payer;
        address payee;
        uint256 amount;
        bytes32 messageHash;
        uint256 created;
        uint256 expiry;
        bool released;
        bool cancelled;
    }

    mapping(bytes32 => Lock) public locks;
    mapping(address => uint256) public relayerBonds;
    mapping(address => bool) public authorizedRelayers;

    uint256 public minLockAmount = 1e15; // 0.001 token units
    uint256 public defaultExpiry = 1 days;
    uint256 public relayerBondAmount = 1 ether;

    event Locked(bytes32 indexed lockId, address payer, address payee, uint256 amount);
    event Released(bytes32 indexed lockId, address relayer);
    event Cancelled(bytes32 indexed lockId);
    event RelayerAdded(address relayer);
    event RelayerRemoved(address relayer);



    function addRelayer() external payable {
        require(msg.value >= relayerBondAmount, "Insufficient bond");
        relayerBonds[_msgSender()] = msg.value;
        authorizedRelayers[_msgSender()] = true;
        emit RelayerAdded(_msgSender());
    }

    function removeRelayer() external nonReentrant {
        require(authorizedRelayers[_msgSender()], "Not a relayer");
        uint256 bond = relayerBonds[_msgSender()];
        relayerBonds[_msgSender()] = 0;
        authorizedRelayers[_msgSender()] = false;
        payable(_msgSender()).transfer(bond);
        emit RelayerRemoved(_msgSender());
    }

    function lock(bytes32 lockId, address payee, uint256 amount, bytes32 messageHash) external nonReentrant returns (bool) {
        require(locks[lockId].payer == address(0), "Lock exists");
        require(amount >= minLockAmount, "Amount too small");
        require(paymentToken.transferFrom(_msgSender(), address(this), amount), "Transfer failed");
        locks[lockId] = Lock({
            id: lockId,
            payer: _msgSender(),
            payee: payee,
            amount: amount,
            messageHash: messageHash,
            created: block.timestamp,
            expiry: block.timestamp + defaultExpiry,
            released: false,
            cancelled: false
        });
        emit Locked(lockId, _msgSender(), payee, amount);
        return true;
    }

    function release(bytes32 lockId) external nonReentrant returns (bool) {
        require(authorizedRelayers[_msgSender()], "Not authorized relayer");
        Lock storage l = locks[lockId];
        require(l.payer != address(0), "Lock not found");
        require(!l.released && !l.cancelled, "Already processed");
        l.released = true;
        
        // Calculate protocol fee (2%)
        uint256 protocolFee = (l.amount * protocolFeePercentage) / 10000;
        uint256 payeeAmount = l.amount - protocolFee;
        
        // Transfer protocol fee to treasury
        if (protocolFee > 0 && protocolTreasury != address(0)) {
            require(paymentToken.transfer(protocolTreasury, protocolFee), "Fee transfer failed");
        }
        
        // Transfer remaining amount to payee
        require(paymentToken.transfer(l.payee, payeeAmount), "Transfer failed");
        emit Released(lockId, _msgSender());
        return true;
    }

    function cancel(bytes32 lockId) external nonReentrant returns (bool) {
        Lock storage l = locks[lockId];
        require(l.payer == _msgSender(), "Not payer");
        require(!l.released && !l.cancelled, "Already processed");
        require(block.timestamp > l.expiry, "Not expired");
        l.cancelled = true;
        require(paymentToken.transfer(l.payer, l.amount), "Transfer failed");
        emit Cancelled(lockId);
        return true;
    }

    function getLock(bytes32 lockId) external view returns (Lock memory) {
        return locks[lockId];
    }

    function setMinLockAmount(uint256 _amount) external onlyOwner {
        minLockAmount = _amount;
    }

    function setDefaultExpiry(uint256 _expiry) external onlyOwner {
        defaultExpiry = _expiry;
    }

    function setRelayerBondAmount(uint256 _amount) external onlyOwner {
        relayerBondAmount = _amount;
    }
    
    function setProtocolTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        protocolTreasury = _treasury;
    }
    
    function setProtocolFeePercentage(uint256 _percentage) external onlyOwner {
        require(_percentage <= 1000, "Fee too high"); // Max 10%
        protocolFeePercentage = _percentage;
    }
}
