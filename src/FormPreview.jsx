import React, { useMemo, useEffect, useRef, useState } from 'react';

const LS_KEY = 'tripReportData';
const NUM_ROWS = 8;
const PAPERWORK_OPTIONS = ['Bill Lading','Del. Receipt','Fuel Ticket','Toll Tickets','Log Sheets'];

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function useSavedData() {
  let data = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.date === todayLocal()) data = obj;
    }
  } catch {}
  return data || { carrier: '', terminal: '', truck: '', date: todayLocal(), driver: '', sig: '', paperwork: [], rows: [], extraLines: [] };
}

function isDetailFilled(d) {
  if (!d) return false;
  return [d.trailer, d.fromLoc, d.toLoc, d.dispatch, d.ldmt, d.blno, d.weight]
    .some(v => String(v ?? '').trim() !== '');
}
function isRowFilled(r) {
  if (!r) return false;
  const hasHwys = Array.isArray(r.hwys) ? r.hwys.length > 0 : !!r.hwy;
  return [r.d, r?.prov?.label, hasHwys ? 'x' : '', r.ob, r.oe, r.knt, r.kt, r.l, r.fv]
    .some(v => String(v ?? '').trim() !== '');
}

function formatHwys(row) {
  const arr = Array.isArray(row?.hwys) ? row.hwys : (row?.hwy ? [row.hwy] : []);
  return arr
    .map(h => (typeof h === 'object' ? (h?.label || '') : (h || '')))
    .filter(Boolean)
    .join(', ');
}

export default function DailyTripReportFormPreview() {
  const saved = useSavedData();
  const details = (saved.extraLines || []).filter(isDetailFilled);
  const rows = (saved.rows || []).filter(isRowFilled).slice(0, NUM_ROWS);

  const totalLiters = useMemo(() => rows.reduce((a, r) => a + (parseFloat(r.l || '0') || 0), 0), [rows]);
  const vendorsText = useMemo(() => {
    const set = new Set();
    rows.forEach(r => { if (r?.fv) set.add(r.fv); });
    return Array.from(set).join(', ');
  }, [rows]);

  // Fit-to-one-page print scaling (A4 landscape ~ 1123x794 css px)
  const TARGET_W = 1123;
  const TARGET_H = 794;
  const pageRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const computeScale = () => {
      const el = pageRef.current;
      if (!el) return;
      const contentW = el.scrollWidth || TARGET_W;
      const contentH = el.scrollHeight || TARGET_H;
      const sx = TARGET_W / contentW;
      const sy = TARGET_H / contentH;
      const s = Math.min(1, sx, sy);
      setScale(s > 0 ? s : 1);
    };
    const before = () => { setIsPrinting(true); computeScale(); };
    const after = () => { setIsPrinting(false); setScale(1); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    const mql = window.matchMedia('print');
    const onChange = (e) => { if (e.matches) before(); else after(); };
    try { mql.addEventListener('change', onChange); } catch { mql.addListener?.(onChange); }
    // Recompute on window resize
    const onResize = () => { if (isPrinting) computeScale(); };
    window.addEventListener('resize', onResize);
    // Initial compute
    computeScale();
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      try { mql.removeEventListener('change', onChange); } catch { mql.removeListener?.(onChange); }
      window.removeEventListener('resize', onResize);
    };
  }, [isPrinting]);

  return (
    <div className="flex justify-center bg-gray-300 min-h-screen print:bg-white">
      <div className="relative bg-white w-[1123px] shadow-md p-6 border border-black font-sans text-[11px] print:shadow-none print:border-0 print:p-4 print:m-0 print:w-full print:h-full print:break-inside-avoid"
           style={isPrinting ? { width: '100%', height: '100%', overflow: 'hidden', padding: '0.3rem' } : {}}>
        {/* Print page setup - force landscape orientation with optimized margins */}
        <style>{`
          @media print {
            @page { 
              size: A4 landscape !important; 
              margin: 0.4cm 0.6cm !important;
              orientation: landscape !important;
            }
            html, body { 
              width: 100% !important;
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            * {
              -webkit-box-sizing: border-box !important;
              box-sizing: border-box !important;
            }
            .print\\:p-4 {
              padding: 0.3rem !important;
            }
            .print\\:m-0 {
              margin: 0 !important;
            }
            /* Force single page */
            .print\\:break-inside-avoid {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
          @page :first {
            size: A4 landscape !important;
            margin: 0.4cm 0.6cm !important;
            orientation: landscape !important;
          }
          /* Prevent any additional pages */
          @page :nth-child(n+2) {
            display: none !important;
          }
        `}</style>
        {/* Actions (screen only) */}
        <div className="flex justify-end mb-2 print:hidden">
          <button onClick={() => window.print()} className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200 text-gray-800">Print</button>
        </div>

        <div ref={pageRef} style={isPrinting ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: `${TARGET_W}px` } : {}}>
          {/* Header */}
          <h1 className="text-center text-xl font-bold mb-3 uppercase tracking-wide print:text-lg">
            DAILY FUEL / TRIP REPORT
          </h1>

          {/* Carrier / Terminal / Truck (no boxes, only underline) */}
          <div className="flex mb-1 gap-4">
            <div className="flex-1 px-2 py-1 print:py-1">
              <div className="font-semibold leading-tight">CARRIER NAME</div>
              <div className="mt-1 h-6 border-b border-gray-400 flex items-end">
                <span className="text-[13px] leading-tight">{saved.carrier}</span>
              </div>
            </div>
            <div className="flex-1 px-2 py-1 print:py-1">
              <div className="font-semibold leading-tight">TERMINAL</div>
              <div className="mt-1 h-6 border-b border-gray-400 flex items-end">
                <span className="text-[13px] leading-tight">{saved.terminal}</span>
              </div>
            </div>
            <div className="flex-1 px-2 py-1 print:py-1">
              <div className="font-semibold leading-tight">TRUCK NO</div>
              <div className="mt-1 h-6 border-b border-gray-400 flex items-end">
                <span className="text-[13px] leading-tight">{saved.truck}</span>
              </div>
            </div>
          </div>

          {/* Date / Driver / Signature (no boxes, only underline; signature line aligned with others) */}
          <div className="flex mb-2 gap-4">
            <div className="flex-1 px-2 py-1 print:py-1">
              <div className="font-semibold leading-tight">DATE</div>
              <div className="mt-1 h-6 border-b border-gray-400 flex items-end">
                <span className="text-[13px] leading-tight">{saved.date}</span>
              </div>
            </div>
            <div className="flex-1 px-2 py-1 print:py-1">
              <div className="font-semibold leading-tight">DRIVER NAME</div>
              <div className="mt-1 h-6 border-b border-gray-400 flex items-end">
                <span className="text-[13px] leading-tight">{saved.driver}</span>
              </div>
            </div>
            <div className="flex-1 px-2 py-1 print:py-1">
              <div className="font-semibold leading-tight">DRIVER SIGNATURE</div>
              <div className="mt-1 h-6 border-b border-gray-400 flex items-end overflow-hidden">
                {saved.sig ? (
                  <img src={saved.sig} alt="signature" className="max-h-5 object-contain" />
                ) : (
                  <span className="text-gray-400">&nbsp;</span>
                )}
              </div>
            </div>
          </div>

          {/* Paperwork inline row aligned and slightly higher */}
          <div className="flex items-center justify-end gap-3 mb-2">
            <span className="font-bold uppercase whitespace-nowrap">PAPERWORK ATTACHED:</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {PAPERWORK_OPTIONS.map((item) => {
                const checked = saved.paperwork?.includes(item);
                return (
                  <span key={item} className="inline-flex items-center">
                    <span className="w-3.5 h-3.5 border border-gray-400 mr-1 flex items-center justify-center text-[9px] leading-[9px]">
                      {checked ? '✓' : ''}
                    </span>
                    <span className="uppercase text-[12px] tracking-tight">{item}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Trip Details: table with only filled rows */}
          {details.length > 0 && (
            <table className="w-full border border-gray-400 mb-3">
              <thead>
                <tr className="font-semibold">
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">TRAILER NO</th>
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">FROM</th>
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">TO</th>
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">DISPATCH NO</th>
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">LD / MT</th>
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">B/L NO</th>
                  <th className="border border-gray-400 px-2 py-2 text-[13px]">WEIGHT</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d, i) => (
                  <tr key={i} className="h-8">
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.trailer}</td>
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.fromLoc}</td>
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.toLoc}</td>
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.dispatch}</td>
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.ldmt}</td>
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.blno}</td>
                    <td className="border border-gray-400 px-2 py-2 text-[13px]">{d.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Trip Table (only filled rows) */}
          <table className="w-full border border-gray-400 mb-3">
            <thead>
              <tr className="font-semibold">
                <th className="border border-gray-400 px-2 py-2 text-[13px]">DATE</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">PROVINCE</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">HIGHWAY USED</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">ODOMETER BEGIN</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">ODOMETER END</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">KM NON-TOLL</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">KM TOLL</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">LITERS</th>
                <th className="border border-gray-400 px-2 py-2 text-[13px]">FUEL VENDOR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="h-8">
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.d || saved.date || ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.prov?.label || ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{formatHwys(r)}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.ob || ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.oe || ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.tollType === 'non-toll' ? (r?.knt || '') : ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.tollType === 'toll' ? (r?.kt || '') : ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.l || ''}</td>
                  <td className="border border-gray-400 px-2 py-2 text-[13px]">{r?.fv || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
