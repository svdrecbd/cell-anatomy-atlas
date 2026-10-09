"use client";

import Link from "next/link";
import { useState } from "react";
import { useChartWidth } from "../lib/use-chart-width";
import { corpusHref, datasetHref } from "../lib/corpus-navigation";

type DataPoint = { id: string; title: string; res: number; ss: number; modality: string };
type TimelineData = { matrix: Record<number,Record<string,number>>; years: number[]; modality_families: string[]; year_totals: Record<number,number>; public_counts: Record<number,number> };
type Props = { data: DataPoint[]; timeline?: TimelineData | null; parameters: Record<string,string | undefined>; totalRecords: number; returnHref: string };
const familyColors: Record<string,string> = { EM:"var(--atlas-blue)", "X-ray":"var(--atlas-green)", optical:"var(--atlas-orange)" };
const familyNames: Record<string,string> = { EM:"Electron microscopy", "X-ray":"X-ray microscopy", optical:"Optical microscopy" };

export function FrontierPlot({data,timeline,parameters,totalRecords,returnHref}: Props) {
  const {chartContainerRef,chartWidth} = useChartWidth();
  const [selectedRecords,setSelectedRecords] = useState<DataPoint[]>([]);
  const mode = ["records","public"].includes(parameters.chart ?? "") ? parameters.chart! : "frontier";
  const width = chartWidth;
  const height = 400;
  const margin = {left:70,right:25,top:25,bottom:60};
  const plotWidth = width-margin.left-margin.right;
  const plotHeight = height-margin.top-margin.bottom;
  const bottom = height-margin.bottom;
  const minimumX = Math.pow(10,Math.floor(Math.log10(Math.min(...data.map(point=>point.res),1))));
  const maximumX = Math.pow(10,Math.ceil(Math.log10(Math.max(...data.map(point=>point.res),10))));
  const maximumY = Math.pow(10,Math.ceil(Math.log10(Math.max(...data.map(point=>point.ss),10))));
  const coordinateX = (value:number) => Number((margin.left + (Math.log10(value)-Math.log10(minimumX))/(Math.log10(maximumX)-Math.log10(minimumX))*plotWidth).toFixed(3));
  const coordinateY = (value:number) => Number((bottom-Math.log10(value)/Math.log10(maximumY)*plotHeight).toFixed(3));
  const ticksX = Array.from({length:Math.round(Math.log10(maximumX)-Math.log10(minimumX))+1},(_,index)=>minimumX*10**index);
  const ticksY = Array.from({length:Math.round(Math.log10(maximumY))+1},(_,index)=>10**index);
  const groups = new Map<string,DataPoint[]>();
  for (const point of data) { const key = `${point.res}:${point.ss}`; groups.set(key,[...(groups.get(key) ?? []),point]); }
  const yearMaximum = Math.ceil(Math.max(1,...(timeline?.years ?? []).map(year=>timeline?.year_totals[year] ?? 0))/4)*4;
  const yearStep = plotWidth/Math.max(1,timeline?.years.length ?? 0);
  const barWidth = Math.min(32,yearStep*0.66);
  const chartHref = (chart:string) => {
    const values = new URLSearchParams(corpusHref(parameters,{},"/analytics").split("?")[1]);
    for (const key of ["row","col","rows"]) if(parameters[key]) values.set(key,parameters[key]!);
    values.set("chart",chart);
    return `/analytics?${values.toString()}#technical-precedent`;
  };
  return <div className="frontier-plot">
    <nav className="record-view-navigation plot-modes" aria-label="Technical evidence view">{[["frontier","Voxel size and cell count"],["records","Records by year"],["public","Public-data share by year"]].map(([value,label])=><Link prefetch={false} key={value} href={chartHref(value)} aria-current={mode===value ? "page" : undefined}>{label}</Link>)}</nav>
    <p className="field-description">{mode==="frontier" ? `${data.length} of ${totalRecords} records have positive reported XY voxel size and cell count. Select a point to inspect every record at that position. Both axes use logarithmic scales.` : mode==="records" ? "Publication-year counts within this scope. Years without indexed records retain their place on the time axis." : "Share of records with known public-data locators, grouped by publication year. This describes the current index, rather than historical availability at publication."}</p>
    {mode==="frontier" && data.length===0 ? <p>No records in this scope have both numeric fields.</p> : <>
      <div ref={chartContainerRef} className="mechanics-chart-scroll" tabIndex={0} role="region" aria-label="Technical evidence chart">
        <svg viewBox={`0 0 ${width} ${height}`} className="mechanics-chart" role="group" aria-label={mode==="frontier" ? "Lateral voxel size versus whole-cell count" : mode==="records" ? "Annual indexed records" : "Annual share of records with public-data locators"}>
          <line x1={margin.left} y1={bottom} x2={width-margin.right} y2={bottom} stroke="var(--rule-strong)" />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={bottom} stroke="var(--rule-strong)" />
          {mode==="frontier" ? <>
            {ticksX.map(value=><g key={value}><line x1={coordinateX(value)} y1={margin.top} x2={coordinateX(value)} y2={bottom} stroke="var(--rule-faint)" /><text x={coordinateX(value)} y={bottom+24} textAnchor="middle">{value}</text></g>)}
            {ticksY.map(value=><g key={value}><line x1={margin.left} y1={coordinateY(value)} x2={width-margin.right} y2={coordinateY(value)} stroke="var(--rule-faint)" /><text x={margin.left-12} y={coordinateY(value)+4} textAnchor="end">{value}</text></g>)}
            {[...groups.values()].map(group=>{const point=group[0];const families=[...new Set(group.map(record=>record.modality))];return <g key={`${point.res}:${point.ss}`} role="button" tabIndex={0} aria-label={`${group.length} ${group.length===1 ? "record" : "records"}: ${point.res} nm, ${point.ss} cells`} onClick={()=>setSelectedRecords(group)} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();setSelectedRecords(group);}}} className="evidence-point"><title>{`${group.length} ${group.length === 1 ? "record" : "records"} · ${point.res} nm · ${point.ss} cells`}</title><circle cx={coordinateX(point.res)} cy={coordinateY(point.ss)} r={group.length>1 ? 7 : 5} fill={families.length===1 ? familyColors[families[0]] : "#56504a"} stroke="white" strokeWidth={1} /></g>;})}
          </> : <>
            {[0,0.25,0.5,0.75,1].map(fraction=><g key={fraction}><line x1={margin.left} y1={bottom-fraction*plotHeight} x2={width-margin.right} y2={bottom-fraction*plotHeight} stroke="var(--rule-faint)" /><text x={margin.left-12} y={bottom-fraction*plotHeight+4} textAnchor="end">{mode==="public" ? `${fraction*100}%` : fraction*yearMaximum}</text></g>)}
            {timeline?.years.map((year,index)=>{const x=margin.left+index*yearStep+(yearStep-barWidth)/2;const count=timeline.year_totals[year] ?? 0;let cursor=bottom;return <g key={year}>
              {mode==="public" ? (count>0 ? <a href={corpusHref(parameters,{year:String(year),public:"true",status:null})} aria-label={`${year}: ${timeline.public_counts[year] ?? 0} of ${count} records with public data`}><title>{`${year}: ${timeline.public_counts[year] ?? 0} / ${count}`}</title>{(timeline.public_counts[year] ?? 0)>0 ? <rect x={x} y={bottom-(timeline.public_counts[year] ?? 0)/count*plotHeight} width={barWidth} height={(timeline.public_counts[year] ?? 0)/count*plotHeight} fill="var(--atlas-blue)" /> : <text x={x+barWidth/2} y={bottom-6} textAnchor="middle">0</text>}</a> : <text x={x+barWidth/2} y={bottom-6} textAnchor="middle">—</text>) : timeline.modality_families.map(family=>{const number=timeline.matrix[year]?.[family] ?? 0; const barHeight=number/yearMaximum*plotHeight;cursor-=barHeight;return number ? <a key={family} href={corpusHref(parameters,{year:String(year),family})} aria-label={`${year}: ${number} ${familyNames[family] ?? family} records`}><title>{`${year}: ${number} ${family}`}</title><rect x={x} y={cursor} width={barWidth} height={barHeight} fill={familyColors[family]} /></a> : null;})}
              {(index%Math.max(1,Math.ceil(timeline.years.length/10))===0 || index===timeline.years.length-1) ? <text x={x+barWidth/2} y={bottom+24} textAnchor="middle">{year}</text> : null}
            </g>;})}
          </>}
          <text x={width/2} y={height-12} textAnchor="middle">{mode==="frontier" ? "Lateral voxel size (nm, log scale)" : "Publication year"}</text>
          <text x={18} y={height/2} transform={`rotate(-90,18,${height/2})`} textAnchor="middle">{mode==="frontier" ? "Whole-cell count (log scale)" : mode==="records" ? "Indexed records" : "Records with locators"}</text>
        </svg>
      </div>
      <div className="evidence-legend">{(mode==="public" ? ["Public-data locators"] : mode==="records" ? timeline?.modality_families ?? [] : [...new Set(data.map(point=>point.modality))]).map(family=><span key={family}><i style={{background:familyColors[family] ?? "var(--atlas-blue)"}} />{familyNames[family] ?? family}</span>)}{mode==="frontier" ? <span><i style={{background:"#56504a"}} />Larger marks contain multiple records; gray combines families.</span> : null}</div>
      {mode==="frontier" && selectedRecords.length>0 ? <section className="selected-evidence" aria-live="polite"><h3>{selectedRecords.length} {selectedRecords.length===1 ? "record" : "records"} at {selectedRecords[0].res} nm · {selectedRecords[0].ss} cells</h3><ul>{selectedRecords.map(record=><li key={record.id}><Link prefetch={false} href={datasetHref(record.id,returnHref)}>{record.title}</Link></li>)}</ul></section> : null}
    </>}
    {mode==="frontier" ? <details className="document-disclosure"><summary>Browse all {data.length} plotted records</summary><div className="analytics-table-wrap"><table className="analytics-matrix"><thead><tr><th>Record</th><th>XY voxel size (nm)</th><th>Whole-cell count</th></tr></thead><tbody>{data.map(record=><tr key={record.id}><td><Link prefetch={false} href={datasetHref(record.id,returnHref)}>{record.title}</Link></td><td>{record.res}</td><td>{record.ss}</td></tr>)}</tbody></table></div></details> : null}
  </div>;
}
