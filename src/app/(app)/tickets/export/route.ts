import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCaseRegister } from "@/lib/tickets/load-case-register";
import { registerCsv } from "@/lib/tickets/register-export";

export async function GET(request: Request) {
  const user=await getCurrentUser();
  if (!user || !["support_agent","manager"].includes(user.role)) return new NextResponse("Forbidden",{status:403});
  const params=Object.fromEntries(new URL(request.url).searchParams);
  const {tickets,sources}=await loadCaseRegister(params,user,true);
  return new NextResponse(registerCsv(tickets,sources),{headers:{
    "Content-Type":"text/csv; charset=utf-8",
    "Content-Disposition":`attachment; filename="case-register-${new Date().toISOString().slice(0,10)}.csv"`,
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}
