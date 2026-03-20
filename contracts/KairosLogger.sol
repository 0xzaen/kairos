// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title KairosLogger
 * @notice ERC-8004 compliant on-chain decision logger for Kairos AI engine.
 * @dev Stores council deliberation results immutably on Base.
 */
contract KairosLogger {
    struct Decision {
        string market;
        string decision;
        uint256 confidence;
        string metadata;
        uint256 timestamp;
        address reporter;
    }

    Decision[] public decisions;
    address public owner;

    event DecisionLogged(
        uint256 indexed id,
        string market,
        string decision,
        uint256 confidence,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function logDecision(
        string calldata market,
        string calldata decision,
        uint256 confidence,
        string calldata metadata
    ) external onlyOwner {
        uint256 id = decisions.length;
        decisions.push(Decision({
            market: market,
            decision: decision,
            confidence: confidence,
            metadata: metadata,
            timestamp: block.timestamp,
            reporter: msg.sender
        }));

        emit DecisionLogged(id, market, decision, confidence, block.timestamp);
    }

    function getDecision(uint256 id) external view returns (Decision memory) {
        return decisions[id];
    }

    function totalDecisions() external view returns (uint256) {
        return decisions.length;
    }
}
