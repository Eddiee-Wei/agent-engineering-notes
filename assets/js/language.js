(() => {
  const storageKey = "agent-notes-language";
  const root = document.documentElement;
  const options = [...document.querySelectorAll("[data-language-option]")];
  const translations = [...document.querySelectorAll("[data-i18n]")];

  const readSavedLanguage = () => {
    try {
      return localStorage.getItem(storageKey) === "zh" ? "zh" : "en";
    } catch (error) {
      return "en";
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

    options.forEach((option) => {
      option.setAttribute(
        "aria-pressed",
        String(option.dataset.languageOption === current)
      );
    });

    if (remember) {
      try {
        localStorage.setItem(storageKey, current);
      } catch (error) {}
    }
  };

  options.forEach((option) => {
    option.addEventListener("click", () => {
      applyLanguage(option.dataset.languageOption);
    });
  });

  applyLanguage(readSavedLanguage(), false);
})();
