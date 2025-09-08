import React, { useState, useRef, useEffect } from "react";
import { PROVINCES, HIGHWAYS } from "./highwayData";

function fuzzyMatch(str, options) {
  if (!str) return options;
  str = str.toLowerCase();
  return options.filter(opt => {
    const terms = [opt.label, opt.code, ...(opt.synonyms||[])].map(s => s.toLowerCase());
    return terms.some(term => term.includes(str));
  });
}

function useDebounced(value, delay=120) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

export function ProvinceAutocomplete({ value, onChange, disabled }) {
  const [input, setInput] = useState(value?.label || "");
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const debouncedInput = useDebounced(input);
  const filtered = fuzzyMatch(debouncedInput, PROVINCES);

  useEffect(() => {
    setInput(value?.label || "");
  }, [value]);

  return (
    <div className="relative">
      <input
        className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm w-full"
        value={input}
        disabled={disabled}
        placeholder="Province/State"
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        ref={ref}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-2 text-gray-400 text-sm">No results</div>
          ) : filtered.map(opt => (
            <div
              key={opt.country + '-' + opt.code}
              className="cursor-pointer px-3 py-2 hover:bg-blue-50 text-sm"
              onMouseDown={() => { setOpen(false); setInput(opt.label); onChange(opt); }}
            >
              {opt.label} ({opt.code})
            </div>
          ))}
        </div>
      )}
      {input && (
        <button type="button" className="absolute right-2 top-2 text-gray-400" onClick={() => { setInput(""); onChange(null); }}>&times;</button>
      )}
    </div>
  );
}

export function HighwayAutocomplete({ province, value, onChange, disabled }) {
  const [input, setInput] = useState(value?.label || value || "");
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [manualAllowed, setManualAllowed] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!province) { setFiltered([]); setManualAllowed(false); return; }
    const key = province.country + '-' + province.code;
    const list = HIGHWAYS[key] || [];
    setFiltered(fuzzyMatch(input, list));
    setManualAllowed(!list || list.length === 0);
  }, [input, province]);

  useEffect(() => {
    if (value && typeof value === 'object') setInput(value.label || "");
    else setInput(value || "");
  }, [value]);

  useEffect(() => {
    if (!province) { setInput(""); onChange(null); }
  }, [province]);

  const handleSelect = (opt) => {
    setOpen(false);
    setInput(opt.label);
    onChange(opt);
  };

  const handleManual = (val) => {
    setInput(val);
    onChange(val);
  };

  const hasList = province && HIGHWAYS[province.country + '-' + province.code] && HIGHWAYS[province.country + '-' + province.code].length > 0;
  const placeholder = hasList ? "Start typing to search…" : "Enter highway manually";

  return (
    <div className="relative">
      <input
        className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm w-full"
        value={input}
        disabled={disabled || !province}
        placeholder={placeholder}
        onChange={e => {
          setInput(e.target.value);
          setOpen(true);
          if (!hasList) handleManual(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        ref={ref}
        autoComplete="off"
      />
      {open && province && hasList && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-2 text-gray-400 text-sm">No results</div>
          ) : filtered.map(opt => (
            <div
              key={opt.code}
              className="cursor-pointer px-3 py-2 hover:bg-blue-50 text-sm"
              onMouseDown={() => handleSelect(opt)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
      {input && (
        <button type="button" className="absolute right-2 top-2 text-gray-400" onClick={() => { setInput(""); onChange(null); }}>&times;</button>
      )}
    </div>
  );
}

// Improved multi-select highway input with inline tags inside the box
export function HighwaysAutocompleteMulti({ province, values = [], onChange, disabled }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const hasList = !!(province && HIGHWAYS[province.country + '-' + province.code] && HIGHWAYS[province.country + '-' + province.code].length > 0);
  const list = hasList ? (HIGHWAYS[province.country + '-' + province.code] || []) : [];
  const filtered = hasList ? fuzzyMatch(input, list) : [];

  useEffect(() => { setInput(""); }, [province]);

  const normArray = (arr) => (Array.isArray(arr) ? arr : (arr ? [arr] : []));
  const toLabel = (v) => (typeof v === 'object' ? (v.label || v.code || "") : (v || ""));
  const isDup = (arr, v) => arr.some(x => toLabel(x) === toLabel(v));

  const addValue = (v) => {
    if (!v) return;
    const base = normArray(values);
    if (isDup(base, v)) { setInput(""); setOpen(false); return; }
    onChange?.([...base, v]);
    setInput("");
    setOpen(false);
  };

  const removeAt = (idx) => {
    const base = normArray(values);
    const next = base.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (hasList && filtered.length > 0) addValue(filtered[0]);
      else if (!hasList && input.trim()) addValue(input.trim());
    } else if (e.key === 'Backspace' && !input) {
      const arr = normArray(values);
      if (arr.length > 0) removeAt(arr.length - 1);
    }
  };

  const placeholder = province ? (hasList ? "Add highways…" : "Enter highway and press Enter") : "Select province first";
  const disabledAll = disabled || !province;
  const vals = normArray(values);

  return (
    <div className="relative" ref={wrapRef}>
      {/* Fixed-height input wrapper to match other inputs (h-10 ~ 2.5rem) */}
      <div
        className={`h-10 w-full rounded-md border px-2 text-base md:text-sm flex items-center gap-1 bg-white ${disabledAll ? 'bg-gray-100 cursor-not-allowed' : 'cursor-text'} focus-within:ring-2 focus-within:ring-blue-500 border-gray-300`}
        onClick={() => !disabledAll && inputRef.current?.focus()}
        role="group"
        aria-disabled={disabledAll}
      >
        {/* Horizontal scroll area for tags + input */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          {vals.map((v, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs border border-gray-200">
              {toLabel(v)}
              {!disabledAll && (
                <button type="button" className="text-gray-500 hover:text-gray-700" onClick={(e) => { e.stopPropagation(); removeAt(idx); }} aria-label="Remove">×</button>
              )}
            </span>
          ))}
          <input
            ref={inputRef}
            className={`outline-none bg-transparent h-full min-w-[6rem] ${disabledAll ? 'pointer-events-none' : ''}`}
            style={{ fontSize: '16px' }}
            value={input}
            disabled={disabledAll}
            placeholder={vals.length === 0 ? placeholder : ''}
            onChange={e => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            aria-label="Highways"
            autoComplete="off"
          />
        </div>
        {/* Clear all */}
        {!disabledAll && vals.length > 0 && (
          <button
            type="button"
            className="ml-1 text-gray-400 hover:text-gray-600 px-1 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange?.([]); }}
            aria-label="Clear all"
          >
            ×
          </button>
        )}
      </div>

      {/* Suggestions dropdown anchored to wrapper */}
      {open && !disabledAll && hasList && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-2 text-gray-400 text-sm">No results</div>
          ) : filtered.map(opt => (
            <div
              key={opt.code}
              className="cursor-pointer px-3 py-2 hover:bg-blue-50 text-sm"
              onMouseDown={() => addValue(opt)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add a unified NumericInput for consistent styling
export function NumericInput({ value, onChange, placeholder, className = "", ...rest }) {
  return (
    <input
      value={value}
      inputMode="numeric"
      pattern="[0-9]*"
      type="text"
      placeholder={placeholder}
      onChange={e => onChange?.(e.target.value.replace(/[^0-9]/g, ""))}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-base md:text-sm ${className}`}
      {...rest}
    />
  );
}
