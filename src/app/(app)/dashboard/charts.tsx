"use client";
import { useState, type KeyboardEvent } from "react";
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { type AnalyticsTicket, type View, type issuePareto, type trend } from "@/lib/tickets/analytics";
const palette = ["#477fd6", "#d59b3b", "#9472cd", "#15976c", "#84978d"];
function activate(event: KeyboardEvent<SVGElement>, action: () => void) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); } }

export function ActivityChart({buckets,onSelect}:{buckets:ReturnType<typeof trend>;onSelect:(from:string,to:string,view:View)=>void}) {
  const [hover,setHover] = useState<number|null>(null);
  const max = Math.max(1,...buckets.flatMap(b=>[b.created,b.resolved]));
  const x=(i:number)=>50+(buckets.length===1?290:i/(buckets.length-1)*580), y=(v:number)=>205-v/max*165;
  const path=(key:"created"|"resolved")=>buckets.map((b,i)=>`${i?"L":"M"}${x(i)},${y(b[key])}`).join(" ");
  if (!buckets.length) return <div className="bi-empty">No data for this period.</div>;
  return <div className="bi-flow">
    <div className="bi-chart-legend"><span><i style={{background:"#15976c"}}/>Received <strong>{buckets.reduce((s,b)=>s+b.created,0)}</strong></span><span><i style={{background:"#687ddd"}}/>Resolved <strong>{buckets.reduce((s,b)=>s+b.resolved,0)}</strong></span><small>Tickets / {buckets.length>1&&buckets[0].from!==buckets[0].to?"period":"day"}</small></div>
    <svg viewBox="0 0 670 250" role="group" aria-label="Ticket flow by date">
      <defs><linearGradient id="bi-flow-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#15976c" stopOpacity=".18"/><stop offset="100%" stopColor="#15976c" stopOpacity=".01"/></linearGradient></defs>
      {[0,.25,.5,.75,1].map(n=><g key={n}><line x1="50" x2="630" y1={y(max*n)} y2={y(max*n)} stroke="#e8eeec" strokeDasharray="3 4"/><text x="38" y={y(max*n)+4} textAnchor="end">{Number((max*n).toFixed(1))}</text></g>)}
      <path d={`${path("created")} L${x(buckets.length-1)},205 L${x(0)},205 Z`} fill="url(#bi-flow-fill)"/>
      <path d={path("created")} fill="none" stroke="#15976c" strokeWidth="2.5"/>
      <path d={path("resolved")} fill="none" stroke="#687ddd" strokeWidth="2.5" strokeDasharray="5 3"/>
      {hover!==null&&buckets[hover]&&<line x1={x(hover)} x2={x(hover)} y1="28" y2="205" stroke="#94aba0" strokeDasharray="3 3"/>}
      {buckets.map((b,i)=><g key={b.from}>{(["created","resolved"] as const).map((key,k)=><circle key={key} cx={x(i)} cy={y(b[key])} r={hover===i||buckets.length===1?5:3} fill={k?"#687ddd":"#15976c"} stroke="white" strokeWidth="1.5" role="button" tabIndex={0} aria-label={`${b.from} to ${b.to}: ${b[key]} ${key==="created"?"received":"resolved"}. Filter these tickets`} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)} onClick={()=>onSelect(b.from,b.to,key)} onKeyDown={e=>activate(e,()=>onSelect(b.from,b.to,key))}><title>{b.from} · {b[key]} {key==="created"?"received":"resolved"}</title></circle>)}{(i===0||i===buckets.length-1||i%Math.max(1,Math.ceil(buckets.length/5))===0)&&<text x={x(i)} y="231" textAnchor={i===0?"start":i===buckets.length-1?"end":"middle"}>{b.from.slice(5)}</text>}</g>)}
    </svg>
    <div className="bi-chart-readout" aria-live="polite">{hover!==null&&buckets[hover]?`${buckets[hover].from} — ${buckets[hover].to} · ${buckets[hover].created} received · ${buckets[hover].resolved} resolved`:"Select a point to filter the period and its ticket cohort."}</div>
  </div>;
}

export function ParetoChart({entries,onSelect}:{entries:ReturnType<typeof issuePareto>;onSelect:(key:string)=>void}) {
  const shown=entries.slice(0,6), max=Math.max(1,...shown.map(e=>e.value)), step=540/Math.max(1,shown.length), x=(i:number)=>50+step*(i+.5), y=(v:number)=>183-v/max*133, cy=(p:number)=>183-p/100*133;
  if(!shown.length) return <div className="bi-empty">No issue categories for this selection.</div>;
  return <div className="bi-pareto"><div className="bi-chart-legend"><span><i style={{background:"#2ca77e"}}/>Ticket count</span><span><i style={{background:"#8260c4"}}/>Cumulative %</span><small>Top {shown.length} of {entries.length} categories</small></div>
    <svg viewBox="0 0 650 215" role="group" aria-label="Pareto chart: issue volume and cumulative percentage">
      {[0,.5,1].map(n=><g key={n}><line x1="48" x2="590" y1={cy(n*100)} y2={cy(n*100)} stroke="#e8eeec"/><text x="36" y={cy(n*100)+4} textAnchor="end">{Number((max*n).toFixed(1))}</text><text x="601" y={cy(n*100)+4}>{n*100}%</text></g>)}
      <line x1="48" x2="590" y1={cy(80)} y2={cy(80)} stroke="#b9a9d9" strokeDasharray="4 4"/>
      {shown.map((e,i)=><g key={e.key}><rect x={x(i)-step*.29} y={y(e.value)} width={step*.58} height={183-y(e.value)} rx="4" fill={i===0?"#14815e":"#7ccdb0"} role="button" tabIndex={0} aria-label={`${e.label}: ${e.value} tickets, ${e.cumulative.toFixed(1)} percent cumulative. Filter category`} onClick={()=>onSelect(e.key)} onKeyDown={event=>activate(event,()=>onSelect(e.key))}><title>{e.label}: {e.value}</title></rect><text x={x(i)} y={y(e.value)-7} textAnchor="middle">{e.value}</text><text x={x(i)} y="204" textAnchor="middle">{i+1}</text></g>)}
      <path d={shown.map((e,i)=>`${i?"L":"M"}${x(i)},${cy(e.cumulative)}`).join(" ")} fill="none" stroke="#8260c4" strokeWidth="2" pointerEvents="none"/>
      {shown.map((e,i)=><circle key={e.key} cx={x(i)} cy={cy(e.cumulative)} r="4" fill="#8260c4" pointerEvents="none"/>)}
    </svg><div className="bi-pareto-keys">{shown.map((e,i)=><button key={e.key} onClick={()=>onSelect(e.key)}><b>{i+1}</b><span>{e.label}</span><strong>{e.cumulative.toFixed(0)}%</strong></button>)}</div>
  </div>;
}

export function StatusDonut({rows,selected,onSelect}:{rows:AnalyticsTicket[];selected:string;onSelect:(status:TicketStatus)=>void}) {
  const entries=TICKET_STATUSES.map((key,i)=>({key,label:STATUS_LABELS[key],value:rows.filter(t=>t.status===key).length,color:palette[i]}));
  return <div className="bi-status-layout"><svg viewBox="0 0 180 180" role="group" aria-label={`Ticket status: ${rows.length} matching tickets`}>
    <circle cx="90" cy="90" r="64" fill="none" stroke="#eef2f0" strokeWidth="22"/>
    {entries.map((e,i)=>{const fraction=e.value/Math.max(1,rows.length), start=entries.slice(0,i).reduce((s,v)=>s+v.value,0)/Math.max(1,rows.length);return e.value>0&&<circle key={e.key} cx="90" cy="90" r="64" fill="none" stroke={e.color} strokeWidth={selected===e.key?27:22} pathLength="100" strokeDasharray={`${fraction*100} ${100-fraction*100}`} strokeDashoffset={-start*100} transform="rotate(-90 90 90)" role="button" tabIndex={0} aria-label={`${e.label}: ${e.value}. Filter status`} onClick={()=>onSelect(e.key)} onKeyDown={event=>activate(event,()=>onSelect(e.key))}><title>{e.label}: {e.value}</title></circle>;})}
    <text x="90" y="88" textAnchor="middle" className="bi-donut-total">{rows.length}</text><text x="90" y="108" textAnchor="middle">tickets</text>
  </svg><div className="bi-status-legend">{entries.map(e=><button key={e.key} onClick={()=>onSelect(e.key)} aria-pressed={selected===e.key}><i style={{background:e.color}}/><span>{e.label}</span><strong>{e.value}</strong><small>{rows.length?Math.round(e.value/rows.length*100):0}%</small></button>)}</div></div>;
}
