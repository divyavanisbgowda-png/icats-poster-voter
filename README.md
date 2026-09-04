# ICATS-FHM 2026 — best poster vote

Attendees rank their top 3 posters from a phone. 3-2-1 points, top 8 win.
Static site on GitHub Pages, ballots stored in a Google Sheet via Apps Script.
One pre-issued code per attendee, one ballot per code.

```
index.html              ballot page
config.js               endpoint URL + open/close switch
css/style.css
js/app.js
data/posters.json       the 54 posters  ← replace this
apps-script/Code.gs     paste into Apps Script
tools/make-posters.html  CSV → posters.json
tools/print-codes.html   printable code slips with QR
```

## 1. Poster list

Export the abstract list as CSV with header `id,title,presenter,affiliation,theme`,
open `tools/make-posters.html`, paste, download, and overwrite `data/posters.json`.
IDs must be `P01`–`P54` and must match the numbers printed on the boards.

## 2. Sheet + backend

1. New Google Sheet → Extensions → Apps Script.
2. Delete the starter code, paste all of `apps-script/Code.gs`, save.
3. Reload the Sheet. A **Poster vote** menu appears → **Set up sheets** → **Generate voting codes**.
   Authorise when prompted.
4. In Apps Script: **Deploy → New deployment → Web app**.
   Execute as **Me**, access **Anyone**. Copy the `/exec` URL.

Set `POSTER_COUNT` in `Code.gs` if you don't have exactly 54.

## 3. Publish

1. New GitHub repo, e.g. `icats-poster-vote`. Upload these files at the repo root.
2. Paste the `/exec` URL into `ENDPOINT` in `config.js`, commit.
3. Settings → Pages → Source **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Live in ~1 minute at `https://USERNAME.github.io/icats-poster-vote/`.

Test end to end before the conference: vote with one code, confirm the row lands in
**Votes**, confirm the same code is refused a second time.

## 4. Codes and QR

Open `tools/print-codes.html`, enter your Pages URL, paste the Tokens column, build,
print, cut. Scanning a slip opens the ballot with that code filled in.

To block self-voting, put a presenter's own poster number in the `ownPoster` column
next to their code before handing it out.

Also print one large QR of the plain Pages URL for the hall entrance — anyone who
loses a slip can still type their code.

## 5. On the day

- Open voting when the poster session is about half over.
- Announce the deadline twice; walk the hall with the QR sign in the last 30 minutes.
- To close early, set `OPEN: false` in `config.js` and commit, or set `CLOSES_AT`
  in advance, e.g. `"2026-09-10T16:15:00+09:00"`.

## 6. Results

**Poster vote → Tally results.** Writes the full ranking to the **Results** sheet;
top 8 win. Ties break on number of 1st choices, then 2nd choices.

Announce the rules beforehand, including the cap of two awards per research group —
apply it by skipping down the Results list if a third poster from one group lands in
the top 8.

## Notes

- Apps Script cannot answer a CORS preflight, so the POST uses `text/plain`. Don't
  change that header.
- `localStorage` blocks accidental resubmits; the code list is what actually enforces
  one ballot per person.
- No dependencies, no build step, no API keys in the client.
