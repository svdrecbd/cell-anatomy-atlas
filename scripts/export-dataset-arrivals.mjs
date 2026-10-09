import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const remote = process.argv.includes("--remote");
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length) || "dataset-direct-arrivals.csv");
const query = `SELECT dataset_id, arrival_date, arrivals FROM dataset_direct_arrivals
  ORDER BY arrival_date DESC, arrivals DESC, dataset_id`;
const raw = execFileSync("npx", ["wrangler", "d1", "execute", "SIGNUPS_DB", remote ? "--remote" : "--local",
  "--config", "wrangler.jsonc", "--command", query, "--json"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const rows = JSON.parse(raw).flatMap(entry => entry.results ?? []);
const lines = ["Dataset ID,Date (UTC),Direct arrivals", ...rows.map(row => `${row.dataset_id},${row.arrival_date},${row.arrivals}`)];
await writeFile(outputPath, `${lines.join("\r\n")}\r\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Exported ${rows.length} daily dataset counts to ${outputPath}.`);
