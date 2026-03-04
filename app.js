const API = "https://xbut-eryu-hhsg.f2.xano.io/api:-v4TBDCl";
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

const state = {
  pola: null,
  video: null,
};

const statusNode = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const applyBtn = document.getElementById("applyBtn");

setupDropzone({
  inputId: "polaFile",
  dropzoneId: "polaDropzone",
  previewId: "polaPreview",
  stateKey: "pola",
  typeLabel: "Polaroid",
  maxSize: MAX_IMAGE_SIZE,
});

setupDropzone({
  inputId: "videoFile",
  dropzoneId: "videoDropzone",
  previewId: "videoPreview",
  stateKey: "video",
  typeLabel: "Video",
  maxSize: MAX_VIDEO_SIZE,
});

applyBtn.addEventListener("click", submitApplication);

function setupDropzone({ inputId, dropzoneId, previewId, stateKey, typeLabel, maxSize }) {
  const input = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);
  const preview = document.getElementById(previewId);

  input.addEventListener("change", () => {
    if (!input.files?.[0]) {
      return;
    }

    handleSelectedFile(input.files[0], { stateKey, preview, typeLabel, maxSize, input });
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
    const [file] = event.dataTransfer.files;
    if (!file) {
      return;
    }

    handleSelectedFile(file, { stateKey, preview, typeLabel, maxSize, input });
  });
}

function handleSelectedFile(file, { stateKey, preview, typeLabel, maxSize, input }) {
  if (file.size > maxSize) {
    const sizeLimit = formatSize(maxSize);
    showStatus(`${typeLabel} exceeds size limit (${sizeLimit}).`, true);
    input.value = "";
    return;
  }

  state[stateKey] = file;
  renderPreview(file, preview, typeLabel);
  showStatus(`${typeLabel} ready to upload.`);
}

function renderPreview(file, previewNode, typeLabel) {
  const objectUrl = URL.createObjectURL(file);
  const isImage = file.type.startsWith("image/");
  const mediaTag = isImage
    ? `<img src="${objectUrl}" alt="${typeLabel} preview" />`
    : `<video src="${objectUrl}" aria-label="${typeLabel} preview" controls muted></video>`;

  previewNode.innerHTML = `
    <div class="file-card">
      ${mediaTag}
      <div class="file-meta">
        <strong>${file.name}</strong>
        <span>${formatSize(file.size)}</span>
      </div>
    </div>
  `;
}

async function submitApplication() {
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!firstName || !lastName || !email) {
    showStatus("Please fill in first name, last name, and email.", true);
    return;
  }

  try {
    applyBtn.disabled = true;
    setProgress(5, "5%");
    showStatus("Creating application...");

    const res = await fetch(`${API}/Apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        casting_id: 3,
        user_turbo_id: 6684,
        status: "NEW",
        GDPR_consent: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Apply failed: ${res.status}`);
    }

    const app = await res.json();
    const applicationId = app.id;

    setProgress(30, "30%");
    showStatus("Application created, uploading files...");

    const uploads = [];
    if (state.pola) {
      uploads.push(uploadApplicationFile(applicationId, "pola", state.pola, 60));
    }
    if (state.video) {
      uploads.push(uploadApplicationFile(applicationId, "video", state.video, 90));
    }

    await Promise.all(uploads);

    setProgress(100, "100%");
    showStatus("Application submitted successfully.");
  } catch (error) {
    console.error(error);
    showStatus("Error while submitting application. Please retry.", true);
  } finally {
    applyBtn.disabled = false;
  }
}

async function uploadApplicationFile(applicationId, fileType, file, completionPercent) {
  const form = new FormData();
  form.append("application_id", applicationId);
  form.append("file_type", fileType);
  form.append("file", file);

  const response = await fetch(`${API}/upload_application_file`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`${fileType} upload failed: ${response.status}`);
  }

  setProgress(completionPercent, `${completionPercent}%`);
}

function showStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("error", isError);
}

function setProgress(value, text) {
  progressBar.style.width = `${value}%`;
  progressText.textContent = text;
}

function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
