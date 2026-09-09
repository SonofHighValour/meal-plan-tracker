# meal-plan-tracker
# meal-plan-tracker

Automatically logs campus meal plan transactions from the CBORD **GET Mobile** portal into a Google Sheet, so dining dollar and meal swipe usage can be tracked across a semester.

There is no public API for GET Mobile, so this scrapes the transaction table that's already displayed to the logged-in user and posts it to a Google Apps Script endpoint. Nothing is polled and no credentials are stored — the sync happens when you open the history page yourself.

📄 **[Read the full write-up](ADD_YOUR_SUBSTACK_LINK_HERE)** — why it's built this way, the spreadsheet math, and what the data actually showed.

---

## How it works

Two pieces that run in different places:

| File | Runs on | Job |
|------|---------|-----|
| `get-mobile-to-sheet.user.js` | Your browser, via Tampermonkey | Finds the transaction table, parses the rows, POSTs them |
| `Code.gs` | Google's servers, via Apps Script | Checks the password, discards duplicates, writes to the sheet |

The browser side is deliberately dumb: it sends every row visible on the page, every time. All the deduplication happens server-side, keyed on `account | timestamp | amount`. That makes the sync idempotent — reload the page fifty times and you still get one row per purchase, with no state to track and nothing to get out of sync between devices.

---

## Setup

### 1. Google Sheet + Apps Script

1. Create a Google Sheet, then **Extensions → Apps Script**.
2. Delete the template and paste in `Code.gs`.
3. Change `SECRET` to a long random string.
4. **Deploy → New deployment → Web app**, with:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Approve the OAuth prompt. It will warn that the app is unverified — that's expected for a personal script; the developer email shown should be your own.
6. Copy the `/exec` URL.

> The script must be created *from inside the sheet* so it's container-bound. A standalone project at script.google.com will fail, because `getActiveSpreadsheet()` returns null.

### 2. Tampermonkey

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari, Opera).
2. Create a new script, clear the editor **completely**, and paste in `get-mobile-to-sheet.user.js`.
3. Set `ENDPOINT` to your `/exec` URL and `SECRET` to the same string from step 1.
4. Update the `@match` line if your school's GET portal is on a different path.
5. Save, then open your transaction history page.

A badge appears bottom-right. Green with a count means it worked. Click it to force a re-sync.

---

## Output

A `Transactions` tab, created automatically on first run:

| Key | Account | Timestamp | Details | Amount | Meals | Captured At |
|-----|---------|-----------|---------|--------|-------|-------------|

Dining dollars land in `Amount`, meal swipes in `Meals`, so the two can be charted independently. Rows stay sorted chronologically.

**Keep formulas off this tab** — the script re-sorts columns A–G on every sync, so anything in column H would drift out of alignment. Put derived columns and charts on a separate sheet and reference `Transactions` with whole-column ranges so new rows are picked up automatically.

---

## Troubleshooting

Each of these cost me real time:

| Symptom | Cause |
|---------|-------|
| `Script function not found: doPost` | The deployment is a frozen snapshot. Editing the file changes nothing until **Manage deployments → pencil → New version**. Creating a *new* deployment instead leaves a stale URL live. |
| Same error, but `doGet` works | The userscript is pointing at a different (older) deployment than the one you tested. |
| `Script function not found` after pasting | Everything got nested inside Apps Script's default `myFunction`. All functions must be at the top level. |
| Badge says `bad response` | Google returned HTML instead of JSON. Check the console logs the script prints. |
| Nothing happens at all | `// ==UserScript==` must be the very first line. A leftover template comment above it breaks the metadata block, and `@connect` never registers. |
| `bad secret` | Mismatch between the two files — usually a trailing space. |

---

## Limitations

- **Not live.** Data only syncs when you open the history page. There's no background polling.
- **Only what's on screen.** The script sends the rows currently rendered, so page through history to backfill.
- **`Activity Details` is often useless.** Most transactions show `Cloud_POS_-_SBU` with no merchant name, so there's no location breakdown available.
- **Same-second collisions.** Two identical purchases in the same second share a key and collapse into one row. Not realistic with a card reader, but it's the honest limit of content-based keys.
- **Scales to a semester, not years.** Every sync reads all existing keys back out before deciding. Fine at a few thousand rows.

---

## A note on scraping

This only reads data already displayed to the authenticated user in their own browser. No auth bypass, no undocumented endpoints, no one else's data. It fires once per page load.

That said, automated access isn't something CBORD's terms contemplate, and your school likely has an acceptable use policy covering university systems. Don't put this on a timer.

---

## Built with

Written with help from Claude (Anthropic). The architecture decisions, debugging, and spreadsheet modeling are mine; see the write-up for the full story, including the parts that didn't work the first time.

## License

MIT — see [LICENSE](LICENSE).
