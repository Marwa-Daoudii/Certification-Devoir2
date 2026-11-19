# Devoir 2 Certification académique ERC-721

Ce projet fait évoluer le devoir 1 vers des certificats NFT ERC-721.
Il utilise Solidity 0.8.26, OpenZeppelin Contracts 5.4.0, Hardhat,
React, Vite, Ethers.js et SheetJS. Le fonctionnement décrit ici est local.

## Fonctions

- Un certificat correspond à un NFT unique.
- MINTER_ROLE autorise l'émission individuelle ou par lot.
- DEFAULT_ADMIN_ROLE autorise la révocation et la gestion des rôles.
- Le déployeur reçoit les deux rôles.
- Les identifiants étudiants ne sont pas réutilisables, même après révocation.
- Les métadonnées sont accessibles par tokenURI au format data URI JSON base64.
- Le frontend propose la saisie, l'import CSV/Excel, la révocation et la vérification publique.

## Installation dans la copie du devoir 1

Ces fichiers sont destinés au dossier chain-devoir2, copie du projet existant.
Les dépendances du devoir 1 doivent être présentes. Depuis sa racine :

```powershell
npm.cmd install --save-exact @openzeppelin/contracts@5.4.0
```

Cette commande nécessite Internet. Elle met à jour package.json et package-lock.json.
Conserver node_modules pour le fonctionnement hors connexion.

## Démarrage

Terminal 1, si aucun nœud n'utilise déjà le port 8545 :

```powershell
yarn.cmd hardhat node
```

Terminal 2 :

```powershell
node scripts/deploy.mjs
.\node_modules\.bin\vite.cmd frontend --host 127.0.0.1
```

Ouvrir http://127.0.0.1:5173. Le déploiement génère automatiquement
frontend/src/generated/abi.json et address.json.
Conserver les deux terminaux ouverts.

## MetaMask

- RPC : http://127.0.0.1:8545
- Chain ID : 31337
- Symbole : ETH
- Administration : compte Hardhat numéro 0
- Adresse : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

L'adresse du destinataire est obligatoire et ne peut pas être nulle.
Les comptes fournis par Hardhat servent uniquement aux tests locaux.

## Essai individuel

- Nom : Amina Benali
- Identifiant étudiant : 2023-INF-042
- Diplôme : Licence Informatique
- Date : 2026-06-15
- Destinataire : 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
- Mention : Mention Bien

Cliquer sur Émettre et confirmer dans MetaMask. Le tokenId est affiché après confirmation.
La vérification publique affiche les informations, le propriétaire actuel, le tokenURI et le statut.

## Import

Utiliser etudiants_devoir2.csv ou un fichier Excel avec les mêmes colonnes :
studentName, studentId, diplomaTitle, issueDate, recipientAddress, grade.
Les dates doivent être au format AAAA-MM-JJ. Pour Excel, les composantes de date
sont lues sans passer par une conversion UTC.

Sélectionner entre 1 et 20 lignes. Une seule confirmation MetaMask suffit pour le lot.
Si une ligne est rejetée par le contrat, tout le lot est annulé.

La fonction batchMintCertificates possède trois tableaux : to, uris et students.
Le troisième tableau est une adaptation de la signature indicative du sujet :
il fournit au contrat les identifiants et données étudiants à contrôler,
car un URI est une chaîne opaque que le contrat ne décode pas en JSON.

## Révocation

Saisir le tokenId, cliquer sur Révoquer et confirmer avec un compte administrateur.
Relancer la vérification publique. Le NFT existe toujours, avec le statut Révoqué.
La révocation ne brûle pas le NFT et n'autorise pas de remint du même studentId.

## Tests

Terminal 3 :

```powershell
node test/certificates.mjs
```

Le script réalise 20 scénarios. Il utilise une instance séparée et les comptes
Hardhat 2, 3 et 4 pour ne pas modifier le compteur de transactions du compte MetaMask 0.
ReentrantReceiver.sol est uniquement un contrat de test ; le script de déploiement
de l'application déploie seulement CertificateNFT.

La compilation et les 20 scénarios ont été exécutés avec succès dans l'environnement
de préparation sur Hardhat 3.21.2. Le build Vite a aussi été vérifié.
Relancer les tests sur le PC pour obtenir sa propre sortie et ses captures.

## Choix et limites

Les NFT restent transférables selon ERC-721. Le destinataire initial est conservé
séparément du propriétaire actuel. Un transfert ne change pas le statut de révocation.
Le statut doit être lu sur le contrat ; le JSON du tokenURI ne contient pas de statut.
Les métadonnées sont immuables après mint dans cette version.

Le contrat contrôle les champs non vides et l'unicité exacte de studentId,
mais pas l'authenticité du diplôme, le format sémantique de la date, ni la cohérence
du JSON fourni avec les champs stockés. Voir AUDIT.md.

Après un redémarrage du nœud Hardhat, ses données sont réinitialisées.
Redéployer le contrat et recharger l'interface. En cas de Nonce too high,
effacer l'activité et les données de nonce MetaMask sur le réseau local.

Le livrable local n'inclut pas de déploiement Sepolia. L'adresse et la transaction
Sepolia demandées dans la liste finale du sujet restent à produire si l'enseignante
les exige en plus de la démonstration locale.

## Références

- https://docs.openzeppelin.com/contracts/5.x/access-control
- https://docs.openzeppelin.com/contracts/5.x/erc721
- https://eips.ethereum.org/EIPS/eip-721

## Comprendre les fichiers

| Fichier | Rôle |
| --- | --- |
| contracts/CertificateNFT.sol | NFT, certificats, rôles et révocation |
| contracts/ReentrantReceiver.sol | Simulation de reentrancy pour les tests |
| scripts/compile.mjs | Compilation locale de Solidity et des imports OpenZeppelin |
| scripts/deploy.mjs | Déploiement et génération de l'adresse du frontend |
| frontend/src/main.jsx | Formulaires, import et appels au contrat |
| test/certificates.mjs | 20 scénarios de vérification |
| AUDIT.md | Périmètre, résultats et limites de l'audit simplifié |
