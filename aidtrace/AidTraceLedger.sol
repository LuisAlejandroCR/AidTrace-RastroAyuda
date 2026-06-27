// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Generic humanitarian custody ledger for Celo Mainnet.
/// @dev Keep the contract stable: add new workflows through actionType, schemaVersion,
/// dataHash, and referenceURI instead of redeploying for every field change.
contract AidTraceLedger {
    address public admin;
    mapping(address => bool) public submitters;

    event SubmitterChanged(address indexed submitter, bool allowed);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    event AidTraceEvent(
        bytes32 indexed batchId,
        bytes32 indexed actionType,
        address indexed sender,
        bytes32 dataHash,
        string referenceURI,
        uint16 schemaVersion,
        uint16 flags
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "ONLY_ADMIN");
        _;
    }

    modifier onlySubmitter() {
        require(msg.sender == admin || submitters[msg.sender], "ONLY_SUBMITTER");
        _;
    }

    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "BAD_ADMIN");
        admin = initialAdmin;
        submitters[initialAdmin] = true;
        emit SubmitterChanged(initialAdmin, true);
    }

    function setSubmitter(address submitter, bool allowed) external onlyAdmin {
        require(submitter != address(0), "BAD_SUBMITTER");
        submitters[submitter] = allowed;
        emit SubmitterChanged(submitter, allowed);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "BAD_ADMIN");
        address oldAdmin = admin;
        admin = newAdmin;
        submitters[newAdmin] = true;
        emit AdminChanged(oldAdmin, newAdmin);
        emit SubmitterChanged(newAdmin, true);
    }

    function recordAction(
        bytes32 batchId,
        bytes32 actionType,
        bytes32 dataHash,
        address sender,
        string calldata referenceURI
    ) external onlySubmitter {
        address effectiveSender = sender == address(0) ? msg.sender : sender;
        emit AidTraceEvent(batchId, actionType, effectiveSender, dataHash, referenceURI, 1, 0);
    }
}
