import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import typescript from "typescript";

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidateDirectory = resolve(process.argv[2]);
const originalHandler = await readFile(resolve(candidateDirectory, "index.js"), "utf8");
const footerSource = await readFile(resolve(applicationDirectory, "components/institutional-footer.tsx"), "utf8");
const aboutSource = await readFile(resolve(applicationDirectory, "app/about/page.tsx"), "utf8");
const completeStylesheet = await readFile(resolve(applicationDirectory, "app/institutional.css"), "utf8");
const stylesheetStart = completeStylesheet.indexOf(".institutional-footer .institutional-funding {");
assert(stylesheetStart >= 0);
const stylesheet = completeStylesheet.slice(stylesheetStart);
const emblem = await readFile(resolve(applicationDirectory, "public/brand/nih-emblem.png"));
const assetVersion = createHash("sha256").update(stylesheet).update(emblem).digest("hex").slice(0, 16);
const emblemPath = `/_site/nih-emblem.${assetVersion}.png`;

function descendants(sourceFile, predicate) {
  const matches = [];
  const visit = node => { if (predicate(node)) matches.push(node); typescript.forEachChild(node, visit); };
  visit(sourceFile);
  return matches;
}
function compiledExpression(source) {
  const output = typescript.transpileModule(source, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022, jsx: typescript.JsxEmit.ReactJSX } }).outputText;
  return output.replace(/^import[^\n]*\n/gm, "").replace(/^export /gm, "");
}
function runtimeAlias(source) {
  const match = /\(0,([A-Za-z_$][\w$]*)\.jsxs\)/.exec(source);
  assert(match, "The published JSX runtime must be identified.");
  return match[1];
}
function adaptRuntime(source, alias) {
  return source.replaceAll("_jsxs(", `${alias}.jsxs(`).replaceAll("_jsx(", `${alias}.jsx(`);
}

const handlerPath = resolve(candidateDirectory, "published-handler.js");
const handlerSource = await readFile(handlerPath, "utf8");
const handlerSyntax = typescript.createSourceFile("published-handler.js", handlerSource, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
const footerFunctions = descendants(handlerSyntax, node => typescript.isFunctionDeclaration(node) && node.body && node.body.getText(handlerSyntax).length < 10000 && node.body.getText(handlerSyntax).includes("General Cell Anatomy Group") && node.body.getText(handlerSyntax).includes("institutional-footer"));
assert.equal(footerFunctions.length, 1);
const footerFunction = footerFunctions[0];
const preparedFooter = adaptRuntime(compiledExpression(footerSource.replaceAll("/brand/nih-emblem.png", emblemPath)), runtimeAlias(footerFunction.getText(handlerSyntax))).replace("function InstitutionalFooter", `function ${footerFunction.name.text}`);
const preparedHandler = handlerSource.slice(0, footerFunction.getStart(handlerSyntax)) + preparedFooter + handlerSource.slice(footerFunction.end);

const aboutSyntax = typescript.createSourceFile("about.tsx", aboutSource, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
const fundingSections = descendants(aboutSyntax, node => typescript.isJsxElement(node) && node.openingElement.tagName.getText(aboutSyntax) === "section" && node.openingElement.attributes.getText(aboutSyntax).includes('id="funding"'));
assert.equal(fundingSections.length, 1);
const preparedAcknowledgment = compiledExpression(`export const acknowledgment = (${fundingSections[0].getText(aboutSyntax)});`);
const preparedSyntax = typescript.createSourceFile("acknowledgment.js", preparedAcknowledgment, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
const acknowledgmentExpression = descendants(preparedSyntax, node => typescript.isVariableDeclaration(node) && node.name.getText(preparedSyntax) === "acknowledgment")[0].initializer.getText(preparedSyntax);
const aboutPath = resolve(candidateDirectory, "_next/static/page-EAcGZJpt.js");
const publishedAbout = await readFile(aboutPath, "utf8");
const publishedAboutSyntax = typescript.createSourceFile("published-about.js", publishedAbout, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
const supportSections = descendants(publishedAboutSyntax, node => typescript.isCallExpression(node) && node.arguments[0] && node.arguments[0].getText(publishedAboutSyntax).replaceAll("`", "").replaceAll('"', "") === "section" && node.getText(publishedAboutSyntax).includes("Affiliation & Support") && node.getText(publishedAboutSyntax).includes("The underlying work was supported"));
const directSupportSections = supportSections.filter(node => {
  const children = node.arguments[1].properties.find(property => property.name?.getText(publishedAboutSyntax) === "children");
  const firstChild = children?.initializer?.elements?.[0];
  return firstChild?.arguments?.[0]?.text === "strong" && firstChild.getText(publishedAboutSyntax).includes("Affiliation & Support");
});
assert.equal(directSupportSections.length, 1);
const supportSection = directSupportSections[0];
const preparedSupport = adaptRuntime(acknowledgmentExpression, runtimeAlias(supportSection.getText(publishedAboutSyntax)));
await writeFile(handlerPath, preparedHandler);
await writeFile(aboutPath, publishedAbout.slice(0, supportSection.getStart(publishedAboutSyntax)) + preparedSupport + publishedAbout.slice(supportSection.end));

await writeFile(resolve(candidateDirectory, "funding-baseline-handler.js"), originalHandler);
await writeFile(resolve(candidateDirectory, "index.js"), await readFile(resolve(applicationDirectory, "deployment/funding-acknowledgment-worker.js"), "utf8"));
await writeFile(resolve(candidateDirectory, "funding-acknowledgment-assets.js"), `export const stylesheet = ${JSON.stringify(stylesheet)};\nexport const assetVersion = ${JSON.stringify(assetVersion)};\nexport const emblemBase64 = ${JSON.stringify(emblem.toString("base64"))};\n`);
console.log(JSON.stringify({assetVersion, changedPublishedModules: ["index.js", "published-handler.js", "_next/static/page-EAcGZJpt.js"], retainedApplication: "dataset records, page implementations, email collector, counters, and security guards"}));
