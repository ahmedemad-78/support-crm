import Image from "next/image";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  return (
    <main className="login-layout login-editorial min-h-svh">
      <section className="login-entry flex flex-col justify-between gap-10 px-6 py-8 sm:px-12 lg:px-16">
        <Image src="/brand/logo.jpg" alt="Selah El Telmeez" width={1476} height={570} priority sizes="140px" className="h-12 w-auto self-start object-contain" style={{ width: "auto" }} />
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <div className="space-y-3">
            <p className="login-kicker">SELAH EL TELMEEZ / SUPPORT DESK</p>
            <h1 className="login-heading">Good work<br />starts here.</h1>
            <p className="text-[15px] leading-6 text-[#5d6b63]">Your cases, your team, and the next step.<br />Sign in to your support workspace.</p>
          </div>
          <div className="login-form-surface">
            <LoginForm deactivated={reason === "inactive"} />
          </div>
          <p className="text-[13px] leading-5 text-[#5d6b63]">Need an account or a password reset? Contact the Digital Team.</p>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5d6b63]">
          <span>© 2026 Selah El Telmeez</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Internal team workspace</span>
        </footer>
      </section>
      <section className="login-story hidden overflow-hidden lg:flex" aria-hidden="true">
        <div className="login-story-content">
          <p className="login-story-masthead">SUPPORT CENTER <span>SE / 01</span></p>
          <div>
            <p className="login-story-index">A little clarity. A better next step.</p>
            <h2>Behind every<br />case is<br /><em>someone<br />counting on us.</em></h2>
            <div className="login-case-path"><span>Listen</span><span>Understand</span><span>Resolve <ArrowUpRight size={16} /></span></div>
          </div>
          <div className="login-story-footer"><span>For learners. For schools.<br />For the people who help them.</span><Image src="/brand/mascot.jpg" alt="" width={72} height={80} className="object-contain" style={{ width: "72px", height: "auto" }} /></div>
        </div>
      </section>
    </main>
  );
}
