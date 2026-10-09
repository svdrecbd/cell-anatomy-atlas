import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import typescript from "typescript";

const directory = await mkdtemp(join(tmpdir(), "cell-anatomy-mechanics-"));
let verifiedCells = 0;
try {
  await writeFile(join(directory, "package.json"), '{"type":"commonjs"}');
  for (const name of ["corpus", "organelle-terminology", "corpus-navigation"]) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
    const result = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, esModuleInterop: true } });
    await writeFile(join(directory, `${name}.js`), result.outputText);
  }
  await copyFile(new URL("../lib/corpus-data.json", import.meta.url), join(directory, "corpus-data.json"));
  const require = createRequire(import.meta.url);
  const corpus = require(join(directory,"corpus.js"));
  const navigation = require(join(directory,"corpus-navigation.js"));
  const source = JSON.parse(await readFile(new URL("../lib/corpus-data.json",import.meta.url),"utf8"));
  const included = corpus.filterDatasets();
  assert.equal(included.length,129);
  for (const record of included) assert.deepEqual(record.source_organelles,(source.find(original=>original.dataset_id===record.dataset_id).source_organelles ?? source.find(original=>original.dataset_id===record.dataset_id).organelles));
  assert.deepEqual(corpus.filterDatasets({organelle:"mito"}).map(record=>record.dataset_id),corpus.filterDatasets({organelle:"mitochondria"}).map(record=>record.dataset_id));
  assert.ok(corpus.filterDatasets({query:"nucleus FIB-SEM"}).length>0);
  assert.ok(corpus.filterDatasets({query:"endoplasmic reticulum"}).length>0);
  assert.equal(corpus.filterDatasets({cell_type:"Schizosaccharomyces pombe",sample_size_bucket:"1"}).length,1);
  const associations = corpus.measurementGrammar();
  assert.equal(associations.organelle_totals.nucleus,included.filter(record=>record.organelles.includes("nucleus")).length);
  assert.ok(associations.organelle_totals.nucleus<=included.length);
  for (const filters of [{},{query:"HeLa"},{organelle:"er"},{organelle:"er,nucleus"},{metric:"volume"},{public:"true"}]) {
    for (const row of ["organelle","cell_type","modality","comparator_class"]) for (const column of ["modality_family","public_data_status","sample_size_bucket"]) {
      const table = corpus.crossTab(row,column,filters);
      for (const rowValue of table.rows) for (const columnValue of table.cols) {
        const count = table.table[rowValue]?.[columnValue] ?? 0;
        if(!count) continue;
        const key = column === "modality_family" ? "family" : column === "public_data_status" ? "status" : column;
        const url = new URL(navigation.intersectCorpusHref(filters,{[row]:rowValue,[key]:columnValue}),"https://cellanatomy.org");
        assert.equal(corpus.filterDatasets(Object.fromEntries(url.searchParams)).length,count,`${row}/${column}: ${url.search}`);
        verifiedCells++;
      }
    }
    const statistics = corpus.benchmarks(filters);
    assert.equal(statistics.reduce((total,family)=>total+family.count,0),corpus.filterDatasets(filters).length);
  }
  for(const family of corpus.benchmarks()) {
    const values = included.filter(record=>record.modality_family===family.modality_family && record.lateral_resolution_nm!=null).map(record=>record.lateral_resolution_nm).sort((left,right)=>left-right);
    const middle=Math.floor(values.length/2);
    assert.equal(family.resolution_stats.median,values.length%2 ? values[middle] : (values[middle-1]+values[middle])/2);
  }
  const scoped = corpus.experimentPlan({organelles:"nucleus",scope:"/corpus?query=HeLa"});
  assert.equal(scoped.precedents.length,1);
  assert.equal(scoped.precedents[0].cell_type,"HeLa");
  const comparison = corpus.compareDatasets(["zheng-2012-054","jiang-2010-052"]);
  assert.equal(comparison.shared_fields.comparator_classes.length,0);
  const all = corpus.experimentPlan({organelles:"nucleus,er"});
  const any = corpus.experimentPlan({organelles:"nucleus,er",match:"any"});
  assert.ok(all.precedents.every(record=>record.organelles.includes("nucleus") && record.organelles.includes("er")));
  assert.ok(any.precedents.length>all.precedents.length);
  const strict = corpus.experimentPlan({organelles:"nucleus,er",res:10,ss:100});
  assert.ok(strict.precedents.every(record=>record.lateral_resolution_nm!=null && record.lateral_resolution_nm<=10 && record.sample_size>=100));
  const tolerant = corpus.experimentPlan({organelles:"nucleus,er",res:10,ss:100,resolution_factor:1.5,sample_fraction:0.5});
  assert.ok(tolerant.precedents.length>strict.precedents.length);
  assert.ok(tolerant.precedents.every(record=>record.lateral_resolution_nm<=15 && record.sample_size>=50));
  const absent = corpus.experimentPlan({organelles:"nucleus",res:0.001,ss:10000});
  assert.equal(absent.precedents.length,0);
  assert.ok(absent.related_precedents.length>0);
  assert.equal(absent.status,"no_threshold_matches");
  assert.equal(absent.suggested_baselines.length,0);
  assert.equal(strict.threshold_studies_count,new Set(strict.precedents.map(record=>record.source_study_id ?? record.dataset_id)).size);
  assert.throws(()=>corpus.experimentPlan({organelles:"nucleus",res:-1}));
  assert.throws(()=>corpus.experimentPlan({organelles:"nucleus",resolution_factor:0}));
  const timeline=corpus.corpusTimeline();
  assert.equal(timeline.years.length,22);
  assert.ok(timeline.years.includes(2005) && timeline.years.includes(2006));
  assert.equal(navigation.corpusReturnHref("//example.org"),"/corpus");
  assert.equal(navigation.corpusReturnHref("/corpus?query=HeLa&view=cards"),"/corpus?query=HeLa&view=cards");
  if(process.argv[2]) {
    const base=process.argv[2];
    const cases=["/api/datasets/export?cell_type=Schizosaccharomyces+pombe&sample_size_bucket=1&format=json","/api/datasets/export?organelle=mito&format=json","/api/datasets/export?organelle=er%2Cnucleus&format=json"];
    for(const path of cases) {
      const response=await fetch(new URL(path,base));
      assert.equal(response.status,200);
      const exported=await response.json();
      const expected=corpus.filterDatasets(Object.fromEntries(new URL(path,base).searchParams));
      assert.deepEqual(exported.map(record=>record.dataset_id),expected.map(record=>record.dataset_id));
      assert.equal(Number(response.headers.get("x-scion-export-count")),expected.length);
    }
    for(const parameters of [{organelles:"nucleus",scope:"/corpus?query=HeLa"},{organelles:"nucleus,er",res:"10",ss:"100"},{organelles:"nucleus,er",res:"10",ss:"100",resolution_factor:"1.5",sample_fraction:"0.5"},{organelles:"nucleus",res:"0.001",ss:"10000"}]) {
      const response=await fetch(new URL(`/api/datasets/analytics/plan/export?${new URLSearchParams(parameters)}`,base));
      assert.equal(response.status,200);
      assert.equal(Number(response.headers.get("x-scion-export-count")),corpus.experimentPlan(parameters).precedents.length);
    }
    const invalid=await fetch(new URL("/api/datasets/analytics/plan/export?organelles=nucleus&res=-1",base));
    assert.equal(invalid.status,400);
  }
  console.log(`Verified ${verifiedCells} populated coverage cells against exact corpus results; source terminology, distinct counts, medians, scoped statistics, planner rules, missing fields, annual spacing, and return navigation${process.argv[2] ? "; HTTP exports and invalid-input handling" : ""}.`);
} finally { await rm(directory,{recursive:true,force:true}); }
