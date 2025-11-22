// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Opacus DataStream
/// @notice Manages data channels, subscriptions and usage accounting
contract DataStream is Ownable, ReentrancyGuard {
    constructor(address _protocolTreasury) Ownable(_msgSender()) {
        protocolTreasury = _protocolTreasury;
    }
    struct Channel {
        bytes32 id;
        bytes32 dacId;
        address owner;
        uint256 pricePerByte;
        uint256 pricePerMessage;
        uint256 subscriptionFee;
        uint256 created;
        bool active;
        uint256 totalRevenue;
    }

    struct Subscription {
        uint256 since;
        uint256 deposited;
        uint256 used;
        uint256 bytesConsumed;
        uint256 messagesConsumed;
        bool active;
    }

    mapping(bytes32 => Channel) public channels;
    mapping(bytes32 => mapping(address => Subscription)) public subscriptions;
    mapping(bytes32 => address[]) public channelSubscribers;
    mapping(bytes32 => bytes32[]) public dacChannels;

    address public protocolTreasury;
    uint256 public platformFeePercent = 2; // 2% protocol fee
    uint256 public totalChannels;

    event ChannelCreated(bytes32 indexed channelId, bytes32 indexed dacId, address owner);
    event ChannelUpdated(bytes32 indexed channelId);
    event ChannelClosed(bytes32 indexed channelId);
    event Subscribed(bytes32 indexed channelId, address indexed subscriber, uint256 amount);
    event Unsubscribed(bytes32 indexed channelId, address indexed subscriber);
    event UsageRecorded(bytes32 indexed channelId, address indexed user, uint256 bytes_, uint256 messages);
    event Settled(bytes32 indexed channelId, uint256 amount);

    modifier channelExists(bytes32 channelId) {
        require(channels[channelId].created > 0, "Channel not found");
        _;
    }

    modifier onlyChannelOwner(bytes32 channelId) {
        require(channels[channelId].owner == _msgSender(), "Not channel owner");
        _;
    }

    function createChannel(bytes32 dacId, uint256 pricePerByte, uint256 pricePerMessage, uint256 subscriptionFee) external returns (bytes32) {
        bytes32 channelId = keccak256(abi.encodePacked(_msgSender(), dacId, block.timestamp, totalChannels));
        channels[channelId] = Channel({
            id: channelId,
            dacId: dacId,
            owner: _msgSender(),
            pricePerByte: pricePerByte,
            pricePerMessage: pricePerMessage,
            subscriptionFee: subscriptionFee,
            created: block.timestamp,
            active: true,
            totalRevenue: 0
        });
        dacChannels[dacId].push(channelId);
        totalChannels++;
        emit ChannelCreated(channelId, dacId, _msgSender());
        return channelId;
    }

    function updateChannel(bytes32 channelId, uint256 pricePerByte, uint256 pricePerMessage, uint256 subscriptionFee) external channelExists(channelId) onlyChannelOwner(channelId) {
        Channel storage ch = channels[channelId];
        ch.pricePerByte = pricePerByte;
        ch.pricePerMessage = pricePerMessage;
        ch.subscriptionFee = subscriptionFee;
        emit ChannelUpdated(channelId);
    }

    function subscribe(bytes32 channelId) external payable channelExists(channelId) nonReentrant {
        Channel storage ch = channels[channelId];
        require(ch.active, "Channel not active");
        require(msg.value >= ch.subscriptionFee, "Insufficient fee");
        subscriptions[channelId][_msgSender()] = Subscription({
            since: block.timestamp,
            deposited: msg.value,
            used: 0,
            bytesConsumed: 0,
            messagesConsumed: 0,
            active: true
        });
        channelSubscribers[channelId].push(_msgSender());
        emit Subscribed(channelId, _msgSender(), msg.value);
    }

    function topUp(bytes32 channelId) external payable channelExists(channelId) {
        require(subscriptions[channelId][_msgSender()].active, "Not subscribed");
        subscriptions[channelId][_msgSender()].deposited += msg.value;
    }

    function recordUsage(bytes32 channelId, address user, uint256 bytes_, uint256 messages) external channelExists(channelId) onlyChannelOwner(channelId) {
        Channel storage ch = channels[channelId];
        Subscription storage sub = subscriptions[channelId][user];
        require(sub.active, "User not subscribed");
        uint256 cost = bytes_ * ch.pricePerByte + messages * ch.pricePerMessage;
        require(sub.deposited - sub.used >= cost, "Insufficient balance");
        sub.used += cost;
        sub.bytesConsumed += bytes_;
        sub.messagesConsumed += messages;
        emit UsageRecorded(channelId, user, bytes_, messages);
    }

    function settle(bytes32 channelId) external channelExists(channelId) onlyChannelOwner(channelId) nonReentrant returns (uint256) {
        Channel storage ch = channels[channelId];
        uint256 total = 0;
        address[] storage subs = channelSubscribers[channelId];
        for (uint256 i = 0; i < subs.length; i++) {
            Subscription storage sub = subscriptions[channelId][subs[i]];
            if (sub.used > 0) {
                total += sub.used;
                sub.used = 0;
            }
        }
        if (total > 0) {
            uint256 platformFee = (total * platformFeePercent) / 100;
            uint256 ownerAmount = total - platformFee;
            payable(ch.owner).transfer(ownerAmount);
            
            // Transfer protocol fee to treasury
            if (platformFee > 0 && protocolTreasury != address(0)) {
                payable(protocolTreasury).transfer(platformFee);
            }
            
            ch.totalRevenue += total;
        }
        emit Settled(channelId, total);
        return total;
    }

    function closeChannel(bytes32 channelId) external channelExists(channelId) onlyChannelOwner(channelId) {
        channels[channelId].active = false;
        emit ChannelClosed(channelId);
    }

    function getChannel(bytes32 channelId) external view returns (Channel memory) {
        return channels[channelId];
    }

    function getSubscription(bytes32 channelId, address user) external view returns (Subscription memory) {
        return subscriptions[channelId][user];
    }

    function getDACChannels(bytes32 dacId) external view returns (bytes32[] memory) {
        return dacChannels[dacId];
    }
    
    function setProtocolTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        protocolTreasury = _treasury;
    }
    
    function setPlatformFeePercent(uint256 _percent) external onlyOwner {
        require(_percent <= 10, "Fee too high"); // Max 10%
        platformFeePercent = _percent;
    }
}
