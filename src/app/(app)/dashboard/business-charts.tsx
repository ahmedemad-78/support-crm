"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { AGE_BINS, MISSING, caseAge, completeHistory, daysWithoutUpdate, field, histogram, lifecycle, ranking, ratioRows, stability, timeBuckets, type BusinessFilters, type BusinessTicket, type Dimension, type Rank } from "@/lib/tickets/business-analytics";

export function Count({value}:{value:number}){
 const [shown,setShown]=useState(value);const current=useRef(value);
 useEffect(()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){current.current=value;return;}const from=current.current;if(from===value)return;const start=performance.now();let frame=0;const tick=(now:number)=>{const p=Math.min(1,(now-start)/280);current.current=from+(value-from)*(1-Math.pow(1-p,3));setShown(Math.round(current.current));if(p<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[value]);
 return <span aria-label={value.toLocaleString()}><span aria-hidden="true">{typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?value.toLocaleString():shown.toLocaleString()}</span></span>;
}
type ChartType="line"|"columns"|"rank"|"dots"|"stack"|"waffle"|"matrix"|"pareto"|"ratio"|"coverage";
export type ChartSpec={id:string;title:string;type:ChartType;key?:Dimension;matrix?:[Dimension,Dimension];scope?:"open"|"resolved"|"history";mode?:"arrivals"|"flow"|"reopened"|"backlog";note:string};
export const OVERVIEW:ChartSpec[]=[
 {id:"arrivals",title:"Case arrivals",type:"line",mode:"arrivals",note:"Unique cases by the selected date basis."},
 {id:"status",title:"Current case status",type:"stack",key:"status",note:"Current status of the selected arrivals. Closed without response is separate from resolved."},
 {id:"sources",title:"Where cases come from",type:"dots",key:"source",note:"Reported sources, including archived sources and missing records."},
 {id:"topics",title:"Most reported problems",type:"dots",key:"topic",note:"Tracker topics. Missing classification remains explicit."},
];
export const OPERATIONS:ChartSpec[]=[
 {id:"age",title:"Open case age",type:"columns",scope:"open",note:"Calendar days since reported date, not an SLA."},
 {id:"assignment",title:"Work assigned to Support",type:"dots",key:"assignee",scope:"open",note:"Individual Support assignee; Unassigned is shown separately."},
 {id:"inactivity",title:"Time without an update",type:"columns",scope:"open",note:"Elapsed days since the last recorded case activity, not case age."},
 {id:"open-source",title:"Open workload by source",type:"rank",key:"source",scope:"open",note:"Open work across all reported dates, within the other filters."},
];
export const TRACKER:ChartSpec[]=[
 {id:"request",title:"Request types",type:"waffle",key:"requestType",note:"Share of selected cases by the kind of work recorded in the tracker."},
 {id:"causes",title:"Root cause concentration",type:"pareto",key:"trackerCause",note:"Bars: case count. Line: cumulative share of recorded causes. Missing causes are excluded from the line."},
 {id:"actions",title:"Actions taken",type:"rank",key:"trackerAction",note:"Current recorded action, including cases with no action recorded."},
 {id:"outcomes",title:"Results of resolved cases",type:"stack",key:"outcome",scope:"resolved",note:"Recorded result of handling a case. Outcome and current status are different fields."},
 {id:"topic-cause",title:"Problem topic × root cause",type:"matrix",matrix:["topic","trackerCause"],note:"Which recorded causes sit behind each problem area? Shading compares case counts on one shared scale."},
 {id:"reopen-topic",title:"Reopening by problem topic",type:"ratio",key:"topic",note:"Unique reopened cases / all cases in each topic. Count and rate stay together, including small samples."},
];
export const RELATIONS:ChartSpec[]=[
 {id:"source-topic",title:"Source × problem topic",type:"matrix",matrix:["source","topic"],note:"What kinds of problems each source reports."},
 {id:"source-request",title:"Source × request type",type:"matrix",matrix:["source","requestType"],note:"The mix of demand reported by each source."},
 {id:"cause-action",title:"Root cause × action",type:"matrix",matrix:["trackerCause","trackerAction"],note:"Actions recorded for each cause. Association does not establish effectiveness."},
 {id:"action-outcome",title:"Action × outcome",type:"matrix",matrix:["trackerAction","outcome"],scope:"resolved",note:"Recorded results associated with each action in currently resolved cases."},
 {id:"source-outcome",title:"Source × outcome",type:"matrix",matrix:["source","outcome"],scope:"resolved",note:"Current recorded outcomes by referring source."},
];
export const QUALITY:ChartSpec[]=[
 {id:"reopen-cause",title:"Reopening by root cause",type:"ratio",key:"trackerCause",note:"Reopened / all cases by current cause. Closure-time attribution requires resolution snapshots."},
 {id:"closure",title:"Classification in resolved cases",type:"stack",scope:"resolved",note:"Current completeness of all five tracker fields in resolved cases; historical fields are not inferred."},
 {id:"coverage",title:"Tracker field coverage",type:"coverage",note:"Recorded count / all selected cases, independently for each field."},
 {id:"stability",title:"Solution stability after 14 days",type:"stack",scope:"history",note:"Native cases with a known first resolution and a complete 14-day observation window. This is not an SLA."},
 {id:"reopen-action",title:"Reopening by recorded action",type:"ratio",key:"trackerAction",note:"Current classification, not proof that an action caused a reopening. Count and rate use the same cohort."},
 {id:"reopen-trend",title:"Reopening over time",type:"line",scope:"history",mode:"reopened",note:"Reopen events by their actual event dates. One case may be reopened multiple times."},
];
export const TIMING:ChartSpec[]=[
 {id:"flow",title:"Arrivals versus recorded solutions",type:"line",scope:"history",mode:"flow",note:"Solid: created cases. Dashed: solution events, each using its own date. Repeated resolutions count as events."},
 {id:"first-reply",title:"Time to first public Support reply",type:"columns",scope:"history",note:"Elapsed calendar hours from creation to first public human Support comment or resolution. Pending and unknown replies are excluded."},
 {id:"resolution-time",title:"Time to first resolution",type:"columns",scope:"history",note:"Elapsed calendar hours to first recorded solution; includes eligible cases later reopened."},
 {id:"backlog",title:"Historical open workload",type:"line",scope:"history",mode:"backlog",note:"Period-end states reconstructed only for cases with a known start and a complete workflow history."},
];
const TRACKER_KEYS:Dimension[]=["requestType","topic","trackerCause","trackerAction","outcome"];
const TRACKER_LABELS=["Request type","Topic","Cause","Action","Outcome"];
const PALETTE=["#286b50","#668ca2","#b18a48","#8e9d98","#bac4ca","#d7dde0","#9eb9ab","#9da6ba"];
function color(id:string,index:number){return ({resolved:PALETTE[0],new:PALETTE[1],in_progress:PALETTE[3],awaiting_customer:PALETTE[2],closed:PALETTE[4],[MISSING]:PALETTE[5]})[id]||PALETTE[index%PALETTE.length];}
const members=(ticket:BusinessTicket,key:Dimension,row:Rank)=>row.members?row.members.includes(field(ticket,key)):field(ticket,key)===row.id;
type Props={spec:ChartSpec;tickets:BusinessTicket[];base:BusinessTicket[];filters:BusinessFilters;asOf:string;sources:Map<string,string>;onPick:(key:Dimension,value:string,second?:[Dimension,string])=>void};
export function BusinessChart({spec,tickets,base,filters,asOf,sources,onPick}:Props){
 let selected=spec.scope==="open"?base.filter(t=>["new","in_progress","awaiting_customer"].includes(t.status)):spec.scope==="history"&&spec.mode?base:tickets;
 if(spec.scope==="resolved")selected=selected.filter(t=>t.status==="resolved");
 const eligible=spec.scope==="history"?selected.filter(t=>completeHistory(t,asOf)):selected;
 const sample=spec.scope==="history"?eligible:selected;
 const allFields=(t:BusinessTicket)=>TRACKER_KEYS.every(k=>field(t,k)!==MISSING);
 let ranks:Rank[]=spec.key?ranking(sample,spec.key,sources,spec.key==="source"?10:6):[];
 let denominator=sample.length;
 if(spec.id==="age")ranks=histogram(sample,t=>caseAge(t,asOf),AGE_BINS);
 if(spec.id==="inactivity")ranks=histogram(sample,t=>daysWithoutUpdate(t,asOf),AGE_BINS);
 if(spec.id==="coverage")ranks=TRACKER_KEYS.map((key,i)=>({id:key,name:TRACKER_LABELS[i],count:sample.filter(t=>field(t,key)!==MISSING).length}));
 if(spec.id==="closure")ranks=[{id:"complete",name:"All five fields recorded",count:sample.filter(allFields).length},{id:MISSING,name:"One or more fields missing",count:sample.filter(t=>!allFields(t)).length}];
 if(spec.id==="stability"){const s=stability(selected,asOf);denominator=s.eligible;ranks=[{id:"stable",name:"No reopening within 14 days",count:s.stable},{id:"reopened",name:"Reopened within 14 days",count:s.reopened}];}
 if(["first-reply","resolution-time"].includes(spec.id)){const key=spec.id==="first-reply"?"replyHours":"resolutionHours";const measured=sample.filter(t=>lifecycle(t,asOf)[key]!==null);denominator=measured.length;ranks=histogram(measured,t=>lifecycle(t,asOf)[key],[{id:"0",name:"≤4h",min:0,max:4.0000001},{id:"1",name:"4–24h",min:4.0000001,max:24.0000001},{id:"2",name:"1–3d",min:24.0000001,max:72.0000001},{id:"3",name:"3–7d",min:72.0000001,max:168.0000001},{id:"4",name:">7d",min:168.0000001,max:Infinity}]);}
 const buckets=spec.mode?timeBuckets(spec.mode==="arrivals"?tickets:base,filters,asOf,spec.mode):[];
 const values=spec.mode?buckets:ranks;
 const canPick=spec.key?(row:Rank)=>{if(!row.members)onPick(spec.key!,row.id);}:undefined;
 const missing=spec.type==="pareto"?ranks.find(r=>r.id===MISSING)?.count||0:0;
 const recorded=spec.type==="pareto"?ranks.filter(r=>r.id!==MISSING):ranks;
 const eligibleText=spec.scope==="history"?`${denominator} eligible / ${selected.length} cases`:`${denominator.toLocaleString()} cases`;
 return <article className="bia-card" data-chart={spec.id} style={{viewTransitionName:`bia-chart-${spec.id}`} as CSSProperties}>
  <header><h3>{spec.title}</h3><span>{eligibleText}</span></header>
  {!denominator?<div className="bia-chart-empty">{spec.scope==="history"?"Not enough complete history for this measurement.":"No cases in this selection."}</div>:
   spec.type==="matrix"?<Matrix tickets={sample} keys={spec.matrix!} sources={sources} onPick={onPick}/>:
   spec.type==="line"||spec.type==="columns"||spec.type==="pareto"?<Series rows={spec.type==="pareto"?recorded:values} columns={spec.type!=="line"} pareto={spec.type==="pareto"} denominator={denominator-missing} onPick={canPick} />:
   spec.type==="stack"||spec.type==="waffle"?<Shares rows={ranks} waffle={spec.type==="waffle"} denominator={denominator} onPick={canPick}/>:
   spec.type==="ratio"?<div className="bia-ranks">{ratioRows(sample,spec.key!,sources).map(row=><RankItem key={row.id} row={row} width={row.ratio*100} display={`${row.reopened}/${row.count} · ${Math.round(row.ratio*100)}%`} onPick={canPick}/>)}</div>:
   <div className={`bia-ranks ${spec.type==="dots"?"is-dots":""}`}>{ranks.map(row=><RankItem key={row.id} row={row} width={row.count/Math.max(1,spec.type==="coverage"?denominator:Math.max(...ranks.map(r=>r.count)))*100} display={spec.type==="coverage"?`${row.count}/${denominator}`:undefined} onPick={canPick}/>)}</div>}
  {spec.type==="pareto"&&denominator>0&&<div className="bia-pareto-key">{recorded.map((r,i)=><span key={r.id}>{i+1}. {r.name} <b>{r.count}</b></span>)}<span>Not recorded <b>{missing}</b></span></div>}
  {spec.id==="flow"&&denominator>0&&<div className="bia-line-key"><span>— Created cases</span><span>┄ Solution events</span></div>}
  <footer>{spec.type==="pareto"?`${denominator-missing} recorded causes / ${denominator} cases. `:""}{spec.note}</footer>
 </article>;
}
function RankItem({row,width,display,onPick}:{row:Rank;width:number;display?:string;onPick?:((row:Rank)=>void)}){
 const content=<><span className="bia-rank-name" title={row.name}>{row.name}</span><span className="bia-track"><i style={{width:`${width}%`}}/></span><strong>{display||<Count value={row.count}/>}</strong></>;
 return onPick&&!row.members?<button type="button" className="bia-rank" onClick={()=>onPick(row)} aria-label={`${row.name}: ${display||row.count} cases. Filter this value.`}>{content}</button>:<div className="bia-rank">{content}</div>;
}
function Shares({rows,waffle,denominator,onPick}:{rows:Rank[];waffle:boolean;denominator:number;onPick?:((row:Rank)=>void)}){
 const cells=rows.map(r=>r.count/Math.max(1,denominator)*100);const floors=cells.map(Math.floor);let remaining=100-floors.reduce((n,v)=>n+v,0);const order=cells.map((v,i)=>({i,frac:v-floors[i]})).sort((a,b)=>b.frac-a.frac);for(const item of order){if(remaining--<=0)break;floors[item.i]++;}
 return <div className="bia-share-chart">{waffle?<div className="bia-waffle" role="img" aria-label={rows.map(r=>`${r.name}: ${r.count}`).join(", ")}>{rows.flatMap((r,i)=>Array.from({length:floors[i]},(_,j)=><i key={`${r.id}-${j}`} style={{background:color(r.id,i)}}/>))}</div>:<div className="bia-stack" role="img" aria-label={rows.map(r=>`${r.name}: ${r.count}`).join(", ")}>{rows.map((r,i)=><i key={r.id} style={{flexGrow:r.count,background:color(r.id,i)}}/>)}</div>}
 <div className="bia-legend">{rows.map((r,i)=>{const inner=<><i style={{background:color(r.id,i)}}/><span>{r.name}</span><strong><Count value={r.count}/></strong></>;return onPick&&!r.members?<button type="button" key={r.id} onClick={()=>onPick(r)}>{inner}</button>:<div key={r.id}>{inner}</div>;})}</div>{waffle&&<small className="bia-chart-unit">100 tiles represent share, rounded to whole percentages.</small>}</div>;
}
function Matrix({tickets,keys,sources,onPick}:{tickets:BusinessTicket[];keys:[Dimension,Dimension];sources:Map<string,string>;onPick:(key:Dimension,value:string,second?:[Dimension,string])=>void}){
 const rows=ranking(tickets,keys[0],sources,keys[0]==="source"?10:5),cols=ranking(tickets,keys[1],sources,4);
 const values=rows.map(r=>cols.map(c=>tickets.filter(t=>members(t,keys[0],r)&&members(t,keys[1],c)).length));const max=Math.max(1,...values.flat());
 return <div className="bia-matrix-wrap"><table className="bia-matrix"><caption className="sr-only">Counts across {tickets.length} selected cases. Other values are grouped; missing values stay explicit.</caption><thead><tr><th scope="col">{keys[0]==="source"?"Source":"Recorded group"}</th>{cols.map(c=><th scope="col" key={c.id}>{c.name}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}><th scope="row">{r.name}</th>{cols.map((c,j)=><td key={c.id}><button type="button" disabled={!!r.members||!!c.members} title={`${r.name} · ${c.name}: ${values[i][j]} cases. Select to filter this combination.`} aria-label={`${r.name}, ${c.name}: ${values[i][j]} cases. Filter this combination.`} onClick={()=>onPick(keys[0],r.id,[keys[1],c.id])} style={{background:`rgb(40 107 80 / ${.035+values[i][j]/max*.19})`}}>{values[i][j]}</button></td>)}</tr>)}</tbody></table></div>;
}
function Series({rows,columns,pareto,denominator,onPick}:{rows:(Rank&{secondary?:number})[];columns:boolean;pareto:boolean;denominator:number;onPick?:((row:Rank)=>void)}){
 const host=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(420);useEffect(()=>{const node=host.current;if(!node)return;const ro=new ResizeObserver(()=>setWidth(node.clientWidth||420));ro.observe(node);return()=>ro.disconnect();},[]);
 const max=Math.max(1,...rows.map(r=>r.count),...rows.map(r=>r.secondary??0)),ceiling=Math.ceil(max/4)*4;
 const x=(i:number)=>34+i*334/Math.max(rows.length-1,1),y=(n:number)=>150-n/ceiling*122;
 const points=useMemo(()=>Array.from({length:32},(_,i)=>{const pos=i*Math.max(rows.length-1,0)/31,lo=Math.floor(pos),hi=Math.min(rows.length-1,Math.ceil(pos));const value=rows.length?(rows[lo].count+(rows[hi].count-rows[lo].count)*(pos-lo)):0;return [34+i*334/31,150-value/ceiling*122];}),[rows,ceiling]);
 const animated=useAnimatedPoints(points);const cumulative=rows.map((_,i)=>denominator?rows.slice(0,i+1).reduce((n,r)=>n+r.count,0)/denominator:0);const tickEvery=Math.max(1,Math.ceil(rows.length/(width<350?4:7)));const font=12*420/Math.max(width,230);
 return <div ref={host} className="bia-series"><svg viewBox="0 0 420 192" role="img" aria-label={`${pareto?"Counts and cumulative share":columns?"Case counts":"Cases over time"}: ${rows.map(r=>`${r.name} ${r.count}${r.secondary!==undefined?`, solutions ${r.secondary}`:""}`).join("; ")}`}>
 {[0,.5,1].map(f=><g key={f}><line x1="27" x2="379" y1={150-f*122} y2={150-f*122} stroke="#e5e9ec"/><text x="21" y={154-f*122} textAnchor="end" style={{fontSize:font}}>{Math.round(ceiling*f)}</text>{pareto&&<text x="383" y={154-f*122} style={{fontSize:font}}>{f*100}%</text>}</g>)}
 {columns?rows.map((r,i)=><g key={r.id}><rect x={x(i)-Math.min(17,120/Math.max(rows.length,1))} y={y(r.count)} width={Math.min(34,240/Math.max(rows.length,1))} height={150-y(r.count)} rx="2" fill="#286b50"/><text x={x(i)} y={y(r.count)-8} textAnchor="middle" style={{fontSize:font}}>{r.count}</text></g>):<polyline points={animated.map(p=>p.join(",")).join(" ")} fill="none" stroke="#286b50" strokeWidth="2.5" strokeLinejoin="round"/>}
 {!columns&&rows.some(r=>r.secondary!==undefined)&&<polyline points={rows.map((r,i)=>`${x(i)},${y(r.secondary??0)}`).join(" ")} fill="none" stroke="#668ca2" strokeDasharray="5 4" strokeWidth="2.5"/>}
 {pareto&&<polyline points={cumulative.map((v,i)=>`${x(i)},${150-v*122}`).join(" ")} fill="none" stroke="#668ca2" strokeWidth="2"/>}
 {rows.map((r,i)=>i%tickEvery===0||i===rows.length-1?<text key={r.id} x={x(i)} y="180" textAnchor="middle" style={{fontSize:font}}>{pareto?i+1:r.name}</text>:null)}
 </svg>{onPick&&columns&&<div className="bia-chart-links">{rows.map(r=>!r.members&&<button type="button" key={r.id} onClick={()=>onPick(r)}>{r.name}<ArrowUpRight size={11}/></button>)}</div>}</div>;
}
function useAnimatedPoints(target:number[][]){const [points,setPoints]=useState(target);const latest=useRef(target);
 useEffect(()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){latest.current=target;return;}const from=latest.current;if(from.length===target.length&&from.every((p,i)=>p.every((n,j)=>n===target[i][j])))return;const start=performance.now();let frame=0;const tick=(now:number)=>{const p=Math.min(1,(now-start)/340),ease=1-Math.pow(1-p,3);const next=target.map((v,i)=>v.map((n,j)=>(from[i]?.[j]??n)+(n-(from[i]?.[j]??n))*ease));latest.current=next;setPoints(next);if(p<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[target]);return typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?target:points;
}
