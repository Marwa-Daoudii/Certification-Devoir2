import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const filenames = ["CertificateNFT.sol", "ReentrantReceiver.sol"];
const sources = Object.fromEntries(filenames.map(name => [name, {
  content: fs.readFileSync(`contracts/${name}`, "utf8")
}]));

function findImports(name) {
  const root = name.startsWith("@openzeppelin/") ? "node_modules" : "contracts";
  const filename = path.resolve(root, name);
  if (!filename.startsWith(path.resolve(root) + path.sep)) {
    return { error: "Import hors du dossier autorise" };
  }
  try { return { contents: fs.readFileSync(filename, "utf8") }; }
  catch { return { error: `Import introuvable : ${name}` }; }
}

const input = {
  language: "Solidity", sources,
  settings: {
    optimizer: { enabled: true, runs: 200 }, viaIR: true,
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (output.errors || []).filter(e => e.severity === "error");
if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join("\n"));

function artifact(file, name) {
  const result = output.contracts[file][name];
  return { abi: result.abi, bytecode: "0x" + result.evm.bytecode.object };
}

export const nft = artifact("CertificateNFT.sol", "CertificateNFT");
export const receiver = artifact("ReentrantReceiver.sol", "ReentrantReceiver");
fs.mkdirSync("frontend/src/generated", { recursive: true });
fs.writeFileSync("frontend/src/generated/abi.json", JSON.stringify(nft.abi, null, 2));
