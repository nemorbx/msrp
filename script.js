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


  /* Temporary dashboard layout editor: panels, child components, movement, resizing and typography. */
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

    /* Every visible dashboard component can be selected when its parent panel is unlocked. */
    const allElements = [...memberDash.querySelectorAll("*")].filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.closest(".dashboard-editor-ui,.dashboard-editor-note,.dashboard-editor-handle")) return false;
      const r=el.getBoundingClientRect();
      return r.width>0 && r.height>0;
    });

    const targets = [...new Set([...panels,...allElements])];

    targets.forEach((el,i)=>{
      el.dataset.editorTarget = String(i);
      const saved = localStorage.getItem("msrp_dashboard_editor_"+i);
      if(saved){
        try{
          const v=JSON.parse(saved);
          if(v.x!=null) el.style.setProperty("--editor-x",v.x+"px");
          if(v.y!=null) el.style.setProperty("--editor-y",v.y+"px");
          if(v.width) el.style.width=v.width+"px";
          if(v.height) el.style.height=v.height+"px";
          if(v.fontSize) el.style.fontSize=v.fontSize+"px";
          if(v.lineHeight) el.style.lineHeight=v.lineHeight;
          if(v.letterSpacing) el.style.letterSpacing=v.letterSpacing+"px";
          if(v.radius!=null) el.style.borderRadius=v.radius+"px";
          if(v.padding) el.style.padding=v.padding;
        }catch{}
      }
    });

    const ui=document.createElement("div");
    ui.className="dashboard-editor-ui";
    ui.innerHTML=
      '<span class="editor-tool-title">SELECTED</span>'+
      '<label>W <input id="editorWidth" type="number" min="1" step="1"></label>'+
      '<label>H <input id="editorHeight" type="number" min="1" step="1"></label>'+
      '<label>Text <input id="editorFont" type="number" min="1" step=".5"></label>'+
      '<label>Line <input id="editorLine" type="number" min=".1" step=".1"></label>'+
      '<label>Spacing <input id="editorSpacing" type="number" step=".1"></label>'+
      '<label>Radius <input id="editorRadius" type="number" min="0" step="1"></label>'+
      '<button type="button" id="editorMoveUp">↑</button>'+
      '<button type="button" id="editorMoveDown">↓</button>'+
      '<button type="button" id="editorMoveLeft">←</button>'+
      '<button type="button" id="editorMoveRight">→</button>'+
      '<button type="button" id="editorEditInside">Edit Inside</button>'+
      '<button type="button" id="editorReset">Reset</button>'+
      '<button type="button" id="editorDone">Done</button>';
    document.body.appendChild(ui);

    const note=document.createElement("div");
    note.className="dashboard-editor-note";
    note.textContent="EDIT MODE — select a panel, resize its edges/corners, or use the arrow controls to move it";
    document.body.appendChild(note);

    let selected=null;
    let resizeState=null;
    let insideMode=false;

    function box(el){ return el.getBoundingClientRect(); }

    function save(el){
      if(!el) return;
      const id=el.dataset.editorTarget;
      const cs=getComputedStyle(el);
      const x=parseFloat(cs.getPropertyValue("--editor-x"))||0;
      const y=parseFloat(cs.getPropertyValue("--editor-y"))||0;
      localStorage.setItem("msrp_dashboard_editor_"+id,JSON.stringify({
        x,y,width:el.offsetWidth,height:el.offsetHeight,
        fontSize:parseFloat(cs.fontSize),lineHeight:cs.lineHeight,
        letterSpacing:parseFloat(cs.letterSpacing)||0,
        radius:parseFloat(cs.borderTopLeftRadius)||0,
        padding:cs.padding
      }));
    }

    function clearHandles(){
      document.querySelectorAll(".dashboard-editor-handle").forEach(x=>x.remove());
    }

    function isPanel(el){ return panels.includes(el); }

    function select(el){
      if(!el) return;
      if(selected) selected.removeAttribute("data-editor-selected");
      clearHandles();
      selected=el;
      selected.dataset.editorSelected="true";

      const r=box(selected), cs=getComputedStyle(selected);
      $("editorWidth").value=Math.round(r.width);
      $("editorHeight").value=Math.round(r.height);
      $("editorFont").value=parseFloat(cs.fontSize).toFixed(1).replace(/\\.0$/,"");
      $("editorLine").value=cs.lineHeight==="normal" ? "1.2" : parseFloat(cs.lineHeight);
      $("editorSpacing").value=parseFloat(cs.letterSpacing)||0;
      $("editorRadius").value=parseFloat(cs.borderTopLeftRadius)||0;
      $("editorEditInside").textContent = insideMode ? "Lock Inside" : "Edit Inside";

      ["n","s","e","w","nw","ne","sw","se"].forEach(dir=>{
        const handle=document.createElement("div");
        handle.className="dashboard-editor-handle dashboard-editor-handle-"+dir;
        handle.dataset.resize=dir;
        selected.appendChild(handle);
        handle.addEventListener("pointerdown",e=>{
          e.preventDefault(); e.stopPropagation();
          const rect=box(selected);
          resizeState={dir,startX:e.clientX,startY:e.clientY,startW:rect.width,startH:rect.height};
        });
      });
    }

    function move(dx,dy){
      if(!selected) return;
      const cs=getComputedStyle(selected);
      const x=(parseFloat(cs.getPropertyValue("--editor-x"))||0)+dx;
      const y=(parseFloat(cs.getPropertyValue("--editor-y"))||0)+dy;
      selected.style.setProperty("--editor-x",x+"px");
      selected.style.setProperty("--editor-y",y+"px");
      save(selected);
    }

    function finishResize(){
      if(resizeState && selected) save(selected);
      resizeState=null;
    }

    targets.forEach(el=>{
      el.addEventListener("click",e=>{
        if(!document.body.classList.contains("dashboard-editing")) return;
        if(e.target.closest(".dashboard-editor-handle")) return;

        /* Selecting a panel locks everything inside it until Edit Inside is pressed. */
        if(selected && isPanel(selected) && !insideMode && selected.contains(el) && el!==selected){
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        select(el);
      },true);
    });

    document.addEventListener("pointermove",e=>{
      if(!resizeState || !selected) return;
      const d=resizeState,dx=e.clientX-d.startX,dy=e.clientY-d.startY;
      const minW=40,minH=24;
      let w=d.startW,h=d.startH;
      if(d.dir.includes("e")) w=Math.max(minW,d.startW+dx);
      if(d.dir.includes("w")) w=Math.max(minW,d.startW-dx);
      if(d.dir.includes("s")) h=Math.max(minH,d.startH+dy);
      if(d.dir.includes("n")) h=Math.max(minH,d.startH-dy);
      selected.style.width=Math.round(w)+"px";
      selected.style.height=Math.round(h)+"px";
      $("editorWidth").value=Math.round(w);
      $("editorHeight").value=Math.round(h);
    });

    document.addEventListener("pointerup",finishResize);

    document.addEventListener("keydown",e=>{
      if(!document.body.classList.contains("dashboard-editing") || !selected) return;
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step=e.shiftKey ? 10 : 1;
      if(e.key==="ArrowUp"){e.preventDefault();move(0,-step)}
      if(e.key==="ArrowDown"){e.preventDefault();move(0,step)}
      if(e.key==="ArrowLeft"){e.preventDefault();move(-step,0)}
      if(e.key==="ArrowRight"){e.preventDefault();move(step,0)}
    });

    $("editorWidth").addEventListener("input",e=>{if(selected&&e.target.value){selected.style.width=Number(e.target.value)+"px";save(selected)}});
    $("editorHeight").addEventListener("input",e=>{if(selected&&e.target.value){selected.style.height=Number(e.target.value)+"px";save(selected)}});
    $("editorFont").addEventListener("input",e=>{if(selected&&e.target.value){selected.style.fontSize=Number(e.target.value)+"px";save(selected)}});
    $("editorLine").addEventListener("input",e=>{if(selected&&e.target.value){selected.style.lineHeight=e.target.value;save(selected)}});
    $("editorSpacing").addEventListener("input",e=>{if(selected&&e.target.value){selected.style.letterSpacing=Number(e.target.value)+"px";save(selected)}});
    $("editorRadius").addEventListener("input",e=>{if(selected&&e.target.value!==""){selected.style.borderRadius=Number(e.target.value)+"px";save(selected)}});

    $("editorMoveUp").onclick=()=>move(0,-1);
    $("editorMoveDown").onclick=()=>move(0,1);
    $("editorMoveLeft").onclick=()=>move(-1,0);
    $("editorMoveRight").onclick=()=>move(1,0);

    $("editorEditInside").onclick=()=>{
      insideMode=!insideMode;
      $("editorEditInside").textContent=insideMode ? "Lock Inside" : "Edit Inside";
      if(!insideMode && selected) select(selected);
    };

    $("editorReset").onclick=()=>{
      targets.forEach(el=>localStorage.removeItem("msrp_dashboard_editor_"+el.dataset.editorTarget));
      location.reload();
    };

    function exitEdit(){
      document.body.classList.remove("dashboard-editing");
      toggle.textContent="Edit Dashboard";
      if(selected) selected.removeAttribute("data-editor-selected");
      clearHandles();
      selected=null;
      resizeState=null;
      insideMode=false;
    }

    $("editorDone").onclick=exitEdit;
    toggle.hidden=false;
    toggle.onclick=()=>{
      if(document.body.classList.contains("dashboard-editing")) exitEdit();
      else {
        document.body.classList.add("dashboard-editing");
        toggle.textContent="Exit Edit Mode";
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