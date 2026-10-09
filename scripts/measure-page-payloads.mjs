import { request } from "node:http";
import { gunzipSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

const origin = process.argv[2] ?? "http://127.0.0.1:3100";
const output = process.argv[3];
const requests = new Map();
async function resource(path) {
  if (requests.has(path)) return requests.get(path);
  const pending = new Promise((resolve,reject) => {
    const started = performance.now();
    const transfer = request(new URL(path,origin),{headers:{"Accept-Encoding":"gzip"}},response=>{
      const chunks=[];
      response.on("data",chunk=>chunks.push(chunk));
      response.on("end",()=>{
        const body=Buffer.concat(chunks);
        const decoded=response.headers["content-encoding"] === "gzip" ? gunzipSync(body) : body;
        resolve({path,status:response.statusCode,transferBytes:body.length,decodedBytes:decoded.length,encoding:response.headers["content-encoding"] ?? "identity",cacheControl:response.headers["cache-control"] ?? "",localResponseMilliseconds:Number((performance.now()-started).toFixed(1)),body:decoded.toString()});
      });
      response.on("error",reject);
    });
    transfer.on("error",reject);
    transfer.end();
  });
  requests.set(path,pending);
  return pending;
}
const pages=[];
for(const path of ["/","/corpus","/corpus?view=cards","/analytics","/plan","/plan?organelles=nucleus","/compare?ids=zheng-2012-054,jiang-2010-052","/datasets/deshmukh-2024-092"]) {
  const document=await resource(path);
  const scripts=[...document.body.matchAll(/<script\b([^>]*)>/g)].filter(match=>!match[1].includes("noModule") && !match[1].includes("nomodule")).map(match=>match[1].match(/\bsrc="([^"]+)"/)?.[1]).filter(Boolean);
  const styles=[...document.body.matchAll(/<link\b([^>]*)>/g)].filter(match=>/rel="stylesheet"/.test(match[1])).map(match=>match[1].match(/\bhref="([^"]+)"/)?.[1]).filter(Boolean);
  const images=[...document.body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
  const paths=[...new Set([...scripts,...styles,...images].map(value=>value.replaceAll("&amp;","&")))];
  const assets=await Promise.all(paths.map(resource));
  const summarize=value=>{const {body,...result}=value;return result;};
  pages.push({path,document:summarize(document),javascriptTransferBytes:assets.filter(value=>scripts.includes(value.path)).reduce((sum,value)=>sum+value.transferBytes,0),stylesheetTransferBytes:assets.filter(value=>styles.includes(value.path)).reduce((sum,value)=>sum+value.transferBytes,0),coldTransferBytes:document.transferBytes+assets.reduce((sum,value)=>sum+value.transferBytes,0),requestCount:1+assets.length,externalAssetUrls:paths.filter(value=>/^https?:/.test(value)),assets:assets.map(summarize)});
}
const report={date:new Date().toISOString(),origin,measurement:"Compressed HTTP response-body bytes for a cold page and its directly declared assets; excludes automatic prefetch, response headers, TLS overhead, and browser execution time.",pages};
if(output) await writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(pages.map(({path,document,javascriptTransferBytes,stylesheetTransferBytes,coldTransferBytes,requestCount,externalAssetUrls})=>({path,htmlKiB:Number((document.transferBytes/1024).toFixed(1)),javascriptKiB:Number((javascriptTransferBytes/1024).toFixed(1)),cssKiB:Number((stylesheetTransferBytes/1024).toFixed(1)),coldKiB:Number((coldTransferBytes/1024).toFixed(1)),requests:requestCount,externalAssets:externalAssetUrls.length})),null,2));
