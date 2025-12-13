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
