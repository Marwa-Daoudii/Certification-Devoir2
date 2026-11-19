# Audit simplifié du contrat CertificateNFT

## Périmètre et méthode

Revue pédagogique de CertificateNFT.sol et de ses fonctions mintCertificate,
batchMintCertificates, revokeCertificate, getCertificate, tokenURI et supportsInterface.
Les fonctions héritées de gestion des rôles et de transfert sont aussi exercées.
ReentrantReceiver.sol sert uniquement à simuler un destinataire réentrant.
Cette revue n'est pas un audit professionnel ni une garantie de sécurité en production.

Le contrat utilise OpenZeppelin Contracts 5.4.0 et Solidity 0.8.26,
avec optimisation et viaIR. Les vérifications combinent lecture du code,
transactions locales et tests automatisés sur Hardhat 3.21.2.

## Checklist et constats

| Contrôle | Résultat | Observation |
| --- | --- | --- |
| Standard ERC-721 | OK testé | ownerOf, transfert et interfaces ERC-721 et metadata vérifiés |
| Droit de mint | OK testé | onlyRole(MINTER_ROLE) sur les deux entrées de mint |
| Droit de révocation | OK testé | DEFAULT_ADMIN_ROLE requis ; rôle minter seul insuffisant |
| Gestion des rôles | OK testé | Attribution et retrait par l'admin ; autre compte refusé |
| Reentrancy au mint | OK testé | nonReentrant et état réservé avant _safeMint ; callback hostile testé |
| Adresse du destinataire | OK testé | Adresse nulle refusée |
| Champs obligatoires | OK testé | Nom, studentId, diplôme, date et URI non vides |
| Doublons | OK testé | Doublon individuel, dans le lot et après révocation refusé |
| Lot | OK testé | 1 à 20 éléments ; tailles égales ; annulation atomique vérifiée |
| Révocation | OK testé | Flag conservé, event indexé ; révocation répétée refusée |
| Événements | OK testé | CertificateMinted et CertificateRevoked contiennent tokenId indexed |
| Identifiant inexistant | OK testé | Lecture, URI et révocation refusées |
| Arithmétique | OK à la lecture | Solidity 0.8 applique les contrôles ; limites numériques extrêmes non testées |
| Métadonnées | Risque métier | L'URI fourni n'est pas comparé aux données du certificat |
| Données personnelles | Risque | Champs et métadonnées lisibles sur la blockchain |
| Clé administrateur | Risque | Un seul compte reçoit initialement les deux rôles |

## Résultats des tests

Le script node test/certificates.mjs a réussi 20 scénarios sur une instance locale
de préparation. Il couvre mint, lecture, interfaces, événements, refus d'accès,
champs vides, doublons, batch, limites du lot, atomicité, révocation, rôles,
transfert et tentative de reentrancy d'un receiver possédant MINTER_ROLE.
La compilation du contrat et le build de production du frontend ont été vérifiés.
Ces résultats doivent être reproduits sur le PC utilisé pour la démonstration.

## Choix de conception et recommandations

La révocation conserve le NFT et son historique. Le studentId reste réservé.
Les NFT sont transférables : la possession du token ne prouve donc pas que son
propriétaire actuel est l'étudiant diplômé. Le destinataire d'émission est conservé.
Les vérificateurs doivent lire le flag revoked, y compris après un transfert.

Le batch reçoit un troisième tableau students en plus de to et uris afin de contrôler
les identifiants étudiants sur la chaîne. Le lot est entièrement annulé si une ligne
échoue, et sa taille est limitée à 20 pour borner la boucle.

Avant un usage réel : protéger le rôle administrateur par un multisig ou des règles
de transfert différé ; définir une politique de transfert des certificats ; réduire
les données personnelles publiées ; vérifier la cohérence des métadonnées avec les
champs stockés ; normaliser les identifiants et les dates côté contrat si nécessaire.
Les comparaisons de studentId sont exactes et sensibles à la casse et aux espaces.
Le frontend supprime les espaces périphériques, mais un appel direct peut les conserver.

Le frontend encode le JSON en data URI pour fonctionner hors connexion, sans IPFS.
Cela augmente le stockage et le coût du mint. Le contrat ne valide que la non-vacuité
de l'URI ; un minter autorisé doit fournir des métadonnées valides et cohérentes.

Pas de Slither, fuzzing, test de charge ni audit exhaustif des dépendances.
Les tests ne vérifient pas l'authenticité des diplômes ni tous les comportements de
wallets et de marketplaces. Aucun déploiement Sepolia n'est inclus dans ces résultats.
