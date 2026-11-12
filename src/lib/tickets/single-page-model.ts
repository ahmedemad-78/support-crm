import { MISSING, field, ranking, type BusinessTicket, type Dimension } from "./business-analytics";
import countries from "./world-countries.json";

export type Place={name:string;lon:number;lat:number;country:string;level:"city"|"area"|"country"};
// Area reference points, not customer coordinates. GeoNames/CAPMAS references in docs/map-data.md.
const places:Record<string,Place>={
 cairo:{name:"Cairo",lon:31.24967,lat:30.06263,country:"Egypt",level:"city"},
 alexandria:{name:"Alexandria",lon:29.91582,lat:31.20176,country:"Egypt",level:"city"},
 asyut:{name:"Asyut",lon:31.16373,lat:27.18859,country:"Egypt",level:"city"},
 damietta:{name:"Damietta",lon:31.81332,lat:31.41648,country:"Egypt",level:"city"},
 qalyubia:{name:"Qalyubia",lon:31.25,lat:30.3,country:"Egypt",level:"area"},
 "red sea":{name:"Red Sea",lon:33.78845,lat:27.18624,country:"Egypt",level:"area"},
};
export function resolvePlace(name:string):Place|null{
 const key=name.trim().toLowerCase();if(places[key])return places[key];
 const country=countries.find(c=>c.name.toLowerCase()===key);
 return country?{name,country:country.name,lon:country.center[0],lat:country.center[1],level:"country"}:null;
}
export function geographicCases(tickets:BusinessTicket[],cities:{id:string;name:string}[]){
 const groups=new Map<string,{id:string;name:string;count:number;place:Place|null}>();let missing=0;
 const names=new Map(cities.map(c=>[c.id,c.name]));
 for(const t of tickets){const id=field(t,"city"),name=names.get(id)||"";
  if(id===MISSING||/^(not recorded|unknown|غير مسجل)$/i.test(name.trim())){missing++;continue;}
  const current=groups.get(id);if(current)current.count++;else groups.set(id,{id,name:name||"Unrecognized location",count:1,place:resolvePlace(name)});
 }
 const locations=[...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const mapped=locations.filter(c=>c.place).reduce((n,c)=>n+c.count,0),unmapped=locations.filter(c=>!c.place).reduce((n,c)=>n+c.count,0);
 return {locations,mapped,unmapped,missing,total:tickets.length};
}
export function clusteredSources(tickets:BusinessTicket[],sources:Map<string,string>){
 const all=ranking(tickets,"requestType",new Map(),100000),known=all.filter(r=>r.id!==MISSING),top=known.slice(0,3);
 const rest=known.slice(3).map(r=>r.id);
 const series=[...top.map(r=>({id:r.id,name:r.name,members:[r.id]})),...(rest.length?[{id:"__other__",name:"Other request types",members:rest}]:[]),...(all.some(r=>r.id===MISSING)?[{id:MISSING,name:"Not recorded",members:[MISSING]}]:[])];
 const groups=ranking(tickets,"source",sources,100000).map(s=>({...s,values:series.map(type=>tickets.filter(t=>t.source===s.id&&type.members.includes(field(t,"requestType"))).length)}));
 return {series,groups};
}
export function recordReview(tickets:BusinessTicket[]){
 return {inconsistent:tickets.filter(t=>t.status==="resolved"&&t.outcome.trim().toLowerCase()==="issue persists"),incomplete:tickets.filter(t=>["requestType","topic","trackerCause","trackerAction","outcome"].some(k=>field(t,k as Dimension)===MISSING)),missingReporter:tickets.filter(t=>!t.reporterId)};
}
