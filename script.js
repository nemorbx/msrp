/* =========================================
   MSRP — Missouri State Roleplay
   Website JavaScript
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================
       PAGE DATA
       ========================================= */

    const pageData = {
        dashboard: {
            title: "Dashboard",
            subtitle: "Missouri State Roleplay Staff Portal"
        },

        guide: {
            title: "Staff Guide",
            subtitle: "Missouri State Roleplay staff resources"
        },

        directory: {
            title: "Staff Directory",
            subtitle: "View the Missouri State Roleplay staff team"
        },

        applications: {
            title: "Applications",
            subtitle: "Manage staff applications"
        },

        infractions: {
            title: "Infractions",
            subtitle: "View staff disciplinary records"
        },

        promotions: {
            title: "Promotions",
            subtitle: "View recent staff promotions"
        },

        server: {
            title: "ER:LC Server",
            subtitle: "Missouri State Roleplay server information"
        },

        modcalls: {
            title: "Mod Calls",
            subtitle: "View active moderation calls"
        },

        ia: {
            title: "Internal Affairs",
            subtitle: "Internal Affairs resources and information"
        }
    };


    /* =========================================
       ELEMENTS
       ========================================= */

    const navItems = document.querySelectorAll(".nav-item");

    const pages = document.querySelectorAll(".page");

    const pageTitle = document.getElementById("pageTitle");

    const pageSubtitle = document.getElementById("pageSubtitle");

    const mobileMenu = document.getElementById("mobileMenu");

    const sidebar = document.getElementById("sidebar");


    /* =========================================
       PAGE SWITCHING
       ========================================= */

    function showPage(pageName) {

        if (!pageData[pageName]) {
            return;
        }

        /* Hide every page */

        pages.forEach(page => {
            page.classList.remove("active");
        });


        /* Show requested page */

        const selectedPage = document.getElementById(`page-${pageName}`);

        if (selectedPage) {
            selectedPage.classList.add("active");
        }


        /* Update navigation */

        navItems.forEach(item => {

            item.classList.remove("active");

            if (item.dataset.page === pageName) {
                item.classList.add("active");
            }

        });


        /* Update header */

        pageTitle.textContent = pageData[pageName].title;

        pageSubtitle.textContent = pageData[pageName].subtitle;


        /* Close mobile sidebar */

        if (window.innerWidth <= 750) {
            sidebar.classList.remove("open");
        }


        /* Update browser URL */

        try {
            history.replaceState(
                null,
                "",
                `#${pageName}`
            );
        } catch (error) {
            console.log("Unable to update URL.");
        }


        /* Scroll to top */

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    /* =========================================
       NAVIGATION BUTTONS
       ========================================= */

    navItems.forEach(item => {

        item.addEventListener("click", () => {

            const pageName = item.dataset.page;

            showPage(pageName);

        });

    });


    /* =========================================
       MOBILE MENU
       ========================================= */

    if (mobileMenu) {

        mobileMenu.addEventListener("click", () => {

            sidebar.classList.toggle("open");

        });

    }


    /* =========================================
       CLOSE MOBILE SIDEBAR
       ========================================= */

    document.addEventListener("click", event => {

        if (window.innerWidth > 750) {
            return;
        }

        if (!sidebar.classList.contains("open")) {
            return;
        }

        const clickedInsideSidebar = sidebar.contains(event.target);

        const clickedMenu = mobileMenu &&
            mobileMenu.contains(event.target);

        if (!clickedInsideSidebar && !clickedMenu) {
            sidebar.classList.remove("open");
        }

    });


    /* =========================================
       SECTION LINKS
       ========================================= */

    document.querySelectorAll("[data-page-link]").forEach(button => {

        button.addEventListener("click", () => {

            const targetPage = button.dataset.pageLink;

            showPage(targetPage);

        });

    });


    /* =========================================
       SEARCH
       ========================================= */

    const searchInputs = document.querySelectorAll("[data-search]");

    searchInputs.forEach(input => {

        input.addEventListener("input", () => {

            const searchValue = input.value
                .toLowerCase()
                .trim();

            const target = input.dataset.search;

            const items = document.querySelectorAll(
                `[data-search-item="${target}"]`
            );

            items.forEach(item => {

                const text = item.textContent
                    .toLowerCase();

                if (
                    searchValue === "" ||
                    text.includes(searchValue)
                ) {
                    item.style.display = "";
                } else {
                    item.style.display = "none";
                }

            });

        });

    });


    /* =========================================
       STATUS / CLOCK
       ========================================= */

    function updateClock() {

        const clockElements =
            document.querySelectorAll("[data-clock]");

        if (!clockElements.length) {
            return;
        }

        const now = new Date();

        clockElements.forEach(element => {

            element.textContent =
                now.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit"
                });

        });

    }

    updateClock();

    setInterval(updateClock, 30000);


    /* =========================================
       SERVER PLAYER COUNT
       ========================================= */

    function updatePlayerCount() {

        const playerElements =
            document.querySelectorAll("[data-player-count]");

        playerElements.forEach(element => {

            /*
             * This is currently placeholder data.
             *
             * Later, we can connect this to the
             * MSRP Game Bot / secure backend.
             */

            if (!element.dataset.value) {
                element.textContent = "0 / 50";
            }

        });

    }

    updatePlayerCount();


    /* =========================================
       SERVER PLAYER PROGRESS
       ========================================= */

    function updateServerProgress() {

        const progressBars =
            document.querySelectorAll("[data-server-progress]");

        progressBars.forEach(bar => {

            const current =
                Number(bar.dataset.current || 0);

            const maximum =
                Number(bar.dataset.maximum || 50);

            if (maximum <= 0) {
                bar.style.width = "0%";
                return;
            }

            const percentage =
                Math.min(
                    Math.max((current / maximum) * 100, 0),
                    100
                );

            bar.style.width = `${percentage}%`;

        });

    }

    updateServerProgress();


    /* =========================================
       BUTTON FEEDBACK
       ========================================= */

    document.querySelectorAll(".btn").forEach(button => {

        button.addEventListener("click", () => {

            if (button.dataset.pageLink) {
                return;
            }

            button.classList.add("clicked");

            setTimeout(() => {
                button.classList.remove("clicked");
            }, 180);

        });

    });


    /* =========================================
       INITIAL PAGE
       ========================================= */

    let startingPage = "dashboard";

    const hash = window.location.hash.replace("#", "");

    if (pageData[hash]) {
        startingPage = hash;
    }

    showPage(startingPage);


    /* =========================================
       HANDLE BROWSER BACK / FORWARD
       ========================================= */

    window.addEventListener("popstate", () => {

        const currentHash =
            window.location.hash.replace("#", "");

        if (pageData[currentHash]) {
            showPage(currentHash);
        } else {
            showPage("dashboard");
        }

    });


    /* =========================================
       CONSOLE MESSAGE
       ========================================= */

    console.log(
        "%cMSRP Staff Portal",
        "font-size: 18px; font-weight: bold;"
    );

    console.log(
        "Missouri State Roleplay — Staff Portal"
    );

});
