(function () {
  "use strict";

  var LS_KEY = "icats2026.ballot.sent";
  var posters = [];
  var entry = ["", "", ""];        // raw digits typed per rank
  var active = 0;                  // which rank the keypad feeds
  var picks = [null, null, null];  // resolved poster ids, index = rank - 1
  var sending = false;

  var $ = function (id) { return document.getElementById(id); };
  var valEls = [$("val1"), $("val2"), $("val3")];
  var noteEls = [$("note1"), $("note2"), $("note3")];
  var slotEls = [].slice.call(document.querySelectorAll(".slot"));
  var reviewEl = $("review"), sheetEl = $("submit"), doneEl = $("done"),
      recapEl = $("recap"), voterEl = $("voter"), errEl = $("err"),
      hintEl = $("hint"), padEl = $("pad"), dockEl = $("dock");

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

  function notYetOpen() {
    var t = window.CONFIG.OPENS_AT;
    return !!t && Date.now() < new Date(t).getTime();
  }

  function byId(id) {
    for (var i = 0; i < posters.length; i++) if (posters[i].id === id) return posters[i];
    return null;
  }

  // "5", "05" -> P05. The keypad only ever produces digits.
  function resolve(raw) {
    var m = String(raw || "").match(/^(\d{1,2})$/);
    if (!m) return null;
    var num = m[1].length === 1 ? "0" + m[1] : m[1];
    return byId("P" + num);
  }

  // ---------- rendering ----------

  function render() {
    var seen = {};
    for (var i = 0; i < 3; i++) {
      var raw = entry[i];
      var p = raw ? resolve(raw) : null;
      var cls = "slot";
      var note = "";

      if (!raw) {
        picks[i] = null;
      } else if (!p) {
        picks[i] = null;
        note = "No such poster";
        cls += " slot--err";
      } else if (seen[p.id]) {
        picks[i] = null;
        note = "Already chosen";
        cls += " slot--err";
      } else {
        seen[p.id] = true;
        picks[i] = p.id;
      }

      if (raw) cls += " slot--filled";
      if (i === active) cls += " slot--active";
      slotEls[i].className = cls;
      valEls[i].textContent = raw || "––";
      noteEls[i].textContent = note;
    }

    var chosen = picks.filter(Boolean).length;
    var valid = chosen === 3;
    reviewEl.disabled = !valid;
    reviewEl.textContent = valid ? "Review and submit" : chosen + " of 3 chosen";
  }

  // ---------- keypad ----------

  function tap(d) {
    var v = entry[active];
    if (v.length >= 2) v = "";
    entry[active] = v + d;

    if (entry[active].length === 2) {
      for (var j = 0; j < 3; j++) {
        if (j !== active && !entry[j]) { active = j; break; }
      }
    }
    render();
  }

  function del() {
    if (entry[active]) {
      entry[active] = entry[active].slice(0, -1);
    } else if (active > 0) {
      active -= 1;
      entry[active] = entry[active].slice(0, -1);
    }
    render();
  }

  padEl.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.d) return tap(b.dataset.d);
    if (b.id === "del") return del();
    if (b.id === "nextSlot") { active = (active + 1) % 3; render(); }
  });

  slotEls.forEach(function (el) {
    el.addEventListener("click", function () { active = +el.dataset.i; render(); });
  });

  // Physical keyboards (desk staff, tablets with a case) still work.
  document.addEventListener("keydown", function (e) {
    if (sheetEl.open || doneEl.open) return;
    if (/^[0-9]$/.test(e.key)) { tap(e.key); e.preventDefault(); }
    else if (e.key === "Backspace") { del(); e.preventDefault(); }
    else if (e.key === "Tab") { active = (active + 1) % 3; render(); e.preventDefault(); }
  });

  // ---------- interaction ----------

  var RANKS = ["1st", "2nd", "3rd"];

  reviewEl.addEventListener("click", function () {
    recapEl.innerHTML = picks.map(function (id, i) {
      return '<li><span class="dot"></span><span class="rank">' + RANKS[i] +
             '</span><span class="num">' + esc(id.replace(/^P/, "")) + "</span></li>";
    }).join("");
    errEl.hidden = true;
    sheetEl.showModal();
    voterEl.focus();
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
    var name = voterEl.value.trim().replace(/\s+/g, " ");
    if (name.length < 3) return fail("Enter your name exactly as printed on your conference ID card.");
    if (!picks[0] || !picks[1] || !picks[2]) return fail("Your ballot needs three different posters.");

    sending = true;
    this.disabled = true;
    this.textContent = "Sending…";

    // text/plain avoids a CORS preflight that Apps Script cannot answer.
    fetch(window.CONFIG.ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name: name, picks: picks })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) return fail(res.error || "That ballot was not accepted.");
        localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), picks: picks }));
        sheetEl.close();
        $("donePills").innerHTML = picks.map(function (id) {
          return "<li>" + esc(id.replace(/^P/, "")) + "</li>";
        }).join("");
        doneEl.showModal();
      })
      .catch(function () {
        fail("Could not reach the server. Move closer to the wifi and try again — your picks are saved.");
      });
  });

  // ---------- boot ----------

  function lockOut(mark, title, msg, pills) {
    document.querySelector("main").innerHTML =
      '<div class="state"><div class="mark mark--' + mark + '">' + ICONS[mark] + "</div>" +
      "<h2>" + esc(title) + "</h2><p>" + esc(msg) + "</p>" +
      (pills ? '<ul class="pills">' + pills.map(function (n) {
        return "<li>" + esc(String(n).replace(/^P/, "")) + "</li>";
      }).join("") + "</ul>" : "") + "</div>";
    dockEl.hidden = true;
    document.getElementById("ballot").hidden = true;
  }

  var SVG = function (d) {
    return '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  };
  var ICONS = {
    ok: SVG('<path d="M20 6 9 17l-5-5"/>'),
    warn: SVG('<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>'),
    quiet: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
  };

  fetch("data/posters.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      posters = data;

      if (votingClosed()) {
        return lockOut("quiet", "Voting has closed",
          "Winners are announced at the closing ceremony.");
      }
      if (notYetOpen()) {
        return lockOut("quiet", "Voting opens later today",
          "The ballot unlocks part-way through the poster session. Come back then.");
      }
      if (localStorage.getItem(LS_KEY)) {
        var prev = JSON.parse(localStorage.getItem(LS_KEY));
        return lockOut("warn", "You have already voted",
          "This phone has already cast a ballot.", prev.picks);
      }

      hintEl.textContent = "Enter the number printed on the poster board." +
        (posters.length ? " " + posters.length + " posters on display." : "");
      padEl.hidden = false;
      dockEl.hidden = false;
      $("deadline").textContent = window.CONFIG.DEADLINE_NOTE || "";
      render();
    })
    .catch(function () {
      lockOut("quiet", "Poster list did not load",
        "Pull down to refresh, or ask at the registration desk.");
    });
})();
