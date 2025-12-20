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
const mainNav = document.querySelector(".main-nav");
const galleryButtons = document.querySelectorAll("[data-gallery-trigger]");

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

  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
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
