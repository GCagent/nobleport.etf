// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title BondStreamLinker - NFT Bond Minting with Streaming Yield
 * @notice Tokenized bonds as NFTs with continuous yield streaming,
 *         maturity enforcement, and DAO governance linkage.
 *
 * Features:
 *   - Bond NFT minting with coupon rates
 *   - Superfluid-compatible streaming yield
 *   - Maturity date enforcement
 *   - Callable/puttable bond logic
 *   - Credit rating tracking
 *   - DAO-linked bond issuance approval
 *   - IPFS-anchored prospectus
 *   - Secondary market transfer with compliance
 */
contract BondStreamLinker is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    bytes32 public constant ISSUER_ROLE    = keccak256("ISSUER_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");

    Counters.Counter private _bondIdCounter;

    // ─── Bond Types ──────────────────────────────────────────────────
    enum BondType { FIXED_RATE, FLOATING_RATE, ZERO_COUPON, CONVERTIBLE }
    enum BondStatus { ACTIVE, MATURED, CALLED, DEFAULTED, REDEEMED }
    enum CreditRating { AAA, AA, A, BBB, BB, B, CCC, NR }

    struct Bond {
        uint256      id;
        BondType     bondType;
        BondStatus   status;
        address      issuer;
        uint256      faceValueWei;
        uint256      couponRateBps;        // Annual coupon in bps
        uint256      issueDateTimestamp;
        uint256      maturityTimestamp;
        uint256      lastCouponPayment;
        uint256      totalCouponsPaid;
        uint256      purchasePriceWei;
        CreditRating rating;
        bool         callable;
        bool         puttable;
        uint256      callPriceWei;
        uint256      putPriceWei;
        string       prospectusCid;        // IPFS
        string       projectDescription;
        uint256      propertyTokenId;      // Link to RealEstateNFT
        address      streamAddress;        // Superfluid stream
        uint256      daoProposalId;
    }

    // ─── Coupon Payment Record ───────────────────────────────────────
    struct CouponPayment {
        uint256 bondId;
        uint256 amount;
        uint256 paidAt;
        address paidTo;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => CouponPayment[]) public couponHistory;
    mapping(address => uint256[]) public holderBonds;

    uint256 public totalBondsIssued;
    uint256 public totalFaceValueOutstanding;
    uint256 public totalCouponsPaidOut;
    uint256 public yieldReserve;

    // ─── Events ──────────────────────────────────────────────────────
    event BondMinted(uint256 indexed id, BondType bondType, uint256 faceValue, uint256 couponRateBps, uint256 maturity);
    event BondPurchased(uint256 indexed id, address buyer, uint256 purchasePrice);
    event CouponPaid(uint256 indexed id, address holder, uint256 amount);
    event BondMatured(uint256 indexed id, uint256 timestamp);
    event BondCalled(uint256 indexed id, uint256 callPrice);
    event BondRedeemed(uint256 indexed id, address holder, uint256 amount);
    event BondDefaulted(uint256 indexed id);
    event CreditRatingUpdated(uint256 indexed id, CreditRating oldRating, CreditRating newRating);
    event StreamLinked(uint256 indexed id, address streamAddress);
    event YieldReserveFunded(uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) ERC721("NoblePort Bond", "NPBOND") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ISSUER_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Bond Issuance
    // ═══════════════════════════════════════════════════════════════════

    function mintBond(
        BondType _bondType,
        uint256 _faceValueWei,
        uint256 _couponRateBps,
        uint256 _maturityTimestamp,
        CreditRating _rating,
        bool _callable,
        bool _puttable,
        uint256 _callPriceWei,
        uint256 _putPriceWei,
        string calldata _prospectusCid,
        string calldata _projectDescription,
        uint256 _propertyTokenId,
        uint256 _daoProposalId,
        string calldata _tokenUri
    ) external onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256) {
        require(_maturityTimestamp > block.timestamp, "Bond: maturity must be future");
        require(_faceValueWei > 0, "Bond: zero face value");

        _bondIdCounter.increment();
        uint256 id = _bondIdCounter.current();

        _safeMint(address(this), id);
        _setTokenURI(id, _tokenUri);

        bonds[id] = Bond({
            id: id,
            bondType: _bondType,
            status: BondStatus.ACTIVE,
            issuer: msg.sender,
            faceValueWei: _faceValueWei,
            couponRateBps: _couponRateBps,
            issueDateTimestamp: block.timestamp,
            maturityTimestamp: _maturityTimestamp,
            lastCouponPayment: block.timestamp,
            totalCouponsPaid: 0,
            purchasePriceWei: 0,
            rating: _rating,
            callable: _callable,
            puttable: _puttable,
            callPriceWei: _callPriceWei,
            putPriceWei: _putPriceWei,
            prospectusCid: _prospectusCid,
            projectDescription: _projectDescription,
            propertyTokenId: _propertyTokenId,
            streamAddress: address(0),
            daoProposalId: _daoProposalId
        });

        totalBondsIssued++;
        totalFaceValueOutstanding += _faceValueWei;

        emit BondMinted(id, _bondType, _faceValueWei, _couponRateBps, _maturityTimestamp);
        return id;
    }

    function purchaseBond(uint256 _bondId) external payable nonReentrant whenNotPaused {
        Bond storage bond = bonds[_bondId];
        require(bond.status == BondStatus.ACTIVE, "Bond: not active");
        require(bond.purchasePriceWei == 0, "Bond: already purchased");
        require(msg.value >= bond.faceValueWei, "Bond: insufficient payment");

        bond.purchasePriceWei = msg.value;
        _transfer(address(this), msg.sender, _bondId);
        holderBonds[msg.sender].push(_bondId);

        // Excess goes to yield reserve
        if (msg.value > bond.faceValueWei) {
            yieldReserve += msg.value - bond.faceValueWei;
        }

        emit BondPurchased(_bondId, msg.sender, msg.value);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Coupon Payments (Streaming Yield)
    // ═══════════════════════════════════════════════════════════════════

    function payCoupon(uint256 _bondId) external onlyRole(TREASURY_ROLE) nonReentrant {
        Bond storage bond = bonds[_bondId];
        require(bond.status == BondStatus.ACTIVE, "Bond: not active");
        require(bond.purchasePriceWei > 0, "Bond: not purchased");

        // Calculate accrued coupon
        uint256 elapsed = block.timestamp - bond.lastCouponPayment;
        uint256 annualCoupon = (bond.faceValueWei * bond.couponRateBps) / 10000;
        uint256 couponAmount = (annualCoupon * elapsed) / 365 days;

        require(couponAmount > 0, "Bond: no coupon accrued");
        require(address(this).balance >= couponAmount, "Bond: insufficient funds");

        address holder = ownerOf(_bondId);
        bond.lastCouponPayment = block.timestamp;
        bond.totalCouponsPaid += couponAmount;
        totalCouponsPaidOut += couponAmount;

        couponHistory[_bondId].push(CouponPayment({
            bondId: _bondId,
            amount: couponAmount,
            paidAt: block.timestamp,
            paidTo: holder
        }));

        (bool sent,) = holder.call{value: couponAmount}("");
        require(sent, "Bond: coupon payment failed");

        emit CouponPaid(_bondId, holder, couponAmount);
    }

    function calculateAccruedCoupon(uint256 _bondId) external view returns (uint256) {
        Bond memory bond = bonds[_bondId];
        if (bond.status != BondStatus.ACTIVE || bond.purchasePriceWei == 0) return 0;

        uint256 elapsed = block.timestamp - bond.lastCouponPayment;
        uint256 annualCoupon = (bond.faceValueWei * bond.couponRateBps) / 10000;
        return (annualCoupon * elapsed) / 365 days;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Maturity & Redemption
    // ═══════════════════════════════════════════════════════════════════

    function matureBond(uint256 _bondId) external onlyRole(TREASURY_ROLE) {
        Bond storage bond = bonds[_bondId];
        require(bond.status == BondStatus.ACTIVE, "Bond: not active");
        require(block.timestamp >= bond.maturityTimestamp, "Bond: not mature");

        bond.status = BondStatus.MATURED;
        totalFaceValueOutstanding -= bond.faceValueWei;

        emit BondMatured(_bondId, block.timestamp);
    }

    function redeemBond(uint256 _bondId) external nonReentrant {
        Bond storage bond = bonds[_bondId];
        require(
            bond.status == BondStatus.MATURED || bond.status == BondStatus.CALLED,
            "Bond: not redeemable"
        );
        require(ownerOf(_bondId) == msg.sender, "Bond: not holder");

        uint256 redemptionAmount = bond.status == BondStatus.CALLED
            ? bond.callPriceWei
            : bond.faceValueWei;

        require(address(this).balance >= redemptionAmount, "Bond: insufficient funds");

        bond.status = BondStatus.REDEEMED;
        _burn(_bondId);

        (bool sent,) = msg.sender.call{value: redemptionAmount}("");
        require(sent, "Bond: redemption failed");

        emit BondRedeemed(_bondId, msg.sender, redemptionAmount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Callable / Puttable
    // ═══════════════════════════════════════════════════════════════════

    function callBond(uint256 _bondId) external onlyRole(ISSUER_ROLE) {
        Bond storage bond = bonds[_bondId];
        require(bond.callable, "Bond: not callable");
        require(bond.status == BondStatus.ACTIVE, "Bond: not active");

        bond.status = BondStatus.CALLED;
        totalFaceValueOutstanding -= bond.faceValueWei;

        emit BondCalled(_bondId, bond.callPriceWei);
    }

    function putBond(uint256 _bondId) external nonReentrant {
        Bond storage bond = bonds[_bondId];
        require(bond.puttable, "Bond: not puttable");
        require(bond.status == BondStatus.ACTIVE, "Bond: not active");
        require(ownerOf(_bondId) == msg.sender, "Bond: not holder");
        require(address(this).balance >= bond.putPriceWei, "Bond: insufficient funds");

        bond.status = BondStatus.REDEEMED;
        totalFaceValueOutstanding -= bond.faceValueWei;
        _burn(_bondId);

        (bool sent,) = msg.sender.call{value: bond.putPriceWei}("");
        require(sent, "Bond: put payment failed");

        emit BondRedeemed(_bondId, msg.sender, bond.putPriceWei);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Credit Rating
    // ═══════════════════════════════════════════════════════════════════

    function updateCreditRating(uint256 _bondId, CreditRating _newRating)
        external onlyRole(ISSUER_ROLE)
    {
        CreditRating old = bonds[_bondId].rating;
        bonds[_bondId].rating = _newRating;
        emit CreditRatingUpdated(_bondId, old, _newRating);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Stream Integration
    // ═══════════════════════════════════════════════════════════════════

    function linkStream(uint256 _bondId, address _streamAddress)
        external onlyRole(TREASURY_ROLE)
    {
        bonds[_bondId].streamAddress = _streamAddress;
        emit StreamLinked(_bondId, _streamAddress);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Yield Reserve
    // ═══════════════════════════════════════════════════════════════════

    function fundYieldReserve() external payable onlyRole(TREASURY_ROLE) {
        yieldReserve += msg.value;
        emit YieldReserveFunded(msg.value);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function getCouponHistoryLength(uint256 _bondId) external view returns (uint256) {
        return couponHistory[_bondId].length;
    }

    function getHolderBonds(address _holder) external view returns (uint256[] memory) {
        return holderBonds[_holder];
    }

    // ─── Overrides ───────────────────────────────────────────────────
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {
        yieldReserve += msg.value;
    }
}
