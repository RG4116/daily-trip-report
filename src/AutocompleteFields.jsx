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
