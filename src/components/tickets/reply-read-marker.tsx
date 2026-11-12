"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { markTicketRepliesRead } from "@/app/(app)/notifications/actions";
export function ReplyReadMarker({ticketId,eventIds,readAction=markTicketRepliesRead}:{ticketId:string;eventIds:string[];readAction?:(ticketId:string,eventIds:string[])=>Promise<{ok:boolean}>}){
 const [failed,setFailed]=useState(false);const [pending,start]=useTransition();const attempted=useRef("");const key=eventIds.join(",");
 const acknowledge=useCallback(()=>{
  if(!key)return;
  attempted.current=key;
  start(async()=>{try{const result=await readAction(ticketId,key.split(","));setFailed(!result.ok);}catch{setFailed(true);}});
 },[key,ticketId,readAction]);
 useEffect(()=>{
  if(!key||attempted.current===key)return;
  const conversation=document.getElementById("case-followup");if(!conversation)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&document.visibilityState==="visible"){observer.disconnect();acknowledge();}},{threshold:.25});
  const visible=()=>{if(document.visibilityState==="visible"&&attempted.current!==key){observer.unobserve(conversation);observer.observe(conversation);}};
  observer.observe(conversation);document.addEventListener("visibilitychange",visible);return()=>{observer.disconnect();document.removeEventListener("visibilitychange",visible);};
 },[key,acknowledge]);
 return failed?<p className="px-5 py-3 text-xs text-amber-800" role="status">Replies loaded, but we couldn’t update their read status. <button type="button" disabled={pending} onClick={acknowledge} className="underline">{pending?"Retrying…":"Try again"}</button></p>:null;
}
