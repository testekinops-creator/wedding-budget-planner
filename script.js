/**
 * script.js
 * Full Wedding Budget Planner — all premium features:
 * 1. Payment Tracker (advance/pending per category)
 * 2. Budget Health Score + Smart Insights
 * 3. Wedding Countdown Timer + Milestones
 * 4. Family Contribution Tracker
 * 5. Vendor Cards with Contact + Receipts
 * 6. Total Budget Target (P0)
 * 7. Auto-Save with indicator (P0)
 * 8. IndexedDB for receipts (P0)
 * 9. Export/Import JSON (P1)
 * 10. Custom Delete Modal (P1)
 * 11. Collapse/Expand All (P2)
 * 12. Search Results Count (P2)
 * 13. Keyboard Shortcuts (P2)
 * 14. Mobile FAB (P1)
 */

(function () {
  var STORAGE_KEY = 'weddingBudget:categories';
  var THEME_KEY = 'weddingBudget:theme';
  var DATE_KEY = 'weddingBudget:weddingDate';
  var MILESTONES_KEY = 'weddingBudget:milestones';
  var CONTRIBUTORS_KEY = 'weddingBudget:contributors';
  var BUDGET_KEY = 'weddingBudget:budgetTarget';

  var categories = [];
  var milestones = [];
  var contributors = [];
  var weddingDate = null;
  var budgetTarget = 0;
  var searchTerm = '';
  var sortMode = 'default';
  var countdownInterval = null;
  var allCollapsed = false;
  var autoSaveTimer = null;
  var lastSavedState = '';
  var deletingCatId = null;

  // ---- IndexedDB Receipt Store (P0) ----
  var ReceiptStore = (function () {
    var DB_NAME = 'weddingBudgetReceipts';
    var STORE_NAME = 'receipts';
    var DB_VERSION = 1;
    var dbPromise = null;

    function openDB() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function (e) { reject(e.target.error); };
      });
      return dbPromise;
    }

    function save(catId, base64Data) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(base64Data, catId);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function (e) { reject(e.target.error); };
        });
      });
    }

    function load(catId) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(catId);
          req.onsuccess = function () { resolve(req.result || ''); };
          req.onerror = function (e) { reject(e.target.error); };
        });
      });
    }

    function remove(catId) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(catId);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function (e) { reject(e.target.error); };
        });
      });
    }

    function getAll() {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var results = {};
          var req = store.openCursor();
          req.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              results[cursor.key] = cursor.value;
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          req.onerror = function (e) { reject(e.target.error); };
        });
      });
    }

    return { save: save, load: load, remove: remove, getAll: getAll };
  })();

  // ---- DOM refs ----
  var listEl = document.getElementById('categoryList');
  var searchInput = document.getElementById('searchInput');
  var sortSelect = document.getElementById('sortSelect');
  var themeToggle = document.getElementById('themeToggle');
  var sunIcon = document.getElementById('themeIconSun');
  var moonIcon = document.getElementById('themeIconMoon');
  var saveBtn = document.getElementById('saveBtn');
  var resetBtn = document.getElementById('resetBtn');
  var printBtn = document.getElementById('printBtn');
  var pdfBtn = document.getElementById('pdfBtn');
  var resetModal = document.getElementById('resetModal');
  var resetCancel = document.getElementById('resetCancel');
  var resetConfirm = document.getElementById('resetConfirm');
  var toast = document.getElementById('toast');
  var toastMessage = document.getElementById('toastMessage');

  // Countdown
  var countdownToggle = document.getElementById('countdownToggle');
  var countdownBanner = document.getElementById('countdownBanner');
  var dateModal = document.getElementById('dateModal');
  var dateCancel = document.getElementById('dateCancel');
  var dateSave = document.getElementById('dateSave');
  var dateClear = document.getElementById('dateClear');
  var weddingDateInput = document.getElementById('weddingDateInput');

  // Contributors
  var contributorModal = document.getElementById('contributorModal');
  var addContributorBtn = document.getElementById('addContributorBtn');
  var contribCancel = document.getElementById('contribCancel');
  var contribSave = document.getElementById('contribSave');
  var contributorNameInput = document.getElementById('contributorNameInput');

  // Add Category modal
  var categoryModal = document.getElementById('categoryModal');
  var addCategoryBtn = document.getElementById('addCategoryBtn');
  var catModalCancel = document.getElementById('catModalCancel');
  var catModalSave = document.getElementById('catModalSave');
  var newCatName = document.getElementById('newCatName');
  var newCatDesc = document.getElementById('newCatDesc');
  var newCatMin = document.getElementById('newCatMin');
  var newCatMax = document.getElementById('newCatMax');

  // Receipt lightbox
  var receiptLightbox = document.getElementById('receiptLightbox');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxImg = document.getElementById('lightboxImg');

  // Budget Target (P0)
  var budgetTargetInput = document.getElementById('budgetTargetInput');
  var budgetBarFill = document.getElementById('budgetBarFill');
  var budgetBarPct = document.getElementById('budgetBarPct');

  // Auto-save indicator (P0)
  var autosaveIndicator = document.getElementById('autosaveIndicator');
  var autosaveText = document.getElementById('autosaveText');

  // Delete modal (P1)
  var deleteModal = document.getElementById('deleteModal');
  var deleteModalText = document.getElementById('deleteModalText');
  var deleteCancel = document.getElementById('deleteCancel');
  var deleteConfirm = document.getElementById('deleteConfirm');

  // Export/Import (P1)
  var exportBtn = document.getElementById('exportBtn');
  var importBtn = document.getElementById('importBtn');
  var importFileInput = document.getElementById('importFileInput');

  // Collapse All (P2)
  var collapseAllBtn = document.getElementById('collapseAllBtn');
  var collapseAllLabel = document.getElementById('collapseAllLabel');

  // Search Count (P2)
  var searchCount = document.getElementById('searchCount');

  // Mobile FAB (P1)
  var fabSave = document.getElementById('fabSave');
  var fabPdf = document.getElementById('fabPdf');
  var fabPrint = document.getElementById('fabPrint');
  var fabTop = document.getElementById('fabTop');

  // ---- Formatting helpers ----
  function formatINR(n) {
    var rounded = Math.round(n || 0);
    var sign = rounded < 0 ? '-' : '';
    return sign + '₹' + Math.abs(rounded).toLocaleString('en-IN');
  }

  function formatRange(min, max) {
    return min === max ? formatINR(min) : formatINR(min) + ' – ' + formatINR(max);
  }

  function pct(part, total) {
    return total ? Math.round((part / total) * 100) : 0;
  }

  // ---- Persistence ----
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          // Backfill new fields for old saved data
          parsed.forEach(function (c) {
            if (c.paid === undefined) c.paid = 0;
            if (!c.contributor) c.contributor = '';
            if (!c.vendor) c.vendor = { name: '', phone: '', email: '', status: 'shortlisted' };
            if (c.receipt === undefined) c.receipt = '';
          });
          return parsed;
        }
      }
    } catch (e) {
      console.error('Could not read saved budget, using defaults.', e);
    }
    return getDefaultState();
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }

  function loadMilestones() {
    try {
      var raw = localStorage.getItem(MILESTONES_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* ignore */ }
    return getDefaultMilestones();
  }

  function persistMilestones() {
    localStorage.setItem(MILESTONES_KEY, JSON.stringify(milestones));
  }

  function loadContributors() {
    try {
      var raw = localStorage.getItem(CONTRIBUTORS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* ignore */ }
    return getDefaultContributors();
  }

  function persistContributors() {
    localStorage.setItem(CONTRIBUTORS_KEY, JSON.stringify(contributors));
  }

  function loadWeddingDate() {
    var saved = localStorage.getItem(DATE_KEY);
    if (saved) {
      var d = new Date(saved);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  function persistWeddingDate() {
    if (weddingDate) {
      localStorage.setItem(DATE_KEY, weddingDate.toISOString());
    } else {
      localStorage.removeItem(DATE_KEY);
    }
  }

  // Budget Target persistence (P0)
  function loadBudgetTarget() {
    var saved = localStorage.getItem(BUDGET_KEY);
    return saved ? (parseFloat(saved) || 0) : 0;
  }

  function persistBudgetTarget() {
    localStorage.setItem(BUDGET_KEY, String(budgetTarget));
  }

  // ---- Auto-Save (P0) ----
  function markUnsaved() {
    if (autosaveIndicator) {
      autosaveIndicator.className = 'autosave-indicator unsaved';
      autosaveText.textContent = 'Unsaved changes';
    }
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () {
      autoSave();
    }, 2000);
  }

  function autoSave() {
    if (autosaveIndicator) {
      autosaveIndicator.className = 'autosave-indicator saving';
      autosaveText.textContent = 'Saving…';
    }
    persistState();
    persistMilestones();
    persistContributors();
    persistBudgetTarget();
    lastSavedState = JSON.stringify(categories);
    setTimeout(function () {
      if (autosaveIndicator) {
        autosaveIndicator.className = 'autosave-indicator';
        autosaveText.textContent = 'All changes saved';
      }
    }, 600);
  }

  // Migrate old base64 receipts from localStorage/categories to IndexedDB
  function migrateReceipts() {
    var migrated = false;
    var promises = [];
    categories.forEach(function (c) {
      if (c.receipt && c.receipt.indexOf('data:') === 0) {
        // Old base64 receipt — move to IndexedDB
        promises.push(
          ReceiptStore.save(c.id, c.receipt).then(function () {
            c.receipt = 'idb:' + c.id;
            migrated = true;
          })
        );
      }
    });
    if (promises.length > 0) {
      Promise.all(promises).then(function () {
        if (migrated) persistState();
      }).catch(function (err) {
        console.error('Receipt migration failed:', err);
      });
    }
  }

  function loadTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var theme = saved === 'dark' ? 'dark' : 'light';
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
    var totals = cats.reduce(function (acc, c) {
      acc.min += Number(c.min) || 0;
      acc.max += Number(c.max) || 0;
      acc.actual += Number(c.actual) || 0;
      acc.paid += Number(c.paid) || 0;
      return acc;
    }, { min: 0, max: 0, actual: 0, paid: 0 });

    totals.estimatedAvg = (totals.min + totals.max) / 2;
    totals.difference = totals.actual - totals.estimatedAvg;
    totals.remaining = budgetTarget > 0 ? budgetTarget - totals.actual : totals.max - totals.actual;
    totals.pending = totals.actual - totals.paid;
    totals.variancePct = totals.estimatedAvg ? (totals.difference / totals.estimatedAvg) * 100 : 0;
    totals.utilizedPct = totals.actual ? (totals.paid / totals.actual) * 100 : 0;
    totals.budgetTarget = budgetTarget;
    totals.count = cats.length;
    return totals;
  }

  // ---- Budget Health Score (Feature 2) ----
  function computeHealthScore(cats, totals) {
    if (!cats.length) return { score: 0, label: 'No data', color: '#888' };

    var score = 100;

    // Penalty for being over estimate
    cats.forEach(function (c) {
      var catMax = Number(c.max) || 0;
      var catActual = Number(c.actual) || 0;
      if (catActual > catMax && catMax > 0) {
        var overPct = ((catActual - catMax) / catMax) * 100;
        score -= Math.min(overPct * 0.5, 15); // max 15 points per category
      }
    });

    // Penalty for overall over-budget
    if (totals.actual > totals.max && totals.max > 0) {
      var overallPct = ((totals.actual - totals.max) / totals.max) * 100;
      score -= Math.min(overallPct * 0.8, 20);
    }

    // Bonus for having payments tracked
    var withPayments = cats.filter(function (c) { return (Number(c.paid) || 0) > 0; }).length;
    var paymentRatio = withPayments / cats.length;
    score += paymentRatio * 5; // up to 5 bonus points

    // Bonus for being under budget
    if (totals.actual <= totals.estimatedAvg && totals.estimatedAvg > 0) {
      score += 5;
    }

    // Penalty for categories with zero actual (data not entered)
    var zeroActual = cats.filter(function (c) { return (Number(c.actual) || 0) === 0; }).length;
    score -= zeroActual * 2;

    score = Math.max(0, Math.min(100, Math.round(score)));

    var label, color;
    if (score >= 90) { label = 'Excellent'; color = '#2E7D46'; }
    else if (score >= 70) { label = 'Good'; color = '#C9A227'; }
    else if (score >= 50) { label = 'Caution'; color = '#F26A00'; }
    else { label = 'Alert'; color = '#C4342B'; }

    return { score: score, label: label, color: color };
  }

  // ── SVG icon helpers (consistent: 16×16, stroke 1.8, round caps) ──
  var SVG = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-5.6 11.2L12 22l5.6-8.8A7 7 0 0 0 12 2z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-4.4 0-8-3.6-8-8 0-5 4-8 6-10 .7 2.3 3 4 4.5 4.5C16 9 18 11 18 14c0 4.4-2.7 8-6 8z"/><path d="M12 22c-1.7 0-3-1.8-3-4 0-2 1.5-3 2-4 .3 1 1.3 2 2 2 .7 0 2 1 2 2s-1.3 4-3 4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.2 1.6 18a2 2 0 0 0 1.7 3h17.4a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.1 10.3A6 6 0 0 1 16 21.7"/><path d="M14 11.5a6 6 0 0 1 4 5.7"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5H18l-3.7 2.8 1.4 4.5L12 12l-3.7 2.8 1.4-4.5L6 7.5h4.5z"/></svg>',
    vendor: '<svg class="vendor-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8M8 11h6M8 15h4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.4 2.1L8 9.7a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.7a2 2 0 0 1 1.7 2z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
  };

  function generateInsights(cats, totals) {
    var insights = [];

    // Find biggest category
    var sorted = cats.slice().sort(function (a, b) { return (b.actual || 0) - (a.actual || 0); });
    if (sorted.length && totals.actual > 0) {
      var biggest = sorted[0];
      var bigPct = pct(biggest.actual, totals.actual);
      insights.push({
        icon: SVG.pin,
        text: biggest.name + ' is your biggest spend at ' + bigPct + '% of total budget.'
      });
    }

    // Over-estimate categories
    cats.forEach(function (c) {
      var catMax = Number(c.max) || 0;
      var catActual = Number(c.actual) || 0;
      if (catActual > catMax && catMax > 0) {
        var overAmt = catActual - catMax;
        insights.push({
          icon: SVG.flame,
          text: c.name + ' is ' + formatINR(overAmt) + ' over estimate — consider trimming.'
        });
      }
    });

    // Under-estimate (savings)
    cats.forEach(function (c) {
      var catMin = Number(c.min) || 0;
      var catActual = Number(c.actual) || 0;
      if (catActual < catMin && catActual > 0 && catMin > 0) {
        var savings = catMin - catActual;
        insights.push({
          icon: SVG.check,
          text: c.name + ' is ' + formatINR(savings) + ' under estimate — great saving!'
        });
      }
    });

    // Unpaid warning
    var unpaid = cats.filter(function (c) { return (Number(c.actual) || 0) > 0 && (Number(c.paid) || 0) === 0; });
    if (unpaid.length > 0) {
      insights.push({
        icon: SVG.warning,
        text: unpaid.length + ' categor' + (unpaid.length === 1 ? 'y has' : 'ies have') + ' actual costs but no payments recorded.'
      });
    }

    // Zero actual categories
    var zeroActual = cats.filter(function (c) { return (Number(c.actual) || 0) === 0; });
    if (zeroActual.length > 0) {
      insights.push({
        icon: SVG.edit,
        text: zeroActual.length + ' categor' + (zeroActual.length === 1 ? 'y has' : 'ies have') + ' no actual cost entered — update for accuracy.'
      });
    }

    // Overall budget status
    if (totals.remaining < 0) {
      insights.push({
        icon: SVG.alert,
        text: 'You are ' + formatINR(Math.abs(totals.remaining)) + ' over your maximum budget!'
      });
    } else if (totals.remaining > 0 && totals.actual > 0) {
      insights.push({
        icon: SVG.coins,
        text: 'You have ' + formatINR(totals.remaining) + ' remaining in your budget.'
      });
    }

    if (insights.length === 0) {
      insights.push({ icon: SVG.sparkle, text: 'Your budget looks great! Keep tracking as you finalize vendors.' });
    }

    return insights.slice(0, 6); // max 6 insights
  }

  function renderHealthScore(cats, totals) {
    var health = computeHealthScore(cats, totals);
    var gaugeArc = document.getElementById('gaugeArc');
    var gaugeScoreText = document.getElementById('gaugeScoreText');
    var gaugeLabelText = document.getElementById('gaugeLabelText');
    var totalDash = 251.3;
    var offset = totalDash - (health.score / 100) * totalDash;

    gaugeArc.style.transition = 'stroke-dashoffset 1s ease-out';
    gaugeArc.setAttribute('stroke-dashoffset', offset);
    gaugeScoreText.textContent = health.score;
    gaugeLabelText.textContent = health.label;

    // Render insights
    var insights = generateInsights(cats, totals);
    var insightsList = document.getElementById('insightsList');
    insightsList.innerHTML = insights.map(function (ins) {
      return '<div class="insight-item"><div class="insight-icon">' + ins.icon + '</div><span>' + ins.text + '</span></div>';
    }).join('');
  }

  // ---- Animated counters ----
  var counterState = new WeakMap();
  function animateValue(el, toValue, formatter) {
    var from = counterState.get(el) || 0;
    var duration = 600;
    var start = performance.now();

    function step(now) {
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = from + (toValue - from) * eased;
      el.textContent = formatter(current);
      if (progress < 1) requestAnimationFrame(step);
      else counterState.set(el, toValue);
    }
    requestAnimationFrame(step);
  }

  // ---- Colour-grading helper ----
  function applyColorGrade(el, value, opts) {
    // Remove all grading classes first
    el.classList.remove('val-positive', 'val-negative', 'val-warning', 'val-info', 'val-neutral');
    if (!opts) opts = {};

    if (opts.mode === 'remaining') {
      el.classList.add(value < 0 ? 'val-negative' : value > 0 ? 'val-positive' : 'val-neutral');
    } else if (opts.mode === 'difference') {
      el.classList.add(value > 0 ? 'val-negative' : value < 0 ? 'val-positive' : 'val-neutral');
    } else if (opts.mode === 'paid') {
      el.classList.add(value > 0 ? 'val-positive' : 'val-neutral');
    } else if (opts.mode === 'pending') {
      el.classList.add(value > 0 ? 'val-warning' : 'val-positive');
    } else if (opts.mode === 'variance') {
      el.classList.add(value > 5 ? 'val-negative' : value < -5 ? 'val-positive' : 'val-info');
    } else if (opts.mode === 'utilized') {
      el.classList.add(value >= 80 ? 'val-positive' : value >= 40 ? 'val-warning' : 'val-info');
    } else {
      el.classList.add('val-neutral');
    }
  }

  function applyStatCardAccent(cardEl, cls) {
    if (!cardEl) return;
    cardEl.classList.remove('accent-green', 'accent-red', 'accent-amber', 'accent-blue', 'accent-orange');
    cardEl.classList.add(cls);
  }

  // ---- Rendering: dashboard + summary ----
  function renderTotals() {
    var totals = computeTotals(categories);

    // Dashboard stat cards
    animateValue(document.getElementById('statEstimated'), totals.estimatedAvg, formatINR);
    animateValue(document.getElementById('statActual'), totals.actual, formatINR);
    animateValue(document.getElementById('statPaid'), totals.paid, formatINR);
    animateValue(document.getElementById('statPending'), Math.max(0, totals.pending), formatINR);

    var remainingEl = document.getElementById('statRemaining');
    animateValue(remainingEl, totals.remaining, formatINR);
    remainingEl.classList.toggle('danger', totals.remaining < 0);
    remainingEl.classList.toggle('success', totals.remaining >= 0);

    // Stat card accent borders
    var statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 5) {
      applyStatCardAccent(statCards[0], 'accent-blue');     // Estimated
      applyStatCardAccent(statCards[1], 'accent-orange');   // Actual
      applyStatCardAccent(statCards[2], totals.remaining < 0 ? 'accent-red' : 'accent-green'); // Remaining
      applyStatCardAccent(statCards[3], totals.paid > 0 ? 'accent-green' : 'accent-amber');   // Paid
      applyStatCardAccent(statCards[4], totals.pending > 0 ? 'accent-amber' : 'accent-green'); // Pending
    }

    // Budget Target bar (P0)
    renderBudgetBar(totals);

    // Summary panel — estimates
    var sumMinEl = document.getElementById('sumMin');
    sumMinEl.textContent = formatINR(totals.min);
    applyColorGrade(sumMinEl, 0, { mode: 'utilized' });

    var sumMaxEl = document.getElementById('sumMax');
    sumMaxEl.textContent = formatINR(totals.max);
    applyColorGrade(sumMaxEl, 0, { mode: 'utilized' });

    var sumActualEl = document.getElementById('sumActual');
    sumActualEl.textContent = formatINR(totals.actual);
    // Actual: red if over max, green if under min, amber if in range
    var refMax = budgetTarget > 0 ? budgetTarget : totals.max;
    if (totals.actual > refMax) {
      sumActualEl.classList.remove('val-positive', 'val-warning', 'val-info', 'val-neutral');
      sumActualEl.classList.add('val-negative');
    } else if (totals.actual <= totals.min) {
      sumActualEl.classList.remove('val-negative', 'val-warning', 'val-info', 'val-neutral');
      sumActualEl.classList.add('val-positive');
    } else {
      sumActualEl.classList.remove('val-positive', 'val-negative', 'val-info', 'val-neutral');
      sumActualEl.classList.add('val-warning');
    }

    // Difference
    var diffEl = document.getElementById('sumDifference');
    diffEl.textContent = (totals.difference > 0 ? '+' : '') + formatINR(totals.difference);
    applyColorGrade(diffEl, totals.difference, { mode: 'difference' });

    // Variance
    var varianceEl = document.getElementById('sumVariance');
    varianceEl.textContent = (totals.variancePct > 0 ? '+' : '') + totals.variancePct.toFixed(1) + '%';
    applyColorGrade(varianceEl, totals.variancePct, { mode: 'variance' });

    // Payment summary
    var sumPaidEl = document.getElementById('sumPaid');
    sumPaidEl.textContent = formatINR(totals.paid);
    applyColorGrade(sumPaidEl, totals.paid, { mode: 'paid' });

    var sumPendingEl = document.getElementById('sumPending');
    sumPendingEl.textContent = formatINR(Math.max(0, totals.pending));
    applyColorGrade(sumPendingEl, totals.pending, { mode: 'pending' });

    // Utilized
    var sumUtilEl = document.getElementById('sumUtilized');
    sumUtilEl.textContent = totals.utilizedPct.toFixed(1) + '%';
    applyColorGrade(sumUtilEl, totals.utilizedPct, { mode: 'utilized' });

    // Remaining
    var remainSumEl = document.getElementById('sumRemaining');
    remainSumEl.textContent = formatINR(totals.remaining);
    remainSumEl.style.color = '';
    applyColorGrade(remainSumEl, totals.remaining, { mode: 'remaining' });

    // Health score
    renderHealthScore(categories, totals);

    // Charts
    if (window.WeddingCharts) window.WeddingCharts.render(categories);

    // Contributions
    renderContributions();

    return totals;
  }

  // ---- Budget Target Bar (P0) ----
  function renderBudgetBar(totals) {
    if (!budgetBarFill || !budgetBarPct) return;
    if (budgetTarget <= 0) {
      budgetBarFill.style.width = '0%';
      budgetBarPct.textContent = 'Set a budget above';
      budgetBarFill.className = 'budget-target-bar-fill';
      return;
    }
    var pctSpent = Math.round((totals.actual / budgetTarget) * 100);
    var barWidth = Math.min(pctSpent, 100);
    budgetBarFill.style.width = barWidth + '%';

    if (pctSpent > 100) {
      budgetBarPct.textContent = pctSpent + '% spent (' + formatINR(totals.actual - budgetTarget) + ' over)';
      budgetBarFill.className = 'budget-target-bar-fill over-budget';
    } else if (pctSpent > 80) {
      budgetBarPct.textContent = pctSpent + '% spent';
      budgetBarFill.className = 'budget-target-bar-fill warning';
    } else {
      budgetBarPct.textContent = pctSpent + '% spent';
      budgetBarFill.className = 'budget-target-bar-fill';
    }
  }

  // ---- Rendering: category cards (with payment tracker + vendor + receipts) ----
  function getVisibleCategories() {
    var list = categories.slice();

    if (searchTerm.trim()) {
      var term = searchTerm.trim().toLowerCase();
      list = list.filter(function (c) {
        return c.name.toLowerCase().indexOf(term) !== -1 ||
               (c.vendor && c.vendor.name && c.vendor.name.toLowerCase().indexOf(term) !== -1);
      });
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
      case 'paid':
        list.sort(function (a, b) { return (b.paid || 0) - (a.paid || 0); });
        break;
      case 'unpaid':
        list.sort(function (a, b) { return (a.paid || 0) - (b.paid || 0); });
        break;
      default:
        break;
    }
    return list;
  }

  function paymentStatusBadge(cat) {
    var actual = Number(cat.actual) || 0;
    var paid = Number(cat.paid) || 0;
    if (actual === 0) return '<span class="pay-badge pay-na">—</span>';
    if (paid >= actual) return '<span class="pay-badge pay-full">Fully Paid</span>';
    if (paid > 0) return '<span class="pay-badge pay-partial">Partial</span>';
    return '<span class="pay-badge pay-unpaid">Unpaid</span>';
  }

  function paymentProgressBar(cat) {
    var actual = Number(cat.actual) || 0;
    var paid = Number(cat.paid) || 0;
    var perc = actual > 0 ? Math.min(100, Math.round((paid / actual) * 100)) : 0;
    var barClass = perc >= 100 ? 'bar-full' : (perc > 0 ? 'bar-partial' : 'bar-zero');
    return (
      '<div class="pay-progress">' +
        '<div class="pay-bar">' +
          '<div class="pay-bar-fill ' + barClass + '" style="width:' + perc + '%"></div>' +
        '</div>' +
        '<span class="pay-pct">' + perc + '% paid</span>' +
      '</div>'
    );
  }

  // Live-update badge, progress bar, estimate pill, and footer on a card (no full re-render)
  function updateCardVisuals(card, cat) {
    // Badge
    var badgeEl = card.querySelector('.pay-badge');
    if (badgeEl) {
      var newBadge = document.createElement('span');
      newBadge.innerHTML = paymentStatusBadge(cat);
      var newSpan = newBadge.querySelector('.pay-badge');
      if (newSpan) {
        badgeEl.className = newSpan.className;
        badgeEl.textContent = newSpan.textContent;
      }
    }
    // Progress bar
    var progWrap = card.querySelector('.pay-progress');
    if (progWrap) {
      progWrap.outerHTML = paymentProgressBar(cat);
    }
    // Estimate pill
    var pill = card.querySelector('.estimate-pill');
    if (pill) {
      pill.textContent = formatRange(cat.min, cat.max);
    }
    // Footer over/under
    var foot = card.querySelector('.category-foot');
    if (foot) {
      if (cat.actual > cat.max) {
        foot.innerHTML = '<span class="over">' + formatINR(Math.round(cat.actual - cat.max)) + ' over estimate</span>';
      } else if (cat.actual < cat.min) {
        foot.innerHTML = '<span class="under">' + formatINR(Math.round(cat.min - cat.actual)) + ' under estimate</span>';
      } else {
        foot.innerHTML = '<span class="under">Within estimate</span>';
      }
    }
  }

  function contributorDropdown(cat) {
    var opts = '<option value="">— Select —</option>';
    contributors.forEach(function (name) {
      var selected = cat.contributor === name ? ' selected' : '';
      opts += '<option value="' + name + '"' + selected + '>' + name + '</option>';
    });
    return (
      '<div class="field contributor-field">' +
        '<label for="contrib-' + cat.id + '">Paid by</label>' +
        '<select id="contrib-' + cat.id + '" data-field="contributor" class="contrib-select">' + opts + '</select>' +
      '</div>'
    );
  }

  function vendorStatusOpts(current) {
    var statuses = ['shortlisted', 'booked', 'finalized', 'cancelled'];
    return statuses.map(function (s) {
      return '<option value="' + s + '"' + (current === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
    }).join('');
  }

  function cardTemplate(cat, index) {
    var overUnder = cat.actual > cat.max
      ? '<span class="over">₹' + Math.round(cat.actual - cat.max).toLocaleString('en-IN') + ' over estimate</span>'
      : (cat.actual < cat.min
        ? '<span class="under">₹' + Math.round(cat.min - cat.actual).toLocaleString('en-IN') + ' under estimate</span>'
        : '<span class="under">Within estimate</span>');

    var vendorName = cat.vendor ? (cat.vendor.name || '') : '';
    var vendorPhone = cat.vendor ? (cat.vendor.phone || '') : '';
    var vendorEmail = cat.vendor ? (cat.vendor.email || '') : '';
    var vendorStatus = cat.vendor ? (cat.vendor.status || 'shortlisted') : 'shortlisted';

    var receiptThumb = '';
    if (cat.receipt) {
      receiptThumb = '<div class="receipt-thumb" data-id="' + cat.id + '"><img src="' + cat.receipt + '" alt="Receipt" /><span>View receipt</span></div>';
    }

    return (
      '<article class="category-card reveal" data-id="' + cat.id + '" data-delay="' + (index % 4) + '">' +
        '<div class="category-head">' +
          '<h3 class="category-name">' + cat.name + '</h3>' +
          '<div class="category-head-right">' +
            paymentStatusBadge(cat) +
            '<span class="estimate-pill">' + formatRange(cat.min, cat.max) + '</span>' +
            '<button class="card-delete-btn" data-id="' + cat.id + '" title="Delete category">' + SVG.trash + '</button>' +
            '<button class="card-toggle-btn" title="Expand / Collapse">' + SVG.chevron + '</button>' +
          '</div>' +
        '</div>' +

        '<div class="card-body">' +
          '<p class="category-desc">' + cat.description + '</p>' +

          // Payment tracker row
          '<div class="field-row field-row-3">' +
            '<div class="field actual">' +
              '<label for="actual-' + cat.id + '">Actual price</label>' +
              '<div class="input-prefix">' +
                '<input type="number" min="0" step="1000" id="actual-' + cat.id + '" data-field="actual" value="' + cat.actual + '" />' +
              '</div>' +
            '</div>' +
            '<div class="field paid-field">' +
              '<label for="paid-' + cat.id + '">Amount paid</label>' +
              '<div class="input-prefix">' +
                '<input type="number" min="0" step="1000" id="paid-' + cat.id + '" data-field="paid" value="' + (cat.paid || 0) + '" />' +
              '</div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="notes-' + cat.id + '">Notes</label>' +
              '<textarea id="notes-' + cat.id + '" data-field="notes" rows="1" placeholder="Optional note…">' + (cat.notes || '') + '</textarea>' +
            '</div>' +
          '</div>' +

          // Editable estimated budget
          '<div class="field-row">' +
            '<div class="field">' +
              '<label for="min-' + cat.id + '">Min estimate</label>' +
              '<div class="input-prefix">' +
                '<input type="number" min="0" step="1000" id="min-' + cat.id + '" data-field="min" value="' + cat.min + '" />' +
              '</div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="max-' + cat.id + '">Max estimate</label>' +
              '<div class="input-prefix">' +
                '<input type="number" min="0" step="1000" id="max-' + cat.id + '" data-field="max" value="' + cat.max + '" />' +
              '</div>' +
            '</div>' +
          '</div>' +

          paymentProgressBar(cat) +

          // Contributor dropdown (Feature 4)
          contributorDropdown(cat) +

          // Vendor details expandable (Feature 5)
          '<details class="vendor-details">' +
            '<summary class="vendor-toggle">' + SVG.vendor + ' Vendor Details' + (vendorName ? ' — <strong>' + vendorName + '</strong>' : '') + '</summary>' +
            '<div class="vendor-grid">' +
              '<div class="field"><label for="vname-' + cat.id + '">Vendor name</label>' +
                '<input type="text" id="vname-' + cat.id + '" data-field="vendor.name" value="' + vendorName + '" placeholder="Name" /></div>' +
              '<div class="field"><label for="vphone-' + cat.id + '">Phone</label>' +
                '<input type="text" id="vphone-' + cat.id + '" data-field="vendor.phone" value="' + vendorPhone + '" placeholder="Phone" />' +
                (vendorPhone ? '<a href="tel:' + vendorPhone + '" class="vendor-call-link">' + SVG.phone + ' Call</a>' : '') +
              '</div>' +
              '<div class="field"><label for="vemail-' + cat.id + '">Email</label>' +
                '<input type="text" id="vemail-' + cat.id + '" data-field="vendor.email" value="' + vendorEmail + '" placeholder="Email" /></div>' +
              '<div class="field"><label for="vstatus-' + cat.id + '">Status</label>' +
                '<select id="vstatus-' + cat.id + '" data-field="vendor.status">' + vendorStatusOpts(vendorStatus) + '</select></div>' +
            '</div>' +
            '<div class="vendor-receipt-row">' +
              '<label class="receipt-upload-btn">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>' +
                (cat.receipt ? 'Replace Receipt' : 'Upload Receipt') +
                '<input type="file" accept="image/*" data-field="receipt" class="receipt-input" style="display:none" />' +
              '</label>' +
              receiptThumb +
            '</div>' +
          '</details>' +

          '<div class="category-foot">' + overUnder + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderList() {
    var visible = getVisibleCategories();

    // Update search count (P2)
    updateSearchCount(visible.length, categories.length);

    if (!visible.length) {
      listEl.innerHTML = '<div class="empty-state">No categories match your search.</div>';
      return;
    }
    listEl.innerHTML = visible.map(cardTemplate).join('');
    requestAnimationFrame(function () { triggerReveals(); });
  }

  function renderAll() {
    renderList();
    renderTotals();
    renderMilestones();
    renderContributorTags();
  }

  // ---- Search Count (P2) ----
  function updateSearchCount(shown, total) {
    if (!searchCount) return;
    if (searchTerm.trim()) {
      searchCount.textContent = shown + ' of ' + total;
      searchCount.classList.add('visible');
    } else {
      searchCount.classList.remove('visible');
    }
  }

  // ---- Event delegation for card inputs ----
  listEl.addEventListener('input', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var card = e.target.closest('.category-card');
    var id = card.getAttribute('data-id');
    var cat = categories.find(function (c) { return c.id === id; });
    if (!cat) return;

    if (field === 'actual') {
      var val = parseFloat(e.target.value);
      cat.actual = isNaN(val) ? 0 : Math.max(0, val);
    } else if (field === 'paid') {
      var val2 = parseFloat(e.target.value);
      cat.paid = isNaN(val2) ? 0 : Math.max(0, val2);
    } else if (field === 'min') {
      var val3 = parseFloat(e.target.value);
      cat.min = isNaN(val3) ? 0 : Math.max(0, val3);
    } else if (field === 'max') {
      var val4 = parseFloat(e.target.value);
      cat.max = isNaN(val4) ? 0 : Math.max(0, val4);
    } else if (field === 'notes') {
      cat.notes = e.target.value;
    } else if (field === 'contributor') {
      cat.contributor = e.target.value;
    } else if (field.indexOf('vendor.') === 0) {
      var vField = field.split('.')[1];
      if (!cat.vendor) cat.vendor = {};
      cat.vendor[vField] = e.target.value;
    }

    // Live-update visuals on the card (badge, progress, pill, footer)
    if (field === 'actual' || field === 'paid' || field === 'min' || field === 'max') {
      updateCardVisuals(card, cat);
    }
    renderTotals();
    markUnsaved(); // P0: trigger auto-save
  });

  // Handle change events (selects)
  listEl.addEventListener('change', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var card = e.target.closest('.category-card');
    var id = card.getAttribute('data-id');
    var cat = categories.find(function (c) { return c.id === id; });
    if (!cat) return;

    if (field === 'contributor') {
      cat.contributor = e.target.value;
      renderContributions();
    } else if (field.indexOf('vendor.') === 0) {
      var vField = field.split('.')[1];
      if (!cat.vendor) cat.vendor = {};
      cat.vendor[vField] = e.target.value;
    }
  });

  // Receipt upload (P0: uses IndexedDB)
  listEl.addEventListener('change', function (e) {
    if (!e.target.classList.contains('receipt-input')) return;
    var card = e.target.closest('.category-card');
    var id = card.getAttribute('data-id');
    var cat = categories.find(function (c) { return c.id === id; });
    if (!cat || !e.target.files || !e.target.files[0]) return;

    var file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast('Receipt image must be under 5 MB.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var base64Data = ev.target.result;
      // Store in IndexedDB instead of localStorage
      ReceiptStore.save(id, base64Data).then(function () {
        cat.receipt = 'idb:' + id;
        renderList();
        showToast('Receipt uploaded ✓');
        markUnsaved();
      }).catch(function (err) {
        console.error('Failed to save receipt:', err);
        // Fallback: store inline (old behavior)
        cat.receipt = base64Data;
        renderList();
        showToast('Receipt uploaded (local) ✓');
        markUnsaved();
      });
    };
    reader.readAsDataURL(file);
  });

  // Receipt lightbox (P0: loads from IndexedDB)
  listEl.addEventListener('click', function (e) {
    var thumb = e.target.closest('.receipt-thumb');
    if (!thumb) return;
    var id = thumb.getAttribute('data-id');
    var cat = categories.find(function (c) { return c.id === id; });
    if (!cat || !cat.receipt) return;

    if (cat.receipt.indexOf('idb:') === 0) {
      // Load from IndexedDB
      ReceiptStore.load(id).then(function (data) {
        if (data) {
          lightboxImg.src = data;
          receiptLightbox.classList.add('show');
        } else {
          showToast('Receipt not found.');
        }
      });
    } else {
      lightboxImg.src = cat.receipt;
      receiptLightbox.classList.add('show');
    }
  });

  lightboxClose.addEventListener('click', function () {
    receiptLightbox.classList.remove('show');
  });
  receiptLightbox.addEventListener('click', function (e) {
    if (e.target === receiptLightbox) receiptLightbox.classList.remove('show');
  });

  // Card collapse/expand toggle
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.card-toggle-btn');
    if (!btn) return;
    var card = btn.closest('.category-card');
    if (card) {
      card.classList.toggle('collapsed');
      // After collapsing, cards below may enter the viewport — trigger reveal
      setTimeout(function () { triggerReveals(); }, 350);
    }
  });

  // ---- Delete Category (P1: Custom Modal) ----
  listEl.addEventListener('click', function (e) {
    var delBtn = e.target.closest('.card-delete-btn');
    if (!delBtn) return;
    e.stopPropagation();
    var catId = delBtn.getAttribute('data-id');
    var cat = categories.find(function (c) { return c.id === catId; });
    if (!cat) return;

    // Show custom delete modal instead of confirm()
    deletingCatId = catId;
    deleteModalText.textContent = 'Delete "' + cat.name + '"? This will also remove any linked milestones. This action cannot be undone.';
    deleteModal.classList.add('show');
  });

  // Delete modal handlers
  deleteCancel.addEventListener('click', function () {
    deleteModal.classList.remove('show');
    deletingCatId = null;
  });

  deleteModal.addEventListener('click', function (e) {
    if (e.target === deleteModal) {
      deleteModal.classList.remove('show');
      deletingCatId = null;
    }
  });

  deleteConfirm.addEventListener('click', function () {
    deleteModal.classList.remove('show');
    if (!deletingCatId) return;

    var catId = deletingCatId;
    var cat = categories.find(function (c) { return c.id === catId; });
    var catName = cat ? cat.name : 'Category';
    deletingCatId = null;

    // Animate card removal
    var card = listEl.querySelector('.category-card[data-id="' + catId + '"]');
    if (card) {
      card.style.transition = 'all 0.35s ease';
      card.style.transform = 'scale(0.95) translateX(30px)';
      card.style.opacity = '0';
    }

    setTimeout(function () {
      // Remove receipt from IndexedDB
      ReceiptStore.remove(catId).catch(function () {});

      // Remove category
      categories = categories.filter(function (c) { return c.id !== catId; });

      // Remove orphaned milestones linked to this category
      milestones = milestones.filter(function (ms) { return ms.categoryId !== catId; });
      persistMilestones();

      // Re-render everything
      renderAll();
      showToast('"' + catName + '" deleted');
      markUnsaved();
    }, 350);
  });

  listEl.addEventListener('blur', function (e) {
    if (e.target.getAttribute('data-field') === 'actual' && e.target.value === '') {
      e.target.value = 0;
    }
    if (e.target.getAttribute('data-field') === 'paid' && e.target.value === '') {
      e.target.value = 0;
    }
  }, true);

  // ---- Milestones (Feature 3) ----
  function getCategoryNameById(catId) {
    if (!catId) return '';
    var cat = categories.find(function (c) { return c.id === catId; });
    return cat ? cat.name : '';
  }

  function renderMilestones() {
    var el = document.getElementById('milestoneTimeline');
    if (!el) return;
    el.innerHTML = milestones.map(function (ms, i) {
      var cls = ms.done ? 'milestone done' : 'milestone';
      var catName = getCategoryNameById(ms.categoryId);
      var catTag = catName
        ? '<span class="milestone-cat-tag" title="Linked to: ' + catName + '">' + catName + '</span>'
        : '';

      return (
        '<div class="' + cls + '" data-ms-index="' + i + '">' +
          '<div class="milestone-dot"></div>' +
          '<div class="milestone-content">' +
            '<div class="milestone-label-wrap">' +
              '<label class="milestone-label">' +
                '<input type="checkbox" ' + (ms.done ? 'checked' : '') + ' class="ms-checkbox" data-ms-index="' + i + '" /> ' +
                '<span>' + ms.label + '</span>' +
              '</label>' +
              catTag +
            '</div>' +
            '<div class="milestone-actions">' +
              '<button class="ms-action-btn ms-edit-btn" data-ms-index="' + i + '" title="Edit">' +
                SVG.edit +
              '</button>' +
              '<button class="ms-action-btn ms-delete-btn" data-ms-index="' + i + '" title="Delete">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  // Milestone timeline: checkbox toggle
  document.getElementById('milestoneTimeline').addEventListener('change', function (e) {
    if (!e.target.classList.contains('ms-checkbox')) return;
    var idx = parseInt(e.target.getAttribute('data-ms-index'), 10);
    if (milestones[idx]) {
      milestones[idx].done = e.target.checked;
      persistMilestones();
      renderMilestones();
    }
  });

  // Milestone timeline: edit + delete click
  document.getElementById('milestoneTimeline').addEventListener('click', function (e) {
    var editBtn = e.target.closest('.ms-edit-btn');
    if (editBtn) {
      var idx = parseInt(editBtn.getAttribute('data-ms-index'), 10);
      openMilestoneModal('edit', idx);
      return;
    }
    var deleteBtn = e.target.closest('.ms-delete-btn');
    if (deleteBtn) {
      var delIdx = parseInt(deleteBtn.getAttribute('data-ms-index'), 10);
      if (milestones[delIdx]) {
        milestones.splice(delIdx, 1);
        persistMilestones();
        renderMilestones();
        showToast('Milestone removed.');
      }
    }
  });

  // ---- Countdown Timer (Feature 3) ----
  function startCountdown() {
    stopCountdown();
    if (!weddingDate || isNaN(weddingDate.getTime())) {
      countdownBanner.style.display = 'none';
      return;
    }
    countdownBanner.style.display = '';
    var dateStr = weddingDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('countdownDate').textContent = dateStr;

    function tick() {
      var now = new Date();
      var diff = weddingDate.getTime() - now.getTime();
      if (diff <= 0) {
        document.getElementById('cdDays').textContent = '00';
        document.getElementById('cdHours').textContent = '';
        document.getElementById('cdMinutes').textContent = '';
        document.getElementById('cdSeconds').textContent = '';
        document.getElementById('countdownDate').textContent = 'Today is the day! Congratulations!';
        stopCountdown();
        return;
      }
      var days = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((diff % (1000 * 60)) / 1000);
      document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
      document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
      document.getElementById('cdMinutes').textContent = String(minutes).padStart(2, '0');
      document.getElementById('cdSeconds').textContent = String(seconds).padStart(2, '0');
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  // Date modal
  countdownToggle.addEventListener('click', function () {
    if (weddingDate) {
      weddingDateInput.value = weddingDate.toISOString().split('T')[0];
    }
    dateModal.classList.add('show');
  });

  dateCancel.addEventListener('click', function () {
    dateModal.classList.remove('show');
  });

  dateModal.addEventListener('click', function (e) {
    if (e.target === dateModal) dateModal.classList.remove('show');
  });

  dateSave.addEventListener('click', function () {
    var val = weddingDateInput.value;
    if (!val) { showToast('Please select a date.'); return; }
    weddingDate = new Date(val + 'T00:00:00');
    persistWeddingDate();
    startCountdown();
    dateModal.classList.remove('show');
    showToast('Wedding date set!');
  });

  dateClear.addEventListener('click', function () {
    weddingDate = null;
    persistWeddingDate();
    stopCountdown();
    countdownBanner.style.display = 'none';
    dateModal.classList.remove('show');
    showToast('Wedding date cleared.');
  });

  // ---- Family Contributions (Feature 4) ----
  function renderContributions() {
    var contribData = {};
    contributors.forEach(function (name) { contribData[name] = 0; });
    var unassigned = 0;

    categories.forEach(function (c) {
      var actual = Number(c.actual) || 0;
      if (c.contributor && contribData.hasOwnProperty(c.contributor)) {
        contribData[c.contributor] += actual;
      } else {
        unassigned += actual;
      }
    });

    var totalActual = categories.reduce(function (sum, c) { return sum + (Number(c.actual) || 0); }, 0);
    var barsEl = document.getElementById('contributionBars');

    var colors = ['#F26A00', '#0A2545', '#C9A227', '#2E7D46', '#4A7FBE', '#B25EA8', '#8A6D3B', '#3E7C8A'];
    var html = '';
    var chartLabels = [];
    var chartData = [];
    var chartColors = [];
    var i = 0;

    contributors.forEach(function (name) {
      var amount = contribData[name] || 0;
      var perc = totalActual ? Math.round((amount / totalActual) * 100) : 0;
      var color = colors[i % colors.length];
      html += '<div class="contrib-bar-row">' +
        '<span class="contrib-name">' + name + '</span>' +
        '<div class="contrib-bar-track"><div class="contrib-bar-fill" style="width:' + perc + '%;background:' + color + '"></div></div>' +
        '<span class="contrib-amount">' + formatINR(amount) + ' (' + perc + '%)</span>' +
      '</div>';
      chartLabels.push(name);
      chartData.push(amount);
      chartColors.push(color);
      i++;
    });

    if (unassigned > 0) {
      var uPerc = totalActual ? Math.round((unassigned / totalActual) * 100) : 0;
      html += '<div class="contrib-bar-row">' +
        '<span class="contrib-name" style="opacity:0.5">Unassigned</span>' +
        '<div class="contrib-bar-track"><div class="contrib-bar-fill" style="width:' + uPerc + '%;background:#999"></div></div>' +
        '<span class="contrib-amount" style="opacity:0.5">' + formatINR(unassigned) + ' (' + uPerc + '%)</span>' +
      '</div>';
      chartLabels.push('Unassigned');
      chartData.push(unassigned);
      chartColors.push('#999');
    }

    barsEl.innerHTML = html;

    // Update contribution chart
    if (window.WeddingCharts && window.WeddingCharts.renderContributions) {
      window.WeddingCharts.renderContributions(chartLabels, chartData, chartColors);
    }
  }

  function renderContributorTags() {
    var tagsEl = document.getElementById('contributorTags');
    tagsEl.innerHTML = contributors.map(function (name, i) {
      return '<span class="contrib-tag">' + name +
        '<button class="contrib-tag-remove" data-contrib-index="' + i + '" title="Remove">&times;</button>' +
      '</span>';
    }).join('');
  }

  // Contributor tag removal
  document.getElementById('contributorTags').addEventListener('click', function (e) {
    if (!e.target.classList.contains('contrib-tag-remove')) return;
    var idx = parseInt(e.target.getAttribute('data-contrib-index'), 10);
    if (idx >= 0 && idx < contributors.length) {
      var removed = contributors[idx];
      // Clear contributor from categories that had it
      categories.forEach(function (c) {
        if (c.contributor === removed) c.contributor = '';
      });
      contributors.splice(idx, 1);
      persistContributors();
      renderAll();
      showToast('Contributor removed.');
    }
  });

  // Add contributor modal
  addContributorBtn.addEventListener('click', function () {
    contributorNameInput.value = '';
    contributorModal.classList.add('show');
    setTimeout(function () { contributorNameInput.focus(); }, 100);
  });

  contribCancel.addEventListener('click', function () {
    contributorModal.classList.remove('show');
  });

  contributorModal.addEventListener('click', function (e) {
    if (e.target === contributorModal) contributorModal.classList.remove('show');
  });

  contribSave.addEventListener('click', function () {
    var name = contributorNameInput.value.trim();
    if (!name) { showToast('Please enter a name.'); return; }
    if (contributors.indexOf(name) !== -1) { showToast('Contributor already exists.'); return; }
    contributors.push(name);
    persistContributors();
    contributorModal.classList.remove('show');
    renderAll();
    showToast('Contributor "' + name + '" added ✓');
  });

  // ---- Add Category modal ----
  addCategoryBtn.addEventListener('click', function () {
    newCatName.value = '';
    newCatDesc.value = '';
    newCatMin.value = '';
    newCatMax.value = '';
    categoryModal.classList.add('show');
    setTimeout(function () { newCatName.focus(); }, 100);
  });

  catModalCancel.addEventListener('click', function () {
    categoryModal.classList.remove('show');
  });

  categoryModal.addEventListener('click', function (e) {
    if (e.target === categoryModal) categoryModal.classList.remove('show');
  });

  catModalSave.addEventListener('click', function () {
    var name = newCatName.value.trim();
    if (!name) { showToast('Please enter a category name.'); return; }
    var desc = newCatDesc.value.trim() || '';
    var minVal = parseFloat(newCatMin.value) || 0;
    var maxVal = parseFloat(newCatMax.value) || 0;
    if (maxVal < minVal) maxVal = minVal;

    var newCat = {
      id: 'custom-' + Date.now(),
      name: name,
      description: desc,
      min: minVal,
      max: maxVal,
      actual: 0,
      paid: 0,
      notes: '',
      contributor: '',
      vendor: null,
      receipt: null
    };
    categories.push(newCat);

    // Auto-create a milestone linked to this new category
    milestones.push({
      id: 'ms-' + newCat.id,
      label: 'Finalize ' + name,
      done: false,
      categoryId: newCat.id
    });
    persistMilestones();

    categoryModal.classList.remove('show');
    renderAll();
    showToast('Category "' + name + '" added ✓');
  });

  // ---- Add / Edit Milestone modal ----
  var milestoneModal = document.getElementById('milestoneModal');
  var msModalTitle = document.getElementById('msModalTitle');
  var msLabelInput = document.getElementById('msLabelInput');
  var msCategorySelect = document.getElementById('msCategorySelect');
  var msModalCancel = document.getElementById('msModalCancel');
  var msModalSave = document.getElementById('msModalSave');
  var addMilestoneBtn = document.getElementById('addMilestoneBtn');
  var editingMsIndex = -1; // -1 = adding, >= 0 = editing

  function populateMsCategoryDropdown(selectedCatId) {
    var opts = '<option value="">\u2014 None \u2014</option>';
    categories.forEach(function (c) {
      var sel = (c.id === selectedCatId) ? ' selected' : '';
      opts += '<option value="' + c.id + '"' + sel + '>' + c.name + '</option>';
    });
    msCategorySelect.innerHTML = opts;
  }

  function openMilestoneModal(mode, index) {
    editingMsIndex = (mode === 'edit' && index >= 0) ? index : -1;

    if (editingMsIndex >= 0) {
      // Edit mode
      var ms = milestones[editingMsIndex];
      msModalTitle.textContent = 'Edit Milestone';
      msModalSave.textContent = 'Save Changes';
      msLabelInput.value = ms.label;
      populateMsCategoryDropdown(ms.categoryId || '');
    } else {
      // Add mode
      msModalTitle.textContent = 'Add Milestone';
      msModalSave.textContent = 'Add Milestone';
      msLabelInput.value = '';
      populateMsCategoryDropdown('');
    }

    milestoneModal.classList.add('show');
    setTimeout(function () { msLabelInput.focus(); }, 100);
  }

  addMilestoneBtn.addEventListener('click', function () {
    openMilestoneModal('add', -1);
  });

  msModalCancel.addEventListener('click', function () {
    milestoneModal.classList.remove('show');
  });

  milestoneModal.addEventListener('click', function (e) {
    if (e.target === milestoneModal) milestoneModal.classList.remove('show');
  });

  msModalSave.addEventListener('click', function () {
    var label = msLabelInput.value.trim();
    if (!label) { showToast('Please enter a milestone name.'); return; }
    var catId = msCategorySelect.value || null;

    if (editingMsIndex >= 0 && milestones[editingMsIndex]) {
      // Edit existing
      milestones[editingMsIndex].label = label;
      milestones[editingMsIndex].categoryId = catId;
      showToast('Milestone updated ✓');
    } else {
      // Add new
      milestones.push({
        id: 'ms-custom-' + Date.now(),
        label: label,
        done: false,
        categoryId: catId
      });
      showToast('Milestone "' + label + '" added ✓');
    }

    persistMilestones();
    milestoneModal.classList.remove('show');
    renderMilestones();
  });

  // ---- Toast ----
  var toastTimer;
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

  function doSave() {
    if (!validateAll()) {
      showToast('Please enter valid, non-negative amounts before saving.');
      return;
    }
    persistState();
    persistMilestones();
    persistContributors();
    persistBudgetTarget();
    lastSavedState = JSON.stringify(categories);
    if (autosaveIndicator) {
      autosaveIndicator.className = 'autosave-indicator';
      autosaveText.textContent = 'All changes saved';
    }
    renderTotals();
    showToast('Wedding Budget Saved Successfully');
  }

  saveBtn.addEventListener('click', doSave);

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
    milestones = getDefaultMilestones();
    contributors = getDefaultContributors();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MILESTONES_KEY);
    localStorage.removeItem(CONTRIBUTORS_KEY);
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

  // ---- Budget Target Input (P0) ----
  budgetTargetInput.addEventListener('input', function (e) {
    var val = parseFloat(e.target.value);
    budgetTarget = isNaN(val) ? 0 : Math.max(0, val);
    renderTotals();
    markUnsaved();
  });

  // ---- Collapse / Expand All (P2) ----
  collapseAllBtn.addEventListener('click', function () {
    allCollapsed = !allCollapsed;
    var cards = listEl.querySelectorAll('.category-card');
    cards.forEach(function (card) {
      if (allCollapsed) {
        card.classList.add('collapsed');
      } else {
        card.classList.remove('collapsed');
      }
    });
    collapseAllLabel.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
    collapseAllBtn.classList.toggle('expanded', allCollapsed);
    setTimeout(function () { triggerReveals(); }, 350);
  });

  // ---- Export JSON (P1) ----
  exportBtn.addEventListener('click', function () {
    var exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      categories: categories,
      milestones: milestones,
      contributors: contributors,
      budgetTarget: budgetTarget,
      weddingDate: weddingDate ? weddingDate.toISOString() : null
    };

    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'wedding-budget-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Budget exported as JSON ✓');
  });

  // ---- Import JSON (P1) ----
  importBtn.addEventListener('click', function () {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data.categories || !Array.isArray(data.categories)) {
          showToast('Invalid budget file — missing categories.');
          return;
        }

        // Validate and import
        categories = data.categories;
        categories.forEach(function (c) {
          if (c.paid === undefined) c.paid = 0;
          if (!c.contributor) c.contributor = '';
          if (!c.vendor) c.vendor = { name: '', phone: '', email: '', status: 'shortlisted' };
          if (c.receipt === undefined) c.receipt = '';
        });

        if (data.milestones && Array.isArray(data.milestones)) {
          milestones = data.milestones;
        }
        if (data.contributors && Array.isArray(data.contributors)) {
          contributors = data.contributors;
        }
        if (data.budgetTarget !== undefined) {
          budgetTarget = parseFloat(data.budgetTarget) || 0;
          budgetTargetInput.value = budgetTarget > 0 ? budgetTarget : '';
        }
        if (data.weddingDate) {
          var d = new Date(data.weddingDate);
          if (!isNaN(d.getTime())) {
            weddingDate = d;
            persistWeddingDate();
            startCountdown();
          }
        }

        renderAll();
        autoSave();
        showToast('Budget imported successfully ✓');
      } catch (err) {
        console.error('Import error:', err);
        showToast('Failed to import — invalid JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    importFileInput.value = '';
  });

  // ---- Mobile FAB (P1) ----
  if (fabSave) fabSave.addEventListener('click', doSave);
  if (fabPdf) fabPdf.addEventListener('click', function () { pdfBtn.click(); });
  if (fabPrint) fabPrint.addEventListener('click', function () { window.print(); });
  if (fabTop) fabTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---- Keyboard Shortcuts (P2) ----
  document.addEventListener('keydown', function (e) {
    // Ctrl+S — Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      doSave();
    }
    // Ctrl+Z — Undo (restore last saved state)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (lastSavedState) {
        try {
          var restored = JSON.parse(lastSavedState);
          if (Array.isArray(restored)) {
            categories = restored;
            renderAll();
            showToast('Reverted to last saved state');
          }
        } catch (err) { /* ignore */ }
      }
    }
    // Escape — Close any open modal
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.show').forEach(function (m) {
        m.classList.remove('show');
      });
      if (receiptLightbox.classList.contains('show')) {
        receiptLightbox.classList.remove('show');
      }
    }
  });

  // ---- Dark mode ----
  themeToggle.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(isDark ? 'light' : 'dark');
    renderTotals();
  });

  // ---- Print ----
  printBtn.addEventListener('click', function () {
    window.print();
  });

  // ---- PDF ----
  pdfBtn.addEventListener('click', function () {
    var totals = computeTotals(categories);
    showToast('Preparing your PDF…');
    window.WeddingPDF.export(categories, {
      min: totals.min,
      max: totals.max,
      actual: totals.actual,
      paid: totals.paid,
      pending: Math.max(0, totals.pending),
      difference: totals.difference,
      remaining: totals.remaining,
      budgetTarget: budgetTarget
    }, contributors);
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
  window.addEventListener('resize', triggerReveals, { passive: true });

  // ---- Init ----
  function init() {
    loadTheme();
    categories = loadState();
    milestones = loadMilestones();
    contributors = loadContributors();
    weddingDate = loadWeddingDate();
    budgetTarget = loadBudgetTarget();

    // Set budget input value
    if (budgetTarget > 0) {
      budgetTargetInput.value = budgetTarget;
    }

    // Save initial state for undo
    lastSavedState = JSON.stringify(categories);

    // Migrate old base64 receipts to IndexedDB
    migrateReceipts();

    renderAll();
    startCountdown();

    requestAnimationFrame(function () { triggerReveals(); });

    if (typeof Chart === 'undefined') {
      var retryInterval = setInterval(function () {
        if (typeof Chart !== 'undefined') {
          clearInterval(retryInterval);
          renderTotals();
        }
      }, 300);
      setTimeout(function () { clearInterval(retryInterval); }, 15000);
    }

    // Auto-save indicator: mark as saved on init
    if (autosaveIndicator) {
      autosaveIndicator.className = 'autosave-indicator';
      autosaveText.textContent = 'All changes saved';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
