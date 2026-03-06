const XANO_BASE_URL = "https://xbut-eryu-hhsg.f2.xano.io";
const APPLICATION_FILES_ENDPOINT = `${XANO_BASE_URL}/api:vGd6XDW3/application_files`;

const MOCK_APPLICATION_FILES = [
  { id: 1, created_at: "2026-01-05T11:10:00.000Z", applications_id: 2401, file_url: "/vault/front-2401.jpg", file_type: "pola_front" },
  { id: 2, created_at: "2026-01-05T11:11:00.000Z", applications_id: 2401, file_url: "/vault/side-2401.jpg", file_type: "pola_side" },
  { id: 3, created_at: "2026-01-05T11:12:00.000Z", applications_id: 2401, file_url: "/vault/full-2401.jpg", file_type: "pola_full" },
];

const statusNode = document.getElementById("status");
const gridNode = document.getElementById("grid");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

async function loadApplicationFiles() {
  const response = await fetch(APPLICATION_FILES_ENDPOINT, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`application_files failed (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("application_files payload must be an array");
  return payload;
}

function groupFilesByApplication(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!grouped.has(row.applications_id)) {
      grouped.set(row.applications_id, {
        applications_id: row.applications_id,
        created_at: row.created_at,
        pola_front: null,
        pola_side: null,
        pola_full: null,
      });
    }

    const candidate = grouped.get(row.applications_id);
    if (new Date(row.created_at) > new Date(candidate.created_at)) candidate.created_at = row.created_at;
    if (["pola_front", "pola_side", "pola_full"].includes(row.file_type)) candidate[row.file_type] = row.file_url;
  });

  return [...grouped.values()].sort((a, b) => b.applications_id - a.applications_id);
}

function toAssetUrl(fileUrl) {
  return fileUrl ? `${XANO_BASE_URL}${fileUrl}` : "";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function renderSlot(label, missingLabel, fileUrl) {
  const container = document.createElement("div");
  const title = document.createElement("p");
  title.className = "slot-label";
  title.textContent = label;
  container.append(title);

  if (!fileUrl) {
    const missing = document.createElement("div");
    missing.className = "slot-missing";
    missing.textContent = missingLabel;
    container.append(missing);
    return container;
  }

  const img = document.createElement("img");
  img.className = "slot-image";
  img.src = toAssetUrl(fileUrl);
  img.alt = `${label} polaroid`;
  img.loading = "lazy";
  img.addEventListener("click", () => {
    lightboxImage.src = img.src;
    lightbox.showModal();
  });

  container.append(img);
  return container;
}

function renderCandidates(candidates) {
  gridNode.innerHTML = "";

  candidates.forEach((candidate) => {
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = `Application ID #${candidate.applications_id}`;

    const created = document.createElement("p");
    created.textContent = `Created: ${formatDate(candidate.created_at)}`;

    const slots = document.createElement("div");
    slots.className = "slots";
    slots.append(
      renderSlot("Front", "Front missing", candidate.pola_front),
      renderSlot("Side", "Side missing", candidate.pola_side),
      renderSlot("Full body", "Full body missing", candidate.pola_full)
    );

    card.append(title, created, slots);
    gridNode.append(card);
  });
}

async function init() {
  try {
    const files = await loadApplicationFiles();
    const candidates = groupFilesByApplication(files);
    statusNode.textContent = `${candidates.length} application${candidates.length === 1 ? "" : "s"} loaded`;
    renderCandidates(candidates);
  } catch (error) {
    console.error(error);
    statusNode.textContent = "API unavailable. Showing mock data.";
    renderCandidates(groupFilesByApplication(MOCK_APPLICATION_FILES));
  }
}

lightboxClose?.addEventListener("click", () => lightbox.close());
lightbox?.addEventListener("click", (event) => {
  const rect = lightbox.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) lightbox.close();
});

init();
