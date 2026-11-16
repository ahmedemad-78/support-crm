import "./password-eye.css";

/** The blinking eye of the sign-in page. The parent button sets data-open and carries the eye-toggle class. */
export function PasswordEye() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="auth-eye">
    <g className="auth-eye-open"><g className="auth-eye-blink">
      <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12Z" />
      <g className="auth-eye-iris"><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none" /><circle cx="13.2" cy="10.8" r="1" fill="#fff" stroke="none" /></g>
    </g></g>
    <g className="auth-eye-closed">
      <path d="M3.5 10.2c2.4 3.8 5.2 5.7 8.5 5.7s6.1-1.9 8.5-5.7" />
      <path d="M5.9 13.8 4.3 16M9.3 15.5l-.7 2.6M14.7 15.5l.7 2.6M18.1 13.8l1.6 2.2" />
    </g>
  </svg>;
}
