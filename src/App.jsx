import React, { useEffect, useMemo, useRef, useState } from "react";
import "./global.css";

// Export/Import functions
function exportFormData(data) {
  const exportData = {
    ...data,
    exportDate: new Date().toISOString(),
    version: "1.0"
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `trip-report-${data.date || 'data'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importFormData(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate the data structure
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid file format');
      }
      
      // Remove export metadata
      const { exportDate, version, ...formData } = importedData;
      
      // Validate required fields
      const requiredFields = ['date', 'carrier', 'terminal', 'truck', 'driver'];
      const hasValidStructure = typeof formData.date === 'string' &&
                               typeof formData.carrier === 'string' &&
                               typeof formData.terminal === 'string' &&
                               typeof formData.truck === 'string' &&
                               typeof formData.driver === 'string';
      
      if (!hasValidStructure) {
        throw new Error('Invalid data structure');
      }
      
      onSuccess(formData);
    } catch (error) {
      console.error('Import error:', error);
      onError(error.message || 'Failed to import file');
    }
  };
  reader.onerror = () => onError('Failed to read file');
  reader.readAsText(file);
}
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

// Unified PDF Style Configuration - matches FormPreview exactly
const PDF_STYLE = {
  colors: {
    black: [0, 0, 0],           // Black text
    gray: [156, 163, 175],      // Modern gray borders (matches border-gray-400)
    darkText: [25, 31, 44],     // Dark text color
    white: [255, 255, 255],     // White background
    lightGray: [180, 180, 180], // Light gray for barcode
    mediumGray: [90, 98, 112],  // Medium gray for report ID
  },
  table: {
    lineWidth: 1,               // Solid borders like FormPreview
    cellPadding: 3,             // Increased padding for better spacing
    fontSize: 11,               // Larger readable font (was 9, now 11)
    headerFontWeight: 'bold',   // Bold headers
    textAlign: 'left',          // Left-aligned like FormPreview
  },
  header: {
    fontSize: 16,               // Main title size
    fieldFontSize: 10,          // Field labels
    fieldValueSize: 12,         // Field values (increased from 10 to 12)
    underlineWidth: 1,          // Underline thickness
  }
};
import { ProvinceAutocomplete, HighwaysAutocompleteMulti } from "./AutocompleteFields";
import { VendorAutocomplete } from "./VendorAutocomplete";
import { SignatureMode } from "./SignatureMode";
import { PDFDocument, StandardFonts } from 'pdf-lib';

const NUM_ROWS = 8;
const PAPERWORK_OPTIONS = ['Bill Lading','Del. Receipt','Fuel Ticket','Toll Tickets','Log Sheets'];

// Try to resolve template URL (bundled by Vite)
const TEMPLATE_URL = new URL('./assets/dailysheet.pdf', import.meta.url);

// Template layout (A4 landscape ~ 842 x 595 pt). Adjust as needed to align with your PDF.
const TPL = {
  size: { w: 842, h: 595 },
  header: {
    carrier: { x: 70, y: 560 },
    terminal: { x: 320, y: 560 },
    truck: { x: 620, y: 560 },
    date: { x: 70, y: 540 },
    driver: { x: 320, y: 540 },
  },
  details: {
    startX: 40, startY: 500, rowH: 16,
    cols: [80, 140, 140, 100, 60, 100, 90], // Trailer, From, To, Dispatch, LD/MT, Bill, Weight
  },
  lines: {
    startX: 40, startY: 300, rowH: 16,
    cols: [70, 80, 150, 75, 75, 70, 70, 60, 100], // Date, Prov, Highways, OdoB, OdoE, Km NT, Km T, Liters, Vendor
  },
  totals: { x: 40, y: 120 },
  signature: { x: 650, y: 140, w: 160, h: 70 }, // y is top; image draws from bottom so we adjust
};

// Build a PDF by drawing directly on the template
async function buildTemplatePdfBlob({ data, totals, imageSig }) {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('template-not-found');
  const templateBytes = await res.arrayBuffer();

  const templateDoc = await PDFDocument.load(templateBytes);
  const outputDoc = await PDFDocument.create();
  const basePage = templateDoc.getPage(0);
  const { width: baseW, height: baseH } = basePage.getSize();
  const [tplPage] = await outputDoc.copyPages(templateDoc, [0]);
  const page = tplPage; // We'll draw on this copied page
  outputDoc.addPage(page);

  const font = await outputDoc.embedFont(StandardFonts.Helvetica);
  const fsHeader = 10;
  let fsBody = 9;
  const drawText = (txt, x, y, size = fsBody, maxW) => {
    if (txt == null) txt = '';
    const text = String(txt);
    let s = text;
    if (maxW) {
      while (s && font.widthOfTextAtSize(s, size) > maxW) {
        if (s.length <= 1) break;
        s = s.slice(0, -1);
      }
    }
    // pdf-lib uses baseline; convert from top-left by subtracting font size
    page.drawText(s, { x, y: y - size + 2, size, font });
  };

  // Header
  drawText(data.carrier, TPL.header.carrier.x, TPL.header.carrier.y, 9, 180);
  drawText(data.terminal, TPL.header.terminal.x, TPL.header.terminal.y, 9, 180);
  drawText(data.truck, TPL.header.truck.x, TPL.header.truck.y, 9, 80);
  drawText(data.date, TPL.header.date.x, TPL.header.date.y, 9, 90);
  drawText(data.driver, TPL.header.driver.x, TPL.header.driver.y, 9, 200);
  // Paperwork inline under header (aligned right area)
  const pwText = (Array.isArray(data.paperwork) && data.paperwork.length) ? data.paperwork.join(', ') : '—';
  drawText(`PAPERWORK ATTACHED: ${pwText}` , 500, 540, 9, 320);

  // Trip Details rows (only filled) with dynamic row height
  const dCols = TPL.details.cols;
  const dStartX = TPL.details.startX;
  const detailsRows = (data.extraLines || []).filter(r => isDetailFilled(r));
  const detailsCount = detailsRows.length;
  const detailsBottomY = TPL.lines.startY + 20; // keep gap above trip lines
  const detailsSpace = Math.max(40, TPL.details.startY - detailsBottomY);
  const detailsRowH = Math.max(10, Math.min(TPL.details.rowH, Math.floor(detailsSpace / Math.max(1, detailsCount || 1))));
  const fsBodyDetails = Math.max(6, Math.min(9, Math.floor(detailsRowH * 0.6)));
  let y = TPL.details.startY;
  for (const r of detailsRows) {
    let x = dStartX;
    const cells = [r.trailer, r.fromLoc, r.toLoc, r.dispatch, r.ldmt, r.blno, r.weight];
    for (let ci = 0; ci < dCols.length; ci++) {
      drawText(cells[ci] || '', x + 3, y, fsBodyDetails, dCols[ci] - 6);
      x += dCols[ci];
    }
    y -= detailsRowH;
  }

  // Trip Lines rows (only filled) with dynamic row height to fit one page
  const lCols = TPL.lines.cols;
  const lStartX = TPL.lines.startX;
  y = TPL.lines.startY;
  const printable = (data.rows || []).filter(r => isRowFilled(r));
  const linesCount = printable.length;
  const linesBottomY = TPL.totals.y + 40; // keep room for totals & signature
  const linesSpace = Math.max(60, y - linesBottomY);
  const linesRowH = Math.max(10, Math.min(TPL.lines.rowH, Math.floor(linesSpace / Math.max(1, linesCount || 1))));
  const fsBodyLines = Math.max(6, Math.min(9, Math.floor(linesRowH * 0.6)));
  const formatHwys = (r) => {
    const arr = Array.isArray(r?.hwys) ? r.hwys : (r?.hwy ? [r.hwy] : []);
    return arr.map(h => typeof h === 'object' ? (h?.label || '') : (h || '')).filter(Boolean).join(', ');
  };
  for (const r of printable) {
    let x = lStartX;
    const cells = [
      r?.d || data.date || '',
      r?.prov?.label || '',
      formatHwys(r),
      r?.ob || '', r?.oe || '',
      r?.tollType === 'non-toll' ? (r?.knt || '') : '',
      r?.tollType === 'toll' ? (r?.kt || '') : '',
      r?.l || '', r?.fv || ''
    ];
    for (let ci = 0; ci < lCols.length; ci++) {
      drawText(cells[ci] || '', x + 3, y, fsBodyLines, lCols[ci] - 6);
      x += lCols[ci];
    }
    y -= linesRowH;
  }

  // Signature image (if provided)
  if (imageSig && typeof imageSig === 'string' && imageSig.startsWith('data:image')) {
    try {
      const pngBytes = await (await fetch(imageSig)).arrayBuffer();
      const pngImg = await outputDoc.embedPng(pngBytes);
      const iw = pngImg.width, ih = pngImg.height;
      const pad = 4; const boxW = TPL.signature.w - 2 * pad; const boxH = TPL.signature.h - 2 * pad;
      const scale = Math.min(boxW / iw, boxH / ih);
      const w = Math.max(1, Math.floor(iw * scale));
      const h = Math.max(1, Math.floor(ih * scale));
      const x = TPL.signature.x + pad + (boxW - w) / 2;
      const yTop = TPL.signature.y; // top coordinate
      const yBottom = yTop - h + 2; // convert to bottom-left
      page.drawImage(pngImg, { x, y: yBottom, width: w, height: h });
    } catch {}
  }

  const finalBytes = await outputDoc.save();
  return new Blob([finalBytes], { type: 'application/pdf' });
}

function addSignatureImageContain(doc, dataUrl, { boxX, boxY, boxW, boxH, fallbackName }) {
  console.log('=== SIGNATURE FUNCTION CALLED ===');
  console.log('Input params:', { boxX, boxY, boxW, boxH });
  
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.trim() !== '') {
    try {
      // İmza data URL'ini kontrol et
      if (!dataUrl.startsWith('data:image/')) {
        console.warn('Invalid signature data URL format');
        return;
      }
      
      // İmza alanını TAM DOLDURACAK şekilde boyutlandır
      const w = boxW - 4; // Alan genişliğinin neredeyse tamamı (4 point margin)
      const h = boxH - 4; // Alan yüksekliğinin neredeyse tamamı (4 point margin)
      
      // İmzayı alanın içinde ortala
      const x = boxX + 2; // Küçük margin
      const y = boxY + 2; // Küçük margin
      
      console.log('=== FINAL SIGNATURE PLACEMENT (FULL AREA) ===');
      console.log('Position:', { x, y, w, h });
      console.log('Original area:', { boxX, boxY, boxW, boxH });
      console.log('Fill ratio: width =', (w/boxW*100).toFixed(1), '% height =', (h/boxH*100).toFixed(1), '%');
      
      // İmzayı büyük boyutta ekle
      doc.addImage(dataUrl, "PNG", x, y, w, h, undefined, "FAST");
      
      console.log('=== SIGNATURE ADDED SUCCESSFULLY (FULL SIZE) ===');
      
    } catch (error) {
      console.error('Signature insertion error:', error);
    }
  } else if (fallbackName && fallbackName.trim()) {
    // Fallback name için
    const fontCandidates = ["Sacramento", "GreatVibes", "DancingScript", "BrushScriptStd", "times"];
    for (const f of fontCandidates) {
      try { doc.setFont(f, "normal"); break; } catch {}
    }
    doc.setFontSize(12);
    doc.setTextColor(34, 34, 34);
    doc.text(fallbackName, boxX + 5, boxY + boxH / 2 + 2);
  }
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

// Utility helpers (date, ids, barcode placeholder)
function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function makeReportId(dateStr) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TR-${(dateStr || todayLocal()).replace(/[^0-9]/g, "")}-${rand}`;
}
function drawBarcode(doc, text, { maxWidth = 200, height = 36, x = 10, y = 10 } = {}) {
  // Draw a clean, modern barcode without border
  try {
    // Modern barcode - sadece dikey çizgiler, çerçeve yok
    doc.setDrawColor(...PDF_STYLE.colors.gray);
    
    const barcodeStartX = x + 5;
    const barcodeEndX = x + maxWidth - 5;
    const barcodeWidth = barcodeEndX - barcodeStartX;
    const barcodeTopY = y - height + 5;
    const barcodeBottomY = y - 8; // Leave space for text
    
    // Modern minimalist barcode pattern
    const lineCount = 35;
    const lineSpacing = barcodeWidth / lineCount;
    
    for (let i = 0; i < lineCount; i++) {
      const lineX = barcodeStartX + (i * lineSpacing);
      
      // Create varying line thickness pattern based on position
      let lineWidth;
      if (i % 7 === 0) lineWidth = 2.5;      // Thick lines
      else if (i % 3 === 0) lineWidth = 1.5; // Medium lines  
      else lineWidth = 0.8;                  // Thin lines
      
      doc.setLineWidth(lineWidth);
      doc.line(lineX, barcodeTopY, lineX, barcodeBottomY);
    }
    
  } catch (e) {
    console.warn('Barcode drawing error:', e);
  }
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
  const [carrier, setCarrier] = useState("TVM");
  const [terminal, setTerminal] = useState("Central Yard");
  const [truck, setTruck] = useState("9499");
  const [date, setDate] = useState(todayLocal());
  const [driver, setDriver] = useState("Rukan Gocer");
  const [sig, setSig] = useState("");
  const [paperwork, setPaperwork] = useState([]);
  const [rows, setRows] = useState([]);
  const [extraLines, setExtraLines] = useState([]);
  const [sigAudit, setSigAudit] = useState(null);
  const [sigAck, setSigAck] = useState(false);
  const [notes, setNotes] = useState("");
  const didRestore = useRef(false);
  
  // Import/Export states
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const fileInputRef = useRef(null);
  
  // NEW: Validation errors (all fields except liters and fuel vendor required)
  const validationErrors = useMemo(()=>{
    const errs = [];
    // Header required fields (retain)
    if(!carrier?.trim()) errs.push('Carrier Name is required');
    if(!terminal?.trim()) errs.push('Terminal is required');
    if(!truck?.trim()) errs.push('Truck No is required');
    if(!date?.trim()) errs.push('Date is required');
    if(!driver?.trim()) errs.push('Driver Name is required');

    // Trip Detail fields - ALL required for EVERY trip detail row (always validated)
    extraLines.forEach((d, idx)=>{
      // All fields are always required for trip details
      if(!d.trailer?.trim()) errs.push(`Trip Detail #${idx+1}: Trailer No required`);
      if(!d.fromLoc?.trim()) errs.push(`Trip Detail #${idx+1}: From required`);
      if(!d.toLoc?.trim()) errs.push(`Trip Detail #${idx+1}: To required`);
      if(!d.dispatch?.trim()) errs.push(`Trip Detail #${idx+1}: Dispatch No required`);
      if(!d.blno?.trim()) errs.push(`Trip Detail #${idx+1}: Bill No required`);
      if(!d.weight?.trim()) errs.push(`Trip Detail #${idx+1}: Weight required`);
    });

    // Trip Line fields - ALL required if any of them is started (excluding liters & fuel vendor)
    rows.forEach((r, idx)=>{
      const fields = [r.d, r?.prov?.label, (Array.isArray(r.hwys)?r.hwys.length:0)>0, r.ob, r.oe, r.knt, r.kt];
      const anyFilled = fields.some(v=>{
        if(Array.isArray(v)) return v.length>0; 
        return String(v||'').trim()!=='';
      });
      if(anyFilled){
        if(!r.d?.trim()) errs.push(`Trip Line #${idx+1}: Date required`);
        if(!(r?.prov?.label?.trim())) errs.push(`Trip Line #${idx+1}: Province required`);
        const hasHwy = Array.isArray(r.hwys) ? r.hwys.length>0 : false;
        if(!hasHwy) errs.push(`Trip Line #${idx+1}: Highway Used required`);
        if(!r.ob?.trim()) errs.push(`Trip Line #${idx+1}: Odometer Begin required`);
        if(!r.oe?.trim()) errs.push(`Trip Line #${idx+1}: Odometer End required`);
        const kmValue = r.tollType === 'toll' ? r.kt : r.knt; // only displayed field
        if(!kmValue?.trim()) errs.push(`Trip Line #${idx+1}: KM ${r.tollType==='toll'?'TOLL':'NON-TOLL'} required`);
      }
    });

    return errs;
  },[carrier, terminal, truck, date, driver, extraLines, rows]);
  const isFormValidForExport = validationErrors.length === 0;

  // Export current form data (blocked if validation fails)
  const handleExport = () => {
    if(!isFormValidForExport){
      alert('Eksik zorunlu alanlar var.\nZorunlu Alanlar:\n- Trip Detail: Trailer No, From, To, Dispatch No, Bill No, Weight\n- Trip Line: Date, Province, Highway, Odometer Begin/End, KM\n- Header: Carrier, Terminal, Truck, Date, Driver\n\nMissing Required Fields:\n- ' + validationErrors.join('\n- '));
      return;
    }
    const currentData = { carrier, terminal, truck, date, driver, sig, paperwork, rows, extraLines };
    exportFormData(currentData);
  };
  
  // Import form data
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportError('');
    setImportSuccess('');

    importFormData(
      file,
      (importedData) => {
        // Update all states with imported data
        setCarrier(importedData.carrier || '');
        setTerminal(importedData.terminal || '');
        setTruck(importedData.truck || '');
        setDate(importedData.date || todayLocal());
        setDriver(importedData.driver || '');
        setSig(importedData.sig || '');
        setPaperwork(importedData.paperwork || []);
        setRows(importedData.rows || []);
        setExtraLines(importedData.extraLines || []);
        
        setImportSuccess('Data imported successfully!');
        setTimeout(() => setImportSuccess(''), 3000);
      },
      (error) => {
        setImportError(error);
        setTimeout(() => setImportError(''), 5000);
      }
    );

    // Reset file input
    event.target.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Incognito detection
  useEffect(() => {
    detectIncognito().then(setIsIncognito);
  }, []);

  // Restore saved data, migrating single hwy -> hwys[] if needed
  useEffect(() => {
    if (didRestore.current) return;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj && obj.date === todayLocal()) {
          setCarrier(obj.carrier || "TVM");
          setTerminal(obj.terminal || "Central Yard");
          setTruck(obj.truck || "9499");
          setDate(obj.date || todayLocal());
          setDriver(obj.driver || "Rukan Gocer");
          setSig(obj.sig || "");
          setPaperwork(obj.paperwork || []);
          const migratedRows = (obj.rows || []).map(r => ({
            ...r,
            hwys: Array.isArray(r?.hwys) ? r.hwys : (r?.hwy ? [r.hwy] : []),
          }));
          setRows(migratedRows);
          setExtraLines(obj.extraLines || []);
          setNotes(obj.notes || "");
        }
      }
    } catch {}
    didRestore.current = true;
  }, []);

  // Save to localStorage whenever relevant state changes
  useEffect(() => {
    const obj = { carrier, terminal, truck, date, driver, sig, paperwork, rows, extraLines, notes };
    if (date === todayLocal()) {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    }
  }, [carrier, terminal, truck, date, driver, sig, paperwork, rows, extraLines, notes]);

  const addExtraLine = () => {
    setExtraLines(l => {
      if (l.length >= NUM_ROWS) return l;
      const newDetail = { trailer: "", fromLoc: "", toLoc: "", dispatch: "", ldmt: "", blno: "", weight: "" };
      const updated = [...l, newDetail];
      
      // If this is the first trip detail being added, automatically check Bill Lading and Del. Receipt
      if (updated.length === 1) {
        setPaperwork(['Bill Lading', 'Del. Receipt']);
      }
      
      return updated;
    });
    setRows(r => {
      if (r.length >= NUM_ROWS) return r;
      const prev = r[r.length - 1];
      const ob = prev ? prev.oe : "";
      const newRows = [...r, { d: date, prov: null, hwys: [], ob, oe: "", knt: "", kt: "", l: "", fv: "", tollType: "non-toll" }];
      for (let j = 1; j < newRows.length; j++) newRows[j].ob = newRows[j - 1].oe || "";
      return newRows;
    });
  };
  // Auto-fill logic based on bill number
  const getAutoFillFromBillNo = (blno) => {
    if (!blno || !String(blno).trim()) {
      return { fromLoc: "", toLoc: "", prov: null, hwys: [] };
    }
    const firstChar = String(blno).charAt(0);
    if (firstChar === '1') {
      return {
        fromLoc: 'Wap',
        toLoc: 'Cosma',
        prov: { label: 'Ontario', value: 'on' },
        hwys: [{ label: 'HWY 401' }, { label: 'HWY 3' }]
      };
    } else if (firstChar === '8') {
      return {
        fromLoc: 'Cosma',
        toLoc: 'Wap',
        prov: { label: 'Ontario', value: 'on' },
        hwys: [{ label: 'HWY 3' }, { label: 'HWY 401' }]
      };
    }
    return { fromLoc: "", toLoc: "", prov: null, hwys: [] };
  };

  const setExtraLine = (i, patch) => setExtraLines(l => l.map((row, idx) => {
    if (idx !== i) return row;
    const updated = { ...row, ...patch };
    
    // If bill number changed, auto-fill or reset route fields
    if (patch.hasOwnProperty('blno')) {
      const autoFill = getAutoFillFromBillNo(patch.blno);
      // Always update from/to based on bill number (empty if bill is cleared)
      updated.fromLoc = autoFill.fromLoc;
      updated.toLoc = autoFill.toLoc;
      
      // Update corresponding trip line province and highways
      setRow(i, {
        prov: autoFill.prov || null,
        hwys: autoFill.hwys || []
      });
    }
    
    return updated;
  }));

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
    const newRows = [...r, { d: date, prov: null, hwys: [], ob, oe: "", knt: "", kt: "", l: "", fv: "", tollType: "non-toll" }];
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
  const isDetailFilled = (d) => {
    if (!d) return false;
    return [d.trailer, d.fromLoc, d.toLoc, d.dispatch, d.ldmt, d.blno, d.weight]
      .some(v => String(v ?? "").trim() !== "");
  };
  const isRowFilled = (r) => {
    if (!r) return false;
    const hasHwys = Array.isArray(r.hwys) ? r.hwys.length > 0 : !!r.hwy;
    return [r.d, r?.prov?.label, hasHwys ? 'x' : '', r.ob, r.oe, r.knt, r.kt, r.l, r.fv]
      .some(v => String(v ?? "").trim() !== "");
  };

  const buildPdf=()=>{
    try {
      const doc=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
      const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=28;

      // Header - match FormPreview style
      doc.setFont("times","bold"); 
      doc.setTextColor(...PDF_STYLE.colors.black); 
      doc.setFontSize(PDF_STYLE.header.fontSize);
      doc.text("DAILY FUEL / TRIP REPORT",W/2,M+16,{align:"center"});
      
      let y = M + 40;
      const fieldHeight = 20;
      
      // Top row: Carrier, Terminal, Truck (with underlines like FormPreview)
      doc.setFont("times","bold");
      doc.setFontSize(PDF_STYLE.header.fieldFontSize);
      doc.setTextColor(...PDF_STYLE.colors.black);
      
      const col1X = M, col2X = M + (W-2*M)/3, col3X = M + 2*(W-2*M)/3;
      
      // Carrier Name
      doc.text("CARRIER NAME", col1X, y);
      doc.setFont("times","normal");
      doc.setFontSize(PDF_STYLE.header.fieldValueSize);
      doc.text(carrier||'', col1X, y + 14);
      doc.setLineWidth(PDF_STYLE.header.underlineWidth);
      doc.setDrawColor(...PDF_STYLE.colors.gray);
      doc.line(col1X, y + 18, col2X - 20, y + 18);
      
      // Terminal
      doc.setFont("times","bold");
      doc.setFontSize(PDF_STYLE.header.fieldFontSize);
      doc.text("TERMINAL", col2X, y);
      doc.setFont("times","normal");
      doc.setFontSize(PDF_STYLE.header.fieldValueSize);
      doc.text(terminal||'', col2X, y + 14);
      doc.line(col2X, y + 18, col3X - 20, y + 18);
      
      // Truck No
      doc.setFont("times","bold");
      doc.setFontSize(PDF_STYLE.header.fieldFontSize);
      doc.text("TRUCK NO", col3X, y);
      doc.setFont("times","normal");
      doc.setFontSize(PDF_STYLE.header.fieldValueSize);
      doc.text(truck||'', col3X, y + 14);
      doc.line(col3X, y + 18, W - M, y + 18);
      
      y += fieldHeight + 8;
      
      // Second row: Date, Driver, Signature (with underlines like FormPreview)
      doc.setFont("times","bold");
      doc.setFontSize(PDF_STYLE.header.fieldFontSize);
      
      // Date
      doc.text("DATE", col1X, y);
      doc.setFont("times","normal");
      doc.setFontSize(PDF_STYLE.header.fieldValueSize);
      doc.text(date||'', col1X, y + 14);
      doc.line(col1X, y + 18, col2X - 20, y + 18);
      
      // Driver Name
      doc.setFont("times","bold");
      doc.setFontSize(PDF_STYLE.header.fieldFontSize);
      doc.text("DRIVER NAME", col2X, y);
      doc.setFont("times","normal");
      doc.setFontSize(PDF_STYLE.header.fieldValueSize);
      doc.text(driver||'', col2X, y + 14);
      doc.line(col2X, y + 18, col3X - 20, y + 18);
      
      // Driver Signature  
      doc.setFont("times","bold");
      doc.setFontSize(PDF_STYLE.header.fieldFontSize);
      doc.text("DRIVER SIGNATURE", col3X, y);
      
      // "DRIVER SIGNATURE" text'inin genişliğini hesapla
      const sigLabelWidth = doc.getTextWidth("DRIVER SIGNATURE");
      const sigStartX = col3X + sigLabelWidth + 3; // Text'ten sonra 3 point boşluk
      
      doc.setFont("times","normal");
      doc.setFontSize(PDF_STYLE.header.fieldValueSize);
      
      // Add signature if exists - title'ın yanına yerleştir
      if (sig && typeof sig === 'string' && sig.trim() !== '') {
        console.log('DEBUG: Attempting to add signature v3');
        console.log('DEBUG: y position:', y);
        console.log('DEBUG: sigStartX:', sigStartX);
        console.log('DEBUG: sigLabelWidth:', sigLabelWidth);
        console.log('DEBUG: Available width:', W - M - sigStartX);
        try {
          addSignatureImageContain(doc, sig, {
            boxX: sigStartX, // Title'dan sonra başla
            boxY: y - 8, // Title'ın biraz altından başla
            boxW: W - M - sigStartX, // Kalan genişlik
            boxH: 20, // Underline'a kadar alan
            fallbackName: ""
          });
        } catch (sigError) {
          console.error('Signature insertion failed:', sigError);
          console.log('Signature data exists:', !!sig);
          console.log('Signature length:', sig?.length);
        }
      } else {
        console.log('DEBUG: No signature to add', { sig: !!sig, length: sig?.length });
      }
      
      doc.line(col3X, y + 18, W - M, y + 18);
      
      y += fieldHeight + 8;
      
      y += 16; // Space after header fields

      // Prepare tables with dynamic scaling to fit one page
      const filledExtra = extraLines.filter(isDetailFilled);
      const printable = rows.filter(isRowFilled);

      const baseRowH = 14;
      const headersCount = (filledExtra.length>0 ? 1 : 0) + 1;
      const gaps = 10 + (filledExtra.length>0 ? 6 : 0);
      const reservedBottom = 100; // Space for paperwork + barcode at bottom
      const available = Math.max(100, H - (y + gaps) - reservedBottom);
      const totalRowUnits = (filledExtra.length + printable.length + headersCount);
      const scale = Math.min(1, available / Math.max(1, totalRowUnits * baseRowH));
      const fs = Math.max(6, Math.round(PDF_STYLE.table.fontSize * scale * 10) / 10);
      const rowMinH = Math.max(8, Math.round(baseRowH * scale));

      // Calculate table widths to make them same length
      const tableStartX = M;
      const tableEndX = W - M;
      const tableWidth = tableEndX - tableStartX;

      // Details table (match FormPreview style exactly)
      if (filledExtra.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["TRAILER NO", "FROM", "TO", "DISPATCH NO", "LD / MT", "B/L NO", "WEIGHT"]],
          body: filledExtra.map(r => [r.trailer||'', r.fromLoc||'', r.toLoc||'', r.dispatch||'', r.ldmt||'', r.blno||'', r.weight||'']),
          margin: { left: M, right: M },
          styles: { 
            font: 'times', 
            fontSize: fs, 
            cellPadding: PDF_STYLE.table.cellPadding, 
            halign: 'left',  // Left align like FormPreview
            valign: 'middle', 
            fillColor: PDF_STYLE.colors.white,  // Default white background
            lineColor: PDF_STYLE.colors.gray,  // Modern gray borders
            lineWidth: PDF_STYLE.table.lineWidth, 
            textColor: PDF_STYLE.colors.black,  // Black text
            minCellHeight: rowMinH, 
            overflow: 'linebreak' 
          },
          headStyles: { 
            fillColor: PDF_STYLE.colors.white,  // White header background
            textColor: PDF_STYLE.colors.black,     // Black text on gray
            lineColor: PDF_STYLE.colors.gray, 
            lineWidth: PDF_STYLE.table.lineWidth, 
            fontStyle: 'bold', 
            minCellHeight: rowMinH,
            halign: 'left'  // Left align headers too
          },
          bodyStyles: {
            fillColor: PDF_STYLE.colors.white,  // White background for all body cells
            lineColor: PDF_STYLE.colors.gray,
            lineWidth: PDF_STYLE.table.lineWidth,
            textColor: PDF_STYLE.colors.black,
          },
          columnStyles: {
            0: { cellWidth: tableWidth * 0.12, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // TRAILER NO
            1: { cellWidth: tableWidth * 0.15, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // FROM
            2: { cellWidth: tableWidth * 0.15, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // TO
            3: { cellWidth: tableWidth * 0.15, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // DISPATCH NO
            4: { cellWidth: tableWidth * 0.1, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black },  // LD/MT
            5: { cellWidth: tableWidth * 0.15, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // B/L NO
            6: { cellWidth: tableWidth * 0.18, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // WEIGHT
          },
          pageBreak: 'avoid',
          rowPageBreak: 'avoid',
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Trip Lines table (match FormPreview style exactly)
      const head=[["DATE","PROVINCE","HIGHWAY USED","ODOMETER BEGIN","ODOMETER END","KM NON-TOLL","KM TOLL","LITERS","FUEL VENDOR"]];
      const body=printable.map(r=>[
        (r?.d && String(r.d).trim()) ? r.d : (date || ""),
        r?.prov?.label || "",
        (Array.isArray(r?.hwys)?r.hwys:(r?.hwy?[r.hwy]:[])).map(h=>typeof h==='object'?(h?.label||""):(h||"")).filter(Boolean).join(', '),
        r?.ob||"", r?.oe||"",
        r?.tollType === "non-toll" ? (r?.knt||"") : "",
        r?.tollType === "toll" ? (r?.kt||"") : "",
        r?.l||"", r?.fv||""
      ]);

      // Calculate KM totals
      const totalNonToll = printable.reduce((sum,r)=>sum + (r?.tollType==='non-toll' ? (parseFloat(r?.knt)||0) : 0),0);
      const totalToll    = printable.reduce((sum,r)=>sum + (r?.tollType==='toll' ? (parseFloat(r?.kt)||0) : 0),0);
      // Optional: total liters if needed later
      // const totalLiters = printable.reduce((s,r)=> s + (parseFloat(r?.l)||0),0);

      autoTable(doc,{
        head, body, startY: y, margin:{left:M,right:M},
        foot: [["","","","","TOTAL KM:", String(totalNonToll||''), String(totalToll||''), "", ""]],
        styles:{
          font:'times',
          fontSize:fs,
          cellPadding:PDF_STYLE.table.cellPadding,
          halign:'left',  // Left align like FormPreview
          valign:'middle',
          fillColor:PDF_STYLE.colors.white,  // Default white background
          lineColor:PDF_STYLE.colors.gray,  // Modern gray borders
          lineWidth:PDF_STYLE.table.lineWidth,
          textColor:PDF_STYLE.colors.black,  // Black text
          minCellHeight: rowMinH,
          overflow: 'linebreak'
        },
        headStyles:{
          fillColor:PDF_STYLE.colors.white,  // White header background
          textColor:PDF_STYLE.colors.black,     // Black text on gray
          lineColor:PDF_STYLE.colors.gray,
          lineWidth:PDF_STYLE.table.lineWidth,
          fontStyle:'bold', 
          minCellHeight: rowMinH,
          halign:'left'  // Left align headers
        },
        bodyStyles: {
          fillColor: PDF_STYLE.colors.white,  // White background for all body cells
          lineColor: PDF_STYLE.colors.gray,
          lineWidth: PDF_STYLE.table.lineWidth,
          textColor: PDF_STYLE.colors.black,
        },
        footStyles:{
          fillColor: PDF_STYLE.colors.white,
          textColor: PDF_STYLE.colors.black,
          fontStyle: 'bold',
          lineColor: PDF_STYLE.colors.gray,
          lineWidth: PDF_STYLE.table.lineWidth,
          halign: 'left'
        },
        columnStyles:{
          0: { cellWidth: tableWidth * 0.08, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // DATE
          1: { cellWidth: tableWidth * 0.1, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black },  // PROVINCE
          2: { cellWidth: tableWidth * 0.15, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // HIGHWAY USED
          3: { cellWidth: tableWidth * 0.12, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // ODOMETER BEGIN
          4: { cellWidth: tableWidth * 0.12, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // ODOMETER END
          5: { cellWidth: tableWidth * 0.12, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // KM NON-TOLL
          6: { cellWidth: tableWidth * 0.1, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black },  // KM TOLL
          7: { cellWidth: tableWidth * 0.08, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // LITERS
          8: { cellWidth: tableWidth * 0.13, fillColor: PDF_STYLE.colors.white, textColor: PDF_STYLE.colors.black }, // FUEL VENDOR
        },
        pageBreak: 'avoid',
        rowPageBreak: 'avoid',
      });

      let y2=doc.lastAutoTable.finalY+12;
      
      // ===== FIXED BOTTOM SECTION - ALWAYS FITS ON ONE PAGE =====
      // Position from actual bottom of page (H = 595.28 for A4 landscape)
      const fixedBottomY = H - M - 50; // 50pt from bottom margin
      const notesAreaHeight = 50; // Fixed height for notes area
      const notesTopY = fixedBottomY - notesAreaHeight; // Notes start here
      
      // Notes section (fixed height)
      let dividerY;
      if (notes.trim()) {
        doc.setFont("times", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...PDF_STYLE.colors.black);
        doc.text("NOTES:", M, notesTopY);
        
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...PDF_STYLE.colors.black);
        const notesMaxWidth = W - 2 * M;
        const splitNotes = doc.splitTextToSize(notes, notesMaxWidth);
        
        // Limit notes display to fixed area
        const maxNotesLines = 5;
        const displayNotes = splitNotes.slice(0, maxNotesLines);
        doc.text(displayNotes, M, notesTopY + 12);
        
        // Divider line - only show if there are notes
        dividerY = notesTopY - 8;
        doc.setDrawColor(...PDF_STYLE.colors.gray);
        doc.setLineWidth(0.5);
        doc.line(M, dividerY, W - M, dividerY);
      } else {
        // No notes, so divider Y is positioned lower (no notes area to separate)
        dividerY = notesTopY;
      }
      
      // ===== PAPERWORK ON FAR RIGHT - FIXED AT BOTTOM =====
      const paperworkRightX = W - M - 170;
      const checkboxSize = 10;
      
      // Paperwork positioned well above divider (more breathing room from notes)
      const paperworkStartY = dividerY - 50;
      
      // Header
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...PDF_STYLE.colors.black);
      doc.text("PAPERWORK ATTACHED:", paperworkRightX, paperworkStartY);
      
      // Paperwork items - 2 columns, properly spaced
      const pwCol1X = paperworkRightX;
      const pwCol2X = paperworkRightX + 95;
      const pwFirstItemY = paperworkStartY + 10; // 10pt spacing from header to first item
      const itemSpacing = 12; // 12pt spacing between items (more space)
      
      PAPERWORK_OPTIONS.forEach((item, index) => {
        const isChecked = paperwork.includes(item);
        
        // Column distribution: items 0,1,2 in col1; items 3,4 in col2
        let itemX, itemY;
        if (index < 3) {
          itemX = pwCol1X;
          itemY = pwFirstItemY + (index * itemSpacing);
        } else {
          itemX = pwCol2X;
          itemY = pwFirstItemY + ((index - 3) * itemSpacing);
        }
        
        // Draw checkbox rectangle
        doc.setDrawColor(...PDF_STYLE.colors.black);
        doc.setLineWidth(0.5);
        doc.rect(itemX, itemY, checkboxSize, checkboxSize);
        
        // If checked, draw simple checkmark lines
        if (isChecked) {
          doc.setDrawColor(...PDF_STYLE.colors.black);
          doc.setLineWidth(1);
          // Draw checkmark with two lines (like ✓)
          doc.line(itemX + 2, itemY + 5.5, itemX + 3.5, itemY + 7);      // Left diagonal
          doc.line(itemX + 3.5, itemY + 7, itemX + 7.5, itemY + 3.5);    // Right diagonal
        }
        
        // Draw label text next to checkbox
        doc.setFont("times", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...PDF_STYLE.colors.black);
        doc.text(item.toUpperCase(), itemX + checkboxSize + 3, itemY + 6.5, { maxWidth: 80 });
      });

      return doc;
    } catch (error) {
      console.error('Error in buildPdf:', error);
      throw error;
    }
  };

  // Build final PDF blob: Always use new jsPDF method for download (same style as print preview)
  const buildFinalPdfBlob = async () => {
    console.log('Building PDF with new jsPDF method for download...');
    try {
      const doc = buildPdf();
      if (!doc) throw new Error('buildPdf returned null');
      console.log('PDF generated successfully with new method for download');
      return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
    } catch (e) {
      console.error('New PDF generation failed:', e);
      // Create basic landscape PDF as fallback
      try {
        const fallbackDoc = new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
        const W = fallbackDoc.internal.pageSize.getWidth();
        const H = fallbackDoc.internal.pageSize.getHeight();
        fallbackDoc.setFont("times","normal");
        fallbackDoc.setFontSize(16);
        fallbackDoc.text("DAILY FUEL / TRIP REPORT", W/2, 50, {align:"center"});
        fallbackDoc.setFontSize(12);
        fallbackDoc.text(`Carrier: ${carrier} | Terminal: ${terminal} | Truck: ${truck}`, 40, 100);
        fallbackDoc.text(`Date: ${date} | Driver: ${driver}`, 40, 120);
        fallbackDoc.text("Error generating detailed report. Please try again.", 40, 160);
        console.log('PDF generated with basic fallback');
        return new Blob([fallbackDoc.output('arraybuffer')], { type: 'application/pdf' });
      } catch (basicError) {
        console.error('All PDF generation methods failed:', basicError);
        throw new Error('PDF generation completely failed');
      }
    }
  };

  const downloadPdf = async () => {
    if(!isFormValidForExport){
      alert('Eksik zorunlu alanlar var.\nZorunlu Alanlar:\n- Trip Detail: Trailer No, From, To, Dispatch No, Bill No, Weight\n- Trip Line: Date, Province, Highway, Odometer Begin/End, KM\n- Header: Carrier, Terminal, Truck, Date, Driver\n\nMissing Required Fields:\n- ' + validationErrors.join('\n- '));
      return;
    }
    if (window.confirm('⚠️ Downloading the PDF will permanently delete all saved trip data for today in this browser. Are you sure you want to continue?')) {
      try {
        localStorage.removeItem(LS_KEY);
        const blob = await buildFinalPdfBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TripReport_${date||''}_${driver||'Driver'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        console.error("Failed to download PDF:", error);
        alert("Could not generate PDF. Please try again.");
      }
    }
  };

  const sendByEmail = () => {
    alert('Email server is not configured.');
  };
  const openPdf = async () => {
    // Use the same buildPdf() pipeline as download, but open in new tab instead
    try {
      const blob = await buildFinalPdfBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        // fallback: same tab
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("Failed to open PDF:", error);
      alert("Could not generate PDF. Please try again.");
    }
  };
  const resetAll = () => {
    if (window.confirm('⚠️ Resetting the form will permanently delete all saved trip data for today in this browser. Are you sure you want to continue?')) {
      localStorage.removeItem(LS_KEY);
      setCarrier("TVM");
      setTerminal("Central Yard");
      setTruck("9499");
      setDate(todayLocal());
      setDriver("Rukan Gocer");
      setSig("");
      setPaperwork([]);
      setExtraLines([]);
      setRows([]);
      setNotes("");
    }
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className={`px-3 py-1 rounded text-sm ${isFormValidForExport? 'bg-blue-500 text-white hover:bg-blue-600':'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
              title="Export current form data to JSON file"
              disabled={!isFormValidForExport}
            >
              📤 Export
            </button>
            <button
              onClick={triggerFileInput}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              title="Import form data from JSON file"
            >
              📥 Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>
        {(!isFormValidForExport && validationErrors.length>0) && (
          <div className="mx-4 mt-2 rounded-lg bg-red-100 border border-red-300 p-3 text-red-800 text-xs space-y-1">
            <div className="font-semibold">Missing Required Fields:</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {validationErrors.map((e,i)=>(<li key={i}>{e}</li>))}
            </ul>
          </div>
        )}
        {/* Static header fields */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 p-4">
          <div>
            <label className="mb-1 block text-sm">Carrier Name</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-base" style={{ fontSize: '16px' }}
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
          <div>
            <label className="mb-1 block text-sm">Terminal</label>
            <input 
              className="w-full rounded border border-gray-300 px-3 py-2 text-base" 
              style={{ fontSize: '16px' }} 
              value={terminal} 
              onChange={e=>setTerminal(e.target.value)}
              list="terminal-options"
              autoComplete="off"
            />
            <datalist id="terminal-options">
              <option value="Central Yard" />
              <option value="Cottam" />
              <option value="Cosma" />
              <option value="Wap" />
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm">Truck No</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base md:text-sm placeholder-gray-400"
              value={truck}
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              placeholder="Truck No"
              onChange={(e)=>setTruck(e.target.value.replace(/[^0-9]/g,""))}
              list="truck-options"
              autoComplete="off"
            />
            <datalist id="truck-options">
              <option value="9496" />
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm">Date</label>
            <div className="flex w-full">
              <input type="date" className="w-full rounded border border-gray-300 px-3 py-2 text-base" style={{ fontSize: '16px' }} value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">Driver Name</label>
            <input 
              className="w-full rounded border border-gray-300 px-3 py-2 text-base" 
              style={{ fontSize: '16px' }} 
              value={driver} 
              onChange={e=>setDriver(e.target.value)}
              list="driver-options"
              autoComplete="off"
            />
            <datalist id="driver-options">
              <option value="Rukan Gocer" />
            </datalist>
          </div>
        </div>

        {/* Datalist for location options */}
        <datalist id="location-options">
          <option value="Cottam" />
          <option value="Central Yard" />
          <option value="Cosma" />
          <option value="Wap" />
        </datalist>

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

            {extraLines.map((r,i)=>{
              const tr = rows[i] || { d: date, prov: null, hwys: [], ob: "", oe: "", knt: "", kt: "", l: "", fv: "", tollType: "non-toll" };
              return (
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

                {/* Trip Detail fields */}
                <div className="grid grid-cols-1 gap-2 border-t p-3 md:grid-cols-7 md:gap-2">
                  <NumericInput value={r.trailer} onChange={v=>setExtraLine(i,{trailer:v})} placeholder="Trailer No"/>
                  <input className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm" value={r.fromLoc} onChange={e=>setExtraLine(i,{fromLoc:e.target.value})} placeholder="From" list="location-options" autoComplete="off"/>
                  <input className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm" value={r.toLoc} onChange={e=>setExtraLine(i,{toLoc:e.target.value})} placeholder="To" list="location-options" autoComplete="off"/>
                  <NumericInput value={r.dispatch} onChange={v=>setExtraLine(i,{dispatch:v})} placeholder="Dispatch No"/>
                  <div className="flex gap-2 items-center">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.ldmt==='LD'}
                        onChange={e => { setExtraLine(i, { ldmt: e.target.checked ? 'LD' : '' }); }}
                      />
                      LD
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.ldmt==='MT'}
                        onChange={e => { setExtraLine(i, { ldmt: e.target.checked ? 'MT' : '' }); }}
                      />
                      MT
                    </label>
                  </div>
                  <NumericInput value={r.blno} onChange={v=>setExtraLine(i,{blno:v})} placeholder="Bill No" className="placeholder-gray-400"/>
                  <NumericInput value={r.weight} onChange={v=>setExtraLine(i,{weight:v})} placeholder="Weight" className="placeholder-gray-400"/>
                </div>

                {/* Nested Trip Line for this detail */}
                <div className="border-t p-3 mt-1 bg-gray-50/40">
                  <div className="text-xs font-medium text-gray-700 mb-2">Trip Line</div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-9 md:gap-2 items-start">
                    <div className="flex w-full">
                      <input type="date" className="rounded-md border border-gray-300 px-2 py-2 text-base md:text-sm w-full" value={tr.d} onChange={e=>setRow(i,{d:e.target.value})} placeholder="Date"/>
                    </div>
                    <div className="w-full">
                      <ProvinceAutocomplete
                        value={tr.prov}
                        onChange={prov => { setRow(i, { prov, hwys: [] }); }}
                        disabled={false}
                      />
                    </div>
                    <div className="w-full">
                      <HighwaysAutocompleteMulti
                        province={tr.prov}
                        values={tr.hwys || []}
                        onChange={vals => setRow(i, { hwys: vals })}
                        disabled={!tr.prov}
                      />
                    </div>
                    <NumericInput value={tr.ob} onChange={v=>setRow(i,{ob:v})} placeholder="Odo Begin" className="px-2"/>
                    <NumericInput value={tr.oe} onChange={v=>setRow(i,{oe:v})} placeholder="Odo End" className="px-2"/>
                    {tr.tollType === "non-toll" ? (
                      <NumericInput value={tr.knt} onChange={v => setRow(i, { knt: v })} placeholder="Km Non-Toll" className="px-2" />
                    ) : (
                      <NumericInput value={tr.kt} onChange={v => setRow(i, { kt: v })} placeholder="Km Toll" className="px-2" />
                    )}
                    <NumericInput value={tr.l} onChange={v=>setRow(i,{l:v})} placeholder="Liters" className="px-2"/>
                    <div className="md:col-span-1">
                      <VendorAutocomplete value={tr.fv || ""} onChange={v => setRow(i, { fv: v })} disabled={false} />
                    </div>
                    <div className="flex flex-col gap-0 items-start justify-center md:justify-start">
                      <label className="inline-flex items-center gap-2 text-xs mb-1">
                        <input
                          type="radio"
                          name={`tollType-${i}`}
                          checked={tr.tollType === "non-toll"}
                          onChange={() => setRow(i, { tollType: "non-toll" })}
                          className="align-middle"
                        />
                        Non-Toll
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`tollType-${i}`}
                          checked={tr.tollType === "toll"}
                          onChange={() => setRow(i, { tollType: "toll" })}
                          className="align-middle"
                        />
                        Toll
                      </label>
                    </div>
                  </div>
                </div>
              </details>
            )})}
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

        {/* Notes section */}
        <div className="mt-6 mb-6">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-base md:text-sm placeholder-gray-400 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any additional notes or comments..."
            rows="4"
          />
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
                buttonProps={{
                  type: "button",
                  className: "mt-4 flex items-center gap-2 rounded-md px-4 py-2 bg-gray-800 text-white hover:bg-gray-900",
                  style: { fontWeight: 500 },
                  children: <>
                    <span style={{ display: 'inline-block', color: '#ffffff', fontSize: '1.4em', fontWeight: 700, background: 'none', boxShadow: 'none' }}>+</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>Add Signature</span>
                  </>
                }}
              />
            </div>
          </div>
          {/* Signature certification checkbox removed as requested */}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={downloadPdf} disabled={!isFormValidForExport} className={`rounded-md px-4 py-2 border border-gray-300 flex items-center gap-2 ${isFormValidForExport? 'text-gray-800 hover:bg-gray-100':'text-gray-400 cursor-not-allowed bg-gray-100'}`}>
            <span style={{fontSize: '1.3em', display: 'inline-block'}} aria-label="Download PDF">📥</span>
            <span>Download PDF</span>
          </button>
          <button type="button" onClick={sendByEmail} className="rounded-md px-4 py-2 text-gray-800 hover:bg-gray-100 border border-gray-300 flex items-center gap-2">
            <span style={{fontSize: '1.3em', display: 'inline-block'}} aria-label="Send by Email">✉️</span>
            <span>Send by Email</span>
          </button>
          <button type="button" onClick={openPdf} className="rounded-md px-4 py-2 text-gray-800 hover:bg-gray-100 border border-gray-300 flex items-center gap-2">
            <span style={{fontSize: '1.3em', display: 'inline-block'}} aria-label="Open PDF in New Tab">🗔</span>
            <span>Open PDF in New Tab</span>
          </button>
          <button type="button" onClick={resetAll} className="rounded-md px-4 py-2 text-gray-800 hover:bg-gray-100 border border-gray-300 flex items-center gap-2">
            <span style={{fontSize: '1.3em', display: 'inline-block'}} aria-label="Reset">♻️</span>
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
