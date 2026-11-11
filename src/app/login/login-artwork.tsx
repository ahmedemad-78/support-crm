"use client";

import { useEffect, useRef, type PointerEvent } from "react";

/** An illustrated casebook: one entrance sequence and bounded, frame-paced parallax. */
export function LoginArtwork() {
  const art = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const point = useRef({ x: 0, y: 0 });
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    point.current = { x: (0.5 - (event.clientY - bounds.top) / bounds.height) * 4, y: ((event.clientX - bounds.left) / bounds.width - 0.5) * 4 };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      art.current?.style.setProperty("--book-x", point.current.x + "deg");
      art.current?.style.setProperty("--book-y", point.current.y + "deg");
      frame.current = null;
    });
  }
  function reset() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    art.current?.style.setProperty("--book-x", "0deg");
    art.current?.style.setProperty("--book-y", "0deg");
  }
  return <div className="auth-artwork" aria-hidden="true" onPointerMove={move} onPointerLeave={reset}>
    <div className="auth-book" ref={art}>
      <svg viewBox="0 0 1000 640" fill="none" focusable="false">
        <defs>
          <linearGradient id="folio-cover" x1="125" y1="190" x2="815" y2="535" gradientUnits="userSpaceOnUse"><stop stopColor="#365D43" /><stop offset=".5" stopColor="#1D4432" /><stop offset="1" stopColor="#4E7451" /></linearGradient>
          <linearGradient id="folio-left" x1="125" y1="300" x2="490" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#E9E5CC" /><stop offset=".25" stopColor="#F5F0DB" /><stop offset=".85" stopColor="#F1EBD5" /><stop offset="1" stopColor="#ABB69A" /></linearGradient>
          <linearGradient id="folio-right" x1="490" y1="300" x2="865" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#A9B599" /><stop offset=".09" stopColor="#E5E4CA" /><stop offset=".3" stopColor="#FAF4DF" /><stop offset="1" stopColor="#EEE8CF" /></linearGradient>
          <linearGradient id="folio-edge" x1="490" y1="466" x2="490" y2="520" gradientUnits="userSpaceOnUse"><stop stopColor="#E0DFC5" /><stop offset="1" stopColor="#9AAE8A" /></linearGradient>
          <linearGradient id="folio-leaf" x1="490" y1="315" x2="865" y2="290" gradientUnits="userSpaceOnUse"><stop stopColor="#A8B89C" /><stop offset=".16" stopColor="#E9E7D0" /><stop offset=".6" stopColor="#FFF8E4" /><stop offset="1" stopColor="#D9DEC0" /></linearGradient>
          <radialGradient id="folio-shadow"><stop stopColor="#051B12" stopOpacity=".8" /><stop offset="1" stopColor="#051B12" stopOpacity="0" /></radialGradient>
          <radialGradient id="folio-glow"><stop stopColor="#B6CD90" stopOpacity=".13" /><stop offset="1" stopColor="#B6CD90" stopOpacity="0" /></radialGradient>
          <clipPath id="folio-paper-clip"><path d="M128 169C253 130 368 163 490 222C620 161 736 129 865 169V455C736 416 621 447 490 507C366 448 252 416 128 455V169Z" /></clipPath>
          <pattern id="folio-paper-grain" width="13" height="11" patternUnits="userSpaceOnUse"><path d="M1 2H2M7 8H8M11 4H12" stroke="#48694D" strokeOpacity=".075" strokeWidth=".6" /></pattern>
        </defs>
        <ellipse cx="510" cy="328" rx="480" ry="280" fill="url(#folio-glow)" />
        <ellipse className="auth-folio-shadow" cx="510" cy="534" rx="420" ry="68" fill="url(#folio-shadow)" />
        <g className="auth-casebook-object">
          <g transform="rotate(-9 500 340)">
            <path d="M91 207C235 162 357 197 490 258C628 194 754 159 902 204V499C758 454 630 484 490 548C354 485 231 455 91 500V207Z" fill="url(#folio-cover)" stroke="#74916B" strokeWidth="1.5" />
            <path d="M107 194C241 151 365 185 490 246C622 182 749 151 887 192V480C748 439 621 473 490 532C363 473 240 439 107 482V194Z" fill="#B1BF9D" />
            <path d="M119 182C250 141 369 175 490 234C620 173 740 140 877 181V469C740 430 620 461 490 521C367 462 249 429 119 470V182Z" fill="url(#folio-edge)" />
            <g stroke="#6D8661" strokeOpacity=".4" strokeWidth="1.1">
              <path d="M114 467C248 427 367 458 490 518C621 458 744 425 881 465" />
              <path d="M112 474C247 434 366 465 490 525C622 465 746 432 883 472" />
              <path d="M110 481C245 441 365 472 490 532C623 472 748 439 885 479" />
              <path d="M108 488C243 448 363 479 490 539C625 479 750 446 887 486" />
            </g>
            <path d="M128 169C253 130 368 163 490 222V507C366 448 252 416 128 455V169Z" fill="url(#folio-left)" />
            <path d="M490 222C620 161 736 129 865 169V455C736 416 621 447 490 507V222Z" fill="url(#folio-right)" />
            <path d="M490 223V507" stroke="#778D6C" strokeOpacity=".7" />
            <g clipPath="url(#folio-paper-clip)"><path fill="url(#folio-paper-grain)" d="M120 130H880V520H120Z" /></g>
            <g className="auth-folio-copy" fill="#51694C" fontFamily="var(--font-plex-sans), sans-serif">
              <text x="171" y="213" fontSize="12" letterSpacing="2.4">01 / THE ISSUE</text>
              <text x="171" y="255" fontSize="28" fill="#2B5038">A little context.</text>
              <text x="171" y="283" fontSize="15" fill="#79846A">A person. A question. A place to start.</text>
              <path d="M171 306C251 296 330 320 417 354M171 324C250 315 322 338 385 362" fill="none" stroke="#92A083" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
              <text x="568" y="213" fontSize="12" letterSpacing="2.4">02 / THE RESPONSE</text>
              <text x="568" y="255" fontSize="28" fill="#2B5038">A way forward.</text>
              <text x="568" y="283" fontSize="15" fill="#79846A">Understand. Act. Keep the answer.</text>
              <path d="M568 309C640 286 722 282 804 299M568 328C642 306 712 302 777 312" fill="none" stroke="#92A083" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
            </g>
            <path className="auth-book-ribbon" d="M724 145L747 146V249L736 237L724 250V145Z" fill="#3B7250" />
            <path d="M729 148V230" stroke="#84A46F" strokeOpacity=".5" />
            <path d="M195 393C293 337 382 447 490 402C588 361 660 337 787 356" stroke="#A5B490" strokeOpacity=".4" strokeWidth="1.5" strokeDasharray="3 7" />
            <path className="auth-book-route" d="M195 393C293 337 382 447 490 402C588 361 660 337 787 356" pathLength="1" stroke="#397653" strokeWidth="2.7" strokeLinecap="round" />
            <g className="auth-book-point auth-point-one"><circle cx="195" cy="393" r="14" fill="#719564" fillOpacity=".12" /><circle cx="195" cy="393" r="5" fill="#407454" stroke="#F5EFD8" strokeWidth="2.5" /></g>
            <g className="auth-book-point auth-point-two"><circle cx="490" cy="402" r="14" fill="#719564" fillOpacity=".16" /><circle cx="490" cy="402" r="5" fill="#407454" stroke="#F5EFD8" strokeWidth="2.5" /></g>
            <g className="auth-book-seal"><circle cx="787" cy="356" r="25" fill="#285C40" /><circle cx="787" cy="356" r="31" stroke="#6B9464" strokeOpacity=".5" /><path d="M776 356L784 364L799 348" stroke="#E7EDCE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>
            <g className="auth-folio-stamp" transform="rotate(4 760 410)"><rect x="711" y="402" width="114" height="29" rx="2" stroke="#427650" strokeOpacity=".5" /><text x="768" y="422" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="12" fill="#427650" letterSpacing="2">RESOLVED</text></g>
            <g className="auth-turning-leaf"><path d="M490 222C620 161 736 129 865 169V455C736 416 621 447 490 507V222Z" fill="url(#folio-leaf)" stroke="#D9DFC6" strokeOpacity=".45" /><path d="M553 257C638 221 718 209 809 230M553 278C638 242 718 230 809 251" stroke="#8B9A7C" strokeOpacity=".25" strokeWidth="1.5" /></g>
          </g>
        </g>
      </svg>
    </div>
  </div>;
}
