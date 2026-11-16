"use client";

import { useId, useRef, useState } from "react";
import { cityLabel, isOtherCity } from "@/lib/tickets/intake";

type City = { id: number; name: string };
type Option = { key: string; label: string; cityId: string; typed: string; custom?: boolean };

/**
 * City picker you can type into. A name that is not in the list is kept as typed
 * (stored against the hidden "Other" entry) so nobody has to leave the field.
 */
export function CityCombo({ cities, cityId, typed, onPick, invalid, describedBy }: { cities: City[]; cityId: string; typed: string; onPick: (cityId: string, typed: string) => void; invalid?: boolean; describedBy?: string }) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const other = cities.find((city) => isOtherCity(city.name));
  const listed = cities.filter((city) => city !== other);
  const shown = cityLabel(cities.find((city) => String(city.id) === cityId)?.name, typed);
  const text = query ?? (other && String(other.id) === cityId && !typed ? "" : shown);
  const needle = (query ?? "").trim().toLowerCase();
  const exact = listed.find((city) => city.name.toLowerCase() === needle);
  const options: Option[] = listed.filter((city) => !needle || city.name.toLowerCase().includes(needle)).map((city) => ({ key: String(city.id), label: city.name, cityId: String(city.id), typed: "" }));
  if (other && needle.length >= 2 && !exact) options.push({ key: "typed", label: (query ?? "").trim(), cityId: String(other.id), typed: (query ?? "").trim(), custom: true });
  const current = Math.min(active, Math.max(0, options.length - 1));

  function pick(option: Option) { onPick(option.cityId, option.typed); setQuery(null); setOpen(false); }
  function settle() {
    if (query === null) { setOpen(false); return; }
    if (exact) pick({ key: String(exact.id), label: exact.name, cityId: String(exact.id), typed: "" });
    else if (other && needle.length >= 2) pick({ key: "typed", label: query.trim(), cityId: String(other.id), typed: query.trim() });
    else { if (!needle) onPick("", ""); setQuery(null); setOpen(false); }
  }

  return <div className="city-combo">
    <input ref={input} id="city_id" type="text" role="combobox" dir="auto" autoComplete="off" spellCheck={false} maxLength={80} placeholder="Choose or type…" value={text}
      aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && options[current] ? `${listId}-${options[current].key}` : undefined} aria-invalid={invalid} aria-describedby={describedBy}
      onFocus={(event) => { setOpen(true); event.currentTarget.select(); }}
      onClick={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onBlur={settle}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!open) { setOpen(true); return; } setActive((current + (event.key === "ArrowDown" ? 1 : options.length - 1)) % Math.max(1, options.length)); }
        else if (event.key === "Enter" && open) { event.preventDefault(); if (options[current]) pick(options[current]); else settle(); }
        else if (event.key === "Escape" && open) { event.preventDefault(); setQuery(null); setOpen(false); }
      }} />
    <input type="hidden" name="city_id" value={cityId} />
    <input type="hidden" name="city_other" value={typed} />
    {open && <ul id={listId} role="listbox" className="city-combo-list">
      {options.map((option, index) => <li key={option.key} id={`${listId}-${option.key}`} role="option" aria-selected={option.custom ? Boolean(typed) && typed === option.typed : option.cityId === cityId && !typed} data-active={index === current} data-custom={option.custom}
        onMouseDown={(event) => { event.preventDefault(); pick(option); input.current?.blur(); }} onMouseEnter={() => setActive(index)}>
        {option.custom ? <>Use <b dir="auto">“{option.label}”</b></> : option.label}
      </li>)}
      {!options.length && <li className="city-combo-empty" role="presentation">{other ? "Keep typing the city or country name" : "Not in the list"}</li>}
    </ul>}
  </div>;
}
