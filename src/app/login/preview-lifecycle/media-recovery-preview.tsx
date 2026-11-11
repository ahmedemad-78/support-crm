"use client";
import { useState } from "react";
import { AttachmentPreview } from "@/components/tickets/attachment-preview";

/** Dev-only parent route: keep the same attachment mounted when its URL renews. */
export function MediaRecoveryPreview(){
  const [renewed,setRenewed]=useState(false);
  return <main className="mx-auto max-w-lg space-y-5 p-6"><h1>Attachment access recovery · synthetic preview</h1><p>The first URL deliberately fails. Renewing it must recover without remounting the attachment.</p><AttachmentPreview attachment={{id:"same-attachment",file_name:"Recovery example.jpg",mime_type:"image/jpeg",url:renewed?"/brand/logo.jpg?renewed=1":"/brand/missing-preview-test.jpg"}}/><button className="rounded border px-4 py-3" type="button" onClick={()=>setRenewed(true)}>Renew preview link</button></main>;
}
