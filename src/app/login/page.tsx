import Image from "next/image";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { LoginArtwork } from "./login-artwork";
import "./login.css";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  return (
    <main className="login-v2">
      <section className="auth-brand-pane" aria-label="Selah El Telmeez support workspace">
        <header className="auth-brand-header">
          <Image src="/brand/logo.jpg" alt="Selah El Telmeez" width={1476} height={570} priority sizes="180px" className="auth-brand-logo" />
          <span className="auth-wordmark">SUPPORT<br /><strong>WORKSPACE</strong></span>
        </header>
        <div className="auth-brand-body">
          <p className="auth-eyebrow auth-reveal auth-delay-1"><span /> PEOPLE FIRST. ALWAYS.</p>
          <h2 className="auth-headline"><span className="auth-headline-line"><span>Every case.</span></span><span className="auth-headline-line"><span>A clearer</span></span><span className="auth-headline-line"><em>way forward.</em></span></h2>
          <p className="auth-brand-description auth-reveal auth-delay-3">Good support starts with understanding.<br />Keep the context. Find the answer. Make a difference.</p>
          <LoginArtwork />
        </div>
        <footer className="auth-brand-footer auth-reveal auth-delay-3"><span>Built around the people<br />who help others move forward.</span><span className="auth-brand-signature">SE<span>↗</span></span></footer>
      </section>

      <section className="auth-form-pane" aria-labelledby="signin-heading">
        <div className="auth-form-meta"><span><ShieldCheck size={14} /> INTERNAL WORKSPACE</span><span className="auth-meta-mark" aria-hidden="true">01 / SIGN IN</span></div>
        <div className="auth-form-content">
          <div className="auth-form-heading auth-reveal auth-delay-1"><span className="auth-section-label">YOUR NEXT GOOD DAY</span><h1 id="signin-heading">Welcome back<span>.</span></h1><p>Your team. Your cases. A little more clarity.<br />Sign in and pick up where you left off.</p></div>
          <div className="auth-reveal auth-delay-2"><LoginForm deactivated={reason === "inactive"} /></div>
          <div className="auth-account-help auth-reveal auth-delay-3"><span className="auth-help-icon" aria-hidden="true"><ArrowUpRight size={16} /></span><p>Need access or a password reset?<br /><strong>Contact the Digital Team.</strong></p></div>
        </div>
        <footer className="auth-form-footer"><span>© 2026 Selah El Telmeez</span><span className="auth-footer-rule" aria-hidden="true" /><span>Care in every detail.</span></footer>
      </section>
    </main>
  );
}
