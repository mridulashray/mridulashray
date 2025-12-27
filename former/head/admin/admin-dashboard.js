const SESSION_KEY = "mridulashrayAdminSession";
const TAB_SESSION_FLAG = "mridulashrayAdminTabFlag";
const loginRedirect = () => (window.location.href = "./login.html");
const sessionBadge = document.getElementById("admin-session-name");
const logoutBtn = document.getElementById("logout-btn");
const saveEventBtn = document.getElementById("save-event-btn");
const eventMetadataSubmitBtn = saveEventBtn;
const refreshEventsBtn = document.getElementById("refresh-events-btn");
const eventMetadataForm = document.getElementById("event-metadata-form");
const eventMetadataFeedback = document.getElementById("event-metadata-feedback");
const eventMetadataCancelBtn = document.getElementById("event-metadata-cancel");
const upcomingSection = document.getElementById("upcoming-section");
const upcomingForm = document.getElementById("upcoming-event-form");
const saveUpcomingBtn = document.getElementById("save-upcoming-btn");
const upcomingCancelBtn = document.getElementById("upcoming-cancel-btn");
const upcomingFeedback = document.getElementById("upcoming-event-feedback");
const refreshUpcomingBtn = document.getElementById("refresh-upcoming-btn");
const upcomingTableBody = document.querySelector("#upcoming-events-table tbody");
const ongoingSection = document.getElementById("ongoing-section");
const ongoingForm = document.getElementById("ongoing-project-form");
const saveOngoingBtn = document.getElementById("save-ongoing-btn");
const ongoingCancelBtn = document.getElementById("ongoing-cancel-btn");
const ongoingFeedback = document.getElementById("ongoing-project-feedback");
const refreshOngoingBtn = document.getElementById("refresh-ongoing-btn");
const ongoingTableBody = document.querySelector("#ongoing-projects-table tbody");
const sectionPanels = document.querySelectorAll(".admin-section");
const navLinks = document.querySelectorAll(".admin-nav__link");
const eventsTableBody = document.querySelector("#events-table tbody");
const albumWorkspace = document.getElementById("album-workspace");
const albumWorkspaceTitle = document.getElementById("album-workspace-title");
const albumWorkspaceSubtitle = document.getElementById("album-workspace-subtitle");
const albumWorkspaceStatus = document.getElementById("album-workspace-status");
const albumWorkspaceUpdated = document.getElementById("album-workspace-updated");
const albumMediaList = document.getElementById("album-media-list");
const albumMediaForm = document.getElementById("album-media-form");
const albumMediaSubmitBtn = document.getElementById("album-media-submit");
const albumMediaCancelBtn = document.getElementById("album-media-cancel");
const albumMediaFeedback = document.getElementById("album-media-feedback");
const albumMediaReorderActions = document.getElementById("album-media-reorder-actions");
const albumMediaSaveOrderBtn = document.getElementById("album-media-save-order");
const albumMediaCancelOrderBtn = document.getElementById("album-media-cancel-order");
const albumMediaOrderFeedback = document.getElementById("album-media-order-feedback");
const slugInput = eventMetadataForm?.querySelector('input[name="slug"]');

const account = window.appwrite?.account;
let currentAccount = null;
let activeAlbum = null;
let editingMediaId = null;
let eventsCache = [];
let upcomingCache = [];
let volunteersCache = [];
let contactsCache = [];
let ongoingCache = [];
let currentMediaEntries = [];
let mediaOrderDirty = false;
let dragStartIndex = null;
let activePanel = "manage-section";
let upcomingEditingId = null;
let ongoingEditingId = null;

const pad2 = (value) => value.toString().padStart(2, "0");
const monthLookup = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const normalizeDateInput = (rawValue) => {
  if (!rawValue) return "";
  const value = rawValue.toString().trim();
  if (!value) return "";

  const isoMatch = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${pad2(isoMatch[2])}-${pad2(isoMatch[3])}`;
  }

  const dayFirstMatch = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${pad2(dayFirstMatch[2])}-${pad2(dayFirstMatch[1])}`;
  }

  const textualMatch = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textualMatch) {
    const monthKey = textualMatch[2].slice(0, 3).toLowerCase();
    const monthValue = monthLookup[monthKey];
    if (monthValue) {
      return `${textualMatch[3]}-${pad2(monthValue)}-${pad2(textualMatch[1])}`;
    }
  }

  return "";
};

const toComparableDate = (rawValue) => {
  const normalized = normalizeDateInput(rawValue);
  if (normalized) {
    const normalizedDate = new Date(normalized);
    if (!Number.isNaN(normalizedDate.getTime())) {
      return normalizedDate;
    }
  }
  if (!rawValue) return null;
  const fallback = new Date(rawValue);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatDurationLabel = (startDate, endDate) => {
  const start = toComparableDate(startDate);
  const end = toComparableDate(endDate);
  if (start && end) {
    if (start.toDateString() === end.toDateString()) {
      return `${start.toLocaleDateString()} · Single day`;
    }
    return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
  }
  if (start) {
    return `${start.toLocaleDateString()} onwards`;
  }
  if (end) {
    return `Until ${end.toLocaleDateString()}`;
  }
  if (startDate && endDate) return `${startDate} → ${endDate}`;
  return startDate || endDate || "Timeline TBA";
};

const parseMediaEntries = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const setFeedback = (el, message, isError = false) => {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-error", isError);
};

const setTabSession = () => {
  try {
    sessionStorage.setItem(TAB_SESSION_FLAG, "1");
  } catch {
    // ignore
  }
};

const clearTabSession = () => {
  try {
    sessionStorage.removeItem(TAB_SESSION_FLAG);
  } catch {
    // ignore
  }
};

const requireSession = async () => {
  if (!account) {
    setFeedback(eventMetadataFeedback, "Appwrite SDK not ready.", true);
    loginRedirect();
    return;
  }
  try {
    const current = await account.get();
    currentAccount = current;
    if (sessionBadge) {
      sessionBadge.textContent = `Logged in as ${current.email}`;
    }
    setTabSession();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: current.email,
        ts: Date.now()
      })
    );
  } catch (error) {
    console.error(error);
    loginRedirect();
  }
};

requireSession();

logoutBtn?.addEventListener("click", async () => {
  try {
    await account?.deleteSessions();
    localStorage.removeItem(SESSION_KEY);
    clearTabSession();
    loginRedirect();
  } catch (error) {
    console.error("Logout error", error);
  }
  localStorage.removeItem(SESSION_KEY);
  clearTabSession();
  loginRedirect();
});

const getClient = () => {
  if (!window.appwrite?.databases || !window.appwrite?.storage) {
    throw new Error("Appwrite SDK not initialised. Check appwrite-config.js.");
  }
  return {
    databases: window.appwrite.databases,
    storage: window.appwrite.storage
  };
};

const parseEventPayload = async () => {
  if (!eventMetadataForm) throw new Error("Metadata form missing");
  const formData = new FormData(eventMetadataForm);
  const slug = formData.get("slug")?.toString().trim();
  if (!slug) throw new Error("Event slug is required.");

  const payload = {
    name: formData.get("name")?.toString().trim() || "",
    slug,
    title: formData.get("title")?.toString().trim() || "",
    description: formData.get("description")?.toString().trim() || "",
    caption: formData.get("caption")?.toString().trim() || "",
    date: formData.get("date")?.toString() || null,
    impactCount: formData.get("impactCount") ? Number(formData.get("impactCount")) : null,
    status: formData.get("status")?.toString() || "draft",
    coverFileId: formData.get("coverFileId")?.toString().trim() || "",
    updatedAt: new Date().toISOString()
  };

  if (Number.isNaN(payload.impactCount)) {
    payload.impactCount = null;
  }

  ["name", "title", "description"].forEach((field) => {
    if (!payload[field]) {
      throw new Error(`Please fill out ${field} before saving.`);
    }
  });

  return payload;
};

const upsertEvent = async () => {
  const { databases } = getClient();
  const payload = await parseEventPayload();
  const docId = payload.slug;
  let existingDoc = null;

  try {
    existingDoc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, docId);
  } catch {
    existingDoc = null;
  }

  const existingMediaEntries = parseMediaEntries(existingDoc?.mediaEntries);

  const mergedPayload = {
    ...payload,
    mediaFileIds: existingDoc?.mediaFileIds || [],
    mediaEntries: JSON.stringify(existingMediaEntries),
    coverFileId: payload.coverFileId || existingDoc?.coverFileId || "",
    impactCount: payload.impactCount ?? existingDoc?.impactCount ?? null
  };

  if (!existingDoc) {
    await databases.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, docId, mergedPayload);
  } else {
    await databases.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, docId, mergedPayload);
  }

  setFeedback(eventMetadataFeedback, "Event metadata saved.");
  await loadEvents();
};

const resetEventForm = () => {
  eventMetadataForm.reset();
  eventMetadataForm.dataset.mode = "create";
  eventMetadataForm.dataset.albumId = "";
  if (eventMetadataSubmitBtn) {
    eventMetadataSubmitBtn.textContent = "Save / Update Event";
  }
  if (eventMetadataCancelBtn) {
    eventMetadataCancelBtn.hidden = true;
  }
  if (slugInput) {
    slugInput.readOnly = false;
  }
};

eventMetadataCancelBtn?.addEventListener("click", () => {
  resetEventForm();
  setFeedback(eventMetadataFeedback, "");
});

saveEventBtn?.addEventListener("click", async () => {
  setFeedback(eventMetadataFeedback, "Saving event…");
  try {
    await upsertEventForm();
  } catch (error) {
    console.error(error);
    setFeedback(eventMetadataFeedback, error.message || "Unable to save event.", true);
  }
});

const upsertEventForm = async () => {
  const { databases } = getClient();
  const payload = await parseEventPayload();
  const isEdit = eventMetadataForm.dataset.mode === "edit";
  const existingId = eventMetadataForm.dataset.albumId || payload.slug;

  try {
    setFeedback(eventMetadataFeedback, isEdit ? "Updating album…" : "Saving album…");
    let doc;

    if (isEdit && existingId) {
      doc = await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.events,
        existingId,
        payload
      );
    } else {
      doc = await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.events,
        payload.slug,
        payload,
        [
          Appwrite.Permission.read(Appwrite.Role.any()),
          Appwrite.Permission.update(Appwrite.Role.any()),
          Appwrite.Permission.delete(Appwrite.Role.user(currentAccount.$id || ""))
        ]
      );
    }

    setFeedback(eventMetadataFeedback, isEdit ? "Album updated!" : "Album saved!");
    await loadEvents();
    resetEventForm();
  } catch (error) {
    console.error(error);
    setFeedback(eventMetadataFeedback, error?.message || "Failed to save album.", true);
  }
};

const renderEventsTable = (events = []) => {
  eventsTableBody.innerHTML = "";
  if (!events.length) {
    return;
  }

  events.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Event">${doc.title || doc.name || "Untitled"}</td>
      <td data-label="Slug">${doc.slug}</td>
      <td data-label="Status"><span class="badge badge--${doc.status === "published" ? "success" : "muted"}">${doc.status}</span></td>
      <td data-label="Updated">${doc.startDate ? new Date(doc.startDate).toLocaleDateString() : "-"}</td>
      <td data-label="Photos">${doc.mediaFileIds?.length || 0}</td>
      <td class="admin-actions-cell" data-label="Actions">
        <button class="ghost-btn ghost-btn--small" data-edit-album="${doc.$id}">Edit</button>
        <button class="ghost-btn ghost-btn--small" data-manage-album="${doc.$id}">Manage</button>
        <button class="ghost-btn ghost-btn--small ghost-btn--danger" data-delete-album="${doc.$id}">Delete</button>
      </td>
    `;
    eventsTableBody.appendChild(tr);
  });

  attachAlbumActionHandlers();
};

const upcomingPosterField = () => upcomingForm?.querySelector('input[name="storedPosterId"]');
const posterFileInput = () => upcomingForm?.querySelector('input[name="posterFile"]');
const ongoingPosterField = () => ongoingForm?.querySelector('input[name="storedOngoingPosterId"]');

const parseUpcomingPayload = () => {
  if (!upcomingForm) throw new Error("Upcoming event form missing");
  const formData = new FormData(upcomingForm);
  const slug = formData.get("upSlug")?.toString().trim();
  const title = formData.get("upTitle")?.toString().trim();
  const description = formData.get("upDescription")?.toString().trim();
  const location = formData.get("upLocation")?.toString().trim();
  const startDate = formData.get("upStartDate")?.toString().trim();
  const endDate = formData.get("upEndDate")?.toString().trim();
  const volunteerEnabled = formData.get("upVolunteerEnabled") === "on";

  if (!slug || !title || !description || !location || !startDate || !endDate) {
    throw new Error("Please fill in all required upcoming event fields.");
  }
  return {
    slug,
    title,
    description,
    location,
    startDate,
    endDate,
    status: volunteerEnabled ? "needs-volunteers" : "scheduled",
    posterFileId: upcomingPosterField()?.value || ""
  };
};

const parseOngoingPayload = () => {
  if (!ongoingForm) throw new Error("Ongoing project form missing");
  const formData = new FormData(ongoingForm);
  const slug = formData.get("opSlug")?.toString().trim();
  const title = formData.get("opTitle")?.toString().trim();
  const description = formData.get("opDescription")?.toString().trim();
  const agenda = formData.get("opAgenda")?.toString().trim();
  const location = formData.get("opLocation")?.toString().trim();
  const startDate = formData.get("opStartDate")?.toString().trim();
  const endDate = formData.get("opEndDate")?.toString().trim();
  const status = formData.get("opStatus")?.toString().trim() || "active";

  if (!slug || !title || !description || !agenda || !location || !startDate || !endDate) {
    throw new Error("Please fill in all required ongoing project fields.");
  }

  return {
    slug,
    title,
    description,
    agenda,
    location,
    startDate,
    endDate,
    status,
    posterFileId: ongoingPosterField()?.value || ""
  };
};

const uploadPosterFile = async (file) => {
  if (!(file instanceof File) || !file.size) return "";
  const { storage } = getClient();
  const fileId = Appwrite.ID.unique();
  const permissions = [Appwrite.Permission.read(Appwrite.Role.any())];
  if (currentAccount?.$id) {
    permissions.push(
      Appwrite.Permission.update(Appwrite.Role.user(currentAccount.$id)),
      Appwrite.Permission.delete(Appwrite.Role.user(currentAccount.$id)),
      Appwrite.Permission.read(Appwrite.Role.user(currentAccount.$id))
    );
  }
  const uploaded = await storage.createFile(APPWRITE_CONFIG.bucketId, fileId, file, permissions);
  return uploaded.$id;
};

const deletePosterFile = async (fileId) => {
  if (!fileId) return;
  const { storage } = getClient();
  try {
    await storage.deleteFile(APPWRITE_CONFIG.bucketId, fileId);
  } catch (error) {
    console.warn("Unable to delete poster file", fileId, error);
  }
};

const resetUpcomingForm = () => {
  if (!upcomingForm) return;
  upcomingForm.reset();
  upcomingForm.dataset.mode = "create";
  upcomingEditingId = null;
  const storedPoster = upcomingPosterField();
  if (storedPoster) storedPoster.value = "";
  if (upcomingForm.elements.upVolunteerEnabled) {
    upcomingForm.elements.upVolunteerEnabled.checked = false;
  }
  if (upcomingCancelBtn) upcomingCancelBtn.hidden = true;
};

const populateUpcomingForm = (doc) => {
  if (!upcomingForm || !doc) return;
  upcomingForm.elements.upTitle.value = doc.title || "";
  upcomingForm.elements.upSlug.value = doc.slug || doc.$id;
  upcomingForm.elements.upLocation.value = doc.location || "";
  upcomingForm.elements.upStartDate.value = doc.startDate ? doc.startDate.slice(0, 10) : "";
  upcomingForm.elements.upEndDate.value = doc.endDate ? doc.endDate.slice(0, 10) : "";
  upcomingForm.elements.upDescription.value = doc.description || "";
  if (upcomingForm.elements.upVolunteerEnabled) {
    const statusValue = (doc.status || "").toLowerCase();
    const volunteerFlag = doc.volunteerCtaEnabled || statusValue === "needs-volunteers";
    upcomingForm.elements.upVolunteerEnabled.checked = Boolean(volunteerFlag);
  }
  const storedPoster = upcomingPosterField();
  if (storedPoster) storedPoster.value = doc.posterFileId || "";
};

const upsertUpcomingEvent = async () => {
  if (!upcomingForm) return;
  const { databases } = getClient();
  try {
    setFeedback(upcomingFeedback, "Saving upcoming event…");
    const payload = parseUpcomingPayload();
    const formData = new FormData(upcomingForm);
    const posterFile = formData.get("posterFile");
    if (posterFile instanceof File && posterFile.size) {
      if (payload.posterFileId) {
        await deletePosterFile(payload.posterFileId);
      }
      payload.posterFileId = await uploadPosterFile(posterFile);
      const storedPoster = upcomingPosterField();
      if (storedPoster) storedPoster.value = payload.posterFileId;
    }

    const isEdit = upcomingForm.dataset.mode === "edit" && upcomingEditingId;
    const docId = isEdit ? upcomingEditingId : payload.slug;

    if (isEdit) {
      await databases.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, docId, payload);
    } else {
      const permissions = [Appwrite.Permission.read(Appwrite.Role.any())];
      await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.upcomingEvents,
        docId,
        payload,
        permissions
      );
    }

    setFeedback(upcomingFeedback, "Upcoming event saved.");
    resetUpcomingForm();
    await loadUpcomingEvents();
  } catch (error) {
    console.error(error);
    setFeedback(upcomingFeedback, error?.message || "Failed to save upcoming event.", true);
  }
};

const renderUpcomingTable = (documents = []) => {
  if (!upcomingTableBody) return;
  upcomingTableBody.innerHTML = "";
  if (!documents.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6">No upcoming events scheduled. Use the form above to add one.</td>`;
    upcomingTableBody.appendChild(row);
    return;
  }

  const evaluateDateStatus = (startRaw, endRaw) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startComparable = toComparableDate(startRaw);
    const endComparable = toComparableDate(endRaw);
    const startIsToday = startComparable ? startComparable.toDateString() === today.toDateString() : false;
    let hasEnded = false;
    if (endComparable) {
      const endOfDay = new Date(endComparable);
      endOfDay.setHours(23, 59, 59, 999);
      hasEnded = endOfDay < today;
    }
    return { isToday: startIsToday, hasEnded };
  };

  documents.forEach((doc) => {
    const { isToday, hasEnded } = evaluateDateStatus(doc.startDate, doc.endDate);
    const durationLabel = formatDurationLabel(doc.startDate, doc.endDate);
    const posterThumb = doc.posterFileId
      ? `<img src="${storagePreviewUrl(doc.posterFileId)}" alt="${doc.title}" />`
      : "—";
    const statusLabel = hasEnded ? "Ended" : isToday ? "Today" : "Upcoming";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Event">
        <strong>${doc.title}</strong>
        <small>${doc.slug}</small>
      </td>
      <td data-label="Duration">${durationLabel}</td>
      <td data-label="Location">${doc.location || "—"}</td>
      <td data-label="Poster" class="upcoming-table__poster">${posterThumb}</td>
      <td data-label="Status"><span class="badge badge--${isToday ? "success" : hasEnded ? "muted" : "info"}">${statusLabel}</span></td>
      <td class="admin-actions-cell">
        <button class="ghost-btn ghost-btn--small" data-edit-upcoming="${doc.$id}">Edit</button>
        <button class="ghost-btn ghost-btn--small ghost-btn--danger" data-delete-upcoming="${doc.$id}">Delete</button>
        ${
          hasEnded
            ? `<button class="ghost-btn ghost-btn--small" data-convert-upcoming="${doc.$id}">Convert to album</button>`
            : ""
        }
      </td>
    `;
    upcomingTableBody.appendChild(tr);
  });
  attachUpcomingActionHandlers();
};

const startUpcomingEdit = async (docId) => {
  if (!upcomingForm) return;
  try {
    const doc =
      upcomingCache.find((item) => item.$id === docId) || (await getClient().databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, docId));
    populateUpcomingForm(doc);
    upcomingForm.dataset.mode = "edit";
    upcomingEditingId = doc.$id;
    if (upcomingCancelBtn) upcomingCancelBtn.hidden = false;
    setFeedback(upcomingFeedback, "");
    upcomingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    setFeedback(upcomingFeedback, error?.message || "Unable to load upcoming event.", true);
  }
};

const handleDeleteUpcoming = async (docId) => {
  if (!window.confirm("Delete this upcoming event invitation?")) return;
  const { databases } = getClient();
  try {
    setFeedback(upcomingFeedback, "Deleting upcoming event…");
    const doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, docId);
    if (doc.posterFileId) {
      await deletePosterFile(doc.posterFileId);
    }
    await databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, docId);
    setFeedback(upcomingFeedback, "Upcoming event deleted.");
    if (upcomingEditingId === docId) {
      resetUpcomingForm();
    }
    await loadUpcomingEvents();
  } catch (error) {
    console.error(error);
    setFeedback(upcomingFeedback, error?.message || "Unable to delete upcoming event.", true);
  }
};

const ensureAlbumForUpcoming = async (doc) => {
  const { databases } = getClient();
  let existing;
  try {
    existing = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, doc.slug);
  } catch {
    existing = null;
  }

  const payload = {
    name: doc.title,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    caption: doc.location || "",
    date: doc.startDate || doc.endDate || null,
    status: "draft",
    coverFileId: doc.posterFileId || ""
  };

  if (!existing) {
    await databases.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, doc.slug, payload);
  } else {
    await databases.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, existing.$id, {
      ...payload,
      mediaEntries: existing.mediaEntries || existing.mediaentries || existing.mediaEntriesJson || existing.media_entries || null
    });
  }
};

const convertUpcomingDocToAlbum = async (docId) => {
  const { databases } = getClient();
  try {
    const doc =
      upcomingCache.find((item) => item.$id === docId) ||
      (await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, docId));
    await ensureAlbumForUpcoming(doc);
    await databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, doc.$id);
    setFeedback(upcomingFeedback, `Converted "${doc.title}" into an album.`);
    await loadEvents();
    await loadUpcomingEvents();
  } catch (error) {
    console.error(error);
    setFeedback(upcomingFeedback, error?.message || "Unable to convert event into album.", true);
  }
};

const attachUpcomingActionHandlers = () => {
  if (!upcomingTableBody) return;
  upcomingTableBody.querySelectorAll("[data-edit-upcoming]").forEach((btn) =>
    btn.addEventListener("click", () => startUpcomingEdit(btn.dataset.editUpcoming))
  );
  upcomingTableBody.querySelectorAll("[data-delete-upcoming]").forEach((btn) =>
    btn.addEventListener("click", () => handleDeleteUpcoming(btn.dataset.deleteUpcoming))
  );
  upcomingTableBody.querySelectorAll("[data-convert-upcoming]").forEach((btn) =>
    btn.addEventListener("click", () => handleConvertUpcoming(btn.dataset.convertUpcoming))
  );
};

const handleConvertUpcoming = async (docId) => {
  if (!window.confirm("Convert this event into an album now?")) return;
  await convertUpcomingDocToAlbum(docId);
};

const ongoingStatusMeta = {
  active: { badge: "success", label: "Active" },
  paused: { badge: "warning", label: "Paused" },
  completed: { badge: "muted", label: "Completed" }
};

const getOngoingStatusBadge = (status) => {
  const normalized = (status || "").toLowerCase();
  const meta = ongoingStatusMeta[normalized] || { badge: "info", label: status || "Scheduled" };
  return `<span class="badge badge--${meta.badge}">${meta.label}</span>`;
};

const resetOngoingForm = () => {
  if (!ongoingForm) return;
  ongoingForm.reset();
  ongoingForm.dataset.mode = "create";
  ongoingEditingId = null;
  const storedPoster = ongoingPosterField();
  if (storedPoster) storedPoster.value = "";
  if (ongoingCancelBtn) ongoingCancelBtn.hidden = true;
};

const populateOngoingForm = (doc) => {
  if (!ongoingForm || !doc) return;
  ongoingForm.elements.opTitle.value = doc.title || "";
  ongoingForm.elements.opSlug.value = doc.slug || doc.$id;
  ongoingForm.elements.opLocation.value = doc.location || "";
  ongoingForm.elements.opStartDate.value = doc.startDate ? doc.startDate.slice(0, 10) : "";
  ongoingForm.elements.opEndDate.value = doc.endDate ? doc.endDate.slice(0, 10) : "";
  ongoingForm.elements.opDescription.value = doc.description || "";
  ongoingForm.elements.opAgenda.value = doc.agenda || "";
  if (ongoingForm.elements.opStatus) {
    ongoingForm.elements.opStatus.value = doc.status || "active";
  }
  const storedPoster = ongoingPosterField();
  if (storedPoster) storedPoster.value = doc.posterFileId || "";
};

const upsertOngoingProject = async () => {
  if (!ongoingForm) return;
  const { databases } = getClient();
  try {
    setFeedback(ongoingFeedback, "Saving ongoing project…");
    const payload = parseOngoingPayload();
    const formData = new FormData(ongoingForm);
    const posterFile = formData.get("opPosterFile");
    if (posterFile instanceof File && posterFile.size) {
      if (payload.posterFileId) {
        await deletePosterFile(payload.posterFileId);
      }
      payload.posterFileId = await uploadPosterFile(posterFile);
      const storedPoster = ongoingPosterField();
      if (storedPoster) storedPoster.value = payload.posterFileId;
    }

    const isEdit = ongoingForm.dataset.mode === "edit" && ongoingEditingId;
    const docId = isEdit ? ongoingEditingId : payload.slug;

    if (isEdit) {
      await databases.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.ongoingProjects, docId, payload);
    } else {
      const permissions = [Appwrite.Permission.read(Appwrite.Role.any())];
      await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.ongoingProjects,
        docId,
        payload,
        permissions
      );
    }

    setFeedback(ongoingFeedback, "Ongoing project saved.");
    resetOngoingForm();
    await loadOngoingProjects();
  } catch (error) {
    console.error(error);
    setFeedback(ongoingFeedback, error?.message || "Failed to save ongoing project.", true);
  }
};

const renderOngoingTable = (documents = []) => {
  if (!ongoingTableBody) return;
  ongoingTableBody.innerHTML = "";
  if (!documents.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7">No ongoing projects yet. Use the form above to add one.</td>`;
    ongoingTableBody.appendChild(row);
    return;
  }

  documents.forEach((doc) => {
    const durationLabel = formatDurationLabel(doc.startDate, doc.endDate);
    const posterThumb = doc.posterFileId
      ? `<img src="${storagePreviewUrl(doc.posterFileId)}" alt="${doc.title}" />`
      : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Project">
        <strong>${doc.title}</strong>
        <small>${doc.slug}</small>
      </td>
      <td data-label="Duration">${durationLabel}</td>
      <td data-label="Location">${doc.location || "—"}</td>
      <td data-label="Agenda">${doc.agenda || "—"}</td>
      <td data-label="Status">${getOngoingStatusBadge(doc.status)}</td>
      <td data-label="Poster" class="ongoing-table__poster">${posterThumb}</td>
      <td class="admin-actions-cell">
        <button class="ghost-btn ghost-btn--small" data-edit-ongoing="${doc.$id}">Edit</button>
        <button class="ghost-btn ghost-btn--small ghost-btn--danger" data-delete-ongoing="${doc.$id}">Delete</button>
      </td>
    `;
    ongoingTableBody.appendChild(tr);
  });

  attachOngoingActionHandlers();
};

const startOngoingEdit = async (docId) => {
  if (!ongoingForm) return;
  try {
    const doc =
      ongoingCache.find((item) => item.$id === docId) ||
      (await getClient().databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.ongoingProjects, docId));
    populateOngoingForm(doc);
    ongoingForm.dataset.mode = "edit";
    ongoingEditingId = doc.$id;
    if (ongoingCancelBtn) ongoingCancelBtn.hidden = false;
    setFeedback(ongoingFeedback, "");
    ongoingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    setFeedback(ongoingFeedback, error?.message || "Unable to load ongoing project.", true);
  }
};

const handleDeleteOngoing = async (docId) => {
  if (!window.confirm("Delete this ongoing project?")) return;
  const { databases } = getClient();
  try {
    setFeedback(ongoingFeedback, "Deleting ongoing project…");
    const doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.ongoingProjects, docId);
    if (doc.posterFileId) {
      await deletePosterFile(doc.posterFileId);
    }
    await databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.ongoingProjects, docId);
    setFeedback(ongoingFeedback, "Ongoing project deleted.");
    if (ongoingEditingId === docId) {
      resetOngoingForm();
    }
    await loadOngoingProjects();
  } catch (error) {
    console.error(error);
    setFeedback(ongoingFeedback, error?.message || "Unable to delete ongoing project.", true);
  }
};

const attachOngoingActionHandlers = () => {
  if (!ongoingTableBody) return;
  ongoingTableBody.querySelectorAll("[data-edit-ongoing]").forEach((btn) =>
    btn.addEventListener("click", () => startOngoingEdit(btn.dataset.editOngoing))
  );
  ongoingTableBody.querySelectorAll("[data-delete-ongoing]").forEach((btn) =>
    btn.addEventListener("click", () => handleDeleteOngoing(btn.dataset.deleteOngoing))
  );
};

const loadOngoingProjects = async () => {
  if (!ongoingTableBody) return;
  const { databases } = getClient();
  ongoingTableBody.innerHTML = "";
  try {
    const queries = [];
    if (Appwrite.Query?.orderAsc) {
      queries.push(Appwrite.Query.orderAsc("startDate"));
    }
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.ongoingProjects,
      queries
    );
    ongoingCache = response.documents || [];
    renderOngoingTable(ongoingCache);
    setFeedback(ongoingFeedback, "");
  } catch (error) {
    console.error(error);
    setFeedback(ongoingFeedback, "Unable to load ongoing projects. Check Appwrite permissions.", true);
    ongoingTableBody.innerHTML = `<tr><td colspan="7">Unable to load ongoing projects.</td></tr>`;
  }
};

const convertExpiredUpcomingEvents = async (documents = []) => {
  if (!documents.length) return false;
  const now = new Date();
  let convertedAny = false;
  for (const doc of documents) {
    const endDate = toComparableDate(doc.endDate);
    if (!endDate) continue;
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay < now) {
      await ensureAlbumForUpcoming(doc);
      await getClient().databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.upcomingEvents, doc.$id);
      convertedAny = true;
    }
  }
  if (convertedAny) {
    setFeedback(upcomingFeedback, "Past events converted into albums. Refreshing list…");
    await loadEvents();
  }
  return convertedAny;
};

const loadUpcomingEvents = async () => {
  if (!upcomingTableBody) return;
  const { databases } = getClient();
  upcomingTableBody.innerHTML = "";
  try {
    const queries = [];
    if (Appwrite.Query?.orderAsc) {
      queries.push(Appwrite.Query.orderAsc("startDate"));
    }
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.upcomingEvents,
      queries
    );
    const documents = response.documents || [];
    const converted = await convertExpiredUpcomingEvents(documents);
    if (converted) {
      await loadUpcomingEvents();
      return;
    }
    upcomingCache = documents;
    renderUpcomingTable(upcomingCache);
    setFeedback(upcomingFeedback, "");
  } catch (error) {
    console.error(error);
    setFeedback(upcomingFeedback, "Unable to load upcoming events. Check Appwrite permissions.", true);
    upcomingTableBody.innerHTML = `<tr><td colspan="6">Unable to load upcoming events.</td></tr>`;
  }
};

const populateEventMetadataForm = (doc) => {
  if (!eventMetadataForm) return;
  eventMetadataForm.elements.name.value = doc.name || "";
  eventMetadataForm.elements.slug.value = doc.slug || doc.$id;
  eventMetadataForm.elements.date.value = doc.date ? doc.date.slice(0, 10) : "";
  eventMetadataForm.elements.impactCount.value = doc.impactCount ?? "";
  eventMetadataForm.elements.title.value = doc.title || "";
  eventMetadataForm.elements.description.value = doc.description || "";
  eventMetadataForm.elements.caption.value = doc.caption || "";
  eventMetadataForm.elements.coverFileId.value = doc.coverFileId || "";
  eventMetadataForm.elements.status.value = doc.status || "draft";
};

const startAlbumEdit = async (albumId) => {
  if (!eventMetadataForm) return;
  setFeedback(eventMetadataFeedback, "");
  try {
    let doc =
      eventsCache.find((item) => item.$id === albumId || item.slug === albumId) || null;
    if (!doc) {
      const { databases } = getClient();
      doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, albumId);
    }

    populateEventMetadataForm(doc);
    eventMetadataForm.dataset.mode = "edit";
    eventMetadataForm.dataset.albumId = doc.$id;
    if (eventMetadataSubmitBtn) {
      eventMetadataSubmitBtn.textContent = "Save changes";
    }
    if (eventMetadataCancelBtn) {
      eventMetadataCancelBtn.hidden = false;
    }
    if (slugInput) {
      slugInput.readOnly = true;
    }
    eventMetadataForm.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    setFeedback(eventMetadataFeedback, error?.message || "Unable to load album details.", true);
  }
};

const attachAlbumActionHandlers = () => {
  eventsTableBody.querySelectorAll("[data-manage-album]").forEach((btn) =>
    btn.addEventListener("click", () => openAlbumWorkspace(btn.dataset.manageAlbum))
  );
  eventsTableBody.querySelectorAll("[data-edit-album]").forEach((btn) =>
    btn.addEventListener("click", () => startAlbumEdit(btn.dataset.editAlbum))
  );
  eventsTableBody.querySelectorAll("[data-delete-album]").forEach((btn) =>
    btn.addEventListener("click", () => handleDeleteAlbum(btn.dataset.deleteAlbum))
  );
};

const loadEvents = async () => {
  const { databases } = getClient();
  setFeedback(eventMetadataFeedback, "");
  setFeedback(albumMediaFeedback, "");
  try {
    const response = await databases.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, [
      Appwrite.Query.orderDesc("$updatedAt")
    ]);
    eventsCache = response.documents;
    renderEventsTable(eventsCache);
  } catch (error) {
    console.error(error);
    setFeedback(eventMetadataFeedback, "Unable to load events. Check Appwrite permissions.", true);
  }
};

const volunteerTableBody = document.querySelector("#volunteers-table tbody");
const contactsTableBody = document.querySelector("#contacts-table tbody");
const refreshVolunteersBtn = document.getElementById("refresh-volunteers-btn");
const refreshContactsBtn = document.getElementById("refresh-contacts-btn");

const renderVolunteersTable = (documents = []) => {
  if (!volunteerTableBody) return;
  volunteerTableBody.innerHTML = "";
  if (!documents.length) {
    return;
  }
  documents.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Name">${doc.name || "—"}</td>
      <td data-label="Contact">
        <div class="table-contact">
          ${doc.email ? `<a href="mailto:${doc.email}">${doc.email}</a>` : "—"}
          ${doc.phone ? `<small>${doc.phone}</small>` : ""}
        </div>
      </td>
      <td data-label="City">${doc.location || "—"}</td>
      <td data-label="Interest">${doc.interest || "—"}</td>
      <td data-label="Submitted">${doc.$createdAt ? new Date(doc.$createdAt).toLocaleString() : "—"}</td>
    `;
    volunteerTableBody.appendChild(tr);
  });
};

const renderContactsTable = (documents = []) => {
  if (!contactsTableBody) return;
  contactsTableBody.innerHTML = "";
  if (!documents.length) {
    return;
  }
  documents.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Name">${doc.name || "—"}</td>
      <td data-label="Email">${doc.email ? `<a href="mailto:${doc.email}">${doc.email}</a>` : "—"}</td>
      <td data-label="Phone">${doc.phone || "—"}</td>
      <td data-label="Message">${doc.message || "—"}</td>
      <td data-label="Submitted">${doc.$createdAt ? new Date(doc.$createdAt).toLocaleString() : "—"}</td>
    `;
    contactsTableBody.appendChild(tr);
  });
};

const loadVolunteers = async () => {
  const { databases } = getClient();
  if (!volunteerTableBody) return;
  volunteerTableBody.innerHTML = "";
  try {
    const response = await databases.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.volunteers, [
      Appwrite.Query.orderDesc("$createdAt")
    ]);
    volunteersCache = response.documents;
    renderVolunteersTable(volunteersCache);
  } catch (error) {
    console.error(error);
    volunteerTableBody.innerHTML = "";
  }
};

const loadContacts = async () => {
  const { databases } = getClient();
  if (!contactsTableBody) return;
  contactsTableBody.innerHTML = "";
  try {
    const response = await databases.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.contactDetails, [
      Appwrite.Query.orderDesc("$createdAt")
    ]);
    contactsCache = response.documents;
    renderContactsTable(contactsCache);
  } catch (error) {
    console.error(error);
    contactsTableBody.innerHTML = "";
  }
};

refreshEventsBtn?.addEventListener("click", loadEvents);
refreshVolunteersBtn?.addEventListener("click", loadVolunteers);
refreshContactsBtn?.addEventListener("click", loadContacts);

const showPanel = (panelId) => {
  if (!panelId) return;
  activePanel = panelId;
  sectionPanels.forEach((section) => {
    if (section.id === panelId || section.id === "album-workspace") {
      section.hidden = false;
      section.removeAttribute("hidden");
    } else if (section.id !== "album-workspace") {
      section.hidden = true;
      section.setAttribute("hidden", "true");
    }
  });
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.panelTarget === panelId);
  });
  if (panelId === "published-section") {
    loadEvents();
  } else if (panelId === "upcoming-section" && !upcomingCache.length) {
    loadUpcomingEvents();
  } else if (panelId === "ongoing-section" && !ongoingCache.length) {
    loadOngoingProjects();
  } else if (panelId === "volunteer-section" && !volunteersCache.length) {
    loadVolunteers();
  } else if (panelId === "contacts-section" && !contactsCache.length) {
    loadContacts();
  }
  if (panelId !== "published-section") {
    toggleWorkspace(false);
  }
  const targetSection = document.getElementById(panelId);
  if (targetSection) {
    targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const target = link.dataset.panelTarget;
    showPanel(target);
  });
});

const toggleWorkspace = (visible) => {
  if (!albumWorkspace) return;
  albumWorkspace.hidden = !visible;
  if (!visible) {
    albumWorkspaceTitle.textContent = "Select an album to manage";
    albumWorkspaceSubtitle.textContent = "";
    albumWorkspaceStatus.textContent = "";
    albumWorkspaceUpdated.textContent = "";
    albumMediaList.innerHTML = "";
    albumMediaForm?.reset();
    setFormMode("create");
    activeAlbum = null;
  }
};

const renderAlbumMediaList = (entries = [], options = {}) => {
  const { preserveOrderState = false } = options;
  if (!albumMediaList) return;
  currentMediaEntries = entries;
  albumMediaList.innerHTML = "";
  if (entries.length === 0) {
    setMediaOrderDirty(false);
    updateReorderUI();
    return;
  }

  const canReorder = entries.length > 1;
  albumMediaList.classList.toggle("reorder-enabled", canReorder);

  entries.forEach((entry, index) => {
    const titleText = (entry.title || "").trim();
    const descriptionText = (entry.description || "").trim();
    const item = document.createElement("li");
    item.className = "album-media-card";
    item.dataset.index = index.toString();
    item.dataset.fileId = entry.fileId;
    item.draggable = canReorder;
    item.innerHTML = `
      <div class="album-media-card__handle" aria-hidden="true" title="Drag to reorder" role="presentation">
        <span></span>
        <span></span>
      </div>
      <figure>
        <img src="${storagePreviewUrl(entry.fileId)}" alt="${entry.title || entry.filename}" loading="lazy" />
      </figure>
      <div class="album-media-card__body">
        ${titleText ? `<strong>${titleText}</strong>` : ""}
        ${descriptionText ? `<p>${descriptionText}</p>` : ""}
        <small>${new Date(entry.uploadedAt).toLocaleString()}</small>
        <div class="album-media-card__actions">
          <button type="button" class="ghost-btn ghost-btn--small" data-edit-media="${entry.fileId}">Edit</button>
          <button type="button" class="ghost-btn ghost-btn--small ghost-btn--danger" data-delete-media="${entry.fileId}">Delete</button>
        </div>
      </div>
    `;
    albumMediaList.appendChild(item);
  });

  attachMediaActionHandlers();
  enableMediaDragAndDrop();
  if (!preserveOrderState) {
    setMediaOrderDirty(false);
  } else {
    updateReorderUI();
  }
};

const setMediaOrderDirty = (value) => {
  mediaOrderDirty = Boolean(value);
  updateReorderUI();
};

const updateReorderUI = () => {
  if (!albumMediaReorderActions) return;
  const shouldShow = mediaOrderDirty && (currentMediaEntries?.length || 0) > 1;
  albumMediaReorderActions.hidden = !shouldShow;
  if (!shouldShow && albumMediaOrderFeedback) {
    setFeedback(albumMediaOrderFeedback, "");
  }
};

const enableMediaDragAndDrop = () => {
  if (!albumMediaList) return;
  const cards = albumMediaList.querySelectorAll(".album-media-card");
  cards.forEach((card) => {
    card.addEventListener("dragstart", handleMediaDragStart);
    card.addEventListener("dragover", handleMediaDragOver);
    card.addEventListener("dragleave", handleMediaDragLeave);
    card.addEventListener("drop", handleMediaDrop);
    card.addEventListener("dragend", handleMediaDragEnd);
  });
};

const handleMediaDragStart = (event) => {
  dragStartIndex = Number(event.currentTarget.dataset.index);
  event.dataTransfer.effectAllowed = "move";
  event.currentTarget.classList.add("is-dragging");
};

const handleMediaDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("is-drag-over");
};

const handleMediaDragLeave = (event) => {
  event.currentTarget.classList.remove("is-drag-over");
};

const handleMediaDrop = (event) => {
  event.preventDefault();
  event.currentTarget.classList.remove("is-drag-over");
  const dropIndex = Number(event.currentTarget.dataset.index);
  if (Number.isNaN(dragStartIndex) || Number.isNaN(dropIndex) || dragStartIndex === dropIndex) {
    return;
  }
  reorderMediaEntries(dragStartIndex, dropIndex);
};

const handleMediaDragEnd = (event) => {
  event.currentTarget.classList.remove("is-dragging");
  dragStartIndex = null;
};

const reorderMediaEntries = (fromIndex, toIndex) => {
  if (!Array.isArray(currentMediaEntries)) return;
  const updated = [...currentMediaEntries];
  if (
    fromIndex < 0 ||
    fromIndex >= updated.length ||
    toIndex < 0 ||
    toIndex >= updated.length ||
    !updated.length
  ) {
    return;
  }
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  currentMediaEntries = updated;
  renderAlbumMediaList(updated, { preserveOrderState: true });
  setMediaOrderDirty(true);
};

albumMediaCancelOrderBtn?.addEventListener("click", () => {
  if (!activeAlbum) return;
  const entries = parseMediaEntries(activeAlbum.mediaEntries);
  currentMediaEntries = entries;
  renderAlbumMediaList(entries);
  setMediaOrderDirty(false);
});

albumMediaSaveOrderBtn?.addEventListener("click", async () => {
  if (!activeAlbum || !mediaOrderDirty) return;
  const { databases } = getClient();
  try {
    setFeedback(albumMediaOrderFeedback, "Saving new order…");
    const payload = {
      mediaEntries: JSON.stringify(currentMediaEntries),
      mediaFileIds: currentMediaEntries.map((entry) => entry.fileId),
      updatedAt: new Date().toISOString()
    };
    const updatedDoc = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.events,
      activeAlbum.slug,
      payload
    );
    activeAlbum = updatedDoc;
    setFeedback(albumMediaOrderFeedback, "Order updated.");
    setMediaOrderDirty(false);
    await loadEvents();
  } catch (error) {
    console.error(error);
    setFeedback(albumMediaOrderFeedback, error?.message || "Failed to save order.", true);
  }
});

const openAlbumWorkspace = async (slug) => {
  const { databases } = getClient();
  toggleWorkspace(true);
  albumWorkspaceTitle.textContent = "Loading album…";
  albumWorkspaceSubtitle.textContent = slug;
  setFeedback(albumMediaFeedback, "");
  setFormMode("create");

  try {
    const doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, slug);
    activeAlbum = doc;
    albumWorkspaceTitle.textContent = doc.title || doc.name;
    albumWorkspaceSubtitle.textContent = doc.description || "Add context to this gallery.";
    albumWorkspaceStatus.textContent = `Status: ${doc.status}`;
    albumWorkspaceUpdated.textContent = `Last updated: ${new Date(doc.updatedAt || doc.$updatedAt).toLocaleString()}`;
    renderAlbumMediaList(parseMediaEntries(doc.mediaEntries));
  } catch (error) {
    console.error(error);
    setFeedback(albumMediaFeedback, "Unable to load album. Please try again.", true);
  }
};

const storagePreviewUrl = (fileId) =>
  `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;

const attachMediaActionHandlers = () => {
  albumMediaList.querySelectorAll("[data-edit-media]").forEach((btn) =>
    btn.addEventListener("click", () => handleEditMedia(btn.dataset.editMedia))
  );
  albumMediaList.querySelectorAll("[data-delete-media]").forEach((btn) =>
    btn.addEventListener("click", () => handleDeleteMedia(btn.dataset.deleteMedia))
  );
};

const setFormMode = (mode, entry = null) => {
  const isEdit = mode === "edit" && entry;
  editingMediaId = isEdit ? entry.fileId : null;
  albumMediaSubmitBtn.textContent = isEdit ? "Save changes" : "Upload photo";
  albumMediaCancelBtn.hidden = !isEdit;
  albumMediaForm.mediaTitle.value = isEdit ? entry.title || "" : "";
  albumMediaForm.mediaDescription.value = isEdit ? entry.description || "" : "";
  albumMediaForm.mediaFile.value = "";
  albumMediaForm.makeCover.checked = false;
};

albumMediaCancelBtn?.addEventListener("click", () => {
  albumMediaForm.reset();
  setFormMode("create");
  setFeedback(albumMediaFeedback, "");
});

const handleEditMedia = (fileId) => {
  if (!activeAlbum) return;
  const entries = parseMediaEntries(activeAlbum.mediaEntries);
  const entry = entries.find((item) => item.fileId === fileId);
  if (!entry) {
    setFeedback(albumMediaFeedback, "Unable to find this media entry.", true);
    return;
  }
  setFormMode("edit", entry);
};

const handleDeleteMedia = async (fileId) => {
  if (!activeAlbum) return;
  if (!window.confirm("Delete this image from the album?")) return;

  setFeedback(albumMediaFeedback, "Deleting image…");
  const { databases, storage } = getClient();
  const entries = parseMediaEntries(activeAlbum.mediaEntries);
  const remainingEntries = entries.filter((entry) => entry.fileId !== fileId);

  try {
    await storage.deleteFile(APPWRITE_CONFIG.bucketId, fileId).catch(() => {
      console.warn("Unable to delete file", fileId);
    });

    const payload = {
      mediaEntries: JSON.stringify(remainingEntries),
      mediaFileIds: remainingEntries.map((entry) => entry.fileId),
      updatedAt: new Date().toISOString()
    };

    if (activeAlbum.coverFileId === fileId) {
      payload.coverFileId = remainingEntries[0]?.fileId || "";
    }

    const updatedDoc = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.events,
      activeAlbum.slug,
      payload
    );

    activeAlbum = updatedDoc;
    renderAlbumMediaList(remainingEntries);
    setFormMode("create");
    setFeedback(albumMediaFeedback, "Image removed.");
    await loadEvents();
  } catch (error) {
    console.error(error);
    setFeedback(albumMediaFeedback, error?.message || "Failed to delete image.", true);
  }
};

const handleDeleteAlbum = async (slug) => {
  if (!window.confirm("Delete this album and all associated media? This cannot be undone.")) {
    return;
  }

  setFeedback(eventMetadataFeedback, `Deleting "${slug}"…`);
  const { databases, storage } = getClient();

  try {
    const doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, slug);
    const entries = parseMediaEntries(doc.mediaEntries);

    await Promise.all(
      entries.map((entry) =>
        storage.deleteFile(APPWRITE_CONFIG.bucketId, entry.fileId).catch(() => {
          console.warn("Unable to delete file", entry.fileId);
        })
      )
    );

    await databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.events, slug);
    setFeedback(eventMetadataFeedback, "Album deleted.");

    if (activeAlbum?.slug === slug) {
      toggleWorkspace(false);
    }

    await loadEvents();
  } catch (error) {
    console.error(error);
    setFeedback(eventMetadataFeedback, error?.message || "Failed to delete album.", true);
  }
};

albumMediaForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeAlbum) {
    setFeedback(albumMediaFeedback, "Select an album by clicking Manage first.", true);
    return;
  }

  const formData = new FormData(albumMediaForm);
  const file = formData.get("mediaFile");
  const title = formData.get("mediaTitle")?.toString().trim() || "";
  const description = formData.get("mediaDescription")?.toString().trim() || "";
  const makeCover = formData.get("makeCover") === "on";

  const { storage, databases } = getClient();

  try {
    setFeedback(albumMediaFeedback, editingMediaId ? "Saving changes…" : "Uploading photo…");
    const entries = parseMediaEntries(activeAlbum.mediaEntries);
    let updatedEntries = [...entries];
    let targetEntryIndex = updatedEntries.findIndex((entry) => entry.fileId === editingMediaId);
    let fileId = editingMediaId;

    if (editingMediaId && targetEntryIndex === -1) {
      setFeedback(albumMediaFeedback, "Could not find media entry to update.", true);
      return;
    }

    let uploadedResponse = null;
    if (file instanceof File && file.size) {
      const fileIdRequest = Appwrite.ID.unique();
      const filePermissions = [Appwrite.Permission.read(Appwrite.Role.any())];
      if (currentAccount?.$id) {
        filePermissions.push(
          Appwrite.Permission.read(Appwrite.Role.user(currentAccount.$id)),
          Appwrite.Permission.update(Appwrite.Role.user(currentAccount.$id)),
          Appwrite.Permission.delete(Appwrite.Role.user(currentAccount.$id))
        );
      }
      uploadedResponse = await storage.createFile(APPWRITE_CONFIG.bucketId, fileIdRequest, file, filePermissions);
      const newFileId = uploadedResponse.$id;

      if (editingMediaId) {
        await storage.deleteFile(APPWRITE_CONFIG.bucketId, editingMediaId).catch(() => {
          console.warn("Unable to delete old file", editingMediaId);
        });
      }

      fileId = newFileId;
    } else if (!editingMediaId) {
      setFeedback(albumMediaFeedback, "Please choose an image file.", true);
      return;
    }

    if (editingMediaId) {
      updatedEntries[targetEntryIndex] = {
        ...updatedEntries[targetEntryIndex],
        fileId,
        filename: uploadedResponse?.name || updatedEntries[targetEntryIndex].filename,
        type: uploadedResponse?.mimeType || updatedEntries[targetEntryIndex].type,
        uploadedAt: uploadedResponse ? new Date().toISOString() : updatedEntries[targetEntryIndex].uploadedAt,
        title,
        description
      };
    } else {
      updatedEntries = [
        ...updatedEntries,
        {
          fileId,
          filename: uploadedResponse?.name || file.name,
          type: uploadedResponse?.mimeType || file.type,
          uploadedAt: new Date().toISOString(),
          title,
          description
        }
      ];
    }

    const mediaFileIds = updatedEntries.map((entry) => entry.fileId);

    const payload = {
      mediaEntries: JSON.stringify(updatedEntries),
      mediaFileIds,
      coverFileId: makeCover ? fileId : activeAlbum.coverFileId || fileId,
      updatedAt: new Date().toISOString()
    };

    const updatedDoc = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.events,
      activeAlbum.slug,
      payload
    );

    activeAlbum = updatedDoc;
    renderAlbumMediaList(updatedEntries);
    setFeedback(albumMediaFeedback, editingMediaId ? "Image updated." : "Photo uploaded.");
    albumMediaForm.reset();
    setFormMode("create");
    await loadEvents();
  } catch (error) {
    console.error(error);
    setFeedback(albumMediaFeedback, error?.message || "Upload failed.", true);
  }
});

const initDashboard = async () => {
  await requireSession();
  await loadEvents();
  await loadUpcomingEvents();
  await loadOngoingProjects();
  toggleWorkspace(false);
};

saveUpcomingBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  upsertUpcomingEvent();
});

upcomingCancelBtn?.addEventListener("click", () => {
  resetUpcomingForm();
  setFeedback(upcomingFeedback, "");
});

refreshUpcomingBtn?.addEventListener("click", loadUpcomingEvents);

saveOngoingBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  upsertOngoingProject();
});

ongoingCancelBtn?.addEventListener("click", () => {
  resetOngoingForm();
  setFeedback(ongoingFeedback, "");
});

refreshOngoingBtn?.addEventListener("click", loadOngoingProjects);

initDashboard();
