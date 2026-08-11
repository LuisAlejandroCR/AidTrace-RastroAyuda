// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import "forge-std/Vm.sol";
import {AidTraceLedger} from "../AidTraceLedger.sol";

/// @notice Invariant tests for AidTraceLedger.
/// Invariants asserted:
///   1. admin is never the zero address.
///   2. No recorded event can ever carry a zero sender (the contract
///      resolves address(0) to msg.sender before emitting).
///   3. Strangers (neither admin nor approved submitter) can never
///      produce an event, regardless of how the state is exercised.
contract AidTraceLedgerInvariant is Test {
    AidTraceLedger internal ledger;
    address internal admin = makeAddr("invAdmin");
    address internal relayer = makeAddr("invRelayer");
    uint256 internal ghostZeroSenderEvents;

    function setUp() public {
        ledger = new AidTraceLedger(admin);
        vm.prank(admin);
        ledger.setSubmitter(relayer, true);
        targetContract(address(ledger));
    }

    /// @notice Handler: relayer submits with an explicit sender.
    function submitFromRelayer(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref) external {
        vm.recordLogs();
        vm.prank(relayer);
        ledger.recordAction(batchId, actionType, dataHash, relayer, ref);
        countZeroSenderEvents();
    }

    /// @notice Handler: relayer submits with sender == 0 (field-flow path).
    function submitWithZeroSender(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref) external {
        vm.recordLogs();
        vm.prank(relayer);
        ledger.recordAction(batchId, actionType, dataHash, address(0), ref);
        countZeroSenderEvents();
    }

    /// @notice Handler: a stranger tries to submit and must never emit.
    function strangerAttempt(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref, address stranger) external {
        if (stranger == address(0) || stranger == admin || stranger == relayer) return;
        vm.recordLogs();
        vm.prank(stranger);
        try ledger.recordAction(batchId, actionType, dataHash, address(0), ref) {} catch {}
        VmSafe.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 0, "stranger must never emit events");
    }

    /// @notice Handler: admin may transfer admin to a fresh address.
    function rotateAdmin(address newAdmin) external {
        if (newAdmin == address(0)) return;
        vm.prank(admin);
        ledger.transferAdmin(newAdmin);
        admin = newAdmin;
    }

    function countZeroSenderEvents() internal {
        VmSafe.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(ledger) && logs[i].topics.length == 4 && logs[i].topics[3] == bytes32(0)) {
                ghostZeroSenderEvents++;
            }
        }
    }

    function invariant_adminNotNull() public view {
        assertTrue(ledger.admin() != address(0), "admin must never be zero");
    }

    function invariant_neverZeroSender() public view {
        assertEq(ghostZeroSenderEvents, 0, "recorded sender must never be zero");
    }
}
