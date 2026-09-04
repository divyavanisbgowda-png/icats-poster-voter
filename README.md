# ICATS-FHM 2026 — best poster vote

Attendees type the numbers of their top 3 posters from a phone. 3-2-1 points, top 8 win.
Static site on GitHub Pages, ballots stored in a Google Sheet via Apps Script.
Voters identify themselves by typing their name as printed on their conference ID card.
Names are recorded as given and **not** checked against a roster, so duplicates are
possible — `tally()` warns about repeated names before you announce.

```
index.html              ballot page
config.js               endpoint URL + open/close switch
css/style.css
js/app.js
data/posters.json       the 54 posters  ← replace this
apps-script/Code.gs     paste into Apps Script
tools/make-posters.html  CSV → posters.json
tools/print-codes.html   unused — left over from the retired voting-code scheme
```

## 1. Poster list

Export the abstract list as CSV with header `id,title,presenter,affiliation,theme`,
open `tools/make-posters.html`, paste, download, and overwrite `data/posters.json`.
IDs must be `P01`–`P54` and must match the numbers printed on the boards.

## 2. Sheet + backend

1. New Google Sheet → Extensions → Apps Script.
2. Delete the starter code, paste all of `apps-script/Code.gs`, save.
3. Reload the Sheet. A **Poster vote** menu appears → **Set up sheets**.
   Authorise when prompted.
4. In Apps Script: **Deploy → New deployment → Web app**.
   Execute as **Me**, access **Anyone**. Copy the `/exec` URL.

Set `POSTER_COUNT` in `Code.gs` if you don't have exactly 54.

## 3. Publish

1. New GitHub repo, e.g. `icats-poster-vote`. Upload these files at the repo root.
2. Paste the `/exec` URL into `ENDPOINT` in `config.js`, commit.
3. Settings → Pages → Source **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Live in ~1 minute at `https://USERNAME.github.io/icats-poster-vote/`.

Test end to end before the conference: cast one ballot, confirm the row lands in
**Votes** with the name and the three poster numbers.

## 4. QR

Print one large QR of the plain Pages URL for the hall entrance, and put smaller ones
on the poster-session signage. There is nothing to hand out — voters just need the URL
and their own name.

## 5. On the day

- Open voting when the poster session is about half over.
- Announce the deadline twice; walk the hall with the QR sign in the last 30 minutes.
- To close early, set `OPEN: false` in `config.js` and commit, or set `CLOSES_AT`
  in advance, e.g. `"2026-09-10T16:15:00+09:00"`.

## 6. Results

**Poster vote → Tally results.** Writes the full ranking to the **Results** sheet;
top 8 win. Ties break on number of 1st choices, then 2nd choices.

The alert also lists any name that appears on more than one ballot. Those extra
ballots **are** included in the ranking, so delete them in **Votes** and tally again
before announcing.

Announce the rules beforehand, including the cap of two awards per research group —
apply it by skipping down the Results list if a third poster from one group lands in
the top 8.

## Notes

- Apps Script cannot answer a CORS preflight, so the POST uses `text/plain`. Don't
  change that header.
- `localStorage` blocks an accidental resubmit from the same phone, but nothing stops
  a determined person voting again from another device or browser. One ballot per
  person rests on the honour system plus the duplicate-name check at tally time.
- Self-voting is no longer blocked automatically. Announce the rule instead, or check
  the **Votes** sheet for presenters who ranked their own poster first.
- No dependencies, no build step, no API keys in the client.
