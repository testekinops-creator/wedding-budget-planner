/**
 * charts.js
 * Creates and updates the three Chart.js visualisations:
 * category-wise pie, estimated-vs-actual bar, and expense-distribution doughnut.
 * Exposes window.WeddingCharts.render(categories) for script.js to call after
 * every save, search, or sort.
 */

(function () {
  var PALETTE = [
    '#F26A00', '#0A2545', '#C9A227', '#2E7D46', '#4A7FBE',
    '#C4342B', '#8A6D3B', '#3E7C8A', '#B25EA8', '#6E8B3D'
  ];

  var pieChart, barChart, doughnutChart;

  function currency(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function getLegendColor() {
    return getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#0A2545';
  }

  function baseOptions(extra) {
    return Object.assign({
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            font: { size: 11 },
            color: getLegendColor()
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
              return ctx.dataset.label
                ? ctx.dataset.label + ': ' + currency(val)
                : (ctx.label + ': ' + currency(val));
            }
          }
        }
      }
    }, extra || {});
  }

  /**
   * Show a fallback message inside a chart card when Chart.js is unavailable.
   */
  function showFallback(canvasEl, message) {
    var parent = canvasEl.parentElement;
    if (!parent) return;
    // Don't add duplicate fallbacks
    if (parent.querySelector('.chart-fallback')) return;
    var div = document.createElement('div');
    div.className = 'chart-fallback';
    div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:180px;color:rgba(10,37,69,0.4);font-size:13px;text-align:center;';
    div.textContent = message || 'Chart unavailable';
    canvasEl.style.display = 'none';
    parent.appendChild(div);
  }

  function render(categories) {
    var pieCtx = document.getElementById('pieChart');
    var barCtx = document.getElementById('barChart');
    var doughnutCtx = document.getElementById('doughnutChart');
    if (!pieCtx || !barCtx || !doughnutCtx) return;

    // Guard: Chart.js must be loaded
    if (typeof Chart === 'undefined') {
      showFallback(pieCtx, 'Loading charts…');
      showFallback(barCtx, 'Loading charts…');
      showFallback(doughnutCtx, 'Loading charts…');
      console.warn('Chart.js not loaded yet — charts will render once available.');
      return;
    }

    // Remove any fallback messages
    [pieCtx, barCtx, doughnutCtx].forEach(function (el) {
      el.style.display = '';
      var fb = el.parentElement && el.parentElement.querySelector('.chart-fallback');
      if (fb) fb.remove();
    });

    var labels = categories.map(function (c) { return c.name; });
    var actuals = categories.map(function (c) { return c.actual; });
    var minEstimates = categories.map(function (c) { return c.min; });
    var maxEstimates = categories.map(function (c) { return c.max; });
    var avgEstimates = categories.map(function (c, i) {
      return (minEstimates[i] + maxEstimates[i]) / 2;
    });

    // Pie: category-wise actual spending
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: actuals, backgroundColor: PALETTE, borderWidth: 0 }]
      },
      options: baseOptions()
    });

    // Bar: estimated (avg) vs actual
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Estimated', data: avgEstimates, backgroundColor: '#0A2545', borderRadius: 6 },
          { label: 'Actual', data: actuals, backgroundColor: '#F26A00', borderRadius: 6 }
        ]
      },
      options: baseOptions({
        scales: {
          x: { ticks: { display: false } },
          y: { ticks: { callback: function (v) { return '₹' + (v / 1000) + 'k'; } } }
        }
      })
    });

    // Doughnut: expense distribution
    if (doughnutChart) doughnutChart.destroy();
    doughnutChart = new Chart(doughnutCtx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: actuals, backgroundColor: PALETTE, borderWidth: 0 }]
      },
      options: baseOptions({ cutout: '62%' })
    });
  }

  window.WeddingCharts = { render: render };
})();
