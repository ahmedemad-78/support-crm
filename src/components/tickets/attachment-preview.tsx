"use client";
/* eslint-disable @next/next/no-img-element -- Private signed URLs and local blobs are displayed without a public image optimizer. */
import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { attachmentMime } from "@/lib/tickets/intake";
import "./attachments.css";

export type MediaAttachment = { id:string; file_name:string; mime_type:string; url?:string|null; size_bytes?:number };
export function AttachmentPreview({attachment,remove,disabled=false,local=false}:{attachment:MediaAttachment;remove?:()=>void;disabled?:boolean;local?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null); const [failed,setFailed]=useState(false);
  const {file_name:name,mime_type:type,url,size_bytes:size}=attachment;
  const image=type.startsWith("image/"); const video=type.startsWith("video/"); const audio=type.startsWith("audio/");
  const download=url?(local?url:`${url}${url.includes("?")?"&":"?"}download=${encodeURIComponent(name)}`):undefined;
  return <figure className="attachment-card">
    <div className={`attachment-media${audio?" is-audio":""}${!image&&!video&&!audio?" is-document":""}`}>
      {url&&!failed?image?<button type="button" className="attachment-image-button" aria-label={`Preview ${name}`} onClick={()=>dialog.current?.showModal()}><img src={url} alt={name} loading="lazy" onError={()=>setFailed(true)}/><span><ExternalLink size={13}/>View image</span></button>:video?<video src={url} controls playsInline preload="metadata" onError={()=>setFailed(true)} aria-label={name}/>:audio?<audio src={url} controls preload="metadata" onError={()=>setFailed(true)} aria-label={name}/>:<FileText size={32}/>:<p>{failed?"Preview unavailable. Download the file, or refresh the case to renew access.":"Preview unavailable. Refresh this case to renew access."}</p>}
    </div>
    <figcaption><div><strong title={name} dir="auto">{name}</strong><small>{audio?"Audio":video?"Video":image?"Image":type==="application/pdf"?"PDF":"Document"}{size?` · ${size>=1048576?(size/1048576).toFixed(1)+" MB":Math.ceil(size/1024)+" KB"}`:""}</small></div><div className="attachment-actions">{download&&<a href={download} download={name} aria-label={`Download ${name}`} title="Download"><Download size={16}/></a>}{url&&!image&&!audio&&!video&&<a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${name}`} title="Open file"><ExternalLink size={16}/></a>}{remove&&<button type="button" onClick={remove} disabled={disabled} aria-label={`Remove ${name}`} title="Remove attachment"><X size={16}/></button>}</div></figcaption>
    {image&&url&&<dialog ref={dialog} className="attachment-lightbox" aria-label={`Image preview: ${name}`} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}><header><strong dir="auto">{name}</strong><button type="button" onClick={()=>dialog.current?.close()} aria-label="Close image preview"><X size={20}/></button></header><img src={url} alt={name}/></dialog>}
  </figure>;
}
export function LocalAttachmentPreview({file,id,remove,disabled}:{file:File;id:string;remove:()=>void;disabled?:boolean}) {
  const [url,setUrl]=useState<string>();
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);const frame=requestAnimationFrame(()=>setUrl(objectUrl));return()=>{cancelAnimationFrame(frame);URL.revokeObjectURL(objectUrl);};},[file]);
  return <AttachmentPreview attachment={{id,file_name:file.name,mime_type:attachmentMime(file),size_bytes:file.size,url}} local remove={remove} disabled={disabled}/>;
}
