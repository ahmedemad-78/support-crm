import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  return (
    <main className="login-layout min-h-svh bg-[#f4f7f5]">
      <section className="flex flex-col justify-between gap-10 px-6 py-8 sm:px-12 lg:px-16">
        <Image src="/brand/logo.jpg" alt="Selah El Telmeez" width={1476} height={570} priority sizes="140px" className="h-12 w-auto self-start object-contain" style={{ width: "auto" }} />
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <div className="space-y-2">
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#173126]">Welcome back</h1>
            <p className="text-[15px] leading-6 text-[#5d6b63]">Sign in to the support workspace.</p>
          </div>
          <div className="rounded-2xl border border-[#e1e8e3] bg-white p-5 shadow-[0_8px_24px_rgba(23,49,38,0.05)] sm:p-6">
            <LoginForm deactivated={reason === "inactive"} />
          </div>
          <p className="text-[13px] leading-5 text-[#5d6b63]">Need an account or a password reset? Contact the Digital Team.</p>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5d6b63]">
          <span>© 2026 Selah El Telmeez</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Internal team workspace</span>
        </footer>
      </section>
      <section className="login-story relative m-4 ml-0 hidden overflow-hidden rounded-3xl lg:flex" aria-hidden="true">
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <p className="text-sm font-medium tracking-[0.14em] uppercase text-white/80">Support Center</p>
          <div>
            <h2 className="max-w-sm text-4xl leading-tight font-semibold tracking-[-0.03em]">One place for every student request.</h2>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/80">Follow the case, the customer, and the next reply.</p>
          </div>
          <Image src="/brand/mascot.jpg" alt="" width={72} height={80} className="h-16 w-auto self-start rounded-xl bg-white object-contain p-1" style={{ width: "auto" }} />
        </div>
      </section>
    </main>
  );
}
