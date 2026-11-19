import fs from "node:fs";
import { JsonRpcProvider, ContractFactory } from "ethers";
import { nft } from "./compile.mjs";

const provider = new JsonRpcProvider(process.env.LOCAL_RPC || "http://127.0.0.1:8545");
try {
  if ((await provider.getNetwork()).chainId !== 31337n) {
    throw new Error("Utilise Hardhat Local, Chain ID 31337.");
  }
  const signer = await provider.getSigner(0);
  const contract = await new ContractFactory(nft.abi, nft.bytecode, signer).deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  fs.writeFileSync("frontend/src/generated/address.json", JSON.stringify({ address }, null, 2));
  console.log("Adresse du contrat ERC-721 :", address);
  console.log("Administrateur et minter :", await signer.getAddress());
  console.log("Transaction de deploiement :", contract.deploymentTransaction().hash);
} finally { provider.destroy(); }
