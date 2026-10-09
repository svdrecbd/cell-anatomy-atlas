import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import typescript from "typescript";

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert(process.argv[2], "Supply the directory containing the downloaded production modules.");
const candidateDirectory = resolve(process.argv[2]);
const currentEntry = await readFile(resolve(candidateDirectory, "index.js"), "utf8");
assert(!currentEntry.includes("security-baseline-handler.js"), "Prepare from the original production entry.");
const protectionSource = await readFile(resolve(applicationDirectory, "lib/request-security.ts"), "utf8");
const protectionModule = typescript.transpileModule(protectionSource, {
  compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022 }
}).outputText;
await mkdir(resolve(candidateDirectory, "security"), { recursive: true });
await writeFile(resolve(candidateDirectory, "security/request-protection.js"), protectionModule);
await writeFile(resolve(candidateDirectory, "security-baseline-handler.js"), currentEntry);
await writeFile(resolve(candidateDirectory, "index.js"), await readFile(resolve(applicationDirectory, "deployment/request-protection-worker.js"), "utf8"));
console.log(JSON.stringify({ changedOriginalModules: ["index.js"], addedModules: ["security-baseline-handler.js", "security/request-protection.js"] }));
