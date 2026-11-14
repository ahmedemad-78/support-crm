"use client";

import { useEffect, useRef, type PointerEvent } from "react";

/** A support ticket moving from intake to follow-up: one entrance sequence and bounded, frame-paced parallax. */
export function LoginArtwork() {
  const art = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const point = useRef({ x: 0, y: 0 });
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    point.current = { x: (0.5 - (event.clientY - bounds.top) / bounds.height) * 5, y: ((event.clientX - bounds.left) / bounds.width - 0.5) * 7 };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      art.current?.style.setProperty("--flow-x", point.current.x + "deg");
      art.current?.style.setProperty("--flow-y", point.current.y + "deg");
      frame.current = null;
    });
  }
  function reset() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    art.current?.style.setProperty("--flow-x", "0deg");
    art.current?.style.setProperty("--flow-y", "0deg");
  }
  return <div className="auth-artwork" aria-hidden="true" onPointerMove={move} onPointerLeave={reset}>
    <div className="auth-flow" ref={art}>
      <svg viewBox="0 0 600 340" fill="none" focusable="false">
        <defs>
          <radialGradient id="flow-light"><stop stopColor="#C9EBD5" stopOpacity=".13" /><stop offset="1" stopColor="#C9EBD5" stopOpacity="0" /></radialGradient>
          <radialGradient id="flow-shadow"><stop stopColor="#04170F" stopOpacity=".6" /><stop offset="1" stopColor="#04170F" stopOpacity="0" /></radialGradient>
          <linearGradient id="flow-card" x1="110" y1="50" x2="410" y2="262" gradientUnits="userSpaceOnUse"><stop stopColor="#FBFBF5" /><stop offset="1" stopColor="#EEF1E6" /></linearGradient>
        </defs>
        <ellipse cx="300" cy="160" rx="290" ry="160" fill="url(#flow-light)" />
        <ellipse className="auth-flow-fade" cx="262" cy="300" rx="200" ry="22" fill="url(#flow-shadow)" />

        <g className="auth-flow-queue">
          <rect x="146" y="80" width="300" height="196" rx="18" fill="#1D4B38" stroke="#75A984" strokeOpacity=".22" />
          <rect x="128" y="68" width="300" height="196" rx="18" fill="#245A43" stroke="#75A984" strokeOpacity=".3" />
        </g>

        <path className="auth-flow-link" d="M410 102C446 102 452 88 470 88M410 226C440 226 446 238 462 238" stroke="#75A984" strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" />

        <g className="auth-flow-ticket">
          <rect x="110" y="56" width="300" height="196" rx="18" fill="url(#flow-card)" />
          <rect x="132" y="78" width="38" height="38" rx="11" fill="#C9EBD5" />
          <path d="M151 89V105M143 97H159" stroke="#1D4B38" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="184" y="83" width="118" height="10" rx="5" fill="#1D4B38" />
          <rect x="184" y="101" width="78" height="8" rx="4" fill="#75A984" fillOpacity=".55" />
          <g className="auth-flow-status">
            <rect x="314" y="80" width="78" height="26" rx="13" fill="#1D4B38" />
            <path d="M327 93L331 97L338 89" stroke="#C9EBD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="345" y="89.5" width="36" height="7" rx="3.5" fill="#C9EBD5" />
          </g>
          <rect x="132" y="132" width="250" height="7" rx="3.5" fill="#DCE4D7" />
          <rect x="132" y="147" width="196" height="7" rx="3.5" fill="#DCE4D7" />
          <path d="M126 176H394" stroke="#C8D4C3" strokeWidth="1.4" strokeDasharray="5 6" />
          <circle cx="110" cy="176" r="11" fill="#10382B" />
          <circle cx="410" cy="176" r="11" fill="#245A43" />
          <path d="M152 214H368" stroke="#DCE4D7" strokeWidth="3" strokeLinecap="round" />
          <path className="auth-flow-progress" d="M152 214H368" pathLength="1" stroke="#75A984" strokeWidth="3" strokeLinecap="round" />
          <g className="auth-flow-step auth-flow-step-1"><circle cx="152" cy="214" r="9" fill="#1D4B38" /><circle cx="152" cy="214" r="3" fill="#C9EBD5" /></g>
          <g className="auth-flow-step auth-flow-step-2"><circle cx="224" cy="214" r="9" fill="#1D4B38" /><circle cx="224" cy="214" r="3" fill="#C9EBD5" /></g>
          <g className="auth-flow-step auth-flow-step-3"><circle cx="296" cy="214" r="9" fill="#1D4B38" /><circle cx="296" cy="214" r="3" fill="#C9EBD5" /></g>
          <g className="auth-flow-step auth-flow-step-4"><circle cx="368" cy="214" r="13" fill="#75A984" fillOpacity=".22" /><circle cx="368" cy="214" r="10" fill="#1D4B38" /><path d="M363.5 214L366.8 217.3L372.8 211" stroke="#C9EBD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
        </g>

        <g className="auth-flow-track">
          <rect x="470" y="66" width="112" height="44" rx="22" fill="#C9EBD5" />
          <path d="M488 89H496L501 78L509 99L515 85L519 89H530" stroke="#1D4B38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="540" y="80" width="26" height="6" rx="3" fill="#1D4B38" fillOpacity=".75" />
          <rect x="540" y="92" width="18" height="6" rx="3" fill="#1D4B38" fillOpacity=".4" />
        </g>

        <g className="auth-flow-reply">
          <path d="M462 210C462 201.2 469.2 194 478 194H568C576.8 194 584 201.2 584 210V254C584 262.8 576.8 270 568 270H500L484 284V270H478C469.2 270 462 262.8 462 254V210Z" fill="#1D4B38" stroke="#75A984" strokeOpacity=".45" />
          <circle cx="486" cy="218" r="10" fill="#C9EBD5" />
          <rect x="504" y="212" width="64" height="7" rx="3.5" fill="#F7F7EF" fillOpacity=".8" />
          <rect x="504" y="225" width="42" height="7" rx="3.5" fill="#B9D9C5" fillOpacity=".55" />
          <g className="auth-flow-typing" fill="#C9EBD5"><circle cx="481" cy="251" r="3" /><circle cx="493" cy="251" r="3" /><circle cx="505" cy="251" r="3" /></g>
        </g>
      </svg>
    </div>
    <div className="auth-art-caption"><span><i />Track</span><b /><span><i />Resolve</span><b /><span><i />Follow up</span></div>
  </div>;
}
