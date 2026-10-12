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

  function profileRouteId() {
    const match = location.hash.match(/^#profile-([A-Za-z0-9-]+)$/i);
    return match ? match[1].toUpperCase() : null;
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

    const mainPanel = document.querySelector(".member-main");
    if (mainPanel) {
      mainPanel.classList.remove("msrp-view-enter");
      void mainPanel.offsetWidth;
      mainPanel.classList.add("msrp-view-enter");
    }

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

  const dashboardBack = document.querySelector(".dashboard-back");
  if (dashboardBack) {
    dashboardBack.addEventListener("click", (event) => {
      event.preventDefault();
      page("home");
    });
  }

  const accountLink = document.querySelector(".account-account-link");
  if (accountLink) {
    accountLink.addEventListener("click", (event) => {
      event.preventDefault();
      page("record");
    });
  }

  const sidebarHomeButton = $("sidebarHomeButton");
  if (sidebarHomeButton) {
    sidebarHomeButton.addEventListener("click", () => page("home"));
  }

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

    ["memberAvatar","sidebarAvatar","welcomeAvatar","profileCardAvatar","profilePreviewAvatar","recordAvatar"].forEach((id) => {
      const image = $(id);
      if (image) {
        image.src = avatar;
        image.alt = name + " Discord avatar";
      }
    });

    [["memberUsername", username],["sidebarUsername", username],["welcomeName", name + "."],["memberDashboardRank", memberRank],
     ["recordName", name],["recordRank", memberRank],["recordStatus", isStaff ? "Verified Staff" : "Verified"]]
      .forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });

    if ($("sidebarRank")) $("sidebarRank").textContent = isStaff ? memberRank : "Citizen";
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
      const openingProfile = profileRouteId();
      page("dashboard", !openingProfile);
      setDashboardView(openingProfile ? "community" : "overview");
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


  // Demo leaderboard controls: reorder the 50 placeholder rows by selected category.
  const leaderTabs = [...document.querySelectorAll("[data-leaderboard-sort]")];
  const leaderList = document.querySelector(".msrp-leaderboard-list");
  const leaderLabel = document.querySelector("[data-leaderboard-label]");
  function sortLeaderboard(metric) {
    if (!leaderList) return;
    const labels = { playtime: "Playtime", kills: "Most Kills", deaths: "Most Deaths" };
    const rows = [...leaderList.querySelectorAll(".msrp-leader-row")];
    rows.sort((a, b) => Number(b.dataset[metric]) - Number(a.dataset[metric]));
    rows.forEach((row, index) => {
      const rank = row.querySelector(".msrp-leader-rank");
      if (index === 0) {
        rank.setAttribute("aria-label", "Rank 1");
        rank.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 7.5 11 12 4l4.5 7 4.5-3.5-2 11H5L3 7.5Z"/><path d="M5.5 21h13M7.5 15.5h9"/></svg>';
      } else if (index === 1) {
        rank.setAttribute("aria-label", "Rank 2");
        rank.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l-1 5a4 4 0 0 1-8 0L7 4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/></svg>';
      } else if (index === 2) {
        rank.setAttribute("aria-label", "Rank 3");
        rank.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l-1 5a4 4 0 0 1-8 0L7 4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/></svg>';
      } else {
        rank.setAttribute("aria-label", "Rank " + (index + 1));
        rank.innerHTML = '<span class="msrp-rank-number">' + (index + 1) + '</span>';
      }
      const value = row.querySelector("[data-value]");
      if (metric === "playtime") {
        const minutes = Number(row.dataset.playtime);
        value.textContent = Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
      } else value.textContent = row.dataset[metric];
      leaderList.appendChild(row);
    });
    leaderTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.leaderboardSort === metric));
    if (leaderLabel) leaderLabel.textContent = labels[metric] || "Playtime";
  }
  leaderTabs.forEach((tab) => tab.addEventListener("click", () => sortLeaderboard(tab.dataset.leaderboardSort)));
  sortLeaderboard("playtime");

  const logoutButtons = [$("dashboardLogout")];
  logoutButtons.forEach((button) => { if (button) button.onclick = logout; });

  [$("dashboardDiscord"), $("recordDiscord")].forEach((button) => {
    if (button) button.onclick = loginStart;
  });

  stats();

  window.addEventListener("hashchange", () => {
    const target = location.hash.slice(1);
    if (profileRouteId()) {
      page("dashboard", false);
      load();
      return;
    }
    if (names.has(target)) {
      page(target, false);
      if (target === "dashboard") {
        setDashboardView("community");
        load();
      } else if (target === "record") load();
    }
  });





  const initialHash = location.hash.slice(1);
  const initialProfileRoute = profileRouteId();
  page(location.hash.includes("access_token=") || initialProfileRoute ? "dashboard" : (names.has(initialHash) ? initialHash : "home"), false);

  if (location.hash.includes("access_token=") || initialProfileRoute || initialHash === "dashboard" || initialHash === "record") {
    load();
  } else {
    if (memberDash) memberDash.hidden = true;
    if (loginDash) loginDash.hidden = false;
    setDashboardView("overview");
  }

  // Community Profiles: interactive front-end preview using clearly labelled sample data.
  const communityRoot = $("dashboardCommunityView");
  if (communityRoot) {
    const sampleMembers = [
      {id:1,profileId:"MSRP-000101",name:"RiverCarter",role:"Member",bio:"Enjoying realistic roleplay around Missouri.",status:"On patrol",active:3,likes:28,joined:1,accent:"cyan",initials:"RC"},
{id:2,profileId:"MSRP-000102",name:"MasonJett",role:"Staff",bio:"Helping keep the community welcoming and organized.",status:"Available",active:8,likes:42,joined:2,accent:"blue",initials:"MJ"},
{id:3,profileId:"MSRP-000103",name:"TaylorStone",role:"Member",bio:"Fire and rescue roleplay enthusiast.",status:"In game",active:14,likes:19,joined:3,accent:"gold",initials:"TS"},
{id:4,profileId:"MSRP-000104",name:"AlexWest",role:"Staff",bio:"Moderation team sample profile.",status:"Working",active:20,likes:37,joined:4,accent:"violet",initials:"AW"},
{id:5,profileId:"MSRP-000105",name:"JordanLake",role:"Member",bio:"Here for good scenes and great teammates.",status:"Chilling",active:33,likes:16,joined:5,accent:"cyan",initials:"JL"},
{id:6,profileId:"MSRP-000106",name:"KaiMorgan",role:"Member",bio:"Learning new departments and meeting people.",status:"Available",active:45,likes:12,joined:6,accent:"blue",initials:"KM"},
{id:7,profileId:"MSRP-000107",name:"ParkerReed",role:"Staff",bio:"Supporting training and department standards.",status:"On duty",active:62,likes:55,joined:7,accent:"gold",initials:"PR"},
{id:8,profileId:"MSRP-000108",name:"JamieBrooks",role:"Member",bio:"I enjoy driving, dispatch, and teamwork.",status:"In game",active:90,likes:21,joined:8,accent:"violet",initials:"JB"},
{id:9,profileId:"MSRP-000109",name:"CameronPrice",role:"Staff",bio:"Community support and member assistance.",status:"Available",active:130,likes:31,joined:9,accent:"blue",initials:"CP"},
{id:10,profileId:"MSRP-000110",name:"DrewBennett",role:"Member",bio:"Building memorable roleplay moments.",status:"Away",active:190,likes:9,joined:10,accent:"cyan",initials:"DB"},
{id:11,profileId:"MSRP-000111",name:"MorganEllis",role:"Staff",bio:"Helping the staff team improve every day.",status:"On duty",active:260,likes:64,joined:11,accent:"gold",initials:"ME"},
{id:12,profileId:"MSRP-000112",name:"ReeseParker",role:"Member",bio:"New around here—say hello!",status:"Available",active:360,likes:7,joined:12,accent:"violet",initials:"RP"}
    ];
    const communityState = {filter:"active", query:"", shown:6, following:new Set(), liked:new Set(), selected:null};
    const byId = (id) => $(id);
    const safeText = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    const initials = (name) => name.split(/(?=[A-Z])/).slice(0,2).map((part) => part[0]).join("").toUpperCase();
    const accentClass = (accent) => ["cyan","blue","violet","gold"].includes(accent) ? accent : "cyan";
    const profileStoreKey = "msrp_community_profile_preview";
    const communityModalHome = { parent: null, next: null };
    let savedProfile = {};
    try { savedProfile = JSON.parse(localStorage.getItem(profileStoreKey) || "{}"); } catch (_) { savedProfile = {}; }

    function filteredMembers() {
      const q = communityState.query.trim().toLowerCase();
      let list = sampleMembers.filter((m) => !q || [m.name,m.role,m.bio,m.status].some((v) => v.toLowerCase().includes(q)));
      if (communityState.filter === "friends") list = list.filter((m) => communityState.following.has(m.id));
      if (communityState.filter === "staff") list = list.filter((m) => m.role.toLowerCase().includes("staff") || m.role.toLowerCase().includes("rank"));
      if (communityState.filter === "liked") list.sort((a,b) => b.likes-a.likes);
      if (communityState.filter === "newest") list.sort((a,b) => a.joined-b.joined);
      if (communityState.filter === "az") list.sort((a,b) => a.name.localeCompare(b.name));
      if (communityState.filter === "active") list.sort((a,b) => a.active-b.active);
      return list;
    }
    function profileCard(m, suggested=false) {
      const following = communityState.following.has(m.id);
      const liked = communityState.liked.has(m.id);
      if (suggested) return '<article class="community-suggested-card accent-'+accentClass(m.accent)+'"><button type="button" class="community-suggested-profile" data-community-open="'+m.id+'"><span class="community-avatar">'+initials(m.name)+'</span><strong>'+safeText(m.name)+'</strong><small>'+safeText(m.role)+'</small></button><button type="button" class="community-follow-button '+(following?'is-following':'')+'" data-community-follow="'+m.id+'">'+(following?'Following':'Follow')+'</button></article>';
      return '<article class="community-profile-card accent-'+accentClass(m.accent)+'"><button type="button" class="community-card-open" data-community-open="'+m.id+'" aria-label="View '+safeText(m.name)+' profile"><span class="community-card-banner"></span><span class="community-avatar community-card-avatar">'+initials(m.name)+'</span><strong class="community-card-name">'+safeText(m.name)+'</strong><span class="community-role-pill">'+safeText(m.role)+'</span><span class="community-card-bio">'+safeText(m.bio)+'</span></button><div class="community-card-footer"><span>Active '+(m.active<60?m.active+'m':Math.floor(m.active/60)+'h')+' ago</span><button type="button" class="community-like-button '+(liked?'is-liked':'')+'" data-community-like="'+m.id+'" aria-label="Like '+safeText(m.name)+' profile">♥ <span>'+(m.likes+(liked?1:0))+'</span></button></div><button type="button" class="community-card-follow '+(following?'is-following':'')+'" data-community-follow="'+m.id+'">'+(following?'Following':'Follow')+'</button></article>';
    }
    function renderCommunity() {
      const all = filteredMembers();
      const visible = all.slice(0, communityState.shown);
      byId("communityProfileGrid").innerHTML = visible.map((m) => profileCard(m)).join("");
      byId("communitySuggested").innerHTML = sampleMembers.filter((m) => !communityState.following.has(m.id)).slice(0,7).map((m) => profileCard(m,true)).join("");
      byId("communityResultCount").textContent = all.length + " sample profile" + (all.length===1?"":"s");
      byId("communityEmpty").hidden = all.length>0;
      byId("communityShowMore").hidden = communityState.shown>=all.length || all.length===0;
      byId("communityShowMore").textContent = "Show more profiles ("+(all.length-communityState.shown)+")";
    }
    function openCommunityModal(member=null, updateRoute=true) {
      communityState.selected = member;
      const own = !member;
      if (own) member = {id:0,profileId:"MSRP-OWN",name:savedProfile.name || "nemorbx",role:"Staff",status:"Online",bio:savedProfile.bio || "Proud member of Missouri State Roleplay.",accent:savedProfile.accent || "cyan",likes:0,views:0,active:0,joined:"Sep 2026"};
      const modal = byId("communityModal");
      const dashboardMain = document.querySelector(".member-main");
      if (dashboardMain && modal.parentElement !== dashboardMain) dashboardMain.appendChild(modal);
      const panel = modal.querySelector(".community-modal");
      const fullProfile = byId("communityFullProfile");
      byId("communityModalEyebrow").hidden = true;
      byId("communityModalTitle").hidden = true;
      byId("communityModalDescription").hidden = true;
      byId("communityModalDescription").textContent = "";
      byId("communityProfileForm").hidden = true;
      fullProfile.hidden = false;
      modal.classList.add("profile-open");
      panel.classList.add("community-modal-fullscreen");
      if (own) {
        byId("communityStatus").value = savedProfile.status || "";
        byId("communityPronouns").value = savedProfile.pronouns || "";
        byId("communityBio").value = savedProfile.bio || "";
        byId("communityBioCount").textContent = String((savedProfile.bio || "").length);
        byId("communityPrivateProfile").checked = Boolean(savedProfile.private);
        const selectedShowcase = new Set(savedProfile.showcase || []);
        document.querySelectorAll("[data-showcase-badge]").forEach((button) => button.classList.toggle("selected", selectedShowcase.has(button.dataset.showcaseBadge)));
        const selectedTheme = savedProfile.theme || "default";
        document.querySelectorAll("[data-profile-theme]").forEach((button) => button.classList.toggle("active", button.dataset.profileTheme === selectedTheme));
        renderPinnedBadgeOptions();
        updateEditorCounts();
      }
      {
        const following = communityState.following.has(member.id);
        const liked = communityState.liked.has(member.id);
        const previewSet = [
          {joined:"Jan 2025",streak:"4 days",badges:0,cosmetics:0,last:"now",about:""},
          {joined:"Mar 2025",streak:"2 days",badges:0,cosmetics:0,last:"12m ago",about:""},
          {joined:"Oct 2024",streak:"1 day",badges:0,cosmetics:0,last:"3h ago",about:""},
          {joined:"Jul 2025",streak:"6 days",badges:0,cosmetics:0,last:"1d ago",about:""},
          {joined:"Feb 2026",streak:"3 days",badges:0,cosmetics:0,last:"27m ago",about:""},
          {joined:"Sep 2026",streak:"1 day",badges:0,cosmetics:0,last:"now",about:""}
        ];
        const preview = own ? {joined:"Oct 2026",streak:"1 day",badges:0,cosmetics:0,last:"now",about:""} : previewSet[(Math.max(1,member.id)-1)%previewSet.length];
        fullProfile.innerHTML = `
          <div class="community-profile-back-row">
            <button type="button" class="community-back-everyone" data-profile-back>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Everyone</span>
            </button>
          </div>
          <div class="community-full-hero">
            <div class="community-full-banner profile-theme-${safeText(own ? (savedProfile.theme || "default") : "default")}"></div>
            <div class="community-full-identity">
              <span class="community-avatar community-full-avatar">${member.avatarUrl ? '<img src="' + safeText(member.avatarUrl) + '" alt="" loading="eager" onerror="this.remove();this.parentElement.textContent=initials(member.name)">' : initials(member.name)}</span>
              <div class="community-full-name">
                <h2>${safeText(own ? (savedProfile.name || member.name) : member.name)}</h2>
                ${own && savedProfile.status ? '<p class="community-profile-status">'+safeText(savedProfile.status)+'</p>' : ''}
                ${own && savedProfile.pronouns ? '<span class="community-profile-pronouns">'+safeText(savedProfile.pronouns)+'</span>' : ''}
                ${own && (savedProfile.pinned || []).length ? '<div class="community-profile-pinned-badges">'+savedProfile.pinned.map(id=>{const names={"linked-up":"Linked Up","3-day-streak":"3-Day Streak","window-shopper":"Window Shopper","news-reader":"News Reader","first-ticket":"First Ticket","early-supporter":"Early Supporter"};return '<span class="community-profile-pinned-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12 6 6l8 3M24 12l2-6-8 3" fill="currentColor"/><circle cx="16" cy="17" r="10" fill="none" stroke="currentColor"/><ellipse cx="11.5" cy="15" rx="2.5" ry="3.3" fill="currentColor"/><ellipse cx="20.5" cy="15" rx="2.5" ry="3.3" fill="currentColor"/><path d="M14 19q2 2 4 0" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'+safeText(names[id]||id)+'</span>';}).join('')+'</div>' : ''}
                <div class="community-full-mini-stats">
                  <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg> ${member.views || 0} views</span>
                  <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/></svg> ${member.likes + (liked ? 1 : 0)} likes</span>
                  <span>${communityState.following.size} followers</span><span>${communityState.following.size} following</span><span>0 friends</span>
                </div>
              </div>
              <div class="community-full-actions">
                <button type="button" class="community-primary-button" ${own ? 'data-own-profile-edit' : 'data-full-follow="' + member.id + '"'}>${own ? 'Edit profile' : (following ? 'Following' : 'Follow')}</button>
                <button type="button" class="community-secondary-button community-square-action" data-full-like="${member.id}" aria-label="Like profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg></button>
                <button type="button" class="community-secondary-button community-square-action" aria-label="Flag profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4m0 1h13l-2.5 4L18 13H5"/></svg></button>
                <button type="button" class="community-secondary-button community-square-action" data-profile-copy="${safeText(member.profileId)}" aria-label="Copy profile link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1L11 4.9M14 11a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1l1.8-1.8"/></svg></button>
              </div>
            </div>
          </div>
          <div class="community-full-content">
            <div class="community-full-stats">
              <div><strong>${preview.joined}</strong><span>Joined</span></div>
              <div><strong>${preview.streak}</strong><span>Login streak</span></div>
              <div><strong>0 <small>/ 33</small></strong><span>Badges</span></div>
              <div><strong>0</strong><span>Cosmetics</span></div>
              <div><strong>${preview.last}</strong><span>Last seen</span></div>
            </div>
            <div class="community-full-columns">
              <div class="community-full-main-column">
                <section class="community-full-panel community-about-panel">
                  <span class="community-eyebrow">ABOUT</span>
                  <p>${safeText(own ? (savedProfile.bio || 'Nothing here yet.') : (preview.about || 'Nothing here yet.'))}</p>
                </section>
                <section class="community-full-panel community-showcase-panel">
                  <span class="community-eyebrow">SHOWCASE</span>
                  <p class="community-empty-state">Nothing on show yet.</p>
                </section>
              </div>
              <aside class="community-full-side-column">
                ${member.robloxUsername ? '<section class="community-full-panel community-roblox-panel"><div class="community-roblox-card"><span class="community-roblox-icon" aria-hidden="true">R</span><div class="community-roblox-copy"><span class="community-eyebrow">ROBLOX</span><strong>' + safeText(member.robloxUsername) + '</strong></div></div></section>' : ''}
                <section class="community-full-panel community-badges-panel">
                  <div class="community-badge-heading"><span class="community-eyebrow">BADGES</span><span>${own ? (savedProfile.showcase || []).length : 0} of 33</span></div>
                  ${own && (savedProfile.showcase || []).length ? '<div class="community-profile-showcase-list">'+savedProfile.showcase.map(id=>{const names={"linked-up":"Linked Up","3-day-streak":"3-Day Streak","window-shopper":"Window Shopper","news-reader":"News Reader","first-ticket":"First Ticket","early-supporter":"Early Supporter"};return '<span class="community-profile-showcase-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12 6 6l8 3M24 12l2-6-8 3" fill="currentColor"/><circle cx="16" cy="17" r="10" fill="none" stroke="currentColor"/><ellipse cx="11.5" cy="15" rx="2.5" ry="3.3" fill="currentColor"/><ellipse cx="20.5" cy="15" rx="2.5" ry="3.3" fill="currentColor"/><path d="M14 19q2 2 4 0" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'+safeText(names[id]||id)+'</span>';}).join('')+'</div>' : '<p class="community-empty-state">No badges yet.</p>'}
                </section>
                <section class="community-full-panel community-cosmetics-panel">
                  <span class="community-eyebrow">COSMETICS</span>
                  <p class="community-empty-state">Nothing here yet.</p>
                </section>
              </aside>
            </div>
          </div>`;
      }
      modal.hidden = false;
      document.body.classList.add("msrp-profile-page-open");
      if (!own && updateRoute) {
        history.pushState({msrpProfileId: member.profileId}, "", "#profile-" + member.profileId);
      }
      byId("communityModalClose").focus();
    }
    function closeCommunityModal() {
      const modal = byId("communityModal");
      modal.hidden = true;
      document.body.classList.remove("msrp-profile-page-open");
      modal.classList.remove("profile-open");
      
      if (profileRouteId()) history.replaceState({msrpDashboardView:"community"}, "", "#dashboard");
      modal.querySelector(".community-modal").classList.remove("community-modal-fullscreen");
    }
    byId("communitySearch").addEventListener("input", (event) => { communityState.query=event.target.value; communityState.shown=6; renderCommunity(); });
    byId("communityFilters").addEventListener("click", (event) => {
      const button=event.target.closest("[data-community-filter]"); if(!button)return;
      communityState.filter=button.dataset.communityFilter; communityState.shown=6;
      byId("communityFilters").querySelectorAll("button").forEach((b)=>b.classList.toggle("active",b===button)); renderCommunity();
    });
    communityRoot.addEventListener("click", (event) => {
      const follow=event.target.closest("[data-community-follow]");
      const like=event.target.closest("[data-community-like]");
      const open=event.target.closest("[data-community-open]");
      if(follow){const id=Number(follow.dataset.communityFollow);communityState.following.has(id)?communityState.following.delete(id):communityState.following.add(id);renderCommunity();return;}
      if(like){const id=Number(like.dataset.communityLike);communityState.liked.has(id)?communityState.liked.delete(id):communityState.liked.add(id);renderCommunity();return;}
      if(open){const m=sampleMembers.find((item)=>item.id===Number(open.dataset.communityOpen));if(m)openCommunityModal(m);}
    });
    byId("communityShowMore").addEventListener("click", () => { communityState.shown+=6; renderCommunity(); });
    byId("communityEditProfile").addEventListener("click", () => openCommunityModal());
    byId("communityFullProfile").addEventListener("click", (event) => {
      const back = event.target.closest("[data-profile-back]");
      const editOwn = event.target.closest("[data-own-profile-edit]");
      if (editOwn) {
        openProfileEditor();
        return;
      }
      const copy = event.target.closest("[data-profile-copy]");
      if (back) { closeCommunityModal(); return; }
      if (copy) {
        const url = location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).catch(() => {});
        return;
      }
      const follow = event.target.closest("[data-full-follow]");
      const like = event.target.closest("[data-full-like]");
      if (follow && communityState.selected) {
        const id=Number(follow.dataset.fullFollow);
        communityState.following.has(id) ? communityState.following.delete(id) : communityState.following.add(id);
        const member=communityState.selected; renderCommunity(); openCommunityModal(member); return;
      }
      if (like && communityState.selected) {
        const id=Number(like.dataset.fullLike);
        communityState.liked.has(id) ? communityState.liked.delete(id) : communityState.liked.add(id);
        const member=communityState.selected; renderCommunity(); openCommunityModal(member);
      }
    });
    byId("communityModalClose").addEventListener("click", closeCommunityModal);
    byId("communityModalCancel").addEventListener("click", closeCommunityModal);
    byId("communityModal").addEventListener("click", (event) => { if(event.target===byId("communityModal"))closeCommunityModal(); });
    function updateEditorCounts() {
      const chosen = [...document.querySelectorAll("[data-showcase-badge].selected")].map((button) => button.dataset.showcaseBadge);
      byId("communityShowcaseCount").textContent = chosen.length + " / 6 picked";
      byId("communityPinnedCount").textContent = (savedProfile.pinned || []).length + " / 3";
    }
    function renderPinnedBadgeOptions() {
      const chosen = new Set(savedProfile.pinned || []);
      const container = byId("communityPinnedOptions");
      container.innerHTML = "";
      document.querySelectorAll("[data-showcase-badge].selected").forEach((button) => {
        const id = button.dataset.showcaseBadge;
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "msrp-pinned-badge" + (chosen.has(id) ? " selected" : "");
        pin.dataset.pinnedBadge = id;
        pin.textContent = button.querySelector("strong").textContent;
        container.appendChild(pin);
      });
      updateEditorCounts();
    }
    function openProfileEditor() {
      const form = byId("communityProfileForm");
      form.hidden = false;
      form.classList.add("msrp-profile-editor");
      byId("communityModal").classList.add("msrp-editor-open");
      document.body.classList.add("msrp-editor-visible");
      form.scrollTop = 0;
      byId("communityBio").focus();
    }
    function closeProfileEditor() {
      byId("communityProfileForm").hidden = true;
      byId("communityModal").classList.remove("msrp-editor-open");
      document.body.classList.remove("msrp-editor-visible");
    }
    byId("communityBio").addEventListener("input", () => byId("communityBioCount").textContent = String(byId("communityBio").value.length));
    byId("communityShowcaseOptions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-showcase-badge]");
      if (!button) return;
      const selected = document.querySelectorAll("[data-showcase-badge].selected");
      if (!button.classList.contains("selected") && selected.length >= 6) return;
      button.classList.toggle("selected");
      if (!button.classList.contains("selected")) savedProfile.pinned = (savedProfile.pinned || []).filter((id) => id !== button.dataset.showcaseBadge);
      renderPinnedBadgeOptions();
    });
    byId("communityPinnedOptions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-pinned-badge]");
      if (!button) return;
      const id = button.dataset.pinnedBadge;
      const pinned = new Set(savedProfile.pinned || []);
      if (pinned.has(id)) pinned.delete(id);
      else if (pinned.size < 3) pinned.add(id);
      savedProfile.pinned = [...pinned];
      renderPinnedBadgeOptions();
    });
    byId("communityThemeOptions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-profile-theme]");
      if (!button) return;
      document.querySelectorAll("[data-profile-theme]").forEach((item) => item.classList.toggle("active", item === button));
      savedProfile.theme = button.dataset.profileTheme;
      try { localStorage.setItem(profileStoreKey, JSON.stringify(savedProfile)); } catch (_) {}
      const banner = byId("communityFullProfile")?.querySelector(".community-full-banner");
      if (banner) banner.className = "community-full-banner profile-theme-" + button.dataset.profileTheme;
    });
    byId("communityEditorClose").addEventListener("click", closeProfileEditor);
    byId("communityModalCancel").addEventListener("click", () => {
      if (!byId("communityProfileForm").hidden) closeProfileEditor();
      else closeCommunityModal();
    });
    byId("communityProfileForm").addEventListener("submit", (event) => {
      event.preventDefault();
      savedProfile = {
        ...savedProfile,
        status: byId("communityStatus").value.trim(),
        pronouns: byId("communityPronouns").value.trim(),
        bio: byId("communityBio").value.trim(),
        showcase: [...document.querySelectorAll("[data-showcase-badge].selected")].map((button) => button.dataset.showcaseBadge),
        theme: document.querySelector("[data-profile-theme].active")?.dataset.profileTheme || "default",
        private: byId("communityPrivateProfile").checked,
        pinned: savedProfile.pinned || []
      };
      try { localStorage.setItem(profileStoreKey,JSON.stringify(savedProfile)); } catch (_) {}
      closeProfileEditor();
      openCommunityModal(null, false);
    });
    renderCommunity();
    const routedProfileId = profileRouteId();
    if (routedProfileId) {
      const routedMember = sampleMembers.find((member) => member.profileId === routedProfileId);
      if (routedMember) openCommunityModal(routedMember, false);
      else {
        history.replaceState({msrpDashboardView:"community"}, "", "#dashboard");
        setDashboardView("community");
      }
    }
  }

});