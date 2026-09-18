// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title RealEstateNFT - ERC-721 Property NFTs with Rent Streaming
 * @notice Tokenized real estate deeds with title verification,
 *         Superfluid-compatible rent streaming, and zoning integration.
 *
 * Features:
 *   - Property NFT minting with full metadata (address, valuation, zoning)
 *   - Title check system with notarized verification
 *   - Rent streaming configuration (Superfluid-compatible)
 *   - Property inspection records
 *   - Commission enforcement for agents/brokers
 *   - IPFS-anchored deed documents
 *   - Integration with SBTFactory for tenant/vendor/manager identity
 */
contract RealEstateNFT is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");
    bytes32 public constant TITLE_AGENT     = keccak256("TITLE_AGENT");
    bytes32 public constant INSPECTOR_ROLE  = keccak256("INSPECTOR_ROLE");
    bytes32 public constant ZONING_ROLE     = keccak256("ZONING_ROLE");

    Counters.Counter private _tokenIdCounter;

    // ─── Property Data ───────────────────────────────────────────────
    enum PropertyType { RESIDENTIAL, COMMERCIAL, INDUSTRIAL, MIXED_USE, LAND }
    enum PropertyStatus { DRAFT, LISTED, UNDER_CONTRACT, SOLD, RENTED, FORECLOSED }
    enum ZoningClass { R1, R2, R3, C1, C2, C3, I1, I2, MU1, MU2, AG, OS }

    struct Property {
        uint256 tokenId;
        string  propertyAddress;
        string  parcelId;
        PropertyType propertyType;
        PropertyStatus status;
        ZoningClass zoning;
        uint256 valuationWei;           // Current valuation in wei
        uint256 squareFootage;
        uint256 yearBuilt;
        uint256 lastAppraisalDate;
        string  jurisdiction;
        string  deedIpfsCid;            // IPFS CID for deed document
        bool    titleVerified;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // ─── Title Verification ──────────────────────────────────────────
    struct TitleRecord {
        bool    verified;
        address verifiedBy;
        uint256 verifiedAt;
        string  titleInsuranceCid;      // IPFS CID for title insurance doc
        string  titleSearchCid;         // IPFS CID for title search report
        bool    liensCleared;
        bool    encumbrancesCleared;
    }

    // ─── Rent Streaming (Superfluid-compatible) ──────────────────────
    struct RentStream {
        address tenant;
        address landlord;
        uint256 monthlyRentWei;
        uint256 securityDepositWei;
        uint256 leaseStartDate;
        uint256 leaseEndDate;
        uint256 lastPaymentDate;
        bool    active;
        string  leaseAgreementCid;      // IPFS CID for lease
        address superfluidFlowAddress;  // Superfluid stream contract
    }

    // ─── Inspection ──────────────────────────────────────────────────
    struct Inspection {
        uint256 inspectionId;
        uint256 propertyTokenId;
        address inspector;
        uint256 date;
        bool    passed;
        string  reportCid;             // IPFS CID for inspection report
        string  inspectionType;        // "structural", "electrical", "plumbing", etc.
    }

    // ─── Commission ──────────────────────────────────────────────────
    struct Commission {
        address agent;
        uint256 basisPoints;           // Commission in bps (e.g., 300 = 3%)
        bool    paid;
        uint256 paidAmount;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => Property)      public properties;
    mapping(uint256 => TitleRecord)   public titleRecords;
    mapping(uint256 => RentStream)    public rentStreams;
    mapping(uint256 => Inspection[])  public inspections;
    mapping(uint256 => Commission[])  public commissions;

    // Property lookup
    mapping(string => uint256) public parcelIdToTokenId;

    // Metrics
    uint256 public totalPropertiesMinted;
    uint256 public totalValuationWei;
    uint256 public totalActiveRentStreams;

    // ─── Events ──────────────────────────────────────────────────────
    event PropertyMinted(uint256 indexed tokenId, string propertyAddress, PropertyType propertyType, uint256 valuationWei);
    event TitleVerified(uint256 indexed tokenId, address verifiedBy, uint256 timestamp);
    event RentStreamCreated(uint256 indexed tokenId, address tenant, address landlord, uint256 monthlyRentWei);
    event RentStreamTerminated(uint256 indexed tokenId, uint256 timestamp);
    event InspectionRecorded(uint256 indexed tokenId, uint256 inspectionId, bool passed);
    event CommissionRegistered(uint256 indexed tokenId, address agent, uint256 basisPoints);
    event CommissionPaid(uint256 indexed tokenId, address agent, uint256 amount);
    event PropertyValuationUpdated(uint256 indexed tokenId, uint256 oldValuation, uint256 newValuation);
    event PropertyStatusChanged(uint256 indexed tokenId, PropertyStatus oldStatus, PropertyStatus newStatus);
    event PropertyDeedUpdated(uint256 indexed tokenId, string deedIpfsCid);

    Counters.Counter private _inspectionIdCounter;

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) ERC721("NoblePort Real Estate", "NPRE") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(TITLE_AGENT, _admin);
        _grantRole(INSPECTOR_ROLE, _admin);
        _grantRole(ZONING_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Property Minting
    // ═══════════════════════════════════════════════════════════════════

    function mintProperty(
        address _to,
        string calldata _propertyAddress,
        string calldata _parcelId,
        PropertyType _propertyType,
        ZoningClass _zoning,
        uint256 _valuationWei,
        uint256 _squareFootage,
        uint256 _yearBuilt,
        string calldata _jurisdiction,
        string calldata _deedIpfsCid,
        string calldata _tokenUri
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(parcelIdToTokenId[_parcelId] == 0, "RealEstateNFT: parcel already minted");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _tokenUri);

        properties[tokenId] = Property({
            tokenId: tokenId,
            propertyAddress: _propertyAddress,
            parcelId: _parcelId,
            propertyType: _propertyType,
            status: PropertyStatus.DRAFT,
            zoning: _zoning,
            valuationWei: _valuationWei,
            squareFootage: _squareFootage,
            yearBuilt: _yearBuilt,
            lastAppraisalDate: block.timestamp,
            jurisdiction: _jurisdiction,
            deedIpfsCid: _deedIpfsCid,
            titleVerified: false,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        parcelIdToTokenId[_parcelId] = tokenId;
        totalPropertiesMinted++;
        totalValuationWei += _valuationWei;

        emit PropertyMinted(tokenId, _propertyAddress, _propertyType, _valuationWei);
        return tokenId;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Title Verification
    // ═══════════════════════════════════════════════════════════════════

    function verifyTitle(
        uint256 _tokenId,
        string calldata _titleInsuranceCid,
        string calldata _titleSearchCid,
        bool _liensCleared,
        bool _encumbrancesCleared
    ) external onlyRole(TITLE_AGENT) {
        require(_exists(_tokenId), "RealEstateNFT: token does not exist");
        require(_liensCleared && _encumbrancesCleared, "RealEstateNFT: liens/encumbrances not cleared");

        titleRecords[_tokenId] = TitleRecord({
            verified: true,
            verifiedBy: msg.sender,
            verifiedAt: block.timestamp,
            titleInsuranceCid: _titleInsuranceCid,
            titleSearchCid: _titleSearchCid,
            liensCleared: _liensCleared,
            encumbrancesCleared: _encumbrancesCleared
        });

        properties[_tokenId].titleVerified = true;
        properties[_tokenId].updatedAt = block.timestamp;

        emit TitleVerified(_tokenId, msg.sender, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Rent Streaming
    // ═══════════════════════════════════════════════════════════════════

    function createRentStream(
        uint256 _tokenId,
        address _tenant,
        uint256 _monthlyRentWei,
        uint256 _securityDepositWei,
        uint256 _leaseStartDate,
        uint256 _leaseEndDate,
        string calldata _leaseAgreementCid,
        address _superfluidFlowAddress
    ) external nonReentrant whenNotPaused {
        require(ownerOf(_tokenId) == msg.sender, "RealEstateNFT: not property owner");
        require(!rentStreams[_tokenId].active, "RealEstateNFT: stream already active");
        require(_leaseEndDate > _leaseStartDate, "RealEstateNFT: invalid lease dates");

        rentStreams[_tokenId] = RentStream({
            tenant: _tenant,
            landlord: msg.sender,
            monthlyRentWei: _monthlyRentWei,
            securityDepositWei: _securityDepositWei,
            leaseStartDate: _leaseStartDate,
            leaseEndDate: _leaseEndDate,
            lastPaymentDate: 0,
            active: true,
            leaseAgreementCid: _leaseAgreementCid,
            superfluidFlowAddress: _superfluidFlowAddress
        });

        properties[_tokenId].status = PropertyStatus.RENTED;
        properties[_tokenId].updatedAt = block.timestamp;
        totalActiveRentStreams++;

        emit RentStreamCreated(_tokenId, _tenant, msg.sender, _monthlyRentWei);
    }

    function terminateRentStream(uint256 _tokenId) external {
        RentStream storage stream = rentStreams[_tokenId];
        require(
            msg.sender == stream.landlord || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "RealEstateNFT: unauthorized"
        );
        require(stream.active, "RealEstateNFT: not active");

        stream.active = false;
        properties[_tokenId].status = PropertyStatus.LISTED;
        properties[_tokenId].updatedAt = block.timestamp;
        totalActiveRentStreams--;

        emit RentStreamTerminated(_tokenId, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Inspections
    // ═══════════════════════════════════════════════════════════════════

    function recordInspection(
        uint256 _tokenId,
        bool _passed,
        string calldata _reportCid,
        string calldata _inspectionType
    ) external onlyRole(INSPECTOR_ROLE) returns (uint256) {
        require(_exists(_tokenId), "RealEstateNFT: token does not exist");

        _inspectionIdCounter.increment();
        uint256 inspectionId = _inspectionIdCounter.current();

        inspections[_tokenId].push(Inspection({
            inspectionId: inspectionId,
            propertyTokenId: _tokenId,
            inspector: msg.sender,
            date: block.timestamp,
            passed: _passed,
            reportCid: _reportCid,
            inspectionType: _inspectionType
        }));

        emit InspectionRecorded(_tokenId, inspectionId, _passed);
        return inspectionId;
    }

    function getInspectionCount(uint256 _tokenId) external view returns (uint256) {
        return inspections[_tokenId].length;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Commission Enforcement
    // ═══════════════════════════════════════════════════════════════════

    function registerCommission(
        uint256 _tokenId,
        address _agent,
        uint256 _basisPoints
    ) external {
        require(ownerOf(_tokenId) == msg.sender, "RealEstateNFT: not property owner");
        require(_basisPoints <= 1000, "RealEstateNFT: max 10%");

        commissions[_tokenId].push(Commission({
            agent: _agent,
            basisPoints: _basisPoints,
            paid: false,
            paidAmount: 0
        }));

        emit CommissionRegistered(_tokenId, _agent, _basisPoints);
    }

    function payCommission(uint256 _tokenId, uint256 _commissionIndex)
        external payable nonReentrant
    {
        require(_commissionIndex < commissions[_tokenId].length, "RealEstateNFT: invalid index");
        Commission storage c = commissions[_tokenId][_commissionIndex];
        require(!c.paid, "RealEstateNFT: already paid");

        uint256 salePrice = properties[_tokenId].valuationWei;
        uint256 commissionAmount = (salePrice * c.basisPoints) / 10000;
        require(msg.value >= commissionAmount, "RealEstateNFT: insufficient payment");

        c.paid = true;
        c.paidAmount = commissionAmount;

        (bool sent, ) = c.agent.call{value: commissionAmount}("");
        require(sent, "RealEstateNFT: payment failed");

        // Refund excess
        if (msg.value > commissionAmount) {
            (bool refunded, ) = msg.sender.call{value: msg.value - commissionAmount}("");
            require(refunded, "RealEstateNFT: refund failed");
        }

        emit CommissionPaid(_tokenId, c.agent, commissionAmount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Property Management
    // ═══════════════════════════════════════════════════════════════════

    function updateValuation(uint256 _tokenId, uint256 _newValuation)
        external onlyRole(TITLE_AGENT)
    {
        require(_exists(_tokenId), "RealEstateNFT: token does not exist");
        uint256 oldVal = properties[_tokenId].valuationWei;
        totalValuationWei = totalValuationWei - oldVal + _newValuation;
        properties[_tokenId].valuationWei = _newValuation;
        properties[_tokenId].lastAppraisalDate = block.timestamp;
        properties[_tokenId].updatedAt = block.timestamp;

        emit PropertyValuationUpdated(_tokenId, oldVal, _newValuation);
    }

    function updatePropertyStatus(uint256 _tokenId, PropertyStatus _newStatus) external {
        require(
            ownerOf(_tokenId) == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "RealEstateNFT: unauthorized"
        );
        PropertyStatus oldStatus = properties[_tokenId].status;
        properties[_tokenId].status = _newStatus;
        properties[_tokenId].updatedAt = block.timestamp;

        emit PropertyStatusChanged(_tokenId, oldStatus, _newStatus);
    }

    function updateDeed(uint256 _tokenId, string calldata _deedIpfsCid)
        external onlyRole(TITLE_AGENT)
    {
        require(_exists(_tokenId), "RealEstateNFT: token does not exist");
        properties[_tokenId].deedIpfsCid = _deedIpfsCid;
        properties[_tokenId].updatedAt = block.timestamp;

        emit PropertyDeedUpdated(_tokenId, _deedIpfsCid);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════════════

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ═══════════════════════════════════════════════════════════════════
    //  Required Overrides
    // ═══════════════════════════════════════════════════════════════════

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
}
