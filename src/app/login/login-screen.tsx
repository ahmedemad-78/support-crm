import { ArrowUpRight, BookOpenCheck, Mail, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { LoginArtwork } from "./login-artwork";
import type { SignInState } from "./actions";
import "./login.css";

const helpHref = "mailto:ahmed.emad@selaheltelmeez.com?subject=Support%20Center%20%E2%80%94%20Sign-in%20help&body=Hello%20Ahmed%2C%0A%0AI%20need%20help%20accessing%20Support%20Center.%0AWork%20email%3A%20%0AIssue%3A%20%0A%0A";

export function LoginScreen({ deactivated = false, initialState }: { deactivated?: boolean; initialState?: SignInState }) {
  return <main className="login-v2">
    <section className="auth-brand-pane" aria-label="Selah El Telmeez Technical Support Center">
      <header className="auth-brand-header">
        <svg className="auth-brand-logo" viewBox="0 0 1476 570" role="img" aria-label="Selah El Telmeez">
          <defs><filter id="auth-logo-cutout" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -.2126 -.7152 -.0722 0 1" />
            <feComponentTransfer result="lettering"><feFuncA type="linear" slope="2.4" intercept="-.12" /></feComponentTransfer>
            <feFlood className="auth-logo-ink" result="ink" /><feComposite in="ink" in2="lettering" operator="in" />
          </filter></defs>
          <image href="/brand/logo.jpg" width="1476" height="570" filter="url(#auth-logo-cutout)" />
        </svg>
        <span className="auth-wordmark"><BookOpenCheck className="auth-mobile-mark" aria-hidden="true" /><span>TECHNICAL SUPPORT<strong>CENTER</strong></span></span>
      </header>
      <div className="auth-brand-body">
        <p className="auth-eyebrow"><span /> THE CASEBOOK</p>
        <h2 className="auth-headline"><span>Every case.</span><em>A clear next step.</em></h2>
        <p className="auth-brand-description">One place for issues, answers and follow-up.</p>
        <LoginArtwork />
      </div>
      <footer className="auth-brand-footer"><div className="auth-art-caption" aria-hidden="true"><span><i />Record</span><b /><span><i />Resolve</span><b /><span><i />Follow up</span></div><div className="auth-brand-legal"><span>SELAH EL TELMEEZ</span><span>People behind every case.</span></div></footer>
    </section>
    <section className="auth-form-pane" aria-labelledby="signin-heading">
      <div className="auth-form-meta"><ShieldCheck size={15} aria-hidden="true" /> Internal workspace</div>
      <div className="auth-form-content">
        <div className="auth-form-heading"><h1 id="signin-heading">Welcome back<span>.</span></h1><p>Sign in to your support workspace.</p></div>
        <LoginForm deactivated={deactivated} initialState={initialState} />
        <div className="auth-account-help"><Mail aria-hidden="true" /><div><p>Need help signing in?</p><a href={helpHref}>Email Ahmed Emad <ArrowUpRight aria-hidden="true" size={15} /></a><span>For access or a password reset. Never send your password.</span></div></div>
      </div>
      <footer className="auth-form-footer">© {new Date().getFullYear()} Selah El Telmeez</footer>
    </section>
  </main>;
}
