/* Ember Lounge: reveals, price roll-up, booking state and summary sheet. Vanilla, no dependencies. */
(function () {
  'use strict';
  var KEY = 'mlc-ember-booking';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var state = {};
  try { state = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var params = new URLSearchParams(location.search);
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function totals() {
    var sum = 0, varies = false, plus = false;
    (state.services || []).forEach(function (s) {
      if (s.price === null || s.price === '' || isNaN(s.price)) varies = true; else sum += +s.price;
      if (s.plus) plus = true;
    });
    return { sum: sum, varies: varies, plus: plus };
  }
  function totalText() {
    var t = totals();
    if (!(state.services || []).length) return '$0';
    return '$' + t.sum + (t.varies ? ' + varies' : (t.plus ? '+' : ''));
  }
  function fillList(node, items) {
    node.textContent = '';
    items.forEach(function (it) {
      if (it === null) return;
      node.appendChild(it);
    });
  }
  function empty() { return el('span', 'empty', 'Not chosen yet'); }
  function render() {
    var svcs = state.services || [];
    $$('[data-s="service"]').forEach(function (n) {
      if (!svcs.length) { fillList(n, [empty()]); return; }
      var ul = el('ul');
      svcs.forEach(function (s) {
        var li = el('li');
        li.appendChild(el('span', '', s.name));
        li.appendChild(el('span', 'num', s.price === null || s.price === '' ? 'Varies' : '$' + s.price + (s.plus ? '+' : '')));
        ul.appendChild(li);
      });
      fillList(n, [ul]);
    });
    $$('[data-s="barber"]').forEach(function (n) { fillList(n, [state.barber ? document.createTextNode(state.barber) : empty()]); });
    $$('[data-s="time"]').forEach(function (n) {
      fillList(n, [state.time ? document.createTextNode(state.dateLabel + ' at ' + state.time) : empty()]);
    });
    $$('[data-s="total"]').forEach(function (n) { n.textContent = totalText(); });
    $$('[data-s="count"]').forEach(function (n) {
      var c = svcs.length;
      n.textContent = c ? c + (c > 1 ? ' services' : ' service') + (state.barber ? ' · ' + state.barber : '') : 'Nothing chosen yet';
    });
    $$('[data-s="ref"]').forEach(function (n) { n.textContent = state.ref || 'MLC-0000'; });
    gate();
  }

  var NEED = (document.body.getAttribute('data-need') || '');
  function ready() {
    if (NEED === 'services') return (state.services || []).length > 0;
    if (NEED === 'time') return !!state.time && (state.services || []).length > 0;
    return true;
  }
  function gate() {
    var cta = $('[data-cta]');
    if (!cta) return;
    var ok = ready();
    cta.disabled = !ok;
    var hint = $('[data-s="hint"]');
    if (hint) {
      if (document.body.getAttribute('data-step') === '4' && !(state.services || []).length) hint.textContent = 'Start with a service, then come back here.';
      else hint.style.visibility = ok ? 'hidden' : 'visible';
    }
  }
  function bump() {
    var s = $('[data-summary]');
    if (!s || reduce) return;
    s.classList.remove('bump');
    void s.offsetWidth;
    s.classList.add('bump');
    s.addEventListener('animationend', function h(e) { if (e.animationName === 'bump') { s.classList.remove('bump'); s.removeEventListener('animationend', h); } });
  }
  function changed() { save(); render(); bump(); }

  var sheet = $('[data-summary]');
  if (sheet) {
    var handle = $('.summary__handle', sheet);
    handle.addEventListener('click', function () {
      var open = sheet.classList.toggle('is-open');
      handle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  var step = document.body.getAttribute('data-step');
  var form = $('#stepform');
  if (form) {
    form.addEventListener('submit', function (e) {
      if (!ready()) { e.preventDefault(); return; }
      if (form.hasAttribute('data-confirm')) { e.preventDefault(); confirmNow(); return; }
      e.preventDefault();
      location.href = form.getAttribute('action');
    });
  }

  if (step === '1') {
    var boxes = $$('input[name="service"]');
    var pick = params.get('pick');
    boxes.forEach(function (b) {
      var item = { id: b.value, name: b.getAttribute('data-name'), price: b.getAttribute('data-price') === '' ? null : +b.getAttribute('data-price'), plus: b.hasAttribute('data-plus') };
      if (pick && pick === b.value && !(state.services || []).length) state.services = [item];
    });
    boxes.forEach(function (b) {
      b.checked = (state.services || []).some(function (s) { return s.id === b.value; });
      b.addEventListener('change', function () {
        state.services = boxes.filter(function (x) { return x.checked; }).map(function (x) {
          return { id: x.value, name: x.getAttribute('data-name'), price: x.getAttribute('data-price') === '' ? null : +x.getAttribute('data-price'), plus: x.hasAttribute('data-plus') };
        });
        changed();
      });
    });
    var first = boxes.filter(function (b) { return b.checked; })[0];
    if (first && pick) setTimeout(function () { first.closest('label').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }, 400);
  }

  if (step === '2') {
    var radios = $$('input[name="barber"]');
    if (!state.barber) state.barber = 'Any barber';
    radios.forEach(function (r) {
      r.checked = r.value === state.barber;
      r.addEventListener('change', function () { if (r.checked) { state.barber = r.value; changed(); } });
    });
    save();
  }

  if (step === '3') {
    var days = $$('.day');
    var strip = $('#dates');
    var slots = $$('input[name="slot"]');
    function showDay(iso) {
      days.forEach(function (d) { d.hidden = d.getAttribute('data-date') !== iso; });
      $$('.date', strip).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-date') === iso ? 'true' : 'false'); });
    }
    days.forEach(function (d) {
      var b = el('button', 'date');
      b.type = 'button';
      b.setAttribute('data-date', d.getAttribute('data-date'));
      b.setAttribute('aria-pressed', 'false');
      b.appendChild(el('small', '', d.getAttribute('data-dow')));
      b.appendChild(el('b', 'num', d.getAttribute('data-num')));
      b.addEventListener('click', function () { showDay(d.getAttribute('data-date')); });
      strip.appendChild(b);
    });
    showDay(state.date || days[0].getAttribute('data-date'));
    slots.forEach(function (r) {
      var v = r.value.split('|');
      r.checked = state.date === v[0] && state.time === v[2];
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.date = v[0]; state.dateLabel = v[1]; state.time = v[2];
        changed();
      });
    });
    save();
  }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function icsHref() {
    var v = (state.date || '2026-11-20').split('-');
    var m = /^(\d+):(\d+) (am|pm)$/.exec(state.time || '10:00 am') || [0, 10, 0, 'am'];
    var h = +m[1] % 12 + (m[3] === 'pm' ? 12 : 0);
    var start = v[0] + v[1] + v[2] + 'T' + two(h) + '0000';
    var end = v[0] + v[1] + v[2] + 'T' + two(h + 1) + '0000';
    var what = (state.services || []).map(function (s) { return s.name; }).join(', ');
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Major League Cuts//Mock//EN', 'BEGIN:VEVENT',
      'UID:' + (state.ref || 'mlc') + '@mlc.mock', 'DTSTAMP:20261119T120000Z',
      'DTSTART:' + start, 'DTEND:' + end, 'SUMMARY:Major League Cuts Studio 2',
      'DESCRIPTION:' + what + (state.barber ? ' with ' + state.barber : ''),
      'LOCATION:387 Valley Road\\, Clifton\\, NJ 07013', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }
  function confirmNow() {
    if (!state.ref) state.ref = 'MLC-' + (1000 + Math.floor(Math.random() * 9000));
    save(); render();
    var ics = $('[data-ics]');
    if (ics) ics.setAttribute('href', icsHref());
    document.documentElement.classList.add('is-done');
    var h = $('h1');
    if (h) h.innerHTML = 'You’re <em>booked</em>';
    var lede = $('.flow-main .lede');
    if (lede) lede.textContent = 'Your chair is held for you.';
    $$('.progress i').forEach(function (i) { i.classList.add('on'); });
    var r = $('#receipt');
    window.scrollTo(0, 0);
    if (r) r.focus({ preventScroll: true });
  }
  if (step === '4') {
    render();
    if (params.get('done') === '1' && ready()) confirmNow();
  }
  function buildRoll(node) {
    var t = node.textContent.trim();
    var m = /^\$(\d+)$/.exec(t);
    if (!m) return;
    node.setAttribute('aria-label', t);
    node.textContent = '';
    var wrap = el('span');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(document.createTextNode('$'));
    m[1].split('').forEach(function (d, i) {
      var cell = el('span', 'roll__d');
      var col = el('span', 'roll__col');
      col.style.setProperty('--n', d);
      col.style.setProperty('--i', i);
      for (var k = 0; k < 10; k++) col.appendChild(el('i', '', String(k)));
      cell.appendChild(col);
      wrap.appendChild(cell);
    });
    node.appendChild(wrap);
  }
  var rolls = $$('[data-roll]');
  if (!reduce && 'IntersectionObserver' in window) rolls.forEach(buildRoll);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        $$('[data-roll]', en.target).forEach(function (r) { setTimeout(function () { r.classList.add('rolled'); }, 120); });
        if (en.target.hasAttribute('data-roll')) en.target.classList.add('rolled');
        io.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(function (n) { io.observe(n); });
    rolls.forEach(function (r) { if (!r.closest('.reveal')) io.observe(r); });
  } else {
    $$('.reveal').forEach(function (n) { n.classList.add('in'); });
  }

  /* gallery filter: one delegated listener, toggles [hidden] on tiles */
  var filters = $('.filters');
  if (filters) {
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      var f = b.getAttribute('data-filter');
      $$('[data-filter]', filters).forEach(function (n) { n.setAttribute('aria-pressed', n === b ? 'true' : 'false'); });
      $$('#tiles .tile').forEach(function (t) { t.hidden = f !== 'all' && t.getAttribute('data-cat') !== f; });
    });
  }


  /* header menu: close on link, Escape, outside click (works without JS too) */
  (function () {
    var m = $('.menu');
    if (!m) return;
    m.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.menu__panel a')) m.removeAttribute('open'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.open) { m.removeAttribute('open'); var s = $('summary', m); if (s) s.focus(); }
    });
    document.addEventListener('click', function (e) { if (m.open && !m.contains(e.target)) m.removeAttribute('open'); });
  })();

  render();
})();
