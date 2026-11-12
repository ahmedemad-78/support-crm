"use client";
import { useCallback, useState } from "react";
import { ReplyReadMarker } from "@/components/tickets/reply-read-marker";
const first="10000000-0000-4000-8000-000000000001",later="10000000-0000-4000-8000-000000000002";
export function ReplyReadPreview(){
 const [fail,setFail]=useState(true);const [events,setEvents]=useState([first]);const [calls,setCalls]=useState<string[][]>([]);
 const acknowledge=useCallback(async(_ticket:string,ids:string[])=>{if(fail)throw Error("Synthetic connection failure");setCalls(current=>[...current,ids]);return {ok:true};},[fail]);
 return <main className="mx-auto max-w-xl space-y-5 p-6"><header id="read-test-top"><h1>Conversation read acknowledgement · synthetic preview</h1><p role="status">Successful acknowledgements: {calls.length}</p><p>Last captured event count: {calls.at(-1)?.length||0}</p></header><button className="rounded border px-3 py-2" onClick={()=>setFail(false)}>Restore connection</button><button className="ml-3 rounded border px-3 py-2" onClick={()=>setEvents([first,later])}>Add later reply</button><a className="block underline" href="#case-followup">Read conversation</a><div className="h-[1100px] bg-stone-50 p-6">The conversation starts below the fold. Scrolling elsewhere must not mark replies read.</div><ReplyReadMarker ticketId="11111111-1111-4111-8111-111111111111" eventIds={events} readAction={acknowledge}/><section id="case-followup" className="min-h-[350px] rounded border bg-white p-6"><h2>Conversation</h2><p>Technical Support: please review the attached evidence.</p>{events.length>1&&<p>A new reply arrived later.</p>}<a className="mt-8 block underline" href="#read-test-top">Back to overview</a></section></main>;
}
