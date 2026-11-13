"use client";
import { createContext, useContext, useEffect, useState, useActionState, startTransition } from "react";
import { saveInternalNote } from "@/app/(app)/tickets/actions";


const DraftContext = createContext<{ dirty: boolean; setDirty: (dirty: boolean) => void; noteDirty: boolean; setNoteDirty: (dirty: boolean) => void }>({ dirty: false, setDirty: () => {}, noteDirty: false, setNoteDirty: () => {} });
export const useCaseDraft = () => useContext(DraftContext);
export function CaseSession({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  return <DraftContext.Provider value={{ dirty, setDirty, noteDirty, setNoteDirty }}>{children}</DraftContext.Provider>;
}
export function CaseNoteComposer({ ticketId, returnTo, preview = false }: { ticketId: string; returnTo: string; preview?: boolean }) {
  const { noteDirty, setNoteDirty } = useCaseDraft();
  const [body, setBody] = useState("");
  const [savedNotes,setSavedNotes]=useState<string[]>([]);
  const [result,action,pending]=useActionState(async(previous:{error:string;saved:string},data:FormData)=>{
    if(preview)return {error:"Preview only: no note was added.",saved:""};
    const next=await saveInternalNote(previous,data);if(next.saved){setSavedNotes(notes=>[next.saved,...notes]);setBody("");setNoteDirty(false);}return next;
  },{error:"",saved:""});
  useEffect(() => {
    if (!noteDirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const next = new URL(link.href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      if (!window.confirm("You have an unsaved internal note. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [noteDirty]);
  return <form className="desk-note-form" onSubmit={event=>{event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);startTransition(()=>action(data));}}>
    <input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="returnTo" value={returnTo} />
    <label className="desk-field" htmlFor="case-internal-note"><span>Add an internal note</span><textarea id="case-internal-note" name="body" dir="auto" rows={3} maxLength={4000} minLength={2} required value={body} disabled={pending} onChange={(event) => { setBody(event.target.value); setNoteDirty(Boolean(event.target.value.trim())); }} placeholder="Context for the next teammate, a handover or an investigation update…" /></label>
    
    <button className="desk-save" type="submit" disabled={pending||body.trim().length<2}>{pending?"Saving note…":"Save internal note"}</button>{body && <button type="button" className="desk-discard" onClick={() => { setBody(""); setNoteDirty(false); }}>Clear note draft</button>}{result.error&&<p role="alert" className="desk-form-error">{result.error}</p>}{savedNotes.map((note,index)=><div key={index} role="status" className="desk-feedback"><strong>Internal note saved</strong><p dir="auto">{note}</p></div>)}
  </form>;
}
