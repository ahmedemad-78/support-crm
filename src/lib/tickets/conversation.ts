export type ConversationEvent = { id:string; created_at:string; kind:string; actorRole?:string|null; resolution_snapshot:unknown };
export function chronologicalEvents<T extends ConversationEvent>(events:T[]):T[] {
  return [...events].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
export function conversationSide(role:string|null|undefined) {
  if(role==="support_agent")return "support";
  if(["moderation","call_center","june_schools","business_development"].includes(role??""))return "reporter";
  return "unknown";
}
export function resolutionSnapshot(value:unknown):Record<string,string> {
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  const allowed=["response","cause","action","outcome","request_type","topic"];
  return Object.fromEntries(Object.entries(value).filter(([key,text])=>allowed.includes(key)&&typeof text==="string"&&text.trim()).map(([key,text])=>[key,String(text)]));
}
