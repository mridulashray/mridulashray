(() => {
  if (window.__mridEventsInit) return;
  window.__mridEventsInit = true;

  const eventsGridEl = document.getElementById("events-gallery-grid");
  const eventsEmptyEl = document.getElementById("events-gallery-empty");
  const photoWallGridEl = document.getElementById("events-photo-wall-grid");
  const photoWallEmptyEl = document.getElementById("events-photo-wall-empty");
  const highlightGridEl = document.getElementById("events-highlight-grid");
  const highlightEmptyEl = document.getElementById("events-highlight-empty");
  const counters = {
    events: document.getElementById("events-count"),
    photos: document.getElementById("events-photos-count"),
    impact: document.getElementById("events-impact-count")
  };

  const modalEl = document.getElementById("album-modal");
  const modalBackdropEl = document.getElementById("album-modal-backdrop");
  const modalCloseBtn = document.getElementById("album-modal-close");
  const modalTitleEl = document.getElementById("album-modal-title");
  const modalStatusEl = document.getElementById("album-modal-status");
  const modalDateEl = document.getElementById("album-modal-date");
  const modalDescriptionEl = document.getElementById("album-modal-description");
  const modalMetaEl = document.getElementById("album-modal-meta");
  const modalGalleryEl = document.getElementById("album-modal-gallery");
  const modalEmptyEl = document.getElementById("album-modal-empty");

  const STORAGE_BASE = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files`;
  const albumsCache = new Map();
  let currentAlbumSlug = null;

  const storagePreviewUrl = (fileId) => `${STORAGE_BASE}/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;

  const ensureAppwriteClient = () => {
    if (!window.appwrite && typeof Appwrite !== "undefined") {
      const client = new Appwrite.Client().setEndpoint(APPWRITE_CONFIG.endpoint).setProject(APPWRITE_CONFIG.projectId);
      window.appwrite = {
        client,
        account: new Appwrite.Account(client),
        databases: new Appwrite.Databases(client),
        storage: new Appwrite.Storage(client)
      };
    }
    return window.appwrite;
  };

  const renderEvents = (documents = []) => {
    if (!eventsGridEl) return;
    eventsGridEl.innerHTML = "";
    if (documents.length === 0) {
      eventsEmptyEl?.classList.remove("hidden");
      return;
    }
    eventsEmptyEl?.classList.add("hidden");
    documents.forEach((doc) => {
      const coverId = doc.coverFileId || doc.mediaFileIds?.[0];
      const card = document.createElement("article");
      card.className = "event-card";
      card.dataset.albumSlug = doc.slug || doc.$id;
      card.innerHTML = `
        <figure>
          ${
            coverId
              ? `<img src="${storagePreviewUrl(coverId)}" alt="${doc.title || doc.name}" loading="lazy" />`
              : `<div class="event-card__placeholder">Album upload pending</div>`
          }
        </figure>
        <div class="event-card__body">
          <h3>${doc.title || doc.name}</h3>
          <p>${doc.description || ""}</p>
          <p class="event-card__meta">
            ${doc.date ? new Date(doc.date).toLocaleDateString() : "Date TBC"} · ${
        doc.impactCount ? `${doc.impactCount} beneficiaries` : "Impact TBC"
      }
          </p>
        </div>
      `;
      eventsGridEl.appendChild(card);
    });
  };

  const toMediaEntries = (doc) => {
    const entries = doc.mediaEntries;
    if (!entries) return [];
    if (Array.isArray(entries)) return entries;
    try {
      return JSON.parse(entries);
    } catch {
      return [];
    }
  };

  const renderPhotoWall = (documents = []) => {
    if (!photoWallGridEl) return;
    const allEntries = documents.flatMap((doc) =>
      toMediaEntries(doc).map((entry) => ({
        ...entry,
        eventTitle: doc.title || doc.name,
        eventSlug: doc.slug
      }))
    );

    photoWallGridEl.innerHTML = "";

    if (allEntries.length === 0) {
      photoWallEmptyEl?.classList.remove("hidden");
      return;
    }
    photoWallEmptyEl?.classList.add("hidden");

    const loopEntries = [...allEntries, ...allEntries];

    loopEntries.forEach((entry) => {
      const card = document.createElement("figure");
      card.className = "events-photo-wall__item";
      card.innerHTML = `
        <img src="${storagePreviewUrl(entry.fileId)}" alt="${entry.filename}" loading="lazy" />
        <figcaption>${entry.eventTitle}</figcaption>
      `;
      photoWallGridEl.appendChild(card);
    });
  };

  const renderHighlights = (documents = []) => {
    if (!highlightGridEl) return;
    highlightGridEl.innerHTML = "";

    if (documents.length === 0) {
      highlightEmptyEl?.classList.remove("hidden");
      return;
    }
    highlightEmptyEl?.classList.add("hidden");

    documents.slice(0, 3).forEach((doc) => {
      const coverId = doc.coverFileId || doc.mediaFileIds?.[0];
      const article = document.createElement("article");
      article.className = "events-highlight__story";
      article.innerHTML = `
        ${
          coverId
            ? `<img src="${storagePreviewUrl(coverId)}" alt="${doc.title || doc.name}" loading="lazy" />`
            : `<div class="event-card__placeholder">Upload cover to visualise highlight</div>`
        }
        <div>
          <h3>${doc.title || doc.name}</h3>
          <p>${doc.description || ""}</p>
          ${doc.caption ? `<p class="event-card__meta">“${doc.caption}”</p>` : ""}
        </div>
      `;
      highlightGridEl.appendChild(article);
    });
  };

  const setCounters = (documents = []) => {
    if (!counters.events || !counters.photos || !counters.impact) return;
    const totalEvents = documents.length;
    const totalPhotos = documents.reduce((sum, doc) => sum + (doc.mediaFileIds?.length || 0), 0);
    const totalImpact = documents.reduce((sum, doc) => sum + (doc.impactCount || 0), 0);
    counters.events.textContent = totalEvents.toString();
    counters.photos.textContent = totalPhotos.toString();
    counters.impact.textContent = totalImpact.toString();
  };

  const closeAlbumModal = () => {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.classList.remove("is-visible");
    document.body.classList.remove("album-modal-open");
    currentAlbumSlug = null;
  };

  const handleEscClose = (event) => {
    if (event.key === "Escape") {
      closeAlbumModal();
    }
  };

  const renderAlbumGallery = (entries = []) => {
    if (!modalGalleryEl || !modalEmptyEl) return;
    modalGalleryEl.innerHTML = "";
    if (!entries.length) {
      modalEmptyEl.hidden = false;
      return;
    }
    modalEmptyEl.hidden = true;
    entries.forEach((entry) => {
      const figure = document.createElement("figure");
      figure.className = "album-modal__figure";
      figure.innerHTML = `
        <img src="${storagePreviewUrl(entry.fileId)}" alt="${entry.title || entry.filename || "Event photo"}" loading="lazy" />
        ${
          entry.title || entry.description
            ? `<figcaption>
                ${entry.title ? `<strong>${entry.title}</strong>` : ""}
                ${entry.description ? `<p>${entry.description}</p>` : ""}
              </figcaption>`
            : ""
        }
      `;
      modalGalleryEl.appendChild(figure);
    });
  };

  const renderAlbumMeta = (doc) => {
    if (!modalMetaEl) return;
    const metaItems = [];
    if (doc.impactCount) {
      metaItems.push(`<span><strong>${doc.impactCount}</strong> beneficiaries</span>`);
    }
    if (doc.caption) {
      metaItems.push(`<span>"${doc.caption}"</span>`);
    }
    if (doc.mediaFileIds?.length) {
      metaItems.push(`<span>${doc.mediaFileIds.length} photos</span>`);
    }
    modalMetaEl.innerHTML = metaItems.length ? metaItems.join("") : "";
  };

  const openAlbumModal = (slug) => {
    if (!modalEl || !albumsCache.has(slug)) return;
    const doc = albumsCache.get(slug);
    currentAlbumSlug = slug;
    modalTitleEl.textContent = doc.title || doc.name || "Untitled album";
    modalStatusEl.textContent = (doc.status || "Published").toUpperCase();
    modalStatusEl.classList.toggle("petal-badge--draft", (doc.status || "").toLowerCase() !== "published");
    modalDateEl.textContent = doc.date ? new Date(doc.date).toLocaleDateString() : "";
    modalDescriptionEl.textContent = doc.description || "This album is being curated.";
    renderAlbumMeta(doc);
    renderAlbumGallery(toMediaEntries(doc));
    modalEl.setAttribute("aria-hidden", "false");
    modalEl.classList.add("is-visible");
    document.body.classList.add("album-modal-open");
  };

  const loadPublishedEvents = async () => {
    const appwriteClient = ensureAppwriteClient();
    if (!appwriteClient?.databases) {
      console.warn("Appwrite client unavailable. Ensure CDN script and appwrite-config.js are loaded.");
      return;
    }

    const queries = [];
    if (typeof Appwrite !== "undefined" && Appwrite.Query?.orderDesc) {
      queries.push(Appwrite.Query.orderDesc("$updatedAt"));
    }

    try {
      const response = await appwriteClient.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.events,
        queries
      );
      const documents = response.documents || [];
      albumsCache.clear();
      documents.forEach((doc) => {
        const key = doc.slug || doc.$id;
        if (key) {
          albumsCache.set(key, doc);
        }
      });
      const publishedDocs = documents.filter((doc) => {
        const status =
          (doc.status || doc.Status || doc.publishStatus || doc.Published || "").toString().toLowerCase();
        return status === "published";
      });

      const docsToRender = publishedDocs.length ? publishedDocs : documents;
      renderEvents(docsToRender);
      renderPhotoWall(docsToRender);
      renderHighlights(docsToRender);
      setCounters(docsToRender);
    } catch (error) {
      console.error("Unable to fetch events", error);
      eventsEmptyEl?.classList.remove("hidden");
      if (eventsEmptyEl) {
        eventsEmptyEl.textContent = "Unable to fetch events right now. Please try again later.";
      }
    }
  };

  loadPublishedEvents();

  eventsGridEl?.addEventListener("click", (event) => {
    const card = event.target.closest(".event-card");
    if (!card?.dataset.albumSlug) return;
    openAlbumModal(card.dataset.albumSlug);
  });

  modalCloseBtn?.addEventListener("click", closeAlbumModal);
  modalBackdropEl?.addEventListener("click", closeAlbumModal);
  document.addEventListener("keydown", handleEscClose);
})();
