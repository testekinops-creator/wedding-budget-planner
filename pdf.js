/**
 * pdf.js
 * Builds a premium PDF export using jsPDF + jspdf-autotable.
 * Includes: budget table, payment summary, vendor info, family contributions.
 * Exposes window.WeddingPDF.export(categories, totals, contributors).
 */

(function () {
  /* ── Helpers ────────────────────────────────────────────── */
  function sanitize(str) {
    if (!str) return '';
    return str
      .replace(/₹/g, 'Rs.')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/[^\x00-\xFF]/g, '');
  }

  function inr(n) {
    return 'Rs. ' + Math.round(n).toLocaleString('en-IN');
  }

  /* ── Colour palette ────────────────────────────────────── */
  var C = {
    navy:       [10, 37, 69],
    navyLight:  [18, 52, 95],
    gold:       [201, 162, 39],
    goldSoft:   [253, 245, 225],
    orange:     [242, 106, 0],
    white:      [255, 255, 255],
    offWhite:   [248, 249, 252],
    lightGray:  [235, 238, 244],
    midGray:    [160, 168, 180],
    darkText:   [10, 37, 69],
    greenBg:    [232, 245, 233],
    greenText:  [27, 94, 32],
    redBg:      [253, 232, 232],
    redText:    [183, 28, 28],
    blueBg:     [227, 242, 253],
    blueText:   [13, 71, 161],
    cream:      [255, 251, 240]
  };

  /* ── Drawing utilities ─────────────────────────────────── */
  function drawRoundedRect(doc, x, y, w, h, r, fillColor, strokeColor) {
    if (fillColor) { doc.setFillColor.apply(doc, fillColor); }
    if (strokeColor) {
      doc.setDrawColor.apply(doc, strokeColor);
      doc.setLineWidth(0.6);
    }
    var mode = fillColor && strokeColor ? 'FD' : fillColor ? 'F' : 'S';
    doc.roundedRect(x, y, w, h, r, r, mode);
  }

  function goldAccentLine(doc, x, y, w) {
    doc.setDrawColor.apply(doc, C.gold);
    doc.setLineWidth(2);
    doc.line(x, y, x + w, y);
  }

  function sectionTitle(doc, text, x, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, C.navy);
    doc.text(text, x, y);
    goldAccentLine(doc, x, y + 5, 50);
    return y + 24;
  }

  /* ── Main Export ───────────────────────────────────────── */
  async function exportPdf(categories, totals, contributors) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'a4' });
    var pw  = doc.internal.pageSize.getWidth();   // ~595
    var ph  = doc.internal.pageSize.getHeight();   // ~842
    var mx  = 40;
    var usable = pw - mx * 2;
    var today = new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    /* ============================================================
       PAGE 1  –  Header · Summary · Budget Table · Contributions
       ============================================================ */

    // ── Elegant header band ──
    doc.setFillColor.apply(doc, C.navy);
    doc.rect(0, 0, pw, 82, 'F');

    // Gold accent strip at bottom of header
    doc.setFillColor.apply(doc, C.gold);
    doc.rect(0, 82, pw, 3, 'F');

    // Title
    doc.setTextColor.apply(doc, C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Wedding Budget Planner', mx, 38);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(210, 220, 230);
    doc.text('Generated on ' + today, mx, 58);

    // Right-side decorative label
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, C.gold);
    doc.text('BUDGET REPORT', pw - mx, 38, { align: 'right' });

    // ── Budget Summary ── (inside a card)
    var sy = 105;
    var cardH = 114;
    drawRoundedRect(doc, mx, sy, usable, cardH, 6, C.offWhite, C.lightGray);

    // Card heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, C.navy);
    doc.text('Budget Summary', mx + 16, sy + 22);

    // Gold mini-line under heading
    goldAccentLine(doc, mx + 16, sy + 28, 40);

    // Summary rows
    var summaryLeft = [
      ['Minimum Estimate', inr(totals.min)],
      ['Maximum Estimate', inr(totals.max)],
      ['Actual Budget', inr(totals.actual)]
    ];
    var summaryRight = [
      ['Total Paid', inr(totals.paid || 0)],
      ['Total Pending', inr(totals.pending || 0)],
      ['Remaining', inr(totals.remaining)]
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    var ry = sy + 46;
    var colLeft = mx + 16;
    var colMid = mx + usable / 2 + 10;

    // Divider line between columns
    doc.setDrawColor.apply(doc, C.lightGray);
    doc.setLineWidth(0.5);
    doc.line(mx + usable / 2, sy + 36, mx + usable / 2, sy + cardH - 12);

    summaryLeft.forEach(function (row, i) {
      doc.setTextColor(80, 90, 105);
      doc.text(row[0], colLeft, ry + i * 18);
      doc.setTextColor.apply(doc, C.navy);
      doc.setFont('helvetica', 'bold');
      doc.text(row[1], colLeft + 190, ry + i * 18, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });

    summaryRight.forEach(function (row, i) {
      doc.setTextColor(80, 90, 105);
      doc.text(row[0], colMid, ry + i * 18);
      doc.setTextColor.apply(doc, C.navy);
      doc.setFont('helvetica', 'bold');
      doc.text(row[1], colMid + 190, ry + i * 18, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });

    // Difference vs estimate – highlight chip
    var diffVal = totals.difference;
    var diffBg   = diffVal >= 0 ? C.greenBg : C.redBg;
    var diffTxt  = diffVal >= 0 ? C.greenText : C.redText;
    var chipY = sy + cardH - 22;
    drawRoundedRect(doc, mx + usable - 195, chipY - 8, 180, 18, 4, diffBg, null);
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, diffTxt);
    doc.setFont('helvetica', 'bold');
    doc.text('Diff vs. Estimate: ' + inr(Math.abs(diffVal)) + (diffVal >= 0 ? ' over' : ' under'), mx + usable - 190, chipY + 3);
    doc.setFont('helvetica', 'normal');

    // ── Budget Breakdown Table ──
    var ty = sy + cardH + 24;
    ty = sectionTitle(doc, 'Budget Breakdown', mx, ty);

    var body = categories.map(function (c) {
      var vendorName   = (c.vendor && c.vendor.name) ? sanitize(c.vendor.name) : '-';
      var vendorStatus = (c.vendor && c.vendor.status)
        ? c.vendor.status.charAt(0).toUpperCase() + c.vendor.status.slice(1)
        : '-';
      return [
        sanitize(c.name),
        inr(c.min),
        inr(c.max),
        inr(c.actual),
        inr(c.paid || 0),
        sanitize(c.contributor || '-'),
        vendorName,
        vendorStatus
      ];
    });

    doc.autoTable({
      startY: ty,
      margin: { left: mx, right: mx },
      head: [['Category', 'Min', 'Max', 'Actual', 'Paid', 'Paid By', 'Vendor', 'Status']],
      body: body,
      foot: [['Grand Total', inr(totals.min), inr(totals.max), inr(totals.actual), inr(totals.paid || 0), '', '', '']],
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
        textColor: C.darkText,
        lineColor: [220, 225, 232],
        lineWidth: 0.3,
        overflow: 'linebreak',
        valign: 'middle',
        font: 'helvetica'
      },
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 6, right: 4, bottom: 6, left: 4 }
      },
      footStyles: {
        fillColor: C.goldSoft,
        textColor: C.navy,
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [245, 247, 252]
      },
      columnStyles: {
        0: { cellWidth: 82, fontStyle: 'bold' },
        1: { cellWidth: 56, halign: 'right' },
        2: { cellWidth: 56, halign: 'right' },
        3: { cellWidth: 62, halign: 'right' },
        4: { cellWidth: 56, halign: 'right' },
        5: { cellWidth: 55 },
        6: { cellWidth: 70 },
        7: { cellWidth: 48 }
      },
      didParseCell: function (data) {
        // Grand Total row styling
        if (data.section === 'foot' && data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;
        }
        // Status column colour badges
        if (data.section === 'body' && data.column.index === 7) {
          var val = (data.cell.raw || '').toLowerCase();
          if (val === 'booked' || val === 'confirmed') {
            data.cell.styles.textColor = C.greenText;
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'shortlisted') {
            data.cell.styles.textColor = C.blueText;
          }
        }
      },
      didDrawCell: function (data) {
        // Gold left-border on category name cells
        if (data.section === 'body' && data.column.index === 0) {
          doc.setFillColor.apply(doc, C.gold);
          doc.rect(data.cell.x, data.cell.y, 2, data.cell.height, 'F');
        }
      }
    });

    // ── Family Contributions ──
    if (contributors && contributors.length) {
      var cy = doc.lastAutoTable.finalY + 28;

      // Check if enough space, else new page
      if (cy > ph - 160) {
        doc.addPage();
        cy = 60;
      }

      cy = sectionTitle(doc, 'Family Contributions', mx, cy);

      // Build contribution data
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

      // Contribution rows inside a mini card
      var contribItems = contributors.map(function (name) {
        return [sanitize(name), contribData[name] || 0];
      });
      if (unassigned > 0) {
        contribItems.push(['Unassigned', unassigned]);
      }

      var contribCardH = contribItems.length * 22 + 16;
      drawRoundedRect(doc, mx, cy - 6, usable, contribCardH, 5, C.cream, C.lightGray);

      var ciy = cy + 10;
      contribItems.forEach(function (item, idx) {
        var isUnassigned = item[0] === 'Unassigned';

        // Alternating subtle row background
        if (idx % 2 === 0 && !isUnassigned) {
          doc.setFillColor(255, 248, 232);
          doc.rect(mx + 2, ciy - 10, usable - 4, 20, 'F');
        }

        // Gold dot indicator
        doc.setFillColor.apply(doc, isUnassigned ? C.midGray : C.gold);
        doc.circle(mx + 16, ciy - 3, 3, 'F');

        // Label
        doc.setFontSize(9.5);
        doc.setFont('helvetica', isUnassigned ? 'italic' : 'normal');
        doc.setTextColor.apply(doc, isUnassigned ? C.midGray : C.navy);
        doc.text(item[0], mx + 26, ciy);

        // Amount
        doc.setFont('helvetica', 'bold');
        doc.setTextColor.apply(doc, C.navy);
        doc.text(inr(item[1]), mx + usable - 16, ciy, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        ciy += 22;
      });
    }

    /* ============================================================
       PAGE 2  –  Charts Snapshot
       ============================================================ */
    var chartsSection = document.querySelector('.charts-section');
    if (chartsSection && window.html2canvas) {
      try {
        var canvasElements = chartsSection.querySelectorAll('canvas');
        var hasContent = false;
        canvasElements.forEach(function (c) {
          if (c.width > 0 && c.height > 0) hasContent = true;
        });

        if (hasContent) {
          var canvas = await html2canvas(chartsSection, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
          });
          var imgData = canvas.toDataURL('image/png');
          var imgWidth = pw - mx * 2;
          var imgHeight = (canvas.height / canvas.width) * imgWidth;

          doc.addPage();

          // Header band for charts page
          doc.setFillColor.apply(doc, C.navy);
          doc.rect(0, 0, pw, 58, 'F');
          doc.setFillColor.apply(doc, C.gold);
          doc.rect(0, 58, pw, 3, 'F');

          doc.setTextColor.apply(doc, C.white);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text('Spending at a Glance', mx, 37);

          doc.setFontSize(9);
          doc.setTextColor.apply(doc, C.gold);
          doc.text('VISUAL OVERVIEW', pw - mx, 37, { align: 'right' });

          var maxImgH = ph - 58 - 3 - mx - 40;
          if (imgHeight > maxImgH) imgHeight = maxImgH;

          // Light card background for chart area
          drawRoundedRect(doc, mx - 5, 72, usable + 10, imgHeight + 20, 6, [252, 252, 255], C.lightGray);

          doc.addImage(imgData, 'PNG', mx, 82, imgWidth, imgHeight);
        }
      } catch (err) {
        console.error('Could not capture charts for PDF:', err);
      }
    }

    /* ============================================================
       FOOTER  –  Every page
       ============================================================ */
    var pageCount = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      var h = doc.internal.pageSize.getHeight();

      // Footer separator
      doc.setDrawColor.apply(doc, C.lightGray);
      doc.setLineWidth(0.5);
      doc.line(mx, h - 36, pw - mx, h - 36);

      // Gold mini-accent in footer
      doc.setDrawColor.apply(doc, C.gold);
      doc.setLineWidth(1.5);
      doc.line(mx, h - 36, mx + 30, h - 36);

      // Footer text
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, C.midGray);
      doc.setFont('helvetica', 'normal');
      doc.text('Wedding Budget Planner', mx, h - 22);

      // Page number in a pill
      var pageStr = 'Page ' + i + ' of ' + pageCount;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      var pgWidth = doc.getTextWidth(pageStr) + 14;
      drawRoundedRect(doc, pw - mx - pgWidth, h - 32, pgWidth, 16, 4, C.offWhite, C.lightGray);
      doc.setTextColor.apply(doc, C.navy);
      doc.text(pageStr, pw - mx - pgWidth / 2, h - 22, { align: 'center' });
    }

    doc.save('Wedding-Budget-' + new Date().toISOString().slice(0, 10) + '.pdf');
  }

  window.WeddingPDF = { export: exportPdf };
})();
