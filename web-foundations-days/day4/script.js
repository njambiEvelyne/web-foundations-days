const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const DRAFT_KEY = "day4-note-draft";
const THEME_KEY = "day4-note-theme";
const CHARACTER_LIMIT = 200;

function updateCounts() {
  const text = noteText.value;
  const characterTotal = text.length;
  const trimmedText = text.trim();
  const wordTotal = trimmedText ? trimmedText.split(/\s+/).length : 0;

  charCount.textContent = `${characterTotal} / ${CHARACTER_LIMIT} characters`;
  wordCount.textContent = `${wordTotal} ${wordTotal === 1 ? "word" : "words"}`;
  charCount.classList.toggle("warning", characterTotal > 180);
  charCount.classList.toggle("over", characterTotal > CHARACTER_LIMIT);
}

function clearNote() {
  noteText.value = "";
  updateCounts();
  localStorage.removeItem(DRAFT_KEY);
}

function setTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

setTheme(localStorage.getItem(THEME_KEY) === "dark");
updateCounts();

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, noteText.value);
});

clearButton.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});
themeToggle.addEventListener("click", () => {
  setTheme(!document.body.classList.contains("dark"));
});
