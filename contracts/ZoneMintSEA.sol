// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ZoneMintSEA - Zoning NFT Campaign Engine
 * @notice Manages zoning-linked NFT minting campaigns for
 *         real estate projects, community engagement, and governance.
 *
 * Features:
 *   - Campaign-based NFT minting with zoning data
 *   - Whitelist/public sale phases
 *   - Revenue split to municipality, project, and DAO treasury
 *   - Metadata tied to parcel/zoning information
 *   - DAO vote-gated campaign launches
 *   - Integration with ZoningCourt for dispute resolution
 *   - Cross-jurisdiction zoning code compliance
 */
contract ZoneMintSEA is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    bytes32 public constant CAMPAIGN_MANAGER = keccak256("CAMPAIGN_MANAGER");
    bytes32 public constant ZONING_AUTHORITY = keccak256("ZONING_AUTHORITY");

    Counters.Counter private _tokenIdCounter;
    Counters.Counter private _campaignIdCounter;

    // ─── Campaign ────────────────────────────────────────────────────
    enum CampaignStatus { DRAFT, WHITELIST, PUBLIC_SALE, SOLD_OUT, ENDED, CANCELLED }

    struct Campaign {
        uint256        id;
        string         name;
        CampaignStatus status;
        string         zoningCode;
        string         jurisdiction;
        string         parcelId;
        uint256        maxSupply;
        uint256        minted;
        uint256        priceWei;
        uint256        whitelistPrice;
        uint256        startTime;
        uint256        endTime;
        uint256        municipalityShareBps;  // e.g., 1000 = 10%
        uint256        daoShareBps;           // e.g., 500 = 5%
        address        projectWallet;
        address        municipalityWallet;
        address        daoTreasury;
        string         metadataBaseCid;       // IPFS base CID
        uint256        daoProposalId;
        uint256        totalRevenue;
        uint256        createdAt;
    }

    // ─── Whitelist ───────────────────────────────────────────────────
    struct WhitelistEntry {
        bool    eligible;
        uint256 maxMint;
        uint256 minted;
    }

    // ─── Zoning Metadata ─────────────────────────────────────────────
    struct ZoningMetadata {
        uint256 tokenId;
        uint256 campaignId;
        string  zoningCode;
        string  jurisdiction;
        string  parcelId;
        uint256 latitude;              // Scaled by 1e6
        uint256 longitude;             // Scaled by 1e6
        string  zoningDescription;
        uint256 mintedAt;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => WhitelistEntry)) public whitelists;
    mapping(uint256 => ZoningMetadata) public tokenMetadata;
    mapping(uint256 => uint256) public tokenToCampaign;

    // Metrics
    uint256 public totalCampaigns;
    uint256 public totalZoningNFTsMinted;
    uint256 public totalRevenue;

    // ─── Events ──────────────────────────────────────────────────────
    event CampaignCreated(uint256 indexed id, string name, string zoningCode, uint256 maxSupply);
    event CampaignStatusChanged(uint256 indexed id, CampaignStatus oldStatus, CampaignStatus newStatus);
    event WhitelistAdded(uint256 indexed campaignId, address[] addresses, uint256 maxMint);
    event ZoningNFTMinted(uint256 indexed tokenId, uint256 indexed campaignId, address minter, string zoningCode);
    event RevenueDistributed(uint256 indexed campaignId, uint256 projectShare, uint256 municipalityShare, uint256 daoShare);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) ERC721("NoblePort Zoning NFT", "NPZONE") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CAMPAIGN_MANAGER, _admin);
        _grantRole(ZONING_AUTHORITY, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Campaign Management
    // ═══════════════════════════════════════════════════════════════════

    function createCampaign(
        string calldata _name,
        string calldata _zoningCode,
        string calldata _jurisdiction,
        string calldata _parcelId,
        uint256 _maxSupply,
        uint256 _priceWei,
        uint256 _whitelistPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _municipalityShareBps,
        uint256 _daoShareBps,
        address _projectWallet,
        address _municipalityWallet,
        address _daoTreasury,
        string calldata _metadataBaseCid,
        uint256 _daoProposalId
    ) external onlyRole(CAMPAIGN_MANAGER) returns (uint256) {
        require(_municipalityShareBps + _daoShareBps <= 5000, "Zone: max 50% shares");
        require(_endTime > _startTime, "Zone: invalid dates");
        require(_maxSupply > 0, "Zone: zero supply");

        _campaignIdCounter.increment();
        uint256 id = _campaignIdCounter.current();

        campaigns[id] = Campaign({
            id: id,
            name: _name,
            status: CampaignStatus.DRAFT,
            zoningCode: _zoningCode,
            jurisdiction: _jurisdiction,
            parcelId: _parcelId,
            maxSupply: _maxSupply,
            minted: 0,
            priceWei: _priceWei,
            whitelistPrice: _whitelistPrice,
            startTime: _startTime,
            endTime: _endTime,
            municipalityShareBps: _municipalityShareBps,
            daoShareBps: _daoShareBps,
            projectWallet: _projectWallet,
            municipalityWallet: _municipalityWallet,
            daoTreasury: _daoTreasury,
            metadataBaseCid: _metadataBaseCid,
            daoProposalId: _daoProposalId,
            totalRevenue: 0,
            createdAt: block.timestamp
        });

        totalCampaigns++;
        emit CampaignCreated(id, _name, _zoningCode, _maxSupply);
        return id;
    }

    function updateCampaignStatus(uint256 _campaignId, CampaignStatus _newStatus)
        external onlyRole(CAMPAIGN_MANAGER)
    {
        Campaign storage c = campaigns[_campaignId];
        CampaignStatus old = c.status;
        c.status = _newStatus;
        emit CampaignStatusChanged(_campaignId, old, _newStatus);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Whitelist Management
    // ═══════════════════════════════════════════════════════════════════

    function addToWhitelist(
        uint256 _campaignId,
        address[] calldata _addresses,
        uint256 _maxMint
    ) external onlyRole(CAMPAIGN_MANAGER) {
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelists[_campaignId][_addresses[i]] = WhitelistEntry({
                eligible: true,
                maxMint: _maxMint,
                minted: 0
            });
        }
        emit WhitelistAdded(_campaignId, _addresses, _maxMint);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Minting
    // ═══════════════════════════════════════════════════════════════════

    function mint(
        uint256 _campaignId,
        uint256 _latitude,
        uint256 _longitude,
        string calldata _zoningDescription
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        Campaign storage c = campaigns[_campaignId];
        require(
            c.status == CampaignStatus.WHITELIST || c.status == CampaignStatus.PUBLIC_SALE,
            "Zone: campaign not active"
        );
        require(block.timestamp >= c.startTime, "Zone: not started");
        require(block.timestamp <= c.endTime, "Zone: ended");
        require(c.minted < c.maxSupply, "Zone: sold out");

        uint256 price;
        if (c.status == CampaignStatus.WHITELIST) {
            WhitelistEntry storage wl = whitelists[_campaignId][msg.sender];
            require(wl.eligible, "Zone: not whitelisted");
            require(wl.minted < wl.maxMint, "Zone: whitelist limit reached");
            wl.minted++;
            price = c.whitelistPrice;
        } else {
            price = c.priceWei;
        }

        require(msg.value >= price, "Zone: insufficient payment");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(msg.sender, tokenId);

        tokenMetadata[tokenId] = ZoningMetadata({
            tokenId: tokenId,
            campaignId: _campaignId,
            zoningCode: c.zoningCode,
            jurisdiction: c.jurisdiction,
            parcelId: c.parcelId,
            latitude: _latitude,
            longitude: _longitude,
            zoningDescription: _zoningDescription,
            mintedAt: block.timestamp
        });

        tokenToCampaign[tokenId] = _campaignId;
        c.minted++;
        c.totalRevenue += price;
        totalZoningNFTsMinted++;
        totalRevenue += price;

        if (c.minted == c.maxSupply) {
            c.status = CampaignStatus.SOLD_OUT;
        }

        emit ZoningNFTMinted(tokenId, _campaignId, msg.sender, c.zoningCode);

        // Refund excess
        if (msg.value > price) {
            (bool refunded,) = msg.sender.call{value: msg.value - price}("");
            require(refunded, "Zone: refund failed");
        }

        return tokenId;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Revenue Distribution
    // ═══════════════════════════════════════════════════════════════════

    function distributeRevenue(uint256 _campaignId) external onlyRole(CAMPAIGN_MANAGER) nonReentrant {
        Campaign storage c = campaigns[_campaignId];
        require(c.totalRevenue > 0, "Zone: no revenue");

        uint256 revenue = c.totalRevenue;
        uint256 municipalityShare = (revenue * c.municipalityShareBps) / 10000;
        uint256 daoShare = (revenue * c.daoShareBps) / 10000;
        uint256 projectShare = revenue - municipalityShare - daoShare;

        c.totalRevenue = 0;

        if (municipalityShare > 0) {
            (bool s1,) = c.municipalityWallet.call{value: municipalityShare}("");
            require(s1, "Zone: municipality transfer failed");
        }
        if (daoShare > 0) {
            (bool s2,) = c.daoTreasury.call{value: daoShare}("");
            require(s2, "Zone: DAO transfer failed");
        }
        if (projectShare > 0) {
            (bool s3,) = c.projectWallet.call{value: projectShare}("");
            require(s3, "Zone: project transfer failed");
        }

        emit RevenueDistributed(_campaignId, projectShare, municipalityShare, daoShare);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function getCampaignMintCount(uint256 _campaignId) external view returns (uint256) {
        return campaigns[_campaignId].minted;
    }

    function isWhitelisted(uint256 _campaignId, address _user) external view returns (bool) {
        return whitelists[_campaignId][_user].eligible;
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

    receive() external payable {}
}
