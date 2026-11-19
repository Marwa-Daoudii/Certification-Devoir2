# Étapes du Devoir 2

## 1 Copier les fichiers

Cette archive contient les fichiers de migration, pas node_modules et pas le rapport Word.
Décompresser, puis copier son contenu dans chain-devoir2, à la racine du projet existant.
Accepter le remplacement de README.md, scripts/compile.mjs, scripts/deploy.mjs,
frontend/index.html, frontend/src/main.jsx, frontend/src/style.css et test/certificates.mjs.
Les nouveaux contrats s'ajoutent dans contracts.
Conserver package.json, package-lock.json, hardhat.config.ts et node_modules déjà présents.
Le contrat du devoir 1 peut rester : le nouveau script compile CertificateNFT et son contrat de test.

## 2 Installer OpenZeppelin

Terminal VS Code, depuis chain-devoir2 :

```powershell
npm.cmd install --save-exact @openzeppelin/contracts@5.4.0
```

Attendre la fin de l'installation. Elle nécessite Internet uniquement cette fois-ci.

## 3 Démarrer Hardhat

```powershell
yarn.cmd hardhat node
```

Laisser le terminal ouvert. Si le port 8545 est déjà occupé par le nœud Hardhat utilisé
au devoir 1, garder ce nœud et ne pas ouvrir une deuxième instance.

## 4 Déployer et lancer l'application

Dans un deuxième terminal :

```powershell
node scripts/deploy.mjs
.\node_modules\.bin\vite.cmd frontend --host 127.0.0.1
```

Ouvrir l'URL affichée par Vite. Par défaut : http://127.0.0.1:5173.
Si le port 5173 était occupé par l'ancienne interface, arrêter uniquement l'ancien
serveur Vite avec Ctrl+C, puis relancer Vite dans chain-devoir2.

## 5 Connecter MetaMask

Sélectionner Hardhat Local et Imported Account 1, adresse 0xf39F...92266.
Cliquer sur Connecter MetaMask dans la nouvelle interface.
Le déployeur possède MINTER_ROLE et DEFAULT_ADMIN_ROLE.

## 6 Créer le premier certificat

Saisir Amina Benali, 2023-INF-042, Licence Informatique, 2026-06-15, Mention Bien.
Adresse obligatoire : 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.
Cliquer sur Émettre et confirmer dans MetaMask.
Vérifier le tokenId affiché et la transaction Confirmée.

## 7 Vérifier le tokenId

Dans Vérification publique, saisir le tokenId affiché puis Vérifier.
Lire les informations, tokenURI et statut Valide.
Le tokenURI est un JSON encodé en base64 et stocké sur la chaîne.

## 8 Essayer le batch

Importer etudiants_devoir2.csv. Les deux adresses sont déjà remplies.
Vérifier la date 2026-06-15. Les deux lignes doivent être Prêtes et sélectionnées.
Cliquer sur Émettre les lignes sélectionnées et confirmer une seule transaction.
Les deux lignes doivent devenir Émis.
Sur un contrat neuf après Amina, les tokenId sont normalement 2 et 3.

## 9 Révoquer

Saisir 1 dans Révoquer un certificat, puis Révoquer et confirmer avec l'admin.
Relancer Vérifier pour 1 : statut Révoqué.
Le NFT existe encore ; la révocation ne brûle pas le token.

## 10 Vérifier un refus de rôle

Passer sur un autre compte MetaMask sans MINTER_ROLE, puis connecter ce compte.
Essayer Émettre : l'interface doit afficher Compte sans MINTER_ROLE.
Revenir ensuite au compte 0xf39F...92266.
Ne pas transmettre une clé privée pour cette manipulation.

## 11 Exécuter les tests

Dans un troisième terminal :

```powershell
node test/certificates.mjs
```

Attendre Tous les tests sont reussis : 20/20.
Les tests ne changent pas l'adresse du contrat de l'interface.

## 12 Captures pour la démonstration

1. Terminal affichant le déploiement et l'adresse.
2. Émission réussie et tokenId.
3. Tableau importé avec la date correcte et les deux lignes Émises.
4. Vérification publique montrant tokenId, tokenURI et statut Valide.
5. Vérification du même token après révocation.
6. Erreur Compte sans MINTER_ROLE.
7. Terminal montrant les 20 tests réussis.

Ne pas photographier les clés privées affichées au démarrage du nœud.

## 13 Livrables

Le code, les tests, README.md et AUDIT.md se trouvent dans le projet.
AUDIT.md constitue le mini-rapport d'audit demandé en Markdown.
Le dépôt GitHub sera mis à jour après vérification de la démonstration locale.
Le sujet accepte un réseau cible local ou Sepolia, mais exige aussi une adresse et
une transaction Sepolia dans sa liste finale : cette partie reste à réaliser selon
la consigne finale de l'enseignante. Ne pas présenter l'adresse locale comme une adresse Sepolia.

Si le nœud est redémarré, redéployer et recharger l'application.
Si MetaMask affiche Nonce too high, sélectionner le compte et le réseau local,
puis effacer les données d'activité et de nonce dans Settings > Developer tools.
