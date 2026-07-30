(() => {
  const storageKey = "agent-notes-language";
  const root = document.documentElement;
  const body = document.body;
  const options = [...document.querySelectorAll("[data-language-option]")];
  const translations = [...document.querySelectorAll("[data-i18n]")];
  const placeholderTranslations = [
    ...document.querySelectorAll("[data-placeholder-en][data-placeholder-zh]"),
  ];
  const searchInput = document.querySelector("#site-search-input");
  const searchPanel = document.querySelector("#site-search-results");
  const toc = document.querySelector("#page-toc");
  const navToggle = document.querySelector(".mobile-nav-toggle");
  const drawerClose = document.querySelector(".drawer-close");
  const navScrim = document.querySelector(".nav-scrim");
  const sideNav = document.querySelector("#site-navigation");

  let searchEntries = [];
  let selectedResult = -1;
  let tocObserver;

  const readSavedLanguage = () => {
    try {
      return localStorage.getItem(storageKey) === "zh" ? "zh" : "en";
    } catch (error) {
      return "en";
    }
  };

  const slugify = (value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const rebuildSearchEntries = () => {
    const seen = new Set();

    searchEntries = [...document.querySelectorAll(".side-nav a")]
      .map((link) => {
        const href = link.href;
        const label = link.textContent.replace(/\s+/g, " ").trim();
        const group =
          link.closest(".nav-group")?.querySelector("h2")?.textContent.trim() ||
          "Documentation";

        return { href, label, group };
      })
      .filter((entry) => {
        if (!entry.label || seen.has(entry.href)) return false;
        seen.add(entry.href);
        return true;
      });
  };

  const closeSearch = () => {
    if (!searchPanel || !searchInput) return;
    searchPanel.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    selectedResult = -1;
  };

  const renderSearchResults = () => {
    if (!searchPanel || !searchInput) return;

    const query = searchInput.value.trim().toLocaleLowerCase();
    const matches = searchEntries
      .filter(({ label, group }) =>
        `${label} ${group}`.toLocaleLowerCase().includes(query)
      )
      .slice(0, 9);

    searchPanel.replaceChildren();

    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent =
        root.dataset.language === "zh"
          ? "没有找到相关页面"
          : "No matching pages";
      searchPanel.append(empty);
    } else {
      matches.forEach((entry, index) => {
        const result = document.createElement("a");
        const label = document.createElement("span");
        const group = document.createElement("small");

        result.className = "search-result";
        result.href = entry.href;
        result.role = "option";
        result.dataset.resultIndex = String(index);
        result.setAttribute(
          "aria-selected",
          String(index === selectedResult)
        );
        if (index === selectedResult) result.classList.add("is-selected");

        label.textContent = entry.label;
        group.textContent = entry.group;
        result.append(label, group);
        searchPanel.append(result);
      });
    }

    searchPanel.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  };

  const rebuildToc = () => {
    if (!toc) return;

    if (tocObserver) tocObserver.disconnect();
    toc.replaceChildren();

    const headings = [
      ...document.querySelectorAll(
        "#main-content > h2, #main-content > h3, #main-content section > h2, #main-content [data-toc-label]"
      ),
    ];
    const usedIds = new Set();

    headings.forEach((heading, index) => {
      let id = heading.id || heading.closest("section[id]")?.id;

      if (!id) {
        const base = slugify(heading.textContent) || `section-${index + 1}`;
        id = base;
        let suffix = 2;
        while (usedIds.has(id) || document.getElementById(id)) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }
        heading.id = id;
      }

      usedIds.add(id);

      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent =
        heading.dataset.tocLabel || heading.textContent.trim();
      link.className = `toc-depth-${
        heading.tagName === "H3" || heading.dataset.tocLabel ? "3" : "2"
      }`;
      toc.append(link);
    });

    if (!headings.length) {
      toc.closest(".page-outline")?.setAttribute("hidden", "");
      return;
    }

    toc.closest(".page-outline")?.removeAttribute("hidden");

    if ("IntersectionObserver" in window) {
      tocObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries.find((entry) => entry.isIntersecting);
          if (!visible) return;

          toc.querySelectorAll("a").forEach((link) => {
            link.classList.toggle(
              "is-current",
              link.hash === `#${visible.target.id}`
            );
          });
        },
        { rootMargin: "-22% 0px -68% 0px" }
      );

      headings.forEach((heading) => tocObserver.observe(heading));
    }
  };

  const applyLanguage = (language, remember = true) => {
    const current = language === "zh" ? "zh" : "en";

    root.dataset.language = current;
    root.lang = current === "zh" ? "zh-CN" : "en";

    translations.forEach((element) => {
      const value = element.dataset[current];
      if (value) element.textContent = value;
    });

    placeholderTranslations.forEach((element) => {
      element.placeholder =
        current === "zh"
          ? element.dataset.placeholderZh
          : element.dataset.placeholderEn;
    });

    options.forEach((option) => {
      option.setAttribute(
        "aria-pressed",
        String(option.dataset.languageOption === current)
      );
    });

    if (navToggle) {
      navToggle.setAttribute(
        "aria-label",
        current === "zh" ? "打开导航" : "Open navigation"
      );
    }
    if (drawerClose) {
      drawerClose.setAttribute(
        "aria-label",
        current === "zh" ? "关闭导航" : "Close navigation"
      );
    }

    rebuildSearchEntries();
    rebuildToc();
    if (searchPanel && !searchPanel.hidden) renderSearchResults();

    if (remember) {
      try {
        localStorage.setItem(storageKey, current);
      } catch (error) {}
    }
  };

  const closeMobileNav = () => {
    body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
    navScrim?.setAttribute("hidden", "");

    const icon = navToggle?.querySelector(".material-symbols-outlined");
    if (icon) icon.textContent = "menu";
  };

  const openMobileNav = () => {
    body.classList.add("nav-open");
    navToggle?.setAttribute("aria-expanded", "true");
    navScrim?.removeAttribute("hidden");

    const icon = navToggle?.querySelector(".material-symbols-outlined");
    if (icon) icon.textContent = "close";
  };

  options.forEach((option) => {
    option.addEventListener("click", () => {
      applyLanguage(option.dataset.languageOption);
    });
  });

  searchInput?.addEventListener("focus", renderSearchResults);
  searchInput?.addEventListener("input", () => {
    selectedResult = -1;
    renderSearchResults();
  });
  searchInput?.addEventListener("keydown", (event) => {
    const results = [...searchPanel.querySelectorAll(".search-result")];

    if (event.key === "Escape") {
      closeSearch();
      searchInput.blur();
      return;
    }

    if (!results.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      selectedResult =
        (selectedResult + direction + results.length) % results.length;
      renderSearchResults();
      return;
    }

    if (event.key === "Enter" && selectedResult >= 0) {
      event.preventDefault();
      const selected = searchPanel.querySelector(
        `[data-result-index="${selectedResult}"]`
      );
      if (selected) window.location.assign(selected.href);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLocaleLowerCase() === "k"
    ) {
      event.preventDefault();
      searchInput?.focus();
    }

    if (event.key === "Escape" && body.classList.contains("nav-open")) {
      closeMobileNav();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-search")) closeSearch();
  });

  navToggle?.addEventListener("click", () => {
    if (body.classList.contains("nav-open")) closeMobileNav();
    else openMobileNav();
  });
  drawerClose?.addEventListener("click", closeMobileNav);
  navScrim?.addEventListener("click", closeMobileNav);
  sideNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });

  applyLanguage(readSavedLanguage(), false);
})();
