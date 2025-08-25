import React, { useEffect, useMemo, useRef, useState } from "react";
// --- Demo: Calculation logic and radio buttons (same as Trip Lines) ---
function KmCalcDemo() {
  const [ob, setOb] = useState("");
  const [oe, setOe] = useState("");
  const [tollType, setTollType] = useState("non-toll");
  const [knt, setKnt] = useState("");
  const [kt, setKt] = useState("");

  useEffect(() => {
    const obNum = parseFloat(ob || 0);
    const oeNum = parseFloat(oe || 0);
    const diff = (oeNum > obNum) ? (oeNum - obNum) : 0;
    if (tollType === "toll") {
      setKt(diff ? String(diff) : "");
      setKnt("");
    } else {
      setKnt(diff ? String(diff) : "");
      setKt("");
    }
  }, [ob, oe, tollType]);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6">
      <div className="mb-2 font-semibold text-blue-700">Km Calculation Demo</div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs mb-1">Odo Begin</label>
          <input type="text" value={ob} onChange={e=>setOb(e.target.value.replace(/[^0-9]/g, ""))} className="rounded border px-2 py-1 w-full" placeholder="Odo Begin" />
        </div>
        <div>
          <label className="block text-xs mb-1">Odo End</label>
          <input type="text" value={oe} onChange={e=>setOe(e.target.value.replace(/[^0-9]/g, ""))} className="rounded border px-2 py-1 w-full" placeholder="Odo End" />
        </div>
        <div className="flex flex-col gap-0 items-start justify-center">
          <label className="inline-flex items-center gap-2 text-xs mb-1">
            <input type="radio" name="demo-tollType" checked={tollType==="non-toll"} onChange={()=>setTollType("non-toll")} className="align-middle" />
            Non-Toll
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="radio" name="demo-tollType" checked={tollType==="toll"} onChange={()=>setTollType("toll")} className="align-middle" />
            Toll
          </label>
        </div>
        <div>
          <label className="block text-xs mb-1">Km Non-Toll</label>
          <input type="text" value={knt} readOnly className="rounded border px-2 py-1 w-full bg-gray-50" placeholder="Km Non-Toll" />
        </div>
        <div>
          <label className="block text-xs mb-1">Km Toll</label>
          <input type="text" value={kt} readOnly className="rounded border px-2 py-1 w-full bg-gray-50" placeholder="Km Toll" />
        </div>
      </div>
    </div>
  );
}
// Incognito detection helper
function detectIncognito() {
  return new Promise(resolve => {
    // Try FileSystem API (Chrome)
    const fs = window.RequestFileSystem || window.webkitRequestFileSystem;
    if (fs) {
      fs(window.TEMPORARY, 100, () => resolve(false), () => resolve(true));
      return;
    }
    // Try openDatabase (Safari)
    try {
      if (!window.indexedDB && (window.openDatabase || window.webkitOpenDatabase)) {
        resolve(true);
        return;
      }
    } catch {}
    // Fallback: assume not incognito
    resolve(false);
  });
}
// LocalStorage keys
const LS_KEY = 'tripReportData';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ProvinceAutocomplete, HighwayAutocomplete } from "./AutocompleteFields";
import { VendorAutocomplete } from "./VendorAutocomplete";
import { SignatureMode } from "./SignatureMode";

const NUM_ROWS = 8;
const PAPERWORK_OPTIONS = ['Bill Lading','Del. Receipt','Fuel Ticket','Toll Tickets','Log Sheets'];

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};

function makeReportId(dateStr) {
  const ymd = (dateStr || todayLocal()).replaceAll("-", "");
  const rand = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `TRP-${ymd}-${rand}`;
}

function drawBarcode(doc, id, { maxWidth=180, height=36, x, y }) {
  if (!id) return;
  const bits = [];
  [1,0,1,0,1,1,0,1,0].forEach(b=>bits.push(b));
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i) & 0x7f;
    for (let b = 6; b >= 0; b--) bits.push((code >> b) & 1);
    bits.push(0);
  }
  [1,1,0,1,0,1,0,1].forEach(b=>bits.push(b));
  const moduleW = Math.min(maxWidth / bits.length, 2);
  doc.setFillColor(25,31,44);
  let i=0;
  while (i < bits.length) {
    if (bits[i]===1) {
      let run=1;
      while (i+run < bits.length && bits[i+run]===1) run++;
      doc.rect(x + i*moduleW, y-height, moduleW*run, height, "F");
      i+=run;
    } else i++;
  }
}

function addSignatureImageContain(doc, dataUrl, { boxX, boxY, boxW, boxH, fallbackName }) {
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.trim() !== '') {
    let iw = 600, ih = 200;
    try {
      const props = doc.getImageProperties(dataUrl);
      iw = props?.width || iw; ih = props?.height || ih;
    } catch {}
    // Responsive scaling, maintain aspect ratio, fit inside box
    const pad = 4;
    const availW = boxW - 2 * pad;
    const availH = boxH - 2 * pad;
    const scale = Math.min(availW / iw, availH / ih);
    const w = Math.max(1, Math.floor(iw * scale));
    const h = Math.max(1, Math.floor(ih * scale));
    const x = boxX + pad + (availW - w) / 2;
    const y = boxY + pad + (availH - h) / 2;
    // Only insert once, after form/tables are drawn, under correct header
    doc.addImage(dataUrl, "PNG", x, y, w, h, undefined, "FAST");
  } else if (fallbackName && fallbackName.trim()) {
    // Only print name if draw area is empty and name is filled
    const fontCandidates = ["Sacramento", "GreatVibes", "DancingScript", "BrushScriptStd", "times"];
    for (const f of fontCandidates) {
      try { doc.setFont(f, "normal"); break; } catch {}
    }
    doc.setFontSize(16);
    doc.setTextColor(34, 34, 34);
    doc.text(fallbackName, boxX + boxW / 2, boxY + boxH / 2 + 2, { align: "center" });
  }
  // If both are empty, leave blank
}

function dataURLFromCanvas(cv){ return cv ? cv.toDataURL("image/png") : ""; }

function useHiDPICanvas(ref){
  useEffect(()=>{
    const cv=ref.current; if(!cv) return;
    const DPR=window.devicePixelRatio||1;
    const w=cv.clientWidth||1,h=cv.clientHeight||1;
    cv.width=w*DPR; cv.height=h*DPR;
    const ctx=cv.getContext("2d"); ctx.scale(DPR,DPR);
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
  },[ref]);
}

function renderTypedSignatureToCanvas(cv, text) {
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const DPR = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 1, h = cv.clientHeight || 1;
  cv.width = w * DPR; cv.height = h * DPR; ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  // Use a fine, elegant, realistic signature font
  const family = "'SignPainter', 'Great Vibes', 'Dancing Script', 'Bradley Hand', 'Brush Script MT', 'Lucida Handwriting', cursive";
  let fs = Math.max(18, Math.floor(h * 0.6));
  ctx.font = `300 ${fs}px ${family}`;
  ctx.fillStyle = "#222";
  ctx.textBaseline = "middle";
  let metrics = ctx.measureText(text || "");
  while (metrics.width > w - 12 && fs > 10) {
    fs -= 2;
    ctx.font = `300 ${fs}px ${family}`;
    metrics = ctx.measureText(text || "");
  }
  if (metrics.width > w - 12) {
    const words = (text || "").split(" ");
    let lines = [];
    let line = "";
    for (let word of words) {
      let testLine = line ? line + " " + word : word;
      let testWidth = ctx.measureText(testLine).width;
      if (testWidth > w - 12 && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    const lineHeight = fs + 2;
    const totalHeight = lines.length * lineHeight;
    let y = (h - totalHeight) / 2 + lineHeight / 2;
    for (let l of lines) {
      ctx.fillText(l, (w - ctx.measureText(l).width) / 2, y);
      y += lineHeight;
    }
  } else {
    const x = (w - metrics.width) / 2;
    const y = h / 2;
    ctx.fillText(text || "", x, y);
  }
}

function NumericInput({ value, onChange, placeholder, className = "", ...rest }) {
  return (
    <input
      value={value}
      inputMode="numeric"
      pattern="[0-9]*"
      type="text"
      placeholder={placeholder}
      onChange={(e)=>onChange?.(e.target.value.replace(/[^0-9]/g,""))}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-base md:text-sm placeholder-gray-400 ${className}`}
      {...rest}
    />
  );
}

export default function DailyTripReportApp(){
  // Final setRow logic: default Non-Toll, propagate Odo End, match requested layout
  const setRow = (i, patch) => {
    setRows(rows => {
      const newRows = rows.map((row, idx) => {
        if (idx !== i) return row;
        const updated = { ...row, ...patch };
        const ob = parseFloat(updated.ob || 0);
        const oe = parseFloat(updated.oe || 0);
        const diff = (oe > ob) ? (oe - ob) : 0;
        updated.knt = diff ? String(diff) : "";
        updated.kt = diff ? String(diff) : "";
        return updated;
      });
      // If Odo End was changed, update ob for all subsequent rows
      if (Object.prototype.hasOwnProperty.call(patch, 'oe')) {
        for (let j = i + 1; j < newRows.length; j++) {
          newRows[j].ob = newRows[j - 1].oe || "";
        }
      }
      return newRows;
    });
  };
  const [isIncognito, setIsIncognito] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [terminal, setTerminal] = useState("");
  const [truck, setTruck] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [driver, setDriver] = useState("");
  const [sig, setSig] = useState("");
  const [paperwork, setPaperwork] = useState([]);
  const [rows, setRows] = useState([]);
  const [extraLines, setExtraLines] = useState([]);
  const [sigAudit, setSigAudit] = useState(null);
  const [sigAck, setSigAck] = useState(false);
  const didRestore = useRef(false);

  // ...existing code...
  useEffect(() => {
    if (didRestore.current) return;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj && obj.date === todayLocal()) {
          setCarrier(obj.carrier || "");
          setTerminal(obj.terminal || "");
          setTruck(obj.truck || "");
          setDate(obj.date || todayLocal());
          setDriver(obj.driver || "");
          setSig(obj.sig || "");
          setPaperwork(obj.paperwork || []);
          setRows(obj.rows || []);
          setExtraLines(obj.extraLines || []);
        }
      }
    } catch {}
    didRestore.current = true;
  }, []);

  // Save to localStorage whenever relevant state changes
  useEffect(() => {
    const obj = {
      carrier, terminal, truck, date, driver, sig, paperwork, rows, extraLines
    };
    if (date === todayLocal()) {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    }
  }, [carrier, terminal, truck, date, driver, sig, paperwork, rows, extraLines]);
  const addExtraLine = () => {
    setExtraLines(l => {
      if (l.length >= NUM_ROWS) return l;
      const newDetail = { trailer: "", fromLoc: "", toLoc: "", dispatch: "", ldmt: "", blno: "", weight: "" };
      return [...l, newDetail];
    });
    setRows(r => {
      if (r.length >= NUM_ROWS) return r;
      const prev = r[r.length - 1];
      const ob = prev ? prev.oe : "";
      const newRows = [...r, { d: date, prov: null, hwy: null, ob, oe: "", knt: "", kt: "", l: "", fv: "", tollType: "non-toll" }];
      for (let j = 1; j < newRows.length; j++) {
        newRows[j].ob = newRows[j - 1].oe || "";
      }
      return newRows;
    });
  };
  const setExtraLine = (i, patch) => setExtraLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const removeExtraLine = (i) => {
    setExtraLines(l => l.filter((_, idx) => idx !== i));
    setRows(r => {
      const newRows = r.filter((_, idx) => idx !== i);
      for (let j = 1; j < newRows.length; j++) {
        newRows[j].ob = newRows[j - 1].oe || "";
      }
      return newRows;
    });
  };
  const togglePW=(v)=>setPaperwork(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  // Enhanced setRow to handle tollType toggle and km transfer
  // Link odometer values and handle tollType toggle
  // ...existing code...
  // Enhanced addRow to carry over previous trip's ending odometer
  const addRow = () => setRows(r => {
    if (r.length >= NUM_ROWS) return r;
    const prev = r[r.length - 1];
    const ob = prev ? prev.oe : "";
    const newRows = [...r, { d: date, prov: null, hwy: null, ob, oe: "", knt: "", kt: "", l: "", fv: "", tollType: "non-toll" }];
    for (let j = 1; j < newRows.length; j++) {
      newRows[j].ob = newRows[j - 1].oe || "";
    }
    return newRows;
  });
  const removeRow=(i)=>setRows(r=>r.filter((_,idx)=>idx!==i));
  useEffect(()=>{ setDate(d=>d||todayLocal()); },[]);
  const totals=useMemo(()=>{const s=k=>rows.reduce((a,r)=>a+(parseFloat(r[k]||"0")||0),0);
    const totalKm = rows.reduce((a, r) => a + (parseFloat(r.knt || "0") || 0) + (parseFloat(r.kt || "0") || 0), 0);
    return { nonToll: s('knt'), toll: s('kt'), liters: s('l'), totalKm };
  }, [rows]);
  const isRowFilled=r=>[r?.d,r?.prov,r?.hwy,r?.ob,r?.oe,r?.knt,r?.kt,r?.l,r?.fv].some(v=>String(v??"").trim()!=="");

  const buildPdf=()=>{
    const doc=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=28;

    doc.setFont("times","normal"); doc.setTextColor(25,31,44); doc.setFontSize(16);
    doc.text("DAILY FUEL / TRIP REPORT",W/2,M+4,{align:"center"});
    doc.setFontSize(10); doc.setTextColor(25,31,44);
    let y = M + 24, lh = 14;
    doc.text(`Carrier: ${carrier||''}    Terminal: ${terminal||''}    Truck No: ${truck||''}`,M,y);
    y+=lh; doc.text(`Date: ${date||''}    Driver Name: ${driver||''}`,M,y);
    // Print all extraLines as a table
    if (extraLines.length > 0) {
      y += lh;
      doc.setFontSize(10); doc.setTextColor(25,31,44);
      doc.text("Trip Details:", M, y);
      y += lh;
      autoTable(doc, {
        startY: y,
        head: [["Trailer No", "From", "To", "Dispatch No", "LD/MT", "Bill No", "Weight"]],
        body: extraLines.map(r => [r.trailer, r.fromLoc, r.toLoc, r.dispatch, r.ldmt, r.blno, r.weight]),
        margin: { left: M, right: M },
        styles: { font: 'times', fontSize: 9, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: [120,130,145], lineWidth: 0.7, textColor: [25,31,44] },
        headStyles: { fillColor: [52,71,103], textColor: [255,255,255], lineColor: [52,71,103], lineWidth: 0.7, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [235,239,245] },
        tableWidth: "auto",
      });
      y = doc.lastAutoTable.finalY;
    }

    // Print Trip Lines table
    const head=[["Date","Province","Highway Used","Odo Begin","Odo End","Km Non-Toll","Km Toll","Liters","Fuel Vendor"]];
    const printable=rows.filter(isRowFilled).slice(0,NUM_ROWS);
    const body=printable.map(r=>[
      (r?.d && String(r.d).trim()) ? r.d : (date || ""),
      r.prov?.label || "",
      typeof r.hwy === 'object' ? (r.hwy?.label || "") : (r.hwy || ""),
      r.ob||"", r.oe||"",
      r.tollType === "non-toll" ? (r.knt||"") : "",
      r.tollType === "toll" ? (r.kt||"") : "",
      r.l||"", r.fv||""
    ]);

    autoTable(doc,{
      head, body, startY: y + 10, margin:{left:M,right:M},
      styles:{font:'times',fontSize:9,cellPadding:3,halign:'center',valign:'middle',lineColor:[120,130,145],lineWidth:0.7,textColor:[25,31,44]},
      headStyles:{fillColor:[52,71,103],textColor:[255,255,255],lineColor:[52,71,103],lineWidth:0.7,fontStyle:'bold'},
      alternateRowStyles:{fillColor:[235,239,245]},
      columnStyles:{
        0:{cellWidth:70},1:{cellWidth:70},2:{cellWidth:110},
        3:{cellWidth:85},4:{cellWidth:85},5:{cellWidth:90},
        6:{cellWidth:70},7:{cellWidth:60},8:{cellWidth:110},
      },
      tableWidth:"auto",
    });
    let y2=doc.lastAutoTable.finalY+12;
    doc.text(`Non-Toll Total: ${totals.nonToll.toFixed(0)}    Toll Total: ${totals.toll.toFixed(0)}    Liters Total: ${totals.liters.toFixed(0)}`,M,y2);
    y2+=14; const pwText=paperwork.length?paperwork.join(', '):'—';
    doc.text(`PAPERWORK ATTACHED: ${pwText}`,M,y2);

    // Signature area: always below tables, clearly separated
    const sigBoxW = 160, sigBoxH = 70;
    const sigAreaX = W - M - sigBoxW;
    const sigAreaY = y2 + 24; // Add extra space below last table
    const headingFontSize = 12;
    doc.setFont("times", "normal");
    doc.setFontSize(headingFontSize);
    doc.setTextColor(25,31,44);
    doc.text("Driver Signature", sigAreaX + sigBoxW/2, sigAreaY + 8, { align: "center" });
    // Draw signature only if present; do not print Driver name as fallback
    const signatureToPrint = sig && typeof sig === 'string' && sig.trim() !== '' ? sig : null;
    addSignatureImageContain(doc, signatureToPrint, {
      boxX: sigAreaX,
      boxY: sigAreaY + headingFontSize + 10,
      boxW: sigBoxW,
      boxH: sigBoxH,
      fallbackName: "" // No fallback name; leave blank if not drawn
    });

    // Barcode and Report ID remain at the bottom
    const reportId=makeReportId(date), barcodeW=200, barcodeX=W-M-barcodeW, barcodeBottomY=H-M;
    drawBarcode(doc,reportId,{maxWidth:barcodeW,height:36,x:barcodeX,y:barcodeBottomY-12});
    doc.setFontSize(9); doc.setTextColor(90,98,112);
    doc.text(`Report ID: ${reportId}`,W-M,barcodeBottomY,{align:"right"});

    if (rows.filter(isRowFilled).length > NUM_ROWS){
      doc.setTextColor(150); doc.setFontSize(8);
      doc.text(`Not: İlk ${NUM_ROWS} satır yazdırıldı.`, M, barcodeBottomY);
    }

    return doc;
  };

  const downloadPdf=()=>{
    if (window.confirm('Warning: Downloading the PDF will permanently delete all saved trip data for today in this browser. Are you sure you want to continue?')) {
      localStorage.removeItem(LS_KEY);
      buildPdf().save(`TripReport_${date||''}_${driver||'Driver'}.pdf`);
    }
  };
  const sendByEmail = () => {
    alert('Email server is not configured.');
  };
  const openPdf=()=>{
    // Generate PDF and open in new tab reliably
    const doc = buildPdf();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Fallback: trigger download if popup blocked
      const a = document.createElement('a');
      a.href = url;
      a.download = `TripReport_${date||''}_${driver||'Driver'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const resetAll=()=>{
    localStorage.removeItem(LS_KEY);
    setCarrier("");
    setTerminal("");
    setTruck("");
    setDate(todayLocal());
    setDriver("");
    setSig("");
    setPaperwork([]);
    setExtraLines([]);
    setRows([]);
  };

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="card">
        <div className="mb-4 rounded-lg bg-yellow-100 border border-yellow-300 p-3 text-yellow-900 text-sm flex items-center gap-2">
          <span role="img" aria-label="Warning">⚠️</span>
          Your data is saved only for today in this browser. It will be lost if you use Private/Incognito mode, clear cache, switch browsers, change devices, download PDF, or reset the form.
        </div>
        {isIncognito && (
          <div className="mb-4 rounded-lg bg-yellow-100 border border-yellow-300 p-3 text-yellow-900 text-sm flex items-center gap-2">
            <span role="img" aria-label="Warning">⚠️</span>
            You are using Private/Incognito mode. Your trip data will not be saved after you close this window.
          </div>
        )}
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Daily Fuel / Trip Report</h2>
        </div>

        {/* Static header fields */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 p-4">
          <div>
            <label className="mb-1 block text-sm">Carrier Name</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              list="carrier-options"
              autoComplete="off"
            />
            <datalist id="carrier-options">
              <option value="TVM" />
              <option value="ILGI" />
            </datalist>
          </div>
          <div><label className="mb-1 block text-sm">Terminal</label><input className="w-full rounded border border-gray-300 px-3 py-2 text-sm" value={terminal} onChange={e=>setTerminal(e.target.value)}/></div>
          <div><label className="mb-1 block text-sm">Truck No</label><NumericInput value={truck} onChange={setTruck}/></div>
          <div>
            <label className="mb-1 block text-sm">Date</label>
            <div className="flex w-full">
              <input type="date" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
          </div>
          <div><label className="mb-1 block text-sm">Driver Name</label><input className="w-full rounded border border-gray-300 px-3 py-2 text-sm" value={driver} onChange={e=>setDriver(e.target.value)}/></div>
        </div>

        {/* Addable section for Trailer/From/To/Dispatch/LDMT/Bill/Weight */}
        <div className="rounded-2xl border border-dashed p-4 mb-6 bg-white">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Trip Details (max {NUM_ROWS})</div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Total added: <span className="font-semibold text-blue-600">{extraLines.length}</span></span>
              {extraLines.length < NUM_ROWS && (
                <button
                  type="button"
                  onClick={e => {
                    const btn = e.currentTarget;
                    btn.classList.add('clicked');
                    setTimeout(() => btn.classList.remove('clicked'), 350);
                    addExtraLine();
                  }}
                  className="btn-main px-4 py-3 text-base flex items-center gap-2 relative overflow-hidden"
                  title="Add New Trip Detail"
                  aria-label="Add New Trip Detail"
                  style={{ position: 'relative' }}
                >
                  <span className="text-xl">➕</span> <span>Add Trip Detail</span>
                  <style>{`
                    .clicked {
                      animation: rippleBtn 0.35s linear;
                    }
                    @keyframes rippleBtn {
                      0% { box-shadow: 0 0 0 0 #3b82f6aa; }
                      50% { box-shadow: 0 0 0 12px #3b82f633; }
                      100% { box-shadow: 0 0 0 0 #3b82f600; }
                    }
                  `}</style>
                </button>
              )}
            </div>
          </div>
      {/* Floating Action Button removed as requested. Only inline add button remains. */}

          <div className="space-y-2">
            {extraLines.length===0 && (
              <div className="text-sm text-gray-500">No trip details added yet. Tap <span className='font-bold text-blue-600'>➕</span> to add your first trip.</div>
            )}

            {extraLines.map((r,i)=>(
              <details open key={i} className="group rounded-xl border border-gray-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <span className="inline-flex shrink-0 items-center rounded-md bg-gray-100 px-2 py-1">{i+1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault();
                        removeExtraLine(i);
                      }}
                      className="px-2 py-1 text-sm flex items-center gap-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 border border-gray-300 transition-shadow"
                      style={{ boxShadow: '0 1px 4px rgba(120,130,145,0.06)' }}
                    >
                      <span className="text-base">🗑️</span> <span>Delete</span>
                    </button>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform" style={{fontSize: '1.6em', marginLeft: '0.2em'}} aria-label="Expand section">▼</span>
                  </div>
                </summary>

                <div className="grid grid-cols-1 gap-2 border-t p-3 md:grid-cols-7 md:gap-2">
                  <NumericInput value={r.trailer} onChange={v=>setExtraLine(i,{trailer:v})} placeholder="Trailer No"/>
                  <input className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm" value={r.fromLoc} onChange={e=>setExtraLine(i,{fromLoc:e.target.value})} placeholder="From"/>
                  <input className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm" value={r.toLoc} onChange={e=>setExtraLine(i,{toLoc:e.target.value})} placeholder="To"/>
                  <NumericInput value={r.dispatch} onChange={v=>setExtraLine(i,{dispatch:v})} placeholder="Dispatch No"/>
                  <div className="flex gap-2 items-center">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.ldmt==='LD'}
                        onChange={e => {
                          setExtraLine(i, { ldmt: e.target.checked ? 'LD' : '' });
                        }}
                      />
                      LD
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.ldmt==='MT'}
                        onChange={e => {
                          setExtraLine(i, { ldmt: e.target.checked ? 'MT' : '' });
                        }}
                      />
                      MT
                    </label>
                  </div>
                  <NumericInput value={r.blno} onChange={v=>setExtraLine(i,{blno:v})} placeholder="Bill No" className="placeholder-gray-400"/>
                  <NumericInput value={r.weight} onChange={v=>setExtraLine(i,{weight:v})} placeholder="Weight" className="placeholder-gray-400"/>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Trip Lines section (linked to Trip Details, display only) */}
        <div className="rounded-2xl border border-dashed p-4 mb-6 bg-white">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Trip Lines (linked to Trip Details)</div>
          </div>
          <div className="space-y-2">
            {rows.length===0 && (
              <div className="text-sm text-gray-500">No trips added yet. Add a Trip Detail above.</div>
            )}
            {rows.map((r,i)=>(
              <details open key={i} className="group rounded-xl border border-gray-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <span className="inline-flex shrink-0 items-center rounded-md bg-gray-100 px-2 py-1">{i+1}</span>
                  </div>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform" style={{fontSize: '1.6em', marginLeft: '0.2em'}} aria-label="Expand section">▼</span>
                </summary>
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-1 gap-2 border-t p-3 md:grid-cols-9 md:gap-2 items-start">
                    <div className="flex w-full">
                      <input type="date" className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm w-full" value={r.d} onChange={e=>setRow(i,{d:e.target.value})} placeholder="Date"/>
                    </div>
                    <div className="w-full">
                      <ProvinceAutocomplete
                        value={r.prov}
                        onChange={prov => { setRow(i, { prov, hwy: null }); }}
                        disabled={false}
                      />
                    </div>
                    <div className="w-full">
                      <HighwayAutocomplete
                        province={r.prov}
                        value={r.hwy}
                        onChange={hwy => setRow(i, { hwy })}
                        disabled={!r.prov}
                      />
                    </div>
                    <NumericInput value={r.ob} onChange={v=>setRow(i,{ob:v})} placeholder="Odo Begin" className="px-2"/>
                    <NumericInput value={r.oe} onChange={v=>setRow(i,{oe:v})} placeholder="Odo End" className="px-2"/>
                    {/* TollType radio buttons vertical layout */}
                    <div className="flex flex-col gap-0 items-start justify-center md:justify-start">
                      <label className="inline-flex items-center gap-2 text-xs mb-1">
                        <input
                          type="radio"
                          name={`tollType-${i}`}
                          checked={r.tollType === "non-toll"}
                          onChange={() => setRow(i, { tollType: "non-toll" })}
                          className="align-middle"
                        />
                        Non-Toll
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`tollType-${i}`}
                          checked={r.tollType === "toll"}
                          onChange={() => setRow(i, { tollType: "toll" })}
                          className="align-middle"
                        />
                        Toll
                      </label>
                    </div>
                    {/* Only show one km input, based on toggle */}
                    {r.tollType === "non-toll" ? (
                      <NumericInput value={r.knt} onChange={v => setRow(i, { knt: v })} placeholder="Km Non-Toll" className="px-2" />
                    ) : (
                      <NumericInput value={r.kt} onChange={v => setRow(i, { kt: v })} placeholder="Km Toll" className="px-2" />
                    )}
                    <NumericInput value={r.l} onChange={v=>setRow(i,{l:v})} placeholder="Liters" className="px-2"/>
                    <div className="md:col-span-1">
                      <VendorAutocomplete
                        value={r.fv || ""}
                        onChange={v => setRow(i, { fv: v })}
                        disabled={false}
                      />
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">PAPERWORK ATTACHED</div>
          {PAPERWORK_OPTIONS.map(v=>(
            <label key={v} className="mr-4 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={paperwork.includes(v)} onChange={()=>togglePW(v)}/>
              {v}
            </label>
          ))}
        </div>

        {/* Signature section moved to bottom above action buttons */}
        <div className="mt-6 mb-6">
          <label className="mb-1 block text-sm">Signature</label>
          <div
            className="signature-container rounded-xl border border-gray-300 shadow bg-white p-3 mb-2"
            style={{
              margin: 12,
              padding: 8,
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
              <SignatureMode
                value={sig}
                onChange={(dataUrl, audit) => {
                  setSig(dataUrl);
                  setSigAudit(audit);
                }}
                readOnly={false}
              />
            </div>
          </div>
          {/* Signature certification checkbox removed as requested */}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={downloadPdf} className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Download PDF</button>
          <button type="button" onClick={sendByEmail} className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">Send by Email</button>
          <button type="button" onClick={openPdf} className="rounded-md border px-4 py-2 hover:bg-gray-50">Open PDF in New Tab</button>
          <button type="button" onClick={resetAll} className="rounded-md border px-4 py-2 hover:bg-gray-50">Reset Form</button>
        </div>
      </div>
    </div>
  );
}
