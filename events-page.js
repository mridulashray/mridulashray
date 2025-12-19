(() => {
  if (window.__mridEventsInit) return;
  window.__mridEventsInit = true;

  const eventsGridEl = document.getElementById("events-gallery-grid");
  const eventsEmptyEl = document.getElementById("events-gallery-empty");
  const photoWallGridEl = document.getElementById("events-photo-wall-grid");
  const photoWallViewportEl = document.querySelector(".events-photo-wall__viewport");
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

  let appwriteInitPromise = null;
  const ensureAppwriteClient = async () => {
    if (window.appwrite && window.appwrite.databases) {
      return window.appwrite;
    }

    const instantiate = () => {
      const client = new Appwrite.Client().setEndpoint(APPWRITE_CONFIG.endpoint).setProject(APPWRITE_CONFIG.projectId);
      window.appwrite = {
        client,
        account: new Appwrite.Account(client),
        databases: new Appwrite.Databases(client),
        storage: new Appwrite.Storage(client)
      };
      return window.appwrite;
    };

    if (typeof Appwrite !== "undefined") {
      return instantiate();
    }

    if (!appwriteInitPromise) {
      appwriteInitPromise = new Promise((resolve, reject) => {
        const maxAttempts = 50;
        let attempts = 0;
        const interval = setInterval(() => {
          attempts += 1;
          if (typeof Appwrite !== "undefined") {
            clearInterval(interval);
            try {
              resolve(instantiate());
            } catch (error) {
              reject(error);
            }
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error("Appwrite SDK failed to load."));
          }
        }, 80);
      });
    }

    try {
      return await appwriteInitPromise;
    } catch (error) {
      appwriteInitPromise = null;
      throw error;
    }
  };

  const renderEvents = (documents = []) => {
    if (!eventsGridEl) return;
    eventsGridEl.innerHTML = "";
    const isCompact = documents.length > 0 && documents.length < 3;
    if (eventsGridEl.classList) {
      eventsGridEl.classList.toggle("events-gallery__grid--compact", isCompact);
    }
    if (documents.length === 0) {
      if (eventsEmptyEl && eventsEmptyEl.classList) {
        eventsEmptyEl.classList.remove("hidden");
      }
      return;
    }
    if (eventsEmptyEl && eventsEmptyEl.classList) {
      eventsEmptyEl.classList.add("hidden");
    }
    documents.forEach((doc) => {
      const mediaFiles = Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds : [];
      const coverId = doc.coverFileId || mediaFiles[0];
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
    const allEntries = [];
    documents.forEach((doc) => {
      const mediaEntries = toMediaEntries(doc);
      mediaEntries.forEach((entry) => {
        allEntries.push({
          ...entry,
          eventTitle: doc.title || doc.name,
          eventSlug: doc.slug
        });
      });
    });

    photoWallGridEl.innerHTML = "";

    if (allEntries.length === 0) {
      if (photoWallEmptyEl && photoWallEmptyEl.classList) {
        photoWallEmptyEl.classList.remove("hidden");
      }
      if (photoWallViewportEl && photoWallViewportEl.classList) {
        photoWallViewportEl.classList.add("is-empty");
      }
      return;
    }
    if (photoWallEmptyEl && photoWallEmptyEl.classList) {
      photoWallEmptyEl.classList.add("hidden");
    }
    if (photoWallViewportEl && photoWallViewportEl.classList) {
      photoWallViewportEl.classList.remove("is-empty");
    }

    const shouldLoop = allEntries.length >= 6;
    const entriesToRender = shouldLoop ? [...allEntries, ...allEntries] : allEntries;
    if (photoWallGridEl.classList) {
      photoWallGridEl.classList.toggle("is-looping", shouldLoop);
      photoWallGridEl.classList.toggle("is-compact", !shouldLoop);
    }

    entriesToRender.forEach((entry) => {
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

    const isCompact = documents.length > 0 && documents.length < 3;
    if (highlightGridEl.classList) {
      highlightGridEl.classList.toggle("events-highlight__grid--compact", isCompact);
    }

    if (documents.length === 0) {
      if (highlightEmptyEl && highlightEmptyEl.classList) {
        highlightEmptyEl.classList.remove("hidden");
      }
      return;
    }
    if (highlightEmptyEl && highlightEmptyEl.classList) {
      highlightEmptyEl.classList.add("hidden");
    }

    documents.slice(0, 3).forEach((doc) => {
      const mediaFiles = Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds : [];
      const coverId = doc.coverFileId || mediaFiles[0];
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
    const totalPhotos = documents.reduce(
      (sum, doc) => sum + ((doc.mediaFileIds && doc.mediaFileIds.length) || 0),
      0
    );
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
    if (doc.mediaFileIds && doc.mediaFileIds.length) {
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
    let appwriteClient = null;
    try {
      appwriteClient = await ensureAppwriteClient();
    } catch (error) {
      console.warn("Appwrite SDK not ready yet.", error);
    }

    if (!appwriteClient || !appwriteClient.databases) {
      if (eventsEmptyEl && eventsEmptyEl.classList) {
        eventsEmptyEl.classList.remove("hidden");
        eventsEmptyEl.textContent = "Loading events… please check your connection.";
      }
      return;
    }

    const queries = [];
    if (typeof Appwrite !== "undefined" && Appwrite.Query && typeof Appwrite.Query.orderDesc === "function") {
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
      if (eventsEmptyEl && eventsEmptyEl.classList) {
        eventsEmptyEl.classList.remove("hidden");
        eventsEmptyEl.textContent = "Unable to fetch events right now. Please try again later.";
      }
    }
  };

  loadPublishedEvents();

  if (eventsGridEl) {
    eventsGridEl.addEventListener("click", (event) => {
      const card = event.target.closest(".event-card");
      if (!card || !card.dataset || !card.dataset.albumSlug) return;
      openAlbumModal(card.dataset.albumSlug);
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeAlbumModal);
  }
  if (modalBackdropEl) {
    modalBackdropEl.addEventListener("click", closeAlbumModal);
  }
  document.addEventListener("keydown", handleEscClose);
})();
