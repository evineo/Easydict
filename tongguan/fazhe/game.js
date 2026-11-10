(function () {
  "use strict";

  var STORAGE_KEY = "tongguan.fazhe.v1";
  var JUDGE_COUNT = 8;
  var HUES = [
    { id: "crimson", label: "朱砂" },
    { id: "jade", label: "翠玉" },
    { id: "ink", label: "墨青" },
    { id: "gold", label: "金箔" },
  ];
  var MARKS = [
    { id: "circle", label: "圆印" },
    { id: "square", label: "方印" },
    { id: "diamond", label: "角印" },
    { id: "star", label: "星印" },
  ];
  var DIFFS = [
    { id: "intro", label: "入门", tier: 1 },
    { id: "steady", label: "稳阵", tier: 1 },
    { id: "sharp", label: "锐眼", tier: 2 },
    { id: "master", label: "破阵", tier: 3 },
  ];

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
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { bestScore: 0, bestCombo: 0 };
      var d = JSON.parse(raw);
      return {
        bestScore: Number(d.bestScore) || 0,
        bestCombo: Number(d.bestCombo) || 0,
      };
    } catch (e) {
      return { bestScore: 0, bestCombo: 0 };
    }
  }

  function saveBest(score, combo) {
    var cur = loadBest();
    var next = {
      bestScore: Math.max(cur.bestScore, score),
      bestCombo: Math.max(cur.bestCombo, combo),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  /* ---------- Audio (no assets) ---------- */
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
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
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function sfxOk(combo) {
    tone(520 + Math.min(combo, 8) * 28, 0.12, "triangle", 0.07);
    setTimeout(function () {
      tone(780 + Math.min(combo, 8) * 20, 0.16, "sine", 0.05);
    }, 40);
  }

  function sfxBad() {
    tone(180, 0.18, "sawtooth", 0.04);
    setTimeout(function () {
      tone(140, 0.22, "triangle", 0.035);
    }, 50);
  }

  function sfxDeal() {
    tone(340, 0.05, "square", 0.02);
  }

  function sfxWin() {
    [523, 659, 784].forEach(function (f, i) {
      setTimeout(function () {
        tone(f, 0.18, "sine", 0.06);
      }, i * 90);
    });
  }

  /* ---------- Domain ---------- */
  function makeItem(rng) {
    return {
      hue: pick(rng, HUES).id,
      mark: pick(rng, MARKS).id,
      pips: 1 + Math.floor(rng() * 3),
      rim: rng() < 0.35 ? "thick" : "plain",
      id: Math.floor(rng() * 1e9).toString(36),
    };
  }

  function itemKey(it) {
    return [it.hue, it.mark, it.pips, it.rim].join("|");
  }

  function hueLabel(id) {
    return HUES.find(function (h) {
      return h.id === id;
    }).label;
  }
  function markLabel(id) {
    return MARKS.find(function (m) {
      return m.id === id;
    }).label;
  }

  function rulePass(rule, item) {
    if (rule.kind === "hue") return item.hue === rule.value;
    if (rule.kind === "mark") return item.mark === rule.value;
    if (rule.kind === "pips_gte") return item.pips >= rule.value;
    if (rule.kind === "pips_eq") return item.pips === rule.value;
    if (rule.kind === "rim") return item.rim === rule.value;
    if (rule.kind === "and") return rulePass(rule.a, item) && rulePass(rule.b, item);
    if (rule.kind === "or") return rulePass(rule.a, item) || rulePass(rule.b, item);
    return false;
  }

  function describeRule(rule) {
    if (rule.kind === "hue") return "只有「" + hueLabel(rule.value) + "」色的符能进阵。";
    if (rule.kind === "mark") return "只有「" + markLabel(rule.value) + "」的符能进阵。";
    if (rule.kind === "pips_gte") return "点数至少是 " + rule.value + " 的符才能进阵。";
    if (rule.kind === "pips_eq") return "点数正好是 " + rule.value + " 的符才能进阵。";
    if (rule.kind === "rim")
      return rule.value === "thick" ? "只有厚边框的符能进阵。" : "只有细边框的符能进阵。";
    if (rule.kind === "and")
      return "必须同时满足：" + describeRule(rule.a).replace("。", "") + "，并且" + describeRule(rule.b).replace(/^只有|^点数|^必须/g, "").replace("能进阵。", "") + "。";
    if (rule.kind === "or")
      return describeRule(rule.a).replace("。", "") + "；或者" + describeRule(rule.b).replace(/^只有/, "");
    return "隐藏法则。";
  }

  function describeRuleClean(rule) {
    if (rule.kind === "hue") return "只有「" + hueLabel(rule.value) + "」色的符能进阵。";
    if (rule.kind === "mark") return "只有「" + markLabel(rule.value) + "」的符能进阵。";
    if (rule.kind === "pips_gte") return "点数至少是 " + rule.value + " 的符才能进阵。";
    if (rule.kind === "pips_eq") return "点数正好是 " + rule.value + " 的符才能进阵。";
    if (rule.kind === "rim")
      return rule.value === "thick" ? "只有厚边框的符能进阵。" : "只有细边框的符能进阵。";
    if (rule.kind === "and") {
      return (
        "要同时符合两件事才能进阵：\n" +
        "① " +
        describeRuleClean(rule.a) +
        "\n② " +
        describeRuleClean(rule.b)
      );
    }
    if (rule.kind === "or") {
      return describeRuleClean(rule.a) + "\n或者\n" + describeRuleClean(rule.b);
    }
    return "隐藏法则。";
  }

  function simpleRules(rng) {
    var list = [];
    HUES.forEach(function (h) {
      list.push({ kind: "hue", value: h.id });
    });
    MARKS.forEach(function (m) {
      list.push({ kind: "mark", value: m.id });
    });
    list.push({ kind: "pips_gte", value: 2 });
    list.push({ kind: "pips_eq", value: 1 });
    list.push({ kind: "pips_eq", value: 3 });
    list.push({ kind: "rim", value: "thick" });
    return shuffle(rng, list);
  }

  function compoundRules(rng) {
    var a = pick(rng, [
      { kind: "hue", value: pick(rng, HUES).id },
      { kind: "mark", value: pick(rng, MARKS).id },
    ]);
    var b =
      a.kind === "hue"
        ? { kind: "mark", value: pick(rng, MARKS).id }
        : { kind: "hue", value: pick(rng, HUES).id };
    if (rng() < 0.35) b = { kind: "pips_gte", value: 2 };
    return { kind: rng() < 0.7 ? "and" : "or", a: a, b: b };
  }

  function balanceOk(rule, items) {
    var pass = items.filter(function (it) {
      return rulePass(rule, it);
    }).length;
    return pass >= 2 && pass <= items.length - 2;
  }

  function generateRound(seed, tier) {
    var rng = mulberry32(seed);
    var rule;
    var pool;
    var tries = 0;
    do {
      tries++;
      if (tier >= 3 && rng() < 0.75) rule = compoundRules(rng);
      else if (tier >= 2 && rng() < 0.45) {
        rule = pick(rng, [
          { kind: "pips_gte", value: 2 },
          { kind: "pips_eq", value: 3 },
          { kind: "rim", value: "thick" },
          pick(rng, simpleRules(rng)),
        ]);
      } else rule = pick(rng, simpleRules(rng));

      pool = [];
      var seen = {};
      var guard = 0;
      while (pool.length < 40 && guard < 200) {
        guard++;
        var it = makeItem(rng);
        var k = itemKey(it);
        if (seen[k]) continue;
        seen[k] = true;
        pool.push(it);
      }
    } while ((!balanceOk(rule, pool) || pool.length < 16) && tries < 40);

    var positives = shuffle(
      rng,
      pool.filter(function (it) {
        return rulePass(rule, it);
      })
    );
    var negatives = shuffle(
      rng,
      pool.filter(function (it) {
        return !rulePass(rule, it);
      })
    );

    var examples = shuffle(rng, [
      { item: positives[0], pass: true },
      { item: positives[1], pass: true },
      { item: positives[2], pass: true },
      { item: negatives[0], pass: false },
      { item: negatives[1], pass: false },
      { item: negatives[2], pass: false },
    ]);

    var used = {};
    examples.forEach(function (ex) {
      used[itemKey(ex.item)] = true;
    });

    var judge = [];
    var needPass = Math.ceil(JUDGE_COUNT / 2);
    var needFail = JUDGE_COUNT - needPass;
    for (var i = 3; i < positives.length && needPass > 0; i++) {
      var p = positives[i];
      if (used[itemKey(p)]) continue;
      judge.push(p);
      used[itemKey(p)] = true;
      needPass--;
    }
    for (var j = 3; j < negatives.length && needFail > 0; j++) {
      var n = negatives[j];
      if (used[itemKey(n)]) continue;
      judge.push(n);
      used[itemKey(n)] = true;
      needFail--;
    }
    while (judge.length < JUDGE_COUNT) {
      var extra = makeItem(rng);
      if (used[itemKey(extra)]) continue;
      used[itemKey(extra)] = true;
      judge.push(extra);
    }
    judge = shuffle(rng, judge).slice(0, JUDGE_COUNT);

    return {
      seed: seed,
      rule: rule,
      examples: examples,
      judge: judge,
      text: describeRuleClean(rule),
    };
  }

  /* ---------- Render ---------- */
  function sealSvg(mark) {
    if (mark === "circle") {
      return (
        '<svg class="seal-svg" viewBox="0 0 64 64" fill="none">' +
        '<circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="4"/>' +
        '<circle cx="32" cy="32" r="8" fill="currentColor"/></svg>'
      );
    }
    if (mark === "square") {
      return (
        '<svg class="seal-svg" viewBox="0 0 64 64" fill="none">' +
        '<rect x="14" y="14" width="36" height="36" rx="4" stroke="currentColor" stroke-width="4"/>' +
        '<rect x="24" y="24" width="16" height="16" fill="currentColor"/></svg>'
      );
    }
    if (mark === "diamond") {
      return (
        '<svg class="seal-svg" viewBox="0 0 64 64" fill="none">' +
        '<path d="M32 8 L56 32 L32 56 L8 32 Z" stroke="currentColor" stroke-width="4" fill="none"/>' +
        '<path d="M32 22 L42 32 L32 42 L22 32 Z" fill="currentColor"/></svg>'
      );
    }
    return (
      '<svg class="seal-svg" viewBox="0 0 64 64" fill="none">' +
      '<path d="M32 8l5.4 14.8H54l-12.2 9.2 4.8 15L32 38.4 17.4 47l4.8-15L10 22.8h16.6z" fill="currentColor"/></svg>'
    );
  }

  function renderTalisman(item, opts) {
    opts = opts || {};
    var el = document.createElement("article");
    el.className =
      "talisman hue-" +
      item.hue +
      (item.rim === "thick" ? " rim-thick" : "") +
      (opts.pass === true ? " pass" : "") +
      (opts.pass === false ? " fail" : "");
    if (opts.delay != null) el.style.animationDelay = opts.delay + "ms";

    var seal = document.createElement("div");
    seal.className = "seal";
    seal.innerHTML = sealSvg(item.mark);
    var pips = document.createElement("div");
    pips.className = "pips";
    for (var i = 0; i < item.pips; i++) {
      pips.appendChild(document.createElement("i")).className = "pip";
    }
    seal.appendChild(pips);
    el.appendChild(seal);

    var tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = hueLabel(item.hue) + " · " + markLabel(item.mark);
    el.appendChild(tag);

    if (opts.pass === true || opts.pass === false) {
      var badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = opts.pass ? "进" : "拦";
      el.appendChild(badge);
    }
    return el;
  }

  function showScreen(name) {
    ["title", "how", "study", "judge", "result"].forEach(function (s) {
      var node = $("screen-" + s);
      if (!node) return;
      var on = s === name;
      node.hidden = !on;
      if (on && !reduceMotion) {
        node.style.animation = "none";
        void node.offsetWidth;
        node.style.animation = "";
      }
    });
  }

  /* ---------- State ---------- */
  var S = {
    round: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    index: 0,
    busy: false,
    session: null,
  };

  function refreshBestline() {
    var b = loadBest();
    $("bestline").textContent =
      "最高连击 " +
      (b.bestCombo || "—") +
      " · 最佳得分 " +
      (b.bestScore || "—");
  }

  function setScores() {
    $("live-score").textContent = String(S.score);
    $("live-score-2").textContent = String(S.score);
  }

  function startRound() {
    var diff = DIFFS[clamp(S.round - 1, 0, DIFFS.length - 1)];
    var seed = (Date.now() ^ (S.round * 9973) ^ ((Math.random() * 1e9) | 0)) >>> 0;
    S.session = generateRound(seed, diff.tier);
    S.correct = 0;
    S.index = 0;
    S.busy = false;
    S.combo = 0;

    $("round-pill").textContent = "第 " + S.round + " 阵";
    $("diff-pill").textContent = diff.label;
    $("study-say").textContent =
      S.round === 1
        ? "先看这些例子。进了阵的，都守着同一条法则。"
        : "新阵法。例子变了，法则也可能变了。";
    setScores();
    paintStudy();
    showScreen("study");
  }

  function paintStudy() {
    var box = $("study-array");
    box.innerHTML = "";
    S.session.examples.forEach(function (ex, i) {
      if (!reduceMotion) setTimeout(sfxDeal, i * 40);
      box.appendChild(
        renderTalisman(ex.item, {
          pass: ex.pass,
          delay: reduceMotion ? 0 : i * 55,
        })
      );
    });
  }

  function beginJudge() {
    S.index = 0;
    S.busy = false;
    $("combo").hidden = true;
    $("progress-fill").style.width = "0%";
    showScreen("judge");
    dealJudgeCard();
  }

  function dealJudgeCard() {
    var slot = $("judge-card-slot");
    slot.innerHTML = "";
    var item = S.session.judge[S.index];
    var card = renderTalisman(item, {});
    slot.appendChild(card);
    $("judge-count").textContent = S.index + 1 + " / " + JUDGE_COUNT;
    $("judge-acc").textContent = "正确 " + S.correct;
    $("judge-prompt").textContent = "这条符，进不进阵？";
    $("btn-enter").disabled = false;
    $("btn-block").disabled = false;
    S.busy = false;
    if (!reduceMotion) sfxDeal();
  }

  function burst(ok) {
    if (reduceMotion) return;
    var layer = $("fx-layer");
    var rect = $("judge-card-slot").getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    for (var i = 0; i < 12; i++) {
      var p = document.createElement("i");
      p.className = "fx-burst";
      var ang = (Math.PI * 2 * i) / 12;
      var dist = 40 + Math.random() * 50;
      p.style.left = cx + "px";
      p.style.top = cy + "px";
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.background = ok
        ? i % 2 ? "#3dcf9a" : "#f0c14b"
        : i % 2 ? "#ff6b57" : "#c84333";
      layer.appendChild(p);
      setTimeout(function (node) {
        node.remove();
      }.bind(null, p), 700);
    }
  }

  function floatScore(n) {
    if (reduceMotion || n <= 0) return;
    var el = document.createElement("div");
    el.className = "fx-float";
    el.textContent = "+" + n;
    $("fx-layer").appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 800);
  }

  function judge(wantEnter) {
    if (S.busy || !S.session) return;
    S.busy = true;
    $("btn-enter").disabled = true;
    $("btn-block").disabled = true;

    var item = S.session.judge[S.index];
    var should = rulePass(S.session.rule, item);
    var ok = wantEnter === should;
    var slot = $("judge-card-slot");
    var card = slot.querySelector(".talisman");

    if (ok) {
      S.correct++;
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      var gain = 100 + Math.min(S.combo, 10) * 25;
      S.score += gain;
      setScores();
      $("combo").hidden = false;
      $("combo-n").textContent = String(S.combo);
      $("judge-prompt").textContent = should ? "进得漂亮。" : "拦得对。";
      if (card) card.classList.add(should ? "out-enter" : "out-block");
      document.body.classList.remove("flash-bad");
      document.body.classList.add("flash-ok");
      burst(true);
      floatScore(gain);
      sfxOk(S.combo);
    } else {
      S.combo = 0;
      $("combo").hidden = true;
      $("judge-prompt").textContent = should
        ? "它其实能进——再对照例子想一想。"
        : "它该被拦下——法则还没找准。";
      if (card) card.classList.add("out-block");
      document.body.classList.remove("flash-ok");
      document.body.classList.add("flash-bad");
      burst(false);
      sfxBad();
    }

    $("progress-fill").style.width =
      Math.round(((S.index + 1) / JUDGE_COUNT) * 100) + "%";
    $("judge-acc").textContent = "正确 " + S.correct;

    setTimeout(function () {
      document.body.classList.remove("flash-ok", "flash-bad");
      S.index++;
      if (S.index >= JUDGE_COUNT) finishRound();
      else dealJudgeCard();
    }, reduceMotion ? 280 : 520);
  }

  function finishRound() {
    var acc = S.correct;
    var title =
      acc >= 7 ? "阵法识破" : acc >= 5 ? "大致摸清" : "还需再练";
    $("result-eyebrow").textContent = "第 " + S.round + " 阵结算";
    $("result-title").textContent = title;
    $("rule-reveal").textContent = S.session.text;
    $("result-stats").innerHTML =
      '<div class="stat"><b>' +
      acc +
      "/" +
      JUDGE_COUNT +
      "</b><span>判定</span></div>" +
      '<div class="stat"><b>' +
      S.maxCombo +
      "</b><span>最高连击</span></div>" +
      '<div class="stat"><b>' +
      S.score +
      "</b><span>总分</span></div>";

    var best = saveBest(S.score, S.maxCombo);
    refreshBestline();
    if (acc >= 6) sfxWin();
    showScreen("result");
    S.round++;
  }

  function quitToTitle() {
    S.round = 1;
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.session = null;
    setScores();
    refreshBestline();
    showScreen("title");
  }

  /* ---------- Bind ---------- */
  function boot() {
    refreshBestline();
    $("btn-start").onclick = function () {
      ensureAudio();
      S.round = 1;
      S.score = 0;
      S.maxCombo = 0;
      startRound();
    };
    $("btn-howto").onclick = function () {
      showScreen("how");
    };
    $("btn-how-back").onclick = function () {
      showScreen("title");
    };
    $("btn-how-go").onclick = function () {
      ensureAudio();
      S.round = 1;
      S.score = 0;
      S.maxCombo = 0;
      startRound();
    };
    $("btn-ready").onclick = beginJudge;
    $("btn-enter").onclick = function () {
      judge(true);
    };
    $("btn-block").onclick = function () {
      judge(false);
    };
    $("btn-next").onclick = startRound;
    $("btn-home").onclick = quitToTitle;
    $("btn-study-quit").onclick = quitToTitle;
    $("btn-judge-quit").onclick = quitToTitle;

    window.addEventListener("keydown", function (ev) {
      if ($("screen-judge").hidden || S.busy) return;
      if (ev.key === "ArrowLeft" || ev.key === "a" || ev.key === "A") judge(false);
      if (ev.key === "ArrowRight" || ev.key === "d" || ev.key === "D" || ev.key === "Enter")
        judge(true);
    });
  }

  boot();
})();
