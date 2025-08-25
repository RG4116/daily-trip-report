import React, { useState } from "react";
import { vendorList } from "./vendorList";

export function VendorAutocomplete({ value, onChange, disabled }) {
  const [input, setInput] = useState(value || "");
  const [show, setShow] = useState(false);
  // Normalize strings for matching: remove spaces, dashes, special chars, lowercase
  function normalize(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  const normInput = normalize(input);
  const filtered = vendorList.filter(v => normalize(v).includes(normInput));
  return (
    <div className="relative">
      <input
        className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm w-full"
        value={input}
        onChange={e => {
          setInput(e.target.value);
          onChange?.(e.target.value);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 120)}
        placeholder="Fuel Vendor"
        disabled={disabled}
        autoComplete="off"
      />
      {show && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-40 overflow-auto">
          {filtered.map(v => (
            <li
              key={v}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
              onMouseDown={() => {
                setInput(v);
                onChange?.(v);
                setShow(false);
              }}
            >
              {v}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
