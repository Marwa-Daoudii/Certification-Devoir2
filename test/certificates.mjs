import assert from "node:assert/strict";
import { ContractFactory, JsonRpcProvider, ZeroAddress } from "ethers";
import { nft, receiver } from "../scripts/compile.mjs";

const provider = new JsonRpcProvider(process.env.LOCAL_RPC || "http://127.0.0.1:8545");
let passed = 0;
async function test(name, task) {
  await task(); passed++; console.log(`OK ${passed} - ${name}`);
}
async function rejected(task) {
  await assert.rejects(task, error => error.code === "CALL_EXCEPTION");
}
const data = id => ["Amina Benali", id, "Licence Informatique", "2026-06-15", "Bien"];
const uri = "data:application/json;base64," + Buffer.from(JSON.stringify({ name: "Certificat de test" })).toString("base64");

try {
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  // Comptes 2, 3 et 4 : les tests ne modifient pas le nonce du compte MetaMask #0.
  const admin = await provider.getSigner(2);
  const other = await provider.getSigner(3);
  const recipient = await (await provider.getSigner(4)).getAddress();
  const otherAddress = await other.getAddress();
  const contract = await new ContractFactory(nft.abi, nft.bytecode, admin).deploy();
  await contract.waitForDeployment();
  const minterRole = await contract.MINTER_ROLE();
  const tx = await contract.mintCertificate(recipient, data("TEST-001"), uri);
  const receipt = await tx.wait();

  await test("Mint et lecture des informations", async () => {
    const c = await contract.getCertificate(1);
    assert.equal(c.student.studentId, "TEST-001");
    assert.equal(c.revoked, false);
    assert.equal(c.recipient, recipient);
    assert.equal(await contract.ownerOf(1), recipient);
    assert.equal(await contract.totalCertificates(), 1n);
  });
  await test("tokenURI et interfaces ERC-721", async () => {
    assert.equal(await contract.tokenURI(1), uri);
    assert.equal(await contract.supportsInterface("0x80ac58cd"), true);
    assert.equal(await contract.supportsInterface("0x5b5e139f"), true);
    assert.equal(await contract.supportsInterface("0x7965db0b"), true);
  });
  await test("Evenement CertificateMinted", async () => {
    const events = receipt.logs.map(log => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    });
    const event = events.find(e => e?.name === "CertificateMinted");
    assert.equal(event.args.tokenId, 1n);
    assert.equal(event.args.studentId, "TEST-001");
  });
  await test("Mint refuse sans role", () => rejected(() => contract.connect(other)
    .mintCertificate.staticCall(recipient, data("DENIED"), uri)));
  await test("Batch refuse sans role", () => rejected(() => contract.connect(other)
    .batchMintCertificates.staticCall([recipient], [uri], [data("DENIED-BATCH")])));
  await test("Adresse nulle refusee", () => rejected(() => contract
    .mintCertificate.staticCall(ZeroAddress, data("NULL"), uri)));
  await test("Champs obligatoires vides refuses", async () => {
    for (const index of [0, 1, 2, 3]) {
      const record = data("EMPTY"); record[index] = "";
      await rejected(() => contract.mintCertificate.staticCall(recipient, record, uri));
    }
    await rejected(() => contract.mintCertificate.staticCall(recipient, data("EMPTY-URI"), ""));
  });
  await test("Double mint bloque", () => rejected(() => contract
    .mintCertificate.staticCall(recipient, data("TEST-001"), uri)));
  await test("Batch de deux certificats", async () => {
    await (await contract.batchMintCertificates([recipient, recipient], [uri, uri],
      [data("TEST-002"), data("TEST-003")])).wait();
    assert.equal(await contract.totalCertificates(), 3n);
    assert.equal((await contract.getCertificate(3)).student.studentId, "TEST-003");
  });
  await test("Tailles de tableaux incompatibles refusees", () => rejected(() => contract
    .batchMintCertificates.staticCall([recipient], [], [data("LENGTH")])));
  await test("Lot vide et lot trop grand refuses", async () => {
    await rejected(() => contract.batchMintCertificates.staticCall([], [], []));
    await rejected(() => contract.batchMintCertificates.staticCall(
      Array(21).fill(recipient), Array(21).fill(uri), Array.from({ length: 21 }, (_, i) => data(`LIMIT-${i}`))));
  });
  await test("Doublon dans le meme lot refuse", () => rejected(() => contract
    .batchMintCertificates.staticCall([recipient, recipient], [uri, uri], [data("DUP"), data("DUP")])));
  await test("Atomicite du batch en cas de deuxieme ligne invalide", async () => {
    try {
      const failedTx = await contract.batchMintCertificates([recipient, ZeroAddress], [uri, uri],
        [data("ROLLBACK"), data("ROLLBACK-2")], { gasLimit: 3000000 });
      await failedTx.wait();
      assert.fail("La transaction devait echouer");
    } catch (error) {
      if (error.code === "ERR_ASSERTION") throw error;
      assert.ok(["CALL_EXCEPTION", "UNKNOWN_ERROR"].includes(error.code));
    }
    assert.equal(await contract.totalCertificates(), 3n);
    assert.equal(await contract.studentIdUsed("ROLLBACK"), false);
  });
  await test("Revocation refusee sans role admin", () => rejected(() => contract.connect(other)
    .revokeCertificate.staticCall(1)));
  await test("Revocation et evenement", async () => {
    const receipt = await (await contract.revokeCertificate(1)).wait();
    assert.equal((await contract.getCertificate(1)).revoked, true);
    assert.equal(await contract.ownerOf(1), recipient);
    const event = receipt.logs.map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
      .find(e => e?.name === "CertificateRevoked");
    assert.equal(event.args.tokenId, 1n);
  });
  await test("Revocation repetee et remint apres revocation refuses", async () => {
    await rejected(() => contract.revokeCertificate.staticCall(1));
    await rejected(() => contract.mintCertificate.staticCall(recipient, data("TEST-001"), uri));
  });
  await test("Identifiant inexistant refuse", async () => {
    await rejected(() => contract.getCertificate(999));
    await rejected(() => contract.tokenURI(999));
    await rejected(() => contract.revokeCertificate.staticCall(999));
  });
  await test("Gestion des roles par l'administrateur", async () => {
    await rejected(() => contract.connect(other).grantRole.staticCall(minterRole, otherAddress));
    await (await contract.grantRole(minterRole, otherAddress)).wait();
    await (await contract.connect(other).mintCertificate(recipient, data("NEW-MINTER"), uri)).wait();
    await rejected(() => contract.connect(other).revokeCertificate.staticCall(2));
    await (await contract.revokeRole(minterRole, otherAddress)).wait();
    await rejected(() => contract.connect(other).mintCertificate.staticCall(recipient, data("REMOVED"), uri));
  });
  await test("Transfert ERC-721 et conservation du destinataire initial", async () => {
    const holder = await provider.getSigner(4);
    await (await contract.connect(holder).transferFrom(recipient, otherAddress, 2)).wait();
    assert.equal(await contract.ownerOf(2), otherAddress);
    assert.equal((await contract.getCertificate(2)).recipient, recipient);
  });
  await test("Reentrancy bloquee meme pour un receiver autorise a minter", async () => {
    const attacker = await new ContractFactory(receiver.abi, receiver.bytecode, admin).deploy();
    await attacker.waitForDeployment();
    const attackerAddress = await attacker.getAddress();
    await (await contract.grantRole(minterRole, attackerAddress)).wait();
    const payload = contract.interface.encodeFunctionData("mintCertificate",
      [attackerAddress, data("REENTER"), uri]);
    await (await attacker.configure(await contract.getAddress(), payload)).wait();
    const before = await contract.totalCertificates();
    await (await contract.mintCertificate(attackerAddress, data("RECEIVER"), uri)).wait();
    assert.equal(await attacker.attackSucceeded(), false);
    assert.equal(await contract.studentIdUsed("REENTER"), false);
    assert.equal(await contract.totalCertificates(), before + 1n);
  });
  console.log(`Tous les tests sont reussis : ${passed}/${passed}.`);
} finally { provider.destroy(); }
