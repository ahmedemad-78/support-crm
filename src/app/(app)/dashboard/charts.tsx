"use client";
import { useState, type KeyboardEvent } from "react";
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { type AnalyticsTicket, type View, type issuePareto, type trend } from "@/lib/tickets/analytics";
const palette = ["#477fd6", "#d59b3b", "#9472cd", "#15976c", "#84978d"];
function activate(event: KeyboardEvent<SVGElement>, action: () => void) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); } }

export function ActivityChart({buckets,onSelect}:{buckets:ReturnType<typeof trend>;onSelect:(from:string,to:string,view:View)=>void}) {
  const [hover,setHover] = useState<number|null>(null);
  if (!buckets.length) return <div className="bi-empty">Choose a valid reporting period.</div>;
  const max = Math.max(1,...buckets.flatMap(b=>[b.created,b.resolved]));
  const tick = Math.max(1, Math.ceil(max / 4)), ceiling = tick * 4;
  const width = 760, plot = width - 110, step = plot / buckets.length;
  const x = (i:number) => 60 + i * step, y = (v:number) => 238 - v / ceiling * 180;
  const received = buckets.reduce((n,b)=>n+b.created,0), resolved = buckets.reduce((n,b)=>n+b.resolved,0);
  const interval = buckets[0].interval;
  const label = (day:string) => interval === "quarter" ? `Q${Math.floor(Number(day.slice(5,7))/3-.01)+1} ${day.slice(0,4)}` : new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", interval === "month" ? {month:"short",year:"2-digit",timeZone:"UTC"} : {day:"numeric",month:"short",timeZone:"UTC"});
  return <div className="bi-flow">
    <div className="bi-flow-summary"><div><i style={{background:"#128364"}}/><span>Received<strong>{received}</strong></span></div><div><i style={{background:"#7e8adc"}}/><span>Recorded resolutions<strong>{resolved}</strong></span></div><p>Grouped by <strong>{interval}</strong><br/>Whole tickets · same scale</p></div>
    <div className="bi-flow-scroll"><svg viewBox={`0 0 ${width} 294`} role="group" aria-label={`Tickets received and recorded resolutions by ${interval}`}>
      {[0,1,2,3,4].map(n=><g key={n}><line x1="55" x2={width-40} y1={y(tick*n)} y2={y(tick*n)} stroke="#e5ebe8" strokeDasharray={n?"3 5":undefined}/><text x="42" y={y(tick*n)+4} textAnchor="end">{tick*n}</text></g>)}
      {buckets.map((b,i)=><g key={b.from}>
        {hover===i&&<rect x={x(i)} y="40" width={step} height="198" rx="5" fill="#f0f6f3"/>}
        {(["created","resolved"] as const).map((key,k)=><g key={key} role="button" tabIndex={0} aria-label={`${b.from} to ${b.to}: ${b[key]} ${key==="created"?"received":"recorded resolutions"}. View tickets`} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)} onClick={()=>onSelect(b.from,b.to,key)} onKeyDown={e=>activate(e,()=>onSelect(b.from,b.to,key))}>
          <rect x={x(i)+step*(.12+k*.4)} y="40" width={step*.36} height="198" fill="transparent"/>
          <rect x={x(i)+step*(.12+k*.4)} y={y(b[key])} width={Math.max(3,step*.3)} height={238-y(b[key])} rx="3" fill={k?"#7e8adc":"#128364"}/>
          {(buckets.length<=20||hover===i)&&b[key]>0&&<text x={x(i)+step*(.27+k*.4)} y={y(b[key])-8} textAnchor="middle">{b[key]}</text>}
          <title>{`${b.from} to ${b.to}: ${b[key]} ${key==="created"?"received":"recorded resolutions"}`}</title>
        </g>)}
        {(i % Math.max(1,Math.ceil(buckets.length/7))===0 || i===buckets.length-1)&&<text x={x(i)+step*.47} y="263" textAnchor={i===0?"start":i===buckets.length-1?"end":"middle"}>{label(b.from)}</text>}
      </g>)}
    </svg></div>
    <div className="bi-chart-readout" aria-live="polite">{hover!==null&&buckets[hover]?`${buckets[hover].from} — ${buckets[hover].to} · ${buckets[hover].created} received · ${buckets[hover].resolved} recorded resolutions`:"Click a column to inspect its tickets. Empty intervals remain visible; no interpolated values."}</div>
    <p className="bi-note">Resolution dates can belong to older arrivals. This is recorded activity, not a resolution rate or historical backlog. Reopened tickets and missing resolution dates are excluded from the resolution series.</p>
  </div>;
}

export function ParetoChart({entries,onSelect}:{entries:ReturnType<typeof issuePareto>;onSelect:(key:string)=>void}) {
  const shown=entries.slice(0,6), max=Math.max(1,...shown.map(e=>e.value)), step=540/Math.max(1,shown.length), x=(i:number)=>50+step*(i+.5), y=(v:number)=>183-v/max*133, cy=(p:number)=>183-p/100*133;
  if(!shown.length) return <div className="bi-empty">No arrivals in this period.</div>;
  if(shown.length===1) return <div className="bi-quality-empty"><h4>{shown[0].key==="__missing__"?"Issue classification is missing":"One issue category recorded"}</h4><p>{shown[0].key==="__missing__"?`All ${shown[0].value} arrivals are uncategorized. A cause ranking would be misleading until these tickets are classified.`:`${shown[0].label} accounts for all ${shown[0].value} arrivals. There are no other categories to compare.`}</p><button onClick={()=>onSelect(shown[0].key)}>Review {shown[0].value} tickets ↗</button></div>;
  return <div className="bi-pareto"><div className="bi-chart-legend"><span><i style={{background:"#2ca77e"}}/>Ticket count</span><span><i style={{background:"#8260c4"}}/>Cumulative %</span><small>Top {shown.length} of {entries.length} categories</small></div>
    <svg viewBox="0 0 650 215" role="group" aria-label="Pareto chart: issue volume and cumulative percentage">
      {[0,.5,1].map(n=><g key={n}><line x1="48" x2="590" y1={cy(n*100)} y2={cy(n*100)} stroke="#e8eeec"/><text x="36" y={cy(n*100)+4} textAnchor="end">{Number((max*n).toFixed(1))}</text><text x="601" y={cy(n*100)+4}>{n*100}%</text></g>)}
      <line x1="48" x2="590" y1={cy(80)} y2={cy(80)} stroke="#b9a9d9" strokeDasharray="4 4"/>
      {shown.map((e,i)=><g key={e.key}><rect x={x(i)-step*.29} y={y(e.value)} width={step*.58} height={183-y(e.value)} rx="4" fill={i===0?"#14815e":"#7ccdb0"} role="button" tabIndex={0} aria-label={`${e.label}: ${e.value} tickets, ${e.cumulative.toFixed(1)} percent cumulative. Filter category`} onClick={()=>onSelect(e.key)} onKeyDown={event=>activate(event,()=>onSelect(e.key))}><title>{`${e.label}: ${e.value}`}</title></rect><text x={x(i)} y={y(e.value)-7} textAnchor="middle">{e.value}</text><text x={x(i)} y="204" textAnchor="middle">{i+1}</text></g>)}
      <path d={shown.map((e,i)=>`${i?"L":"M"}${x(i)},${cy(e.cumulative)}`).join(" ")} fill="none" stroke="#8260c4" strokeWidth="2" pointerEvents="none"/>
      {shown.map((e,i)=><circle key={e.key} cx={x(i)} cy={cy(e.cumulative)} r="4" fill="#8260c4" pointerEvents="none"/>)}
    </svg><div className="bi-pareto-keys">{shown.map((e,i)=><button key={e.key} onClick={()=>onSelect(e.key)}><b>{i+1}</b><span>{e.label}</span><strong>{e.cumulative.toFixed(0)}%</strong></button>)}</div>
  </div>;
}

export function StatusDonut({rows,selected,onSelect}:{rows:AnalyticsTicket[];selected:string;onSelect:(status:TicketStatus)=>void}) {
  const entries=TICKET_STATUSES.map((key,i)=>({key,label:STATUS_LABELS[key],value:rows.filter(t=>t.status===key).length,color:palette[i]}));
  return <div className="bi-status-layout"><svg viewBox="0 0 180 180" role="group" aria-label={`Ticket status: ${rows.length} matching tickets`}>
    <circle cx="90" cy="90" r="64" fill="none" stroke="#eef2f0" strokeWidth="22"/>
    {entries.map((e,i)=>{const fraction=e.value/Math.max(1,rows.length), start=entries.slice(0,i).reduce((s,v)=>s+v.value,0)/Math.max(1,rows.length);return e.value>0&&<circle key={e.key} cx="90" cy="90" r="64" fill="none" stroke={e.color} strokeWidth={selected===e.key?27:22} pathLength="100" strokeDasharray={`${fraction*100} ${100-fraction*100}`} strokeDashoffset={-start*100} transform="rotate(-90 90 90)" role="button" tabIndex={0} aria-label={`${e.label}: ${e.value}. Filter status`} onClick={()=>onSelect(e.key)} onKeyDown={event=>activate(event,()=>onSelect(e.key))}><title>{`${e.label}: ${e.value}`}</title></circle>;})}
    <text x="90" y="88" textAnchor="middle" className="bi-donut-total">{rows.length}</text><text x="90" y="108" textAnchor="middle">tickets</text>
  </svg><div className="bi-status-legend">{entries.map(e=><button key={e.key} onClick={()=>onSelect(e.key)} aria-pressed={selected===e.key}><i style={{background:e.color}}/><span>{e.label}</span><strong>{e.value}</strong><small>{rows.length?Math.round(e.value/rows.length*100):0}%</small></button>)}</div></div>;
}
