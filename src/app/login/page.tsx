import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;

  return (
    <main className="flex min-h-screen">
      <section className="flex w-full max-w-[640px] flex-col justify-between px-10 py-12 sm:px-20">
        <Image
          src="/brand/logo.jpg"
          alt="Selah El Telmeez"
          width={168}
          height={66}
          priority
          className="h-[66px] w-auto object-contain"
        />

        <div className="flex w-full max-w-[400px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to the Support Center with your work email.</p>
          </div>
          <LoginForm deactivated={reason === "inactive"} />
          <p className="text-sm text-muted-foreground">
            Need an account or a new password? Contact the Digital Team.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">© 2026 Selah El Telmeez · Customer Technical Support</p>
      </section>

      <section className="hidden flex-1 flex-col items-center justify-center gap-8 bg-brand-tint px-16 lg:flex">
        <Image
          src="/brand/mascot.jpg"
          alt=""
          width={460}
          height={400}
          className="h-[400px] w-auto object-contain mix-blend-multiply"
        />
        <p className="text-center text-2xl font-semibold tracking-tight">Every student request, in one place</p>
      </section>
    </main>
  );
}
