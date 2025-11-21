// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DACRegistry} from "./DACRegistry.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {DataStream} from "./DataStream.sol";
import {MsgEscrow} from "./MsgEscrow.sol";

/// @title Opacus Core Coordinator
/// @notice Links DACs, Agents, Data Streams and Escrow into unified registry
contract OpacusCore is Ownable {
    constructor() Ownable(_msgSender()) {}
    DACRegistry public dacRegistry;
    AgentRegistry public agentRegistry;
    DataStream public dataStream;
    MsgEscrow public escrow;

    mapping(bytes32 => bytes32[]) public dacAgents; // dacId -> agentIds
    mapping(bytes32 => bytes32) public agentDAC; // agentId -> dacId

    event ContractsInitialized(address dacRegistry, address agentRegistry, address dataStream, address escrow);
    event AgentAssignedToDAC(bytes32 indexed agentId, bytes32 indexed dacId);
    event AgentRemovedFromDAC(bytes32 indexed agentId, bytes32 indexed dacId);

    /// @notice Initialize external contract references (one-time)
    function initialize(address _dacRegistry, address _agentRegistry, address _dataStream, address _escrow) external onlyOwner {
        dacRegistry = DACRegistry(_dacRegistry);
        agentRegistry = AgentRegistry(_agentRegistry);
        dataStream = DataStream(_dataStream);
        escrow = MsgEscrow(_escrow);
        emit ContractsInitialized(_dacRegistry, _agentRegistry, _dataStream, _escrow);
    }

    /// @notice Assign agent to DAC (caller must be agent owner or DAC owner)
    function assignAgentToDAC(bytes32 agentId, bytes32 dacId) external {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        DACRegistry.DAC memory dac = dacRegistry.getDAC(dacId);
        require(agent.owner == _msgSender() || dac.owner == _msgSender(), "Not authorized");
        require(agent.active && dac.active, "Inactive");
        dacAgents[dacId].push(agentId);
        agentDAC[agentId] = dacId;
        emit AgentAssignedToDAC(agentId, dacId);
    }

    /// @notice Remove agent from DAC (caller must be agent owner or DAC owner)
    function removeAgentFromDAC(bytes32 agentId, bytes32 dacId) external {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        DACRegistry.DAC memory dac = dacRegistry.getDAC(dacId);
        require(agent.owner == _msgSender() || dac.owner == _msgSender(), "Not authorized");
        bytes32[] storage agents_ = dacAgents[dacId];
        for (uint256 i = 0; i < agents_.length; i++) {
            if (agents_[i] == agentId) {
                agents_[i] = agents_[agents_.length - 1];
                agents_.pop();
                break;
            }
        }
        delete agentDAC[agentId];
        emit AgentRemovedFromDAC(agentId, dacId);
    }

    function getDACAgents(bytes32 dacId) external view returns (bytes32[] memory) {
        return dacAgents[dacId];
    }

    function getAgentDAC(bytes32 agentId) external view returns (bytes32) {
        return agentDAC[agentId];
    }

    function getFullAgentInfo(bytes32 agentId) external view returns (AgentRegistry.Agent memory agent, bytes32 dacId, DACRegistry.DAC memory dac) {
        agent = agentRegistry.getAgent(agentId);
        dacId = agentDAC[agentId];
        if (dacId != bytes32(0)) {
            dac = dacRegistry.getDAC(dacId);
        }
    }
}
