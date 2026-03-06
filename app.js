const API = "https://xbut-eryu-hhsg.f2.xano.io/api:-v4TBDCl";

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

// --- UI nodes ---
const statusNode = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText") || document.getElementById("progressLabel");
const applyBtn =
  document.getElementById("applyBtn") ||
  document.getElementById("submitBtn") ||
  document.querySelector("button[type='button']");
const resetBtn = document.getElementById("resetBtn");
const submitAnotherBtn = document.getElementById("submitAnother");

const stepNowNode = document.getElementById("stepNow");
const stepTotalNode = document.getElementById("stepTotal");
const stepNameNode = document.getElementById("stepName");

const gdprConsent = document.getElementById("gdprConsent");
const gdprBlock = document.getElementById("gdprBlock");
const consentModal = document.getElementById("consentModal");
const consentModalClose = document.getElementById("consentModalClose");
const consentModalAction = document.getElementById("consentModalAction");

const fileLimitModal = document.getElementById("fileLimitModal");
const fileLimitModalTitle = document.getElementById("fileLimitModalTitle");
const fileLimitModalBody = document.getElementById("fileLimitModalBody");
const fileLimitModalClose = document.getElementById("fileLimitModalClose");
const fileLimitModalAction = document.getElementById("fileLimitModalAction");

// PATCH: startup safety diagnostics for critical nodes
console.log("Casting form initialized");
console.log("[sanity] applyBtn:", !!applyBtn);
console.log("[sanity] progressBar:", !!progressBar);
console.log("[sanity] progressText/progressLabel:", !!progressText);
console.log("[sanity] gdprConsent:", !!gdprConsent);
console.log("[sanity] required photo inputs:", {
  polaFrontFile: !!document.getElementById("polaFrontFile"),
  polaSideFile: !!document.getElementById("polaSideFile"),
  polaFullFile: !!document.getElementById("polaFullFile"),
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
};

// PATCH: track upload status/progress by file key
const uploadProgressState = {};

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
submitAnotherBtn?.addEventListener("click", () => {
  location.reload();
});

// GDPR UX: click on whole block toggles checkbox already by label;
// here we just remove error state when checked
gdprConsent?.addEventListener("change", () => {
  gdprBlock?.classList.remove("invalid");
});

// PATCH: modal handlers for missing GDPR consent
consentModalClose?.addEventListener("click", closeConsentModal);
consentModalAction?.addEventListener("click", closeConsentModal);
consentModal?.addEventListener("click", (event) => {
  if (event.target === consentModal) closeConsentModal();
});
fileLimitModalClose?.addEventListener("click", closeFileLimitModal);
fileLimitModalAction?.addEventListener("click", closeFileLimitModal);
fileLimitModal?.addEventListener("click", (event) => {
  if (event.target === fileLimitModal) closeFileLimitModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeConsentModal();
    closeFileLimitModal();
  }
});

["firstName", "lastName", "email"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => updateIdleProgress());
});
gdprConsent?.addEventListener("change", () => updateIdleProgress());

function setupDropzone({ inputId, dropzoneId, previewId, key, typeLabel, maxSize, kind }) {
  const input = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);
  const preview = document.getElementById(previewId);

  if (!input || !dropzone || !preview) return;

  input.addEventListener("change", () => {
    if (!input.files?.[0]) return;
    handleSelectedFile(input.files[0], { key, preview, typeLabel, maxSize, input, kind });
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
    handleSelectedFile(file, { key, preview, typeLabel, maxSize, input, kind });
  });
}

function handleSelectedFile(file, { key, preview, typeLabel, maxSize, input, kind }) {
  if (file.size > maxSize) {
    input.value = "";
    openFileLimitModal(kind === "video" ? "Video too large" : "Image too large", `Please upload a ${kind || "file"} under ${formatSize(maxSize)}.`);
    showStatus(`${typeLabel} exceeds size limit (${formatSize(maxSize)}).`, true);
    return;
  }

  const warnings = [];

  const formatWarn = detectSoftFormatWarning(file);
  if (formatWarn) warnings.push(formatWarn);

  if (warnings.length) {
    showStatus(warnings.join(" "));
  } else {
    showStatus(`${typeLabel} ready.`);
  }

  state[key] = file;
  uploadProgressState[key] = 0;
  renderPreview(file, preview, typeLabel, key, input);
  updateIdleProgress();
}

function detectSoftFormatWarning(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif") || type.includes("heic") || type.includes("heif")) {
    return "HEIC detected. If upload fails, export as JPG and retry.";
  }
  return "";
}

function renderPreview(file, preview, typeLabel, key, input) {
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

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "file-remove";
  removeBtn.setAttribute("aria-label", `Remove ${typeLabel}`);
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    removeSelectedFile(key, input, preview);
  });

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
        textContent: "Preview not available — file ready to upload.",
      })
    );
  });

  card.append(media, removeBtn, meta);
  preview.appendChild(card);
}



// PATCH: unified file removal behavior
function removeSelectedFile(key, input, preview) {
  state[key] = null;
  uploadProgressState[key] = 0;
  if (input) input.value = "";
  if (preview) preview.innerHTML = "";
  showStatus("File removed.");
  updateIdleProgress();
}

function getIdleProgressPercent() {
  const requiredText = ["firstName", "lastName", "email"];
  const filledText = requiredText.filter((id) => document.getElementById(id)?.value?.trim()).length;
  const fileCount = uploadsConfig.length;
  const selectedFiles = uploadsConfig.filter(({ key }) => !!state[key]).length;
  const gdprWeight = 1;
  const totalWeight = requiredText.length + fileCount + gdprWeight;
  const completeWeight = filledText + selectedFiles + (gdprConsent?.checked ? gdprWeight : 0);
  return totalWeight ? (completeWeight / totalWeight) * 100 : 0;
}

function updateIdleProgress() {
  if (applyBtn?.disabled) return;
  setProgress(getIdleProgressPercent());
}

function openFileLimitModal(title, body) {
  if (!fileLimitModal) return;
  if (fileLimitModalTitle) fileLimitModalTitle.textContent = title || "File too large";
  if (fileLimitModalBody) fileLimitModalBody.textContent = body || "Please choose a smaller file and try again.";
  fileLimitModal.classList.remove("hidden");
  fileLimitModal.setAttribute("aria-hidden", "false");
}

function closeFileLimitModal() {
  if (!fileLimitModal) return;
  fileLimitModal.classList.add("hidden");
  fileLimitModal.setAttribute("aria-hidden", "true");
}

function openConsentModal() {
  if (!consentModal) return;
  consentModal.classList.remove("hidden");
  consentModal.setAttribute("aria-hidden", "false");
}

function closeConsentModal() {
  if (!consentModal) return;
  consentModal.classList.add("hidden");
  consentModal.setAttribute("aria-hidden", "true");
}

function getUploadProgressPercent(createProgress = 100) {
  const active = uploadsConfig.filter(({ key }) => !!state[key]);
  const uploadPart = active.length
    ? active.reduce((sum, { key }) => sum + (uploadProgressState[key] || 0), 0) / active.length
    : 0;
  return createProgress * 0.25 + uploadPart * 0.75;
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
};

function isEnumInputError(message) {
  const text = String(message || "");
  return /ERROR_CODE_INPUT_ERROR/i.test(text) || /not one of the allowable values/i.test(text);
}

function buildFormatRetryHint(messageText) {
  // PATCH: keep HEIC retry guidance visible even when server error payload is generic
  const text = String(messageText || "").toLowerCase();
  const selectedFiles = Object.values(state).filter(Boolean);
  const hasHeic = /heic|heif/.test(text) || selectedFiles.some((f) => /\.(heic|heif)$/i.test(f.name || ""));
  const hints = [];

  if (hasHeic) hints.push("Try exporting the image as JPG and upload again.");

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

  const firstName = document.getElementById("firstName")?.value?.trim() || "";
  const lastName = document.getElementById("lastName")?.value?.trim() || "";
  const email = document.getElementById("email")?.value?.trim() || "";

  if (!firstName || !lastName || !email) {
    showStatus("Please fill in first name, last name, and email.", true);
    return;
  }

  if (gdprConsent && !gdprConsent.checked) {
    gdprBlock?.classList.add("invalid");
    openConsentModal();
    showStatus("Please accept GDPR consent before submitting.", true);
    return;
  }

  const missing = getMissingRequiredConfigs();
  if (missing.length > 0) {
    showStatus(`Please add required files: ${missing.map((m) => m.typeLabel).join(", ")}.`, true);
    return;
  }

  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Submitting...";
  }
  setProgress(5);

  try {
    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
    };

    const userTurboId = getQueryInt("user_turbo_id");
    if (userTurboId) payload.user_turbo_id = userTurboId;

    const applyResponse = await fetch(`${API}/Apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const applyData = await safeJson(applyResponse);
    if (!applyResponse.ok) {
      console.error("[apply_error_response]", applyData);
      throw new Error(applyData?.message || `Failed to create application (${applyResponse.status}).`);
    }

    const applicationId = applyData?.id ?? applyData?.applications_id ?? applyData?.application_id ?? applyData?.data?.id ?? null;

    if (!applicationId) {
      console.error("[apply_unexpected_response_shape]", applyData);
      showStatus("Application created, but no application ID was returned. Please retry or contact support.", true);
      return;
    }

    const filesToUpload = uploadsConfig.filter(({ key }) => state[key]).map((cfg) => ({ ...cfg, file: state[cfg.key] }));
    setProgress(getUploadProgressPercent(100));
    showStatus("Application created. Uploading files...");

    const uploads = filesToUpload.map((item) =>
      uploadApplicationFile(applicationId, item.key, item.file, (progress) => {
        uploadProgressState[item.key] = progress;
        setProgress(getUploadProgressPercent(100));
      })
    );

    await Promise.all(uploads);

    setProgress(100);
    showSuccessScreen();
  } catch (error) {
    const msg = String(error?.message || error || "Unknown upload error");
    // PATCH: keep detailed diagnostics in console while showing friendly UI copy
    console.error("[upload_error]", error);
    const hint = buildFormatRetryHint(msg);
    showStatus(`Upload failed. Please retry.${hint}`, true);
  } finally {
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.textContent = "Submit application";
    }
  }
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("[safe_json_parse_failed]", { status: res.status, body: text, error });
    return null;
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

async function uploadApplicationFile(applicationId, fileType, file, onProgress) {
  try {
    await uploadFileWithProgressWithFallback(applicationId, file, fileType, onProgress);
  } catch (error) {
    const message = String(error?.message || "");
    let maybeErr = null;
    try {
      maybeErr = JSON.parse(message);
    } catch {
      maybeErr = null;
    }

    if (maybeErr?.message) {
      throw new Error(maybeErr.message);
    }
    throw error;
  }
}


function showSuccessScreen() {
  const form = document.querySelector(".casting-form");
  const success = document.getElementById("successScreen");

  if (!form || !success) return;

  Array.from(form.children).forEach((el) => {
    if (el.id !== "successScreen") el.style.display = "none";
  });

  success.classList.remove("hidden");
}

function resetFormUI() {
  resetForm();
  showStatus("");
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
    uploadProgressState[key] = 0;
  });

  uploadsConfig.forEach(({ inputId, previewId }) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (input) input.value = "";
    if (preview) preview.innerHTML = "";
  });

  if (gdprConsent) gdprConsent.checked = false;
  gdprBlock?.classList.remove("invalid");
  setProgress(0);
  showStatus("Form reset.");
  closeConsentModal();
  closeFileLimitModal();
}

updateIdleProgress();
