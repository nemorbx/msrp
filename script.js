document.addEventListener("DOMContentLoaded", () => {
  const pages = document.querySelectorAll(".page");
  const nav = document.querySelectorAll(".site-nav-link");
  const pageNames = new Set(["home","shop","about","record","staff","server","dashboard"]);

  function showPage(name, updateHash = true) {
    if (name === "dashboard") name = "home";
    if (!pageNames.has(name)) name = "home";
    pages.forEach(p => p.classList.toggle("active", p.id === name));
    nav.forEach(item => item.classList.toggle("active", item.dataset.page === name));
    if (updateHash) history.replaceState(null, "", "#" + name);
    window.scrollTo({top:0, behavior:"smooth"});
  }

  nav.forEach(item => item.addEventListener("click", () => showPage(item.dataset.page)));
  document.querySelectorAll("[data-page]").forEach(item => {
    if (!item.classList.contains("site-nav-link")) {
      item.addEventListener("click", () => showPage(item.dataset.page));
    }
  });

  document.querySelectorAll('a[href="#server"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      showPage("server");
    });
  });

  const mobileButton = document.getElementById("mobileNavButton");
  if (mobileButton) {
    mobileButton.addEventListener("click", () => {
      const first = document.querySelector(".site-nav-link");
      const navOpen = document.querySelector(".mobile-nav");
      if (navOpen) navOpen.remove();
      else {
        const menu = document.createElement("div");
        menu.className = "mobile-nav";
        menu.innerHTML = [...nav].map(item => '<button data-page="' + item.dataset.page + '">' + item.textContent + '</button>').join("");
        document.body.appendChild(menu);
        menu.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { showPage(b.dataset.page); menu.remove(); }));
      }
    });
  }

  const startingHash = location.hash.replace("#","");
  showPage(pageNames.has(startingHash) ? startingHash : "home", false);

  document.querySelectorAll("#discordButton,#heroDiscord,#recordDiscord,#staffDiscord,#serverDiscord").forEach(button => {
    button.addEventListener("click", () => {
      alert("Discord sign-in will be connected here once the secure Discord OAuth backend is added.");
    });
  });

  document.querySelectorAll("#heroRoblox,#serverRoblox").forEach(button => {
    button.addEventListener("click", () => {
      alert("The official MSRP Roblox Group link will be connected here.");
    });
  });

  const communityCount = document.querySelector("[data-community-count]");
  const playerCount = document.querySelector("[data-player-count]");
  const staffCount = document.querySelector("[data-staff-count]");
  const queueCount = document.querySelector("[data-queue-count]");

  if (communityCount) communityCount.textContent = "0";
  if (playerCount) playerCount.textContent = "0";
  if (staffCount) staffCount.textContent = "0";
  if (queueCount) queueCount.textContent = "0";
});
