/**
 * script.js
 * Ties the app together: state, rendering, calculations, persistence,
 * search/sort, dark mode, toast/modal UI, scroll reveals, and hooks
 * into charts.js / pdf.js.
 */

(function () {
  const STORAGE_KEY = 'weddingBudget:categories';
  const THEME_KEY = 'weddingBudget:theme';

  let categories = [];      // full, unfiltered state
  let searchTerm = '';
  let sortMode = 'default';

  // ---- DOM refs ----
  const listEl = document.getElementById('categoryList');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const themeToggle = document.getElementById('themeToggle');
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const printBtn = document.getElementById('printBtn');
  const pdfBtn = document.getElementById('pdfBtn');
  const resetModal = document.getElementById('resetModal');
  const resetCancel = document.getElementById('resetCancel');
  const resetConfirm = document.getElementById('resetConfirm');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // ---- Formatting helpers ----
  function formatINR(n) {
    const rounded = Math.round(n || 0);
    const sign = rounded < 0 ? '-' : '';
    return sign + '₹' + Math.abs(rounded).toLocaleString('en-IN');
  }

  function formatRange(min, max) {
    return min === max ? formatINR(min) : formatINR(min) + ' – ' + formatINR(max);
  }

  // ---- Persistence ----
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {
      console.error('Could not read saved budget, using defaults.', e);
    }
    return getDefaultState();
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }

  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved === 'dark' ? 'dark' : 'light';
    applyTheme(theme);
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      document.documentElement.removeAttribute('data-theme');
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  // ---- Calculations ----
  function computeTotals(cats) {
    const totals = cats.reduce(function (acc, c) {
      acc.min += Number(c.min) || 0;
      acc.max += Number(c.max) || 0;
      acc.actual += Number(c.actual) || 0;
      return acc;
    }, { min: 0, max: 0, actual: 0 });

    totals.estimatedAvg = (totals.min + totals.max) / 2;
    totals.difference = totals.actual - totals.estimatedAvg;
    totals.remaining = totals.max - totals.actual;
    totals.variancePct = totals.estimatedAvg ? (totals.difference / totals.estimatedAvg) * 100 : 0;
    totals.count = cats.length;
    return totals;
  }

  // ---- Animated counters ----
  const counterState = new WeakMap();
  function animateValue(el, toValue, formatter) {
    const from = counterState.get(el) || 0;
    const duration = 600;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (toValue - from) * eased;
      el.textContent = formatter(current);
      if (progress < 1) requestAnimationFrame(step);
      else counterState.set(el, toValue);
    }
    requestAnimationFrame(step);
  }

  // ---- Rendering: dashboard + summary ----
  function renderTotals() {
    const totals = computeTotals(categories);

    animateValue(document.getElementById('statEstimated'), totals.estimatedAvg, formatINR);
    animateValue(document.getElementById('statActual'), totals.actual, formatINR);
    animateValue(document.getElementById('statCategories'), totals.count, function (v) { return Math.round(v).toString(); });
    animateValue(document.getElementById('statGrandTotal'), totals.actual, formatINR);

    const remainingEl = document.getElementById('statRemaining');
    animateValue(remainingEl, totals.remaining, formatINR);
    remainingEl.classList.toggle('danger', totals.remaining < 0);
    remainingEl.classList.toggle('success', totals.remaining >= 0);

    document.getElementById('sumMin').textContent = formatINR(totals.min);
    document.getElementById('sumMax').textContent = formatINR(totals.max);
    document.getElementById('sumActual').textContent = formatINR(totals.actual);

    const diffEl = document.getElementById('sumDifference');
    diffEl.textContent = (totals.difference > 0 ? '+' : '') + formatINR(totals.difference);

    document.getElementById('sumVariance').textContent = (totals.variancePct > 0 ? '+' : '') + totals.variancePct.toFixed(1) + '%';

    const remainSumEl = document.getElementById('sumRemaining');
    remainSumEl.textContent = formatINR(totals.remaining);
    remainSumEl.style.color = totals.remaining < 0 ? 'var(--danger)' : 'var(--orange)';

    if (window.WeddingCharts) window.WeddingCharts.render(categories);
    return totals;
  }

  // ---- Rendering: category cards ----
  function getVisibleCategories() {
    let list = categories.slice();

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(function (c) { return c.name.toLowerCase().indexOf(term) !== -1; });
    }

    switch (sortMode) {
      case 'name':
        list.sort(function (a, b) { return a.name.localeCompare(b.name); });
        break;
      case 'cost':
        list.sort(function (a, b) { return b.actual - a.actual; });
        break;
      case 'highest':
        list.sort(function (a, b) { return b.max - a.max; });
        break;
      case 'lowest':
        list.sort(function (a, b) { return a.min - b.min; });
        break;
      default:
        break; // keep original order
    }
    return list;
  }

  function cardTemplate(cat, index) {
    const overUnder = cat.actual > cat.max
      ? '<span class="over">₹' + Math.round(cat.actual - cat.max).toLocaleString('en-IN') + ' over estimate</span>'
      : (cat.actual < cat.min
        ? '<span class="under">₹' + Math.round(cat.min - cat.actual).toLocaleString('en-IN') + ' under estimate</span>'
        : '<span class="under">Within estimate</span>');

    return (
      '<article class="category-card reveal" data-id="' + cat.id + '" data-delay="' + index + '">' +
        '<div class="category-head">' +
          '<h3 class="category-name">' + cat.name + '</h3>' +
          '<span class="estimate-pill">' + formatRange(cat.min, cat.max) + '</span>' +
        '</div>' +
        '<p class="category-desc">' + cat.description + '</p>' +
        '<div class="field-row">' +
          '<div class="field actual">' +
            '<label for="actual-' + cat.id + '">Actual price</label>' +
            '<div class="input-prefix">' +
              '<input type="number" min="0" step="1000" id="actual-' + cat.id + '" data-field="actual" value="' + cat.actual + '" />' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="notes-' + cat.id + '">Notes</label>' +
            '<textarea id="notes-' + cat.id + '" data-field="notes" rows="1" placeholder="Optional note…">' + (cat.notes || '') + '</textarea>' +
          '</div>' +
        '</div>' +
        '<div class="category-foot">' + overUnder + '</div>' +
      '</article>'
    );
  }

  function renderList() {
    const visible = getVisibleCategories();
    if (!visible.length) {
      listEl.innerHTML = '<div class="empty-state">No categories match your search.</div>';
      return;
    }
    listEl.innerHTML = visible.map(cardTemplate).join('');
    // Trigger reveal animations for new cards
    requestAnimationFrame(function () {
      triggerReveals();
    });
  }

  function renderAll() {
    renderList();
    renderTotals();
  }

  // ---- Event delegation for card inputs ----
  listEl.addEventListener('input', function (e) {
    const field = e.target.getAttribute('data-field');
    if (!field) return;
    const card = e.target.closest('.category-card');
    const id = card.getAttribute('data-id');
    const cat = categories.find(function (c) { return c.id === id; });
    if (!cat) return;

    if (field === 'actual') {
      const val = parseFloat(e.target.value);
      cat.actual = isNaN(val) ? 0 : Math.max(0, val);
    } else if (field === 'notes') {
      cat.notes = e.target.value;
    }
    renderTotals(); // live recalculation, no page refresh
  });

  listEl.addEventListener('blur', function (e) {
    if (e.target.getAttribute('data-field') === 'actual' && e.target.value === '') {
      e.target.value = 0;
    }
  }, true);

  // ---- Toast ----
  let toastTimer;
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2800);
  }

  // ---- Save / Reset ----
  function validateAll() {
    return categories.every(function (c) {
      return typeof c.actual === 'number' && !isNaN(c.actual) && c.actual >= 0;
    });
  }

  saveBtn.addEventListener('click', function () {
    if (!validateAll()) {
      showToast('Please enter valid, non-negative amounts before saving.');
      return;
    }
    persistState();
    renderTotals();
    showToast('Wedding Budget Saved Successfully ✨');
  });

  resetBtn.addEventListener('click', function () {
    resetModal.classList.add('show');
  });

  resetCancel.addEventListener('click', function () {
    resetModal.classList.remove('show');
  });

  resetModal.addEventListener('click', function (e) {
    if (e.target === resetModal) resetModal.classList.remove('show');
  });

  resetConfirm.addEventListener('click', function () {
    categories = getDefaultState();
    localStorage.removeItem(STORAGE_KEY);
    resetModal.classList.remove('show');
    renderAll();
    showToast('Budget reset to defaults');
  });

  // ---- Search / Sort ----
  searchInput.addEventListener('input', function (e) {
    searchTerm = e.target.value;
    renderList();
  });

  sortSelect.addEventListener('change', function (e) {
    sortMode = e.target.value;
    renderList();
  });

  // ---- Dark mode ----
  themeToggle.addEventListener('click', function () {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(isDark ? 'light' : 'dark');
    renderTotals(); // refresh chart legend colours for new theme
  });

  // ---- Print ----
  printBtn.addEventListener('click', function () {
    window.print();
  });

  // ---- PDF ----
  pdfBtn.addEventListener('click', function () {
    const totals = computeTotals(categories);
    showToast('Preparing your PDF…');
    window.WeddingPDF.export(categories, {
      min: totals.min,
      max: totals.max,
      actual: totals.actual,
      difference: totals.difference,
      remaining: totals.remaining
    });
  });

  // ---- Scroll reveal animations ----
  function triggerReveals() {
    var reveals = document.querySelectorAll('.reveal:not(.visible)');
    reveals.forEach(function (el) {
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
      var rect = el.getBoundingClientRect();
      var windowH = window.innerHeight || document.documentElement.clientHeight;

      if (rect.top < windowH - 40) {
        setTimeout(function () {
          el.classList.add('visible');
        }, delay * 80);
      }
    });
  }

  window.addEventListener('scroll', triggerReveals, { passive: true });

  // ---- Init ----
  function init() {
    loadTheme();
    categories = loadState();
    renderAll();

    // Trigger initial reveal animations
    requestAnimationFrame(function () {
      triggerReveals();
    });

    // If Chart.js CDN hasn't loaded yet, retry once it does.
    if (typeof Chart === 'undefined') {
      var retryInterval = setInterval(function () {
        if (typeof Chart !== 'undefined') {
          clearInterval(retryInterval);
          renderTotals(); // triggers WeddingCharts.render()
        }
      }, 300);
      // Stop trying after 15 seconds
      setTimeout(function () { clearInterval(retryInterval); }, 15000);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
