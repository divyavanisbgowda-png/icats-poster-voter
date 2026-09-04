/**
 * ICATS-FHM 2026 — poster vote backend.
 * Bound to a Google Sheet. Deploy as: Web app, execute as Me, access Anyone.
 *
 * Voters identify themselves by typing their name as printed on their
 * conference ID card. Ballots are recorded as given and not checked against a
 * roster, so scan the Votes sheet for duplicate names before tallying.
 *
 * Sheets used (setup() creates them):
 *   Votes    timestamp | name | first | second | third
 *   Results  written by tally()
 */

var POSTER_COUNT = 54;   // must match data/posters.json
var AWARDS = 8;
var MAX_PER_GROUP = 2;   // cap on awards per research group; 0 disables

// ---------------------------------------------------------------- setup

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(ss, 'Votes', ['timestamp', 'name', 'first', 'second', 'third']);
  sheet_(ss, 'Results', ['rank', 'poster', 'points', 'firsts', 'seconds', 'thirds']);
  SpreadsheetApp.getUi().alert('Sheets ready. Deploy the web app to start collecting ballots.');
}

function sheet_(ss, name, header) {
  var s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0) s.appendRow(header);
  return s;
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
    var name = String(body.name || '').trim().replace(/\s+/g, ' ');
    var picks = body.picks || [];

    if (name.length < 3) {
      return json_({ ok: false, error: 'Enter your name exactly as printed on your conference ID card.' });
    }
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
    ss.getSheetByName('Votes').appendRow([new Date(), name, picks[0], picks[1], picks[2]]);

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

  // Names are self-reported and unenforced, so flag anyone who voted more than once.
  var names = votes.getRange(2, 2, last - 1, 1).getValues();
  var seenNames = {}, repeats = [];
  names.forEach(function (n) {
    var key = String(n[0]).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return;
    seenNames[key] = (seenNames[key] || 0) + 1;
    if (seenNames[key] === 2) repeats.push(String(n[0]).trim());
  });

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
    (repeats.length
      ? '\n\nWARNING: these names appear on more than one ballot, and all of ' +
        'their ballots were counted — remove the extras in Votes and tally again:\n' +
        repeats.join(', ')
      : '\n\nNo duplicate voter names found.') +
    '\n\nCheck the group cap (max ' + MAX_PER_GROUP + ' per research group) before announcing.'
  );
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Poster vote')
    .addItem('Set up sheets', 'setup')
    .addItem('Tally results', 'tally')
    .addToUi();
}
