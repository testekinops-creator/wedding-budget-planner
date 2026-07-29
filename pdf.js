/**
 * pdf.js
 * Builds a professional PDF export using jsPDF + jspdf-autotable for the
 * budget table, and html2canvas to embed a snapshot of the live charts.
 * Exposes window.WeddingPDF.export(categories, totals).
 */

(function () {
  /**
   * Sanitise a string so it only contains characters that jsPDF's built-in
   * Helvetica (WinAnsiEncoding) can render.  Replaces:
   *   ₹  →  Rs.
   *   –  →  -   (en-dash)
   *   —  →  -   (em-dash)
   *   '  →  '   (curly quotes)
   *   "  →  "
   *   …  →  ...
   * Any remaining non-Latin1 character is dropped.
   */
  function sanitize(str) {
    if (!str) return '';
    return str
      .replace(/₹/g, 'Rs.')
      .replace(/[\u2013\u2014]/g, '-')   // en-dash / em-dash
      .replace(/[\u2018\u2019]/g, "'")   // curly single quotes
      .replace(/[\u201C\u201D]/g, '"')   // curly double quotes
      .replace(/\u2026/g, '...')         // ellipsis
      .replace(/[^\x00-\xFF]/g, '');     // drop anything outside Latin-1
  }

  function inr(n) {
    return 'Rs. ' + Math.round(n).toLocaleString('en-IN');
  }

  async function exportPdf(categories, totals) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'a4' });
    var pageWidth = doc.internal.pageSize.getWidth();   // ~595
    var pageHeight = doc.internal.pageSize.getHeight();  // ~842
    var margin = 40;
    var usable = pageWidth - margin * 2;                 // ~515
    var today = new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // ---- Header band ----
    doc.setFillColor(10, 37, 69);
    doc.rect(0, 0, pageWidth, 78, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Wedding Budget Planner', margin, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(230, 230, 230);
    doc.text('Generated on ' + today, margin, 52);
    doc.setDrawColor(242, 106, 0);
    doc.setLineWidth(2);
    doc.line(margin, 66, pageWidth - margin, 66);

    // ---- Budget Summary strip ----
    var y = 100;
    doc.setTextColor(10, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Budget Summary', margin, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);

    var summaryLines = [
      ['Minimum estimate', inr(totals.min)],
      ['Maximum estimate', inr(totals.max)],
      ['Actual budget', inr(totals.actual)],
      ['Difference vs. estimate', inr(totals.difference)],
      ['Remaining budget', inr(totals.remaining)]
    ];

    summaryLines.forEach(function (row) {
      doc.text(row[0], margin, y);
      doc.text(row[1], pageWidth - margin, y, { align: 'right' });
      y += 16;
    });
    y += 12;

    // ---- Budget table ----
    var body = categories.map(function (c) {
      return [
        sanitize(c.name),
        sanitize(c.description || ''),
        inr(c.min),
        inr(c.max),
        inr(c.actual),
        sanitize(c.notes || '')
      ];
    });

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Description', 'Min', 'Max', 'Actual', 'Notes']],
      body: body,
      foot: [['Grand Total', '', inr(totals.min), inr(totals.max), inr(totals.actual), '']],
      styles: {
        fontSize: 8,
        cellPadding: 5,
        textColor: [10, 37, 69],
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
        overflow: 'linebreak',
        valign: 'top'
      },
      headStyles: {
        fillColor: [10, 37, 69],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      footStyles: {
        fillColor: [253, 238, 224],
        textColor: [10, 37, 69],
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 140 },
        2: { cellWidth: 60, halign: 'right' },
        3: { cellWidth: 60, halign: 'right' },
        4: { cellWidth: 60, halign: 'right' },
        5: { cellWidth: usable - 80 - 140 - 60 - 60 - 60 }  // remainder (~115)
      },
      didParseCell: function (data) {
        // Bold the grand total label
        if (data.section === 'foot' && data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
        }
      }
    });

    // ---- Charts snapshot on a new page ----
    var chartsSection = document.querySelector('.charts-section');
    if (chartsSection && window.html2canvas) {
      try {
        // Ensure charts have rendered content
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
          var imgWidth = pageWidth - margin * 2;
          var imgHeight = (canvas.height / canvas.width) * imgWidth;

          doc.addPage();

          // Header on chart page
          doc.setFillColor(10, 37, 69);
          doc.rect(0, 0, pageWidth, 50, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text('Spending at a Glance', margin, 32);

          // Clip the image height so it doesn't overflow the page
          var maxImgHeight = pageHeight - 50 - margin - 40; // leave room for footer
          if (imgHeight > maxImgHeight) imgHeight = maxImgHeight;

          doc.addImage(imgData, 'PNG', margin, 60, imgWidth, imgHeight);
        }
      } catch (err) {
        console.error('Could not capture charts for PDF:', err);
      }
    }

    // ---- Footer + page numbers on every page ----
    var pageCount = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      var h = doc.internal.pageSize.getHeight();
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margin, h - 34, pageWidth - margin, h - 34);
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text('Wedding Budget Planner', margin, h - 20);
      doc.text('Page ' + i + ' of ' + pageCount, pageWidth - margin, h - 20, { align: 'right' });
    }

    doc.save('Wedding-Budget-' + new Date().toISOString().slice(0, 10) + '.pdf');
  }

  window.WeddingPDF = { export: exportPdf };
})();
