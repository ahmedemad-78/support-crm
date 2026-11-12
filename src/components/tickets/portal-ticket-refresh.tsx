"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export function PortalTicketRefresh({userId,preview=false}:{userId:string;preview?:boolean}){
 const router=useRouter();const [pending,start]=useTransition();const [offline,setOffline]=useState(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  if(preview)return;
  const db=createClient();const update=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{if(document.visibilityState==="visible")start(()=>router.refresh());},300);};
  const channel=db.channel(`my-tickets:${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`recipient_id=eq.${userId}`},update).subscribe(status=>setOffline(status==="CHANNEL_ERROR"||status==="TIMED_OUT"));
  window.addEventListener("focus",update);return()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener("focus",update);void db.removeChannel(channel);};
 },[preview,router,userId]);
 return <div className="portal-refresh"><button type="button" disabled={pending} onClick={()=>{if(!preview)start(()=>router.refresh());}}><RefreshCw size={14} className={pending?"animate-spin":""}/>{pending?"Refreshing…":"Refresh"}</button>{offline&&<small>Live updates paused. Refresh to check.</small>}</div>;
}
