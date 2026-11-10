"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { addTicketNote } from "@/app/(app)/tickets/actions";
import { SaveButton } from "./save-button";

const DraftContext = createContext<{ dirty: boolean; setDirty: (dirty: boolean) => void; noteDirty: boolean; setNoteDirty: (dirty: boolean) => void }>({ dirty: false, setDirty: () => {}, noteDirty: false, setNoteDirty: () => {} });
export const useCaseDraft = () => useContext(DraftContext);
export function CaseSession({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  return <DraftContext.Provider value={{ dirty, setDirty, noteDirty, setNoteDirty }}>{children}</DraftContext.Provider>;
}
export function CaseNoteComposer({ ticketId, returnTo, preview = false }: { ticketId: string; returnTo: string; preview?: boolean }) {
  const { dirty, noteDirty, setNoteDirty } = useCaseDraft();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
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
  return <form action={addTicketNote} className="desk-note-form" onSubmit={(event) => { if (dirty || preview) { event.preventDefault(); setMessage(dirty ? "Save or discard case changes before adding a separate note." : "Preview only: no note was added."); } }}>
    <input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="returnTo" value={returnTo} />
    <label className="desk-field" htmlFor="case-internal-note"><span>Add an internal note</span><textarea id="case-internal-note" name="body" dir="auto" rows={3} required value={body} disabled={dirty} onChange={(event) => { setBody(event.target.value); setNoteDirty(Boolean(event.target.value.trim())); }} placeholder="Context for the next teammate, a handover or an investigation update…" /></label>
    {dirty && <p className="desk-form-warning">Save or discard case changes first. Internal notes are saved separately.</p>}
    <SaveButton disabled={dirty || !body.trim()}>Add internal note</SaveButton>{body && <button type="button" className="desk-discard" onClick={() => { setBody(""); setNoteDirty(false); }}>Clear note draft</button>}{message && <p role="status">{message}</p>}
  </form>;
}
