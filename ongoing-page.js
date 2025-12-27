(() => {
  const gridEl = document.getElementById("ongoing-projects-grid");
  if (!gridEl) return;

  const emptyEl = document.getElementById("ongoing-projects-empty");
  const filterButtons = document.querySelectorAll("[data-ongoing-filter]");
  const statusMeta = {
    active: { label: "Active", css: "ongoing-card__status ongoing-card__status--active" },
    paused: { label: "Paused", css: "ongoing-card__status ongoing-card__status--paused" },
    completed: { label: "Completed", css: "ongoing-card__status ongoing-card__status--completed" }
  };

  let allProjects = [];
  let activeFilter = "all";

  const formatDurationLabel = (startDate, endDate) => {
    const toComparableDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const start = toComparableDate(startDate);
    const end = toComparableDate(endDate);
    if (start && end) {
      if (start.toDateString() === end.toDateString()) {
        return `${start.toLocaleDateString()} · Single day`;
      }
      return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
    }
    if (start) {
      return `${start.toLocaleDateString()} onwards`;
    }
    if (end) {
      return `Until ${end.toLocaleDateString()}`;
    }
    if (startDate && endDate) return `${startDate} → ${endDate}`;
    return startDate || endDate || "Timeline TBA";
  };

  const storagePreviewUrl = (fileId) =>
    `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;

  const renderProjects = () => {
    const filtered = allProjects.filter((doc) => {
      if (activeFilter === "all") return true;
      return (doc.status || "").toLowerCase() === activeFilter;
    });

    gridEl.innerHTML = "";
    if (!filtered.length) {
      if (emptyEl) {
        emptyEl.textContent =
          activeFilter === "all" ? "Ongoing projects will appear here once published." : "No projects match this filter yet.";
        emptyEl.style.display = "block";
      }
      return;
    }

    if (emptyEl) {
      emptyEl.style.display = "none";
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((doc) => {
      const statusKey = (doc.status || "active").toLowerCase();
      const meta = statusMeta[statusKey] || { label: doc.status || "Scheduled", css: "ongoing-card__status" };
      const card = document.createElement("article");
      card.className = "ongoing-card";
      const hasPoster = Boolean(doc.posterFileId);
      const posterMarkup = hasPoster
        ? `
          <div class="ongoing-card__poster">
            <img src="${storagePreviewUrl(doc.posterFileId)}" alt="${doc.title}" loading="lazy" />
          </div>`
        : "";
      card.innerHTML = `
        <div class="${meta.css}">
          <span aria-hidden="true"></span>
          ${meta.label}
        </div>
        <div class="ongoing-card__header">
          <div class="ongoing-card__info">
            <h3>${doc.title || "Untitled project"}</h3>
            <p class="ongoing-card__duration">${formatDurationLabel(doc.startDate, doc.endDate)}</p>
            <div class="ongoing-card__meta">
              <span>📍 ${doc.location || "Location TBA"}</span>
            </div>
          </div>
          ${posterMarkup}
        </div>
        <div class="ongoing-card__agenda">
          <h3>Agenda</h3>
          <p>${doc.agenda || "Details will be shared soon."}</p>
        </div>
        <p class="ongoing-card__description">${doc.description || "We will share more impact highlights shortly."}</p>
      `;

      if (hasPoster) {
        const img = card.querySelector(".ongoing-card__poster img");
        const setOrientation = () => {
          if (!img?.naturalWidth || !img?.naturalHeight) return;
          const ratio = img.naturalWidth / img.naturalHeight;
          card.classList.remove("ongoing-card--poster-right", "ongoing-card--poster-below");
          if (ratio >= 1.2) {
            card.classList.add("ongoing-card--poster-right");
          } else {
            card.classList.add("ongoing-card--poster-below");
          }
        };
        if (img.complete) {
          setOrientation();
        } else {
          img.addEventListener("load", setOrientation, { once: true });
        }
      }

      fragment.appendChild(card);
    });
    gridEl.appendChild(fragment);
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.ongoingFilter || "all";
      if (target === activeFilter) return;
      activeFilter = target;
      filterButtons.forEach((btn) => btn.classList.toggle("is-active", btn === button));
      renderProjects();
    });
  });

  const loadOngoingProjectsPublic = async () => {
    try {
      const client = await ensurePublicAppwrite();
      const { databases } = client;
      const queries = [];
      if (Appwrite.Query?.orderDesc) {
        queries.push(Appwrite.Query.orderDesc("$updatedAt"));
      }
      const response = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.ongoingProjects,
        queries
      );
      allProjects = response.documents || [];
      renderProjects();
    } catch (error) {
      console.error("Unable to load ongoing projects", error);
      if (emptyEl) {
        emptyEl.textContent = "Unable to load ongoing projects right now. Please try again later.";
        emptyEl.style.display = "block";
      }
    }
  };

  loadOngoingProjectsPublic();
})();
