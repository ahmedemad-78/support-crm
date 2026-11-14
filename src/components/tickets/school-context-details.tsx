import "./school-context.css";
import { schoolContextEntries } from "@/lib/tickets/school-context";

export function SchoolContextDetails({value}:{value:unknown}) {
  const entries=schoolContextEntries(value);if(!entries.length)return null;
  return <details className="desk-technical-context school-context-details" open><summary>30 June / MySchool details</summary><dl>{entries.map(([label,text])=><div key={label}><dt>{label}</dt><dd dir="auto">{text}</dd></div>)}</dl></details>;
}
