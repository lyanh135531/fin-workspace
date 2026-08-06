try {
  const root = document.documentElement;
  const theme = localStorage.getItem("fin-workspace-theme");
  const mode = localStorage.getItem("fin-workspace-mode");
  const prefersDarkMode = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const allowedThemes = ["sunrise", "ocean", "forest", "lavender", "midnight"];

  root.dataset.theme = allowedThemes.includes(theme ?? "") ? theme : "sunrise";
  root.dataset.mode =
    mode === "light" || mode === "dark"
      ? mode
      : prefersDarkMode
        ? "dark"
        : "light";

} catch (error) {
  console.warn("Unable to initialize the saved appearance settings.", error);
}
