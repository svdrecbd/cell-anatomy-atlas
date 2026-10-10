import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import typescript from "typescript";

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert(process.argv[2], "Supply a copy of the current production module directory.");
const candidateDirectory = resolve(process.argv[2]);
const wrapperPath = resolve(candidateDirectory, "security-baseline-handler.js");
const currentWrapper = await readFile(wrapperPath, "utf8");
assert(currentWrapper.includes('from "./funding-baseline-handler.js"'), "The existing funding wrapper must be identified.");
const legacyModule = await import(pathToFileURL(resolve(candidateDirectory, "funding-acknowledgment-assets.js")).href);
const legacyAssets = { assetVersion: legacyModule.assetVersion, stylesheet: legacyModule.stylesheet, emblemBase64: legacyModule.emblemBase64 };
assert(legacyAssets.assetVersion && legacyAssets.stylesheet && legacyAssets.emblemBase64);

const footerSource = await readFile(resolve(applicationDirectory, "components/institutional-footer.tsx"), "utf8");
const completeStylesheet = await readFile(resolve(applicationDirectory, "app/institutional.css"), "utf8");
const stylesheetStart = completeStylesheet.indexOf(".institutional-footer .institutional-funding {");
assert(stylesheetStart >= 0);
const stylesheet = completeStylesheet.slice(stylesheetStart);
const emblemSvg = await readFile(resolve(applicationDirectory, "public/brand/nih-emblem.svg"), "utf8");
const universityLogo = await readFile(resolve(applicationDirectory, "public/brand/ucsf-logo.png"));
const assetVersion = createHash("sha256").update(stylesheet).update(emblemSvg).update(universityLogo).digest("hex").slice(0, 16);
const preparedSource = footerSource.replaceAll("/brand/nih-emblem.svg", `/_site/nih-emblem.${assetVersion}.svg`).replaceAll("/brand/ucsf-logo.png", `/_site/ucsf-logo.${assetVersion}.png`);
const compiledFooter = typescript.transpileModule(preparedSource, {
  compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022, jsx: typescript.JsxEmit.ReactJSX }
}).outputText.replace(/^import[^\n]*\n/gm, "").replace(/^export /gm, "");

const handlerPath = resolve(candidateDirectory, "published-handler.js");
const handlerSource = await readFile(handlerPath, "utf8");
const syntax = typescript.createSourceFile("published-handler.js", handlerSource, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
const footerFunctions = [];
function visit(node) {
  if (typescript.isFunctionDeclaration(node) && node.body) {
    const body = node.body.getText(syntax);
    if (body.length < 10000 && body.includes("General Cell Anatomy Group") && body.includes("institutional-footer")) footerFunctions.push(node);
  }
  typescript.forEachChild(node, visit);
}
visit(syntax);
assert.equal(footerFunctions.length, 1);
const currentFooter = footerFunctions[0];
const runtime = /\b([A-Za-z_$][\w$]*)\.jsxs\(/.exec(currentFooter.getText(syntax))?.[1];
assert(runtime, "The footer JSX runtime must be identified.");
const preparedFooter = compiledFooter.replaceAll("_jsxs(", `${runtime}.jsxs(`).replaceAll("_jsx(", `${runtime}.jsx(`).replace("function InstitutionalFooter", `function ${currentFooter.name.text}`);
await writeFile(handlerPath, handlerSource.slice(0, currentFooter.getStart(syntax)) + preparedFooter + handlerSource.slice(currentFooter.end));
await writeFile(wrapperPath, await readFile(resolve(applicationDirectory, "deployment/funding-logo-worker.js"), "utf8"));
await writeFile(resolve(candidateDirectory, "funding-logo-assets.js"), [
  `export const stylesheet = ${JSON.stringify(stylesheet)};`,
  `export const assetVersion = ${JSON.stringify(assetVersion)};`,
  `export const emblemSvg = ${JSON.stringify(emblemSvg)};`,
  `export const universityLogoBase64 = ${JSON.stringify(universityLogo.toString("base64"))};`,
  `export const legacyAssets = ${JSON.stringify(legacyAssets)};`
].join("\n") + "\n");
console.log(JSON.stringify({ assetVersion, changedModules: ["published-handler.js", "security-baseline-handler.js"], addedModules: ["funding-logo-assets.js"], retainedSecurityEntry: "index.js", retainedLegacyAssets: legacyAssets.assetVersion }));
