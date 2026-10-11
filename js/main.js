/* Cumbre · lógica del sitio (carrito, pedido por WhatsApp, filtros, horario, animaciones).
   Script clásico + IIFE: funciona también abriendo index.html con doble clic. */
(function () {
  "use strict";

  var CONFIG = {
    whatsapp: "584168769923",          // 0416-8769923 en formato internacional
    storageKey: "cumbre-pedido-v1",
    formKey: "cumbre-datos-v1",
    timeZone: "America/Caracas",
    // 0 = domingo … 6 = sábado. Horas en formato 24 h; null = cerrado.
    hours: { 0: [13, 22], 1: null, 2: [17, 22], 3: [13, 22], 4: [13, 22], 5: [13, 22], 6: [13, 22] }
  };
  var DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function safe(fn) { try { fn(); } catch (err) { if (window.console) console.warn("[cumbre]", err); } }
  function money(n) {
    var v = Math.round(n * 100) / 100;
    return "$" + (v % 1 === 0 ? String(v) : v.toFixed(2).replace(".", ","));
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  document.documentElement.classList.add("js");

  /* Al recargar, la página vuelve siempre al video principal (el navegador no recuerda la posición) */
  safe(function () {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    var isReload = nav ? nav.type === "reload" : (performance.navigation && performance.navigation.type === 1);
    if (isReload && location.hash) history.replaceState(null, "", location.pathname + location.search);
    var toTop = function () {
      if (location.hash) return; // un enlace directo a una sección sí se respeta
      var html = document.documentElement, prev = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      html.style.scrollBehavior = prev;
    };
    toTop();
    window.addEventListener("load", toTop);
    window.addEventListener("pageshow", function (e) { if (e.persisted) toTop(); });
  });

  /* ------------------------------------------------------------------
     CARRITO
     ------------------------------------------------------------------ */
  var cart = [];
  var saved = store(CONFIG.storageKey);
  if (Array.isArray(saved)) {
    cart = saved.filter(function (l) { return l && l.key && l.qty > 0 && typeof l.price === "number"; });
  }

  var els = {};
  var lastFocus = null;

  function persist() { store(CONFIG.storageKey, cart); }
  function count() { return cart.reduce(function (a, l) { return a + l.qty; }, 0); }
  function total() { return cart.reduce(function (a, l) { return a + l.qty * l.price; }, 0); }

  /* Cada hamburguesa con sus propios adicionales es una línea distinta del pedido.
     Dos hamburguesas iguales con los mismos adicionales e indicaciones se suman en la misma línea. */
  function addItem(item, qty) {
    var extras = (item.extras || []).slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    var note = (item.note || "").trim();
    var key = [item.id, item.opt || "", extras.map(function (x) { return x.id; }).join("+"), note.toLowerCase()].join("|");
    var unit = item.price + extras.reduce(function (a, x) { return a + x.price; }, 0);
    var found = cart.filter(function (l) { return l.key === key; })[0];
    if (found) found.qty += qty || 1;
    else cart.push({ key: key, id: item.id, name: item.name, opt: item.opt || "", extras: extras, note: note,
                     base: item.price, price: unit, img: item.img || "", qty: qty || 1 });
    persist(); render();
    bump();
  }
  function setQty(key, qty) {
    cart = cart.map(function (l) { if (l.key === key) l.qty = qty; return l; }).filter(function (l) { return l.qty > 0; });
    persist(); render();
  }

  function bump() {
    $$(".badge").forEach(function (b) {
      b.classList.remove("is-bump"); void b.offsetWidth; b.classList.add("is-bump");
    });
  }

  function lineHTML(l) {
    var img = l.img
      ? '<img class="line__img" src="' + l.img + '" alt="" width="56" height="56">'
      : '<span class="line__img line__img--ph" aria-hidden="true">' + l.name.charAt(0) + "</span>";
    var extras = l.extras || [];
    var detail = "<small>" + (l.opt ? esc(l.opt) + " · " : "") + money(l.price) + (l.qty > 1 ? " c/u" : "") + "</small>";
    var xs = extras.length
      ? '<ul class="line__xtras">' + extras.map(function (x) {
          return "<li>+ " + esc(x.name) + " <span>" + money(x.price) + "</span></li>";
        }).join("") + "</ul>"
      : "";
    var note = l.note ? '<p class="line__note">\u201C' + esc(l.note) + '\u201D</p>' : "";
    return '<li class="line" data-key="' + esc(l.key) + '">' + img +
      '<div class="line__name"><p>' + esc(l.name) + "</p>" + detail + xs + note + "</div>" +
      '<span class="line__total">' + money(l.price * l.qty) + "</span>" +
      '<div class="line__ctrl">' +
        '<div class="stepper" role="group" aria-label="Cantidad de ' + esc(l.name) + '">' +
          '<button type="button" data-step="-1" aria-label="Quitar uno">−</button>' +
          "<output>" + l.qty + "</output>" +
          '<button type="button" data-step="1" aria-label="Añadir uno">+</button>' +
        "</div>" +
        '<button type="button" class="trash line__rm" data-remove aria-label="Quitar ' + esc(l.name) + ' del pedido" title="Quitar del pedido">' + TRASH_SVG + "</button>" +
      "</div></li>";
  }
  var TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render() {
    var n = count(), t = total();
    $$("[data-cart-count]").forEach(function (el) { el.textContent = n; });
    $$("[data-cart-total]").forEach(function (el) { el.textContent = money(t); });
    $$("[data-cart-word]").forEach(function (el) { el.textContent = n === 1 ? "producto" : "productos"; });
    if (els.sub) els.sub.textContent = n ? n + (n === 1 ? " producto en tu mochila" : " productos en tu mochila") : "Todavía no has elegido nada";
    if (els.cart) els.cart.classList.toggle("is-empty", n === 0);
    if (els.lines) els.lines.innerHTML = cart.map(lineHTML).join("");
    if (els.orderbar) els.orderbar.classList.toggle("is-visible", n > 0);
    document.body.classList.toggle("has-order", n > 0); // deja espacio al final para la barra
    var navCart = $(".nav__cart");
    if (navCart) navCart.setAttribute("aria-label", "Abrir el carrito, " + n + (n === 1 ? " producto" : " productos"));
  }

  function openCart() {
    lastFocus = document.activeElement;
    els.cart.classList.add("is-open");
    els.cart.setAttribute("aria-hidden", "false");
    els.scrim.hidden = false;
    requestAnimationFrame(function () { els.scrim.classList.add("is-on"); });
    document.body.classList.add("cart-open");
    $$("main, .nav, .foot, .orderbar").forEach(function (el) { el.setAttribute("inert", ""); });
    setTimeout(function () { els.cart.focus(); }, 60);
  }
  function closeCart() {
    els.cart.classList.remove("is-open");
    els.cart.setAttribute("aria-hidden", "true");
    els.scrim.classList.remove("is-on");
    document.body.classList.remove("cart-open");
    $$("main, .nav, .foot, .orderbar").forEach(function (el) { el.removeAttribute("inert"); });
    setTimeout(function () { els.scrim.hidden = true; }, 400);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Aviso de la mascota */
  var toastTimer;
  var LINES = [
    "¡{n} va a la mochila!",
    "Buena ruta: {n} añadida.",
    "{n} lista para la expedición.",
    "El oso aprueba: {n}."
  ];
  function toast(name) {
    var t = $("[data-toast]"); if (!t) return;
    var msg = LINES[Math.floor(Math.random() * LINES.length)].replace("{n}", name);
    $("[data-toast-text]", t).textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 2200);
  }

  function flashAdded(btn) {
    if (!btn) return;
    var label = btn.querySelector("span");
    btn.classList.add("is-added");
    if (label) label.textContent = "¡Añadido!";
    clearTimeout(btn._t);
    btn._t = setTimeout(function () {
      btn.classList.remove("is-added");
      if (label) label.textContent = "Añadir al carrito";
    }, 1300);
  }

  /* ------------------------------------------------------------------
     VENTANA PARA PERSONALIZAR CADA HAMBURGUESA (adicionales, pollo, nota)
     ------------------------------------------------------------------ */
  var sheet = { host: null, qty: 1, opener: null };

  function sheetState() {
    var extras = $$("[data-sheet-extras] input:checked").map(function (i) {
      return { id: i.value, name: i.getAttribute("data-name"), price: parseFloat(i.getAttribute("data-price")) };
    });
    var optEl = $("[data-sheet-opts-list] input:checked");
    return {
      extras: extras,
      opt: optEl ? optEl.value : "",
      note: $("[data-sheet-note]").value,
      unit: parseFloat(sheet.host.getAttribute("data-price")) + extras.reduce(function (a, x) { return a + x.price; }, 0)
    };
  }
  function sheetRender() {
    var st = sheetState();
    $("[data-sheet-qty]").textContent = sheet.qty;
    $("[data-sheet-total]").textContent = money(st.unit * sheet.qty);
    $$("[data-sheet-extras] .xtra").forEach(function (l) { l.classList.toggle("is-on", l.querySelector("input").checked); });
  }

  function openSheet(host) {
    var el = $("[data-sheet]");
    sheet.host = host; sheet.qty = 1; sheet.opener = document.activeElement;
    var img = host.querySelector(".card__media img");
    $("[data-sheet-img]").src = img ? img.getAttribute("src") : "";
    $("[data-sheet-name]").textContent = host.getAttribute("data-name");
    var alt = host.querySelector(".card__alt span");
    $("[data-sheet-alt]").textContent = alt ? alt.textContent : "";
    $("[data-sheet-base]").textContent = money(parseFloat(host.getAttribute("data-price")));
    $$("[data-sheet-extras] input").forEach(function (i) { i.checked = false; });
    $("[data-sheet-note]").value = "";

    var opts = (host.getAttribute("data-options") || "").split("|").filter(Boolean);
    $("[data-sheet-opts]").hidden = !opts.length;
    $("[data-sheet-opts-list]").innerHTML = opts.map(function (o, i) {
      return '<label><input type="radio" name="sheet-opt" value="' + esc(o) + '"' + (i === 0 ? " checked" : "") + "><span>" + esc(o) + "</span></label>";
    }).join("");

    sheetRender();
    $(".sheet__body", el).scrollTop = 0;
    $(".sheet-scrim").hidden = false;
    el.setAttribute("aria-hidden", "false");
    void el.offsetWidth; // fuerza el estado inicial para que la transición se vea
    $(".sheet-scrim").classList.add("is-on");
    el.classList.add("is-open");
    document.body.classList.add("sheet-open");
    $$("main, .nav, .foot, .orderbar").forEach(function (n) { n.setAttribute("inert", ""); });
    setTimeout(function () { el.focus(); }, 60);
  }
  function closeSheet() {
    var el = $("[data-sheet]");
    if (!el.classList.contains("is-open")) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    $(".sheet-scrim").classList.remove("is-on");
    document.body.classList.remove("sheet-open");
    $$("main, .nav, .foot, .orderbar").forEach(function (n) { n.removeAttribute("inert"); });
    setTimeout(function () { $(".sheet-scrim").hidden = true; }, 350);
    if (sheet.opener && sheet.opener.focus) sheet.opener.focus();
  }

  function initSheet() {
    var el = $("[data-sheet]"); if (!el) return;
    el.addEventListener("change", sheetRender);
    $$("[data-sheet-close]").forEach(function (b) { b.addEventListener("click", closeSheet); });
    $$("[data-sheet-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        sheet.qty = Math.max(1, Math.min(20, sheet.qty + parseInt(b.getAttribute("data-sheet-step"), 10)));
        sheetRender();
      });
    });
    $("[data-sheet-add]").addEventListener("click", function () {
      var host = sheet.host, st = sheetState();
      var img = host.querySelector(".card__media img");
      addItem({
        id: host.getAttribute("data-id"),
        name: host.getAttribute("data-name"),
        price: parseFloat(host.getAttribute("data-price")),
        opt: st.opt, extras: st.extras, note: st.note,
        img: img ? img.getAttribute("src") : ""
      }, sheet.qty);
      var name = host.getAttribute("data-name");
      toast(st.extras.length ? name + " con " + st.extras.length + (st.extras.length === 1 ? " adicional" : " adicionales") : name);
      var btn = host.querySelector("[data-add]");
      closeSheet();
      flashAdded(btn);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  }

  function initCart() {
    els.cart = $("#cart");
    els.scrim = $(".scrim");
    els.lines = $("[data-cart-lines]");
    els.sub = $("[data-cart-sub]");
    els.orderbar = $("[data-orderbar]");
    els.form = $("[data-checkout]");
    els.error = $("[data-form-error]");

    // Añadir desde tarjetas y filas del menú
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add]");
      if (!btn) return;
      var host = btn.closest("[data-id]");
      if (!host) return;
      if (host.hasAttribute("data-custom")) { openSheet(host); return; }
      var optInput = host.querySelector(".opts input:checked");
      var img = host.querySelector(".card__media img");
      var item = {
        id: host.getAttribute("data-id"),
        name: host.getAttribute("data-name"),
        price: parseFloat(host.getAttribute("data-price")),
        opt: optInput ? optInput.value : "",
        img: img ? img.getAttribute("src") : ""
      };
      addItem(item);
      toast(item.name);
      flashAdded(btn);
    });

    $$("[data-open-cart]").forEach(function (b) { b.addEventListener("click", openCart); });
    $$("[data-close-cart]").forEach(function (b) { b.addEventListener("click", closeCart); });
    $$("[data-goto-menu]").forEach(function (b) {
      b.addEventListener("click", function () { setTimeout(function () { $("#menu").scrollIntoView(); }, 50); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && els.cart.classList.contains("is-open")) closeCart();
    });

    els.lines.addEventListener("click", function (e) {
      var li = e.target.closest(".line"); if (!li) return;
      var key = li.getAttribute("data-key");
      var line = cart.filter(function (l) { return l.key === key; })[0]; if (!line) return;
      var step = e.target.closest("[data-step]");
      if (step) setQty(key, line.qty + parseInt(step.getAttribute("data-step"), 10));
      if (e.target.closest("[data-remove]")) setQty(key, 0);
    });

    $("[data-clear-cart]").addEventListener("click", function () {
      cart = []; persist(); render();
    });

    // Datos del formulario: se recuerdan en este navegador
    var f = els.form;
    var data = store(CONFIG.formKey) || {};
    ["nombre", "direccion", "pago", "notas"].forEach(function (k) { if (data[k] && f[k]) f[k].value = data[k]; });
    if (data.entrega) $$('input[name="entrega"]', f).forEach(function (r) { r.checked = r.value === data.entrega; });
    function syncDelivery() {
      var isDelivery = f.entrega.value === "Delivery";
      $("[data-address-field]").hidden = !isDelivery;
      $("[data-delivery-note]").textContent = isDelivery
        ? "El costo del delivery se confirma por WhatsApp."
        : "Te avisamos por WhatsApp cuando tu pedido esté listo para retirar.";
    }
    f.addEventListener("input", function (e) {
      var d = {};
      ["nombre", "direccion", "pago", "notas", "entrega"].forEach(function (k) { d[k] = f[k] ? f[k].value : ""; });
      store(CONFIG.formKey, d);
      var fld = e.target.closest(".field"); if (fld) fld.classList.remove("is-invalid");
      els.error.textContent = "";
    });
    f.addEventListener("change", syncDelivery);
    f.addEventListener("submit", function (e) { e.preventDefault(); checkout(); });
    syncDelivery();

    $("[data-checkout-btn]").addEventListener("click", checkout);
    render();
  }

  function fail(field, msg) {
    els.error.textContent = msg;
    var fld = field.closest(".field"); if (fld) fld.classList.add("is-invalid");
    field.focus();
  }

  function buildMessage(f) {
    var out = [];
    out.push("¡Hola, Cumbre! 👋 Quiero hacer este pedido:");
    out.push("");
    out.push("🍔 *MI PEDIDO*");
    cart.forEach(function (l) {
      var extras = l.extras || [];
      out.push("• " + l.qty + " x " + l.name + (l.opt ? " (" + l.opt + ")" : "") + ": " + money(l.price * l.qty));
      extras.forEach(function (x) { out.push("     + " + x.name + " (" + money(x.price) + ")"); });
      if (l.note) out.push("     \uD83D\uDCCC " + l.note);
      if (l.qty > 1 && extras.length) out.push("     (adicionales en cada una)");
    });
    out.push("");
    out.push("💰 *TOTAL: " + money(total()) + "*");
    out.push("");
    out.push("👤 Nombre: " + f.nombre.value.trim());
    if (f.entrega.value === "Delivery") {
      out.push("🛵 Entrega: Delivery");
      var g = usingGeo() ? geo : null;
      if (g) out.push("📍 Mi ubicación: https://maps.google.com/?q=" + g.lat + "," + g.lng);
      if (f.direccion.value.trim()) out.push((g ? "🏠 Referencia: " : "📍 Dirección: ") + f.direccion.value.trim());
    } else {
      out.push("🏔️ Entrega: Retiro en el local (C.C. Plaza Mayor)");
    }
    out.push("💳 Forma de pago: " + f.pago.value);
    if (f.notas.value.trim()) out.push("📝 Notas: " + f.notas.value.trim());
    out.push("");
    out.push("¡Gracias!");
    return out.join("\n");
  }

  /* ------------------------------------------------------------------
     UBICACIÓN DEL CLIENTE (GPS del teléfono, siempre con su permiso)
     El navegador muestra su propio aviso "¿Permitir ubicación?". Solo se usa
     para el mensaje de WhatsApp; no se guarda en ningún lado.
     ------------------------------------------------------------------ */
  var geo = null;
  function modo() {
    var r = els.form && els.form.querySelector('input[name="modo"]:checked');
    return r ? r.value : "escribir";
  }
  function usingGeo() { return modo() === "ubicacion" && !!geo; }

  function initGeo() {
    var btn = $("[data-geo-btn]"); if (!btn) return;
    var label = $("[data-geo-label]"), msg = $("[data-geo-msg]"), ok = $("[data-geo-ok]");
    var f = els.form;

    function showMsg(t) { msg.textContent = t || ""; }
    var geoBox = $("[data-geo]"), addrLabel = $("[data-addr-label]");
    function syncModo() {
      var m = modo();
      geoBox.hidden = m !== "ubicacion";
      addrLabel.innerHTML = m === "ubicacion" ? "Punto de referencia <em>(opcional)</em>" : "Dirección de entrega";
      f.direccion.placeholder = m === "ubicacion"
        ? "Casa, piso, color del portón o algo cercano"
        : "Sector, calle, casa o edificio y un punto de referencia";
      els.error.textContent = "";
      var fld = f.direccion.closest(".field"); if (fld) fld.classList.remove("is-invalid");
    }
    $$('input[name="modo"]', f).forEach(function (r) { r.addEventListener("change", syncModo); });
    function setGeo(g) {
      geo = g;
      ok.hidden = !g; btn.hidden = !!g;
      if (g) {
        $("[data-geo-map]").href = "https://maps.google.com/?q=" + g.lat + "," + g.lng;
        $("[data-geo-acc]").textContent = g.acc ? "Precisión aproximada: " + g.acc + " m" : "";
        var fld = f.direccion.closest(".field"); if (fld) fld.classList.remove("is-invalid");
        els.error.textContent = "";
      }
    }

    if (!("geolocation" in navigator) || !window.isSecureContext) {
      $("[data-modo]").hidden = true; // sin GPS disponible: queda solo la dirección escrita
      f.querySelector('input[name="modo"][value="escribir"]').checked = true;
      syncModo();
      return;
    }
    syncModo();

    var help = $("[data-geo-help]");
    var ua = navigator.userAgent || "";
    var device = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios"
      : /Android/.test(ua) ? "android" : "pc";
    var STEPS = {
      android: {
        name: "celular",
        steps: [
          "Toca el ícono que está a la izquierda de la dirección de la página (un candado o una <b>ⓘ</b>).",
          "Entra en <b>Permisos</b> y luego en <b>Ubicación</b>.",
          "Elige <b>Permitir</b> o <b>Preguntar</b>. Así te aparecerá la opción <b>Solo esta vez</b>.",
          "Revisa también que la ubicación del teléfono esté encendida.",
          "Vuelve aquí y toca <b>Intentar de nuevo</b>."
        ]
      },
      ios: {
        name: "iPhone",
        steps: [
          "Toca <b>aA</b> (o el ícono de ajustes) junto a la dirección de la página.",
          "Entra en <b>Ajustes del sitio web</b> y en <b>Ubicación</b> elige <b>Preguntar</b>.",
          "Si no aparece: Ajustes del iPhone, <b>Privacidad y seguridad</b>, <b>Localización</b>, <b>Safari</b> y elige <b>Preguntar la próxima vez</b>.",
          "Vuelve aquí y toca <b>Intentar de nuevo</b>. Podrás elegir <b>Permitir una vez</b>."
        ]
      },
      pc: {
        name: "navegador",
        steps: [
          "Haz clic en el candado o en el ícono de ajustes que está a la izquierda de la dirección de la página.",
          "Busca <b>Ubicación</b> y cámbiala a <b>Permitir</b> o <b>Preguntar</b> (o toca <b>Restablecer permisos</b>).",
          "Vuelve aquí y toca <b>Intentar de nuevo</b>."
        ]
      }
    };
    $("[data-geo-device]").textContent = STEPS[device].name;
    $("[data-geo-steps]").innerHTML = STEPS[device].steps.map(function (t) { return "<li>" + t + "</li>"; }).join("");

    function permState(cb) {
      if (!navigator.permissions || !navigator.permissions.query) return cb("unknown");
      navigator.permissions.query({ name: "geolocation" }).then(function (st) {
        if (!st._watched) {
          st._watched = true;
          st.onchange = function () { // si el cliente lo activa en los ajustes, seguimos solos
            if (st.state !== "denied" && !help.hidden) { help.hidden = true; btn.hidden = false; if (st.state === "granted") request(); }
          };
        }
        cb(st.state);
      }, function () { cb("unknown"); });
    }
    function showHelp() {
      help.hidden = false; btn.hidden = true; showMsg("");
      label.textContent = "Usar mi ubicación actual";
    }

    $("[data-geo-retry]").addEventListener("click", function () {
      permState(function (state) {
        if (state === "denied") {
          showMsg("Todavía aparece bloqueada. Revisa los pasos de arriba o recarga la página después de activarla.");
          help.classList.remove("is-shake"); void help.offsetWidth; help.classList.add("is-shake");
          return;
        }
        help.hidden = true; btn.hidden = false; request();
      });
    });
    $("[data-geo-write]").addEventListener("click", function () {
      var w = f.querySelector('input[name="modo"][value="escribir"]');
      w.checked = true; help.hidden = true; btn.hidden = false; syncModo(); showMsg("");
      f.direccion.focus();
    });

    btn.addEventListener("click", function () {
      permState(function (state) {
        if (state === "denied") return showHelp(); // bloqueada: el navegador no dejará preguntar de nuevo
        request();
      });
    });

    function request() {
      btn.disabled = true; btn.classList.add("is-busy");
      label.textContent = "Buscando tu ubicación…";
      showMsg("");
      navigator.geolocation.getCurrentPosition(function (pos) {
        btn.disabled = false; btn.classList.remove("is-busy");
        label.textContent = "Usar mi ubicación actual";
        setGeo({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          acc: Math.round(pos.coords.accuracy || 0)
        });
      }, function (err) {
        btn.disabled = false; btn.classList.remove("is-busy");
        label.textContent = "Usar mi ubicación actual";
        if (err && err.code === 1) {
          permState(function (state) {
            if (state === "prompt") {
              // cerró el aviso sin elegir: el botón lo vuelve a mostrar
              showMsg("Cerraste el aviso sin elegir. Toca el botón otra vez y elige Permitir o Solo esta vez.");
            } else {
              showHelp();
            }
          });
        } else {
          showMsg("No pudimos obtener tu ubicación. Revisa que el GPS esté encendido e inténtalo de nuevo, o elige \u201CEscribir la dirección\u201D.");
        }
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    }

    $("[data-geo-clear]").addEventListener("click", function () {
      setGeo(null);
      help.hidden = true;
      label.textContent = "Usar mi ubicación actual";
      btn.focus();
    });
  }

  function checkout() {
    var f = els.form;
    if (!cart.length) return;
    if (!f.nombre.value.trim()) return fail(f.nombre, "Escribe tu nombre para saber a quién entregar el pedido.");
    if (f.entrega.value === "Delivery" && modo() === "ubicacion" && !geo) {
      var gb = $("[data-geo-btn]");
      $("[data-geo-msg]").textContent = "Toca \u201CUsar mi ubicación actual\u201D o elige escribir la dirección.";
      if (gb) gb.focus();
      els.error.textContent = "Falta tu ubicación para el delivery.";
      return;
    }
    if (f.entrega.value === "Delivery" && modo() === "escribir" && f.direccion.value.trim().length < 6) {
      return fail(f.direccion, "Escribe la dirección de entrega con un punto de referencia.");
    }
    var url = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(buildMessage(f));
    var win = window.open(url, "_blank", "noopener");
    if (!win) window.location.href = url;
  }

  /* ------------------------------------------------------------------
     FILTROS Y ORDEN POR ALTURA
     ------------------------------------------------------------------ */
  function initFilters() {
    var chips = $$("[data-filter]");
    var grid = $("[data-grid]");
    var items = $$("#menu [data-cat]");
    var original = $$(".card", grid);

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.getAttribute("data-filter");
        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle("is-active", on);
          c.setAttribute("aria-pressed", on ? "true" : "false");
        });
        items.forEach(function (el) {
          el.classList.toggle("is-hidden", f !== "all" && el.getAttribute("data-cat") !== f);
        });
        $$(".reveal", $("#menu")).forEach(function (el) { el.classList.add("is-in"); });
        // Si el visitante ya bajó por el menú, lo llevamos al inicio de la lista filtrada
        var head = $(".menu__head");
        var bottom = head.getBoundingClientRect().bottom;
        if (bottom < 0) window.scrollTo({ top: window.scrollY + bottom - 40, behavior: "smooth" });
      });
    });

    var sortBtn = $("[data-sort]");
    sortBtn.addEventListener("click", function () {
      var on = sortBtn.getAttribute("aria-pressed") !== "true";
      sortBtn.setAttribute("aria-pressed", on ? "true" : "false");
      $("span", sortBtn).textContent = on ? "Orden del menú" : "Ordenar por altura";
      var list = original.slice();
      if (on) list.sort(function (a, b) { return (+b.getAttribute("data-alt")) - (+a.getAttribute("data-alt")); });
      list.forEach(function (c) { grid.appendChild(c); });
    });
  }

  /* ------------------------------------------------------------------
     HORARIO EN VIVO (hora de Venezuela)
     ------------------------------------------------------------------ */
  function nowInVenezuela() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CONFIG.timeZone, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23"
    }).formatToParts(new Date());
    var get = function (t) { return (parts.filter(function (p) { return p.type === t; })[0] || {}).value; };
    var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day: day, h: parseInt(get("hour"), 10) % 24 + parseInt(get("minute"), 10) / 60 };
  }
  function hourLabel(h) {
    var hh = h > 12 ? h - 12 : h;
    return (hh === 1 ? "la " : "las ") + hh + ":00 " + (h >= 12 ? "p.m." : "a.m.");
  }
  function initStatus() {
    var box = $("[data-status]"); if (!box) return;
    var now = nowInVenezuela();
    if (now.day < 0) return;
    var today = CONFIG.hours[now.day];
    var li = $('.hours li[data-day="' + now.day + '"]'); if (li) li.classList.add("is-today");
    var open = today && now.h >= today[0] && now.h < today[1];
    var text;
    if (open) {
      text = "Abierto ahora · cerramos a " + hourLabel(today[1]);
    } else if (today && now.h < today[0]) {
      text = "Cerrado ahora · hoy abrimos a " + hourLabel(today[0]);
    } else {
      for (var i = 1; i <= 7; i++) {
        var d = (now.day + i) % 7, hrs = CONFIG.hours[d];
        if (hrs) { text = "Cerrado ahora · abrimos " + (i === 1 ? "mañana" : "el " + DAYS[d]) + " a " + hourLabel(hrs[0]); break; }
      }
    }
    box.classList.toggle("is-open", !!open);
    $("[data-status-text]", box).textContent = text;
  }

  /* ------------------------------------------------------------------
     CABECERA, VIDEO Y ENTRADAS AL HACER SCROLL
     ------------------------------------------------------------------ */
  function initNav() {
    var nav = $("#nav");
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    // Si alguien entra por un enlace a una sección, la cabecera aparece de una vez
    if (location.hash && location.hash !== "#inicio") nav.classList.add("is-forced");
  }

  function initVideo() {
    var v = $(".hero__video"); if (!v) return;
    v.muted = true;
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () { /* sin autoplay: queda el póster */ });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } else v.pause(); });
      }, { threshold: 0.01 }).observe(v);
    }
  }

  function initReveal() {
    var targets = $$(".menu__head, .card, .subhead, .carta__group, .guide__copy, .visit__head, .panel");
    if (!("IntersectionObserver" in window)) return;
    targets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) return; // lo que ya se ve, no se esconde
      el.classList.add("reveal");
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach(function (el, i) {
      el.style.transitionDelay = el.classList.contains("card") ? (i % 3) * 70 + "ms" : "0ms";
      io.observe(el);
    });
    // Red de seguridad: nada se queda invisible
    setTimeout(function () {
      $$(".reveal:not(.is-in)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      });
    }, 2500);
  }

  function init() {
    safe(initNav);
    safe(initVideo);
    safe(initCart);
    safe(initSheet);
    safe(initGeo);
    safe(initFilters);
    safe(initStatus);
    safe(initReveal);
    safe(function () { $$("[data-year]").forEach(function (y) { y.textContent = new Date().getFullYear(); }); });
    setInterval(function () { safe(initStatus); }, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
