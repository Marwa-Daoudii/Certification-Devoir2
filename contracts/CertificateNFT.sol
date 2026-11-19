// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CertificateNFT is ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_BATCH = 20;
    uint256 public totalCertificates;

    struct Student {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
    }

    struct Certificate {
        Student student;
        address recipient;
        bool revoked;
    }

    mapping(uint256 => Certificate) private certificates;
    mapping(string => bool) public studentIdUsed;

    event CertificateMinted(uint256 indexed tokenId,
        address indexed recipient, string studentId);
    event CertificateRevoked(uint256 indexed tokenId);

    constructor() ERC721("Certificats Academiques", "CERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintCertificate(address to, Student calldata student,
        string calldata uri)
        external onlyRole(MINTER_ROLE) nonReentrant returns (uint256)
    {
        return _issue(to, student, uri);
    }

    // Le troisieme tableau permet de verifier chaque studentId sur la chaine.
    function batchMintCertificates(address[] calldata to,
        string[] calldata uris, Student[] calldata students)
        external onlyRole(MINTER_ROLE) nonReentrant
    {
        require(to.length > 0 && to.length <= MAX_BATCH, "Lot de 1 a 20");
        require(to.length == uris.length && to.length == students.length,
            "Tailles differentes");
        for (uint256 i = 0; i < to.length; i++) {
            _issue(to[i], students[i], uris[i]);
        }
    }

    function _issue(address to, Student calldata student,
        string calldata uri) private returns (uint256 tokenId)
    {
        require(to != address(0), "Adresse nulle");
        require(bytes(student.studentName).length > 0, "Nom obligatoire");
        require(bytes(student.studentId).length > 0, "Identifiant obligatoire");
        require(bytes(student.diplomaTitle).length > 0, "Diplome obligatoire");
        require(bytes(student.issueDate).length > 0, "Date obligatoire");
        require(bytes(uri).length > 0, "URI obligatoire");
        require(!studentIdUsed[student.studentId], "Identifiant deja utilise");

        // Effets avant le callback externe de _safeMint.
        studentIdUsed[student.studentId] = true;
        tokenId = ++totalCertificates;
        certificates[tokenId] = Certificate(student, to, false);
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit CertificateMinted(tokenId, to, student.studentId);
    }

    function revokeCertificate(uint256 tokenId)
        external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant
    {
        _requireOwned(tokenId);
        require(!certificates[tokenId].revoked, "Deja revoque");
        certificates[tokenId].revoked = true;
        emit CertificateRevoked(tokenId);
    }

    function getCertificate(uint256 tokenId)
        external view returns (Certificate memory)
    {
        _requireOwned(tokenId);
        return certificates[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
