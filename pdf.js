/**
 * pdf.js
 * Builds a professional PDF export using jsPDF + jspdf-autotable.
 * Includes: budget table, payment summary, vendor info, family contributions.
 * Exposes window.WeddingPDF.export(categories, totals, contributors).
 */

(function () {
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

  async function exportPdf(categories, totals, contributors) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'a4' });
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 40;
    var usable = pageWidth - margin * 2;
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
      ['Total Paid', inr(totals.paid || 0)],
      ['Total Pending', inr(totals.pending || 0)],
      ['Difference vs. estimate', inr(totals.difference)],
      ['Remaining budget', inr(totals.remaining)]
    ];

    summaryLines.forEach(function (row) {
      doc.text(row[0], margin, y);
      doc.text(row[1], pageWidth - margin, y, { align: 'right' });
      y += 16;
    });
    y += 12;

    // ---- Budget table (with Paid and Vendor columns) ----
    var body = categories.map(function (c) {
      var vendorName = (c.vendor && c.vendor.name) ? sanitize(c.vendor.name) : '-';
      var vendorStatus = (c.vendor && c.vendor.status) ? c.vendor.status.charAt(0).toUpperCase() + c.vendor.status.slice(1) : '-';
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
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Min', 'Max', 'Actual', 'Paid', 'Paid By', 'Vendor', 'Status']],
      body: body,
      foot: [['Grand Total', inr(totals.min), inr(totals.max), inr(totals.actual), inr(totals.paid || 0), '', '', '']],
      styles: {
        fontSize: 7.5,
        cellPadding: 4,
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
        fontSize: 7.5
      },
      footStyles: {
        fillColor: [253, 238, 224],
        textColor: [10, 37, 69],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold' },
        1: { cellWidth: 55, halign: 'right' },
        2: { cellWidth: 55, halign: 'right' },
        3: { cellWidth: 55, halign: 'right' },
        4: { cellWidth: 55, halign: 'right' },
        5: { cellWidth: 65 },
        6: { cellWidth: 75 },
        7: { cellWidth: 55 }
      },
      didParseCell: function (data) {
        if (data.section === 'foot' && data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;
        }
      }
    });

    // ---- Family Contributions Section ----
    if (contributors && contributors.length) {
      y = doc.lastAutoTable.finalY + 30;

      // Check if we need a new page
      if (y > pageHeight - 120) {
        doc.addPage();
        y = 60;
      }

      doc.setTextColor(10, 37, 69);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Family Contributions', margin, y);
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

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

      contributors.forEach(function (name) {
        doc.text(sanitize(name), margin, y);
        doc.text(inr(contribData[name] || 0), pageWidth - margin, y, { align: 'right' });
        y += 15;
      });

      if (unassigned > 0) {
        doc.setTextColor(120, 120, 120);
        doc.text('Unassigned', margin, y);
        doc.text(inr(unassigned), pageWidth - margin, y, { align: 'right' });
        y += 15;
      }
    }

    // ---- Charts snapshot on a new page ----
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
          var imgWidth = pageWidth - margin * 2;
          var imgHeight = (canvas.height / canvas.width) * imgWidth;

          doc.addPage();

          doc.setFillColor(10, 37, 69);
          doc.rect(0, 0, pageWidth, 50, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text('Spending at a Glance', margin, 32);

          var maxImgHeight = pageHeight - 50 - margin - 40;
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
