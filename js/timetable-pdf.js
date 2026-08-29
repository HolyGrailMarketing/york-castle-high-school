/**
 * A very small PDF writer, just big enough to lay out a class timetable.
 *
 * Why not a library: jsPDF or pdfmake would add ~350 KB to a page that the whole
 * build has been keeping under ~30 KB gzip, for students on phone data. A
 * timetable is a grid of text, and PDF's base-14 fonts (Helvetica and friends)
 * need no embedding, so the whole thing fits in a few KB. This file is loaded
 * lazily, only when someone actually asks for a PDF.
 *
 * buildTimetablePdf() is pure: data in, bytes out, no DOM. The DOM reading lives
 * in collectFromPanel() below, so the layout can be tested on its own.
 */
(function (global) {
  'use strict';

  // --- font metrics --------------------------------------------------------
  // Helvetica advance widths, 1/1000 em, for the printable ASCII range. Without
  // these, line wrapping has to guess at an average character width and the
  // result looks visibly ragged.
  var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,
    722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    333,278,333,584,556,333,
    556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,
    389,280,389,584];

  var widthOf = function (ch, bold) {
    var c = ch.charCodeAt(0);
    if (c === 0xB7) return 278;             // middle dot, used between names
    if (c < 32 || c > 126) return bold ? 556 : 556;
    return (bold ? W_BOLD : W_REG)[c - 32];
  };

  var textWidth = function (s, size, bold) {
    var total = 0;
    for (var i = 0; i < s.length; i += 1) total += widthOf(s[i], bold);
    return total * size / 1000;
  };

  // --- encoding ------------------------------------------------------------
  // Content streams here are single-byte WinAnsi. Map the few non-ASCII
  // characters the page actually produces, and drop anything else rather than
  // emitting a byte that would render as garbage.
  var WINANSI = { '·': '·', '–': '-', '—': '-', '’': "'",
    '‘': "'", '“': '"', '”': '"', '…': '...' };

  var encode = function (s) {
    var out = '';
    for (var i = 0; i < s.length; i += 1) {
      var ch = s[i];
      var c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126) { out += ch; continue; }
      if (WINANSI[ch] !== undefined) { out += WINANSI[ch]; continue; }
      if (c === 0xA0) { out += ' '; continue; }
      // Anything else is dropped: a wrong glyph is worse than none.
    }
    return out.replace(/[\\()]/g, function (m) { return '\\' + m; });
  };

  // --- word wrap -----------------------------------------------------------
  var wrap = function (text, size, bold, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i += 1) {
      var next = line ? line + ' ' + words[i] : words[i];
      if (line && textWidth(next, size, bold) > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // --- page canvas ---------------------------------------------------------
  function Canvas() { this.ops = []; }
  Canvas.prototype.rect = function (x, y, w, h, rgb, stroke) {
    this.ops.push(rgb.join(' ') + (stroke ? ' RG' : ' rg'));
    this.ops.push(x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) +
      ' re ' + (stroke ? 'S' : 'f'));
  };
  Canvas.prototype.line = function (x1, y1, x2, y2, rgb, width) {
    this.ops.push(rgb.join(' ') + ' RG');
    this.ops.push((width || 0.5).toFixed(2) + ' w');
    this.ops.push(x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S');
  };
  Canvas.prototype.text = function (x, y, s, size, font, rgb) {
    this.ops.push('BT ' + rgb.join(' ') + ' rg /' + font + ' ' + size + ' Tf ' +
      x.toFixed(2) + ' ' + y.toFixed(2) + ' Td (' + encode(s) + ') Tj ET');
  };
  Canvas.prototype.stream = function () { return this.ops.join('\n'); };

  // --- document ------------------------------------------------------------
  var buildPdf = function (pages, size) {
    var objs = [];
    var add = function (body) { objs.push(body); return objs.length; };

    var fontReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var fontObl = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    var resources = '<< /Font << /F1 ' + fontReg + ' 0 R /F2 ' + fontBold + ' 0 R /F3 ' + fontObl + ' 0 R >> >>';

    var pagesId = objs.length + 1 + pages.length * 2;   // reserved below
    var kids = [];
    pages.forEach(function (canvas) {
      var stream = canvas.stream();
      var contentId = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      var pageId = add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' +
        size[0] + ' ' + size[1] + '] /Resources ' + resources + ' /Contents ' + contentId + ' 0 R >>');
      kids.push(pageId + ' 0 R');
    });
    var realPagesId = add('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + kids.join(' ') + '] >>');
    var catalogId = add('<< /Type /Catalog /Pages ' + realPagesId + ' 0 R >>');

    // The page objects were written with a forward reference to the Pages
    // object; patch it now that the real id is known.
    objs = objs.map(function (o) { return o.split(pagesId + ' 0 R').join(realPagesId + ' 0 R'); });

    var out = '%PDF-1.4\n';
    var offsets = [0];
    objs.forEach(function (body, i) {
      offsets.push(out.length);
      out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
    });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    for (var i = 1; i <= objs.length; i += 1) {
      out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    }
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalogId + ' 0 R >>\n' +
      'startxref\n' + xref + '\n%%EOF';

    var bytes = new Uint8Array(out.length);
    for (var j = 0; j < out.length; j += 1) bytes[j] = out.charCodeAt(j) & 0xFF;
    return bytes;
  };

  global.YCTimetablePdf = { buildPdf: buildPdf, Canvas: Canvas, wrap: wrap, textWidth: textWidth };
}(typeof window !== 'undefined' ? window : globalThis));

/**
 * Timetable layout on top of the writer above.
 *
 * A4 landscape, one row per period, one column per day. Rows are measured from
 * their own wrapped content rather than given a fixed height, because a pool
 * lesson can carry ten subject choices and eleven teacher names while a single
 * lesson carries two lines. Rows that will not fit start a new page, with the
 * day headings repeated.
 */
(function (global) {
  'use strict';

  var M = global.YCTimetablePdf;
  var PAGE = [842, 595];              // A4 landscape, points
  var MARGIN = 28;
  var TIME_W = 78;
  var HEADER_H = 80;   // room for the title, subtitle and the day band beneath
  var FOOTER_H = 22;

  // Same palette as the page.
  var INK = [0.10, 0.08, 0.06];
  var INK2 = [0.29, 0.25, 0.22];
  var INK3 = [0.48, 0.43, 0.38];
  var GOLD_DEEP = [0.54, 0.42, 0.09];
  var GOLD_SOFT = [0.98, 0.96, 0.85];
  var LINE = [0.91, 0.88, 0.83];
  var BAND = [0.95, 0.93, 0.87];
  var WHITE = [1, 1, 1];

  // Base type sizes. renderTimetable shrinks these if a class would otherwise
  // spill onto a second page - a timetable you can pin up wants to be one sheet.
  var BASE = { sub: 8.6, opt: 7, who: 6.8, room: 6.6, pad: 5 };
  var T = BASE;

  // How tall a cell needs to be once its text is wrapped to the column.
  var cellHeight = function (cell, w) {
    if (!cell) return 0;
    var inner = w - T.pad * 2;
    // Mirrors drawCell's cursor step for step - the first baseline sits SUB
    // below the top padding, and every block below moves the cursor by its own
    // line height. Getting this even slightly low lets a long teacher list run
    // through the row rule and under the room badge.
    var h = T.pad + T.sub;
    h += M.wrap(cell.subject, T.sub, true, inner).length * (T.sub + 1.6);
    if (cell.options && cell.options.length) {
      h += M.wrap(cell.options.join(' · '), T.opt, false, inner).length * (T.opt + 1.4);
    }
    if (cell.teachers && cell.teachers.length) {
      h += 1.5 + M.wrap(cell.teachers.join(' · '), T.who, false, inner).length * (T.who + 1.4);
    }
    if (cell.room) h += 2 + T.room + 5;
    return h + T.pad;
  };

  var drawCell = function (c, cell, x, y, w, h) {
    var inner = w - T.pad * 2;
    var ty = y + h - T.pad - T.sub;

    M.wrap(cell.subject, T.sub, true, inner).forEach(function (ln) {
      c.text(x + T.pad, ty, ln, T.sub, 'F2', INK); ty -= (T.sub + 1.6);
    });
    if (cell.options && cell.options.length) {
      M.wrap(cell.options.join(' · '), T.opt, false, inner).forEach(function (ln) {
        c.text(x + T.pad, ty, ln, T.opt, 'F1', INK3); ty -= (T.opt + 1.4);
      });
    }
    if (cell.teachers && cell.teachers.length) {
      ty -= 1.5;
      M.wrap(cell.teachers.join(' · '), T.who, false, inner).forEach(function (ln) {
        c.text(x + T.pad, ty, ln, T.who, 'F3', INK2); ty -= (T.who + 1.4);
      });
    }
    if (cell.room) {
      var label = cell.room.toUpperCase();
      var bw = M.textWidth(label, T.room, true) + 8;
      var bh = T.room + 5;
      // Hangs below the cursor. Drawing it upward from ty put it on top of the
      // last teacher line.
      c.rect(x + T.pad, ty - bh + 2, bw, bh, GOLD_SOFT);
      c.text(x + T.pad + 4, ty - bh + 5.5, label, T.room, 'F2', GOLD_DEEP);
    }
  };

  var drawPageFurniture = function (c, meta, pageNo, pageCount, colX, colW) {
    var top = PAGE[1] - MARGIN;
    c.text(MARGIN, top - 22, meta.className, 24, 'F2', INK);
    c.text(MARGIN, top - 38, meta.schoolName + ' · Class timetable', 9.5, 'F1', INK3);

    var year = meta.schoolYear || '';
    c.text(PAGE[0] - MARGIN - M.textWidth(year, 10, true), top - 22, year, 10, 'F2', GOLD_DEEP);

    var y = top - HEADER_H + 16;
    c.line(MARGIN, y + 10, PAGE[0] - MARGIN, y + 10, LINE, 0.8);

    // Day headings.
    c.rect(MARGIN, y - 6, PAGE[0] - MARGIN * 2, 18, BAND);
    meta.days.forEach(function (day, i) {
      var label = day.toUpperCase();
      c.text(colX[i] + (colW - M.textWidth(label, 8, true)) / 2, y, label, 8, 'F2', INK);
    });
    c.text(MARGIN + 6, y, 'TIME', 8, 'F2', INK3);

    var foot = 'Generated ' + meta.generated;
    c.text(MARGIN, MARGIN - 4, foot, 7.5, 'F1', INK3);
    var pg = 'Page ' + pageNo + ' of ' + pageCount;
    c.text(PAGE[0] - MARGIN - M.textWidth(pg, 7.5, false), MARGIN - 4, pg, 7.5, 'F1', INK3);

    return y - 10;   // top of the first row
  };

  /**
   * rows: [{ label, times, alt, nonClass, bandLabel, cells: [cell|null|'covered'] }]
   * cell: { subject, options[], teachers[], room, span }
   */
  var renderTimetable = function (meta, rows) {
    var colW = (PAGE[0] - MARGIN * 2 - TIME_W) / meta.days.length;
    var colX = meta.days.map(function (_, i) { return MARGIN + TIME_W + i * colW; });
    var bottom = MARGIN + FOOTER_H;

    var avail = PAGE[1] - MARGIN - HEADER_H + 6 - bottom;

    var measure = function () {
      var k = T.sub / BASE.sub;
      return rows.map(function (row) {
        if (row.nonClass) return 26 * k;
        var h = 30 * k;
        row.cells.forEach(function (cell) {
          if (cell && cell !== 'covered') h = Math.max(h, cellHeight(cell, colW * (cell.span || 1)));
        });
        return h;
      });
    };

    // A class timetable wants to be one sheet you can pin up, and the pool
    // lessons (up to ten choices plus eleven teachers) are what push it over.
    // Try full size, then step down; stop at 78% so it stays readable and take a
    // second page beyond that rather than shrink it to nothing.
    var heights;
    var scales = [1, 0.94, 0.88, 0.83, 0.78];
    for (var si = 0; si < scales.length; si += 1) {
      var k2 = scales[si];
      T = { sub: BASE.sub * k2, opt: BASE.opt * k2, who: BASE.who * k2,
            room: BASE.room * k2, pad: BASE.pad * (k2 > 0.9 ? 1 : 0.85) };
      heights = measure();
      if (heights.reduce(function (a, b) { return a + b; }, 0) <= avail) break;
    }

    var pageBreaks = [];
    var used = 0;
    rows.forEach(function (row, i) {
      if (used + heights[i] > avail && used > 0) { pageBreaks.push(i); used = 0; }
      used += heights[i];
    });
    var pageCount = pageBreaks.length + 1;

    var pages = [];
    var c = null, y = 0, pageNo = 0;
    var startPage = function () {
      pageNo += 1;
      c = new M.Canvas();
      pages.push(c);
      y = drawPageFurniture(c, meta, pageNo, pageCount, colX, colW);
    };
    startPage();

    rows.forEach(function (row, i) {
      if (pageBreaks.indexOf(i) !== -1) startPage();
      var h = heights[i];
      var rowTop = y, rowBottom = y - h;

      if (row.nonClass) {
        c.rect(MARGIN, rowBottom, PAGE[0] - MARGIN * 2, h, BAND);
        var label = row.bandLabel || row.label;
        c.text(MARGIN + TIME_W + (colW * meta.days.length - M.textWidth(label, 8, false)) / 2,
          rowBottom + h / 2 - 3, label, 8, 'F1', INK3);
      } else {
        c.rect(MARGIN, rowBottom, PAGE[0] - MARGIN * 2, h, WHITE);
      }

      // Time column.
      if (row.nonClass) {
        // The band across the day columns already names this row, and a label
        // like "Morning Registration" overruns the narrow time column - so show
        // the time here instead of repeating the name.
        c.text(MARGIN + 6, rowBottom + h / 2 - 3, row.times || row.label, 7.5, 'F1', INK3);
      } else {
        c.text(MARGIN + 6, rowTop - 12, row.label, 8, 'F2', INK);
        if (row.times) c.text(MARGIN + 6, rowTop - 21, row.times, 6.8, 'F1', INK3);
        if (row.alt) c.text(MARGIN + 6, rowTop - 29.5, row.alt, 6.3, 'F1', GOLD_DEEP);
      }

      if (!row.nonClass) {
        row.cells.forEach(function (cell, di) {
          if (!cell || cell === 'covered') return;
          var span = cell.span || 1;
          drawCell(c, cell, colX[di], rowBottom, colW * span, h);
        });
      }

      // Grid lines.
      c.line(MARGIN, rowBottom, PAGE[0] - MARGIN, rowBottom, LINE, 0.5);
      c.line(MARGIN + TIME_W, rowTop, MARGIN + TIME_W, rowBottom, LINE, 0.5);
      if (!row.nonClass) {
        for (var d = 1; d < meta.days.length; d += 1) {
          var covered = row.cells[d] === 'covered';
          if (!covered) c.line(colX[d], rowTop, colX[d], rowBottom, LINE, 0.5);
        }
      }
      y = rowBottom;
    });

    var bytes = M.buildPdf(pages, PAGE);
    T = BASE;   // leave the module as we found it for the next class
    return bytes;
  };

  M.renderTimetable = renderTimetable;
}(typeof window !== 'undefined' ? window : globalThis));
