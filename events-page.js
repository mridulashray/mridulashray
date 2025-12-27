(() => {
  if (window.__mridEventsInit) return;
  window.__mridEventsInit = true;

  const eventsGridEl = document.getElementById("events-gallery-grid");
  const photoWallGridEl = document.getElementById("events-photo-wall-grid");
  const photoWallViewportEl = document.querySelector(".events-photo-wall__viewport");
  const highlightGridEl = document.getElementById("events-highlight-grid");
  const upcomingGridEl = document.getElementById("upcoming-events-grid");
  const upcomingEmptyEl = document.getElementById("upcoming-events-empty");
  const eventsPortalEl = document.getElementById("events-navigation");
  const portalTabs = eventsPortalEl ? Array.from(eventsPortalEl.querySelectorAll(".events-portal__tab")) : [];
  const portalPanels = eventsPortalEl ? Array.from(eventsPortalEl.querySelectorAll(".events-portal__panel")) : [];
  const projectSubtabs = eventsPortalEl ? Array.from(eventsPortalEl.querySelectorAll(".events-portal__subtab")) : [];
  const projectSubpanels = eventsPortalEl ? Array.from(eventsPortalEl.querySelectorAll(".events-portal__subpanel")) : [];
  const organisedListEl = document.getElementById("organised-events-list");
  const organisedEmptyEl = document.getElementById("organised-events-empty");
  const navAlbumLists = document.querySelectorAll("[data-nav-events-list]");
  const NAV_ALBUM_HASH_PREFIX = "#album-";

  const getAlbumSlugFromHash = (hash) => {
    if (!hash || typeof hash !== "string") return null;
    return hash.startsWith(NAV_ALBUM_HASH_PREFIX) ? hash.slice(NAV_ALBUM_HASH_PREFIX.length) : null;
  };

  let deferredNavAlbumSlug = getAlbumSlugFromHash(window.location.hash);
  const redirectToAlbumPage = (slug) => {
    if (!slug) return;
    const targetUrl = `event-album.html?album=${encodeURIComponent(slug)}`;
    window.location.href = targetUrl;
  };
  const collapseNavDropdowns = () => {
    document.querySelectorAll(".nav-item--open").forEach((item) => {
      item.classList.remove("nav-item--open");
      const trigger = item.querySelector("[data-nav-trigger]");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  };
  const collapseMobileNav = () => {
    const navToggleBtn = document.querySelector(".nav-toggle");
    const mainNavEl = document.querySelector(".main-nav");
    document.body.classList.remove("nav-open");
    if (mainNavEl) {
      mainNavEl.classList.remove("is-open", "is-closing");
    }
    if (navToggleBtn) {
      navToggleBtn.setAttribute("aria-expanded", "false");
    }
  };
  const closeGlobalNav = () => {
    collapseNavDropdowns();
    collapseMobileNav();
  };
  const handleDeferredNavAlbum = () => {
    if (!deferredNavAlbumSlug) return;
    redirectToAlbumPage(deferredNavAlbumSlug);
    deferredNavAlbumSlug = null;
  };
  const onNavAlbumLinkClick = (event) => {
    const link = event.target.closest("a[data-album-slug]");
    if (!link) return;
    const slug = link.dataset.albumSlug || getAlbumSlugFromHash(link.getAttribute("href"));
    if (!slug) return;
    event.preventDefault();
    closeGlobalNav();
    redirectToAlbumPage(slug);
  };
  const VOLUNTEER_PAGE_URL = "volunteer.html";

  const renderUpcomingInvites = (documents = []) => {
    if (!upcomingGridEl) return;
    upcomingGridEl.innerHTML = "";
    if (!documents.length) {
      if (upcomingEmptyEl) {
        upcomingEmptyEl.style.display = "block";
        upcomingEmptyEl.textContent = "Upcoming events will appear here once announced.";
      }
      return;
    }
    if (upcomingEmptyEl) {
      upcomingEmptyEl.style.display = "none";
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    documents.forEach((doc) => {
      const card = document.createElement("article");
      card.className = "upcoming-card";
      const startParts = formatDateParts(doc.startDate);
      const startComparable = toComparableDate(doc.startDate);
      const isToday = startComparable ? startComparable.toDateString() === today.toDateString() : false;
      const posterMarkup = doc.posterFileId
        ? `<img class="upcoming-card__poster" src="${storagePreviewUrl(doc.posterFileId)}" alt="${doc.title}" loading="lazy" />`
        : "";
      const volunteerNeeded = String(doc.status || "").toLowerCase() === "needs-volunteers";
      const volunteerCta = volunteerNeeded
        ? `<div class="upcoming-card__cta">
              <a href="${VOLUNTEER_PAGE_URL}" target="_blank" rel="noopener">
                Be a volunteer for this event
                <span aria-hidden="true">→</span>
              </a>
            </div>`
        : "";
      card.innerHTML = `
        ${posterMarkup}
        <div class="upcoming-card__date">
          <div class="upcoming-card__date-badge">
            <strong>${startParts.day}</strong>
            <span>${startParts.month}</span>
          </div>
          <div>
            <p class="upcoming-card__date-tag ${isToday ? "is-today" : ""}">${isToday ? "Today" : "Save the date"}</p>
            <p>${formatDurationLabel(doc.startDate, doc.endDate)}</p>
          </div>
        </div>
        <div>
          <h3>${doc.title}</h3>
          <p>${doc.description || ""}</p>
          <p class="upcoming-card__location">${doc.location || "Location to be announced"}</p>
        </div>
        ${volunteerCta}
      `;
      upcomingGridEl.appendChild(card);
    });
  };

  const pad2 = (value) => value.toString().padStart(2, "0");
  const MONTH_LOOKUP = {
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
      const monthValue = MONTH_LOOKUP[monthKey];
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

  const formatDateParts = (dateString) => {
    const parsed = toComparableDate(dateString);
    if (!parsed) return { day: "--", month: "TBD" };
    return {
      day: parsed.getDate().toString().padStart(2, "0"),
      month: parsed.toLocaleString("en-US", { month: "short" }).toUpperCase()
    };
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
    if (start) return `${start.toLocaleDateString()} onwards`;
    if (end) return `Until ${end.toLocaleDateString()}`;
    if (startDate && endDate) return `${startDate} → ${endDate}`;
    return startDate || endDate || "Date to be announced";
  };

  const filterUpcomingDocuments = (documents = []) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return documents
      .filter((doc) => {
        const endComparable = toComparableDate(doc.endDate);
        if (!doc.endDate || !endComparable) return true;
        const endOfDay = new Date(endComparable);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay >= today;
      })
      .sort((a, b) => {
        const aDate = toComparableDate(a.startDate) || toComparableDate(a.endDate);
        const bDate = toComparableDate(b.startDate) || toComparableDate(b.endDate);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.getTime() - bDate.getTime();
      });
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

  const STORAGE_BASE = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files`;
  const albumsCache = new Map();
  let currentAlbumSlug = null;

  const storagePreviewUrl = (fileId) => `${STORAGE_BASE}/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;

  let appwriteInitPromise = null;
  let anonymousSessionPromise = null;
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

  const ensureAnonymousSession = async (appwriteClient) => {
    if (!appwriteClient || !appwriteClient.account) return null;
    try {
      await appwriteClient.account.get();
      return null;
    } catch (error) {
      const isAuthError = Number(error?.code) === 401 || (error?.type || "").includes("unauthorized");
      if (!isAuthError) {
        throw error;
      }
    }

    if (!anonymousSessionPromise) {
      anonymousSessionPromise = appwriteClient.account.createAnonymousSession().catch((error) => {
        anonymousSessionPromise = null;
        throw error;
      });
    }

    return anonymousSessionPromise;
  };

  const renderEvents = (documents = []) => {
    if (!eventsGridEl) return;
    eventsGridEl.innerHTML = "";
    const isCompact = documents.length > 0 && documents.length < 3;
    if (eventsGridEl.classList) {
      eventsGridEl.classList.toggle("events-gallery__grid--compact", isCompact);
    }
    if (documents.length === 0) {
      updateOrganisedEventsList(documents);
      return;
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
              : `<div class="event-card__placeholder" aria-hidden="true"></div>`
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
          <button class="event-card__cta" type="button">View more</button>
        </div>
      `;
      eventsGridEl.appendChild(card);
    });
    updateOrganisedEventsList(documents);
  };

  const updateOrganisedEventsList = (documents = []) => {
    if (!organisedListEl) return;
    organisedListEl.innerHTML = "";
    if (!documents.length) {
      if (organisedEmptyEl) {
        organisedEmptyEl.textContent = "Published albums will auto-populate here.";
      }
      const placeholder = document.createElement("li");
      placeholder.className = "events-portal__list-item is-placeholder";
      placeholder.textContent = "No published albums yet.";
      organisedListEl.appendChild(placeholder);
      return;
    }
    if (organisedEmptyEl) {
      organisedEmptyEl.textContent = "";
    }
    const fragment = document.createDocumentFragment();
    documents.forEach((doc) => {
      const slug = doc.slug || doc.$id;
      if (!slug) return;
      const li = document.createElement("li");
      li.className = "events-portal__list-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "events-portal__list-link";
      button.textContent = doc.title || doc.name || "Untitled album";
      button.dataset.albumSlug = slug;
      li.appendChild(button);
      fragment.appendChild(li);
    });
    organisedListEl.appendChild(fragment);
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

  const dedupeEntriesByFileId = (entries = []) => {
    const map = new Map();
    entries.forEach((entry) => {
      if (!entry || !entry.fileId || map.has(entry.fileId)) return;
      map.set(entry.fileId, entry);
    });
    return Array.from(map.values());
  };

  const curatePhotoWallEntries = (entries = []) => {
    if (!entries.length) return [];
    const buckets = new Map();
    entries.forEach((entry) => {
      const key = entry.eventSlug || entry.eventTitle || entry.fileId;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      const bucket = buckets.get(key);
      if (bucket.length < 2) {
        bucket.push(entry);
      }
    });
    const bucketList = Array.from(buckets.values()).sort(() => Math.random() - 0.5);
    const result = [];
    let index = 0;
    let added = true;
    while (added) {
      added = false;
      bucketList.forEach((bucket) => {
        if (bucket[index]) {
          result.push(bucket[index]);
          added = true;
        }
      });
      index += 1;
    }
    return result.length ? result : entries;
  };

  const renderPhotoWall = (documents = []) => {
    if (!photoWallGridEl) return;
    const allEntries = [];
    documents.forEach((doc) => {
      const mediaEntries = toMediaEntries(doc);
      const fallbackId = doc.coverFileId || (Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds[0] : null);
      const normalizedEntries = mediaEntries.length
        ? mediaEntries
        : fallbackId
          ? [
              {
                fileId: fallbackId,
                filename: doc.title || doc.name || "Event photo"
              }
            ]
          : [];
      normalizedEntries.forEach((entry) => {
        if (!entry?.fileId) return;
        allEntries.push({
          ...entry,
          eventTitle: doc.title || doc.name,
          eventSlug: doc.slug
        });
      });
    });

    photoWallGridEl.innerHTML = "";

    const dedupedEntries = dedupeEntriesByFileId(allEntries);
    if (!dedupedEntries.length) {
      if (photoWallViewportEl && photoWallViewportEl.classList) {
        photoWallViewportEl.classList.add("is-empty");
      }
      return;
    }
    const curatedEntries = curatePhotoWallEntries(dedupedEntries);

    if (photoWallViewportEl && photoWallViewportEl.classList) {
      photoWallViewportEl.classList.remove("is-empty");
    }

    const shouldLoop = curatedEntries.length >= 6;
    const entriesToRender = shouldLoop ? [...curatedEntries, ...curatedEntries] : curatedEntries;
    if (photoWallGridEl.classList) {
      photoWallGridEl.classList.toggle("is-looping", shouldLoop);
      photoWallGridEl.classList.toggle("is-compact", !shouldLoop);
    }

    entriesToRender.forEach((entry) => {
      const card = document.createElement("figure");
      card.className = "events-photo-wall__item";
      card.innerHTML = `
        <img src="${storagePreviewUrl(entry.fileId)}" alt="${entry.eventTitle || entry.filename}" loading="lazy" />
      `;
      photoWallGridEl.appendChild(card);
    });
  };

  const highlightSliderControllers = new Set();

  const resetHighlightSlides = () => {
    highlightSliderControllers.forEach((controller) => {
      if (controller.intervalId) {
        window.clearInterval(controller.intervalId);
      }
    });
    highlightSliderControllers.clear();
  };

  const initHighlightSlides = () => {
    if (!highlightGridEl) return;
    const sliderEls = highlightGridEl.querySelectorAll(".events-highlight__slider");
    sliderEls.forEach((slider) => {
      const slides = slider.querySelectorAll(".events-highlight__slide");
      if (slides.length <= 1) return;
      const dots = slider.querySelectorAll(".events-highlight__dot");
      let currentIndex = 0;

      const setActiveSlide = (index) => {
        slides.forEach((slide, idx) => {
          slide.classList.toggle("is-active", idx === index);
        });
        dots.forEach((dot, idx) => {
          dot.classList.toggle("is-active", idx === index);
        });
      };

      const controller = { intervalId: null };
      const intervalDuration = Number(slider.dataset.slideInterval) || 2600;

      const startLoop = () => {
        controller.intervalId = window.setInterval(() => {
          currentIndex = (currentIndex + 1) % slides.length;
          setActiveSlide(currentIndex);
        }, intervalDuration);
      };

      dots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
          currentIndex = idx;
          setActiveSlide(currentIndex);
          if (controller.intervalId) {
            window.clearInterval(controller.intervalId);
          }
          startLoop();
        });
      });

      setActiveSlide(0);
      startLoop();
      highlightSliderControllers.add(controller);
    });
  };

  const renderHighlights = (documents = []) => {
    if (!highlightGridEl) return;
    resetHighlightSlides();
    highlightGridEl.innerHTML = "";

    const isCompact = documents.length > 0 && documents.length < 3;
    if (highlightGridEl.classList) {
      highlightGridEl.classList.toggle("events-highlight__grid--compact", isCompact);
    }

    if (documents.length === 0) {
      return;
    }

    const highlightCount = Math.min(documents.length, 4);
    documents.slice(0, highlightCount).forEach((doc) => {
      const mediaFiles = Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds.filter(Boolean) : [];
      const coverId = doc.coverFileId || mediaFiles[0];
      const imageIds = mediaFiles.length ? mediaFiles : coverId ? [coverId] : [];
      const article = document.createElement("article");
      article.className = "events-highlight__story";
      const sliderMarkup = imageIds.length
        ? `
        <div class="events-highlight__slider" data-slide-interval="2600">
          <div class="events-highlight__slides">
            ${imageIds
              .map(
                (fileId, index) => `
              <figure class="events-highlight__slide ${index === 0 ? "is-active" : ""}" data-slide-index="${index}">
                <img src="${storagePreviewUrl(fileId)}" alt="${doc.title || doc.name} slide ${index + 1}" loading="lazy" />
              </figure>
            `
              )
              .join("")}
          </div>
          ${
            imageIds.length > 1
              ? `<div class="events-highlight__dots">
                ${imageIds
                  .map(
                    (_, index) => `<button class="events-highlight__dot ${index === 0 ? "is-active" : ""}" type="button" aria-label="Show slide ${index + 1}"></button>`
                  )
                  .join("")}
              </div>`
              : ""
          }
        </div>
      `
        : "";
      article.innerHTML = `
        <div class="events-highlight__content">
          <p class="events-highlight__eyebrow">Stories in Focus</p>
          <h3>${doc.title || doc.name}</h3>
          ${
            doc.description
              ? `<p class="events-highlight__description">${doc.description}</p>`
              : ""
          }
          ${
            doc.caption
              ? `<p class="events-highlight__quote">“${doc.caption}”</p>`
              : ""
          }
        </div>
        ${sliderMarkup}
      `;
      highlightGridEl.appendChild(article);
    });
    initHighlightSlides();
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
    if (!modalGalleryEl) return;
    modalGalleryEl.innerHTML = "";
    if (!entries.length) {
      return;
    }
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
      await ensureAnonymousSession(appwriteClient);
    } catch (error) {
      console.warn("Appwrite SDK not ready yet.", error);
    }

    if (!appwriteClient || !appwriteClient.databases) {
      if (eventsEmptyEl && eventsEmptyEl.classList) {
        eventsEmptyEl.classList.remove("hidden");
        eventsEmptyEl.textContent = "Loading events… please check your connection.";
      }
      await loadUpcomingEventsPublic();
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
      handleDeferredNavAlbum();
      await loadUpcomingEventsPublic(appwriteClient);
    } catch (error) {
      console.error("Unable to fetch events", error);
      if (eventsEmptyEl && eventsEmptyEl.classList) {
        eventsEmptyEl.classList.remove("hidden");
        eventsEmptyEl.textContent = "Unable to fetch events right now. Please try again later.";
      }
      await loadUpcomingEventsPublic(appwriteClient);
    }
  };

  const loadUpcomingEventsPublic = async (existingClient = null) => {
    if (!upcomingGridEl) return;
    const appwriteClient = existingClient || (await ensureAppwriteClient().catch(() => null));
    if (!appwriteClient || !appwriteClient.databases) {
      if (upcomingEmptyEl) {
        upcomingEmptyEl.style.display = "block";
        upcomingEmptyEl.textContent = "Upcoming events will appear once scheduled.";
      }
      return;
    }
    try {
      const queries = [];
      if (Appwrite.Query?.orderAsc) {
        queries.push(Appwrite.Query.orderAsc("startDate"));
      }
      const response = await appwriteClient.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.upcomingEvents,
        queries
      );
      const documents = response.documents || [];
      const filtered = filterUpcomingDocuments(documents);
      renderUpcomingInvites(filtered);
    } catch (error) {
      console.error("Unable to fetch upcoming events", error);
      if (upcomingEmptyEl) {
        upcomingEmptyEl.style.display = "block";
        upcomingEmptyEl.textContent = "Unable to load upcoming events right now.";
      }
    }
  };

  const initEventsPortalNav = () => {
    if (!eventsPortalEl) return;
    const setPrimaryTab = (tabName) => {
      portalTabs.forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.primaryTab === tabName);
      });
      portalPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.primaryPanel === tabName);
      });
    };

    const setProjectSubtab = (subtabName) => {
      projectSubtabs.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.subtab === subtabName);
      });
      projectSubpanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.subpanel === subtabName);
      });
    };

    portalTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.primaryTab;
        if (!target) return;
        setPrimaryTab(target);
      });
    });

    projectSubtabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.subtab;
        if (!target) return;
        setPrimaryTab("projects");
        setProjectSubtab(target);
      });
    });

    setPrimaryTab("organised");
    setProjectSubtab("projects-upcoming");
  };

  initEventsPortalNav();
  loadPublishedEvents();

  if (eventsGridEl) {
    eventsGridEl.addEventListener("click", (event) => {
      const card = event.target.closest(".event-card");
      if (!card || !card.dataset || !card.dataset.albumSlug) return;
      openAlbumModal(card.dataset.albumSlug);
    });
  }

  if (organisedListEl) {
    organisedListEl.addEventListener("click", (event) => {
      const button = event.target.closest(".events-portal__list-link");
      if (!button?.dataset?.albumSlug) return;
      openAlbumModal(button.dataset.albumSlug);
    });
  }

  if (navAlbumLists.length) {
    navAlbumLists.forEach((list) => list.addEventListener("click", onNavAlbumLinkClick));
  }

  window.addEventListener("hashchange", () => {
    const slug = getAlbumSlugFromHash(window.location.hash);
    deferredNavAlbumSlug = slug;
    handleDeferredNavAlbum();
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeAlbumModal);
  }
  if (modalBackdropEl) {
    modalBackdropEl.addEventListener("click", closeAlbumModal);
  }
  document.addEventListener("keydown", handleEscClose);
})();
