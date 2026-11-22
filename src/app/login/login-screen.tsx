import Image from "next/image";
import { Manrope, Playfair_Display } from "next/font/google";
import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { LoginArtwork } from "./login-artwork";
import type { SignInState } from "./actions";
import "./login.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["italic"], weight: ["400", "500"] });

const helpHref = "mailto:ahmed.emad@selaheltelmeez.com?subject=Support%20Center%20%E2%80%94%20Sign-in%20help&body=Hello%20Ahmed%2C%0A%0AI%20need%20help%20accessing%20Support%20Center.%0AWork%20email%3A%20%0AIssue%3A%20%0A%0A";

export function LoginScreen({ deactivated = false, initialState }: { deactivated?: boolean; initialState?: SignInState }) {
  return <main className={`login-v2 ${manrope.variable} ${playfair.variable}`}>
    <section className="auth-brand-pane" aria-label="Selah El Telmeez Technical Support Center">
      <header className="auth-brand-header">
        <Image src="/brand/logo.jpg" alt="Selah El Telmeez" width={1476} height={570} priority sizes="(max-width: 900px) 140px, 176px" className="auth-brand-logo" />
        <span className="auth-wordmark">TECHNICAL SUPPORT<strong>CENTER</strong></span>
      </header>
      <div className="auth-brand-body">
        <p className="auth-eyebrow"><span /> THE SUPPORT WORKSPACE</p>
        <h2 className="auth-headline"><span>Every issue.</span><span>Every update.</span><em>One clear solution.</em></h2>
        <p className="auth-brand-description">Track every request, manage every response, and keep every case moving forward.</p>
        <LoginArtwork />
      </div>
      <footer className="auth-brand-footer">A shared record. A thoughtful response.</footer>
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
