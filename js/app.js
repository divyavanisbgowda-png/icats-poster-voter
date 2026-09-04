(function () {
  "use strict";

  var LS_KEY = "icats2026.ballot.sent";
  var posters = [];
  var picks = [null, null, null];  // resolved poster ids or null, index = rank - 1
  var sending = false;

  var $ = function (id) { return document.getElementById(id); };
  var pickEls = [$("pick1"), $("pick2"), $("pick3")];
  var fbEls = [$("fb1"), $("fb2"), $("fb3")];
  var reviewEl = $("review"), sheetEl = $("submit"), doneEl = $("done"),
      recapEl = $("recap"), tokenEl = $("token"), errEl = $("err"),
      hintEl = $("hint");

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function votingClosed() {
    if (!window.CONFIG.OPEN) return true;
    var t = window.CONFIG.CLOSES_AT;
    return !!t && Date.now() > new Date(t).getTime();
  }

  function byId(id) {
    for (var i = 0; i < posters.length; i++) if (posters[i].id === id) return posters[i];
    return null;
  }

  // Accepts "P05", "p5", "5", "05" and normalises to a poster id.
  function resolve(raw) {
    var m = String(raw || "").trim().toUpperCase().match(/^P?(\d{1,2})$/);
    if (!m) return null;
    var num = m[1].length === 1 ? "0" + m[1] : m[1];
    return byId("P" + num);
  }

  // ---------- rendering ----------

  function renderPicks() {
    var seen = {};
    for (var i = 0; i < 3; i++) {
      var raw = pickEls[i].value;
      var p = raw.trim() ? resolve(raw) : null;
      var fb = fbEls[i];
      if (!raw.trim()) {
        picks[i] = null;
        fb.textContent = "";
        fb.className = "slot__fb";
      } else if (!p) {
        picks[i] = null;
        fb.textContent = "Not found";
        fb.className = "slot__fb slot__fb--err";
      } else if (seen[p.id]) {
        picks[i] = null;
        fb.textContent = "Already picked";
        fb.className = "slot__fb slot__fb--err";
      } else {
        seen[p.id] = true;
        picks[i] = p.id;
        fb.textContent = p.title;
        fb.className = "slot__fb slot__fb--ok";
      }
    }

    var valid = picks[0] && picks[1] && picks[2];
    reviewEl.disabled = !valid;
    reviewEl.textContent = valid ? "Review and submit" : "Enter three different poster numbers";
  }

  pickEls.forEach(function (el) { el.addEventListener("input", renderPicks); });

  // ---------- interaction ----------

  reviewEl.addEventListener("click", function () {
    recapEl.innerHTML = picks.map(function (id) {
      var p = byId(id);
      return "<li>" + esc(p.id) + " — " + esc(p.title) + "</li>";
    }).join("");
    errEl.hidden = true;
    sheetEl.showModal();
    tokenEl.focus();
  });

  $("cancel").addEventListener("click", function () { sheetEl.close(); });

  function fail(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
    sending = false;
    $("send").disabled = false;
    $("send").textContent = "Submit ballot";
  }

  $("send").addEventListener("click", function () {
    if (sending) return;
    var token = tokenEl.value.trim().toUpperCase();
    if (token.length < 4) return fail("Enter the voting code printed on your badge.");
    if (!picks[0] || !picks[1] || !picks[2]) return fail("Your ballot needs three different posters.");

    sending = true;
    this.disabled = true;
    this.textContent = "Sending…";

    // text/plain avoids a CORS preflight that Apps Script cannot answer.
    fetch(window.CONFIG.ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: token, picks: picks })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) return fail(res.error || "That code was not accepted.");
        localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), picks: picks }));
        sheetEl.close();
        doneEl.showModal();
      })
      .catch(function () {
        fail("Could not reach the server. Move closer to the wifi and try again — your picks are saved.");
      });
  });

  // ---------- boot ----------

  function lockOut(title, msg) {
    document.querySelector("main").innerHTML =
      '<p class="empty"><strong>' + esc(title) + '</strong><br>' + esc(msg) + '</p>';
    document.querySelector(".dock").hidden = true;
    document.getElementById("ballot").hidden = true;
  }

  fetch("data/posters.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      posters = data;
      if (votingClosed()) return lockOut("Voting has closed", "Winners are announced at the closing ceremony.");
      if (localStorage.getItem(LS_KEY)) {
        var prev = JSON.parse(localStorage.getItem(LS_KEY));
        return lockOut("You have already voted", "Your ballot: " + prev.picks.join(", ") + ".");
      }
      var t = new URLSearchParams(location.search).get("t");
      if (t) tokenEl.value = t.trim().toUpperCase();
      pickEls.forEach(function (el) { el.disabled = false; });
      renderPicks();
      hintEl.textContent = posters.length
        ? "Enter the poster number printed on the board for each of your top three choices. " +
          posters.length + " posters on display."
        : "Enter the poster number printed on the board for each of your top three choices.";
    })
    .catch(function () {
      lockOut("Poster list did not load", "Pull down to refresh, or ask at the registration desk.");
    });
})();
