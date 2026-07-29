"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { RefOption } from "@/lib/client";

interface Props {
  value: string;
  options: RefOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Allow values not present in options (free typing). Default true. */
  allowFreeText?: boolean;
  /** Max options to render in the list. Default 50. */
  maxOptions?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

function filter(options: RefOption[], query: string, max: number): RefOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, max);
  const starts: RefOption[] = [];
  const contains: RefOption[] = [];
  for (const o of options) {
    const v = o.value.toLowerCase();
    const l = o.label.toLowerCase();
    if (v.startsWith(q) || l.startsWith(q)) starts.push(o);
    else if (v.includes(q) || l.includes(q)) contains.push(o);
    if (starts.length + contains.length >= max * 2) break;
  }
  return [...starts, ...contains].slice(0, max);
}

export default function Combobox({
  value,
  options,
  onChange,
  placeholder,
  allowFreeText = true,
  maxOptions = 50,
  disabled,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // When closed, the input shows the committed value; when open, it shows the
  // live query so the user can search.
  const display = open ? query : value;

  const results = useMemo(
    () => filter(options, open ? query : "", maxOptions),
    [options, open, query, maxOptions],
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        commitClose();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, value]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openMenu() {
    if (disabled) return;
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  function commitClose() {
    // If free text is allowed and the user typed something, keep it.
    if (open && query !== "" && allowFreeText) {
      onChange(query);
    }
    setOpen(false);
  }

  function pick(opt: RefOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[active]) pick(results[active]);
        else commitClose();
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        commitClose();
        break;
    }
  }

  return (
    <div className="combobox" ref={rootRef}>
      <div className={`combobox-control ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
        <input
          type="text"
          className="combobox-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          value={display}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
            if (allowFreeText) onChange(e.target.value);
          }}
          onFocus={openMenu}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="combobox-toggle"
          tabIndex={-1}
          aria-label="Toggle options"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M5 7l5 6 5-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <ul className="combobox-list" id={listId} role="listbox" ref={listRef}>
          {results.length === 0 && (
            <li className="combobox-empty">
              {allowFreeText ? "No matches — your text will be kept" : "No matches"}
            </li>
          )}
          {results.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`combobox-option ${i === active ? "active" : ""} ${
                o.value === value ? "selected" : ""
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              <span className="combobox-option-label">{o.label}</span>
              {o.label !== o.value && <span className="combobox-option-value">{o.value}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
