const slides = document.querySelectorAll(".slide");
const indicators = document.querySelectorAll(".indicator");
let current = 0;
let autoPlayId;

const hasSlides = slides.length > 0;
const getPublicAppwriteConfig = () => (typeof window !== "undefined" ? window.APPWRITE_CONFIG || null : null);

const showSlide = (index) => {
  if (!hasSlides) return;
  slides.forEach((slide) => slide.classList.remove("active"));
  indicators.forEach((dot) => dot.classList.remove("active"));
  slides[index].classList.add("active");
  indicators[index].classList.add("active");
  current = index;
};

const goToNext = () => {
  if (!hasSlides) return;
  const nextIndex = (current + 1) % slides.length;
  showSlide(nextIndex);
};

const startAutoPlay = () => {
  if (!hasSlides) return;
  stopAutoPlay();
  autoPlayId = setInterval(goToNext, 6000);
};

const stopAutoPlay = () => {
  if (autoPlayId) {
    clearInterval(autoPlayId);
  }
};

// --- Public form submissions -> Appwrite storage ---
const createStatusElement = (form) => {
  let el = form.querySelector(".form-status");
  if (!el) {
    el = document.createElement("p");
    el.className = "form-status";
    form.appendChild(el);
  }
  return el;
};

let publicAppwriteInitPromise = null;
const ensurePublicAppwrite = async () => {
  const config = getPublicAppwriteConfig();
  if (window.__publicAppwriteReady && window.appwrite?.databases) {
    return window.appwrite;
  }
  if (typeof Appwrite === "undefined" || !config) {
    throw new Error("Appwrite SDK not loaded on this page.");
  }
  if (!publicAppwriteInitPromise) {
    publicAppwriteInitPromise = (async () => {
      if (!window.appwrite?.client) {
        const client = new Appwrite.Client()
          .setEndpoint(config.endpoint)
          .setProject(config.projectId);
        window.appwrite = {
          client,
          account: new Appwrite.Account(client),
          databases: new Appwrite.Databases(client)
        };
      }
      try {
        await window.appwrite.account.get();
      } catch {
        await window.appwrite.account.createAnonymousSession();
      }
      window.__publicAppwriteReady = true;
      return window.appwrite;
    })();
  }
  return publicAppwriteInitPromise;
};

const submitToCollection = async (collectionId, payload) => {
  const config = getPublicAppwriteConfig();
  if (!config) throw new Error("Missing Appwrite config");
  if (!collectionId) throw new Error("Missing collection id");
  const { databases } = await ensurePublicAppwrite();
  await databases.createDocument(
    config.databaseId,
    collectionId,
    Appwrite.ID ? Appwrite.ID.unique() : undefined,
    {
      ...payload,
      submittedAt: new Date().toISOString()
    }
  );
};

const resolveCollectionId = (value) => (typeof value === "function" ? value() : value);

const wireFormSubmission = (form, collectionIdOrResolver, transform) => {
  if (!form) return;
  const statusEl = createStatusElement(form);
  const submitHandler = async (event) => {
    if (form.dataset.nativeSubmit === "true") {
      form.dataset.nativeSubmit = "";
      return;
    }
    event.preventDefault();
    statusEl.textContent = "Saving your details…";
    statusEl.classList.remove("is-error");
    try {
      const collectionId = resolveCollectionId(collectionIdOrResolver);
      if (!collectionId) {
        throw new Error("Collection not configured on this page.");
      }
      const payload = typeof transform === "function" ? transform(form) : {};
      await submitToCollection(collectionId, payload);
      statusEl.textContent = "Saved securely. Redirecting…";
    } catch (error) {
      console.error("Form save error", error);
      statusEl.textContent = "Saved via email only. We will still reach out.";
      statusEl.classList.add("is-error");
    } finally {
      form.dataset.nativeSubmit = "true";
      form.submit();
    }
  };
  form.addEventListener("submit", submitHandler);
};

const volunteerForm = document.querySelector(".volunteer-form-card");
wireFormSubmission(
  volunteerForm,
  () => getPublicAppwriteConfig()?.collections?.volunteers,
  (form) => ({
    name: form.name?.value?.trim() || "",
    email: form.email?.value?.trim() || "",
    phone: form.phone?.value?.trim() || "",
    location: form.location?.value?.trim() || "",
    interest: form.interest?.value || "",
    message: form.message?.value?.trim() || "",
    source: "volunteer-page"
  })
);

const contactForm = document.querySelector(".contact-panel__form");
const contactThanksEl = document.getElementById("contact-thanks");
const contactNextField = document.querySelector("[data-contact-next]");

if (contactNextField) {
  try {
    const thanksUrl = new URL(window.location.href);
    thanksUrl.searchParams.set("contact", "thanks");
    contactNextField.value = thanksUrl.toString();
  } catch (error) {
    console.warn("Unable to prepare contact redirect URL", error);
  }
}

const urlSearchParams = new URLSearchParams(window.location.search);
if (contactThanksEl && urlSearchParams.get("contact") === "thanks") {
  contactThanksEl.hidden = false;
  try {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("contact");
    window.history.replaceState({}, "", cleanUrl);
  } catch {
    // ignore history cleanup failures
  }
}

wireFormSubmission(
  contactForm,
  () => getPublicAppwriteConfig()?.collections?.contactDetails,
  (form) => ({
    name: form.name?.value?.trim() || "",
    email: form.email?.value?.trim() || "",
    phone: form.phone?.value?.trim() || "",
    message: form.message?.value?.trim() || "",
    source: "contact-page"
  })
);

if (hasSlides) {
  indicators.forEach((dot) => {
    dot.addEventListener("click", (event) => {
      const targetIndex = Number(event.currentTarget.dataset.slide);
      showSlide(targetIndex);
      startAutoPlay();
    });
  });

  startAutoPlay();
}

const footerYear = document.getElementById("footer-year");
if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}

const navToggle = document.querySelector(".nav-toggle");
const navBackdrop = document.querySelector(".nav-screen");
const mainNav = document.querySelector(".main-nav");
const navItems = document.querySelectorAll(".nav-item--has-menu");
const navEventsLists = document.querySelectorAll("[data-nav-events-list]");
const galleryButtons = document.querySelectorAll("[data-gallery-trigger]");
const scriptPromises = new Map();
const APPWRITE_CDN_URL = "https://cdn.jsdelivr.net/npm/appwrite@13.0.0";
const APPWRITE_CONFIG_PATH = "appwrite-config.js";
const NAV_ALBUM_LIMIT = 5;
let navAppwriteInitPromise = null;
let navAnonSessionPromise = null;
let navAlbumsLoaded = false;

let navCloseAnimationHandler;

const closeNav = () => {
  if (!navToggle || !mainNav) return;
  if (!mainNav.classList.contains("is-open")) {
    navToggle.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("is-closing");
    document.body.classList.remove("nav-open");
    return;
  }

  mainNav.classList.add("is-closing");
  navToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("nav-open");

  if (navCloseAnimationHandler) {
    mainNav.removeEventListener("animationend", navCloseAnimationHandler);
  }

  navCloseAnimationHandler = (event) => {
    if (event.animationName !== "mobileNavHide") return;
    mainNav.classList.remove("is-open");
    mainNav.classList.remove("is-closing");
    mainNav.removeEventListener("animationend", navCloseAnimationHandler);
    navCloseAnimationHandler = null;
  };

  mainNav.addEventListener("animationend", navCloseAnimationHandler);
};

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeNav();
    } else {
      navToggle.setAttribute("aria-expanded", "true");
      mainNav.classList.remove("is-closing");
      mainNav.classList.add("is-open");
      document.body.classList.add("nav-open");
    }
  });

  if (navBackdrop) {
    navBackdrop.addEventListener("click", closeNav);
  }

  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
}

const getIsDesktopNav = () => window.matchMedia("(hover: hover)").matches && window.innerWidth > 900;

const closeAllDropdowns = () => {
  navItems.forEach((item) => {
    item.classList.remove("nav-item--open");
    const trigger = item.querySelector("[data-nav-trigger]");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
};

const handleDropdownOpen = (item) => {
  if (!item) return;
  const trigger = item.querySelector("[data-nav-trigger]");
  const dropdown = item.querySelector(".nav-dropdown");
  if (!trigger || !dropdown) return;

  const isDesktop = getIsDesktopNav();
  closeAllDropdowns();
  item.classList.add("nav-item--open");
  trigger.setAttribute("aria-expanded", "true");

  const exitHandler = (event) => {
    if (isDesktop) {
      if (!item.contains(event.relatedTarget)) {
        item.classList.remove("nav-item--open");
        trigger.setAttribute("aria-expanded", "false");
        dropdown.removeEventListener("mouseleave", exitHandler);
        trigger.removeEventListener("blur", exitHandler);
      }
    }
  };

  if (isDesktop) {
    dropdown.addEventListener("mouseleave", exitHandler);
    trigger.addEventListener("blur", exitHandler);
  }
};

const initNavDropdowns = () => {
  if (!navItems.length) return;

  navItems.forEach((item) => {
    const trigger = item.querySelector("[data-nav-trigger]");
    const primaryLink = item.querySelector(".nav-link--primary");
    const dropdown = item.querySelector(".nav-dropdown");
    if (!trigger || !dropdown) return;

    const openOnDesktop = () => {
      if (!getIsDesktopNav()) return;
      handleDropdownOpen(item);
    };

    trigger.addEventListener("mouseenter", openOnDesktop);
    trigger.addEventListener("focus", openOnDesktop);
    if (primaryLink) {
      primaryLink.addEventListener("mouseenter", openOnDesktop);
      primaryLink.addEventListener("focus", openOnDesktop);
    }
    item.addEventListener("mouseleave", () => {
      if (getIsDesktopNav()) {
        item.classList.remove("nav-item--open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    trigger.addEventListener("click", (event) => {
      const isDesktop = getIsDesktopNav();
      if (isDesktop) {
        event.preventDefault();
        handleDropdownOpen(item);
      } else {
        const isOpen = item.classList.contains("nav-item--open");
        closeAllDropdowns();
        if (!isOpen) {
          item.classList.add("nav-item--open");
          trigger.setAttribute("aria-expanded", "true");
        }
      }
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target) return;
    if (mainNav.contains(target) || (navToggle && navToggle.contains(target))) return;
    closeAllDropdowns();
  });
};

initNavDropdowns();

const loadScriptOnce = (src) => {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src);
  }
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = (error) => reject(error);
    if (!existing) {
      document.head.appendChild(script);
    }
  });
  scriptPromises.set(src, promise);
  return promise;
};

const ensureNavAppwrite = async () => {
  if (typeof Appwrite !== "undefined" && window.APPWRITE_CONFIG && window.appwrite?.databases) {
    if (!navAppwriteInitPromise) {
      navAppwriteInitPromise = Promise.resolve(window.appwrite);
    }
    return navAppwriteInitPromise;
  }
  if (!navAppwriteInitPromise) {
    navAppwriteInitPromise = (async () => {
      await loadScriptOnce(APPWRITE_CDN_URL);
      await loadScriptOnce(APPWRITE_CONFIG_PATH);
      if (!window.APPWRITE_CONFIG || typeof Appwrite === "undefined") {
        throw new Error("Appwrite config not ready for nav albums.");
      }
      if (!window.appwrite?.client) {
        const client = new Appwrite.Client()
          .setEndpoint(window.APPWRITE_CONFIG.endpoint)
          .setProject(window.APPWRITE_CONFIG.projectId);
        window.appwrite = {
          client,
          account: new Appwrite.Account(client),
          databases: new Appwrite.Databases(client)
        };
      }
      return window.appwrite;
    })();
  }
  return navAppwriteInitPromise;
};

const ensureNavAnonymousSession = async () => {
  if (navAnonSessionPromise) return navAnonSessionPromise;
  navAnonSessionPromise = (async () => {
    const client = await ensureNavAppwrite();
    try {
      await client.account.get();
    } catch {
      await client.account.createAnonymousSession();
    }
    return client;
  })();
  return navAnonSessionPromise;
};

const formatNavAlbumLink = (doc) => {
  const slug = doc.slug || doc.$id;
  const title = doc.title || doc.name || "Untitled album";
  if (!slug) return null;
  const link = document.createElement("a");
  link.href = `event-album.html?album=${encodeURIComponent(slug)}`;
  link.textContent = title;
  link.dataset.albumSlug = slug;
  return link;
};

const populateNavEventsLists = (documents = []) => {
  navEventsLists.forEach((listEl) => {
    listEl.innerHTML = "";
    if (!documents.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "nav-dropdown__empty";
      emptyItem.textContent = "Albums will appear shortly.";
      listEl.appendChild(emptyItem);
      return;
    }
    documents.forEach((doc) => {
      const slug = doc.slug || doc.$id;
      const title = doc.title || doc.name || "Untitled album";
      if (!slug) return;
      const li = document.createElement("li");
      const link = formatNavAlbumLink(doc);
      if (!link) return;
      li.appendChild(link);
      listEl.appendChild(li);
    });
  });
};

const navAlbumsFallback = (message) => {
  navEventsLists.forEach((listEl) => {
    listEl.innerHTML = "";
    const item = document.createElement("li");
    item.className = "nav-dropdown__empty";
    item.textContent = message || "Unable to load albums.";
    listEl.appendChild(item);
  });
};

const fetchNavAlbumDocuments = async () => {
  const client = await ensureNavAnonymousSession();
  const { databases } = client;
  const queries = [];
  if (typeof Appwrite !== "undefined" && Appwrite.Query) {
    if (typeof Appwrite.Query.equal === "function") {
      queries.push(Appwrite.Query.equal("status", "published"));
    }
    if (typeof Appwrite.Query.orderDesc === "function") {
      queries.push(Appwrite.Query.orderDesc("$updatedAt"));
    }
    if (typeof Appwrite.Query.limit === "function") {
      queries.push(Appwrite.Query.limit(NAV_ALBUM_LIMIT));
    }
  }
  const response = await databases.listDocuments(
    window.APPWRITE_CONFIG.databaseId,
    window.APPWRITE_CONFIG.collections.events,
    queries
  );
  return response.documents || [];
};

const initNavAlbums = async () => {
  if (!navEventsLists.length || navAlbumsLoaded) return;
  try {
    await ensureNavAnonymousSession();
    const documents = await fetchNavAlbumDocuments();
    if (documents.length) {
      populateNavEventsLists(documents);
    } else {
      navAlbumsFallback("No published albums yet.");
    }
    navAlbumsLoaded = true;
  } catch (error) {
    console.error("Unable to load nav albums", error);
    navAlbumsFallback("Albums unavailable right now.");
  }
};

if (navEventsLists.length) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initNavAlbums, 0);
  } else {
    window.addEventListener("DOMContentLoaded", initNavAlbums, { once: true });
  }
}

const HOME_EVENTS_LIMIT = 3;
const homeEventsTrack = document.getElementById("home-events-track");
const homeEventsStatus = document.getElementById("home-events-status");
const homeEventsViewMore = document.getElementById("home-events-view-more");
const FALLBACK_HOME_EVENTS = [
  {
    title: "Pushp Abhiyaan",
    description: "250 saplings planted across Rewari schools with student caretakers.",
    impactCount: "250 saplings",
    date: "2024-08-17",
    category: "Green Drives",
    coverUrl: "images/homepage7_tree1.png",
    href: "events.html"
  },
  {
    title: "Relief on Wheels",
    description: "Weekend drives that deliver ration and study kits to 80+ families.",
    impactCount: "80+ families",
    date: "2024-10-02",
    category: "Volunteer Corps",
    coverUrl: "images/homepage8_1.png",
    href: "events.html"
  },
  {
    title: "Ward 7 clean-up",
    description: "Citizens and students removed 1.2 tons of waste from shared spaces.",
    impactCount: "1.2 tons",
    date: "2024-11-15",
    category: "Community Action",
    coverUrl: "images/homepage5.png",
    href: "events.html"
  }
];

const getStoragePreviewUrl = (fileId) => {
  if (!fileId || !window.APPWRITE_CONFIG) return "";
  const { endpoint, bucketId, projectId } = window.APPWRITE_CONFIG;
  if (!endpoint || !bucketId || !projectId) return "";
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
};

const setHomeEventsStatus = (message) => {
  if (!homeEventsTrack || !homeEventsStatus) return;
  homeEventsStatus.textContent = message;
  homeEventsStatus.hidden = !message;
  if (!homeEventsStatus.parentElement) {
    homeEventsTrack.appendChild(homeEventsStatus);
  }
};

const normalizeHomeEventDoc = (doc = {}) => {
  const mediaFiles = Array.isArray(doc.mediaFileIds) ? doc.mediaFileIds : [];
  const coverId = doc.coverFileId || mediaFiles[0];
  const slug = doc.slug || doc.$id || "";
  return {
    title: doc.title || doc.name || "Community event",
    description: doc.description || "This story is being documented.",
    impactCount: doc.impactCount || "",
    date: doc.date || "",
    category: doc.category || "Community",
    coverUrl: doc.coverUrl || getStoragePreviewUrl(coverId),
    href: slug ? `event-album.html?album=${encodeURIComponent(slug)}` : "events.html"
  };
};

const createHomeEventCard = (doc) => {
  const normalized = normalizeHomeEventDoc(doc);
  const card = document.createElement("article");
  card.className = "home-event-card";
  const coverUrl = normalized.coverUrl;
  const title = normalized.title;
  const description = normalized.description;
  const dateLabel = normalized.date ? new Date(normalized.date).toLocaleDateString() : "Date TBC";
  const impactLabel = normalized.impactCount ? `${normalized.impactCount}` : "";
  const albumHref = normalized.href;
  card.innerHTML = `
    ${coverUrl ? `<img src="${coverUrl}" alt="${title}" loading="lazy" />` : `<div class="home-event-card__placeholder" aria-hidden="true"></div>`}
    <div>
      <p class="home-event-card__badge">${normalized.category}</p>
      <h3>${title}</h3>
      <p>${description}</p>
      <p class="home-event-card__meta">${impactLabel ? `${dateLabel} · ${impactLabel}` : dateLabel}</p>
      <a class="home-event-card__cta" href="${albumHref}">
        View story <span aria-hidden="true">→</span>
      </a>
    </div>
  `;
  return card;
};

const renderHomeEvents = (documents = []) => {
  if (!homeEventsTrack) return;
  while (homeEventsTrack.firstChild) {
    homeEventsTrack.removeChild(homeEventsTrack.firstChild);
  }
  if (!documents.length) {
    setHomeEventsStatus("Events will appear here once published.");
    return;
  }
  if (homeEventsStatus && homeEventsStatus.parentElement) {
    homeEventsStatus.remove();
  }
  documents.forEach((doc) => {
    const card = createHomeEventCard(doc);
    homeEventsTrack.appendChild(card);
  });
};

const buildHomeEventsPayload = (documents = []) => {
  const normalized = documents.slice(0, HOME_EVENTS_LIMIT).map(normalizeHomeEventDoc);
  let idx = 0;
  while (normalized.length < HOME_EVENTS_LIMIT && idx < FALLBACK_HOME_EVENTS.length) {
    normalized.push(FALLBACK_HOME_EVENTS[idx]);
    idx += 1;
  }
  return normalized;
};

const loadHomeEvents = async () => {
  if (!homeEventsTrack) return;
  setHomeEventsStatus("Events are syncing from our community cloud…");
  try {
    await ensureNavAnonymousSession().catch(() => null);
    const documents = (await fetchNavAlbumDocuments().catch(() => [])) || [];
    const payload = buildHomeEventsPayload(documents);
    renderHomeEvents(payload);
  } catch (error) {
    console.error("Unable to load homepage events", error);
    renderHomeEvents(FALLBACK_HOME_EVENTS);
    setHomeEventsStatus("");
  }
};

if (homeEventsTrack) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(loadHomeEvents, 0);
  } else {
    window.addEventListener("DOMContentLoaded", loadHomeEvents, { once: true });
  }
}

// Payment page helpers
const formatAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2).replace(/\.00$/, "") : "";
};

const paymentForm = document.getElementById("payment-form");
const paymentStatus = document.getElementById("payment-status");
const copyUpiBtn = document.getElementById("copy-upi-btn");
const upiIdText = document.getElementById("upi-id-text");
const amountInput =
  paymentForm && typeof paymentForm.querySelector === "function"
    ? paymentForm.querySelector('input[name="amount"]')
    : null;

const setStatus = (message, isError = false) => {
  if (!paymentStatus) return;
  paymentStatus.textContent = message;
  paymentStatus.style.color = isError ? "#b3261e" : "#2f6354";
};

if (paymentForm && amountInput) {
  const urlParams = new URLSearchParams(window.location.search);
  const presetAmount = urlParams.get("fund-goal") || urlParams.get("amount");
  if (presetAmount) {
    amountInput.value = formatAmount(presetAmount);
  }

  paymentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const upiId = paymentForm.dataset.upiId || "mridulashray@upi";
    const donorInput =
      typeof paymentForm.querySelector === "function"
        ? paymentForm.querySelector('input[name="supporter-name"]')
        : null;
    const noteInput =
      typeof paymentForm.querySelector === "function"
        ? paymentForm.querySelector('textarea[name="note"]')
        : null;
    const donorName = donorInput && donorInput.value ? donorInput.value.trim() : "Friend of Mridulashray";
    const note = noteInput && noteInput.value ? noteInput.value.trim() : "Support for Mridulashray schools";
    const amountValue = formatAmount(amountInput.value);

    if (!amountValue) {
      setStatus("Please enter a valid amount (minimum ₹1).", true);
      amountInput.focus();
      return;
    }

    const upiUrl = new URL("upi://pay");
    upiUrl.searchParams.set("pa", upiId);
    upiUrl.searchParams.set("pn", "Mridulashray");
    upiUrl.searchParams.set("cu", "INR");
    upiUrl.searchParams.set("am", amountValue);
    upiUrl.searchParams.set("tn", `${note} - ${donorName}`);

    setStatus("Opening your UPI app...");
    window.location.href = upiUrl.toString();
  });
}

if (copyUpiBtn && upiIdText) {
  copyUpiBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(upiIdText.textContent.trim());
      copyUpiBtn.textContent = "Copied!";
      setTimeout(() => {
        copyUpiBtn.textContent = "Copy";
      }, 2000);
    } catch (error) {
      setStatus("Copy not supported on this browser. Long-press to copy.", true);
    }
  });
}

// Stat counter animation
const counters = document.querySelectorAll(".stat-counter");
if (counters.length > 0 && "IntersectionObserver" in window) {
  const easeOutQuad = (t) => t * (2 - t);

  const animateCounter = (el) => {
    if (el.dataset.animated) return;
    el.dataset.animated = "true";
    const target = Number(el.dataset.target || "0");
    const suffix = el.dataset.suffix || "";
    const duration = Number(el.dataset.duration || "2000");
    const startTime = performance.now();

    const update = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutQuad(progress);
      const current = Math.floor(eased * target);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString() + suffix;
      }
    };

    requestAnimationFrame(update);
  };

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((counter) => observer.observe(counter));
}

const advanceGallery = (rootId) => {
  const mediaEl = document.querySelector(rootId);
  if (!mediaEl) return;
  const rawImages = mediaEl.dataset.galleryImages || "";
  const images = rawImages
    .split("|")
    .map((src) => src.trim())
    .filter(Boolean);
  if (images.length === 0) return;

  const currentIndex = Number(mediaEl.dataset.galleryIndex || "0");
  const nextIndex = (currentIndex + 1) % images.length;
  mediaEl.dataset.galleryIndex = String(nextIndex);
  mediaEl.dataset.galleryIndexCurrent = `${nextIndex + 1}/${images.length}`;

  const img = mediaEl.querySelector("img");
  if (!img) return;

  img.classList.add("is-transitioning");
  setTimeout(() => {
    img.src = images[nextIndex];
    img.classList.remove("is-transitioning");
  }, 150);
};

if (galleryButtons.length > 0) {
  galleryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.galleryTrigger;
      if (!targetId) return;
      advanceGallery(targetId);
    });
  });

  document.querySelectorAll("[data-gallery-images]").forEach((el) => {
    const raw = el.dataset.galleryImages || "";
    const list = raw
      .split("|")
      .map((src) => src.trim())
      .filter(Boolean);
    if (list.length > 0) {
      el.dataset.galleryIndexCurrent = `1/${list.length}`;
    }
  });
}
