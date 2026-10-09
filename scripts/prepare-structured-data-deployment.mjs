import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import typescript from "typescript";

// Apply server-component metadata to an already reviewed production bundle.
// Preserve assets and application behavior; fail if its structure has changed.
const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert(process.argv[2], "Supply a copy of the current production module directory.");
const candidateDirectory = resolve(process.argv[2]);
const layoutPath = resolve(candidateDirectory, "published-handler.js");
const datasetPath = resolve(candidateDirectory, "_next/static/page-C6YAUW5B.js");

function property(object, name, sourceFile) {
  return object.properties.find(entry => typescript.isPropertyAssignment(entry) && entry.name.getText(sourceFile).replaceAll('"', "") === name);
}

function callsWithProperty(sourceFile, name, value) {
  const calls = [];
  function visit(node) {
    if (typescript.isCallExpression(node) && node.arguments[1] && typescript.isObjectLiteralExpression(node.arguments[1])) {
      const entry = property(node.arguments[1], name, sourceFile);
      if (entry && entry.initializer.getText(sourceFile) === value) calls.push(node);
    }
    typescript.forEachChild(node, visit);
  }
  visit(sourceFile);
  return calls;
}

function prependArrayElement(source, sourceFile, array, element) {
  assert(typescript.isArrayLiteralExpression(array));
  const offset = array.getStart(sourceFile) + 1;
  return source.slice(0, offset) + element + "," + source.slice(offset);
}

const layoutSource = await readFile(layoutPath, "utf8");
assert(!layoutSource.includes("cell-anatomy-site-metadata"), "The site metadata is already present.");
const layoutFile = typescript.createSourceFile("layout.js", layoutSource, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
const layouts = callsWithProperty(layoutFile, "data-scroll-behavior", "`smooth`");
assert.equal(layouts.length, 1);
const body = property(layouts[0].arguments[1], "children", layoutFile).initializer;
const provider = property(body.arguments[1], "children", layoutFile).initializer;
const providerChildren = property(provider.arguments[1], "children", layoutFile).initializer;
const siteScript = '(0,X.jsx)(`script`,{id:`cell-anatomy-site-metadata`,type:`application/ld+json`,dangerouslySetInnerHTML:{__html:serializeStructuredData(createSiteStructuredData())}})';
const googleVerification = 'verification:{google:`eMHiPguPkoTDf5I4WqAB-R4SZK-8V4_BIlV4FHarj2A`}';
assert.equal(layoutSource.split(googleVerification).length, 2);
const updatedLayout = ('import {createSiteStructuredData,serializeStructuredData} from "./metadata/structured-data.js";\n' + prependArrayElement(layoutSource, layoutFile, providerChildren, siteScript)).replace(googleVerification, 'verification:{google:`eMHiPguPkoTDf5I4WqAB-R4SZK-8V4_BIlV4FHarj2A`,other:{"msvalidate.01":"3BDAA3C770AEDE825F71A33CCB4003CC"}}');

const datasetSource = await readFile(datasetPath, "utf8");
assert(!datasetSource.includes("cell-anatomy-dataset-metadata"), "The dataset metadata is already present.");
const datasetFile = typescript.createSourceFile("dataset.js", datasetSource, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
const recordPages = callsWithProperty(datasetFile, "className", "`dataset-document`");
assert.equal(recordPages.length, 2);
const recordChildren = property(recordPages[1].arguments[1], "children", datasetFile).initializer;
assert(recordChildren.getText(datasetFile).includes("T.title"));
const datasetScript = '(0,x.jsx)(`script`,{id:`cell-anatomy-dataset-metadata`,type:`application/ld+json`,dangerouslySetInnerHTML:{__html:serializeStructuredData(createDatasetStructuredData(T))}})';
const updatedDataset = 'import {createDatasetStructuredData,serializeStructuredData} from "../../metadata/structured-data.js";\n' + prependArrayElement(datasetSource, datasetFile, recordChildren, datasetScript);

const metadataSource = await readFile(resolve(applicationDirectory, "lib/structured-data.ts"), "utf8");
const metadataModule = typescript.transpileModule(metadataSource, {
  compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022 }
}).outputText;
await mkdir(resolve(candidateDirectory, "metadata"), { recursive: true });
await writeFile(resolve(candidateDirectory, "metadata/structured-data.js"), metadataModule);
await writeFile(layoutPath, updatedLayout);
await writeFile(datasetPath, updatedDataset);
console.log(JSON.stringify({ changedModules: [layoutPath, datasetPath].map(path => relative(candidateDirectory, path)), addedModules: ["metadata/structured-data.js"] }));
