"use client";

import { useRef, type PointerEvent } from "react";

/** Small, pointer-driven book tilt. No timers, subscriptions or animation library. */
export function LoginArtwork() {
  const art = useRef<HTMLDivElement>(null);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    art.current?.style.setProperty("--book-x", `${(0.5 - (event.clientY - bounds.top) / bounds.height) * 5}deg`);
    art.current?.style.setProperty("--book-y", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 7}deg`);
  }
  function reset() {
    art.current?.style.setProperty("--book-x", "0deg");
    art.current?.style.setProperty("--book-y", "0deg");
  }
  return (
    <div className="auth-artwork" aria-hidden="true" onPointerMove={move} onPointerLeave={reset}>
      <div className="auth-book" ref={art}>
        <svg viewBox="0 0 600 360" fill="none" focusable="false">
          <ellipse className="auth-book-shadow" cx="300" cy="310" rx="210" ry="18" fill="#05170f" />
          <path className="auth-book-back" d="M60 106C137 64 220 76 298 124C380 76 463 64 540 106V298C456 258 380 272 298 320C218 272 140 258 60 298V106Z" fill="#315941" stroke="#66866a" />
          <path className="auth-book-left" d="M74 82C146 44 220 58 298 106V302C220 254 146 240 74 278V82Z" fill="#cedeb6" />
          <path className="auth-book-right" d="M298 106C376 58 450 44 526 82V278C450 240 376 254 298 302V106Z" fill="#ebedce" />
          <path d="M298 107V300" stroke="#76926d" strokeWidth="1.5" />
          <g className="auth-page-lines" stroke="#5f8060" strokeWidth="2" strokeLinecap="round" opacity=".45">
            <path d="M106 110C160 88 213 102 264 132" pathLength="1" />
            <path d="M106 134C160 112 213 126 264 156" pathLength="1" />
            <path d="M106 158C160 136 213 150 238 165" pathLength="1" />
            <path d="M334 132C385 102 438 88 494 110" pathLength="1" />
            <path d="M334 156C385 126 438 112 494 134" pathLength="1" />
            <path d="M360 165C400 145 449 141 494 158" pathLength="1" />
          </g>
          <path className="auth-book-route" d="M128 224C194 184 244 270 300 229C356 188 402 192 470 215" pathLength="1" stroke="#26744b" strokeWidth="2.5" strokeLinecap="round" />
          <g className="auth-book-points" fill="#245e3d" stroke="#eef1d8" strokeWidth="3"><circle cx="128" cy="224" r="6" /><circle cx="300" cy="229" r="6" /><circle cx="470" cy="215" r="6" /></g>
          <path className="auth-book-check" d="M459 211L467 219L482 202" stroke="#245e3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="auth-art-caption"><span>01 <b>Listen</b></span><i /><span>02 <b>Understand</b></span><i /><span>03 <b>Resolve</b></span></div>
    </div>
  );
}
