const API = "https://xbut-eryu-hhsg.f2.xano.io/api:-v4TBDCl";

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

// --- UI nodes ---
const statusNode = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const applyBtn = document.getElementById("applyBtn");
const resetBtn = document.getElementById("resetBtn");

const stepNowNode = document.getElementById("stepNow");
const stepTotalNode = document.getElementById("stepTotal");
const stepNameNode = document.getElementById("stepName");

const gdprConsent = document.getElementById("gdprConsent");
const gdprBlock = document.getElementById("gdprBlock");

// --- helpers: read optional user_turbo_id from URL ---
function getQueryInt(name) {
  const v = new URLSearchParams(window.location.search).get(name);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- State: per enum ---
const state = {
  pola_front: null,
  pola_side: null,
  pola_full: null,
  video_no_makeup: null,
};

const uploadsConfig = [
  {
    key: "pola_front",
    inputId: "polaFrontFile",
    dropzoneId: "polaFrontDropzone",
    previewId: "polaFrontPreview",
    typeLabel: "Polaroid — Front",
    maxSize: MAX_IMAGE_SIZE,
    kind: "image",
  },
  {
    key: "pola_side",
    inputId: "polaSideFile",
    dropzoneId: "polaSideDropzone",
    previewId: "polaSidePreview",
    typeLabel: "Polaroid — Side",
    maxSize: MAX_IMAGE_SIZE,
    kind: "image",
  },
  {
    key: "pola_full",
    inputId: "polaFullFile",
    dropzoneId: "polaFullDropzone",
    previewId: "polaFullPreview",
    typeLabel: "Polaroid — Full body",
    maxSize: MAX_IMAGE_SIZE,
    kind: "image",
  },
  {
    key: "video_no_makeup",
    inputId: "videoNoMakeupFile",
    dropzoneId: "videoNoMakeupDropzone",
    previewId: "videoNoMakeupPreview",
    typeLabel: "Video — No makeup",
    maxSize: MAX_VIDEO_SIZE,
    kind: "video",
  },
];

// setup all dropzones
uploadsConfig.forEach(setupDropzone);

// events
applyBtn.addEventListener("click", submitApplication);
resetBtn?.addEventListener("click", resetForm);

// GDPR UX: click on whole block toggles checkbox already by label;
// here we just remove error state when checked
gdprConsent?.addEventListener("change", () => {
  gdprBlock?.classList.remove("invalid");
});

function setupDropzone({ inputId, dropzoneId, previewId, key, typeLabel, maxSize }) {
  const input = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);
  const preview = document.getElementById(previewId);

  if (!input || !dropzone || !preview) return;

  input.addEventListener("change", () => {
    if (!input.files?.[0]) return;
    handleSelectedFile(input.files[0], { key, preview, typeLabel, maxSize, input });
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files || [];
    if (!file) return;
    handleSelectedFile(file, { key, preview, typeLabel, maxSize, input });
  });
}

function handleSelectedFile(file, { key, preview, typeLabel, maxSize, input }) {
  if (file.size > maxSize) {
    showStatus(`${typeLabel} exceeds size limit (${formatSize(maxSize)}).`, true);
    input.value = "";
    return;
  }

  // Never block HEIC/MOV, but warn user (soft)
  const warn = detectSoftFormatWarning(file);
  if (warn) {
    showStatus(warn);
  } else {
    showStatus(`${typeLabel} ready.`);
  }

  state[key] = file;
  renderPreview(file, preview, typeLabel);
}

function detectSoftFormatWarning(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase
