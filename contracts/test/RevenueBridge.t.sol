// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../RevenueBridge.sol";
import "./mocks/MockNBPT.sol";

contract RevenueBridgeTest is Test {
    RevenueBridge public bridge;
    MockNBPT public nbpt;

    address public owner = address(0x1);
    address public operator = address(0x2);
    address public treasury = address(0x3);
    address public payer = address(0x4);
    address public unauthorized = address(0x5);

    bytes32 constant SOURCE_STRIPE = keccak256("STRIPE");
    bytes32 constant DEST_DAO = keccak256("NOBLEPORT_DAO");

    event RevenueBridged(
        string indexed invoiceId,
        address indexed payer,
        address indexed beneficiary,
        uint256 amount,
        address currency,
        bytes32 sourceSystem,
        bytes32 destinationSystem,
        bytes32 settlementId,
        uint256 timestamp
    );

    event PartitionIssued(
        bytes32 indexed settlementId,
        bytes32 indexed partition,
        address indexed recipient,
        uint256 amount
    );

    event RevenueReversed(
        bytes32 indexed settlementId,
        string indexed invoiceId,
        address indexed reversedBy,
        bytes32 reason,
        uint256 timestamp
    );

    function setUp() public {
        nbpt = new MockNBPT();

        vm.prank(owner);
        bridge = new RevenueBridge(address(nbpt), operator, owner);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_constructor_setsCorrectValues() public view {
        assertEq(address(bridge.nbptToken()), address(nbpt));
        assertEq(bridge.bridgeOperator(), operator);
        assertEq(bridge.owner(), owner);
    }

    function test_constructor_setsDefaultAllocation() public view {
        (uint256 reserve, uint256 liquidity, uint256 enterprise, uint256 staking) = bridge.allocation();
        assertEq(reserve, 4000);    // 40%
        assertEq(liquidity, 3000);  // 30%
        assertEq(enterprise, 2000); // 20%
        assertEq(staking, 1000);    // 10%
    }

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert(RevenueBridge.ZeroAddress.selector);
        new RevenueBridge(address(0), operator, owner);
    }

    function test_constructor_revertsOnZeroOperator() public {
        vm.expectRevert(RevenueBridge.ZeroAddress.selector);
        new RevenueBridge(address(nbpt), address(0), owner);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(RevenueBridge.ZeroAddress.selector);
        new RevenueBridge(address(nbpt), operator, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BRIDGE REVENUE TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_bridgeRevenue_success() public {
        string memory invoiceId = "inv_123456";
        uint256 amount = 1000000; // $1000.00 in 6 decimals

        vm.prank(operator);
        bytes32 settlementId = bridge.bridgeRevenue(
            invoiceId,
            amount,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        // Verify settlement was created
        RevenueBridge.RevenueEntry memory entry = bridge.getSettlement(settlementId);
        assertEq(entry.amount, amount);
        assertEq(entry.payer, payer);
        assertEq(entry.beneficiary, treasury);
        assertEq(uint8(entry.status), uint8(RevenueBridge.SettlementStatus.SETTLED));

        // Verify totals
        assertEq(bridge.totalRevenueBridged(), amount);
    }

    function test_bridgeRevenue_correctAllocation() public {
        uint256 amount = 10000; // Use 10000 for clean division

        vm.prank(operator);
        bridge.bridgeRevenue(
            "inv_alloc_test",
            amount,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        // Check partition balances: 40%, 30%, 20%, 10%
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_RESERVE(), treasury), 4000);
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_LIQUIDITY(), treasury), 3000);
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_ENTERPRISE(), treasury), 2000);
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_STAKING(), treasury), 1000);
    }

    function test_bridgeRevenue_remainderHandling() public {
        // Use amount that doesn't divide evenly: 99
        // Reserve: 99 * 4000 / 10000 = 39
        // Liquidity: 99 * 3000 / 10000 = 29
        // Enterprise: 99 * 2000 / 10000 = 19
        // Staking (remainder): 99 - 39 - 29 - 19 = 12 (not 9!)
        uint256 amount = 99;

        vm.prank(operator);
        bridge.bridgeRevenue(
            "inv_remainder",
            amount,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        uint256 total =
            nbpt.balanceOfByPartition(nbpt.PARTITION_RESERVE(), treasury) +
            nbpt.balanceOfByPartition(nbpt.PARTITION_LIQUIDITY(), treasury) +
            nbpt.balanceOfByPartition(nbpt.PARTITION_ENTERPRISE(), treasury) +
            nbpt.balanceOfByPartition(nbpt.PARTITION_STAKING(), treasury);

        // No dust lost - total should equal amount
        assertEq(total, amount);
    }

    function test_bridgeRevenue_emitsEvent() public {
        string memory invoiceId = "inv_event_test";
        uint256 amount = 1000000;

        vm.prank(operator);
        vm.expectEmit(true, true, true, false);
        emit RevenueBridged(
            invoiceId,
            payer,
            treasury,
            amount,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO,
            bytes32(0), // We don't know the exact settlementId
            block.timestamp
        );

        bridge.bridgeRevenue(
            invoiceId,
            amount,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );
    }

    function test_bridgeRevenue_revertsOnDuplicate() public {
        string memory invoiceId = "inv_duplicate";
        uint256 amount = 1000000;

        vm.startPrank(operator);
        bridge.bridgeRevenue(invoiceId, amount, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);

        vm.expectRevert(abi.encodeWithSelector(RevenueBridge.InvoiceAlreadyProcessed.selector, invoiceId));
        bridge.bridgeRevenue(invoiceId, amount, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);
        vm.stopPrank();
    }

    function test_bridgeRevenue_revertsOnZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert(RevenueBridge.ZeroAmount.selector);
        bridge.bridgeRevenue("inv_zero", 0, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);
    }

    function test_bridgeRevenue_revertsOnZeroBeneficiary() public {
        vm.prank(operator);
        vm.expectRevert(RevenueBridge.ZeroAddress.selector);
        bridge.bridgeRevenue("inv_zero_ben", 1000, payer, address(0), address(0), SOURCE_STRIPE, DEST_DAO);
    }

    function test_bridgeRevenue_revertsFromUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(RevenueBridge.Unauthorized.selector);
        bridge.bridgeRevenue("inv_unauth", 1000, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);
    }

    function test_bridgeRevenue_ownerCanBridge() public {
        vm.prank(owner);
        bytes32 settlementId = bridge.bridgeRevenue(
            "inv_owner",
            1000000,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        assertTrue(settlementId != bytes32(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STRIPE CONVENIENCE FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_bridgeStripeRevenue_success() public {
        vm.prank(operator);
        bytes32 settlementId = bridge.bridgeStripeRevenue("inv_stripe", 1000000, treasury);

        RevenueBridge.RevenueEntry memory entry = bridge.getSettlement(settlementId);
        assertEq(entry.sourceSystem, SOURCE_STRIPE);
        assertEq(entry.payer, address(0)); // Payer unknown from Stripe
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REVERSAL TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_reverseSettlement_success() public {
        uint256 amount = 10000;

        vm.startPrank(operator);
        bytes32 settlementId = bridge.bridgeRevenue(
            "inv_reverse",
            amount,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        // Verify tokens were issued
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_RESERVE(), treasury), 4000);

        // Reverse
        bridge.reverseSettlement(settlementId, keccak256("REFUND"));
        vm.stopPrank();

        // Verify tokens were burned
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_RESERVE(), treasury), 0);
        assertEq(nbpt.balanceOfByPartition(nbpt.PARTITION_LIQUIDITY(), treasury), 0);

        // Verify status changed
        RevenueBridge.RevenueEntry memory entry = bridge.getSettlement(settlementId);
        assertEq(uint8(entry.status), uint8(RevenueBridge.SettlementStatus.REVERSED));

        // Verify totals
        assertEq(bridge.totalRevenueReversed(), amount);
    }

    function test_reverseSettlement_revertsOnNotFound() public {
        bytes32 fakeSettlement = keccak256("fake");

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RevenueBridge.SettlementNotFound.selector, fakeSettlement));
        bridge.reverseSettlement(fakeSettlement, keccak256("REASON"));
    }

    function test_reverseSettlement_revertsOnAlreadyReversed() public {
        vm.startPrank(operator);
        bytes32 settlementId = bridge.bridgeRevenue(
            "inv_double_reverse",
            10000,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        bridge.reverseSettlement(settlementId, keccak256("REFUND"));

        vm.expectRevert(abi.encodeWithSelector(
            RevenueBridge.InvalidSettlementStatus.selector,
            settlementId,
            RevenueBridge.SettlementStatus.REVERSED,
            RevenueBridge.SettlementStatus.SETTLED
        ));
        bridge.reverseSettlement(settlementId, keccak256("DOUBLE"));
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DISPUTE TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_disputeSettlement_success() public {
        vm.startPrank(operator);
        bytes32 settlementId = bridge.bridgeRevenue(
            "inv_dispute",
            10000,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        bridge.disputeSettlement(settlementId);
        vm.stopPrank();

        RevenueBridge.RevenueEntry memory entry = bridge.getSettlement(settlementId);
        assertEq(uint8(entry.status), uint8(RevenueBridge.SettlementStatus.DISPUTED));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_setOperator_success() public {
        address newOperator = address(0x999);

        vm.prank(owner);
        bridge.setOperator(newOperator);

        assertEq(bridge.bridgeOperator(), newOperator);
    }

    function test_setOperator_revertsFromNonOwner() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", operator));
        bridge.setOperator(address(0x999));
    }

    function test_setAllocation_success() public {
        vm.prank(owner);
        bridge.setAllocation(5000, 2500, 1500, 1000); // 50%, 25%, 15%, 10%

        (uint256 reserve, uint256 liquidity, uint256 enterprise, uint256 staking) = bridge.allocation();
        assertEq(reserve, 5000);
        assertEq(liquidity, 2500);
        assertEq(enterprise, 1500);
        assertEq(staking, 1000);
    }

    function test_setAllocation_revertsOnInvalidTotal() public {
        vm.prank(owner);
        vm.expectRevert(RevenueBridge.InvalidPercentages.selector);
        bridge.setAllocation(5000, 3000, 2000, 1000); // 110% total
    }

    function test_pause_blocksOperations() public {
        vm.prank(owner);
        bridge.pause();

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        bridge.bridgeRevenue("inv_paused", 1000, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);
    }

    function test_unpause_resumesOperations() public {
        vm.startPrank(owner);
        bridge.pause();
        bridge.unpause();
        vm.stopPrank();

        vm.prank(operator);
        bytes32 settlementId = bridge.bridgeRevenue(
            "inv_unpaused",
            1000,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        assertTrue(settlementId != bytes32(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_isInvoiceProcessed() public {
        assertFalse(bridge.isInvoiceProcessed("inv_new"));

        vm.prank(operator);
        bridge.bridgeRevenue("inv_new", 1000, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);

        assertTrue(bridge.isInvoiceProcessed("inv_new"));
    }

    function test_getSettlementByInvoice() public {
        vm.prank(operator);
        bytes32 settlementId = bridge.bridgeRevenue(
            "inv_lookup",
            1000,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        assertEq(bridge.getSettlementByInvoice("inv_lookup"), settlementId);
    }

    function test_netRevenue() public {
        vm.startPrank(operator);

        bridge.bridgeRevenue("inv_1", 10000, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);
        bytes32 settlementId = bridge.bridgeRevenue("inv_2", 5000, payer, treasury, address(0), SOURCE_STRIPE, DEST_DAO);
        bridge.reverseSettlement(settlementId, keccak256("REFUND"));

        vm.stopPrank();

        assertEq(bridge.totalRevenueBridged(), 15000);
        assertEq(bridge.totalRevenueReversed(), 5000);
        assertEq(bridge.netRevenue(), 10000);
    }

    function test_calculateAllocations() public view {
        (uint256 reserve, uint256 liquidity, uint256 enterprise, uint256 staking) =
            bridge.calculateAllocations(10000);

        assertEq(reserve, 4000);
        assertEq(liquidity, 3000);
        assertEq(enterprise, 2000);
        assertEq(staking, 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_bridgeRevenue_noTokensLost(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount < type(uint128).max); // Prevent overflow

        vm.prank(operator);
        bridge.bridgeRevenue(
            string(abi.encodePacked("inv_fuzz_", vm.toString(amount))),
            amount,
            payer,
            treasury,
            address(0),
            SOURCE_STRIPE,
            DEST_DAO
        );

        uint256 total =
            nbpt.balanceOfByPartition(nbpt.PARTITION_RESERVE(), treasury) +
            nbpt.balanceOfByPartition(nbpt.PARTITION_LIQUIDITY(), treasury) +
            nbpt.balanceOfByPartition(nbpt.PARTITION_ENTERPRISE(), treasury) +
            nbpt.balanceOfByPartition(nbpt.PARTITION_STAKING(), treasury);

        assertEq(total, amount, "Tokens were lost in allocation");
    }

    function testFuzz_setAllocation_validPercentages(
        uint256 reserve,
        uint256 liquidity,
        uint256 enterprise
    ) public {
        vm.assume(reserve <= 10000);
        vm.assume(liquidity <= 10000);
        vm.assume(enterprise <= 10000);
        vm.assume(reserve + liquidity + enterprise <= 10000);

        uint256 staking = 10000 - reserve - liquidity - enterprise;

        vm.prank(owner);
        bridge.setAllocation(reserve, liquidity, enterprise, staking);

        (uint256 r, uint256 l, uint256 e, uint256 s) = bridge.allocation();
        assertEq(r + l + e + s, 10000);
    }
}
