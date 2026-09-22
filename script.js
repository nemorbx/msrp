/* =========================================
   MSRP — Missouri State Roleplay
   Website JavaScript
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

  const pageData = {
    dashboard: { title: "Dashboard", subtitle: "Missouri State Roleplay Staff Portal" },
    guide: { title: "Staff Guide", subtitle: "Missouri State Roleplay staff resources" },
    directory: { title: "Staff Directory", subtitle: "View the Missouri State Roleplay staff team" },
    applications: { title: "Applications", subtitle: "Manage staff applications" },
    infractions: { title: "Infractions", subtitle: "View staff disciplinary records" },
    promotions: { title: "Promotions", subtitle: "View recent staff promotions" },
    server: { title: "ER:LC Server", subtitle: "Missouri State Roleplay server information" },
    modcalls: { title: "Mod Calls", subtitle: "View active moderation calls" },
    ia: { title: "Internal Affairs", subtitle: "Internal Affairs resources and information" }
  };

  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const mobileMenu = document.getElementById("mobileMenu");
  const sidebar = document.getElementById("sidebar");

  function showPage(pageName, updateHash = true) {
    if (!pageData[pageName]) pageName = "dashboard";

    pages.forEach(page => page.classList.remove("active"));

    const selectedPage = document.getElementById(pageName);
    if (selectedPage) selectedPage.classList.add("active");

    navItems.forEach(item => {
      item.classList.toggle("active", item.dataset.page === pageName);
    });

    if (pageTitle) pageTitle.textContent = pageData[pageName].title;
    if (pageSubtitle) pageSubtitle.textContent = pageData[pageName].subtitle;

    if (window.innerWidth <= 800 && sidebar) {
      sidebar.classList.remove("open");
    }

    if (updateHash) {
      try {
        history.replaceState(null, "", "#" + pageName);
      } catch (error) {
        console.log("Unable to update URL.");
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  navItems.forEach(item => {
    item.addEventListener("click", () => showPage(item.dataset.page));
  });

  document.querySelectorAll("[data-page-link]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.pageLink));
  });

  if (mobileMenu && sidebar) {
    mobileMenu.addEventListener("click", event => {
      event.stopPropagation();
      sidebar.classList.toggle("open");
    });

    document.addEventListener("click", event => {
      if (window.innerWidth > 800 || !sidebar.classList.contains("open")) return;
      if (!sidebar.contains(event.target) && !mobileMenu.contains(event.target)) {
        sidebar.classList.remove("open");
      }
    });
  }

  // Staff directory search.
  const staffSearch = document.getElementById("staffSearch");
  const staffCards = document.querySelectorAll("#staffGrid .staff-card");

  if (staffSearch) {
    staffSearch.addEventListener("input", () => {
      const value = staffSearch.value.toLowerCase().trim();

      staffCards.forEach(card => {
        const matches = card.textContent.toLowerCase().includes(value);
        card.style.display = matches ? "" : "flex";
        if (!matches) card.style.display = "none";
      });
    });
  }

  // Optional reusable search system for future pages.
  document.querySelectorAll("[data-search]").forEach(input => {
    input.addEventListener("input", () => {
      const value = input.value.toLowerCase().trim();
      const target = input.dataset.search;

      document.querySelectorAll('[data-search-item="' + target + '"]').forEach(item => {
        item.style.display = !value || item.textContent.toLowerCase().includes(value) ? "" : "none";
      });
    });
  });

  // Clock support for future dashboard components.
  function updateClock() {
    document.querySelectorAll("[data-clock]").forEach(element => {
      element.textContent = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    });
  }

  updateClock();
  setInterval(updateClock, 30000);

  // Placeholder player count until the secure backend/Game Bot integration is added.
  document.querySelectorAll("[data-player-count]").forEach(element => {
    if (!element.dataset.value) element.textContent = "0 / 50";
  });

  document.querySelectorAll("[data-server-progress]").forEach(bar => {
    const current = Number(bar.dataset.current || 0);
    const maximum = Number(bar.dataset.maximum || 50);
    const percentage = maximum > 0 ? Math.min(Math.max((current / maximum) * 100, 0), 100) : 0;
    bar.style.width = percentage + "%";
  });

  const startingHash = window.location.hash.replace("#", "");
  showPage(pageData[startingHash] ? startingHash : "dashboard", false);

  window.addEventListener("popstate", () => {
    const hash = window.location.hash.replace("#", "");
    showPage(pageData[hash] ? hash : "dashboard", false);
  });

  console.log("%cMSRP Staff Portal", "font-size: 18px; font-weight: bold;");
  console.log("Missouri State Roleplay — Staff Portal");
});
