// Paste the Apps Script Web App URL here after deploying (see README step 3).
window.CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbyU8vKlWn8efX8V69Fh8UC_Cnwv52l3xZGKnrzdp2Cwi5Ai0fHfqiml7jULTPmg5QWU/exec",

  // Set to false to close voting. The page then shows a closed notice.
  OPEN: true,

  // Optional hard deadline, local device time. Leave "" to ignore.
  CLOSES_AT: "",   // e.g. "2026-09-10T16:15:00+09:00"

  // Optional: before this moment the page shows "Voting opens later today".
  OPENS_AT: "",    // e.g. "2026-09-10T15:00:00+09:00"

  // Small line under the submit button. Leave "" to hide it.
  DEADLINE_NOTE: "Voting closes 15:15 JST, 10 September"
};
