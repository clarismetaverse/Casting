const API = "https://xbut-eryu-hhsg.f2.xano.io/api:-v4TBDCl";

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

// --- UI nodes ---
const statusNode = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText") || document.getElementById("progressLabel");
const applyBtn =
  document.getElementById("applyBtn") ||
  document.getElementById("submitBtn") ||
  document.querySelector("button[type='button']");
const resetBtn = document.getElementById("resetBtn");

const stepNowNode = document.getElementById("stepNow");
const stepTotalNode = document.getElementById("stepTotal");
const stepNameNode = document.getElementById("stepName");

const gdprConsent = document.getElementById("gdprConsent");
const gdprBlock = document.getElementById("gdprBlock");

// PATCH: startup safety diagnostics for critical nodes
console.log("Casting form initialized");
console.log("[sanity] applyBtn:", !!applyBtn);
console.log("[sanity] progressBar:", !!progressBar);
console.log("[sanity] progressText/progressLabel:", !!progressText);
console.log("[sanity] gdprConsent:", !!gdprConsent);
console.log("[sanity] 4-upload inputs:", {
  polaFrontFile: !!document.getElementById("polaFrontFile"),
  polaSideFile: !!document.getElementById("polaSideFile"),
  polaFullFile: !!document.getElementById("polaFullFile"),
  videoNoMakeupFile: !!document.getElementById("videoNoMakeupFile"),
});

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

const uploadsConfigNew = [
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

const uploadsConfigOld = [
  {
    key: "pola_front",
    inputId: "polaFile",
    dropzoneId: "polaDropzone",
    previewId: "polaPreview",
    typeLabel: "Polaroid",
    maxSize: MAX_IMAGE_SIZE,
    kind: "image",
  },
  {
    key: "video_no_makeup",
    inputId: "videoFile",
    dropzoneId: "videoDropzone",
    previewId: "videoPreview",
    typeLabel: "Video",
    maxSize: MAX_VIDEO_SIZE,
    kind: "video",
  },
];

const hasNewUploadMarkup = uploadsConfigNew.some(({ inputId }) => document.getElementById(inputId));
const uploadsConfig = hasNewUploadMarkup ? uploadsConfigNew : uploadsConfigOld;

// setup all dropzones
uploadsConfig.forEach(setupDropzone);

// events
if (applyBtn) {
  applyBtn.addEventListener("click", submitApplication);
} else {
  showStatus("Submit button not found. Please refresh or contact support.", true);
}
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
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif") || type.includes("heic") || type.includes("heif")) {
    return "HEIC/HEIF selected. Upload is allowed; preview may be unavailable in some browsers.";
  }
  if (name.endsWith(".mov") || type.includes("quicktime")) {
    return "MOV selected. Upload is allowed; preview may be unavailable in some browsers.";
  }
  return "";
}

function renderPreview(file, preview, typeLabel) {
  if (!preview) return;
  preview.innerHTML = "";

  const card = document.createElement("div");
  card.className = "file-card";

  const isVideo = file.type.startsWith("video/");
  const media = document.createElement(isVideo ? "video" : "img");
  if (isVideo) {
    media.controls = true;
    media.muted = true;
  }

  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.innerHTML = `<strong>${typeLabel}</strong><span>${file.name}</span><span>${formatSize(file.size)}</span>`;

  const objectURL = URL.createObjectURL(file);
  media.src = objectURL;
  media.addEventListener("load", () => URL.revokeObjectURL(objectURL), { once: true });
  media.addEventListener("loadeddata", () => URL.revokeObjectURL(objectURL), { once: true });
  media.addEventListener("error", () => {
    // PATCH: keep HEIC/MOV uploads valid even when local preview is not supported
    media.replaceWith(
      Object.assign(document.createElement("div"), {
        className: "preview-fallback",
        textContent: "Preview not available — file ready for upload.",
      })
    );
  });

  card.append(media, meta);
  preview.appendChild(card);
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function showStatus(message, isError = false) {
  if (!statusNode) return;
  statusNode.textContent = message;
  statusNode.classList.toggle("error", !!isError);
}

function setProgress(percent, label) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent || 0)));
  if (progressBar) {
    progressBar.style.width = `${normalized}%`;
    progressBar.parentElement?.setAttribute("aria-valuenow", String(normalized));
  }
  if (progressText) {
    progressText.textContent = label || `${normalized}%`;
  }
}

// PATCH: stable file type mapping + enum fallback mapping for Xano validation issues
const FILE_TYPE_FALLBACKS = {
  pola_front: "pola_full",
  pola_side: "pola_side",
  pola_full: "pola_full",
  video_no_makeup: "video",
};

// PATCH: lightweight upload labels per file
const FILE_UPLOAD_LABELS = {
  pola_front: "Uploading polaroid front...",
  pola_side: "Uploading polaroid side...",
  pola_full: "Uploading polaroid full...",
  video_no_makeup: "Uploading video...",
};

function isEnumInputError(message) {
  const text = String(message || "");
  return /ERROR_CODE_INPUT_ERROR/i.test(text) || /not one of the allowable values/i.test(text);
}

function buildFormatRetryHint(messageText) {
  // PATCH: keep HEIC/MOV retry guidance visible even when server error payload is generic
  const text = String(messageText || "").toLowerCase();
  const selectedFiles = Object.values(state).filter(Boolean);
  const hasHeic = /heic|heif/.test(text) || selectedFiles.some((f) => /\.(heic|heif)$/i.test(f.name || ""));
  const hasMov = /quicktime|\.mov|\bmov\b/.test(text) || selectedFiles.some((f) => /\.mov$/i.test(f.name || ""));
  const hints = [];

  if (hasHeic) hints.push("HEIC files can be exported as JPG and retried.");
  if (hasMov) hints.push("MOV files can be exported as MP4 and retried.");

  return hints.length ? ` ${hints.join(" ")}` : "";
}

function getMissingRequiredConfigs() {
  return uploadsConfig.filter(({ key }) => !state[key]);
}

async function submitApplication() {
  if (!statusNode || !progressBar || !progressText) {
    showStatus("Required UI nodes are missing (status/progress). Please check HTML IDs.", true);
    return;
  }

  if (gdprConsent && !gdprConsent.checked) {
    gdprBlock?.classList.add("invalid");
    showStatus("Please accept GDPR consent before submitting.", true);
    return;
  }

  const missing = getMissingRequiredConfigs();
  if (missing.length > 0) {
    showStatus(`Please add required files: ${missing.map((m) => m.typeLabel).join(", ")}.`, true);
    return;
  }

  if (applyBtn) applyBtn.disabled = true;
  setProgress(3, "Creating application...");

  try {
    const payload = {
      first_name: document.getElementById("firstName")?.value?.trim() || "",
      last_name: document.getElementById("lastName")?.value?.trim() || "",
      email: document.getElementById("email")?.value?.trim() || "",
    };

    const userTurboId = getQueryInt("user_turbo_id");
    if (userTurboId) payload.user_turbo_id = userTurboId;

    const applyResponse = await fetch(`${API}/Apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!applyResponse.ok) throw new Error(`Failed to create application (${applyResponse.status}).`);

    const applyData = await applyResponse.json();
    const applicationId = applyData?.id || applyData?.application_id;
    if (!applicationId) throw new Error("Application ID missing from API response.");

    const filesToUpload = uploadsConfig.filter(({ key }) => state[key]).map((cfg) => ({ ...cfg, file: state[cfg.key] }));
    let uploaded = 0;

    for (const item of filesToUpload) {
      // PATCH: explicit per-file upload state message for UX clarity
      showStatus(FILE_UPLOAD_LABELS[item.key] || `Uploading ${item.typeLabel}...`);
      await uploadFileWithProgressWithFallback(applicationId, item.file, item.key, (filePercent) => {
        const globalPercent = ((uploaded + filePercent / 100) / filesToUpload.length) * 100;
        setProgress(globalPercent, `Uploading ${item.typeLabel} (${Math.round(filePercent)}%)`);
      });
      uploaded += 1;
      setProgress((uploaded / filesToUpload.length) * 100, `${uploaded}/${filesToUpload.length} uploaded`);
    }

    setProgress(100, "Done");
    showStatus("Application submitted successfully.");
  } catch (error) {
    const msg = String(error?.message || error || "Unknown upload error");
    // PATCH: keep detailed diagnostics in console while showing friendly UI copy
    console.error("[upload_error]", error);
    const hint = buildFormatRetryHint(msg);
    showStatus(`Upload failed. Please retry.${hint}`, true);
  } finally {
    if (applyBtn) applyBtn.disabled = false;
  }
}

function uploadFileWithProgressWithFallback(applicationId, file, initialFileType, onProgress) {
  // PATCH: upload with backend enum fallback retry
  return uploadFileWithProgress(applicationId, file, initialFileType, onProgress).catch((error) => {
    const fallbackFileType = FILE_TYPE_FALLBACKS[initialFileType] || initialFileType;
    if (!isEnumInputError(error?.message) || fallbackFileType === initialFileType) {
      throw error;
    }
    console.warn(`[upload_retry] Enum rejected "${initialFileType}", retrying as "${fallbackFileType}".`);
    return uploadFileWithProgress(applicationId, file, fallbackFileType, onProgress);
  });
}

function uploadFileWithProgress(applicationId, file, fileType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/upload_application_file`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.((event.loaded / event.total) * 100);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(xhr.responseText || `Upload failed (${xhr.status}) for ${fileType}.`));
    };

    xhr.onerror = () => reject(new Error(`Network error while uploading ${fileType}.`));

    const form = new FormData();
    form.append("application_id", String(applicationId));
    form.append("file_type", fileType);
    form.append("file", file);
    xhr.send(form);
  });
}

function resetForm() {
  Object.keys(state).forEach((key) => {
    state[key] = null;
  });

  uploadsConfig.forEach(({ inputId, previewId }) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (input) input.value = "";
    if (preview) preview.innerHTML = "";
  });

  if (gdprConsent) gdprConsent.checked = false;
  gdprBlock?.classList.remove("invalid");
  setProgress(0, "0%");
  showStatus("Form reset.");
}
