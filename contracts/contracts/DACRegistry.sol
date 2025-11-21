// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Opacus DAC Registry
/// @notice Registers and manages Decentralized Agent Communication (DAC) instances
contract DACRegistry is Ownable, ReentrancyGuard {
    constructor() Ownable(_msgSender()) {}
    struct DAC {
        bytes32 id;
        address owner;
        string metadataURI;
        uint256 created;
        uint256 updated;
        bool active;
        uint256 stake;
    }

    struct Permission {
        address account;
        uint8 role; // 0=none,1=reader,2=writer,3=operator,4=owner
        uint256 expiry;
    }

    mapping(bytes32 => DAC) public dacs;
    mapping(bytes32 => Permission[]) public dacPermissions;
    mapping(address => bytes32[]) public ownerDACs;

    uint256 public minStake = 0.01 ether;
    uint256 public totalDACs;

    event DACRegistered(bytes32 indexed dacId, address indexed owner, string metadataURI);
    event DACUpdated(bytes32 indexed dacId, string metadataURI);
    event DACTransferred(bytes32 indexed dacId, address indexed from, address indexed to);
    event DACDeactivated(bytes32 indexed dacId);
    event PermissionGranted(bytes32 indexed dacId, address indexed account, uint8 role);
    event PermissionRevoked(bytes32 indexed dacId, address indexed account);
    event StakeUpdated(bytes32 indexed dacId, uint256 amount);

    modifier dacExists(bytes32 dacId) {
        require(dacs[dacId].created > 0, "DAC not found");
        _;
    }

    modifier onlyDACOwner(bytes32 dacId) {
        require(dacs[dacId].owner == _msgSender(), "Not DAC owner");
        _;
    }

    /// @notice Register a new DAC with metadata and stake
    function registerDAC(string calldata metadataURI) external payable nonReentrant returns (bytes32) {
        require(msg.value >= minStake, "Insufficient stake");
        bytes32 dacId = keccak256(abi.encodePacked(_msgSender(), block.timestamp, totalDACs));
        require(dacs[dacId].created == 0, "DAC exists");

        dacs[dacId] = DAC({
            id: dacId,
            owner: _msgSender(),
            metadataURI: metadataURI,
            created: block.timestamp,
            updated: block.timestamp,
            active: true,
            stake: msg.value
        });

        ownerDACs[_msgSender()].push(dacId);
        totalDACs++;
        emit DACRegistered(dacId, _msgSender(), metadataURI);
        return dacId;
    }

    function updateDAC(bytes32 dacId, string calldata metadataURI) external dacExists(dacId) onlyDACOwner(dacId) {
        dacs[dacId].metadataURI = metadataURI;
        dacs[dacId].updated = block.timestamp;
        emit DACUpdated(dacId, metadataURI);
    }

    function transferDAC(bytes32 dacId, address newOwner) external dacExists(dacId) onlyDACOwner(dacId) {
        require(newOwner != address(0), "Invalid owner");
        address oldOwner = dacs[dacId].owner;
        dacs[dacId].owner = newOwner;
        ownerDACs[newOwner].push(dacId);
        emit DACTransferred(dacId, oldOwner, newOwner);
    }

    function deactivateDAC(bytes32 dacId) external dacExists(dacId) onlyDACOwner(dacId) {
        dacs[dacId].active = false;
        emit DACDeactivated(dacId);
    }

    function addStake(bytes32 dacId) external payable dacExists(dacId) onlyDACOwner(dacId) {
        dacs[dacId].stake += msg.value;
        emit StakeUpdated(dacId, dacs[dacId].stake);
    }

    function withdrawStake(bytes32 dacId, uint256 amount) external dacExists(dacId) onlyDACOwner(dacId) nonReentrant {
        require(dacs[dacId].stake - amount >= minStake, "Below min stake");
        dacs[dacId].stake -= amount;
        payable(_msgSender()).transfer(amount);
        emit StakeUpdated(dacId, dacs[dacId].stake);
    }

    function grantPermission(bytes32 dacId, address account, uint8 role, uint256 expiry) external dacExists(dacId) onlyDACOwner(dacId) {
        dacPermissions[dacId].push(Permission({account: account, role: role, expiry: expiry}));
        emit PermissionGranted(dacId, account, role);
    }

    function hasPermission(bytes32 dacId, address account, uint8 minRole) external view returns (bool) {
        if (dacs[dacId].owner == account) return true;
        Permission[] storage perms = dacPermissions[dacId];
        for (uint256 i = 0; i < perms.length; i++) {
            if (perms[i].account == account && perms[i].role >= minRole && (perms[i].expiry == 0 || perms[i].expiry > block.timestamp)) {
                return true;
            }
        }
        return false;
    }

    function getDAC(bytes32 dacId) external view returns (DAC memory) {
        return dacs[dacId];
    }

    function getOwnerDACs(address owner) external view returns (bytes32[] memory) {
        return ownerDACs[owner];
    }

    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
    }
}
