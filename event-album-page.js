(() => {
  const galleryGridEl = document.getElementById("album-gallery-grid");
  const galleryEmptyEl = document.getElementById("album-gallery-empty");
  const heroTitleEl = document.getElementById("album-hero-title");
  const heroDescriptionEl = document.getElementById("album-hero-description");
  const heroQuoteEl = document.getElementById("album-hero-quote");
  const heroDateEl = document.getElementById("album-hero-date");
  const heroImpactEl = document.getElementById("album-hero-impact");
  const heroPhotosEl = document.getElementById("album-hero-photos");
  const heroCoverEl = document.getElementById("album-hero-cover");
  const pageStatusEl = document.getElementById("album-page-status");

  if (!galleryGridEl || !heroTitleEl || !window.APPWRITE_CONFIG) {
    return;
  }

  const setStatus = (message) => {
    if (!pageStatusEl) return;
    pageStatusEl.textContent = message || "";
    pageStatusEl.style.display = message ? "block" : "none";
  };

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("album") || params.get("slug") || params.get("id");
  const normalizedSlug = (slug || "").trim().toLowerCase();

  if (!slug) {
    heroTitleEl.textContent = "Album not found";
    setStatus("No album was specified. Please return to Events and choose an album.");
    if (galleryEmptyEl) {
      galleryEmptyEl.hidden = false;
      galleryEmptyEl.textContent = "No album selected.";
    }
    return;
  }

  const STORAGE_BASE = `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files`;
  const storagePreviewUrl = (fileId) => `${STORAGE_BASE}/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;

  const FALLBACK_ALBUMS = {
    "rewari half marathon": {
      doc: {
        title: "Rewari Half Marathon",
        description: "Runners, volunteers, and medical partners turned the streets of Rewari into a corridor of cheer as 500+ citizens ran for clean air.",
        caption: "Sweat, smiles, and steadfast support for greener lungs.",
        impactCount: 520,
        startDate: "2024-09-07",
        endDate: "2024-09-07",
        mediaFileIds: []
      },
      entries: [
        {
          fallbackSrc: "images/homepage7_tree1.png",
          title: "Flag-off spirit",
          description: "Volunteers guiding participants through warm-up drills minutes before the flag-off."
        },
        {
          fallbackSrc: "images/homepage8_1.png",
          title: "Hydration pit stop",
          description: "NCC cadets and scouts distributing electrolyte drinks at the 7 km mark."
        },
        {
          fallbackSrc: "images/homepage5.png",
          title: "Community cheer squad",
          description: "Senior citizens and school bands lined the route to applaud every finisher."
        }
      ]
    }
  };

  const hasLocalImage = (path) => {
    if (!path) return false;
    const img = new Image();
    img.src = path;
    return true;
  };

  const getFallbackAlbum = () => {
    if (!normalizedSlug) return null;
    const fallback = FALLBACK_ALBUMS[normalizedSlug];
    if (!fallback) return null;
    const entries = fallback.entries
      .filter((entry) => entry.fallbackSrc && hasLocalImage(entry.fallbackSrc))
      .map((entry) => ({
        fileId: null,
        title: entry.title,
        description: entry.description,
        fallbackSrc: entry.fallbackSrc
      }));
    return {
      doc: fallback.doc,
      entries
    };
  };

  let appwriteInitPromise = null;
  let anonymousSessionPromise = null;

  const ensureAppwriteClient = async () => {
    if (window.appwrite && window.appwrite.databases) {
      return window.appwrite;
    }
    if (typeof Appwrite === "undefined") {
      throw new Error("Appwrite SDK not available.");
    }
    if (!appwriteInitPromise) {
      appwriteInitPromise = (async () => {
        const client = new Appwrite.Client()
          .setEndpoint(APPWRITE_CONFIG.endpoint)
          .setProject(APPWRITE_CONFIG.projectId);
        window.appwrite = {
          client,
          account: new Appwrite.Account(client),
          databases: new Appwrite.Databases(client),
          storage: new Appwrite.Storage(client)
        };
        return window.appwrite;
      })();
    }
    return appwriteInitPromise;
  };

  const ensureAnonymousSession = async (client) => {
    if (!client || !client.account) return;
    if (anonymousSessionPromise) return anonymousSessionPromise;
    anonymousSessionPromise = (async () => {
      try {
        await client.account.get();
      } catch (error) {
        const isAuthError = Number(error?.code) === 401 || (error?.type || "").includes("unauthorized");
        if (isAuthError) {
          await client.account.createAnonymousSession();
        } else {
          throw error;
        }
      }
      return client;
    })();
    return anonymousSessionPromise;
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

  const formatDateRange = (startDate, endDate) => {
    const start = toComparableDate(startDate);
    const end = toComparableDate(endDate);
    if (start && end) {
      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString();
      }
      return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
    }
    if (start) return start.toLocaleDateString();
    if (end) return `Until ${end.toLocaleDateString()}`;
    return startDate || endDate || "Date to be announced";
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

  const buildAlbumEntries = (doc) => {
    const explicitEntries = toMediaEntries(doc);
    const mediaIds = Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds.filter(Boolean) : [];
    if (explicitEntries.length) {
      return explicitEntries.filter((entry) => entry && entry.fileId);
    }
    if (!mediaIds.length) return [];
    return mediaIds.map((fileId, index) => ({
      fileId,
      title: doc.title || doc.name,
      description: index === 0 ? doc.description || doc.caption || "" : ""
    }));
  };

  const renderHero = (doc, entries) => {
    const title = doc.title || doc.name || "Untitled album";
    heroTitleEl.textContent = title;
    heroDescriptionEl.textContent = doc.description || "";
    heroQuoteEl.textContent = doc.caption || "";

    const impact = doc.impactCount || 0;
    heroImpactEl.textContent = impact ? `${impact.toLocaleString()} beneficiaries` : "To be updated";

    const totalPhotos = Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds.filter(Boolean).length : entries.length;
    heroPhotosEl.textContent = totalPhotos ? `${totalPhotos} photos` : "No photos yet";

    const dateLabel = formatDateRange(doc.startDate || doc.date, doc.endDate || doc.date);
    heroDateEl.textContent = dateLabel;

    const firstEntry = entries[0];
    if (firstEntry && firstEntry.fileId) {
      heroCoverEl.innerHTML = `
        <img src="${storagePreviewUrl(firstEntry.fileId)}" alt="${title}" loading="lazy" />
      `;
    }
  };

  const renderGallery = (entries) => {
    galleryGridEl.innerHTML = "";
    if (!entries.length) {
      if (galleryEmptyEl) {
        galleryEmptyEl.hidden = false;
      }
      return;
    }
    if (galleryEmptyEl) {
      galleryEmptyEl.hidden = true;
    }
    entries.forEach((entry, index) => {
      if (!entry) return;
      const imgSrc = entry.fileId ? storagePreviewUrl(entry.fileId) : entry.fallbackSrc;
      if (!imgSrc) return;
      const figure = document.createElement("figure");
      figure.className = "album-gallery__item";
      figure.style.setProperty("--item-index", String(index));
      figure.innerHTML = `
        <div class="album-gallery__image-wrap">
          <img src="${imgSrc}" alt="${entry.title || entry.filename || "Event photo"}" loading="lazy" />
        </div>
        ${
          entry.title || entry.description
            ? `<figcaption class="album-gallery__caption">
                ${entry.title ? `<strong>${entry.title}</strong>` : ""}
                ${entry.description ? `<p>${entry.description}</p>` : ""}
              </figcaption>`
            : ""
        }
      `;
      galleryGridEl.appendChild(figure);
    });
  };

  const fetchAndRenderAlbum = async () => {
    try {
      setStatus("Loading album…");
      const client = await ensureAppwriteClient();
      await ensureAnonymousSession(client);
      const { databases } = client;

      let albumDoc = null;
      const queries = [];
      if (typeof Appwrite !== "undefined" && Appwrite.Query && typeof Appwrite.Query.equal === "function") {
        queries.push(Appwrite.Query.equal("slug", slug));
      }

      if (queries.length) {
        try {
          const response = await databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.events,
            queries
          );
          albumDoc = (response.documents || [])[0] || null;
        } catch (error) {
          console.warn("Unable to fetch album by slug", error);
        }
      }

      if (!albumDoc) {
        try {
          albumDoc = await databases.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.events,
            slug
          );
        } catch (error) {
          console.warn("Unable to fetch album by ID", error);
        }
      }

      if (!albumDoc) {
        const fallbackAlbum = getFallbackAlbum();
        if (fallbackAlbum) {
          renderHero(fallbackAlbum.doc, fallbackAlbum.entries);
          renderGallery(fallbackAlbum.entries);
          setStatus("Showing an offline preview. Publish the album in Appwrite to replace these photos.");
          return;
        }
        heroTitleEl.textContent = "Album not found";
        setStatus("We could not find this album. It may have been unpublished or removed.");
        if (galleryEmptyEl) {
          galleryEmptyEl.hidden = false;
          galleryEmptyEl.textContent = "Album not found.";
        }
        return;
      }

      let entries = buildAlbumEntries(albumDoc);
      if (!entries.length) {
        const fallbackAlbum = getFallbackAlbum();
        if (fallbackAlbum) {
          entries = fallbackAlbum.entries;
          renderHero({ ...fallbackAlbum.doc, ...albumDoc }, entries);
          renderGallery(entries);
          setStatus("Showing placeholder visuals until photos are uploaded to Appwrite.");
          return;
        }
      }
      renderHero(albumDoc, entries);
      renderGallery(entries);
      setStatus("");
    } catch (error) {
      console.error("Unable to load album", error);
      const fallbackAlbum = getFallbackAlbum();
      if (fallbackAlbum) {
        renderHero(fallbackAlbum.doc, fallbackAlbum.entries);
        renderGallery(fallbackAlbum.entries);
        setStatus("Using offline preview. Please refresh once connectivity or permissions are restored.");
      } else {
        heroTitleEl.textContent = "Unable to load album";
        setStatus("Something went wrong while loading this album. Please try again later.");
        if (galleryEmptyEl) {
          galleryEmptyEl.hidden = false;
          galleryEmptyEl.textContent = "Album could not be loaded.";
        }
      }
    }
  };

  fetchAndRenderAlbum();
})();
