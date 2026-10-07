document.addEventListener("DOMContentLoaded", () => {
  const pages = document.querySelectorAll(".page");
  const nav = document.querySelectorAll(".site-nav-link");
  const pageNames = new Set(["home","shop","about","record","staff"]);

  function showPage(name, updateHash = true) {
    if (!pageNames.has(name)) name = "home";
    pages.forEach(p => p.classList.toggle("active", p.id === name));
    nav.forEach(item => {
      const active = item.dataset.page === name;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    if (updateHash) history.replaceState(null, "", "#" + name);
    window.scrollTo({top:0, behavior:"smooth"});
  }

  nav.forEach(item => item.addEventListener("click", () => {
    showPage(item.dataset.page);
    if (item.dataset.page === "staff") loadStaffSession();
  }));
  document.querySelectorAll("[data-page]").forEach(item => {
    if (!item.classList.contains("site-nav-link")) {
      item.addEventListener("click", (event) => {
        const target = item.dataset.page;
        if (pageNames.has(target)) {
          event.preventDefault();
          showPage(target);
        }
      });
    }
  });

  const mobileButton = document.getElementById("mobileNavButton");
  if (mobileButton) {
    mobileButton.addEventListener("click", () => {
      const navOpen = document.querySelector(".mobile-nav");
      if (navOpen) { navOpen.remove(); return; }
      const menu = document.createElement("div");
      menu.className = "mobile-nav";
      menu.innerHTML = [...nav].map(item =>
        '<button type="button" data-page="' + item.dataset.page + '">' + item.textContent + '</button>'
      ).join("");
      document.body.appendChild(menu);
      menu.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
        showPage(b.dataset.page);
        menu.remove();
      }));
    });
  }

  const communityCount = document.querySelector("[data-community-count]");
  const playerCount = document.querySelector("[data-player-count]");
  const staffCount = document.querySelector("[data-staff-count]");
  const queueCount = document.querySelector("[data-queue-count]");
  if (communityCount) communityCount.textContent = "0";
  if (playerCount) playerCount.textContent = "0";
  if (staffCount) staffCount.textContent = "0";
  if (queueCount) queueCount.textContent = "0";

  const OAUTH = window.MSRP_AUTH || {};
  const loginButton = document.getElementById("staffDiscord");
  const loginCard = document.getElementById("staffLoginCard");
  const dashboard = document.getElementById("staffDashboard");
  const errorBox = document.getElementById("staffError");
  const logoutButton = document.getElementById("staffLogout");
  const avatar = document.getElementById("dashboardAvatar");
  const username = document.getElementById("dashboardUsername");
  const rank = document.getElementById("dashboardRank");
  const name = document.getElementById("dashboardName");

  const roleRanks = [
    ["1551704056991318191", "Senior High Rank"],
    ["1551704115350999143", "High Rank"],
    ["1528426796670914671", "Internal Affairs Supervisor"],
    ["1528426646259105802", "Internal Affairs Director"],
    ["1527381477975789668", "Internal Affairs"],
    ["1528426569012609106", "Management Team"],
    ["1527381747791040522", "Administration Team"],
    ["1527381803617222676", "Moderation Team"],
    ["1528242210871447672", "Staff Team"]
  ];

  function setError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function clearOAuthUrl() {
    if (location.hash.includes("access_token=")) {
      history.replaceState(null, "", location.pathname + "#staff");
    }
  }

  function logout() {
    sessionStorage.removeItem("msrp_discord_token");
    sessionStorage.removeItem("msrp_discord_expires");
    sessionStorage.removeItem("msrp_oauth_state");
    if (dashboard) dashboard.hidden = true;
    if (loginCard) loginCard.hidden = false;
    setError("");
    showPage("staff");
  }

  function hasUsableStoredSession() {
    const token = sessionStorage.getItem("msrp_discord_token");
    const expiry = Number(sessionStorage.getItem("msrp_discord_expires") || 0);
    return Boolean(token && expiry && Date.now() < expiry);
  }

  function updateLoginButton() {
    if (!loginButton) return;
    loginButton.querySelector("span").textContent = hasUsableStoredSession()
      ? "Continue to Dashboard"
      : "Continue with Discord";
  }

  function startLogin() {

    if (!OAUTH.clientId || OAUTH.clientId === "REPLACE_WITH_DISCORD_CLIENT_ID") {
      setError("Discord sign-in is not configured yet. Add the Discord application Client ID to auth-config.js.");
      return;
    }

    const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
    sessionStorage.setItem("msrp_oauth_state", state);
    const redirectUri = OAUTH.redirectUri || (location.origin + location.pathname);
    const params = new URLSearchParams({
      response_type: "token",
      client_id: OAUTH.clientId,
      scope: "identify guilds.members.read",
      state,
      redirect_uri: redirectUri
    });
    window.location.assign("https://discord.com/oauth2/authorize?" + params.toString());
  }

  function parseOAuthToken() {
    if (!location.hash.includes("access_token=")) return null;
    const raw = location.hash.slice(1);
    const params = new URLSearchParams(raw);
    const state = params.get("state");
    const expectedState = sessionStorage.getItem("msrp_oauth_state");
    if (!state || !expectedState || state !== expectedState) {
      setError("Discord sign-in could not be verified. Please start the login again.");
      return null;
    }
    const token = params.get("access_token");
    const expiresIn = Number(params.get("expires_in") || 0);
    if (!token || !expiresIn) {
      setError("Discord did not return a valid login session.");
      return null;
    }
    sessionStorage.setItem("msrp_discord_token", token);
    sessionStorage.setItem("msrp_discord_expires", String(Date.now() + (expiresIn * 1000)));
    sessionStorage.removeItem("msrp_oauth_state");
    clearOAuthUrl();
    return token;
  }

  async function discordRequest(path, token) {
    const response = await fetch("https://discord.com/api/v10" + path, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) throw new Error("Discord API returned " + response.status);
    return response.json();
  }

  function getRank(roleIds) {
    for (const [roleId, label] of roleRanks) {
      if (roleIds.includes(roleId)) return label;
    }
    return "Staff Team";
  }

  async function loadStaffSession() {
    const oauthCallback = location.hash.includes("access_token=");
    if (oauthCallback) showPage("staff", false);

    const token = parseOAuthToken() || sessionStorage.getItem("msrp_discord_token");
    const expiry = Number(sessionStorage.getItem("msrp_discord_expires") || 0);
    if (!token || !expiry || Date.now() >= expiry) {
      if (token) logout();
      return;
    }

    try {
      setError("");
      const [user, member] = await Promise.all([
        discordRequest("/users/@me", token),
        discordRequest("/users/@me/guilds/" + encodeURIComponent(OAUTH.guildId) + "/member", token)
      ]);

      const staffRoleIds = roleRanks.map(([id]) => id);
      const isStaff = Array.isArray(member.roles) && member.roles.some(id => staffRoleIds.includes(id));
      if (!isStaff) {
        logout();
        setError("Your Discord account is not currently assigned an MSRP staff role.");
        return;
      }

      const staffRank = getRank(member.roles);
      const avatarUrl = user.avatar
        ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=256"
        : "https://cdn.discordapp.com/embed/avatars/" + (Number(BigInt(user.id) % 5n)) + ".png";

      avatar.src = avatarUrl;
      avatar.alt = user.username + " Discord avatar";
      username.textContent = user.global_name || user.username;
      rank.textContent = staffRank;
      name.textContent = user.global_name || user.username;

      loginCard.hidden = true;
      dashboard.hidden = false;
      updateLoginButton();
      showPage("staff");
    } catch (error) {
      console.error(error);
      logout();
      setError("We could not verify your Discord session. Please sign in again.");
    }
  }

  if (loginButton) loginButton.addEventListener("click", () => {
    if (hasUsableStoredSession()) {
      showPage("staff");
      loadStaffSession();
      return;
    }
    startLogin();
  });
  if (logoutButton) logoutButton.addEventListener("click", logout);

  updateLoginButton();

  const oauthCallback = location.hash.includes("access_token=");
  const startingHash = location.hash.replace("#","");
  const initialPage = oauthCallback ? "staff" : (pageNames.has(startingHash) ? startingHash : "home");
  showPage(initialPage, false);
  loadStaffSession();
});