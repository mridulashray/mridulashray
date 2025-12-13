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

const closeNav = () => {
  if (!navToggle) return;
  navToggle.setAttribute("aria-expanded", "false");
  mainNav?.classList.remove("is-open");
  document.body.classList.remove("nav-open");
};

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeNav();
    } else {
      navToggle.setAttribute("aria-expanded", "true");
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
const amountInput = paymentForm?.querySelector('input[name="amount"]');

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
    const donorName = paymentForm.querySelector('input[name="supporter-name"]')?.value.trim() || "Friend of Mridulashray";
    const note = paymentForm.querySelector('textarea[name="note"]')?.value.trim() || "Support for Mridulashray schools";
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
