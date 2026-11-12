import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const directory=mkdtempSync(join(tmpdir(),'crm-business-'));
for(const name of ['constants','dashboard-model','analytics','business-analytics','single-page-model'])writeFileSync(join(directory,name+'.js'),ts.transpileModule(readFileSync(new URL('../src/lib/tickets/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
writeFileSync(join(directory,'world-countries.json'),readFileSync(new URL('../src/lib/tickets/world-countries.json',import.meta.url),'utf8'));
const require=createRequire(import.meta.url),m=require(join(directory,'business-analytics.js'));
const single=require(join(directory,'single-page-model.js'));
after(()=>rmSync(directory,{recursive:true,force:true}));
const asOf='2026-11-12T12:00:00Z';
const event=(id,kind,date,status,role='support_agent')=>({id,kind,created_at:date,to_status:status,actorRole:role});
const ticket=(overrides={})=>({id:'one',number:'CASE-1',subject:'مشكلة تجريبية',source:'call_center',sourceName:'Call Center',status:'resolved',createdOn:'2026-11-01',createdAt:'2026-11-01T08:00:00Z',reportedOn:'2026-10-29',resolvedAt:'2026-11-02T08:00:00Z',cityId:'1',categoryId:'2',endUserType:'parent',category:'App',cause:'',requestType:'Complaint',topic:'Content',trackerCause:'Content delay',trackerAction:'Publish content',outcome:'Fixed',fawry:'',reporterId:'kabany',reporter:'Kabany',creatorId:'ahmed',creator:'Ahmed',reopenCount:0,isHistorical:false,workflowEvents:[event('e1','created','2026-11-01T08:00:00Z','new'),event('e2','resolved','2026-11-02T08:00:00Z','resolved')],...overrides});
const f=(overrides={})=>m.parseBusinessFilters(overrides);

test('map coverage accounts for missing, explicit unknown, unrecognized and international locations without assigning Egypt',()=>{
 const data=[ticket(),ticket({id:'alex',cityId:'3'}),ticket({id:'kw',cityId:'29'}),ticket({id:'unknown',cityId:'28'}),ticket({id:'missing',cityId:''}),ticket({id:'new-place',cityId:'999'})];
 const cities=[{id:'1',name:'Cairo'},{id:'3',name:'Alexandria'},{id:'29',name:'Kuwait'},{id:'28',name:'Not recorded'},{id:'999',name:'New unverified city'}];
 const result=single.geographicCases(data,cities);assert.equal(result.mapped,3);assert.equal(result.missing,2);assert.equal(result.unmapped,1);assert.equal(result.mapped+result.missing+result.unmapped,result.total);
 const international=result.locations.find(p=>p.name==='Kuwait');assert.equal(international.place.country,'Kuwait');assert.equal(international.place.level,'country');assert.ok(international.place.lon>46&&international.place.lon<49);assert.equal(result.locations.find(p=>p.id==='999').place,null);
 assert.equal(single.resolvePlace('Red Sea').country,'Egypt');assert.equal(single.resolvePlace('never geocode this customer address'),null);
});
test('clustered source series preserve every case through other request types and missing classification',()=>{
 const data=Array.from({length:70},(_,i)=>ticket({id:String(i),source:['call_center','moderation','whatsapp'][i%3],requestType:i%7?'Type '+i%6:''}));
 const result=single.clusteredSources(data,new Map());assert.equal(result.groups.reduce((n,g)=>n+g.values.reduce((a,b)=>a+b,0),0),70);assert.equal(result.groups.reduce((n,g)=>n+g.count,0),70);assert.ok(result.series.some(s=>s.id===m.MISSING));assert.ok(result.series.some(s=>s.id==='__other__'));assert.equal(new Set(result.series.flatMap(s=>s.members)).size,7);
});
test('record review flags count cases once and do not redefine resolved or reopen counts',()=>{
 const data=[ticket({outcome:'Issue Persists'}),ticket({id:'two',status:'closed',outcome:'Issue Persists',reporterId:''}),ticket({id:'three',topic:'',trackerCause:'',trackerAction:''})];
 const review=single.recordReview(data);assert.equal(review.inconsistent.length,1);assert.equal(review.incomplete.length,1);assert.equal(review.missingReporter.length,1);assert.equal(data.filter(t=>t.status==='resolved').length,2);
});
test('full population, source, tracker action and outcome filters share one denominator',()=>{
 const data=[ticket(),ticket({id:'two',source:'moderation',status:'closed',outcome:'',trackerAction:'',reporterId:'sonia'}),ticket({id:'three',status:'new',resolvedAt:null})];
 assert.equal(m.filterBusinessTickets(data,f()).length,3);
 assert.equal(m.filterBusinessTickets(data,f({source:'call_center',trackerAction:'Publish content',outcome:'Fixed'})).length,2);
 assert.equal(m.filterBusinessTickets(data,f({status:'closed',trackerAction:m.MISSING})).length,1);
 assert.equal(m.filterBusinessTickets(data,f({reporterId:'kabany'})).length,2);
 assert.equal(m.filterBusinessTickets(data,f({reporterId:'ahmed'})).length,0);
 assert.equal(m.filterBusinessTickets(data,f({assignee:m.UNASSIGNED})).length,3);
});
test('reported, created and resolution dates remain separate and Cairo-aware',()=>{
 const data=[ticket({createdAt:'2026-11-12T22:30:00Z',createdOn:'2026-11-13',resolvedAt:'2026-11-14T00:00:00Z'})];
 assert.equal(m.filterBusinessTickets(data,f({from:'2026-11-13',to:'2026-11-13',basis:'created'})).length,1);
 assert.equal(m.filterBusinessTickets(data,f({from:'2026-11-13',to:'2026-11-13',basis:'reported'})).length,0);
 assert.equal(m.filterBusinessTickets(data,f({from:'2026-11-14',to:'2026-11-14',basis:'resolved'})).length,1);
 assert.equal(m.filterBusinessTickets(data,f({from:'2026-11-14',to:'2026-11-01'})).length,0);
 assert.equal(m.filterBusinessTickets(data,f({from:'2026-11-14',to:'2026-11-14'}),true).length,1);
});
test('query round-trips source, action, outcome, ownership, school and explicit unknowns',()=>{
 const initial=f({source:'call_center',basis:'created',trackerAction:'Send instructions',outcome:'Fixed',reopened:'yes',origin:'native',assignee:'agent',reporterId:'owner',school:'مدرسة أ',latestVersion:m.MISSING,from:'2026-01-01',q:'=literal'});
 const parsed=f(Object.fromEntries(new URLSearchParams(m.businessQuery(initial))));assert.deepEqual(parsed,initial);
 assert.equal(m.filterBusinessTickets([ticket({subject:'100% failure, =literal'})],f({q:'=literal'})).length,1);
});
test('rankings preserve full totals, group recorded overflow and never hide missing data',()=>{
 const data=Array.from({length:1201},(_,i)=>ticket({id:String(i),trackerCause:i%7?'Cause '+i:''}));
 const ranks=m.ranking(data,'trackerCause',new Map(),6);
 assert.equal(ranks.reduce((n,r)=>n+r.count,0),1201);assert.ok(ranks.find(r=>r.id===m.MISSING));assert.ok(ranks.find(r=>r.members?.length));
 const ratios=m.ratioRows(data,'trackerCause',new Map());assert.equal(ratios.reduce((n,r)=>n+r.count,0),1201);
});
test('first reply ignores reporting staff, status-only events and unknown actors',()=>{
 const t=ticket({workflowEvents:[event('1','created','2026-11-01T08:00:00Z','new'),event('2','comment','2026-11-01T09:00:00Z',null,'call_center'),event('3','status_changed','2026-11-01T10:00:00Z','in_progress'),event('4','comment','2026-11-01T11:00:00Z',null,null),event('5','comment','2026-11-01T12:00:00Z',null),event('6','resolved','2026-11-02T08:00:00Z','resolved')]});
 const life=m.lifecycle(t,asOf);assert.equal(life.replyHours,4);assert.equal(life.resolutionHours,24);
 assert.equal(m.lifecycle({...t,isHistorical:true},asOf).replyHours,null);
 assert.equal(m.lifecycle({...t,workflowEvents:t.workflowEvents.slice(1)},asOf).resolutionHours,null);
 assert.equal(m.completeHistory({...t,reopenCount:1},asOf),false);
});
test('arrivals and resolution events use their own dates; reclosures do not create new cases',()=>{
 const t=ticket({reopenCount:1,workflowEvents:[event('1','created','2026-11-01T08:00:00Z','new'),event('2','resolved','2026-11-02T08:00:00Z','resolved'),event('3','reopened','2026-11-03T08:00:00Z','in_progress'),event('4','resolved','2026-11-10T08:00:00Z','resolved')]});
 const filters=f({from:'2026-11-10',to:'2026-11-10'});const bars=m.timeBuckets([t],filters,asOf,'flow');assert.equal(bars[0].count,0);assert.equal(bars[0].secondary,1);
 const all=m.timeBuckets([t],f(),asOf,'flow');assert.equal(all.reduce((n,b)=>n+b.count,0),1);assert.equal(all.reduce((n,b)=>n+b.secondary,0),2);
 assert.equal(m.timeBuckets([t],f(),asOf,'reopened').reduce((n,b)=>n+b.count,0),1);
});
test('historical backlog reconstructs closed and reopened states instead of copying current status',()=>{
 const t=ticket({status:'in_progress',resolvedAt:null,reopenCount:1,workflowEvents:[event('1','created','2026-11-01T08:00:00Z','new'),event('2','resolved','2026-11-02T08:00:00Z','resolved'),event('3','reopened','2026-11-11T08:00:00Z','in_progress')]});
 const buckets=m.timeBuckets([t],f({from:'2026-11-10',to:'2026-11-12'}),asOf,'backlog');assert.deepEqual(buckets.map(b=>b.count),[0,1,1]);
 assert.equal(m.timeBuckets([{...t,isHistorical:true}],f({from:'2026-11-10',to:'2026-11-12'}),asOf,'backlog').reduce((n,b)=>n+b.count,0),0);
});
test('solution stability uses a mature 14-day cohort and counts each case only once',()=>{
 const make=(id,reopens)=>ticket({id,status:reopens.length?'in_progress':'resolved',createdAt:'2026-10-01T08:00:00Z',createdOn:'2026-10-01',reopenCount:reopens.length,workflowEvents:[event('1','created','2026-10-01T08:00:00Z','new'),event('2','resolved','2026-10-02T08:00:00Z','resolved'),...reopens.map((d,i)=>event('r'+i,'reopened',d,'in_progress'))]});
 const result=m.stability([make('stable',[]),make('reopened',['2026-10-03T08:00:00Z','2026-10-05T08:00:00Z']),ticket(),{...make('import',[]),isHistorical:true}],asOf);
 assert.deepEqual(result,{eligible:2,reopened:1,stable:1,rate:.5});
});
test('wide date ranges aggregate without dropping late data or creating 800 truncated buckets',()=>{
 const data=[ticket({createdOn:'2026-11-01'}),ticket({id:'last',createdOn:'2099-01-01',reportedOn:'2099-01-01'})];
 const buckets=m.timeBuckets(data,f({basis:'created',from:'1900-01-01',to:'2100-01-01'}),asOf);assert.ok(buckets.length<50);assert.equal(buckets.reduce((n,b)=>n+b.count,0),2);
});
test('CSV exports the selected case population with Arabic, safe cells and no account credentials',()=>{
 const csv=m.businessCsv([ticket({customerName:'=HYPERLINK(1)',credential:'PRIVATE-CREDENTIAL',subject:'سطر أول\n"تفاصيل"'})]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=HYPERLINK(1)"));assert.ok(csv.includes('""تفاصيل""'));assert.ok(!csv.includes('PRIVATE-CREDENTIAL'));
});
test('loader cursor-pages more than 500 tickets and more than 500 workflow events independently',async()=>{
 const tickets=Array.from({length:1001},(_,i)=>({id:'t'+String(i).padStart(4,'0'),ticket_number:'T'+i,created_at:'2026-01-01T08:00:00Z',status:'new',source:'call_center',reporter_id:'owner',created_by:'admin'}));
 const events=Array.from({length:1201},(_,i)=>({id:'e'+String(i).padStart(4,'0'),ticket_id:'t0000',kind:i?'comment':'created',created_at:'2026-01-01T09:00:00Z',to_status:i?null:'new',actor:{role:'support_agent'},resolution_snapshot:{response:'not-exported',cause:'Cause'}}));
 const requests=[];const db={from(table){let cursor='';return {select(){return this;},lte(){return this;},order(){return this;},limit(){return this;},gt(_,value){cursor=value;return this;},then(resolve){requests.push({table,cursor});const data=table==='tickets'?tickets:table==='ticket_workflow_events'?events:[{code:'call_center',name:'Call Center',is_active:true}];return Promise.resolve({data:data.filter(r=>!cursor||r.id>cursor).slice(0,500),error:null}).then(resolve);}};}};
 const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/tickets/load-analytics.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};vm.runInNewContext(compiled,{exports:mod.exports,require:id=>id==='server-only'?{}:id==='@/lib/supabase/server'?{createClient:async()=>db}:id==='./dashboard-model'?require(join(directory,'dashboard-model.js')):assert.fail('Unexpected dependency '+id),Date,Map,Set});
 const result=await mod.exports.loadAnalytics();assert.equal(result.tickets.length,1001);assert.equal(result.tickets[0].workflowEvents.length,1201);assert.equal(result.tickets[0].workflowEvents[0].actorRole,'support_agent');assert.ok(!('response' in result.tickets[0].workflowEvents[0].resolution_snapshot));assert.ok(requests.filter(r=>r.table==='ticket_workflow_events').length>=3);
});
