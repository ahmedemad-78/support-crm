import { notFound } from "next/navigation";
import { RegisterReport } from "@/components/tickets/register-report";
import { parseTicketListFilters } from "@/lib/tickets/filters";
import type { QueueRow } from "@/components/tickets/ticket-queue";

export default function RegisterReportPreview() {
  if(process.env.NODE_ENV!=="development")notFound();
  const rows:QueueRow[]=Array.from({length:32},(_,i)=>({id:String(i),ticket_number:`DEMO-${i+1}`,customer_name:"عميل تجريبي",issue_description:"العميل دفع الاشتراك والمحتوى لسه مقفول. محتاجين نراجع التفعيل ونرجع له بالخطوات.",source:"call_center",status:i%2?"resolved":"new",created_at:"2026-11-12T08:00:00Z",reporter:{full_name:"قباني · Demo"},creator:{full_name:"Ahmed · Demo"},assignee:i%2?{full_name:"Demo Support"}:null,cities:{name:"القاهرة"},reopen_count:i%3,resolution_notes:i%2?"تمت مراجعة الدفع وتفعيل الاشتراك بنجاح.":null}));
  return <><p className="no-print" style={{padding:12,background:"#fff5dc"}}>Development preview · synthetic data only</p><RegisterReport tickets={rows} filters={parseTicketListFilters({})} extras={{}} sources={[{code:"call_center",name:"Call Center"}]} generatedAt="2026-11-12T12:00:00Z" selection={[]}/></>;
}
