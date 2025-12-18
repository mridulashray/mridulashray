const SESSION_KEY = "mridulashrayAdminSession";
const loginRedirect = () => (window.location.href = "./login.html");
const sessionBadge = document.getElementById("admin-session-name");
const logoutBtn = document.getElementById("logout-btn");
const saveEventBtn = document.getElementById("save-event-btn");
const eventMetadataSubmitBtn = saveEventBtn;
const refreshEventsBtn = document.getElementById("refresh-events-btn");
const eventMetadataForm = document.getElementById("event-metadata-form");
const eventMetadataFeedback = document.getElementById("event-metadata-feedback");
const eventMetadataCancelBtn = document.getElementById("event-metadata-cancel");
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
let currentMediaEntries = [];
let mediaOrderDirty = false;
let dragStartIndex = null;

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
    loginRedirect();
  } catch (error) {
    console.error("Logout error", error);
  }
  localStorage.removeItem(SESSION_KEY);
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
    eventsTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No albums created yet. Use the form above to start.</td></tr>`;
    return;
  }

  events.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${doc.title || doc.name || "Untitled"}</td>
      <td>${doc.slug}</td>
      <td><span class="badge badge--${doc.status === "published" ? "success" : "muted"}">${doc.status}</span></td>
      <td>${doc.startDate ? new Date(doc.startDate).toLocaleDateString() : "-"}</td>
      <td>${doc.mediaFileIds?.length || 0}</td>
      <td class="admin-actions-cell">
        <button class="ghost-btn ghost-btn--small" data-edit-album="${doc.$id}">Edit</button>
        <button class="ghost-btn ghost-btn--small" data-manage-album="${doc.$id}">Manage</button>
        <button class="ghost-btn ghost-btn--small ghost-btn--danger" data-delete-album="${doc.$id}">Delete</button>
      </td>
    `;
    eventsTableBody.appendChild(tr);
  });

  attachAlbumActionHandlers();
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

refreshEventsBtn?.addEventListener("click", loadEvents);

const toggleWorkspace = (visible) => {
  if (!albumWorkspace) return;
  albumWorkspace.hidden = !visible;
  if (!visible) {
    albumWorkspaceTitle.textContent = "Select an album to manage";
    albumWorkspaceSubtitle.textContent = "Choose “Manage” from the table above to start uploading photos inside an album.";
    albumWorkspaceStatus.textContent = "";
    albumWorkspaceUpdated.textContent = "";
    albumMediaList.innerHTML = `<li class="empty-state">No uploads yet. Add your first image using the form on the right.</li>`;
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
    albumMediaList.innerHTML = `<li class="empty-state">No uploads yet. Add your first image using the form on the right.</li>`;
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
  toggleWorkspace(false);
};

initDashboard();
