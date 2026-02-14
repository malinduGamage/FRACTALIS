/* ================================================================
   Julia Set Explorer — App Controller (Rust WASM)
   ================================================================ */

import init, { render } from "./rust-fractal/pkg/julia_fractal.js";

// ---- Default State ----
const STATE = {
  cRe: -0.7,
  cIm: 0.27015,
  zoom: 1.0,
  xOff: 0.0,
  yOff: 0.0,
  rotation: 0.0,
  fractalType: 0, // 0=Standard, 1=Ship, 2=Tricorn, 3=Celtic, 4=Cosine

  // Appearance
  colors: ["#000000", "#000088", "#0000FF", "#0088FF", "#FFFFFF"], // 5 stops
  bgColor: "#000000",
  transparent: false,
  fade: 0,

  // Export State (managed by DOM inputs, but cached here for preview ratio)
  exportW: 3840,
  exportH: 2160,
};

// ---- DOM Refs ----
const $ = (id) => document.getElementById(id);
const canvas = $("fractal-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

let wasmLoaded = false;
let renderQueued = false;
let isRendering = false;

// ---- Initialization ----
async function boot() {
  try {
    await init(); // Initialize WASM
    wasmLoaded = true;

    // Hide loader
    const loader = $("loader");
    loader.classList.add("hidden");
    setTimeout(() => (loader.style.display = "none"), 600);

    // Show app
    $("app").style.opacity = "1";

    // Setup UI
    buildGradientEditor();
    bindEvents();
    updatePreviewLayout(); // Set initial canvas size based on default export dims
    triggerRender();
  } catch (e) {
    console.error("WASM Init Failed:", e);
    document.querySelector("#loader h2").textContent = "Error Loading Engine";
    document.querySelector("#loader p").textContent =
      "Check console for details.";
  }
}

// ---- Layout & Resizing ----
// ---- Layout & Resizing ----
function updatePreviewLayout() {
  const container = $("canvas-container");
  const viewport = container.parentElement;

  const isMobile = window.innerWidth < 800;

  // Frame padding:
  // Desktop: 20px*2 (frame) + 40px*2 (padding) + 20px (safety) = 140
  // Mobile:  10px*2 (frame) + 10px*2 (padding) + 10px (safety) = 50
  const paddingX = isMobile ? 50 : 140;
  const paddingY = isMobile ? 50 : 140;

  // Desktop: 60% of viewport. Mobile: 95% of available space.
  const factor = isMobile ? 0.95 : 0.6;

  const maxW = (viewport.clientWidth - paddingX) * factor;
  const maxH = (viewport.clientHeight - paddingY) * factor;

  // Get target aspect ratio from Export inputs
  const targetW = parseInt($("export-w").value) || 3840;
  const targetH = parseInt($("export-h").value) || 2160;
  const aspect = targetW / targetH;

  // Calculate fitting dimensions for the CANVAS (content inside frame)
  let w, h;
  if (maxW / maxH > aspect) {
    // Limited by height
    h = maxH;
    w = h * aspect;
  } else {
    // Limited by width
    w = maxW;
    h = w / aspect;
  }

  // Set Canvas Style Dimensions (Container wraps this)
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  // Clear container explicit size so it wraps content
  container.style.width = "";
  container.style.height = "";

  // Update Canvas internal resolution
  // Cap at 800px longest edge (User requested "higher resolution"  // Cap at 1000px longest edge (User requested decreased resolution)
  const MAX_PREVIEW = 1000;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let renderW = Math.floor(w * dpr);
  let renderH = Math.floor(h * dpr);

  if (Math.max(renderW, renderH) > MAX_PREVIEW) {
    const scale = MAX_PREVIEW / Math.max(renderW, renderH);
    renderW = Math.floor(renderW * scale);
    renderH = Math.floor(renderH * scale);
  }

  canvas.width = renderW;
  canvas.height = renderH;

  STATE.exportW = targetW;
  STATE.exportH = targetH;

  triggerRender();
}

// ---- Rendering Core ----
function triggerRender() {
  if (!wasmLoaded) return;
  if (renderQueued) return;

  renderQueued = true;
  requestAnimationFrame(doRender);
}

function doRender() {
  renderQueued = false;
  if (isRendering) {
    renderQueued = true; // Retry next frame
    return;
  }
  isRendering = true;

  const t0 = performance.now();

  try {
    // Prepare colors (flatten to Uint8Array: [R, G, B, R, G, B...])
    const flatColors = new Uint8Array(15);
    STATE.colors.forEach((hex, i) => {
      const { r, g, b } = hexToRgb(hex);
      flatColors[i * 3] = r;
      flatColors[i * 3 + 1] = g;
      flatColors[i * 3 + 2] = b;
    });

    const bg = hexToRgb(STATE.bgColor);

    // Call WASM
    // ensure canvas dimensions match
    const w = canvas.width;
    const h = canvas.height;

    // Use a fixed max_iter for preview to keep it fast, or dynamic?
    // Let's use 100-300 range based on zoom? No, stick to fixed or user control?
    // Missing max_iter slider in UI? Ah, I missed adding it to HTML.
    // Let's default to 100 for now or add it later if critical.
    const maxIter = 120;

    const outputPtr = render(
      w,
      h,
      STATE.cRe,
      STATE.cIm,
      STATE.zoom,
      STATE.xOff,
      STATE.yOff,
      STATE.rotation,
      maxIter,
      STATE.fractalType,
      flatColors,
      bg.r,
      bg.g,
      bg.b,
      STATE.fade,
      1.0, // Gamma
      STATE.transparent,
    );

    // Output is a Uint8Array (Clamped? No, Vec<u8> from Rust)
    // wasm-bindgen returns a view into WASM memory. We need to copy it to Canvas.
    const data = new Uint8ClampedArray(outputPtr);
    const imageData = new ImageData(data, w, h);
    ctx.putImageData(imageData, 0, 0);

    // Update stats
    const dt = (performance.now() - t0).toFixed(0);
    $("render-stats").textContent = `${w}×${h} • ${dt}ms`;
  } catch (e) {
    console.error("Render Error:", e);
  } finally {
    isRendering = false;
  }
}

// ---- Event Binding ----
function bindEvents() {
  // Theme Toggle
  const themeBtn = $("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      const next = current === "light" ? "midnight" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("julia-theme", next);
    });
  }

  // Inputs
  bindSlider("c-re", (v) => (STATE.cRe = v), 3);
  bindSlider("c-im", (v) => (STATE.cIm = v), 3);
  bindSlider("zoom", (v) => (STATE.zoom = v), 2);
  bindSlider("rotation", (v) => (STATE.rotation = v), 0, "°");
  bindSlider("x-off", (v) => (STATE.xOff = v), 3);
  bindSlider("y-off", (v) => (STATE.yOff = v), 3);
  bindSlider("fade", (v) => (STATE.fade = v), 0);

  // Presets
  document.querySelectorAll("#presets .btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("export-w").value = btn.dataset.w;
      $("export-h").value = btn.dataset.h;
      // Trigger update logic
      const event = new Event("change");
      $("export-w").dispatchEvent(event);
    });
  });

  // Select
  $("fractal-type").addEventListener("change", (e) => {
    STATE.fractalType = parseInt(e.target.value);
    triggerRender();
  });

  // Boolean / Color
  $("transparent").addEventListener("change", (e) => {
    STATE.transparent = e.target.checked;
    triggerRender();
  });

  $("bg-color").addEventListener("input", (e) => {
    STATE.bgColor = e.target.value;
    triggerRender();
  });

  // Dimensions
  const updateDims = () => {
    STATE.exportW = parseInt($("export-w").value) || 3840;
    STATE.exportH = parseInt($("export-h").value) || 2160;
    updatePreviewLayout(); // This triggers render
  };
  $("export-w").addEventListener("change", updateDims);
  $("export-h").addEventListener("change", updateDims);
  $("export-w").addEventListener("input", updateDims); // Live update? Might be jumpy

  // Resize Window
  window.addEventListener("resize", updatePreviewLayout);

  // Actions
  $("btn-reset").addEventListener("click", resetState);
  $("btn-chaos").addEventListener("click", randomizeState);
  $("btn-rnd-colors").addEventListener("click", randomizeColors);
  $("btn-export").addEventListener("click", exportImage);
}

function bindSlider(id, setter, decimals = 2, suffix = "") {
  const el = $(id);
  const display = $(`val-${id}`);

  const update = () => {
    const val = parseFloat(el.value);
    setter(val);
    if (display) display.textContent = val.toFixed(decimals) + suffix;
    triggerRender();
  };

  el.addEventListener("input", update);
}

// ---- Theme Logic ----
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("julia-theme", theme);
}

// ---- Gradient Editor ----
function buildGradientEditor() {
  const container = $("gradient-editor");
  container.innerHTML = "";

  STATE.colors.forEach((color, idx) => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = color;
    input.title = `Color stop ${idx + 1}`;

    input.addEventListener("input", (e) => {
      STATE.colors[idx] = e.target.value;
      triggerRender();
    });

    container.appendChild(input);
  });
}

// ---- Load/Reset/Random ----
function resetState() {
  STATE.cRe = -0.7;
  $("c-re").value = -0.7;
  STATE.cIm = 0.27;
  $("c-im").value = 0.27;
  STATE.zoom = 1.0;
  $("zoom").value = 1.0;
  STATE.rotation = 0;
  $("rotation").value = 0;
  STATE.fade = 0;
  $("fade").value = 0;
  STATE.fractalType = 0;
  $("fractal-type").value = 0;
  STATE.transparent = false;
  $("transparent").checked = false;
  STATE.colors = ["#000000", "#000088", "#0000FF", "#0088FF", "#FFFFFF"];
  buildGradientEditor();

  // Update displays
  ["c-re", "c-im", "zoom", "rotation", "fade"].forEach((id) => {
    const d = $(`val-${id}`);
    if (d) d.textContent = parseFloat($(id).value).toFixed(2); // approximate
  });

  triggerRender();
}

function randomizeState() {
  STATE.cRe = Math.random() * 3 - 2;
  STATE.cIm = Math.random() * 2 - 1;
  STATE.zoom = Math.random() * 2 + 0.5;
  STATE.rotation = Math.random() * 360;
  STATE.fractalType = Math.floor(Math.random() * 5);

  // Update UI
  $("c-re").value = STATE.cRe;
  $("c-im").value = STATE.cIm;
  $("zoom").value = STATE.zoom;
  $("rotation").value = STATE.rotation;
  $("fractal-type").value = STATE.fractalType;

  randomizeColors(); // Triggers render
}

function randomizeColors() {
  for (let i = 0; i < 5; i++) {
    // Keep first color dark usually?
    if (i === 0 && Math.random() > 0.3) STATE.colors[i] = "#000000";
    else STATE.colors[i] = randHex();
  }
  STATE.bgColor = randHex();
  $("bg-color").value = STATE.bgColor;

  buildGradientEditor();
  triggerRender();
}

// ---- Helpers ----
function randHex() {
  return (
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")
  );
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// ---- Export ----
async function exportImage() {
  const btn = $("btn-export");
  const status = $("export-status");
  const w = parseInt($("export-w").value) || 3840;
  const h = parseInt($("export-h").value) || 2160;

  btn.disabled = true;
  btn.textContent = "Rendering High-Res...";
  status.textContent = "Generating...";

  // Wait for UI update
  await new Promise((r) => setTimeout(r, 50));

  try {
    // Build colors
    const flatColors = new Uint8Array(15);
    STATE.colors.forEach((hex, i) => {
      const { r, g, b } = hexToRgb(hex);
      flatColors[i * 3] = r;
      flatColors[i * 3 + 1] = g;
      flatColors[i * 3 + 2] = b;
    });
    const bg = hexToRgb(STATE.bgColor);

    // Render full res synchronously (WASM is fast enough or will block UI briefly)
    // 4K render might take 1-2s in WASM
    const t0 = performance.now();
    const maxIter = 300; // Higher quality for export

    const outputPtr = render(
      w,
      h,
      STATE.cRe,
      STATE.cIm,
      STATE.zoom,
      STATE.xOff,
      STATE.yOff,
      STATE.rotation,
      maxIter,
      STATE.fractalType,
      flatColors,
      bg.r,
      bg.g,
      bg.b,
      STATE.fade,
      1.0,
      STATE.transparent,
    );

    const data = new Uint8ClampedArray(outputPtr);

    // Put on Offscreen Canvas
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctxOff = off.getContext("2d");
    const imgData = new ImageData(data, w, h);
    ctxOff.putImageData(imgData, 0, 0);

    // Convert to Blob
    const format = $("export-format").value || "image/png";
    off.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = format.split("/")[1];
        a.download = `julia_rust_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);

        const dt = (performance.now() - t0).toFixed(0);
        status.textContent = `Done in ${dt}ms`;
        btn.disabled = false;
        btn.textContent = "Download High-Res";
      },
      format,
      0.9,
    );
  } catch (e) {
    console.error(e);
    status.textContent = "Error";
    btn.disabled = false;
  }
}

// Start
boot();
