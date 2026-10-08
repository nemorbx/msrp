document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const pages = [...document.querySelectorAll(".page")];
  const nav = [...document.querySelectorAll(".site-nav-link")];
  const names = new Set(["home","shop","about","record","dashboard"]);
  const A = window.MSRP_AUTH || {};

  const roles = [
    ["1551704056991318191","Senior High Rank"],
    ["1551704115350999143","High Rank"],
    ["1528426796670914671","Internal Affairs Supervisor"],
    ["1528426646259105802","Internal Affairs Director"],
    ["1527381477975789668","Internal Affairs"],
    ["1528426569012609106","Management Team"],
    ["1527381747791040522","Administration Team"],
    ["1527381803617222676","Moderation Team"],
    ["1528242210871447672","Staff Team"]
  ];

  const memberDash = $("memberDashboard");
  const loginDash = $("dashboardLoginCard");
  const derr = $("dashboardError");

  const dashboardViews = {
    overview: [...document.querySelectorAll("[data-dashboard-overview]")],
    community: [$("dashboardCommunityView")],
    leaderboard: [$("dashboardLeaderboardView")],
    inventory: [$("dashboardInventoryView")]
  };

  function error(message) {
    [derr].forEach((el) => {
      if (!el) return;
      el.textContent = message || "";
      el.hidden = !message;
    });
  }

  function page(name, updateHash = true) {
    const target = names.has(name) ? name : "home";

    pages.forEach((p) => p.classList.toggle("active", p.id === target));
    nav.forEach((item) => {
      const active = item.dataset.page === target;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    if (updateHash) history.replaceState(null, "", "#" + target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setDashboardView(view) {
    const key = dashboardViews[view] ? view : "overview";

    Object.entries(dashboardViews).forEach(([name, elements]) => {
      elements.forEach((el) => {
        if (el) el.hidden = name !== key;
      });
    });

    document.querySelectorAll("[data-dashboard-view]").forEach((item) => {
      item.classList.toggle("active", item.dataset.dashboardView === key);
    });

    const overviewLink = document.querySelector('.member-nav-item[href="#dashboard"]:not([data-dashboard-view])');
    if (overviewLink) overviewLink.classList.toggle("active", key === "overview");

    if (location.hash !== "#dashboard") history.replaceState(null, "", "#dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nav.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      page(item.dataset.page);
      if (item.dataset.page === "dashboard") load();
    });
  });

  const mobileButton = $("mobileNavButton");
  if (mobileButton) {
    mobileButton.onclick = () => {
      const existing = document.querySelector(".mobile-nav");
      if (existing) {
        existing.remove();
        return;
      }

      const menu = document.createElement("div");
      menu.className = "mobile-nav";
      menu.innerHTML = nav.map((item) =>
        '<button type="button" data-page="' + item.dataset.page + '">' + item.textContent + "</button>"
      ).join("");

      document.body.appendChild(menu);

      menu.querySelectorAll("button").forEach((button) => {
        button.onclick = () => {
          page(button.dataset.page);
          if (button.dataset.page === "dashboard" || button.dataset.page === "staff") load();
          menu.remove();
        };
      });
    };
  }

  function stats() {
    document.querySelectorAll("[data-player-count],[data-dashboard-players]").forEach((el) => el.textContent = "—");
    document.querySelectorAll("[data-staff-count],[data-dashboard-staff]").forEach((el) => el.textContent = "—");
    document.querySelectorAll("[data-queue-count],[data-dashboard-queue]").forEach((el) => el.textContent = "—");
    document.querySelectorAll("[data-community-count],[data-dashboard-vehicles]").forEach((el) => el.textContent = "—");
  }

  function rank(roleIds) {
    for (const role of roles) {
      if (roleIds.includes(role[0])) return role[1];
    }
    return "Staff Team";
  }

  function token() {
    const expires = Number(sessionStorage.getItem("msrp_discord_expires") || 0);
    const saved = sessionStorage.getItem("msrp_discord_token");
    return saved && expires > Date.now() ? saved : null;
  }

  function loginStart() {
    if (!A.clientId || A.clientId === "REPLACE_WITH_DISCORD_CLIENT_ID") {
      error("Discord sign-in is not configured yet.");
      return;
    }

    const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
    sessionStorage.setItem("msrp_oauth_state", state);

    const params = new URLSearchParams({
      response_type: "token",
      client_id: A.clientId,
      scope: "identify guilds.members.read",
      state,
      redirect_uri: A.redirectUri || location.origin + location.pathname
    });

    location.assign("https://discord.com/oauth2/authorize?" + params);
  }

  function callback() {
    if (!location.hash.includes("access_token=")) return null;

    const params = new URLSearchParams(location.hash.slice(1));
    const state = params.get("state");
    const expected = sessionStorage.getItem("msrp_oauth_state");
    const accessToken = params.get("access_token");
    const expiresIn = Number(params.get("expires_in") || 0);

    if (!state || state !== expected || !accessToken || !expiresIn) {
      error("Discord sign-in could not be verified. Please start again.");
      return null;
    }

    sessionStorage.setItem("msrp_discord_token", accessToken);
    sessionStorage.setItem("msrp_discord_expires", String(Date.now() + expiresIn * 1000));
    sessionStorage.removeItem("msrp_oauth_state");
    history.replaceState(null, "", location.pathname + "#dashboard");
    return accessToken;
  }

  async function api(path, accessToken) {
    const response = await fetch("https://discord.com/api/v10" + path, {
      headers: { Authorization: "Bearer " + accessToken }
    });

    if (!response.ok) {
      const failure = new Error("API " + response.status);
      failure.status = response.status;
      throw failure;
    }

    return response.json();
  }

  function avatarUrl(user) {
    return user.avatar
      ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=256"
      : "https://cdn.discordapp.com/embed/avatars/" + (Number(BigInt(user.id) % 5n)) + ".png";
  }

  function render(user, member) {
    const isStaff = Array.isArray(member.roles) && member.roles.some((id) => roles.some((r) => r[0] === id));
    const hasSeniorHighRank = Array.isArray(member.roles) && member.roles.includes("1551704056991318191");
    const hasHighRank = Array.isArray(member.roles) && member.roles.includes("1551704115350999143");
    const memberRank = hasSeniorHighRank ? "Senior High Rank" : hasHighRank ? "High Rank" : isStaff ? "Staff" : "Member";
    const username = user.username || "Member";
    const name = member.nick || user.global_name || username;
    const avatar = avatarUrl(user);

    ["memberAvatar","sidebarAvatar","profileCardAvatar","profilePreviewAvatar","recordAvatar"].forEach((id) => {
      const image = $(id);
      if (image) {
        image.src = avatar;
        image.alt = name + " Discord avatar";
      }
    });

    [["memberUsername", username],["sidebarUsername", username],["welcomeName", name + "."],["memberDashboardRank", memberRank],
     ["recordName", name],["recordRank", memberRank],["recordStatus", isStaff ? "Verified Staff" : "Verified"]]
      .forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });

    if ($("sidebarRank")) $("sidebarRank").textContent = memberRank;
    if ($("memberType")) $("memberType").textContent = isStaff ? "Staff" : "Member";
    if ($("memberStatus")) $("memberStatus").textContent = isStaff ? "Verified Staff" : "Verified Member";
    if ($("memberStatusDetail")) $("memberStatusDetail").textContent = isStaff ? "Staff role detected on Discord" : "Discord account connected";
    if ($("welcomeSubtext")) $("welcomeSubtext").textContent = "Here’s what’s happening across Missouri State Roleplay right now.";

    if ($("greetingPeriod")) {
      const hour = new Date().getHours();
      $("greetingPeriod").textContent = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    }


    sessionStorage.setItem("msrp_discord_user", user.id);
    sessionStorage.setItem("msrp_is_staff", String(isStaff));
    if (isStaff) sessionStorage.setItem("msrp_staff_rank", memberRank);
    else sessionStorage.removeItem("msrp_staff_rank");


    if (memberDash) memberDash.hidden = false;
    if (loginDash) loginDash.hidden = true;

  }

  async function load() {
    const accessToken = callback() || token();

    if (!accessToken) {
      if (memberDash) memberDash.hidden = true;
      if (loginDash) loginDash.hidden = false;
      return;
    }

    try {
      error("");
      const [user, member] = await Promise.all([
        api("/users/@me", accessToken),
        api("/users/@me/guilds/" + encodeURIComponent(A.guildId) + "/member", accessToken)
      ]);

      if (!member || !Array.isArray(member.roles)) throw new Error("not member");
      render(user, member);
      page("dashboard");
      setDashboardView("overview");
    } catch (failure) {
      console.error(failure);
      ["msrp_discord_token","msrp_discord_expires","msrp_oauth_state","msrp_is_staff","msrp_staff_rank","msrp_discord_user"]
        .forEach((key) => sessionStorage.removeItem(key));

      if (memberDash) memberDash.hidden = true;
      if (loginDash) loginDash.hidden = false;

      error(
        failure.status === 401 || failure.status === 403 || failure.message === "not member"
          ? "Your Discord account could not be verified as an MSRP member."
          : "We could not verify your Discord session. Please sign in again."
      );
    }
  }

  function logout() {
    ["msrp_discord_token","msrp_discord_expires","msrp_oauth_state","msrp_is_staff","msrp_staff_rank","msrp_discord_user"]
      .forEach((key) => sessionStorage.removeItem(key));

    if (memberDash) memberDash.hidden = true;
    if (loginDash) loginDash.hidden = false;
    page("dashboard");
  }

  nav.forEach((item) => item.addEventListener("click", () => {
    const target = item.dataset.page;
    if (target === "record") {
      const t = token();
      if (t) load();
    }
  }));

  document.querySelectorAll("[data-dashboard-view]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const view = item.dataset.dashboardView;
      setDashboardView(view);
    });
  });


  const logoutButtons = [$("dashboardLogout")];
  logoutButtons.forEach((button) => { if (button) button.onclick = logout; });

  [$("dashboardDiscord"), $("recordDiscord")].forEach((button) => {
    if (button) button.onclick = loginStart;
  });

  stats();

  const initialHash = location.hash.slice(1);
  page(location.hash.includes("access_token=") ? "dashboard" : (names.has(initialHash) ? initialHash : "home"), false);

  if (location.hash.includes("access_token=") || initialHash === "dashboard" || initialHash === "record") {
    load();
  } else {
    if (memberDash) memberDash.hidden = true;
    if (loginDash) loginDash.hidden = false;
    setDashboardView("overview");
  }
});