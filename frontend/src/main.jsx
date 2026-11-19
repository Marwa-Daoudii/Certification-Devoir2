import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, JsonRpcProvider, Contract, isAddress, ZeroAddress } from "ethers";
import * as XLSX from "xlsx";
import abi from "./generated/abi.json";
import configuration from "./generated/address.json";
import "./style.css";

const rpc = new JsonRpcProvider("http://127.0.0.1:8545");
const registry = new Contract(configuration.address, abi, rpc);
const fields = [
  ["studentName", "Nom complet"], ["studentId", "Identifiant étudiant"],
  ["diplomaTitle", "Diplôme"], ["issueDate", "Date d’émission"],
  ["recipientAddress", "Adresse wallet du destinataire"], ["grade", "Mention"]
];
const empty = Object.fromEntries(fields.map(([key]) => [key, ""]));

function check(record) {
  for (const key of ["studentName", "studentId", "diplomaTitle", "issueDate"]) {
    if (!record[key]?.trim()) throw new Error(`Champ obligatoire : ${key}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.issueDate) ||
      !Number.isFinite(Date.parse(record.issueDate)) ||
      new Date(record.issueDate).toISOString().slice(0, 10) !== record.issueDate) {
    throw new Error("Date attendue : AAAA-MM-JJ.");
  }
  if (!isAddress(record.recipientAddress) || record.recipientAddress.toLowerCase() === ZeroAddress) {
    throw new Error("Une adresse wallet valide et non nulle est obligatoire pour recevoir un NFT.");
  }
}

function student(record) {
  return [record.studentName, record.studentId, record.diplomaTitle, record.issueDate, record.grade];
}

function metadata(record) {
  const json = JSON.stringify({
    name: `Certificat de ${record.studentName}`,
    description: "Certificat académique ERC-721",
    attributes: ["studentName", "studentId", "diplomaTitle", "issueDate", "grade"].map(key => ({
      trait_type: key, value: record[key]
    }))
  });
  const binary = Array.from(new TextEncoder().encode(json), byte => String.fromCharCode(byte)).join("");
  return "data:application/json;base64," + btoa(binary);
}

// Lire les composantes Excel sans conversion UTC, pour eviter le decalage d'un jour.
function excelDate(value) {
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(value ?? "").trim();
}

function detail(error) {
  return error?.info?.error?.message || error?.error?.message || error?.reason ||
    error?.shortMessage || error?.message || String(error);
}

function App() {
  const [account, setAccount] = useState("");
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [lookupId, setLookupId] = useState("");
  const [certificate, setCertificate] = useState(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [revokeId, setRevokeId] = useState("");

  useEffect(() => {
    const changed = accounts => setAccount(accounts[0] || "");
    window.ethereum?.on("accountsChanged", changed);
    return () => window.ethereum?.removeListener("accountsChanged", changed);
  }, []);

  async function action(task) {
    setBusy(true); setMessage("");
    try { await task(); } catch (error) { setMessage(detail(error)); }
    finally { setBusy(false); }
  }

  async function connect() {
    if (!window.ethereum) throw new Error("MetaMask introuvable.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0] || "");
  }

  async function writable(admin = false) {
    if (!window.ethereum) throw new Error("MetaMask introuvable.");
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(chainId) !== 31337n) throw new Error("Sélectionne Hardhat Local dans MetaMask.");
    const provider = new BrowserProvider(window.ethereum);
    if (await provider.getCode(configuration.address) === "0x") {
      throw new Error("Contrat absent. Exécute node scripts/deploy.mjs puis recharge la page.");
    }
    const signer = await provider.getSigner();
    const address = await signer.getAddress(); setAccount(address);
    const contract = new Contract(configuration.address, abi, signer);
    const role = admin ? await contract.DEFAULT_ADMIN_ROLE() : await contract.MINTER_ROLE();
    if (!await contract.hasRole(role, address)) {
      throw new Error(admin ? "Compte sans rôle administrateur." : "Compte sans MINTER_ROLE. Utilise le compte Hardhat #0.");
    }
    return contract;
  }

  async function confirm(tx) {
    setTransactions(old => [...old, { hash: tx.hash, status: "En attente" }]);
    try {
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Transaction échouée.");
      setTransactions(old => old.map(t => t.hash === tx.hash ? { ...t, status: "Confirmée" } : t));
      return receipt;
    } catch (error) {
      setTransactions(old => old.map(t => t.hash === tx.hash ? { ...t, status: "À vérifier" } : t));
      throw error;
    }
  }

  async function issueOne() {
    const record = Object.fromEntries(fields.map(([key]) => [key, form[key].trim()]));
    check(record);
    const contract = await writable();
    const tx = await contract.mintCertificate(record.recipientAddress, student(record), metadata(record));
    const receipt = await confirm(tx);
    const event = receipt.logs.map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
      .find(log => log?.name === "CertificateMinted");
    setMessage(`Certificat émis. tokenId : ${event.args.tokenId}`);
    setForm({ ...empty });
  }

  async function loadFile(event) {
    const file = event.target.files[0]; if (!file) return;
const workbook = XLSX.read(await file.arrayBuffer(), {
  cellDates: false,
  raw: true
});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
    if (!data.length) throw new Error("Fichier vide.");
    for (const [key] of fields) {
      if (!(key in data[0])) throw new Error(`Colonne manquante : ${key}`);
    }
    const seen = new Set();
    const imported = data.map((entry, index) => {
      const record = Object.fromEntries(fields.map(([key]) => [key,
        key === "issueDate" ? excelDate(entry[key]) : String(entry[key] ?? "").trim()
      ]));
      let error = "";
      try {
        check(record);
        if (seen.has(record.studentId)) throw new Error("Identifiant en double dans le fichier.");
        seen.add(record.studentId);
      } catch (e) { error = detail(e); }
      return { index, record, error, selected: !error, issued: false };
    });
    setRows(imported); setMessage(`${imported.length} lignes importées. Vérifie les dates et les adresses.`);
  }

  async function issueBatch() {
    const selected = rows.filter(row => row.selected && !row.issued && !row.error);
    if (!selected.length || selected.length > 20) throw new Error("Sélectionne entre 1 et 20 lignes valides.");
    selected.forEach(row => check(row.record));
    const contract = await writable();
    const tx = await contract.batchMintCertificates(
      selected.map(row => row.record.recipientAddress),
      selected.map(row => metadata(row.record)),
      selected.map(row => student(row.record))
    );
    await confirm(tx);
    const indexes = new Set(selected.map(row => row.index));
    setRows(old => old.map(row => indexes.has(row.index) ? { ...row, issued: true, selected: false } : row));
    setMessage(`${selected.length} certificats émis dans une seule transaction.`);
  }

  async function search() {
    setCertificate(null); setLookupMessage("");
    try {
      if (!/^[1-9]\d*$/.test(lookupId.trim())) throw new Error("Saisis un tokenId entier positif.");
      const id = BigInt(lookupId.trim());
      const result = await registry.getCertificate(id);
      const uri = await registry.tokenURI(id);
      const owner = await registry.ownerOf(id);
      setCertificate({ result, uri, owner, id: id.toString() });
    } catch (error) { setLookupMessage(detail(error)); }
  }

  async function revoke() {
    if (!/^[1-9]\d*$/.test(revokeId.trim())) throw new Error("Saisis un tokenId entier positif.");
    const contract = await writable(true);
    await confirm(await contract.revokeCertificate(BigInt(revokeId.trim())));
    setCertificate(null);
    setMessage("Certificat révoqué. Relance la vérification publique pour voir son statut.");
  }

  return <main>
    <h1>Certification académique ERC-721</h1>
    <p>Réseau Hardhat Local · Chain ID 31337</p>
    <section>
      <h2>Administration</h2>
      <button disabled={busy} onClick={() => action(connect)}>Connecter MetaMask</button>
      <p>Compte : {account || "Non connecté"}</p>
      <h3>Émettre un certificat NFT</h3>
      <p>L’adresse du destinataire est maintenant obligatoire.</p>
      <form onSubmit={event => { event.preventDefault(); action(issueOne); }}>
        {fields.map(([key, label]) => <label key={key}>{label}
          <input type={key === "issueDate" ? "date" : "text"} value={form[key]}
            required={key !== "grade"} disabled={busy}
            onChange={event => setForm({ ...form, [key]: event.target.value })} />
        </label>)}
        <button disabled={busy}>Émettre</button>
      </form>
      <h3>Importer Excel ou CSV</h3>
      <input type="file" accept=".xlsx,.csv" disabled={busy}
        onChange={event => action(() => loadFile(event))} />
      {rows.length > 0 && <>
        <div className="table-wrap"><table><thead><tr>
          <th>Choix</th>{fields.map(([key, label]) => <th key={key}>{label}</th>)}<th>État</th>
        </tr></thead><tbody>{rows.map(row => <tr key={row.index}>
          <td><input type="checkbox" checked={row.selected} disabled={busy || !!row.error || row.issued}
            onChange={() => setRows(old => old.map(r => r.index === row.index ? { ...r, selected: !r.selected } : r))} /></td>
          {fields.map(([key]) => <td key={key}>{row.record[key]}</td>)}
          <td>{row.error || (row.issued ? "Émis" : "Prêt")}</td>
        </tr>)}</tbody></table></div>
        <button disabled={busy} onClick={() => action(issueBatch)}>Émettre les lignes sélectionnées</button>
      </>}
      <h3>Révoquer un certificat</h3>
      <input placeholder="tokenId" value={revokeId} disabled={busy} onChange={e => setRevokeId(e.target.value)} />
      <button disabled={busy} onClick={() => action(revoke)}>Révoquer</button>
      <p role="status">{busy ? "Opération en cours, vérifie MetaMask…" : message}</p>
      <h3>Transactions</h3>
      {transactions.map(tx => <p className="hash" key={tx.hash}>{tx.status} : {tx.hash}</p>)}
    </section>
    <section>
      <h2>Vérification publique</h2>
      <label>tokenId<input value={lookupId} onChange={e => setLookupId(e.target.value)} /></label>
      <button onClick={search}>Vérifier</button>
      <p>{lookupMessage}</p>
      {certificate && <>
        <p>tokenId : {certificate.id}</p>
        {["studentName", "studentId", "diplomaTitle", "issueDate", "grade"].map(key =>
          <p key={key}>{fields.find(([k]) => k === key)[1]} : {certificate.result.student[key]}</p>)}
        <p className="hash">Destinataire initial : {certificate.result.recipient}</p>
        <p className="hash">Propriétaire actuel du NFT : {certificate.owner}</p>
        <p><strong>Statut : {certificate.result.revoked ? "Révoqué" : "Valide"}</strong></p>
        <label>tokenURI<textarea readOnly value={certificate.uri} rows={5} /></label>
      </>}
    </section>
    <p className="hash">Contrat : {configuration.address}</p>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
