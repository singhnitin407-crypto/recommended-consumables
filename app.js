/*
 * Recommended Consumables — vanilla JS component.
 * One state object, one render(). Every interaction changes state, then calls render().
 */
(function () {
  "use strict";

  var items = window.CONSUMABLES || [];
  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var MIN_QTY = 1, MAX_QTY = 99;
  var ADDING_MS = 700, ADDED_MS = 2500, TOAST_MS = 6000;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var available = items.filter(function (i) { return i.inStock; });
  var state = {
    selected: new Set(available.map(function (i) { return i.id; })),
    qty: {},                  // id -> quantity
    status: "idle",           // idle | adding | added
    page: 0,
    pageCount: 1,
    quickView: null,          // id of the item open in quick view
    lastAdded: []
  };
  items.forEach(function (i) { state.qty[i.id] = 1; });

  // ---------- elements ----------
  var $ = function (id) { return document.getElementById(id); };
  var root = document.querySelector(".rc");
  var track = $("rc-track"), viewport = $("rc-viewport");
  var prev = $("rc-prev"), next = $("rc-next"), dots = $("rc-dots"), range = $("rc-range");
  var totalEl = $("rc-total"), unitsEl = $("rc-units"), countEl = $("rc-count"), toggleAll = $("rc-toggle-all");
  var addBtn = $("rc-add"), addLabel = $("rc-add-label"), hint = $("rc-hint"), live = $("rc-live");
  var toast = $("rc-toast"), toastText = $("rc-toast-text"), toastThumbs = $("rc-toast-thumbs");
  var toastAction = $("rc-toast-action"), toastClose = $("rc-toast-close");
  var qv = $("rc-qv"), qvQty = $("qv-qty"), qvInclude = $("qv-include");
  var tpl = $("rc-card");
  var cards = {};

  var byId = {};
  items.forEach(function (i) { byId[i.id] = i; });

  // ---------- helpers ----------
  function clampQty(v) {
    v = Math.round(Number(v));
    if (!isFinite(v)) return MIN_QTY;
    return Math.max(MIN_QTY, Math.min(MAX_QTY, v));
  }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function selectedItems() { return available.filter(function (i) { return state.selected.has(i.id); }); }
  function totals() {
    var cents = 0, units = 0;
    selectedItems().forEach(function (i) { cents += i.price * state.qty[i.id]; units += state.qty[i.id]; });
    return { cents: cents, units: units, count: selectedItems().length };
  }

  // ---------- quantity stepper (shared by cards and quick view) ----------
  function wireStepper(wrap, input, getId, onChange) {
    wrap.querySelectorAll(".qty__btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = getId(); if (!id) return;
        setQty(id, state.qty[id] + Number(b.dataset.step));
        onChange && onChange();
      });
    });
    input.addEventListener("change", function () {
      var id = getId(); if (!id) return;
      setQty(id, input.value);
      onChange && onChange();
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") input.blur(); });
  }
  function setQty(id, v) {
    var q = clampQty(v);
    state.qty[id] = q;
    if (byId[id].inStock) state.selected.add(id);    // changing a quantity means you want the item
    render();
    announce();
  }

  // ---------- build cards ----------
  items.forEach(function (item, index) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    var inputId = "rc-item-" + item.id;
    var input = node.querySelector(".card__check");
    var img = node.querySelector(".card__img");
    var name = node.querySelector(".card__name");
    var ship = node.querySelector(".card__ship");
    var qtyWrap = node.querySelector(".qty");
    var qtyInput = node.querySelector(".qty__input");

    input.id = inputId;
    node.querySelector(".card__hit").htmlFor = inputId;
    node.querySelector(".card__sr").textContent =
      "Include " + item.name + ", " + money.format(item.price / 100) + (item.inStock ? "" : ", out of stock");

    img.src = item.img;
    if (index < 6) img.loading = "eager";
    img.addEventListener("error", function () { img.parentElement.classList.add("is-missing"); });

    if (item.bestseller) node.querySelector(".card__badge").hidden = false;
    name.textContent = item.name;
    name.setAttribute("aria-haspopup", "dialog");
    name.setAttribute("aria-label", item.name + ". Open quick view");
    node.querySelector(".card__model").textContent = "Model # " + item.model;
    node.querySelector(".card__amount").textContent = money.format(item.price / 100);
    node.querySelector(".card__unit").textContent = "/ " + item.unit.toLowerCase();

    if (item.inStock) {
      ship.textContent = item.ships;
    } else {
      ship.innerHTML = "<span>Out of stock<small></small></span>";
      ship.querySelector("small").textContent = item.availability;
      ship.classList.add("is-out");
      input.disabled = true;
      qtyInput.disabled = true;
      node.classList.add("is-unavailable");
    }
    qtyInput.setAttribute("aria-label", "Quantity for " + item.name);
    qtyInput.id = "rc-qty-" + item.id;

    input.addEventListener("change", function () {
      if (input.checked) state.selected.add(item.id); else state.selected.delete(item.id);
      node.classList.remove("is-pop"); void node.offsetWidth; node.classList.add("is-pop");
      render(); announce();
    });
    name.addEventListener("click", function () { openQuickView(item.id, name); });
    node.querySelector(".card__peek").addEventListener("click", function () { openQuickView(item.id, name); });
    wireStepper(qtyWrap, qtyInput, function () { return item.id; });

    cards[item.id] = { li: node, input: input, qty: qtyInput, qtyWrap: qtyWrap, line: node.querySelector(".card__line") };
    track.appendChild(node);
  });

  // ---------- render ----------
  var shownCents = 0, tween;
  function render() {
    var t = totals();
    var busy = state.status !== "idle";
    root.dataset.status = state.status;

    animateTotal(t.cents);
    unitsEl.textContent = t.count === 0 ? "No items selected" : plural(t.count, "item") + " · " + plural(t.units, "unit");
    countEl.innerHTML = "<strong>" + t.count + " of " + available.length + "</strong> selected";
    toggleAll.textContent = t.count === available.length ? "Clear all" : "Select all";
    toggleAll.disabled = busy;

    items.forEach(function (item) {
      var c = cards[item.id], on = state.selected.has(item.id), q = state.qty[item.id];
      c.input.checked = on;
      c.input.disabled = !item.inStock || busy;
      c.qty.value = q;
      c.qty.disabled = !item.inStock || busy;
      c.qtyWrap.querySelector('[data-step="-1"]').disabled = !item.inStock || busy || q <= MIN_QTY;
      c.qtyWrap.querySelector('[data-step="1"]').disabled = !item.inStock || busy || q >= MAX_QTY;
      c.line.textContent = q > 1 ? money.format(item.price * q / 100) : "";
      c.li.classList.toggle("is-selected", on);
      c.li.classList.toggle("is-unselected", item.inStock && !on);
    });

    addBtn.dataset.status = state.status;
    if (state.status === "adding") addLabel.textContent = "Adding…";
    else if (state.status === "added") addLabel.textContent = "Added To Cart ✓";
    else if (t.count === 0) addLabel.textContent = "Add To Cart";
    else if (t.count === available.length) addLabel.textContent = "Add All To Cart";
    else addLabel.textContent = "Add Selected (" + t.count + ") To Cart";
    addBtn.disabled = busy || t.count === 0;
    hint.textContent = t.count === 0 && !busy ? "Select items to add" : "";

    prev.disabled = state.page <= 0;
    next.disabled = state.page >= state.pageCount - 1;
    Array.prototype.forEach.call(dots.children, function (d, i) {
      if (i === state.page) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
    renderRange();
    if (state.quickView) syncQuickView();
  }

  function animateTotal(target) {
    cancelAnimationFrame(tween);
    if (reduceMotion || shownCents === target) { shownCents = target; totalEl.textContent = money.format(target / 100); return; }
    var from = shownCents, start = performance.now(), dur = 280;
    totalEl.classList.add("is-bump");
    (function step(now) {
      var p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      shownCents = Math.round(from + (target - from) * e);
      totalEl.textContent = money.format(shownCents / 100);
      if (p < 1) tween = requestAnimationFrame(step);
      else setTimeout(function () { totalEl.classList.remove("is-bump"); }, 180);
    })(start);
  }

  // ---------- carousel ----------
  function gapPx() { return parseFloat(getComputedStyle(track).columnGap) || 0; }
  function pageWidth() { return viewport.clientWidth + gapPx(); }
  function maxScroll() { return Math.max(0, viewport.scrollWidth - viewport.clientWidth); }
  function cardWidth() { var f = track.firstElementChild; return f ? f.getBoundingClientRect().width + gapPx() : 1; }

  function measurePages() {
    var count = maxScroll() <= 1 ? 1 : Math.ceil((maxScroll() - 1) / pageWidth()) + 1;
    if (count !== state.pageCount || dots.children.length !== count) {
      state.pageCount = count;
      dots.innerHTML = "";
      for (var i = 0; i < count; i++) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "rc__dot";
        b.setAttribute("aria-label", "Page " + (i + 1) + " of " + count);
        b.addEventListener("click", goTo.bind(null, i));
        dots.appendChild(b);
      }
      dots.hidden = count < 2;
    }
    syncPage();
  }
  function syncPage() {
    var x = viewport.scrollLeft;
    var page = x >= maxScroll() - 2 ? state.pageCount - 1 : Math.round(x / pageWidth());
    state.page = Math.max(0, Math.min(state.pageCount - 1, page));
    render();
  }
  function renderRange() {
    var first = Math.round(viewport.scrollLeft / cardWidth()) + 1;
    var visible = Math.max(1, Math.floor((viewport.clientWidth + gapPx()) / cardWidth() + 0.05));
    var last = Math.min(items.length, first + visible - 1);
    range.textContent = (first === last ? "Showing " + first : "Showing " + first + "–" + last) + " of " + items.length;
  }
  function goTo(page) {
    page = Math.max(0, Math.min(state.pageCount - 1, page));
    state.page = page;
    viewport.scrollTo({ left: page === state.pageCount - 1 ? maxScroll() : page * pageWidth() });
    render();
  }
  prev.addEventListener("click", function () { goTo(state.page - 1); });
  next.addEventListener("click", function () { goTo(state.page + 1); });
  viewport.addEventListener("keydown", function (e) {
    if (e.target !== viewport) return;
    var map = { ArrowRight: state.page + 1, ArrowLeft: state.page - 1, Home: 0, End: state.pageCount - 1 };
    if (e.key in map) { e.preventDefault(); goTo(map[e.key]); }
  });
  // keep keyboard focus visible: when a card control gets focus off-screen, the browser scrolls it in;
  // we then resync the pager.
  var scrollTimer;
  viewport.addEventListener("scroll", function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(syncPage, 80); }, { passive: true });
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measurePages(); goTo(state.page); }, 120);
  });

  // ---------- select all / clear ----------
  toggleAll.addEventListener("click", function () {
    if (state.selected.size === available.length) state.selected.clear();
    else available.forEach(function (i) { state.selected.add(i.id); });
    render(); announce();
  });

  // ---------- quick view ----------
  var qvOpener = null;
  function openQuickView(id, opener) {
    if (state.status !== "idle") return;
    var item = byId[id];
    state.quickView = id; qvOpener = opener || null;
    $("qv-img").src = item.img; $("qv-img").alt = item.name;
    $("qv-badge").hidden = !item.bestseller;
    $("qv-name").textContent = item.name;
    $("qv-model").textContent = "Model # " + item.model;
    $("qv-price").textContent = money.format(item.price / 100);
    $("qv-unit").textContent = "/ " + item.unit.toLowerCase();
    var s = $("qv-ships");
    if (item.inStock) s.textContent = item.ships;
    else { s.innerHTML = "<span>Out of stock<small></small></span>"; s.querySelector("small").textContent = item.availability; }
    s.classList.toggle("is-out", !item.inStock);
    $("qv-link").href = item.url;
    qvQty.disabled = !item.inStock; qvInclude.disabled = !item.inStock;
    qvQty.setAttribute("aria-label", "Quantity for " + item.name);
    syncQuickView();
    if (typeof qv.showModal === "function") qv.showModal(); else qv.setAttribute("open", "");
  }
  function syncQuickView() {
    var id = state.quickView, item = byId[id], q = state.qty[id];
    qvQty.value = q;
    qvInclude.checked = state.selected.has(id);
    var wrap = qv.querySelector('[data-role="qv-qty"]');
    wrap.querySelector('[data-step="-1"]').disabled = !item.inStock || q <= MIN_QTY;
    wrap.querySelector('[data-step="1"]').disabled = !item.inStock || q >= MAX_QTY;
    $("qv-line").textContent = !item.inStock ? "Can't be added until it's back in stock."
      : state.selected.has(id) ? "In bundle: " + plural(q, "unit") + " · " + money.format(item.price * q / 100)
      : "Not in bundle";
  }
  wireStepper(qv.querySelector('[data-role="qv-qty"]'), qvQty, function () { return state.quickView; });
  qvInclude.addEventListener("change", function () {
    var id = state.quickView;
    if (qvInclude.checked) state.selected.add(id); else state.selected.delete(id);
    render(); announce();
  });
  function closeQuickView() { if (qv.open) qv.close(); }
  $("qv-close").addEventListener("click", closeQuickView);
  $("qv-done").addEventListener("click", closeQuickView);
  qv.addEventListener("click", function (e) { if (e.target === qv) closeQuickView(); });   // backdrop
  qv.addEventListener("close", function () {
    state.quickView = null;
    if (qvOpener) qvOpener.focus();
  });

  // ---------- add to cart ----------
  addBtn.addEventListener("click", function () {
    var chosen = selectedItems();
    if (!chosen.length || state.status !== "idle") return;
    var t = totals();
    state.status = "adding";
    state.lastAdded = chosen.map(function (i) { return i.id; });
    render();
    live.textContent = "Adding " + plural(t.count, "item") + " to cart";
    setTimeout(function () {                           // simulated request; no real cart
      state.status = "added";
      render();
      showToast(plural(t.count, "item") + " (" + plural(t.units, "unit") + ") added to cart", chosen, true);
      setTimeout(function () { state.status = "idle"; render(); }, ADDED_MS);
    }, ADDING_MS);
  });

  // ---------- toast ----------
  var toastTimer;
  function showToast(text, list, undoable) {
    toastText.textContent = text;
    toastThumbs.innerHTML = "";
    (list || []).slice(0, 3).forEach(function (i) {
      var im = document.createElement("img"); im.src = i.img; im.alt = ""; toastThumbs.appendChild(im);
    });
    if (list && list.length > 3) {
      var more = document.createElement("span"); more.className = "toast__more"; more.textContent = "+" + (list.length - 3);
      toastThumbs.appendChild(more);
    }
    toastAction.hidden = !undoable;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, TOAST_MS);
  }
  toastClose.addEventListener("click", function () { toast.hidden = true; });
  toastAction.addEventListener("click", function () {
    var n = state.lastAdded.length; state.lastAdded = [];
    showToast(plural(n, "item") + " removed from cart", [], false);
  });

  // ---------- announcements ----------
  var announceTimer;
  function announce() {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () {
      var t = totals();
      live.textContent = "Total " + money.format(t.cents / 100) + ". " + t.count + " of " + available.length + " selected, " + plural(t.units, "unit") + ".";
    }, 300);
  }

  // ---------- start ----------
  shownCents = totals().cents;                         // no count-up on first paint
  measurePages();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measurePages);
})();
