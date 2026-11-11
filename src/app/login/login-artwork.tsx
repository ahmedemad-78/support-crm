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
    point.current = { x: (0.5 - (event.clientY - bounds.top) / bounds.height) * 5, y: ((event.clientX - bounds.left) / bounds.width - 0.5) * 7 };
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
      <svg viewBox="0 0 600 360" fill="none" focusable="false">
        <defs>
          <linearGradient id="casebook-left" x1="75" y1="170" x2="300" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor="#D6E1BF" /><stop offset=".82" stopColor="#EFF0D6" /><stop offset="1" stopColor="#A4B593" /></linearGradient>
          <linearGradient id="casebook-right" x1="300" y1="180" x2="529" y2="155" gradientUnits="userSpaceOnUse"><stop stopColor="#BDCBA7" /><stop offset=".12" stopColor="#F6F3DD" /><stop offset="1" stopColor="#E4E7CA" /></linearGradient>
          <linearGradient id="casebook-leaf" x1="300" y1="80" x2="365" y2="170" gradientUnits="userSpaceOnUse"><stop stopColor="#FBF8E8" /><stop offset="1" stopColor="#CFDABB" stopOpacity=".2" /></linearGradient>
          <radialGradient id="casebook-light"><stop stopColor="#BDD99E" stopOpacity=".15" /><stop offset="1" stopColor="#BDD99E" stopOpacity="0" /></radialGradient>
          <radialGradient id="casebook-shadow"><stop stopColor="#061D15" stopOpacity=".65" /><stop offset="1" stopColor="#061D15" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="300" cy="155" rx="280" ry="150" fill="url(#casebook-light)" />
        <ellipse className="auth-book-shadow" cx="300" cy="316" rx="235" ry="29" fill="url(#casebook-shadow)" />
        <g className="auth-book-spread">
          <path d="M57 106C140 70 218 83 300 126C384 83 463 70 543 106V292C461 261 384 274 300 317C218 274 139 261 57 292V106Z" fill="#2C543F" stroke="#78926F" strokeWidth="1.3" />
          <path d="M67 98C144 63 222 77 300 119C380 77 458 63 534 98V283C458 253 380 265 300 309C222 265 144 253 67 283V98Z" fill="#BAC9A7" />
          <path d="M69 104C144 70 223 84 300 126M300 126C380 84 458 70 532 104M69 278C144 250 223 264 300 304M300 304C380 264 458 250 532 278" stroke="#698365" strokeOpacity=".65" />
          <path className="auth-page-left" d="M76 83C151 49 225 68 300 109V296C224 253 150 235 76 270V83Z" fill="url(#casebook-left)" />
          <path className="auth-page-right" d="M300 109C377 68 451 49 526 83V270C451 235 377 253 300 296V109Z" fill="url(#casebook-right)" />
          <path d="M300 111V294" stroke="#7F9879" strokeOpacity=".55" />
          <g className="auth-page-lines" stroke="#77906D" strokeWidth="1.5" strokeLinecap="round" opacity=".48">
            <path d="M106 115C154 96 205 107 263 136" pathLength="1" /><path d="M106 135C154 116 205 127 263 156" pathLength="1" /><path d="M106 155C151 138 194 146 231 162" pathLength="1" />
            <path d="M337 136C392 107 441 96 493 115" pathLength="1" /><path d="M337 156C392 127 441 116 493 135" pathLength="1" /><path d="M365 163C405 146 448 139 493 155" pathLength="1" />
          </g>
          <path className="auth-book-ribbon" d="M382 74L397 69V139L389 131L382 146V74Z" fill="#387453" />
          <path className="auth-book-route" d="M127 220C190 181 244 260 300 225C356 190 398 182 471 210" pathLength="1" stroke="#2B7752" strokeWidth="2.4" strokeLinecap="round" />
          <g className="auth-book-point auth-point-one"><circle cx="127" cy="220" r="11" fill="#719762" fillOpacity=".15" /><circle cx="127" cy="220" r="4" fill="#2B6A48" stroke="#F5F2DC" strokeWidth="2" /></g>
          <g className="auth-book-point auth-point-two"><circle cx="300" cy="225" r="11" fill="#719762" fillOpacity=".15" /><circle cx="300" cy="225" r="4" fill="#2B6A48" stroke="#F5F2DC" strokeWidth="2" /></g>
          <g className="auth-book-seal"><circle cx="471" cy="210" r="17" fill="#2A6849" /><circle cx="471" cy="210" r="21" stroke="#62966B" strokeOpacity=".4" /><path d="M463 210L469 216L480 204" stroke="#EFF1D8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></g>
          <path className="auth-turning-leaf" d="M300 110C312 77 334 62 362 59C338 103 333 179 300 296V110Z" fill="url(#casebook-leaf)" />
        </g>
      </svg>
    </div>
    <div className="auth-art-caption"><span><i />Record</span><b /><span><i />Resolve</span><b /><span><i />Follow up</span></div>
  </div>;
}
