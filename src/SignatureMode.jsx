import React, { useRef, useState, useEffect } from "react";

function getSHA256(str) {
  if (window.crypto && window.crypto.subtle) {
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(buf =>
      Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
    );
  }
  return Promise.resolve("");
}

export function SignatureMode({ value, onChange, readOnly, onModeChange }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [thumbnail, setThumbnail] = useState(value || "");
  const [audit, setAudit] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [active, setActive] = useState(false); // Controls visibility of signature area
  // Responsive canvas size
  const [canvasDims, setCanvasDims] = useState({ width: 400, height: 120 });

  // Lock scroll/touch when in signature mode
// Do NOT lock scroll/touch when in signature mode
useEffect(() => {
  if (onModeChange) onModeChange(showCanvas);
  return () => {
    if (onModeChange) onModeChange(false);
  };
}, [showCanvas, onModeChange]);

  // Draw points to canvas
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2.2;
    let last = null;
    for (const p of points) {
      if (p.type === "begin") {
        last = p;
        continue;
      }
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      last = p;
    }
  }, [points, showCanvas, canvasDims]);

  // Pointer event handlers
  function handlePointerDown(e) {
    if (!showCanvas) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    // Scale pointer coordinates to canvas size
    const x = ((e.clientX - rect.left) * canvasRef.current.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvasRef.current.height) / rect.height;
    setPoints(ps => [...ps, { x, y, type: "begin" }]);
    setDrawing(true);
    e.target.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e) {
    if (!showCanvas || !drawing) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvasRef.current.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvasRef.current.height) / rect.height;
    setPoints(ps => [...ps, { x, y, type: "draw" }]);
  }
  function handlePointerUp(e) {
    if (!showCanvas) return;
    setDrawing(false);
    e.target.releasePointerCapture(e.pointerId);
    setUndoStack(stack => [...stack, points]);
  }

  function handleUndo() {
    if (undoStack.length > 0) {
      setPoints(undoStack[undoStack.length - 1] || []);
      setUndoStack(stack => stack.slice(0, -1));
    }
  }
  function handleClear() {
    setPoints([]);
    setUndoStack([]);
    setThumbnail("");
    setAudit(null);
    if (typeof setAck === "function") setAck(false); // If ack state exists
    setShowCanvas(false);
    setActive(false);
    onChange?.("", null);
  }
  function handleDone() {
    const cv = canvasRef.current;
    const dataUrl = cv ? cv.toDataURL("image/png") : "";
    setThumbnail(dataUrl);
    setShowCanvas(false);
    // Audit trail
    const meta = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      width: cv ? cv.width : canvasDims.width,
      height: cv ? cv.height : canvasDims.height
    };
    getSHA256(dataUrl + JSON.stringify(meta)).then(hash => {
      setAudit({ hash, ...meta });
      onChange?.(dataUrl, { hash, ...meta });
    });
  }
  function handleEdit() {
    setShowCanvas(true);
    setActive(true);
  }

  // Canvas size and padding
  useEffect(() => {
    // Responsive canvas sizing
    function updateDims() {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        // Maintain aspect ratio 10:3. Use min height 60px, max 180px
        const h = Math.max(60, Math.min(180, Math.round(w * 0.3)));
        setCanvasDims({ width: w, height: h });
      }
    }
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, [showCanvas]);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = canvasDims.width;
    cv.height = canvasDims.height;
    cv.style.background = "#fff";
    cv.style.touchAction = "none";
    cv.style.width = "100%";
    cv.style.height = "auto";
    cv.style.maxWidth = "100%";
    cv.style.display = "block";
    cv.style.padding = "0";
  }, [canvasDims, showCanvas]);

  return (
    <div className="space-y-2" ref={containerRef} style={{ width: "100%", maxWidth: "100%" }}>
      {!active && (
        <button
          type="button"
          className="rounded-full border border-gray-200 px-4 py-3 bg-blue-600 text-white w-full shadow-sm flex items-center justify-center gap-2 text-lg"
          onClick={handleEdit}
        >
          <span className="text-xl">➕</span> <span>Add Signature</span>
        </button>
      )}
      {active && showCanvas && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto border border-gray-200 shadow-sm flex flex-col items-center">
            <div className="mb-4 text-lg font-semibold text-gray-700">Draw your signature below:</div>
            <canvas
              ref={canvasRef}
              className="border border-gray-200 rounded-xl shadow-sm bg-white"
              style={{ width: "100%", maxWidth: "100%", height: canvasDims.height, display: "block", background: "#fff", touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <div className="flex gap-4 mt-6 w-full justify-center">
              <button
                type="button"
                className="px-4 py-3 rounded-full bg-gray-100 text-gray-700 flex items-center gap-2 text-base border border-gray-200"
                onClick={handleClear}
              >
                🗑️ <span>Clear</span>
              </button>
              <button
                type="button"
                className="px-4 py-3 rounded-full bg-blue-600 text-white flex items-center gap-2 text-base shadow-sm"
                onClick={handleDone}
              >
                ✅ <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {active && !showCanvas && thumbnail && (
        <div className="flex flex-col items-center w-full">
          <img src={thumbnail} alt="Signature" className="border border-gray-200 rounded-xl shadow-sm mb-2" style={{ width: "100%", maxWidth: 400, height: "auto", objectFit: "contain" }} />
          <button
            type="button"
            className="px-4 py-3 rounded-full bg-gray-100 text-gray-700 flex items-center gap-2 text-base border border-gray-200 mt-2"
            onClick={handleClear}
          >
            🗑️ <span>Clear</span>
          </button>
        </div>
      )}
    </div>
  );
}
