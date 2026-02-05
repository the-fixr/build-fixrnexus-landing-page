// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BuilderID
 * @notice Soulbound NFT for Farcaster builders - proof of builder identity
 * @dev One NFT per Farcaster FID, non-transferable (soulbound)
 * @dev FID ownership verified off-chain via Farcaster verified addresses
 */
contract BuilderID is ERC721, ERC721URIStorage, Ownable {
    using Strings for uint256;

    // Mint price: $0.25 worth of ETH (approximately 0.0001 ETH at ~$2500/ETH)
    uint256 public mintPrice = 0.0001 ether;

    // Base URI for metadata
    string public baseTokenURI;

    // Mapping from FID to token ID
    mapping(uint256 => uint256) public fidToTokenId;

    // Mapping from token ID to FID
    mapping(uint256 => uint256) public tokenIdToFid;

    // Mapping to track if FID has minted
    mapping(uint256 => bool) public hasMinted;

    // Token counter
    uint256 private _tokenIdCounter;

    // Events
    event BuilderMinted(address indexed to, uint256 indexed tokenId, uint256 indexed fid, string username);
    event BaseURIUpdated(string newBaseURI);
    event MintPriceUpdated(uint256 newPrice);
    event Withdrawn(address to, uint256 amount);

    // Errors
    error AlreadyMinted(uint256 fid);
    error SoulboundToken();
    error InvalidFID();
    error InsufficientPayment();
    error WithdrawFailed();

    constructor(
        string memory _baseTokenURI
    ) ERC721("Builder ID", "BUILDER") Ownable(msg.sender) {
        baseTokenURI = _baseTokenURI;
    }

    /**
     * @notice Mint a Builder ID NFT (owner only, for airdrops/special cases)
     * @param to Address to mint to
     * @param fid Farcaster ID of the builder
     * @param username Farcaster username (for event logging)
     */
    function mint(address to, uint256 fid, string calldata username) external onlyOwner {
        if (fid == 0) revert InvalidFID();
        if (hasMinted[fid]) revert AlreadyMinted(fid);

        _mintBuilderID(to, fid, username);
    }

    /**
     * @notice Claim Builder ID - pay mint fee and receive your soulbound NFT
     * @dev FID ownership is verified off-chain via Farcaster verified addresses
     * @param fid Farcaster ID
     * @param username Farcaster username
     */
    function claim(
        uint256 fid,
        string calldata username
    ) external payable {
        if (fid == 0) revert InvalidFID();
        if (hasMinted[fid]) revert AlreadyMinted(fid);
        if (msg.value < mintPrice) revert InsufficientPayment();

        _mintBuilderID(msg.sender, fid, username);

        // Refund excess payment
        if (msg.value > mintPrice) {
            (bool success, ) = msg.sender.call{value: msg.value - mintPrice}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Internal mint function
     */
    function _mintBuilderID(address to, uint256 fid, string calldata username) internal {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        hasMinted[fid] = true;
        fidToTokenId[fid] = tokenId;
        tokenIdToFid[tokenId] = fid;

        _safeMint(to, tokenId);

        emit BuilderMinted(to, tokenId, fid, username);
    }

    /**
     * @notice Get token ID for a FID
     * @param fid Farcaster ID
     * @return Token ID (reverts if not minted)
     */
    function getTokenIdByFid(uint256 fid) external view returns (uint256) {
        require(hasMinted[fid], "FID has not minted");
        return fidToTokenId[fid];
    }

    /**
     * @notice Get FID for a token ID
     * @param tokenId Token ID
     * @return Farcaster ID
     */
    function getFidByTokenId(uint256 tokenId) external view returns (uint256) {
        require(tokenIdToFid[tokenId] != 0 || tokenId == 0, "Token does not exist");
        return tokenIdToFid[tokenId];
    }

    /**
     * @notice Check if a FID has minted
     * @param fid Farcaster ID
     * @return Whether the FID has minted
     */
    function hasBuilderID(uint256 fid) external view returns (bool) {
        return hasMinted[fid];
    }

    /**
     * @notice Get total supply of Builder IDs
     * @return Total minted count
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ============ Owner Functions ============

    /**
     * @notice Update base URI for metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @notice Update mint price
     * @param newPrice New mint price in wei
     */
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    /**
     * @notice Withdraw contract balance
     * @param to Address to send funds to
     */
    function withdraw(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = to.call{value: balance}("");
        if (!success) revert WithdrawFailed();
        emit Withdrawn(to, balance);
    }

    // ============ Soulbound Overrides ============
    // Prevent all transfers except minting

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from = address(0)) and burning (to = address(0))
        // Block all transfers
        if (from != address(0) && to != address(0)) {
            revert SoulboundToken();
        }

        return super._update(to, tokenId, auth);
    }

    // ============ URI Overrides ============

    function tokenURI(uint256 tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        _requireOwned(tokenId);

        uint256 fid = tokenIdToFid[tokenId];
        return string(abi.encodePacked(baseTokenURI, fid.toString()));
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
