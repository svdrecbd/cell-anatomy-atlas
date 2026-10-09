import { createServer, request } from "node:http";
import { gunzipSync, gzipSync } from "node:zlib";

const port = Number(process.argv[2] ?? 3101);
const scriptsUnavailable = process.argv.includes("--omit-scripts");
const bytesPerSecond = 125000;
const latencyMilliseconds = 300;
const transfers = [];
const records = [];
const active = new Set();
let firstRequestAt;

const scheduler = setInterval(()=>{
  const ready=transfers.filter(transfer=>transfer.ready);
  if(!ready.length) return;
  const allowance=Math.max(1,Math.floor(bytesPerSecond*0.02/ready.length));
  for(const transfer of ready) {
    if(transfer.response.destroyed) { transfers.splice(transfers.indexOf(transfer),1);continue; }
    const end=Math.min(transfer.offset+allowance,transfer.body.length);
    transfer.response.write(transfer.body.subarray(transfer.offset,end));
    transfer.offset=end;
    if(end===transfer.body.length) {
      transfer.response.end();
      transfers.splice(transfers.indexOf(transfer),1);
      transfer.record.durationMilliseconds=Math.round(performance.now()-transfer.started);
      transfer.record.completedAtMilliseconds=Math.round(performance.now()-firstRequestAt);
    }
  }
},20);

const server=createServer((incoming,outgoing)=>{
  if(incoming.url==="/__network_report") {
    outgoing.setHeader("Content-Type","application/json");
    outgoing.end(JSON.stringify({bytesPerSecond,latencyMilliseconds,scriptsUnavailable,requests:records}));
    return;
  }
  const started=performance.now();
  firstRequestAt ??= started;
  const upstream=request({hostname:"127.0.0.1",port:3100,path:incoming.url,method:incoming.method,headers:{...incoming.headers,host:"127.0.0.1:3100"}},response=>{
    const chunks=[];
    response.on("data",chunk=>chunks.push(chunk));
    response.on("end",()=>{
      let body=Buffer.concat(chunks);
      const headers={...response.headers};
      delete headers["transfer-encoding"];
      delete headers["content-length"];
      const isHtml=(headers["content-type"] ?? "").includes("text/html");
      if(scriptsUnavailable && isHtml) {
        const decoded=headers["content-encoding"]==="gzip" ? gunzipSync(body) : body;
        const document=decoded.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*(?:as="script"|rel="modulepreload")[^>]*>/gi,"");
        body=gzipSync(document);
        headers["content-encoding"]="gzip";
      }
      const record={path:incoming.url,status:response.statusCode,bytes:body.length,startedAtMilliseconds:Math.round(started-firstRequestAt),durationMilliseconds:null,completedAtMilliseconds:null};
      records.push(record);
      headers["cache-control"]="no-store";
      outgoing.writeHead(response.statusCode,headers);
      const transfer={body,offset:0,response:outgoing,started,record,ready:false};
      transfers.push(transfer);
      setTimeout(()=>{transfer.ready=true;},Math.max(0,latencyMilliseconds-(performance.now()-started)));
    });
    response.on("error",()=>outgoing.destroy());
  });
  upstream.on("error",()=>{outgoing.writeHead(502);outgoing.end("Local preview unavailable.");});
  incoming.pipe(upstream);
});
server.on("connection",connection=>{active.add(connection);connection.on("close",()=>active.delete(connection));});
server.listen(port,"127.0.0.1",()=>console.log(`Local network simulation: http://127.0.0.1:${port}; 1 Mbps shared transfer rate; ${latencyMilliseconds} ms response latency${scriptsUnavailable ? "; client scripts removed" : ""}.`));
function terminate() { clearInterval(scheduler);for(const connection of active)connection.destroy();server.close(()=>process.exit(0)); }
process.on("SIGINT",terminate);
process.on("SIGTERM",terminate);
