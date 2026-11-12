import type { AnalyticsTicket } from "./analytics";
import { validDay, csvCell } from "./analytics";
import { cairoDate, shiftDay } from "./dashboard-model";
import { sourceLabel, STATUS_LABELS, type TicketStatus } from "./constants";

export type BusinessEvent={id?:string;kind:string;created_at:string;from_status?:string|null;to_status?:string|null;actorRole?:string|null;resolution_snapshot?:Record<string,string|null>|null};
export type BusinessTicket=AnalyticsTicket & {reporterId?:string;creatorId?:string;appVersion?:string;latestVersion?:boolean|null;device?:string;screen?:string;workflowEvents?:BusinessEvent[]};
export type Snapshot={tickets:BusinessTicket[];asOf:string;sources?:{code:string;name:string;is_active:boolean}[]};
export const DIMENSIONS=["source","status","requestType","topic","trackerCause","trackerAction","outcome","assignee","reporterId","school","fawry","origin","reopened","platform","appVersion","latestVersion","city","userType","category"] as const;
export type Dimension=typeof DIMENSIONS[number];
export type BusinessFilters=Record<Dimension,string>&{basis:"reported"|"created"|"resolved";from:string;to:string;q:string};
export const MISSING="__missing__",UNASSIGNED="__unassigned__";
export function parseBusinessFilters(raw:Record<string,unknown>):BusinessFilters {
 const one=(key:string)=>{const v=raw[key];return (typeof v==="string"?v:Array.isArray(v)&&typeof v[0]==="string"?v[0]:"").trim().slice(0,key==="q"?120:160);};
 return {...Object.fromEntries(DIMENSIONS.map(k=>[k,one(k)])),basis:["created","resolved"].includes(one("basis"))?one("basis"):"reported",from:validDay(one("from"))?one("from"):"",to:validDay(one("to"))?one("to"):"",q:one("q")} as BusinessFilters;
}
export function businessQuery(filters:BusinessFilters){const p=new URLSearchParams({bi:"1"});for(const [k,v]of Object.entries(filters))if(v&&(k!=="basis"||v!=="reported"))p.set(k,v);return p.toString();}
export function field(ticket:BusinessTicket,key:Dimension){
 const values:Partial<Record<Dimension,string|undefined>>={source:ticket.source,status:ticket.status,requestType:ticket.requestType,topic:ticket.topic,trackerCause:ticket.trackerCause,trackerAction:ticket.trackerAction,outcome:ticket.outcome,assignee:ticket.assigneeId||UNASSIGNED,reporterId:ticket.reporterId,school:ticket.schoolName,fawry:ticket.fawry,origin:ticket.isHistorical?"historical":"native",reopened:(ticket.reopenCount??0)>0?"yes":"no",platform:ticket.platform,appVersion:ticket.appVersion,latestVersion:ticket.latestVersion===true?"yes":ticket.latestVersion===false?"no":undefined,city:ticket.cityId,userType:ticket.endUserType,category:ticket.categoryId};return values[key]||MISSING;
}
export function dateOf(t:BusinessTicket,basis:BusinessFilters["basis"]){return basis==="reported"?t.reportedOn||t.createdOn:basis==="resolved"?(t.resolvedAt?cairoDate(t.resolvedAt):""):t.createdOn;}
export function inDate(day:string,filters:Pick<BusinessFilters,"from"|"to">){return !!day&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);}
export function filterBusinessTickets(tickets:BusinessTicket[],filters:BusinessFilters,ignoreDates=false){
 if(!ignoreDates&&filters.from&&filters.to&&filters.from>filters.to)return [];
 return tickets.filter(t=>(ignoreDates||inDate(dateOf(t,filters.basis),filters))&&DIMENSIONS.every(key=>!filters[key]||field(t,key)===(key==="assignee"&&filters[key]==="unassigned"?UNASSIGNED:filters[key]))&&(!filters.q||[t.number,t.subject,t.customerName,t.schoolName,t.customerPhone,t.customerEmail,t.credential].some(v=>v?.toLowerCase().includes(filters.q.toLowerCase()))));
}
export type Rank={id:string;name:string;count:number;members?:string[]};
export function displayValue(key:Dimension,value:string,tickets:BusinessTicket[],sources:Map<string,string>=new Map()){
 if(value===MISSING)return "Not recorded";if(value===UNASSIGNED)return "Unassigned";
 if(key==="source")return sources.get(value)||sourceLabel(value);if(key==="status")return STATUS_LABELS[value as TicketStatus]||value;
 if(key==="assignee")return tickets.find(t=>t.assigneeId===value)?.assignee||"Unknown assignee";
 if(key==="reporterId")return tickets.find(t=>t.reporterId===value)?.reporter||"Reporting owner";
 if(["fawry","reopened","latestVersion"].includes(key))return value==="yes"?"Yes":"No";
 return value==="native"?"Native workflow":value==="historical"?"Historical import":value.replaceAll("_"," ");
}
export function ranking(tickets:BusinessTicket[],key:Dimension,sources:Map<string,string>=new Map(),limit=6):Rank[]{
 const counts=new Map<string,number>();for(const t of tickets){const k=field(t,key);counts.set(k,(counts.get(k)||0)+1);}
 const all=[...counts].map(([id,count])=>({id,name:displayValue(key,id,tickets,sources),count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const missing=all.filter(r=>r.id===MISSING),recorded=all.filter(r=>r.id!==MISSING);if(recorded.length<=limit)return [...recorded,...missing];
 const rest=recorded.slice(limit-1);return [...recorded.slice(0,limit-1),{id:"__other__",name:"Other recorded values",count:rest.reduce((n,r)=>n+r.count,0),members:rest.map(r=>r.id)},...missing];
}
export function isOpenCase(t:BusinessTicket){return ["new","in_progress","awaiting_customer"].includes(t.status);}
export function caseAge(t:BusinessTicket,asOf:string){const day=t.reportedOn||t.createdOn;return validDay(day)?Math.max(0,Math.floor((Date.parse(cairoDate(asOf)+"T12:00:00Z")-Date.parse(day+"T12:00:00Z"))/86400000)):null;}
export function lastActivity(t:BusinessTicket){return (t.workflowEvents??[]).reduce((latest,e)=>e.created_at>latest?e.created_at:latest,t.updatedAt||t.createdAt);}
export function daysWithoutUpdate(t:BusinessTicket,asOf:string){return Math.max(0,(Date.parse(asOf)-Date.parse(lastActivity(t)))/86400000);}
export function orderedEvents(t:BusinessTicket,asOf:string){return [...(t.workflowEvents??[])].filter(e=>e.created_at<=asOf).sort((a,b)=>a.created_at.localeCompare(b.created_at)||(a.id||"").localeCompare(b.id||""));}
export function completeHistory(t:BusinessTicket,asOf:string){
 if(t.isHistorical)return false;const events=orderedEvents(t,asOf);const start=events.find(e=>e.kind==="created");
 return !!start&&Math.abs(Date.parse(start.created_at)-Date.parse(t.createdAt))<=60000&&start.to_status==="new"&&events.filter(e=>e.to_status).at(-1)?.to_status===t.status&&(t.reopenCount??0)===events.filter(e=>e.kind==="reopened").length;
}
export function lifecycle(t:BusinessTicket,asOf:string){
 const events=orderedEvents(t,asOf);const complete=completeHistory(t,asOf);const firstResolution=complete?events.find(e=>e.kind==="resolved"):undefined;
 const firstReply=complete?events.find(e=>["comment","resolved"].includes(e.kind)&&e.actorRole==="support_agent"):undefined;
 const hours=(event:BusinessEvent|undefined)=>{if(!event)return null;const n=(Date.parse(event.created_at)-Date.parse(t.createdAt))/3600000;return n>=0?n:null;};
 return {complete,events,firstResolution,replyHours:hours(firstReply),resolutionHours:hours(firstResolution)};
}
export function stability(tickets:BusinessTicket[],asOf:string,days=14){
 let eligible=0,reopened=0;for(const t of tickets){const life=lifecycle(t,asOf);if(!life.firstResolution)continue;const first=Date.parse(life.firstResolution.created_at),end=first+days*86400000;if(end>Date.parse(asOf))continue;eligible++;if(life.events.some(e=>e.kind==="reopened"&&Date.parse(e.created_at)>first&&Date.parse(e.created_at)<=end))reopened++;}
 return {eligible,reopened,stable:eligible-reopened,rate:eligible?(eligible-reopened)/eligible:null};
}
export type Bucket={id:string;name:string;count:number;from:string;to:string;secondary?:number};
export function timeBuckets(tickets:BusinessTicket[],filters:BusinessFilters,asOf:string,mode:"arrivals"|"flow"|"reopened"|"backlog"="arrivals"):Bucket[]{
 const eligible=mode==="arrivals"?tickets:tickets.filter(t=>completeHistory(t,asOf));
 const eventDays=eligible.flatMap(t=>[t.createdOn,dateOf(t,filters.basis),...(mode==="arrivals"?[]:orderedEvents(t,asOf).map(e=>cairoDate(e.created_at)))]).filter(validDay);
 const from=filters.from||(eventDays.sort()[0]||cairoDate(asOf)),to=filters.to||cairoDate(asOf);if(from>to)return [];
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000);const yearly=days>1096;const yearStep=Math.max(1,Math.ceil((Number(to.slice(0,4))-Number(from.slice(0,4))+1)/36));const monthly=days>62;const weekly=!monthly&&days>21;
 const ranges:{from:string;to:string}[]=[];let cursor=from;
 while(cursor<=to){let next:string;if(yearly){const d=new Date(0);d.setUTCFullYear(Number(cursor.slice(0,4))+yearStep,0,1);next=d.toISOString().slice(0,10);}else if(monthly){const d=new Date(cursor+"T12:00:00Z");d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);next=d.toISOString().slice(0,10);}else next=shiftDay(cursor,weekly?7:1);const end=!validDay(next)||next>to?to:shiftDay(next,-1);ranges.push({from:cursor,to:end});if(end===to)break;cursor=next;}
 return ranges.map(r=>{const within=(iso:string)=>{const d=cairoDate(iso);return d>=r.from&&d<=r.to;};let count=0,secondary=0;
 for(const t of eligible){if(mode==="arrivals"){const d=dateOf(t,filters.basis);if(d&&d>=r.from&&d<=r.to)count++;}else if(mode==="flow"){if(within(t.createdAt))count++;secondary+=orderedEvents(t,asOf).filter(e=>e.kind==="resolved"&&within(e.created_at)).length;}else if(mode==="reopened")count+=orderedEvents(t,asOf).filter(e=>e.kind==="reopened"&&within(e.created_at)).length;else{const state=orderedEvents(t,asOf).filter(e=>cairoDate(e.created_at)<=r.to&&e.to_status).at(-1)?.to_status;if(state&&["new","in_progress","awaiting_customer"].includes(state))count++;}}
 return {id:r.from,name:yearly?r.from.slice(0,4):monthly?r.from.slice(0,7):r.from.slice(5),count,from:r.from,to:r.to,...(mode==="flow"?{secondary}:{})};});
}
export function histogram(tickets:BusinessTicket[],pick:(t:BusinessTicket)=>number|null,bins:{id:string;name:string;min:number;max:number}[]):Rank[]{return bins.map(b=>({id:b.id,name:b.name,count:tickets.filter(t=>{const n=pick(t);return n!==null&&Number.isFinite(n)&&n>=b.min&&n<b.max;}).length}));}
export const AGE_BINS=[{id:"0-2",name:"0–2 days",min:0,max:3},{id:"3-7",name:"3–7 days",min:3,max:8},{id:"8-14",name:"8–14 days",min:8,max:15},{id:"15",name:"15+ days",min:15,max:Infinity}];
export function ratioRows(tickets:BusinessTicket[],key:Dimension,sources:Map<string,string>){return ranking(tickets,key,sources).map(r=>{const group=tickets.filter(t=>r.members?r.members.includes(field(t,key)):field(t,key)===r.id);const reopened=group.filter(t=>(t.reopenCount??0)>0).length;return {...r,reopened,ratio:r.count?reopened/r.count:0};});}
export function businessCsv(tickets:BusinessTicket[]){const header=["Case","Customer","Source","Status","Reporter","Assignee","Request type","Topic","Cause","Action","Outcome","Reopen count","Reported date","Created at","Resolved at","Problem","Support response"];return "\uFEFF"+[header,...tickets.map(t=>[t.number,t.customerName||"",t.sourceName||sourceLabel(t.source),STATUS_LABELS[t.status],t.reporter||"",t.assignee||"Unassigned",t.requestType,t.topic,t.trackerCause,t.trackerAction,t.outcome,String(t.reopenCount??0),t.reportedOn||t.createdOn,t.createdAt,t.resolvedAt||"",t.subject,t.resolutionNotes||""])].map(r=>r.map(csvCell).join(",")).join("\r\n")+"\r\n";}
