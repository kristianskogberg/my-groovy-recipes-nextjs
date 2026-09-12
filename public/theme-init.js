try {
  const theme = localStorage.getItem("theme");
  document.documentElement.dataset.theme = [
    "retro",
    "brownie",
    "modern",
  ].includes(theme)
    ? theme
    : "retro";
} catch {
  document.documentElement.dataset.theme = "retro";
}
