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
    if (names.has(target)) {
      page(target, false);
      if (target === "dashboard" || target === "record") load();
    }
  });





  const initialHash = location.hash.slice(1);
  page(location.hash.includes("access_token=") ? "dashboard" : (names.has(initialHash) ? initialHash : "home"), false);

  if (location.hash.includes("access_token=") || initialHash === "dashboard" || initialHash === "record") {
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
      {id:1,name:"RiverCarter",role:"Member",bio:"Enjoying realistic roleplay around Missouri.",status:"On patrol",active:3,likes:28,joined:1,accent:"cyan",initials:"RC"},
      {id:2,name:"MasonJett",role:"Staff",bio:"Helping keep the community welcoming and organized.",status:"Available",active:8,likes:42,joined:2,accent:"blue",initials:"MJ"},
      {id:3,name:"TaylorStone",role:"Member",bio:"Fire and rescue roleplay enthusiast.",status:"In game",active:14,likes:19,joined:3,accent:"gold",initials:"TS"},
      {id:4,name:"AlexWest",role:"Staff",bio:"Moderation team sample profile.",status:"Working",active:20,likes:37,joined:4,accent:"violet",initials:"AW"},
      {id:5,name:"JordanLake",role:"Member",bio:"Here for good scenes and great teammates.",status:"Chilling",active:33,likes:16,joined:5,accent:"cyan",initials:"JL"},
      {id:6,name:"KaiMorgan",role:"Member",bio:"Learning new departments and meeting people.",status:"Available",active:45,likes:12,joined:6,accent:"blue",initials:"KM"},
      {id:7,name:"ParkerReed",role:"High Rank",bio:"Supporting training and department standards.",status:"On duty",active:62,likes:55,joined:7,accent:"gold",initials:"PR"},
      {id:8,name:"JamieBrooks",role:"Member",bio:"I enjoy driving, dispatch, and teamwork.",status:"In game",active:90,likes:21,joined:8,accent:"violet",initials:"JB"},
      {id:9,name:"CameronPrice",role:"Staff",bio:"Community support and member assistance.",status:"Available",active:130,likes:31,joined:9,accent:"blue",initials:"CP"},
      {id:10,name:"DrewBennett",role:"Member",bio:"Building memorable roleplay moments.",status:"Away",active:190,likes:9,joined:10,accent:"cyan",initials:"DB"},
      {id:11,name:"MorganEllis",role:"Senior High Rank",bio:"Helping the staff team improve every day.",status:"On duty",active:260,likes:64,joined:11,accent:"gold",initials:"ME"},
      {id:12,name:"ReeseParker",role:"Member",bio:"New around here—say hello!",status:"Available",active:360,likes:7,joined:12,accent:"violet",initials:"RP"}
    ];
    const communityState = {filter:"active", query:"", shown:6, following:new Set(), liked:new Set(), selected:null};
    const byId = (id) => $(id);
    const safeText = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    const initials = (name) => name.split(/(?=[A-Z])/).slice(0,2).map((part) => part[0]).join("").toUpperCase();
    const accentClass = (accent) => ["cyan","blue","violet","gold"].includes(accent) ? accent : "cyan";
    const profileStoreKey = "msrp_community_profile_preview";
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
    function openCommunityModal(member=null) {
      communityState.selected = member;
      const own = !member;
      const modal = byId("communityModal");
      const panel = modal.querySelector(".community-modal");
      const fullProfile = byId("communityFullProfile");
      byId("communityModalEyebrow").textContent = own ? "YOUR PROFILE PREVIEW" : "MSRP COMMUNITY PROFILE";
      byId("communityModalTitle").textContent = own ? "Edit your profile" : member.name;
      byId("communityModalDescription").hidden = !own;
      byId("communityModalDescription").textContent = own ? "Customize how your placeholder profile appears." : "";
      byId("communityProfileForm").hidden = !own;
      fullProfile.hidden = own;
      modal.classList.toggle("profile-open", !own);
      panel.classList.toggle("community-modal-fullscreen", !own);
      if (own) {
        byId("communityDisplayName").value = savedProfile.name || "MSRP Member";
        byId("communityBio").value = savedProfile.bio || "Proud member of Missouri State Roleplay.";
        byId("communityAccent").value = savedProfile.accent || "cyan";
      } else {
        const following = communityState.following.has(member.id);
        const liked = communityState.liked.has(member.id);
        fullProfile.innerHTML = '<div class="community-full-banner accent-'+accentClass(member.accent)+'"><div class="community-full-topline"><span>MSRP MEMBER PROFILE</span><span class="community-online-indicator">● '+safeText(member.status)+'</span></div><div class="community-full-identity"><span class="community-avatar community-full-avatar">'+initials(member.name)+'</span><div class="community-full-name"><h2>'+safeText(member.name)+'</h2><span class="community-role-pill">'+safeText(member.role)+'</span><p>Member of Missouri State Roleplay</p></div><div class="community-full-actions"><button type="button" class="community-primary-button" data-full-follow="'+member.id+'">'+(following?'Following':'Follow')+'</button><button type="button" class="community-secondary-button" data-full-like="'+member.id+'">'+(liked?'♥ Liked':'♡ Like')+'</button></div></div></div><div class="community-full-content"><div class="community-full-stats"><div><strong>'+member.joined+'</strong><span>Profile ID</span></div><div><strong>'+member.likes+(liked?1:0)+'</strong><span>Likes</span></div><div><strong>'+communityState.following.size+'</strong><span>Following</span></div><div><strong>'+(member.active<60?member.active+'m':Math.floor(member.active/60)+'h')+'</strong><span>Last active</span></div></div><div class="community-full-columns"><div class="community-full-main-column"><section class="community-full-panel"><span class="community-eyebrow">ABOUT</span><p>'+safeText(member.bio)+'</p></section><section class="community-full-panel"><span class="community-eyebrow">SHOWCASE</span><p class="community-placeholder-copy">Nothing on show yet.</p></section><section class="community-full-panel"><span class="community-eyebrow">RECENT ACTIVITY</span><div class="community-activity-placeholder"><span class="community-activity-dot"></span><div><strong>Community profile viewed</strong><small>This is sample activity for the layout preview.</small></div></div></section></div><aside class="community-full-side-column"><section class="community-full-panel"><span class="community-eyebrow">MEMBER BADGES</span><div class="community-badge-list"><span>✦ Community Member</span><span>✦ MSRP Welcome</span><span>✦ Profile Preview</span></div></section><section class="community-full-panel"><span class="community-eyebrow">PROFILE DETAILS</span><div class="community-detail-row"><span>Rank</span><strong>'+safeText(member.role)+'</strong></div><div class="community-detail-row"><span>Status</span><strong>'+safeText(member.status)+'</strong></div><div class="community-detail-row"><span>Joined</span><strong>Sample data</strong></div></section></aside></div><p class="community-full-disclaimer">Placeholder profile — member information, badges, and activity are sample data until connected to the MSRP backend.</p></div>';
      }
      modal.hidden = false;
      byId("communityModalClose").focus();
    }
    function closeCommunityModal() {
      const modal = byId("communityModal");
      modal.hidden = true;
      modal.classList.remove("profile-open");
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
    byId("communityProfileForm").addEventListener("submit", (event) => {
      event.preventDefault(); savedProfile={name:byId("communityDisplayName").value.trim()||"MSRP Member",bio:byId("communityBio").value.trim(),accent:byId("communityAccent").value};
      try { localStorage.setItem(profileStoreKey,JSON.stringify(savedProfile)); } catch (_) {}
      closeCommunityModal();
    });
    renderCommunity();
  }

});