import { requireUser } from "@/lib/auth/session";
import { loadCaseRegister } from "@/lib/tickets/load-case-register";
import { RegisterReport } from "@/components/tickets/register-report";
import { STATUS_LABELS } from "@/lib/tickets/constants";

export default async function CaseRegisterPrintPage({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const user=await requireUser(["support_agent","manager"]);
  const data=await loadCaseRegister(await searchParams,user,true);
  const f=data.filters;
  const selection=[f.q&&`Search: ${f.q}`,f.source&&`Source: ${data.sources.find(s=>s.code===f.source)?.name||f.source}`,f.status&&`Status: ${STATUS_LABELS[f.status]}`,f.assignee&&`Assignee: ${f.assignee==="unassigned"?"Unassigned":data.agents.find(a=>a.id===f.assignee)?.full_name||"Selected agent"}`,f.city&&`City: ${data.cities.find(c=>String(c.id)===f.city)?.name||f.city}`,f.category&&`Category: ${data.categories.find(c=>String(c.id)===f.category)?.name||f.category}`,f.range!=="all"&&`Created: last ${f.range} days`,data.scope&&`Dashboard scope: ${Object.entries(data.extras).map(([k,v])=>`${k}: ${v}`).join(", ")}`].filter((item):item is string=>Boolean(item));
  return <RegisterReport tickets={data.tickets} filters={f} extras={data.extras} sources={data.sources} generatedAt={new Date().toISOString()} selection={selection}/>;
}
