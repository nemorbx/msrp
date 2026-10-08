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


  /* Dashboard editor: resize-only panel shaping with a separate inside-edit mode. */
  function setupDashboardEditor(){
    const toggle = $("dashboardEditToggle");
    if (!toggle || !memberDash) return;

    const panelSelectors = [
      ".dashboard-page-title",".account-bar",".account-identity",".account-actions",
      ".member-sidebar",".member-sidebar-section",".member-sidebar-user",".member-main",
      ".member-welcome",".member-welcome-copy",".welcome-heading-row",
      ".player-ring",".member-stat-grid",".member-stat-card",
      "#dashboardCommunityView","#dashboardLeaderboardView","#dashboardInventoryView",
      ".dashboard-community-banner",".leaderboard-panel",".inventory-banner"
    ];

    const panels = [...new Set(panelSelectors.flatMap(sel => [...memberDash.querySelectorAll(sel)]))];
    const panelSet = new Set(panels);
    const editorStore = "msrp_dashboard_editor_v3_";

    function visible(el){
      if (!(el instanceof HTMLElement)) return false;
      if (el.closest(".dashboard-editor-ui,.dashboard-editor-note,.dashboard-editor-overlay")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    const children = [...memberDash.querySelectorAll("*")].filter(visible);

    function key(el){
      if (el.dataset.editorId) return el.dataset.editorId;
      const base = el.id || el.className || el.tagName;
      let hash = 0;
      const text = String(base) + "|" + [...memberDash.querySelectorAll(el.tagName)].indexOf(el);
      for(let i=0;i<text.length;i++) hash = ((hash << 5) - hash) + text.charCodeAt(i) | 0;
      el.dataset.editorId = Math.abs(hash).toString(36);
      return el.dataset.editorId;
    }

    function loadSaved(el){
      const raw = localStorage.getItem(editorStore + key(el));
      if(!raw) return;
      try{
        const v = JSON.parse(raw);
        if(v.width) el.style.setProperty("width", v.width + "px", "important");
        if(v.height) el.style.setProperty("height", v.height + "px", "important");
        if(v.fontSize) el.style.fontSize = v.fontSize + "px";
        if(v.lineHeight) el.style.lineHeight = v.lineHeight;
        if(v.letterSpacing != null) el.style.letterSpacing = v.letterSpacing + "px";
        if(v.radius != null) el.style.borderRadius = v.radius + "px";
        if(v.padding) el.style.padding = v.padding;
      }catch{}
    }

    [...new Set([...panels, ...children])].forEach(loadSaved);

    const ui = document.createElement("div");
    ui.className = "dashboard-editor-ui";
    ui.innerHTML =
      '<span class="editor-tool-title">RESIZE</span>' +
      '<label>W <input id="editorWidth" type="number" min="1" step="1"></label>' +
      '<label>H <input id="editorHeight" type="number" min="1" step="1"></label>' +
      '<label>Text <input id="editorFont" type="number" min="1" step=".5"></label>' +
      '<label>Line <input id="editorLine" type="number" min=".1" step=".1"></label>' +
      '<label>Spacing <input id="editorSpacing" type="number" step=".1"></label>' +
      '<label>Radius <input id="editorRadius" type="number" min="0" step="1"></label>' +
      '<button type="button" id="editorEditInside">Edit Inside</button>' +
      '<button type="button" id="editorReset">Reset</button>' +
      '<button type="button" id="editorDone">Done</button>';
    document.body.appendChild(ui);

    const note = document.createElement("div");
    note.className = "dashboard-editor-note";
    note.textContent = "EDIT MODE — select a panel, drag an edge or corner to reshape it. Nothing moves.";
    document.body.appendChild(note);

    const overlay = document.createElement("div");
    overlay.className = "dashboard-editor-overlay";
    overlay.innerHTML =
      '<div class="dashboard-editor-box">' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-n" data-resize="n"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-s" data-resize="s"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-e" data-resize="e"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-w" data-resize="w"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-nw" data-resize="nw"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-ne" data-resize="ne"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-sw" data-resize="sw"></span>' +
        '<span class="dashboard-editor-handle dashboard-editor-handle-se" data-resize="se"></span>' +
      '</div>';
    memberDash.appendChild(overlay);
    const overlayBox = overlay.querySelector(".dashboard-editor-box");

    let selected = null;
    let insideMode = false;
    let resizeState = null;

    let insideRoot = null;

    function targets(){
      return insideMode && insideRoot
        ? children.filter(el => insideRoot.contains(el) && el !== insideRoot)
        : panels;
    }

    function save(el){
      if(!el) return;
      const cs = getComputedStyle(el);
      localStorage.setItem(editorStore + key(el), JSON.stringify({
        width: parseFloat(getComputedStyle(el).width) || el.offsetWidth,
        height: parseFloat(getComputedStyle(el).height) || el.offsetHeight,
        fontSize: parseFloat(cs.fontSize) || 0,
        lineHeight: cs.lineHeight,
        letterSpacing: parseFloat(cs.letterSpacing) || 0,
        radius: parseFloat(cs.borderTopLeftRadius) || 0,
        padding: cs.padding
      }));
    }

    function scaleFor(el){
      const r = el.getBoundingClientRect();
      const w = el.offsetWidth || r.width;
      const h = el.offsetHeight || r.height;
      return {x: w ? r.width / w : 1, y: h ? r.height / h : 1};
    }

    function positionOverlay(){
      if(!selected || !document.body.classList.contains("dashboard-editing")){
        overlay.hidden = true;
        return;
      }
      const targetRect = selected.getBoundingClientRect();
      const parentRect = memberDash.getBoundingClientRect();
      const parentWidth = memberDash.offsetWidth || parentRect.width;
      const parentHeight = memberDash.offsetHeight || parentRect.height;
      const scaleX = parentWidth ? parentRect.width / parentWidth : 1;
      const scaleY = parentHeight ? parentRect.height / parentHeight : 1;
      overlay.hidden = false;
      overlayBox.style.left = ((targetRect.left - parentRect.left) / scaleX) + "px";
      overlayBox.style.top = ((targetRect.top - parentRect.top) / scaleY) + "px";
      overlayBox.style.width = (targetRect.width / scaleX) + "px";
      overlayBox.style.height = (targetRect.height / scaleY) + "px";
    }

    function clearSelection(){
      if(selected) selected.removeAttribute("data-editor-selected");
      selected = null;
      overlay.hidden = true;
    }

    function select(el){
      if(!el || !targets().includes(el)) return;
      if(selected) selected.removeAttribute("data-editor-selected");
      selected = el;
      selected.dataset.editorSelected = "true";
      const r = selected.getBoundingClientRect();
      const cs = getComputedStyle(selected);
      $("editorWidth").value = Math.round(r.width);
      $("editorHeight").value = Math.round(r.height);
      $("editorFont").value = parseFloat(cs.fontSize).toFixed(1).replace(/\\.0$/, "");
      $("editorLine").value = cs.lineHeight === "normal" ? "1.2" : parseFloat(cs.lineHeight);
      $("editorSpacing").value = parseFloat(cs.letterSpacing) || 0;
      $("editorRadius").value = parseFloat(cs.borderTopLeftRadius) || 0;
      $("editorEditInside").textContent = insideMode ? "Lock Panel" : "Edit Inside";
      positionOverlay();
    }

    function setSize(el, width, height){
      if(!el) return;
      el.style.boxSizing = "border-box";
      el.style.minWidth = "0";
      el.style.maxWidth = "none";
      if(width != null) el.style.setProperty("width", Math.max(40, Math.round(width)) + "px", "important");
      if(height != null) el.style.setProperty("height", Math.max(24, Math.round(height)) + "px", "important");
      save(el);
      select(el);
    }

    function beginResize(event){
      if(!selected) return;
      const dir = event.currentTarget.dataset.resize;
      const r = selected.getBoundingClientRect();
      const s = scaleFor(selected);
      resizeState = {
        dir,
        startX: event.clientX,
        startY: event.clientY,
        startW: r.width,
        startH: r.height,
        scaleX: s.x || 1,
        scaleY: s.y || 1
      };
      event.preventDefault();
      event.stopPropagation();
      try{ event.currentTarget.setPointerCapture(event.pointerId); }catch{}
    }

    overlay.querySelectorAll("[data-resize]").forEach(handle => {
      handle.addEventListener("pointerdown", beginResize);
    });

    document.addEventListener("pointermove", event => {
      if(!resizeState || !selected) return;
      const d = resizeState;
      const dx = (event.clientX - d.startX) / d.scaleX;
      const dy = (event.clientY - d.startY) / d.scaleY;
      let w = d.startW;
      let h = d.startH;
      if(d.dir.includes("e")) w = d.startW + dx;
      if(d.dir.includes("w")) w = d.startW - dx;
      if(d.dir.includes("s")) h = d.startH + dy;
      if(d.dir.includes("n")) h = d.startH - dy;
      setSize(selected, w, h);
    });

    document.addEventListener("pointerup", () => {
      if(resizeState && selected) save(selected);
      resizeState = null;
    });

    memberDash.addEventListener("click", event => {
      if(!document.body.classList.contains("dashboard-editing")) return;
      const target = event.target instanceof Element ? event.target.closest("[data-editor-id]") : null;
      if(!target || !memberDash.contains(target)) return;
      if(!targets().includes(target)) return;
      event.preventDefault();
      event.stopPropagation();
      select(target);
    }, true);

    function updateSelected(prop, value){
      if(!selected || value === "") return;
      selected.style[prop] = value;
      save(selected);
      positionOverlay();
    }

    $("editorWidth").addEventListener("input", e => {
      if(selected && e.target.value){
        selected.style.setProperty("width", Math.max(40, Number(e.target.value)) + "px", "important");
        save(selected); positionOverlay();
      }
    });
    $("editorHeight").addEventListener("input", e => {
      if(selected && e.target.value){
        selected.style.setProperty("height", Math.max(24, Number(e.target.value)) + "px", "important");
        save(selected); positionOverlay();
      }
    });
    $("editorFont").addEventListener("input", e => updateSelected("fontSize", Number(e.target.value) + "px"));
    $("editorLine").addEventListener("input", e => updateSelected("lineHeight", e.target.value));
    $("editorSpacing").addEventListener("input", e => updateSelected("letterSpacing", Number(e.target.value) + "px"));
    $("editorRadius").addEventListener("input", e => updateSelected("borderRadius", Number(e.target.value) + "px"));

    $("editorEditInside").onclick = () => {
      if(!selected) return;
      if(!insideMode){
        insideMode = true;
        insideRoot = selected;
        $("editorEditInside").textContent = "Lock Panel";
        document.body.classList.add("dashboard-editor-inside");
      }else{
        insideMode = false;
        insideRoot = null;
        $("editorEditInside").textContent = "Edit Inside";
        document.body.classList.remove("dashboard-editor-inside");
        if(!panelSet.has(selected)){
          const parentPanel = panels.find(panel => panel.contains(selected));
          if(parentPanel) select(parentPanel);
          else clearSelection();
        }
      }
      positionOverlay();
    };

    $("editorReset").onclick = () => {
      [...new Set([...panels, ...children])].forEach(el => localStorage.removeItem(editorStore + key(el)));
      location.reload();
    };

    function exitEdit(){
      document.body.classList.remove("dashboard-editing","dashboard-editor-inside");
      toggle.textContent = "Edit Dashboard";
      clearSelection();
      insideMode = false;
      insideRoot = null;
      resizeState = null;
    }

    $("editorDone").onclick = exitEdit;

    window.addEventListener("resize", positionOverlay);
    window.addEventListener("scroll", positionOverlay);

    toggle.hidden = false;
    toggle.onclick = () => {
      if(document.body.classList.contains("dashboard-editing")) exitEdit();
      else {
        document.body.classList.add("dashboard-editing");
        toggle.textContent = "Exit Edit Mode";
        positionOverlay();
      }
    };
  }


  setupDashboardEditor();

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