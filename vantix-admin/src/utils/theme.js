export function getStoredTheme() {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem("vantix_theme") || localStorage.getItem("theme") || "dark";
}

export function applyTheme(theme) {
  if (typeof window === "undefined") return;
  const t = theme === "light" ? "light" : "dark";
  localStorage.setItem("theme", t);
  localStorage.setItem("vantix_theme", t);
  document.documentElement.classList.remove("theme-light", "theme-dark");
  document.documentElement.classList.add(`theme-${t}`);
  window.dispatchEvent(new CustomEvent("vantix:theme-change", { detail: { theme: t } }));
}

export function initTheme() {
  const current = getStoredTheme();
  applyTheme(current);
}

if (typeof window !== "undefined") {
  window.toggleTheme = function() {
    const current = getStoredTheme();
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
  };
}
