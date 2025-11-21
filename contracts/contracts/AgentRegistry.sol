// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Opacus Agent Registry
/// @notice Manages agent identities, key rotation, stake and reputation
contract AgentRegistry is Ownable, ReentrancyGuard {
    constructor() Ownable(_msgSender()) {}
    struct Agent {
        bytes32 id;
        bytes32 edPubKeyHash;
        bytes32 xPubKeyHash;
        address owner;
        string metadataURI;
        uint256 registered;
        uint256 lastKeyRotation;
        bool active;
        uint256 reputation;
        uint256 stake;
    }

    mapping(bytes32 => Agent) public agents;
    mapping(address => bytes32[]) public ownerAgents;
    mapping(bytes32 => bytes32) public pubKeyToAgent; // edPubKeyHash -> agentId

    uint256 public minStake = 0.001 ether;
    uint256 public totalAgents;
    uint256 public keyRotationCooldown = 1 days;

    event AgentRegistered(bytes32 indexed agentId, address indexed owner, bytes32 edPubKeyHash);
    event KeysRotated(bytes32 indexed agentId, bytes32 newEdPubKeyHash, bytes32 newXPubKeyHash);
    event AgentDeactivated(bytes32 indexed agentId);
    event ReputationUpdated(bytes32 indexed agentId, uint256 newReputation);
    event AgentSlashed(bytes32 indexed agentId, uint256 amount, string reason);

    modifier agentExists(bytes32 agentId) {
        require(agents[agentId].registered > 0, "Agent not found");
        _;
    }

    modifier onlyAgentOwner(bytes32 agentId) {
        require(agents[agentId].owner == _msgSender(), "Not agent owner");
        _;
    }

    function registerAgent(bytes32 edPubKeyHash, bytes32 xPubKeyHash, string calldata metadataURI) external payable nonReentrant returns (bytes32) {
        require(msg.value >= minStake, "Insufficient stake");
        require(pubKeyToAgent[edPubKeyHash] == bytes32(0), "Key already registered");
        bytes32 agentId = keccak256(abi.encodePacked(_msgSender(), edPubKeyHash, block.timestamp));

        agents[agentId] = Agent({
            id: agentId,
            edPubKeyHash: edPubKeyHash,
            xPubKeyHash: xPubKeyHash,
            owner: _msgSender(),
            metadataURI: metadataURI,
            registered: block.timestamp,
            lastKeyRotation: block.timestamp,
            active: true,
            reputation: 100,
            stake: msg.value
        });

        ownerAgents[_msgSender()].push(agentId);
        pubKeyToAgent[edPubKeyHash] = agentId;
        totalAgents++;
        emit AgentRegistered(agentId, _msgSender(), edPubKeyHash);
        return agentId;
    }

    function rotateKeys(bytes32 agentId, bytes32 newEdPubKeyHash, bytes32 newXPubKeyHash) external agentExists(agentId) onlyAgentOwner(agentId) {
        Agent storage agent = agents[agentId];
        require(block.timestamp >= agent.lastKeyRotation + keyRotationCooldown, "Cooldown not elapsed");
        require(pubKeyToAgent[newEdPubKeyHash] == bytes32(0), "Key already used");

        delete pubKeyToAgent[agent.edPubKeyHash];
        agent.edPubKeyHash = newEdPubKeyHash;
        agent.xPubKeyHash = newXPubKeyHash;
        agent.lastKeyRotation = block.timestamp;
        pubKeyToAgent[newEdPubKeyHash] = agentId;
        emit KeysRotated(agentId, newEdPubKeyHash, newXPubKeyHash);
    }

    function deactivateAgent(bytes32 agentId) external agentExists(agentId) onlyAgentOwner(agentId) {
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    function updateReputation(bytes32 agentId, int256 delta) external onlyOwner {
        Agent storage agent = agents[agentId];
        if (delta > 0) {
            agent.reputation += uint256(delta);
        } else {
            uint256 decrease = uint256(-delta);
            agent.reputation = agent.reputation > decrease ? agent.reputation - decrease : 0;
        }
        emit ReputationUpdated(agentId, agent.reputation);
    }

    function slash(bytes32 agentId, uint256 amount, string calldata reason) external onlyOwner nonReentrant {
        Agent storage agent = agents[agentId];
        require(agent.stake >= amount, "Insufficient stake");
        agent.stake -= amount;
        payable(owner()).transfer(amount);
        emit AgentSlashed(agentId, amount, reason);
    }

    function getAgent(bytes32 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getAgentByPubKey(bytes32 edPubKeyHash) external view returns (Agent memory) {
        bytes32 agentId = pubKeyToAgent[edPubKeyHash];
        require(agentId != bytes32(0), "Agent not found");
        return agents[agentId];
    }

    function verifyAgent(bytes32 agentId, bytes32 edPubKeyHash) external view returns (bool) {
        return agents[agentId].edPubKeyHash == edPubKeyHash && agents[agentId].active;
    }
}
