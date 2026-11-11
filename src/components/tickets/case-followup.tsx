"use client";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUpRight, CheckCircle2, Headphones, LoaderCircle, LockKeyhole, MessageSquare, RefreshCw, RotateCcw, Send, UserRound } from "lucide-react";
import { submitCaseFollowup } from "@/app/(app)/tickets/lifecycle-actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { STATUS_LABELS, type TicketStatus } from "@/lib/tickets/constants";
import { chronologicalEvents, conversationSide, resolutionSnapshot } from "@/lib/tickets/conversation";
import "./conversation.css";
export type WorkflowEvent = { id:string; kind:string; body:string|null; created_at:string; actor_id:string|null; actorName?:string; actorRole?:string|null; to_status:string|null; resolution_snapshot:unknown };
type Props = { ticketId:string; version:string; status:TicketStatus; count:number; events:WorkflowEvent[]; canReply:boolean; relatedHref:string; preview?:boolean; reporterName?:string; perspective?:"support"|"reporter" };
const dayOf=(iso:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
export function CaseFollowup({ticketId,version,status,count,events,canReply,relatedHref,preview=false,reporterName,perspective="support"}:Props) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setReady(true));return()=>cancelAnimationFrame(frame);},[]);
  const router=useRouter(); const logRef=useRef<HTMLDivElement>(null); const stickToBottom=useRef(true);
  const [refreshing,refresh]=useTransition(); const [mode,setMode]=useState("comment"); const [body,setBody]=useState(""); const [requestId,setRequestId]=useState(""); const [validation,setValidation]=useState("");
  const [submitted,setSubmitted]=useState(""); const [nearBottom,setNearBottom]=useState(true);
  const [result,action,pending]=useActionState(async(previous:{error:string;success:string},data:FormData)=>{
    const next=preview?{error:"Preview only. Your draft is preserved; no message was sent.",success:""}:await submitCaseFollowup(previous,data);
    if(next.success){setBody("");setRequestId("");setMode("comment");stickToBottom.current=true;}
    return next;
  },{error:"",success:""});
  const ordered=chronologicalEvents(events); const finished=status==="resolved"||status==="closed"; const minimum=mode==="reopen"?5:2;
  const draftKey=JSON.stringify({body,mode}); const visibleError=validation||(submitted===draftKey?result.error:"");
  useEffect(()=>{if(stickToBottom.current&&logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[events.length]);
  function latest(){stickToBottom.current=true;setNearBottom(true);if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;}
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(pending)return;
    if(body.trim().length<minimum){setValidation(mode==="reopen"?"Explain why the same problem continues (at least 5 characters).":"Write a message of at least 2 characters.");document.getElementById(`followup-${ticketId}`)?.focus();return;}
    setValidation("");setSubmitted(draftKey);
    const data=new FormData(event.currentTarget); const id=requestId||crypto.randomUUID();setRequestId(id);data.set("requestId",id);
    startTransition(()=>action(data));
  }
  return <section className="desk-panel case-conversation" id="case-followup" aria-labelledby={`conversation-title-${ticketId}`}>
    <header className="conversation-header"><div className="conversation-heading"><span className="conversation-symbol"><MessageSquare size={21}/></span><div><span className="conversation-eyebrow">CASE CONVERSATION</span><h3 id={`conversation-title-${ticketId}`}>Support & reporting team</h3><p>{reporterName?`${reporterName} · Technical Support`:"Messages shared with the reporting owner and Technical Support"}</p></div></div><div className="conversation-header-actions">{count>0&&<span className="conversation-reopen-count"><RotateCcw size={13}/>Reopened ×{count}</span>}<button type="button" aria-label="Refresh conversation" title="Refresh conversation" disabled={refreshing||pending} onClick={()=>{if(!preview)refresh(()=>router.refresh());}}><RefreshCw size={17} className={refreshing?"animate-spin":""}/><span>Refresh</span></button></div></header>
    <div className="conversation-visibility"><LockKeyhole size={13}/><span>Shared conversation · Internal notes stay separate.</span><span className="conversation-current-status">{STATUS_LABELS[status]}</span></div>
    <div className="conversation-thread" ref={logRef} role="log" aria-label="Case conversation messages" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={event=>{const node=event.currentTarget;const atBottom=node.scrollHeight-node.scrollTop-node.clientHeight<72;stickToBottom.current=atBottom;setNearBottom(atBottom);}}>
      {!ordered.length?<div className="conversation-empty"><MessageSquare size={28}/><h4>No messages yet</h4><p>Use this conversation to exchange updates about this case. Earlier status changes remain in the case timeline.</p></div>:<ol className="conversation-messages">{ordered.map((event,index)=>{
        const day=dayOf(event.created_at);const showDay=index===0||dayOf(ordered[index-1].created_at)!==day;
        const system=event.kind==="created"||event.kind==="status_changed";
        const side=conversationSide(event.actorRole);const actor=event.actorName||"Team member"; const role=ROLE_LABELS[event.actorRole as Role]||"Participant";
        const snapshot=resolutionSnapshot(event.resolution_snapshot);const message=event.kind==="resolved"?(snapshot.response||event.body):event.body;
        return <li key={event.id} className="conversation-entry">{showDay&&<div className="conversation-day"><span>{formatDate(day)}</span></div>}{system?<div className="conversation-system"><span className="conversation-system-dot"/><div><p><strong>{event.kind==="created"?"Case created":STATUS_LABELS[event.to_status as TicketStatus]||"Status updated"}</strong><span> · {actor}</span></p>{event.kind==="created"&&message&&<p className="conversation-system-body" dir="auto">{message}</p>}<time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></div></div>:<article className={`conversation-message is-${side}${event.kind==="reopened"?" is-reopening":""}${event.kind==="resolved"?" is-resolution":""}`}>
          <div className="conversation-avatar" aria-hidden="true">{side==="support"?<Headphones size={17}/>:<UserRound size={17}/>}</div><div className="conversation-message-content"><div className="conversation-author"><strong dir="auto">{actor}</strong><span>{role}</span></div><div className="conversation-bubble">{event.kind==="resolved"&&<div className="conversation-event-label"><CheckCircle2 size={15}/>Resolved & closed</div>}{event.kind==="reopened"&&<div className="conversation-event-label"><RotateCcw size={15}/>Same problem · case reopened</div>}{message&&<p dir="auto">{message}</p>}{event.kind==="resolved"&&Object.keys(snapshot).some(key=>key!=="response")&&<details className="conversation-resolution-details"><summary>Resolution details</summary><dl>{[["request_type","Request type"],["topic","Topic"],["cause","Cause"],["action","Action"],["outcome","Outcome"]].map(([key,label])=>snapshot[key]&&<div key={key}><dt>{label}</dt><dd dir="auto">{snapshot[key]}</dd></div>)}</dl></details>}</div><time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></div>
        </article>}</li>;
      })}</ol>}
    </div>
    {!nearBottom&&<div className="conversation-latest"><button type="button" onClick={latest}><ArrowDown size={14}/>Latest messages</button></div>}
    {canReply?<form method="post" onSubmit={submit} inert={!ready} noValidate className="conversation-composer" aria-busy={!ready||pending}>
      <input type="hidden" name="ticketId" value={ticketId}/><input type="hidden" name="version" value={version}/><input type="hidden" name="mode" value={mode}/><input type="hidden" name="requestId" value={requestId}/>
      <div className="conversation-compose-heading"><label htmlFor={`followup-${ticketId}`}>{mode==="reopen"?"Why does the same problem continue?":perspective==="reporter"?"Reply to Technical Support":"Reply to the reporting team"}</label>{finished&&<button type="button" className="conversation-reopen-toggle" aria-pressed={mode==="reopen"} disabled={pending} onClick={()=>{setMode(mode==="reopen"?"comment":"reopen");setRequestId("");setValidation("");}}><RotateCcw size={13}/>{mode==="reopen"?"Cancel reopening":"Reopen this case"}</button>}</div>
      {mode==="reopen"&&<p className="conversation-reopen-help">Sending this reason reopens the same case and increases its reopen count. A regular reply keeps the status unchanged.</p>}
      <textarea id={`followup-${ticketId}`} name="body" dir="auto" value={body} maxLength={4000} rows={3} disabled={pending} aria-invalid={Boolean(visibleError)} aria-describedby={`followup-help-${ticketId}${visibleError?` followup-error-${ticketId}`:""}`} placeholder={mode==="reopen"?"What did the customer try, and what is still happening?":"Write an update, answer or question about this case…"} onChange={event=>{setBody(event.target.value);setRequestId(crypto.randomUUID());setValidation("");}}/>
      {visibleError&&<p className="conversation-error" id={`followup-error-${ticketId}`} role="alert">{visibleError}</p>}{result.success&&!body&&<p className="conversation-success" role="status"><CheckCircle2 size={14}/>{result.success}</p>}
      <div className="conversation-compose-footer"><p id={`followup-help-${ticketId}`}>{mode==="reopen"?"Reopen reason":"Reply only · case status stays unchanged"}<span>{body.length.toLocaleString()} / 4,000</span></p><button type="submit" className="conversation-send" disabled={!ready||pending}>{pending?<LoaderCircle size={16} className="animate-spin"/>:<Send size={16}/>}<span>{pending?"Sending…":mode==="reopen"?"Reopen & send":"Send reply"}</span></button></div>
    </form>:<p className="conversation-readonly"><LockKeyhole size={14}/>Read-only conversation · Technical Support and the reporting owner can reply.</p>}
    {canReply&&<footer className="conversation-related"><span>Have a different problem?</span><Link href={relatedHref}>Open a linked case<ArrowUpRight size={13}/></Link></footer>}
  </section>;
}
