/**
 * ICATS-FHM 2026 — poster vote backend.
 * Bound to a Google Sheet. Deploy as: Web app, execute as Me, access Anyone.
 *
 * Sheets used (setup() creates them):
 *   Tokens   code | used | usedAt | ownPoster
 *   Votes    timestamp | code | first | second | third
 *   Results  written by tally()
 */

var POSTER_COUNT = 54;   // must match data/posters.json
var AWARDS = 8;
var MAX_PER_GROUP = 2;   // cap on awards per research group; 0 disables

// ---------------------------------------------------------------- setup

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(ss, 'Tokens', ['code', 'used', 'usedAt', 'ownPoster']);
  sheet_(ss, 'Votes', ['timestamp', 'code', 'first', 'second', 'third']);
  sheet_(ss, 'Results', ['rank', 'poster', 'points', 'firsts', 'seconds', 'thirds']);
  SpreadsheetApp.getUi().alert('Sheets ready. Now run generateTokens.');
}

function sheet_(ss, name, header) {
  var s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0) s.appendRow(header);
  return s;
}

/** Creates 160 unique voting codes. Print these and hand one to each attendee. */
function generateTokens() {
  var COUNT = 160;
  var chars = 'ACDEFGHJKMNPQRTUVWXY3479';   // no look-alikes
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tokens');
  var seen = {}, rows = [];
  while (rows.length < COUNT) {
    var c = '';
    for (var i = 0; i < 7; i++) c += chars.charAt(Math.floor(Math.random() * chars.length));
    c = c.slice(0, 4) + '-' + c.slice(4);
    if (seen[c]) continue;
    seen[c] = 1;
    rows.push([c, '', '', '']);
  }
  s.getRange(2, 1, rows.length, 4).setValues(rows);
  SpreadsheetApp.getUi().alert(COUNT + ' codes created in the Tokens sheet.');
}

// ---------------------------------------------------------------- web app

function doGet() {
  return json_({ ok: true, service: 'icats-poster-vote' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'Server busy. Try again in a moment.' });
  }

  try {
    var body = JSON.parse(e.postData.contents);
    var code = String(body.token || '').trim().toUpperCase();
    var picks = body.picks || [];

    if (picks.length !== 3) return json_({ ok: false, error: 'Choose exactly three posters.' });

    var valid = /^P\d{2}$/;
    for (var i = 0; i < 3; i++) {
      var n = parseInt(String(picks[i]).slice(1), 10);
      if (!valid.test(picks[i]) || n < 1 || n > POSTER_COUNT) {
        return json_({ ok: false, error: 'Unknown poster number.' });
      }
    }
    if (picks[0] === picks[1] || picks[1] === picks[2] || picks[0] === picks[2]) {
      return json_({ ok: false, error: 'Pick three different posters.' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tokens = ss.getSheetByName('Tokens');
    var data = tokens.getRange(2, 1, Math.max(tokens.getLastRow() - 1, 1), 4).getValues();

    var row = -1;
    for (var r = 0; r < data.length; r++) {
      if (String(data[r][0]).trim().toUpperCase() === code) { row = r; break; }
    }
    if (row === -1) return json_({ ok: false, error: 'That code is not on the list. Check it at the registration desk.' });
    if (data[row][1] === 'yes') return json_({ ok: false, error: 'This code has already been used to vote.' });

    var own = String(data[row][3] || '').trim().toUpperCase();
    if (own && picks.indexOf(own) > -1) {
      return json_({ ok: false, error: 'You cannot vote for your own poster (' + own + ').' });
    }

    ss.getSheetByName('Votes').appendRow([new Date(), code, picks[0], picks[1], picks[2]]);
    tokens.getRange(row + 2, 2, 1, 2).setValues([['yes', new Date()]]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Could not record the ballot. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- tally

/** 3 points for a 1st choice, 2 for a 2nd, 1 for a 3rd. Ties break on firsts, then seconds. */
function tally() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var votes = ss.getSheetByName('Votes');
  var last = votes.getLastRow();
  if (last < 2) { SpreadsheetApp.getUi().alert('No ballots yet.'); return; }

  var rows = votes.getRange(2, 3, last - 1, 3).getValues();
  var score = {};
  rows.forEach(function (v) {
    [3, 2, 1].forEach(function (pts, i) {
      var id = String(v[i]).trim().toUpperCase();
      if (!id) return;
      score[id] = score[id] || { pts: 0, f: 0, s: 0, t: 0 };
      score[id].pts += pts;
      score[id][['f', 's', 't'][i]]++;
    });
  });

  var ranked = Object.keys(score).map(function (id) {
    return [id, score[id].pts, score[id].f, score[id].s, score[id].t];
  }).sort(function (a, b) {
    return (b[1] - a[1]) || (b[2] - a[2]) || (b[3] - a[3]);
  });

  var out = ranked.map(function (r, i) { return [i + 1, r[0], r[1], r[2], r[3], r[4]]; });
  var sh = ss.getSheetByName('Results');
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 6).clearContent();
  sh.getRange(2, 1, out.length, 6).setValues(out);

  SpreadsheetApp.getUi().alert(
    rows.length + ' ballots counted.\nTop ' + AWARDS + ': ' +
    ranked.slice(0, AWARDS).map(function (r) { return r[0]; }).join(', ') +
    '\n\nCheck the group cap (max ' + MAX_PER_GROUP + ' per research group) before announcing.'
  );
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Poster vote')
    .addItem('Set up sheets', 'setup')
    .addItem('Generate voting codes', 'generateTokens')
    .addItem('Tally results', 'tally')
    .addToUi();
}
