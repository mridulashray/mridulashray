const slides = document.querySelectorAll(".slide");
const indicators = document.querySelectorAll(".indicator");
let current = 0;
let autoPlayId;

const hasSlides = slides.length > 0;

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
