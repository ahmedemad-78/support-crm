"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Snapshot } from "@/lib/tickets/business-analytics";
export function useLiveAnalytics(initial:Snapshot,{preview=false,userId,previewLoader}:{preview?:boolean;userId?:string;previewLoader?:()=>Promise<Snapshot>}){
 const [snapshot,setSnapshot]=useState(initial),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");
 const flight=useRef<AbortController|null>(null),queued=useRef(false),mounted=useRef(true),retry=useRef<(()=>Promise<void>)|null>(null);
 const load=useCallback(async()=>{
  if(preview&&!previewLoader)return;if(flight.current){queued.current=true;return;}
  const controller=new AbortController();flight.current=controller;setRefreshing(true);const timeout=setTimeout(()=>controller.abort(),20000);
  try{const next=previewLoader?await previewLoader():await(async()=>{const res=await fetch("/dashboard/data",{cache:"no-store",credentials:"same-origin",signal:controller.signal});if(!res.ok)throw new Error("Refresh failed");return await res.json() as Snapshot;})();
   if(!Array.isArray(next.tickets)||!next.asOf)throw new Error("Invalid response");if(mounted.current&&!controller.signal.aborted){setSnapshot(next);setError("");}
  }catch{if(mounted.current)setError("Update unavailable. Last successful data is displayed. Retrying automatically.");}
  finally{clearTimeout(timeout);flight.current=null;if(mounted.current){setRefreshing(false);if(queued.current){queued.current=false;void retry.current?.();}}}
 },[preview,previewLoader]);
 useEffect(()=>{mounted.current=true;retry.current=load;if(preview&&!previewLoader)return;let debounce:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{if(document.visibilityState!=="visible")return;if(debounce)clearTimeout(debounce);debounce=setTimeout(()=>void load(),400);};
  const interval=setInterval(update,15000);window.addEventListener("focus",update);window.addEventListener("online",update);document.addEventListener("visibilitychange",update);
  const db=!preview&&userId?createClient():null;const channel=db?.channel(`analytics-updates:${userId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`recipient_id=eq.${userId}`},update).subscribe();
  return()=>{mounted.current=false;queued.current=false;flight.current?.abort();clearInterval(interval);if(debounce)clearTimeout(debounce);window.removeEventListener("focus",update);window.removeEventListener("online",update);document.removeEventListener("visibilitychange",update);if(db&&channel)void db.removeChannel(channel);};
 },[load,preview,previewLoader,userId]);return {snapshot,refreshing,error,refresh:load};
}
