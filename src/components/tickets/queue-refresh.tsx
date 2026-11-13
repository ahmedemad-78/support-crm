"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Refreshes the current URL, retaining selection, sorting and pagination. */
export function QueueRefresh({userId}:{userId:string}) {
  const router=useRouter();const [pending,start]=useTransition();const [updated,setUpdated]=useState("");
  useEffect(()=>{
    const db=createClient();let busy=false;let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=()=>{
      if(busy||document.visibilityState!=="visible"||document.querySelector('.queue-workspace input:focus, .queue-workspace select:focus, [role="dialog"]'))return;
      busy=true;start(()=>{router.refresh();setUpdated(new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}));});
      timer=setTimeout(()=>{busy=false;},1500);
    };
    const poll=setInterval(refresh,15000);
    const channel=db.channel(`case-register:${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`recipient_id=eq.${userId}`},refresh).subscribe();
    window.addEventListener("focus",refresh);window.addEventListener("online",refresh);
    return()=>{clearInterval(poll);clearTimeout(timer);window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);void db.removeChannel(channel);};
  },[router,userId]);
  return <div className="queue-live"><span>{pending?"Updating…":updated?`Updated ${updated} · auto updates 15s`:"Auto updates · 15s"}</span><button type="button" disabled={pending} onClick={()=>start(()=>router.refresh())}><RefreshCw size={14} className={pending?"animate-spin":""}/>Refresh</button></div>;
}
