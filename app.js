/* Bouffe — interface */
(function () {
  "use strict";
  const C = window.Core;
  const T = C.TYPES;
  const KEY = "bouffe-v1";
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Stockage (sur le téléphone uniquement) ----------
  let S;
  try { S = C.migrate(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { S = C.emptyState(); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("⚠️ Impossible d'enregistrer sur ce téléphone"); }
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  const now = () => C.today();
  let view = "priorite";
  let stockPlace = "tout", stockQuery = "", addQuery = "", listTab = "frais";
  let lastPlan = [];

  // ---------- Utilitaires d'affichage ----------
  function typeOf(it) { return T[it.t] || T.autre; }
  function thumb(it) {
    const t = typeOf(it);
    if (it.img) return `<div class="emoji"><img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${t.e}'"></div>`;
    return `<div class="emoji">${t.e}</div>`;
  }
  function leftPill(n, place) {
    const cls = n < 0 ? "red" : n <= 1 ? "red" : n <= 3 ? "amber" : place === "congel" ? "blue" : n <= 7 ? "amber" : "grey";
    return `<span class="pill ${cls}">${esc(C.leftLabel(n))}</span>`;
  }
  function vegPill(v) {
    if (v === "vegan") return `<span class="pill">🌱 vegan</span>`;
    if (v === "vege") return `<span class="pill">🥚 végé</span>`;
    if (v === "viande") return `<span class="pill grey">viande/poisson</span>`;
    return "";
  }
  function nutri(g) { return g ? `<span class="nutri ${g}" title="Nutri-Score ${g.toUpperCase()}">${g}</span>` : ""; }
  // plural(3, "produit ajouté") -> "3 produits ajoutés" (chaque mot prend un s)
  function plural(n, s, p) { return n + " " + (n > 1 ? (p || s.split(" ").map(w => w + "s").join(" ")) : s); }
  const norm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // types qui correspondent à une recherche, les noms qui commencent par le mot d'abord
  function searchTypes(q, list) {
    const qq = norm(q.trim());
    return list.filter(t => norm(t.n).includes(qq) || t.k.includes(qq))
      .map(t => { const n = norm(t.n); return { t, s: (n.split(/[^a-z]+/).includes(qq) ? 4 : 0) + (n.startsWith(qq) ? 2 : 0) + (new RegExp("\\b" + qq.replace(/[^a-z0-9 ]/g, "")).test(n) ? 1 : 0) }; })
      .sort((a, b) => (b.s - a.s) || (a.t.n.length - b.t.n.length)).map(x => x.t);
  }

  let toastTimer, undoFn = null;
  function toast(msg, undo) {
    if (scanning) return;
    $("#toastMsg").textContent = msg;
    undoFn = undo || null;
    $("#toastUndo").style.display = undo ? "" : "none";
    $("#toast").style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("#toast").style.display = "none"; undoFn = null; }, undo ? 5000 : 2600);
  }
  $("#toastUndo").onclick = () => { if (undoFn) { undoFn(); undoFn = null; } $("#toast").style.display = "none"; };

  // Instantané pour « Annuler »
  function snapshot() { const snap = JSON.stringify(S); return () => { S = C.migrate(JSON.parse(snap)); save(); render(); }; }

  // ---------- Feuilles (fenêtres du bas) ----------
  let sheetOnClose = null;
  function openSheet(html, onClose) {
    closeSheet(true);
    const bg = document.createElement("div");
    bg.className = "sheet-bg"; bg.id = "sheet";
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    bg.addEventListener("click", e => { if (e.target === bg) closeSheet(); });
    document.body.appendChild(bg);
    document.body.style.overflow = "hidden";
    sheetOnClose = onClose || null;
    return bg.querySelector(".sheet");
  }
  function closeSheet(silent) {
    const s = $("#sheet");
    if (s) s.remove();
    document.body.style.overflow = "";
    const cb = sheetOnClose; sheetOnClose = null;
    if (!silent && cb) cb();
  }

  // ---------- Actions sur le stock ----------
  function removeItems(ids, how) {
    const set = new Set(ids);
    const d = now();
    S.items.filter(it => set.has(it.id)).forEach(it => S.history.push({ t: it.t, d, how }));
    if (S.history.length > 500) S.history = S.history.slice(-500);
    S.items = S.items.filter(it => !set.has(it.id));
  }
  function finish(id, how) {
    const it = S.items.find(x => x.id === id); if (!it) return;
    const undo = snapshot();
    removeItems([id], how);
    save(); render(); refreshSheet();
    toast((how === "jete" ? "🗑 Jeté : " : "✓ Fini : ") + C.displayName(it), undo);
  }
  function freeze(id) {
    const it = S.items.find(x => x.id === id); if (!it) return;
    const undo = snapshot();
    C.freezeItem(it, now());
    save(); render(); refreshSheet();
    toast("❄️ Au congélateur : " + C.displayName(it), undo);
  }
  function addType(k, opts) {
    const it = C.newItem(k, opts || {}, now());
    S.items.push(it);
    return it;
  }

  // ---------- Écran : À manger en priorité ----------
  function viewPriorite() {
    const ref = now();
    const pr = C.priority(S.items, ref, 7);
    const plan = computePlan();
    const tonight = plan[0];
    let h = `<h1>À manger en priorité</h1>`;

    if (!S.items.length) {
      h += `<div class="card"><div class="empty"><b>🧺</b>Le stock est vide.<br>Commence par scanner tes placards, ton frigo et ton congélateur.</div>
        <a class="btn primary big" href="#ajouter">📷 Faire l'inventaire</a></div>`;
    }

    if (tonight) {
      const r = tonight.recipe;
      h += `<div class="card">
        <div class="dayhead"><span>Ce soir</span>${vegPill(C.recipeVeg(r))}</div>
        <div class="recipe-title">${r.e} ${esc(r.n)}</div>
        <div class="small muted">${r.min} min${tonight.missing.length ? ` · il manque : ${esc(tonight.missing.map(C.slotLabel).join(", "))}` : " · tout est là ✓"}</div>
        <div class="btns">
          <button class="btn sm" data-act="recipe" data-date="${tonight.date}">Voir</button>
          <button class="btn sm ghost" data-act="other" data-date="${tonight.date}">🔄 Autre idée</button>
          ${tonight.done ? `<span class="pill">✓ fait</span>` : `<button class="btn sm primary" data-act="cooked" data-date="${tonight.date}">C'est fait</button>`}
        </div></div>`;
    }

    const sections = [
      ["À vérifier : date dépassée", x => x.n < 0],
      ["Aujourd'hui et demain", x => x.n >= 0 && x.n <= 1],
      ["Dans les 7 jours", x => x.n >= 2],
    ];
    let any = false;
    sections.forEach(([title, f]) => {
      const rows = pr.filter(f);
      if (!rows.length) return;
      any = true;
      h += `<h2>${title}</h2><div class="card list">` + rows.map(({ it, n }) => itemRow(it, n, true)).join("") + `</div>`;
    });
    if (S.items.length && !any) h += `<div class="card"><div class="empty"><b>👌</b>Rien ne presse cette semaine.</div></div>`;

    // Idée pour finir le plus urgent
    const urgent = pr.find(x => x.n >= 0 && C.isConsumable(x.it));
    if (urgent) {
      const idea = bestRecipeFor(urgent.it);
      if (idea && (!tonight || idea.id !== tonight.r)) {
        h += `<div class="card"><div class="small muted">Pour finir ${esc(C.displayName(urgent.it).toLowerCase())}</div>
          <div class="recipe-title">${idea.e} ${esc(idea.n)}</div>
          <div class="btns"><button class="btn sm" data-act="settonight" data-r="${idea.id}">Le faire ce soir</button></div></div>`;
      }
    }

    // Petit bilan anti-gaspi
    const month = ref.slice(0, 7);
    const jetes = S.history.filter(x => x.how === "jete" && x.d.slice(0, 7) === month).length;
    const finis = S.history.filter(x => x.how === "fini" && x.d.slice(0, 7) === month).length;
    if (jetes + finis) h += `<p class="sub" style="margin-top:16px">Ce mois-ci : ${plural(finis, "produit fini")}, ${plural(jetes, "produit jeté")}.</p>`;
    return h;
  }

  function itemRow(it, n, actions) {
    const t = typeOf(it);
    const name = C.displayName(it);
    const extra = [it.brand, C.PLACES[it.place], it.opened ? "ouvert" : "", it.low ? "bientôt fini" : ""].filter(Boolean).join(" · ");
    return `<div class="item">
      <button class="row grow" data-act="item" data-id="${it.id}" style="text-align:left">
        ${thumb(it)}
        <div class="grow"><div class="ellipsis"><b>${esc(name)}</b></div><div class="small muted ellipsis">${esc(extra)}</div></div>
        ${leftPill(n, it.place)}
      </button>
      ${actions === true ? `<button class="iconbtn ok" data-act="fini" data-id="${it.id}" aria-label="Fini">✓</button>
      ${t.freeze && it.place !== "congel" && n >= 0 ? `<button class="iconbtn ice" data-act="freeze" data-id="${it.id}" aria-label="Congeler">❄️</button>` : ""}
      <button class="iconbtn bad" data-act="jete" data-id="${it.id}" aria-label="Jeté">🗑</button>` : ""}
      ${actions === "del" ? `<button class="iconbtn bad" data-act="del" data-id="${it.id}" aria-label="Retirer">✕</button>` : ""}
    </div>`;
  }

  function bestRecipeFor(it) {
    let best = null, bs = -Infinity;
    C.RECIPES.forEach(r => {
      if (![...r.ing, ...r.opt, r.prot].some(s => s && C.slotKeys(s).includes(it.t))) return;
      const m = C.matchRecipe(r, S.items, now());
      if (!m.uses.includes(it)) return;
      const sc = m.score - m.missing.length * 10;
      if (sc > bs) { bs = sc; best = r; }
    });
    return best;
  }

  // ---------- Écran : Stock ----------
  function viewStock() {
    const ref = now();
    const counts = { tout: S.items.length, frigo: 0, congel: 0, placard: 0 };
    S.items.forEach(it => counts[it.place]++);
    let h = `<h1>Stock</h1>
      <div class="seg">${[["tout", "Tout"], ["frigo", "🧊 Frigo"], ["congel", "❄️ Congélo"], ["placard", "🚪 Placards"]].map(([k, l]) =>
        `<button class="${stockPlace === k ? "on" : ""}" data-act="place" data-v="${k}">${l} ${counts[k]}</button>`).join("")}</div>
      <input class="search" type="search" placeholder="Chercher dans le stock" value="${esc(stockQuery)}" id="stockSearch">`;
    const q = norm(stockQuery.trim());
    const items = S.items.filter(it => (stockPlace === "tout" || it.place === stockPlace) &&
      (!q || norm(C.displayName(it) + " " + it.brand + " " + typeOf(it).n).includes(q)));
    if (!items.length) {
      h += `<div class="card"><div class="empty"><b>🧺</b>${S.items.length ? "Rien ici." : "Le stock est vide."}</div><a class="btn primary big" href="#ajouter">＋ Ajouter des produits</a></div>`;
      return h;
    }
    // regroupement : même type + même nom + même lieu
    const groups = {};
    items.forEach(it => {
      const key = it.t + "|" + (it.name || "") + "|" + it.place;
      (groups[key] = groups[key] || []).push(it);
    });
    C.GROUPS.forEach(([g, label]) => {
      const gs = Object.values(groups).filter(arr => typeOf(arr[0]).g === g)
        .sort((a, b) => C.displayName(a[0]).localeCompare(C.displayName(b[0]), "fr"));
      if (!gs.length) return;
      h += `<h2>${label}</h2><div class="card list">` + gs.map(arr => {
        arr.sort((a, b) => a.exp < b.exp ? -1 : 1);
        const it = arr[0], n = C.daysLeft(it, ref);
        const sub = [it.brand, stockPlace === "tout" ? C.PLACES[it.place] : "", arr.some(x => x.opened) ? "ouvert" : "", arr.some(x => x.low) ? "bientôt fini" : ""].filter(Boolean).join(" · ");
        return `<div class="item"><button class="row grow" data-act="item" data-id="${it.id}" style="text-align:left">
          ${thumb(it)}<div class="grow"><div class="ellipsis"><b>${esc(C.displayName(it))}</b>${arr.length > 1 ? ` <span class="muted">×${arr.length}</span>` : ""}</div>
          <div class="small muted ellipsis">${esc(sub)}</div></div>${leftPill(n, it.place)}</button></div>`;
      }).join("") + `</div>`;
    });
    return h;
  }

  // ---------- Fiche produit ----------
  let sheetItemId = null;
  function openItem(id) {
    sheetItemId = id;
    renderItemSheet(true);
  }
  function refreshSheet() { if (sheetItemId && $("#sheet")) renderItemSheet(false); }
  function renderItemSheet(fresh) {
    const it = S.items.find(x => x.id === sheetItemId);
    if (!it) { closeSheet(true); sheetItemId = null; return; }
    const t = typeOf(it), ref = now();
    const same = S.items.filter(x => x.t === it.t && (x.name || "") === (it.name || "") && x.place === it.place).sort((a, b) => a.exp < b.exp ? -1 : 1);
    const html = `<h3 class="row">${thumb(it)}<span class="grow">${esc(C.displayName(it))}</span></h3>
      <div style="padding:0 16px">
        <div class="row small muted" style="gap:6px;flex-wrap:wrap">${esc([it.brand, it.name && it.name !== t.n ? t.n : ""].filter(Boolean).join(" · "))} ${nutri(it.nutri)} ${vegPill(it.veg)}</div>
        ${same.length > 1 ? `<div class="field"><div>${same.length} exemplaires — touche celui à modifier</div><div class="chips">${same.map(x =>
          `<button class="chip ${x.id === it.id ? "on" : ""}" data-act="item" data-id="${x.id}">${esc(C.leftLabel(C.daysLeft(x, ref)))}${x.opened ? " · ouvert" : ""}</button>`).join("")}</div></div>` : ""}
        <div class="field"><div>À consommer avant (estimé, corrige si besoin)</div>
          <div class="row"><input type="date" id="expInput" value="${it.exp}" style="flex:1"> ${leftPill(C.daysLeft(it, ref), it.place)}</div>
          <div class="chips" style="margin-top:8px">
            <button class="chip" data-act="exp" data-v="-1">−1 j</button><button class="chip" data-act="exp" data-v="1">+1 j</button>
            <button class="chip" data-act="exp" data-v="7">+7 j</button><button class="chip" data-act="exp" data-v="30">+1 mois</button>
          </div></div>
        <div class="field"><div>Rangé dans</div><div class="chips">${Object.entries(C.PLACES).map(([k, l]) =>
          `<button class="chip ${it.place === k ? "on" : ""}" data-act="setplace" data-v="${k}">${l}</button>`).join("")}</div></div>
        <div class="field"><div>État</div><div class="chips">
          <button class="chip ${it.opened ? "on" : ""}" data-act="opened">${it.opened ? "✓ " : ""}Ouvert</button>
          <button class="chip ${it.low ? "on" : ""}" data-act="low">${it.low ? "✓ " : ""}Bientôt fini</button>
        </div></div>
        <div class="btns">
          <button class="btn primary" data-act="fini" data-id="${it.id}">✓ Fini</button>
          ${t.freeze && it.place !== "congel" ? `<button class="btn" data-act="freeze" data-id="${it.id}">❄️ Congeler</button>` : ""}
          <button class="btn danger" data-act="jete" data-id="${it.id}">🗑 Jeté</button>
        </div>
        <div class="btns">
          <button class="btn ghost sm" data-act="dup">＋ Un de plus</button>
          <button class="btn ghost sm" data-act="retype">Changer le type</button>
          <button class="btn ghost sm" data-act="rename">Renommer</button>
        </div>
      </div>`;
    let sheet;
    if (fresh || !$("#sheet")) sheet = openSheet(html, () => { sheetItemId = null; render(); });
    else { sheet = $("#sheet .sheet"); sheet.innerHTML = `<div class="grab"></div>` + html; }
    sheet.querySelector("#expInput").onchange = e => { if (e.target.value) { it.exp = e.target.value; save(); renderItemSheet(false); } };
  }
  function itemSheetAction(act, el) {
    const it = S.items.find(x => x.id === sheetItemId); if (!it) return;
    const ref = now();
    if (act === "exp") { it.exp = C.addDays(it.exp, +el.dataset.v); }
    else if (act === "setplace") {
      const p = el.dataset.v;
      if (p === "congel" && it.place !== "congel") C.freezeItem(it, ref);
      else if (it.place === "congel" && p !== "congel") { it.place = p; const T0 = typeOf(it); it.exp = C.addDays(ref, Math.min(T0.d, p === "frigo" ? 2 : T0.d)); }
      else it.place = p;
    }
    else if (act === "opened") { if (!it.opened) C.openItem(it, ref); else it.opened = false; }
    else if (act === "low") { it.low = !it.low; }
    else if (act === "dup") { const c = Object.assign({}, it, { id: C.uid(), added: ref, opened: false, low: false }); S.items.push(c); toast("＋1 " + C.displayName(it)); }
    else if (act === "retype") {
      pickType("Quel type de produit ?", k => {
        it.t = k;
        const m = T[k];
        if (!it.code) { it.place = m.p; it.exp = C.addDays(it.added || ref, m.d); }
        else { it.place = m.p; it.exp = C.addDays(it.added || ref, m.d); S.codes[it.code] = Object.assign(S.codes[it.code] || {}, { t: k, place: m.p, days: m.d }); }
        save(); openItem(it.id);
      });
      return;
    }
    else if (act === "rename") {
      const sheet = $("#sheet .sheet");
      sheet.insertAdjacentHTML("beforeend", `<form id="renameForm" style="padding:0 16px" class="row"><input type="text" id="renameInput" value="${esc(it.name || typeOf(it).n)}" style="flex:1"><button class="btn primary">OK</button></form>`);
      const inp = $("#renameInput"); inp.focus(); inp.select();
      $("#renameForm").onsubmit = e => { e.preventDefault(); it.name = inp.value.trim(); if (it.code && S.codes[it.code]) S.codes[it.code].name = it.name; save(); renderItemSheet(false); };
      return;
    }
    save(); renderItemSheet(false);
  }

  // ---------- Choisir un type ----------
  function pickType(title, cb) {
    let q = "";
    sheetItemId = null;
    const sheet = openSheet(`<h3>${esc(title)}</h3><input class="search" type="search" id="typeSearch" placeholder="Chercher (ex. yaourt, pâtes…)"><div id="typeGrid" style="padding:0 12px"></div>`);
    const draw = () => {
      const qq = q.trim().toLowerCase();
      let html = "";
      C.GROUPS.forEach(([g, label]) => {
        const ts = qq ? searchTypes(qq, C.TYPE_LIST.filter(t => t.g === g)) : C.TYPE_LIST.filter(t => t.g === g);
        if (!ts.length) return;
        html += `<h2 style="margin-left:4px">${label}</h2><div class="grid">` + ts.map(t => `<button class="tile" data-k="${t.k}"><b>${t.e}</b>${esc(t.n)}</button>`).join("") + `</div>`;
      });
      sheet.querySelector("#typeGrid").innerHTML = html || `<div class="empty">Rien trouvé. Choisis « Autre ».</div>`;
    };
    draw();
    sheet.querySelector("#typeSearch").oninput = e => { q = e.target.value; draw(); };
    sheet.querySelector("#typeGrid").onclick = e => { const b = e.target.closest("[data-k]"); if (b) { closeSheet(true); cb(b.dataset.k); } };
  }

  // ---------- Écran : Ajouter ----------
  function viewAjouter() {
    const ref = now();
    const pending = S.items.filter(it => it.pending);
    const todays = S.items.filter(it => it.added === ref && !it.pending).slice(-12).reverse();
    let h = `<h1>Ajouter</h1>
      <div class="card">
        <button class="btn primary big" data-act="scan">📷 Scanner des codes-barres</button>
        <div class="small muted" style="margin-top:8px">Passe les produits devant la caméra les uns après les autres. Le nom, la catégorie et la date estimée se remplissent tout seuls.</div>
        <div class="btns"><button class="btn ghost sm" data-act="photo">🖼 Photo d'un code-barres</button></div>
      </div>`;
    if (pending.length) {
      h += `<h2>À préciser (${pending.length})</h2><div class="card list">` + pending.map(it => `<div class="item">
        ${thumb(it)}<div class="grow"><div class="ellipsis"><b>${esc(C.displayName(it))}</b></div><div class="small muted">${it.name ? "Je ne sais pas où le ranger" : "Code " + esc(it.code) + " inconnu ou pas de réseau"}</div></div>
        ${!it.name ? `<button class="iconbtn" data-act="retry" data-id="${it.id}" aria-label="Réessayer">↻</button>` : ""}
        <button class="btn sm" data-act="settype" data-id="${it.id}">Type</button></div>`).join("") + `</div>`;
    }
    h += `<h2>Sans code-barres (frais, vrac)</h2>
      <input class="search" type="search" id="addSearch" placeholder="Chercher n'importe quel produit" value="${esc(addQuery)}">
      <div style="padding:0 12px" id="addGrid">${addGrid()}</div>`;
    if (todays.length) {
      h += `<h2>Ajoutés aujourd'hui</h2><div class="card list">` + todays.map(it => itemRow(it, C.daysLeft(it, ref), "del")).join("") + `</div>`;
    }
    return h;
  }
  function addGrid() {
    const q = addQuery.trim();
    let html = "";
    if (q) {
      const ts = searchTypes(q, C.TYPE_LIST);
      return ts.length ? `<div class="grid" style="margin-top:8px">` + ts.map(t => `<button class="tile" data-act="quick" data-k="${t.k}"><b>${t.e}</b>${esc(t.n)}</button>`).join("") + `</div>` : `<div class="empty">Rien trouvé.</div>`;
    }
    C.GROUPS.forEach(([g, label]) => {
      const ts = C.TYPE_LIST.filter(t => t.g === g && t.vrac);
      if (!ts.length) return;
      html += `<div class="small muted" style="margin:12px 4px 6px;font-weight:600">${label}</div><div class="grid">` +
        ts.map(t => `<button class="tile" data-act="quick" data-k="${t.k}"><b>${t.e}</b>${esc(t.n)}</button>`).join("") + `</div>`;
    });
    return html || `<div class="empty">Rien trouvé.</div>`;
  }

  // ---------- Scanner ----------
  let scanning = false, stream = null, zxReader = null, detector = null, lastCode = "", lastAt = 0, scanAdded = 0, loopTimer = null;
  function beep() {
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      beep.ctx = beep.ctx || new A();
      const ctx = beep.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 1320; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.09);
    } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
  }
  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  async function loadZXing() {
    if (window.ZXing) return window.ZXing;
    const urls = ["https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js", "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js"];
    for (const u of urls) { try { await loadScript(u); if (window.ZXing) return window.ZXing; } catch (e) {} }
    throw new Error("zxing");
  }
  async function nativeDetector() {
    if (!("BarcodeDetector" in window)) return null;
    try {
      const f = await window.BarcodeDetector.getSupportedFormats();
      const want = ["ean_13", "ean_8", "upc_a", "upc_e"].filter(x => f.includes(x));
      return want.length ? new window.BarcodeDetector({ formats: want }) : null;
    } catch (e) { return null; }
  }
  async function startScanner() {
    $("#scanner").style.display = "flex";
    $("#toast").style.display = "none";
    scanning = true; scanAdded = 0; updateCount();
    setLast(`<div class="muted">Ouverture de la caméra…</div>`);
    // le son doit être débloqué par un geste
    try { const A = window.AudioContext || window.webkitAudioContext; if (A && !beep.ctx) beep.ctx = new A(); if (beep.ctx && beep.ctx.resume) beep.ctx.resume(); } catch (e) {}
    const video = $("#video");
    const constraints = { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
    try {
      detector = await nativeDetector();
      if (detector) {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream; await video.play();
        const loop = async () => {
          if (!scanning) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              if (codes && codes.length) onCode(codes[0].rawValue);
            }
          } catch (e) {}
          loopTimer = setTimeout(loop, 180);
        };
        loop();
      } else {
        const ZX = await loadZXing();
        const hints = new Map();
        hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E]);
        zxReader = new ZX.BrowserMultiFormatReader(hints, 250);
        await zxReader.decodeFromConstraints(constraints, video, (res) => { if (res && scanning) onCode(res.getText()); });
      }
      setLast(`<div class="muted">Vise le code-barres dans le cadre. Passe les produits les uns après les autres, je bipe à chaque fois.</div>`);
    } catch (e) {
      const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
      const msg = e && e.message === "zxing" ? "Le lecteur de codes-barres n'a pas pu se charger (pas de réseau ?)."
        : denied ? "La caméra est refusée. Sur iPhone : Réglages › Safari › Caméra › Autoriser, puis réessaie."
        : "Impossible d'ouvrir la caméra ici.";
      setLast(`<b>${msg}</b><div class="small muted">Tu peux taper les chiffres du code ci-dessous, ou utiliser « Photo d'un code-barres ».</div>`);
    }
  }
  function stopScanner() {
    scanning = false;
    clearTimeout(loopTimer);
    try { zxReader && zxReader.reset(); } catch (e) {}
    zxReader = null;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const v = $("#video"); try { v.pause(); v.srcObject = null; } catch (e) {}
    $("#scanner").style.display = "none";
    render();
    if (scanAdded) toast("✓ " + plural(scanAdded, "produit ajouté"));
  }
  function updateCount() { $("#scanCount").textContent = plural(scanAdded, "ajouté"); }
  function setLast(html) { $("#scanLast").innerHTML = html; }
  function onCode(raw) {
    const code = String(raw || "").replace(/\D/g, "");
    if (code.length < 8) return;
    const t = Date.now();
    if (code === lastCode && t - lastAt < 2500) return;
    lastCode = code; lastAt = t;
    beep();
    const f = $("#frame"); f.classList.add("hit"); setTimeout(() => f.classList.remove("hit"), 400);
    handleCode(code, true);
  }

  // Cherche le produit (d'abord sur le téléphone, puis Open Food Facts) et l'ajoute au stock
  async function handleCode(code, fromScanner) {
    const ref = now();
    let info = S.codes[code];
    let it;
    if (info && info.t) {
      it = addType(info.t, { code, name: info.name, brand: info.brand, img: info.img, veg: info.veg, nutri: info.nutri, place: info.place, days: info.days });
      save(); afterAdd(it, fromScanner);
      return;
    }
    // ajout immédiat « à préciser », complété quand la réponse arrive
    it = addType("autre", { code, name: info && info.name, brand: info && info.brand, img: info && info.img });
    it.pending = true; save(); afterAdd(it, fromScanner, true);
    const p = await lookupOFF(code);
    const cur = S.items.find(x => x.id === it.id); if (!cur) return;
    if (p) {
      S.codes[code] = { t: p.t, name: p.name, brand: p.brand, img: p.img, veg: p.veg, nutri: p.nutri, place: p.place, days: p.days };
      Object.assign(cur, { name: p.name || "", brand: p.brand, img: p.img, veg: p.veg, nutri: p.nutri });
      if (p.t) {
        cur.t = p.t; cur.place = p.place; cur.exp = C.addDays(cur.added || ref, p.days); delete cur.pending;
      }
    }
    save();
    if (fromScanner && scanning) showLast(cur);
    else render();
  }
  async function lookupOFF(code) {
    const fields = "product_name,product_name_fr,generic_name_fr,brands,quantity,categories_tags,image_front_small_url,image_small_url,nutriscore_grade,ingredients_analysis_tags";
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 8000);
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}&lc=fr`, ctl ? { signal: ctl.signal } : {});
      if (!r.ok && r.status !== 404) return null;
      return C.productFromOFF(code, await r.json());
    } catch (e) { return null; } finally { clearTimeout(timer); }
  }
  function afterAdd(it, fromScanner, waiting) {
    if (fromScanner && scanning) { scanAdded++; updateCount(); showLast(it, waiting); }
    else { render(); if (!waiting) toast("✓ Ajouté : " + C.displayName(it), snapshot()); }
  }
  function showLast(it, waiting) {
    const n = C.daysLeft(it, now());
    setLast(`<div class="row">${thumb(it)}<div class="grow"><div class="ellipsis"><b>${esc(waiting && !it.name ? "Recherche du produit…" : C.displayName(it))}</b></div>
      <div class="small muted ellipsis">${it.pending ? (waiting ? "code " + esc(it.code) : "À préciser plus tard dans « Ajouter »") : esc(C.PLACES[it.place] + " · " + C.leftLabel(n))}</div></div>
      <button class="iconbtn bad" id="scanUndo" aria-label="Retirer">✕</button></div>`);
    $("#scanUndo").onclick = () => { S.items = S.items.filter(x => x.id !== it.id); save(); scanAdded = Math.max(0, scanAdded - 1); updateCount(); setLast(`<div class="muted">Retiré. Continue à scanner.</div>`); };
  }
  $("#scanClose").onclick = stopScanner;
  $("#scanManual").onsubmit = e => { e.preventDefault(); const v = $("#scanManualCode").value; $("#scanManualCode").value = ""; if (v.replace(/\D/g, "").length >= 8) { beep(); handleCode(v.replace(/\D/g, ""), true); } };

  // Photo d'un code-barres (si la caméra en direct ne marche pas)
  $("#photoInput").onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    toast("Lecture du code…");
    try {
      let code = null;
      const det = await nativeDetector();
      if (det && window.createImageBitmap) { const bmp = await createImageBitmap(f); const r = await det.detect(bmp); if (r.length) code = r[0].rawValue; }
      if (!code) { const ZX = await loadZXing(); const rd = new ZX.BrowserMultiFormatReader(); const url = URL.createObjectURL(f); try { code = (await rd.decodeFromImageUrl(url)).getText(); } finally { URL.revokeObjectURL(url); } }
      if (code) handleCode(code.replace(/\D/g, ""), false); else toast("Je n'ai pas trouvé de code-barres sur la photo");
    } catch (err) { toast("Je n'ai pas trouvé de code-barres sur la photo"); }
  };

  // ---------- Écran : Dîners ----------
  function computePlan() {
    const ref = now();
    C.prunePast(S, ref);
    // on garde les choix précédents (bonus de stabilité) en les verrouillant « en douceur »
    const soft = {};
    Object.entries(S.plan).forEach(([d, p]) => { if (!p.locked && !p.done) soft[d] = p.r; });
    const stateForPlan = Object.assign({}, S, { plan: Object.assign({}, S.plan) });
    // les choix déjà affichés restent tant qu'ils sont réalisables avec ce qu'il y a (ou qu'il manque peu)
    Object.entries(soft).forEach(([d, r]) => {
      const rec = C.RECIPE_BY_ID[r];
      if (!rec) { delete stateForPlan.plan[d]; return; }
      const m = C.matchRecipe(rec, S.items, d);
      if (m.missing.length <= (d === ref ? 0 : 1)) stateForPlan.plan[d] = { r, locked: true, soft: true };
      else delete stateForPlan.plan[d];
    });
    const plan = C.planDinners(stateForPlan, ref, 14);
    plan.forEach(p => {
      const prev = S.plan[p.date] || {};
      S.plan[p.date] = { r: p.r, locked: !!prev.locked, done: !!prev.done };
      p.locked = !!prev.locked;
    });
    save();
    lastPlan = plan;
    return plan;
  }
  function viewDiners() {
    const ref = now();
    const plan = computePlan();
    let h = `<h1>Dîners</h1><p class="sub">Les 14 prochains soirs, construits avec ce qui doit être mangé en premier. La base est végé ; la viande ou le poisson sont proposés à côté pour ceux qui en veulent.</p>
      <div class="btns" style="margin:0 12px"><button class="btn sm ghost" data-act="replan">🔄 Refaire tout le planning</button></div>`;
    plan.forEach((p, i) => {
      if (!p) return;
      const r = p.recipe;
      const prot = r.prot ? C.slotLabel(r.prot).toLowerCase() : "";
      h += `<div class="card ${p.done ? "done" : ""}" style="${i === 0 ? "border:2px solid var(--green)" : ""}">
        <div class="dayhead"><span>${esc(C.dayLabel(p.date, ref))}</span><span>${p.locked ? "📌 " : ""}${vegPill(C.recipeVeg(r))}</span></div>
        <button data-act="recipe" data-date="${p.date}" style="text-align:left;display:block;width:100%">
          <div class="recipe-title">${r.e} ${esc(r.n)}</div>
          <div class="small muted">${r.min} min · ${p.missing.length ? `<span style="color:var(--red)">à acheter : ${esc(p.missing.map(C.slotLabel).join(", "))}</span>` : "tout est dans le stock ✓"}</div>
          ${prot ? `<div class="small muted">+ pour ceux qui en veulent : ${esc(prot)}</div>` : ""}
        </button>
        <div class="btns">
          <button class="btn sm ghost" data-act="other" data-date="${p.date}">🔄 Autre idée</button>
          <button class="btn sm ghost" data-act="lock" data-date="${p.date}">${p.locked ? "📌 Gardé" : "📌 Garder"}</button>
          ${i === 0 && !p.done ? `<button class="btn sm primary" data-act="cooked" data-date="${p.date}">C'est fait</button>` : ""}
        </div></div>`;
    });
    return h;
  }
  function planEntry(date) { return lastPlan.find(p => p && p.date === date) || computePlan().find(p => p.date === date); }

  function openRecipe(date) {
    const p = planEntry(date); if (!p) return;
    const r = p.recipe, ref = now();
    const uses = p.uses.map(it => `<div class="item">${thumb(it)}<div class="grow ellipsis"><b>${esc(C.displayName(it))}</b> <span class="small muted">${esc(C.PLACES[it.place])}</span></div>${leftPill(C.daysLeft(it, ref), it.place)}</div>`).join("");
    const html = `<h3>${r.e} ${esc(r.n)}</h3><div style="padding:0 16px">
      <div class="row small muted" style="gap:8px">${esc(C.dayLabel(date, ref))} · ${r.min} min ${vegPill(C.recipeVeg(r))}</div>
      <p>${esc(r.how)}</p>
      ${r.prot ? `<p class="small"><b>Pour ceux qui mangent de la viande ou du poisson :</b> ${esc(C.slotLabel(r.prot).toLowerCase())}, cuit à part.</p>` : ""}
      <div class="field"><div>Avec le stock</div><div class="card list" style="margin:0">${uses || `<div class="muted small">Rien du stock.</div>`}</div></div>
      ${p.missing.length ? `<div class="field"><div>À acheter</div><div>${p.missing.map(s => `<span class="pill red" style="margin:2px">${esc(C.slotLabel(s))}</span>`).join("")}</div></div>` : ""}
      <div class="btns"><button class="btn" data-act="choose" data-date="${date}">Choisir une autre recette</button>
      ${date === ref && !p.done ? `<button class="btn primary" data-act="cooked" data-date="${date}">C'est fait</button>` : ""}</div></div>`;
    openSheet(html);
  }
  function chooseRecipe(date) {
    const ref = now();
    const scored = C.RECIPES.map(r => { const m = C.matchRecipe(r, S.items, date); return { r, m, s: m.score - m.missing.length * 10 }; }).sort((a, b) => b.s - a.s);
    const html = `<h3>Dîner de ${esc(C.dayLabel(date, ref).toLowerCase())}</h3><p class="sub">Les plus faisables avec le stock en premier.</p>
      <div class="card list">${scored.map(({ r, m }) => `<button class="item" data-act="pick" data-date="${date}" data-r="${r.id}" style="width:100%;text-align:left">
        <div class="emoji">${r.e}</div><div class="grow"><div><b>${esc(r.n)}</b></div><div class="small muted">${r.min} min · ${m.missing.length ? "manque " + esc(m.missing.map(C.slotLabel).join(", ")) : "tout est là ✓"}</div></div></button>`).join("")}</div>`;
    openSheet(html);
  }
  function cooked(date) {
    const p = planEntry(date); if (!p) return;
    const html = `<h3>${p.recipe.e} Bon appétit !</h3><p class="sub">Coche ce qui est fini, ça sort du stock.</p>
      <div class="card">${p.uses.map(it => `<label class="check"><input type="checkbox" value="${it.id}" ${C.servings(it) === 1 ? "checked" : ""}>
        <span class="grow"><b>${esc(C.displayName(it))}</b>${C.servings(it) === 1 ? "" : ` <span class="small muted">(${C.isConsumable(it) ? "fini ?" : "paquet terminé ?"})</span>`}</span></label>`).join("") || `<div class="muted">Aucun produit du stock.</div>`}</div>
      <div style="padding:0 12px"><button class="btn primary big" id="cookedOk">Valider</button></div>`;
    const sh = openSheet(html);
    sh.querySelector("#cookedOk").onclick = () => {
      const undo = snapshot();
      const ids = [...sh.querySelectorAll("input:checked")].map(x => x.value);
      removeItems(ids, "fini");
      S.plan[date] = Object.assign(S.plan[date] || { r: p.r }, { done: true, locked: true });
      save(); closeSheet(true); render();
      toast("✓ " + plural(ids.length, "produit retiré") + " du stock", undo);
    };
  }

  // ---------- Écran : Courses ----------
  function viewCourses() {
    const ref = now();
    const plan = lastPlan.length ? lastPlan : computePlan();
    const L = C.shoppingLists(S, ref, plan);
    const lst = S.lists[listTab];
    const auto = L[listTab];
    const fd = S.settings.fraisDays;
    let h = `<div class="row" style="padding-right:12px"><h1 class="grow">Courses</h1><button class="iconbtn" data-act="settings" aria-label="Réglages">⚙️</button></div>
      <div class="seg"><button class="${listTab === "frais" ? "on" : ""}" data-act="ltab" data-v="frais">🥕 Frais (appoint) ${L.frais.length}</button>
      <button class="${listTab === "livraison" ? "on" : ""}" data-act="ltab" data-v="livraison">🚚 Livraison ${L.livraison.length}</button></div>
      <p class="sub">${listTab === "frais" ? `Le frais pour les dîners des ${fd} prochains jours, et les produits de base frais qui manquent.` : `Les placards et le congélateur pour les 15 jours, et les produits de base qui manquent ou vont manquer.`}</p>`;
    const all = auto.map(x => ({ key: "a:" + x.key, label: x.label, why: x.why.join(" · "), chk: !!lst.chk["a:" + x.key] }))
      .concat(lst.manual.map(m => ({ key: "m:" + m.id, label: m.txt, why: "ajouté à la main", chk: !!m.chk, manual: true })));
    h += `<div class="card">` + (all.length ? all.map(x => `<label class="check"><input type="checkbox" data-act="chk" data-key="${esc(x.key)}" ${x.chk ? "checked" : ""}>
      <span class="grow ${x.chk ? "done" : ""}"><b>${esc(x.label)}</b><div class="small muted">${esc(x.why)}</div></span>
      ${x.manual ? `<button class="iconbtn" data-act="delmanual" data-key="${esc(x.key)}" aria-label="Supprimer">✕</button>` : ""}</label>`).join("")
      : `<div class="empty"><b>✅</b>Rien à acheter pour l'instant.</div>`) + `
      <form id="manualForm" class="row" style="margin-top:10px"><input type="text" id="manualInput" placeholder="Ajouter autre chose…" style="flex:1"><button class="btn">＋</button></form></div>`;
    const nChk = all.filter(x => x.chk).length;
    if (listTab === "frais") {
      h += `<div style="padding:0 12px"><button class="btn primary big" data-act="rangerfrais" ${nChk ? "" : "disabled style='opacity:.5'"}>Ranger les ${nChk || ""} cochés dans le stock</button>
        <p class="small muted">Coche au fur et à mesure dans le magasin. En rentrant, ce bouton les ajoute au stock avec leur date estimée.</p></div>`;
    } else {
      h += `<div style="padding:0 12px" class="btns"><button class="btn" data-act="copylist">📋 Copier la liste</button>
        <button class="btn ghost" data-act="clearchk" ${nChk ? "" : "disabled style='opacity:.5'"}>Effacer les cochés</button></div>
        <p class="sub" style="margin-top:10px">Au déballage de la livraison, scanne les produits : ils quittent la liste tout seuls.<br>
        Commander : <a href="https://www.carrefour.fr/" target="_blank" rel="noopener">carrefour.fr</a> · <a href="https://www.auchan.fr/" target="_blank" rel="noopener">auchan.fr</a></p>`;
    }
    return h;
  }
  function listText() {
    const L = C.shoppingLists(S, now(), lastPlan);
    const lst = S.lists.livraison;
    return L.livraison.filter(x => !lst.chk["a:" + x.key]).map(x => "- " + x.label)
      .concat(lst.manual.filter(m => !m.chk).map(m => "- " + m.txt)).join("\n");
  }

  // ---------- Réglages ----------
  function openSettings() {
    const bases = new Set(S.settings.bases);
    const html = `<h3>⚙️ Réglages</h3><div style="padding:0 16px">
      <div class="field"><div>Produits de base, à toujours avoir (ils vont dans la liste dès qu'ils manquent)</div>
        <div class="chips">${C.TYPE_LIST.filter(t => t.k !== "autre").map(t => `<button class="chip ${bases.has(t.k) ? "on" : ""}" data-act="base" data-k="${t.k}">${t.e} ${esc(t.n)}</button>`).join("")}</div></div>
      <div class="field"><div>Liste « frais » : prévoir pour combien de jours ?</div>
        <div class="chips">${[2, 3, 4, 5, 7].map(n => `<button class="chip ${S.settings.fraisDays === n ? "on" : ""}" data-act="fraisdays" data-v="${n}">${n} jours</button>`).join("")}</div></div>
      <div class="field"><div>Sauvegarde (tout est rangé uniquement sur ce téléphone)</div>
        <div class="btns"><button class="btn" data-act="export">⬇️ Exporter</button><button class="btn ghost" data-act="import">⬆️ Importer</button></div>
        <div class="small muted" style="margin-top:6px">Sur iPhone, Safari et l'icône de l'écran d'accueil ont chacun leur propre stockage : utilise toujours le même.</div></div>
      <div class="field"><div>Tout recommencer</div><button class="btn danger" data-act="wipe">Effacer le stock</button></div>
      <p class="small muted">Les fiches produits viennent d'<a href="https://fr.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (base libre et collaborative). Seul le numéro du code-barres est envoyé.</p>
    </div>`;
    openSheet(html, () => render());
  }

  // ---------- Rendu et navigation ----------
  const VIEWS = { priorite: viewPriorite, stock: viewStock, ajouter: viewAjouter, diners: viewDiners, courses: viewCourses };
  function route() {
    const h = (location.hash || "").replace("#", "");
    view = h === "ce-soir" ? "priorite" : VIEWS[h] ? h : "priorite";
    closeSheet(true);
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    const y = window.scrollY;
    $("#view").innerHTML = VIEWS[view]();
    document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.v === view));
    const ss = $("#stockSearch");
    if (ss) ss.oninput = e => { stockQuery = e.target.value; const pos = e.target.selectionStart; render(); const n = $("#stockSearch"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} };
    const as = $("#addSearch");
    if (as) as.oninput = e => { addQuery = e.target.value; $("#addGrid").innerHTML = addGrid(); };
    const mf = $("#manualForm");
    if (mf) mf.onsubmit = e => { e.preventDefault(); const v = $("#manualInput").value.trim(); if (!v) return; S.lists[listTab].manual.push({ id: C.uid(), txt: v, chk: false }); save(); render(); };
    window.scrollTo(0, y);
  }
  window.addEventListener("hashchange", route);

  // Un seul gestionnaire de clics pour toute l'app
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id, date = el.dataset.date;
    const inSheet = !!el.closest("#sheet");
    if (inSheet && sheetItemId && ["exp", "setplace", "opened", "low", "dup", "retype", "rename"].includes(act)) { itemSheetAction(act, el); return; }
    switch (act) {
      case "item": openItem(id); break;
      case "fini": finish(id, "fini"); break;
      case "jete": finish(id, "jete"); break;
      case "freeze": freeze(id); break;
      case "place": stockPlace = el.dataset.v; render(); break;
      case "scan": startScanner(); break;
      case "photo": $("#photoInput").click(); break;
      case "quick": {
        const it = addType(el.dataset.k); save(); render();
        toast("✓ " + T[el.dataset.k].n + " · " + C.leftLabel(C.daysLeft(it, now())), () => { S.items = S.items.filter(x => x.id !== it.id); save(); render(); });
        break;
      }
      case "del": S.items = S.items.filter(x => x.id !== id); save(); render(); break;
      case "settype": {
        const it = S.items.find(x => x.id === id); if (!it) break;
        pickType("Où ranger « " + C.displayName(it) + " » ?", k => {
          const m = T[k]; it.t = k; it.place = m.p; it.exp = C.addDays(it.added || now(), m.d); delete it.pending;
          if (it.code) S.codes[it.code] = Object.assign(S.codes[it.code] || {}, { t: k, place: m.p, days: m.d, name: it.name, brand: it.brand, img: it.img });
          save(); render();
        });
        break;
      }
      case "retry": {
        const it = S.items.find(x => x.id === id); if (!it) break;
        S.items = S.items.filter(x => x.id !== id); save();
        toast("Nouvelle recherche…"); handleCode(it.code, false);
        break;
      }
      case "recipe": openRecipe(date); break;
      case "other": {
        S.skip[date] = (S.skip[date] || []).concat(S.plan[date] ? [S.plan[date].r] : []);
        if (S.skip[date].length > 30) S.skip[date] = [];
        delete S.plan[date]; save(); closeSheet(true); render(); break;
      }
      case "lock": if (S.plan[date]) { S.plan[date].locked = !S.plan[date].locked; save(); render(); } break;
      case "settonight": { const d = now(); S.plan[d] = { r: el.dataset.r, locked: true }; save(); render(); toast("📌 C'est le dîner de ce soir"); break; }
      case "choose": chooseRecipe(date); break;
      case "pick": S.plan[date] = { r: el.dataset.r, locked: true }; save(); closeSheet(true); render(); toast("📌 Recette gardée"); break;
      case "cooked": cooked(date); break;
      case "replan": S.plan = {}; S.skip = {}; save(); render(); toast("Nouveau planning"); break;
      case "ltab": listTab = el.dataset.v; render(); break;
      case "chk": {
        const key = el.dataset.key, lst = S.lists[listTab];
        if (key.startsWith("m:")) { const m = lst.manual.find(x => "m:" + x.id === key); if (m) m.chk = el.checked; }
        else { if (el.checked) lst.chk[key] = true; else delete lst.chk[key]; }
        save(); setTimeout(render, 150); break;
      }
      case "delmanual": { e.preventDefault(); const lst = S.lists[listTab]; lst.manual = lst.manual.filter(x => "m:" + x.id !== el.dataset.key); save(); render(); break; }
      case "rangerfrais": {
        const lst = S.lists.frais, undo = snapshot(); let n = 0;
        Object.keys(lst.chk).forEach(key => { const k = C.slotKeys(key.slice(2))[0]; if (k) { addType(k); n++; } });
        lst.chk = {}; lst.manual = lst.manual.filter(m => !m.chk);
        save(); render(); toast("✓ " + plural(n, "produit rangé") + " dans le stock", undo); break;
      }
      case "clearchk": { const lst = S.lists[listTab]; lst.chk = {}; lst.manual = lst.manual.filter(m => !m.chk); save(); render(); break; }
      case "copylist": {
        const txt = listText();
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("📋 Liste copiée"), () => {
          openSheet(`<h3>Liste</h3><div style="padding:0 16px"><textarea rows="12" readonly>${esc(txt)}</textarea></div>`);
        });
        break;
      }
      case "settings": openSettings(); break;
      case "base": {
        const k = el.dataset.k, b = S.settings.bases, i = b.indexOf(k);
        if (i >= 0) b.splice(i, 1); else b.push(k);
        el.classList.toggle("on"); save(); break;
      }
      case "fraisdays": S.settings.fraisDays = +el.dataset.v; save(); openSettings(); break;
      case "export": exportData(); break;
      case "import": $("#importFile").click(); break;
      case "wipe": {
        if (el.dataset.sure) { const undo = snapshot(); S.items = []; S.plan = {}; S.skip = {}; save(); closeSheet(true); render(); toast("Stock effacé", undo); }
        else { el.dataset.sure = "1"; el.textContent = "Sûr ? Touche encore pour effacer"; }
        break;
      }
    }
  });

  function exportData() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "bouffe-sauvegarde-" + now() + ".json";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $("#importFile").onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.items)) throw 0;
      const undo = snapshot(); S = C.migrate(data); save(); closeSheet(true); render(); toast("✓ Sauvegarde importée", undo);
    } catch (err) { toast("⚠️ Ce fichier n'est pas une sauvegarde Bouffe"); }
  };

  // ---------- Hors ligne ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  route();
})();
