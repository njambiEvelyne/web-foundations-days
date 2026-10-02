let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const searchTerm = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

function countByCategory() {
  const counts = {};
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

function getSummary() {
  const total = notes.length;
  const counts = countByCategory();
  const categorySummary = ["personal", "work", "study"]
    .filter((category) => counts[category])
    .map((category) => `${counts[category]} ${category}`)
    .join(", ");

  return `${total} ${total === 1 ? "note" : "notes"}: ${categorySummary}.`;
}

function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === normalizedText);
}

function addNote(text, category) {
  if (typeof text !== "string") {
    console.log("Note was not added: text must be a string.");
    return false;
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Note was not added: text must be 1–200 characters.");
    return false;
  }

  if (isDuplicate(trimmedText)) {
    console.log("Note was not added: a note with that text already exists.");
    return false;
  }

  if (!["personal", "work", "study"].includes(category)) {
    console.log("Note was not added: category must be personal, work, or study.");
    return false;
  }

  const nextId = notes.reduce((highestId, note) => Math.max(highestId, note.id), 0) + 1;
  notes.push({ id: nextId, text: trimmedText, category });
  return true;
}

console.log(searchNotes("JAVASCRIPT")); // [{ id: 4, text: "Revise JavaScript arrays", category: "study" }]
console.log(searchNotes("meeting")); // []

console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }
const originalNotes = notes;
notes = [];
console.log(longestNote()); // null
notes = originalNotes;

console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory()); // {}
notes = originalNotes;

console.log(getSummary()); // "5 notes: 2 personal, 1 work, 2 study."
notes = [originalNotes[0]];
console.log(getSummary()); // "1 note: 1 personal."
notes = originalNotes;

console.log(isDuplicate("  BUY MILK AND BREAD  ")); // true
console.log(isDuplicate("Read a book")); // false

console.log(addNote("Plan the weekend", "personal")); // true
console.log(addNote("  BUY MILK AND BREAD ", "personal")); // Note was not added: a note with that text already exists. false
console.log(addNote("   ", "work")); // Note was not added: text must be 1–200 characters. false
console.log(addNote("Prepare presentation", "other")); // Note was not added: category must be personal, work, or study. false