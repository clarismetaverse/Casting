const XANO_BASE_URL = "https://xbut-eryu-hhsg.f2.xano.io";

// Keep data loading isolated so replacing with a real API call is low-impact later.
const MOCK_APPLICATION_FILES = [
  {
    id: 101,
    created_at: "2026-01-05T11:10:00.000Z",
    applications_id: 2401,
    file_url: "/vault/front-2401.jpg",
    file_type: "pola_front",
  },
  {
    id: 102,
    created_at: "2026-01-05T11:11:00.000Z",
    applications_id: 2401,
    file_url: "/vault/side-2401.jpg",
    file_type: "pola_side",
  },
  {
    id: 103,
    created_at: "2026-01-05T11:12:00.000Z",
    applications_id: 2401,
    file_url: "/vault/full-2401.jpg",
    file_type: "pola_full",
  },
  {
    id: 104,
    created_at: "2026-01-06T09:20:00.000Z",
    applications_id: 2402,
    file_url: "/vault/front-2402.jpg",
    file_type: "pola_front",
  },
  {
    id: 105,
    created_at: "2026-01-06T09:24:00.000Z",
    applications_id: 2402,
    file_url: "/vault/full-2402.jpg",
    file_type: "pola_full",
  },
  {
    id: 106,
    created_at: "2026-01-07T14:07:00.000Z",
    applications_id: 2403,
    file_url: "/vault/side-2403.jpg",
    file_type: "pola_side",
  },
];

const statusNode = document.getElementById("adminStatus");
const gridNode = document.getElementById("candidateGrid");
const previewDialog = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const closePreview = document.getElementById("closePreview");

async function loadApplicationFiles() {


function groupFilesByApplication(fileRecords) {
  const grouped = new Map();

  fileRecords.forEach((record) => {
    if (!grouped.has(record.applications_id)) {
      grouped.set(record.applications_id, {
        applications_id: record.applications_id,
        created_at: record.created_at,
        pola_front: null,
        pola_side: null,
        pola_full: null,
      });
    }

    const candidate = grouped.get(record.applications_id);

    if (new Date(record.created_at) > new Date(candidate.created_at)) {
      candidate.created_at = record.created_at;
    }

    if (["pola_front", "pola_side", "pola_full"].includes(record.file_type)) {
      candidate[record.file_type] = record.file_url;
    }
  });

  return Array.from(grouped.values()).sort((a, b) => b.applications_id - a.applications_id);
}

function imageUrl(fileUrl) {
  if (!fileUrl) return "";
  return `${XANO_BASE_URL}${fileUrl}`;
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function createImageSlot(label, missingLabel, fileUrl) {
  const slot = document.createElement("article");
  slot.className = "image-slot";

  const slotLabel = document.createElement("p");
  slotLabel.className = "slot-label";
  slotLabel.textContent = label;
  slot.append(slotLabel);

  if (!fileUrl) {
    const placeholder = document.createElement("div");
    placeholder.className = "slot-placeholder";
    placeholder.textContent = missingLabel;
    slot.append(placeholder);
    return slot;
  }

  const img = document.createElement("img");
  img.className = "slot-image";
  img.src = imageUrl(fileUrl);
  img.alt = `${label} polaroid`;
  img.loading = "lazy";

  img.addEventListener("click", () => {
    if (!previewDialog || !previewImg) return;
    previewImg.src = img.src;
    previewDialog.showModal();
  });

  slot.append(img);
  return slot;
}

function renderCandidates(candidates) {
  gridNode.innerHTML = "";

  candidates.forEach((candidate) => {
    const card = document.createElement("article");
    card.className = "candidate-card";

    const meta = document.createElement("div");
    meta.className = "candidate-meta";

    const id = document.createElement("p");
    id.className = "candidate-id";
    id.textContent = `Application ID #${candidate.applications_id}`;

    const created = document.createElement("p");
    created.className = "candidate-created";
    created.textContent = `Created: ${formatDate(candidate.created_at)}`;

    meta.append(id, created);

    const slots = document.createElement("div");
    slots.className = "image-slots";
    slots.append(
      createImageSlot("Front", "Front missing", candidate.pola_front),
      createImageSlot("Side", "Side missing", candidate.pola_side),
      createImageSlot("Full body", "Full body missing", candidate.pola_full)
    );

    card.append(meta, slots);
    gridNode.append(card);
  });
}

async function init() {
  try {
    const fileRecords = await loadApplicationFiles();
    const groupedCandidates = groupFilesByApplication(fileRecords);

    statusNode.textContent = `${groupedCandidates.length} application${groupedCandidates.length === 1 ? "" : "s"} loaded`;
    renderCandidates(groupedCandidates);
  } catch (error) {
    console.error(error);

  }
}

closePreview?.addEventListener("click", () => previewDialog?.close());
previewDialog?.addEventListener("click", (event) => {
  const dialogBounds = previewDialog.getBoundingClientRect();
  const clickedOutside =
    event.clientX < dialogBounds.left ||
    event.clientX > dialogBounds.right ||
    event.clientY < dialogBounds.top ||
    event.clientY > dialogBounds.bottom;

  if (clickedOutside) previewDialog.close();
});

init();
