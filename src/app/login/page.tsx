import Image from "next/image";
import { ArrowUpRight, CheckCheck, Headphones, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  return (
    <main className="login-layout min-h-svh bg-background">
      <section className="flex flex-col justify-between gap-12 px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        <div className="flex items-center gap-4">
          <Image src="/brand/logo.jpg" alt="Selah El Telmeez" width={132} height={52} priority className="h-13 w-auto object-contain" />
          <span className="h-8 border-l" />
          <span className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Support<br />Center</span>
        </div>
        <div className="animate-enter mx-auto flex w-full max-w-[400px] flex-col gap-7 py-6">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-brand/20 bg-brand-tint text-brand-action"><Headphones className="size-6" /></div>
          <div className="space-y-3">
            <p className="eyebrow">YOUR SUPPORT WORKSPACE</p>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[42px]">Welcome back.</h1>
            <p className="text-[15px] leading-6 text-muted-foreground">A little care makes a big difference.<br />Sign in to help your next customer.</p>
          </div>
          <LoginForm deactivated={reason === "inactive"} />
          <div className="rounded-xl border bg-muted/60 p-4 text-[13px] leading-5 text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Need a hand signing in?</p>
            Contact the Digital Team for an account or a password reset.
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© 2026 Selah El Telmeez</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Internal team workspace</span>
        </footer>
      </section>
      <section className="login-story relative m-4 ml-0 hidden flex-col justify-between overflow-hidden rounded-[28px] p-10 lg:flex xl:p-14">
        <div className="relative z-10 flex items-center justify-between">
          <span className="rounded-full border border-white/25 px-4 py-2 text-xs font-medium tracking-wide text-white/90">Built around better support</span>
          <ArrowUpRight className="size-6 text-white/70" />
        </div>
        <div className="relative z-10 my-8">
          <p className="mb-5 text-xs font-medium tracking-[0.2em] text-emerald-200 uppercase">Every conversation matters</p>
          <h2 className="max-w-lg text-[clamp(2.5rem,4vw,4.25rem)] leading-[1.08] font-semibold tracking-[-0.045em] text-white">A helping hand.<br /><span className="text-emerald-200">A brighter day.</span></h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-white/75">One shared space to understand issues, follow requests, and help students keep moving forward.</p>
        </div>
        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-5">
            <div className="shrink-0 overflow-hidden rounded-2xl bg-white p-2">
              <Image src="/brand/mascot.jpg" alt="" width={88} height={96} className="h-24 w-22 object-contain" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-200"><CheckCheck className="size-4" /> Connected by care</div>
              <p className="text-lg font-medium text-white">Every student request,<br />in one place.</p>
            </div>
          </div>
        </div>
        <span aria-hidden="true" className="story-orbit story-orbit-one" />
        <span aria-hidden="true" className="story-orbit story-orbit-two" />
      </section>
    </main>
  );
}
