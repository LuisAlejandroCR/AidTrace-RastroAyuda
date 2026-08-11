// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AidTraceLedger} from "../AidTraceLedger.sol";

/// @notice Unit + fuzz tests for AidTraceLedger.
contract AidTraceLedgerTest is Test {
    AidTraceLedger internal ledger;
    address internal admin = makeAddr("admin");
    address internal submitter = makeAddr("submitter");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        ledger = new AidTraceLedger(admin);
        vm.prank(admin);
        ledger.setSubmitter(submitter, true);
    }

    // ── Constructor ─────────────────────────────────────────────────────────

    function test_constructorSetsAdminAndMakesItSubmitter() public view {
        assertEq(ledger.admin(), admin);
        assertTrue(ledger.submitters(admin));
    }

    function test_constructorRejectsZeroAdmin() public {
        vm.expectRevert("BAD_ADMIN");
        new AidTraceLedger(address(0));
    }

    // ── Access control ───────────────────────────────────────────────────────

    function test_setSubmitterRequiresAdmin() public {
        vm.prank(stranger);
        vm.expectRevert("ONLY_ADMIN");
        ledger.setSubmitter(stranger, true);
    }

    function test_setSubmitterRejectsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("BAD_SUBMITTER");
        ledger.setSubmitter(address(0), true);
    }

    function test_setSubmitterRevokesAndRestores() public {
        vm.prank(admin);
        ledger.setSubmitter(submitter, false);
        vm.prank(submitter);
        vm.expectRevert("ONLY_SUBMITTER");
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), bytes32(0), submitter, "ref");

        vm.prank(admin);
        ledger.setSubmitter(submitter, true);
        vm.prank(submitter);
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), bytes32(0), submitter, "ref");
    }

    function test_transferAdminChangesAdminAndGrantsSubmitter() public {
        address newAdmin = makeAddr("newAdmin");
        vm.prank(admin);
        ledger.transferAdmin(newAdmin);
        assertEq(ledger.admin(), newAdmin);
        assertTrue(ledger.submitters(newAdmin));

        vm.prank(newAdmin);
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), bytes32(0), newAdmin, "ref");

        vm.prank(admin);
        vm.expectRevert("ONLY_ADMIN");
        ledger.transferAdmin(admin);
    }

    function test_transferAdminRejectsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("BAD_ADMIN");
        ledger.transferAdmin(address(0));
    }

    function test_transferAdminRequiresAdmin() public {
        vm.prank(stranger);
        vm.expectRevert("ONLY_ADMIN");
        ledger.transferAdmin(stranger);
    }

    // ── recordAction ─────────────────────────────────────────────────────────

    function test_recordActionAllowsAdmin() public {
        vm.prank(admin);
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), bytes32("0x1234"), address(0), "zavu:1 | DELIVER AT-CELO-1");
    }

    function test_recordActionAllowsApprovedSubmitter() public {
        vm.prank(submitter);
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), bytes32("0x1234"), address(0), "zavu:1");
    }

    function test_recordActionRejectsStranger() public {
        vm.prank(stranger);
        vm.expectRevert("ONLY_SUBMITTER");
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), bytes32("0x1234"), stranger, "ref");
    }

    function test_recordActionEmitsEventWithSchemaAndFlags() public {
        vm.prank(submitter);
        vm.expectEmit(true, true, true, true);
        emit AidTraceLedger.AidTraceEvent(
            bytes32("AT-CELO-1"),
            bytes32("DELIVER"),
            submitter,
            keccak256("0x1234"),
            "zavu:1 | DELIVER AT-CELO-1",
            1,
            0
        );
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("DELIVER"), keccak256("0x1234"), address(0), "zavu:1 | DELIVER AT-CELO-1");
    }

    function test_recordActionWithExplicitSenderRecordsIt() public {
        address relayer = makeAddr("relayer");
        vm.prank(submitter);
        vm.expectEmit(true, true, true, true);
        emit AidTraceLedger.AidTraceEvent(bytes32("AT-CELO-1"), bytes32("PICKUP"), relayer, bytes32(0), "ref", 1, 0);
        ledger.recordAction(bytes32("AT-CELO-1"), bytes32("PICKUP"), bytes32(0), relayer, "ref");
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_zeroSenderResolvesToCaller(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref) public {
        vm.prank(submitter);
        vm.expectEmit(true, true, true, true);
        emit AidTraceLedger.AidTraceEvent(batchId, actionType, submitter, dataHash, ref, 1, 0);
        ledger.recordAction(batchId, actionType, dataHash, address(0), ref);
    }

    function testFuzz_explicitSenderSurvives(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref, address explicitSender) public {
        vm.assume(explicitSender != address(0));
        vm.prank(submitter);
        vm.expectEmit(true, true, true, true);
        emit AidTraceLedger.AidTraceEvent(batchId, actionType, explicitSender, dataHash, ref, 1, 0);
        ledger.recordAction(batchId, actionType, dataHash, explicitSender, ref);
    }

    function testFuzz_strangerAlwaysReverts(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref, address caller) public {
        vm.assume(caller != address(0) && caller != admin && caller != submitter);
        vm.prank(caller);
        vm.expectRevert("ONLY_SUBMITTER");
        ledger.recordAction(batchId, actionType, dataHash, caller, ref);
    }

    function testFuzz_deniedSubmitterCannotRecord(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref, address denied) public {
        vm.assume(denied != address(0) && denied != admin);
        vm.prank(admin);
        ledger.setSubmitter(denied, false);
        vm.prank(denied);
        vm.expectRevert("ONLY_SUBMITTER");
        ledger.recordAction(batchId, actionType, dataHash, denied, ref);
    }

    function testFuzz_adminCanAlwaysRecord(bytes32 batchId, bytes32 actionType, bytes32 dataHash, string calldata ref) public {
        vm.prank(admin);
        ledger.recordAction(batchId, actionType, dataHash, address(0), ref);
    }
}
