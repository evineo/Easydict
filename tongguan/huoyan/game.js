(function () {
  "use strict";

  var KEY = "tongguan.huoyan.v1";
  var W = 320;
  var H = 340;
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  function $(id) {
    return document.getElementById(id);
  }
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function loadBest() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "{}");
      return { bestCombo: Number(d.bestCombo) || 0, bestLevel: Number(d.bestLevel) || 0 };
    } catch (e) {
      return { bestCombo: 0, bestLevel: 0 };
    }
  }
  function saveBest(combo, level) {
    var cur = loadBest();
    var next = {
      bestCombo: Math.max(cur.bestCombo, combo),
      bestLevel: Math.max(cur.bestLevel, level),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  var audioCtx = null;
  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.07, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function sfxOk(c) {
    tone(540 + Math.min(c, 8) * 30, 0.1, "triangle", 0.06);
    setTimeout(function () {
      tone(820, 0.12, "sine", 0.04);
    }, 35);
  }
  function sfxBad() {
    tone(160, 0.16, "sawtooth", 0.03);
  }
  function sfxWin() {
    [523, 659, 784].forEach(function (f, i) {
      setTimeout(function () {
        tone(f, 0.16, "sine", 0.05);
      }, i * 80);
    });
  }

  /* ---- Scene model ---- */
  var COLORS = {
    peach: ["#ff8f6b", "#ffb087", "#e85d4c"],
    leaf: ["#6fbf6a", "#4ea35a", "#8fd67a"],
    monkey: ["#c48a4a", "#a86f35", "#d4a06a"],
    rock: ["#8a8078", "#6e6660", "#a39a90"],
    cloud: ["#fff6e8", "#ffe2b8", "#f0d9b0"],
    bird: ["#5b8cff", "#3d6fe0", "#7aa2ff"],
    torch: ["#ffb347", "#ff7a3c", "#ffd27a"],
    flower: ["#ff6b9d", "#ff8fb5", "#e84d7f"],
  };

  function makeBaseProps(rng, level) {
    var n = 10 + Math.min(level, 6) * 2;
    var props = [];
    var tries = 0;
    while (props.length < n && tries < 200) {
      tries++;
      var type = pick(rng, ["peach", "leaf", "monkey", "rock", "cloud", "bird", "torch", "flower"]);
      var x = 28 + rng() * (W - 56);
      var y = 40 + rng() * (H - 80);
      var tooClose = props.some(function (p) {
        var dx = p.x - x;
        var dy = p.y - y;
        return dx * dx + dy * dy < 38 * 38;
      });
      if (tooClose) continue;
      var palette = COLORS[type];
      props.push({
        id: "p" + props.length,
        type: type,
        x: x,
        y: y,
        r: 14 + rng() * 10,
        color: pick(rng, palette),
        rot: (rng() - 0.5) * 40,
        visible: true,
      });
    }
    return props;
  }

  function cloneProps(props) {
    return props.map(function (p) {
      return {
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
        r: p.r,
        color: p.color,
        rot: p.rot,
        visible: p.visible,
      };
    });
  }

  function applyDiffs(rng, left, level) {
    var right = cloneProps(left);
    var count = clamp(4 + Math.floor((level - 1) / 1.2), 4, 8);
    var idxs = shuffle(
      rng,
      left.map(function (_, i) {
        return i;
      })
    );
    var diffs = [];
    var kindsPool =
      level <= 2
        ? ["color", "hide", "move"]
        : level <= 4
          ? ["color", "hide", "move", "size", "nearcolor"]
          : ["color", "hide", "move", "size", "nearcolor", "type"];

    for (var k = 0; k < count && k < idxs.length; k++) {
      var i = idxs[k];
      var L = left[i];
      var R = right[i];
      var kind = pick(rng, kindsPool);
      // last 1-2 diffs bias to nearcolor / small move = 灯下黑
      if (k >= count - 2 && level >= 3) kind = pick(rng, ["nearcolor", "move", "size"]);

      var label = "";
      if (kind === "hide") {
        R.visible = false;
        label = "少了一个东西";
      } else if (kind === "color") {
        var alt = COLORS[R.type].filter(function (c) {
          return c !== R.color;
        });
        R.color = pick(rng, alt);
        label = "颜色不一样";
      } else if (kind === "nearcolor") {
        // subtle: nudge toward neighbor tone
        R.color = pick(rng, COLORS[R.type]);
        if (R.color === L.color) R.color = COLORS[R.type][0];
        label = "颜色差一点";
      } else if (kind === "move") {
        var dx = (rng() < 0.5 ? -1 : 1) * (10 + rng() * (level >= 4 ? 10 : 16));
        var dy = (rng() < 0.5 ? -1 : 1) * (8 + rng() * 12);
        R.x = clamp(R.x + dx, 20, W - 20);
        R.y = clamp(R.y + dy, 30, H - 20);
        label = "位置挪了";
      } else if (kind === "size") {
        R.r = clamp(R.r + (rng() < 0.5 ? -6 : 7), 10, 30);
        label = "大小不一样";
      } else if (kind === "type") {
        var types = ["peach", "leaf", "monkey", "rock", "cloud", "bird", "torch", "flower"].filter(
          function (t) {
            return t !== R.type;
          }
        );
        R.type = pick(rng, types);
        R.color = pick(rng, COLORS[R.type]);
        label = "换成别的东西了";
      }

      diffs.push({
        id: L.id,
        kind: kind,
        label: label,
        ax: L.x,
        ay: L.y,
        bx: R.visible ? R.x : L.x,
        by: R.visible ? R.y : L.y,
        radius: Math.max(L.r, R.r, 16) + 14,
        found: false,
      });
    }
    return { left: left, right: right, diffs: diffs };
  }

  function propPath(p) {
    var t = p.type;
    if (t === "peach") {
      return '<circle cx="0" cy="2" r="10" fill="' + p.color + '"/><ellipse cx="-2" cy="-8" rx="4" ry="6" fill="#6fbf6a" transform="rotate(-20)"/>';
    }
    if (t === "leaf") {
      return '<ellipse cx="0" cy="0" rx="11" ry="7" fill="' + p.color + '" transform="rotate(' + p.rot + ')"/><line x1="0" y1="-6" x2="0" y2="6" stroke="#2f6b38" stroke-width="1.5"/>';
    }
    if (t === "monkey") {
      return (
        '<circle cx="0" cy="0" r="11" fill="' +
        p.color +
        '"/><circle cx="-4" cy="-2" r="2" fill="#1a0f08"/><circle cx="4" cy="-2" r="2" fill="#1a0f08"/><ellipse cx="0" cy="4" rx="4" ry="3" fill="#f0d2b0"/>'
      );
    }
    if (t === "rock") {
      return '<ellipse cx="0" cy="2" rx="12" ry="8" fill="' + p.color + '"/><ellipse cx="-3" cy="0" rx="4" ry="2" fill="rgba(0,0,0,0.12)"/>';
    }
    if (t === "cloud") {
      return (
        '<ellipse cx="0" cy="2" rx="14" ry="7" fill="' +
        p.color +
        '"/><ellipse cx="-8" cy="0" rx="7" ry="6" fill="' +
        p.color +
        '"/><ellipse cx="8" cy="0" rx="7" ry="6" fill="' +
        p.color +
        '"/>'
      );
    }
    if (t === "bird") {
      return (
        '<ellipse cx="0" cy="0" rx="9" ry="5" fill="' +
        p.color +
        '"/><path d="M-2 0 Q-14 -8 -10 2" fill="none" stroke="' +
        p.color +
        '" stroke-width="3"/><circle cx="5" cy="-1" r="1.5" fill="#1a0f08"/>'
      );
    }
    if (t === "torch") {
      return (
        '<rect x="-3" y="0" width="6" height="12" rx="1" fill="#6b3d1e"/><ellipse cx="0" cy="-4" rx="6" ry="8" fill="' +
        p.color +
        '"/>'
      );
    }
    return (
      '<circle cx="0" cy="0" r="8" fill="' +
      p.color +
      '"/><circle cx="0" cy="0" r="3" fill="#ffffff"/>'
    );
  }

  function renderScene(props, theme) {
    var sky =
      theme === "night"
        ? '<rect width="' + W + '" height="' + H + '" fill="#1a2740"/>'
        : '<rect width="' + W + '" height="' + H + '" fill="url(#sky)"/>';
    var ground =
      '<ellipse cx="' +
      W / 2 +
      '" cy="' +
      (H - 10) +
      '" rx="170" ry="36" fill="#2f6b45" opacity="0.85"/>';
    var defs =
      '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#7ec8ff"/><stop offset="1" stop-color="#d9f0ff"/></linearGradient></defs>';
    var sun =
      theme === "night"
        ? '<circle cx="268" cy="48" r="18" fill="#f0e6c8" opacity="0.9"/>'
        : '<circle cx="268" cy="48" r="22" fill="#ffd27a"/>';
    var body = props
      .filter(function (p) {
        return p.visible;
      })
      .map(function (p) {
        return (
          '<g transform="translate(' +
          p.x +
          " " +
          p.y +
          ") scale(" +
          (p.r / 14).toFixed(2) +
          ')">' +
          propPath(p) +
          "</g>"
        );
      })
      .join("");
    return (
      '<svg viewBox="0 0 ' +
      W +
      " " +
      H +
      '" xmlns="http://www.w3.org/2000/svg">' +
      defs +
      sky +
      sun +
      ground +
      body +
      "</svg>"
    );
  }

  /* ---- State ---- */
  var S = {
    level: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hearts: 3,
    session: null,
    hintShown: false,
    idleTimer: null,
  };

  function show(name) {
    $("screen-title").hidden = name !== "title";
    $("screen-play").hidden = name !== "play";
    $("screen-result").hidden = name !== "result";
  }

  function refreshBest() {
    var b = loadBest();
    $("bestline").textContent =
      "最高连击 " + (b.bestCombo || "—") + " · 最远关 " + (b.bestLevel || "—");
  }

  function setHearts() {
    var nodes = $("stars").querySelectorAll("i");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("off", i >= S.hearts);
    }
  }

  function startLevel() {
    try {
      var seed = (Date.now() ^ (S.level * 7919) ^ ((Math.random() * 1e9) | 0)) >>> 0;
      var rng = mulberry32(seed);
      var base = makeBaseProps(rng, S.level);
      var pack = applyDiffs(rng, base, S.level);
      var theme = S.level % 3 === 0 ? "night" : "day";
      S.session = {
        seed: seed,
        left: pack.left,
        right: pack.right,
        diffs: pack.diffs,
        theme: theme,
        found: 0,
      };
      S.hearts = 3;
      S.combo = 0;
      S.hintShown = false;
      $("level-pill").textContent = "第 " + S.level + " 眼";
      $("score").textContent = String(S.score);
      $("combo").hidden = true;
      $("btn-hint").hidden = true;
      $("prompt").textContent = "找出 " + pack.diffs.length + " 处不同（点左图或右图都行）";
      setHearts();
      show("play");
      paint();
      armHint();
    } catch (err) {
      console.error(err);
      $("bestline").textContent = "开局出错：" + (err && err.message ? err.message : err);
      show("title");
    }
  }

  function paint() {
    $("stage-a").innerHTML = renderScene(S.session.left, S.session.theme);
    $("stage-b").innerHTML = renderScene(S.session.right, S.session.theme);
    // clear old rings
    ["stage-a", "stage-b"].forEach(function (id) {
      var stage = $(id);
      stage.querySelectorAll(".ring").forEach(function (n) {
        n.remove();
      });
    });
    S.session.diffs.forEach(function (d) {
      if (!d.found) return;
      addRing("stage-a", d.ax, d.ay, d.radius);
      addRing("stage-b", d.bx, d.by, d.radius);
    });
    $("found").textContent = "已找 " + S.session.found + " / " + S.session.diffs.length;
  }

  function addRing(stageId, x, y, r) {
    var stage = $(stageId);
    var ring = document.createElement("div");
    ring.className = "ring";
    var rect = stage.getBoundingClientRect();
    var sx = rect.width / W;
    var sy = rect.height / H;
    ring.style.left = x * sx + "px";
    ring.style.top = y * sy + "px";
    ring.style.width = r * 2 * sx + "px";
    ring.style.height = r * 2 * sy + "px";
    stage.appendChild(ring);
  }

  function localXY(stage, ev) {
    var rect = stage.getBoundingClientRect();
    var clientX = ev.clientX;
    var clientY = ev.clientY;
    if (ev.touches && ev.touches[0]) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    }
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function hitDiff(x, y, side) {
    var best = null;
    var bestDist = 1e9;
    S.session.diffs.forEach(function (d) {
      if (d.found) return;
      var cx = side === "a" ? d.ax : d.bx;
      var cy = side === "a" ? d.ay : d.by;
      // also allow clicking the other panel's corresponding point roughly
      var dx = x - cx;
      var dy = y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var hitR = d.radius * 0.95;
      if (dist <= hitR && dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    });
    // cross-check: if clicked near left coords while on right etc.
    if (!best) {
      S.session.diffs.forEach(function (d) {
        if (d.found) return;
        var pairs = [
          [d.ax, d.ay],
          [d.bx, d.by],
        ];
        pairs.forEach(function (p) {
          var dx = x - p[0];
          var dy = y - p[1];
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= d.radius * 0.95 && dist < bestDist) {
            best = d;
            bestDist = dist;
          }
        });
      });
    }
    return best;
  }

  function floatScore(n) {
    if (reduceMotion || n <= 0) return;
    var el = document.createElement("div");
    el.className = "fx-float";
    el.textContent = "+" + n;
    $("fx").appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 750);
  }

  function armHint() {
    clearTimeout(S.idleTimer);
    S.idleTimer = setTimeout(function () {
      if (!S.session) return;
      if (S.session.found >= S.session.diffs.length) return;
      $("btn-hint").hidden = false;
    }, 12000);
  }

  function onStagePointer(side, ev) {
    if (!S.session) return;
    ev.preventDefault();
    var stage = $("stage-" + side);
    var pt = localXY(stage, ev);
    var diff = hitDiff(pt.x, pt.y, side);
    if (diff) {
      diff.found = true;
      S.session.found++;
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      var gain = 80 + Math.min(S.combo, 10) * 20;
      S.score += gain;
      $("score").textContent = String(S.score);
      $("combo").hidden = false;
      $("combo").innerHTML = "连击 <b>" + S.combo + "</b>";
      var oks = ["找着了。", "好眼力。", "再盯紧一点。", "火眼渐开。"];
      $("prompt").textContent = oks[S.session.found % oks.length];
      paint();
      floatScore(gain);
      sfxOk(S.combo);
      armHint();
      if (S.session.found >= S.session.diffs.length) finish(true);
    } else {
      S.combo = 0;
      $("combo").hidden = true;
      S.hearts = Math.max(0, S.hearts - 1);
      setHearts();
      $("boards").classList.remove("shake");
      void $("boards").offsetWidth;
      $("boards").classList.add("shake");
      $("prompt").textContent = S.hearts > 0 ? "这里一样。再看看别处。" : "心神耗尽——本眼结束。";
      sfxBad();
      armHint();
      if (S.hearts <= 0) finish(false);
    }
  }

  function useHint() {
    if (!S.session || S.hintShown) return;
    var next = S.session.diffs.find(function (d) {
      return !d.found;
    });
    if (!next) return;
    S.hintShown = true;
    $("btn-hint").hidden = true;
    // flash a soft guide ring without auto-completing
    addRing("stage-a", next.ax, next.ay, next.radius * 1.3);
    addRing("stage-b", next.bx, next.by, next.radius * 1.3);
    $("prompt").textContent = "看闪闪的那一带——不直接告诉你是什么。";
    if (S.hearts > 1) {
      S.hearts -= 1;
      setHearts();
    }
  }

  function finish(won) {
    clearTimeout(S.idleTimer);
    saveBest(S.maxCombo, S.level);
    refreshBest();
    $("res-kicker").textContent = "第 " + S.level + " 眼结算";
    $("res-title").textContent = won ? (S.session.found >= 6 ? "火眼通明" : "火眼初开") : "雾遮慧眼";
    $("res-diffs").textContent = S.session.diffs
      .map(function (d, i) {
        return i + 1 + ". " + d.label + (d.found ? "" : "（未找到）");
      })
      .join(" · ");
    $("res-stats").innerHTML =
      '<div class="stat"><b>' +
      S.session.found +
      "/" +
      S.session.diffs.length +
      "</b><span>找到</span></div>" +
      '<div class="stat"><b>' +
      S.maxCombo +
      "</b><span>最高连击</span></div>" +
      '<div class="stat"><b>' +
      S.score +
      "</b><span>总分</span></div>";
    if (won) sfxWin();
    show("result");
    if (won) S.level++;
  }

  function bind() {
    refreshBest();
    $("btn-start").onclick = function () {
      ensureAudio();
      S.level = 1;
      S.score = 0;
      S.maxCombo = 0;
      startLevel();
    };
    $("btn-quit").onclick = function () {
      clearTimeout(S.idleTimer);
      show("title");
      refreshBest();
    };
    $("btn-home").onclick = function () {
      show("title");
      refreshBest();
    };
    $("btn-next").onclick = function () {
      ensureAudio();
      startLevel();
    };
    $("btn-hint").onclick = useHint;

    $("boards").addEventListener(
      "pointerdown",
      function (ev) {
        var stage = ev.target.closest && ev.target.closest(".stage");
        if (!stage) return;
        var side = stage.id === "stage-a" ? "a" : stage.id === "stage-b" ? "b" : null;
        if (!side) return;
        onStagePointer(side, ev);
      },
      { passive: false }
    );
  }

  bind();
})();
