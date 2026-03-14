import React, { useRef, useState, useEffect, useCallback } from "react";

function getSHA256(str) {
  if (window.crypto && window.crypto.subtle) {
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(buf =>
      Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
    );
  }
  return Promise.resolve("");
}

export function SignatureMode({ value, onChange, readOnly, onModeChange }) {
  const canvasRef   = useRef(null);
  const wrapRef     = useRef(null);
  const isDrawing   = useRef(false);
  const lastPos     = useRef(null);
  const ctxRef      = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [thumbnail, setThumbnail] = useState(value || "");
  const [hasDrawn,  setHasDrawn]  = useState(false);

  // Sync if parent resets value
  useEffect(() => { setThumbnail(value || ""); }, [value]);

  // Notify parent when modal opens/closes
  useEffect(() => {
    if (onModeChange) onModeChange(showModal);
  }, [showModal, onModeChange]);

  // ── Canvas setup once modal mounts ──────────────────────────────────
  useEffect(() => {
    if (!showModal) return;
    const cv = canvasRef.current;
    if (!cv) return;

    const DPR = window.devicePixelRatio || 1;
    const container = cv.parentElement;
    const w = container ? container.clientWidth : 340;
    const h = Math.round(w * 0.42);

    cv.width  = Math.round(w * DPR);
    cv.height = Math.round(h * DPR);
    cv.style.width  = w + "px";
    cv.style.height = h + "px";

    const ctx = cv.getContext("2d");
    ctx.scale(DPR, DPR);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth   = 2.8;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctxRef.current  = ctx;
    setHasDrawn(false);
  }, [showModal]);

  // ── Position helpers ─────────────────────────────────────────────────
  const getPos = useCallback((e) => {
    const cv   = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  // ── Draw handlers (write directly to canvas — zero React state lag) ──
  const onStart = useCallback((e) => {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    isDrawing.current = true;
    const p = getPos(e);
    lastPos.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setHasDrawn(true);
  }, [getPos]);

  const onMove = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx  = ctxRef.current;
    const last = lastPos.current;
    if (!ctx || !last) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPos.current = p;
  }, [getPos]);

  const onEnd = useCallback((e) => {
    if (e) e.preventDefault();
    isDrawing.current = false;
    lastPos.current   = null;
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    const cv  = canvasRef.current;
    const ctx = ctxRef.current;
    if (!cv || !ctx) return;
    const DPR = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width / DPR, cv.height / DPR);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth   = 2.8;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    setHasDrawn(false);
  }, []);

  const handleConfirm = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dataUrl = cv.toDataURL("image/png");
    setThumbnail(dataUrl);
    setShowModal(false);
    const meta = { timestamp: new Date().toISOString(), userAgent: navigator.userAgent };
    getSHA256(dataUrl + JSON.stringify(meta)).then(hash => {
      onChange?.(dataUrl, { hash, ...meta });
    });
  }, [onChange]);

  const handleRemove = useCallback(() => {
    setThumbnail("");
    onChange?.("", null);
  }, [onChange]);

  const openModal  = useCallback(() => { if (!readOnly) setShowModal(true);  }, [readOnly]);
  const closeModal = useCallback(() => setShowModal(false), []);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="w-full">

      {/* ── Preview / tap-to-sign ─────────────────────────────────── */}
      {thumbnail ? (
        <div className="relative w-full rounded-2xl border-2 border-gray-200 bg-gray-50 overflow-hidden">
          <img
            src={thumbnail}
            alt="Signature"
            className="w-full object-contain"
            style={{ maxHeight: 96, display: "block" }}
          />
          {!readOnly && (
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={openModal}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-xs font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                ✏️ Edit
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-500 text-xs font-semibold shadow-sm hover:bg-red-50 active:scale-95 transition-all"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      ) : (
        !readOnly && (
          <button
            type="button"
            onClick={openModal}
            className="w-full h-20 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 active:bg-blue-100 transition-all"
          >
            <span className="text-2xl leading-none">✍️</span>
            <span className="text-sm font-semibold">Tap to sign</span>
          </button>
        )
      )}

      {/* ── Bottom-sheet modal ────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Driver Signature</h3>
                <p className="text-xs text-gray-400 mt-0.5">Draw your signature in the box</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Canvas wrapper */}
            <div className="px-5 pb-2">
              <div
                className="relative w-full rounded-2xl overflow-hidden"
                style={{ border: "2px solid #e5e7eb", background: "#fff" }}
              >
                {/* Guide line */}
                <div
                  className="absolute left-6 right-6 pointer-events-none"
                  style={{ bottom: 26, borderBottom: "1.5px dashed #d1d5db" }}
                />
                <span
                  className="absolute text-gray-300 text-xs pointer-events-none select-none"
                  style={{ bottom: 8, left: 24 }}
                >
                  Sign above
                </span>

                {/* Empty hint overlay */}
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pb-8 pointer-events-none">
                    <span className="text-gray-200 text-base font-medium select-none">
                      ✍️  Draw here
                    </span>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  style={{
                    display: "block",
                    touchAction: "none",
                    cursor: "crosshair",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                  onMouseDown={onStart}
                  onMouseMove={onMove}
                  onMouseUp={onEnd}
                  onMouseLeave={onEnd}
                  onTouchStart={onStart}
                  onTouchMove={onMove}
                  onTouchEnd={onEnd}
                  onTouchCancel={onEnd}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 px-5 pt-1 pb-5">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-gray-600 font-semibold text-sm active:scale-95 transition-all hover:bg-gray-50"
              >
                🗑️  Clear
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!hasDrawn}
                className={`py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                  hasDrawn
                    ? "bg-gray-900 text-white hover:bg-black shadow-md"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                style={{ flex: 2 }}
              >
                ✓  Confirm Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
