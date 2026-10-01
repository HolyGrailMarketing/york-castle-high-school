import logoUrl from '../assets/logo.png';
import { SCHOOL_INFO, escapeHtml } from './export';
import type { VoucherPayload } from '../types';

/**
 * The three-part paying-in voucher.
 *
 * This is a reproduction of the school's existing paper slip, and it has to
 * stay one: the bank teller in Brown's Town is used to the paper, and a slip
 * that does not look like the paper is a slip that gets queried at the counter.
 * BANK'S COPY, SCHOOL'S COPY and STUDENT'S COPY print side by side on one
 * landscape sheet, separated by dashed cut lines.
 *
 * The copies are not identical, and the difference matters:
 *   BANK'S COPY     carries the cash denomination tally the teller fills in.
 *   SCHOOL'S and
 *   STUDENT'S COPY  carry the itemised breakdown, so the family can see what
 *                   they are paying for.
 *
 * printToPDF in ./export is the wrong shape for this - it is a single-column
 * portrait letter with a letterhead - but its school details and its escaping
 * are the same, so those are imported rather than copied.
 *
 * Every figure here comes from the server. The client decides the layout and
 * nothing else: this is the number a parent takes to a bank.
 */

const money = (n: number | null | undefined) =>
  n === null || n === undefined
    ? ''
    : n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The denominations on the paper slip, in the order the teller counts them. */
const DENOMINATIONS = ['FEE', '$1000', '$500', '$100', '$50', 'COINS', 'TOTAL CASH', 'CHEQUES', 'TOTALS'];

type CopyKind = 'BANK' | 'SCHOOL' | 'STUDENT';

const CAPTIONS: Record<CopyKind, string> = {
  BANK: "BANK'S COPY",
  SCHOOL: "SCHOOL'S COPY",
  STUDENT: "STUDENT'S COPY",
};

const headingFor = (v: VoucherPayload) =>
  v.kind === 'INCIDENTAL' ? 'INCIDENTAL FEES' : 'SCHOOL FEE';

/** "2026-2027 | CHRISTMAS", or just the year for an annual fee. */
const yearTermLine = (v: VoucherPayload) =>
  v.termLabel ? `${v.academicYear}|${v.termLabel}` : v.academicYear;

const denominationTable = () => `
  <table class="v-denom">
    <thead><tr><th>DETAILS</th><th>AMOUNT</th></tr></thead>
    <tbody>
      ${DENOMINATIONS.map((d) => `<tr><td class="v-denom-label">${escapeHtml(d)}</td><td></td></tr>`).join('')}
    </tbody>
  </table>`;

const itemisedLines = (v: VoucherPayload) => `
  <table class="v-lines">
    ${v.lines
      .map(
        (line) =>
          `<tr><td class="v-line-label">${escapeHtml(line.label)}</td><td class="v-line-amt">$ ${money(line.amount)}</td></tr>`
      )
      .join('')}
  </table>`;

const copy = (v: VoucherPayload, kind: CopyKind, logo: string) => {
  // The grade only appears on an incidental slip; the school fee is the same
  // for both sixth form years, exactly as on the paper.
  const grade = v.kind === 'INCIDENTAL' && v.student.formClass
    ? `<div class="v-grade">GRADE ${escapeHtml(v.student.formClass)}</div>`
    : '';

  return `
  <section class="v-copy">
    <div class="v-head">
      <img class="v-crest" src="${escapeHtml(logo)}" alt="" />
      <div class="v-school">${escapeHtml(SCHOOL_INFO.name)}</div>
      <div class="v-heading">${escapeHtml(headingFor(v))}</div>
      ${grade}
      <div class="v-bank">${escapeHtml(v.bank.name.toUpperCase())}</div>
      <div class="v-acct">Account No. ${escapeHtml(v.bank.account)}</div>
      <div class="v-branch">${escapeHtml(v.bank.branch.toUpperCase())}</div>
    </div>

    <div class="v-field">
      <div class="v-field-label">Name of Student</div>
      <div class="v-rule">${escapeHtml(v.student.name)}</div>
      ${v.student.studentNumber ? `<div class="v-sub">${escapeHtml(v.student.studentNumber)}</div>` : ''}
    </div>

    <div class="v-yearterm">
      <div class="v-field-label">${v.termLabel ? 'Year|Term' : 'Year'}</div>
      <div class="v-strong">${escapeHtml(yearTermLine(v))}</div>
      <div class="v-field-label">Total</div>
      <div class="v-total">J$${money(v.total)}</div>
    </div>

    <div class="v-paidin">PAID IN BY:<span class="v-blank"></span></div>

    ${kind === 'BANK'
      ? `<div class="v-note">Verified as to cash only.<br />Payment must be made by Certified Cheques or Cash only</div>
         <div class="v-instruction">PLEASE WRITE IN THE AMOUNT BEING PAID</div>
         ${denominationTable()}`
      : `${itemisedLines(v)}
         ${v.alreadyPaid > 0
            ? `<div class="v-paid">Already paid: $ ${money(v.alreadyPaid)}<br />Balance: $ ${money(v.balance)}</div>`
            : ''}
         <div class="v-note v-note-small">Payment must be made by Certified Cheques or Cash only</div>`}

    <div class="v-foot">
      <div class="v-caption">${escapeHtml(CAPTIONS[kind])}</div>
      <div class="v-serial">Account No. ${escapeHtml(v.bank.account)} &nbsp;&nbsp; No. ${v.serial}</div>
    </div>
  </section>`;
};

const sheet = (v: VoucherPayload, logo: string) => `
  <div class="v-sheet">
    ${copy(v, 'BANK', logo)}
    ${copy(v, 'SCHOOL', logo)}
    ${copy(v, 'STUDENT', logo)}
  </div>`;

const STYLES = `
  * { box-sizing: border-box; }
  /* One sheet per voucher, landscape, three columns. */
  @page { size: A4 landscape; margin: 6mm; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }

  .v-warn {
    margin: 10px; padding: 10px 14px; border: 2px solid #b8941f; background: #fdf6e3;
    font-size: 13px; line-height: 1.5; border-radius: 6px;
  }
  .v-warn strong { display: block; margin-bottom: 2px; }

  .v-sheet {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    break-after: page; page-break-after: always;
    min-height: 185mm;
  }
  .v-sheet:last-of-type { break-after: auto; page-break-after: auto; }

  .v-copy {
    padding: 4mm 3.5mm; border-right: 1px dashed #555;
    break-inside: avoid; page-break-inside: avoid;
    display: flex; flex-direction: column; font-size: 8.5pt; line-height: 1.25;
  }
  .v-copy:last-child { border-right: none; }

  .v-head { text-align: center; }
  .v-crest { width: 34px; height: 34px; object-fit: contain; }
  .v-school { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 11pt; margin-top: 1mm; }
  .v-heading { font-size: 9pt; letter-spacing: .04em; margin-top: .6mm; }
  .v-grade { font-size: 8.5pt; }
  .v-bank { font-weight: 700; font-size: 9pt; margin-top: 1mm; }
  .v-acct { font-size: 9pt; }
  .v-branch { font-size: 8pt; }

  .v-field { margin-top: 2.5mm; text-align: center; }
  .v-field-label { font-size: 7.5pt; color: #333; }
  .v-rule { border-bottom: 1.5px solid #000; padding: 2mm 0 .8mm; font-size: 9pt; min-height: 6mm; }
  .v-sub { font-size: 7pt; color: #444; }

  .v-yearterm { text-align: center; margin-top: 1.5mm; }
  .v-strong { font-weight: 700; font-size: 8.5pt; }
  .v-total { font-weight: 700; font-size: 11pt; }

  .v-paidin { margin-top: 2.5mm; font-size: 7.5pt; display: flex; align-items: flex-end; gap: 1mm; }
  .v-blank { flex: 1; border-bottom: 1px solid #000; height: 3.6mm; }

  .v-note { margin-top: 2.5mm; font-size: 6.5pt; color: #222; }
  .v-note-small { margin-top: auto; padding-top: 2mm; }
  .v-instruction { margin-top: 1.5mm; font-size: 7pt; }

  .v-denom { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  .v-denom th, .v-denom td { border: 1px solid #000; height: 4.6mm; font-size: 7pt; padding: 0 1mm; }
  .v-denom th { text-align: center; font-weight: 700; }
  .v-denom-label { text-align: right; font-weight: 700; width: 48%; }

  .v-lines { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  .v-lines td { font-size: 7.5pt; padding: .35mm 0; vertical-align: top; }
  .v-line-amt { text-align: right; white-space: nowrap; padding-left: 2mm; }

  .v-paid { margin-top: 2mm; font-size: 7pt; border-top: 1px solid #999; padding-top: 1mm; }

  .v-foot { margin-top: auto; padding-top: 3mm; text-align: center; }
  .v-caption { font-weight: 700; font-size: 8pt; letter-spacing: .08em; }
  .v-serial { font-size: 7.5pt; margin-top: .8mm; }

  @media print {
    .v-warn { display: none; }
    /* Backgrounds and rules must survive the print path or the slip arrives
       at the bank with no table grid on it. */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/**
 * Open the slips in a print window.
 *
 * The banner is deliberately loud and screen-only. Chrome honours
 * `@page { size: landscape }` inconsistently depending on how the dialog was
 * last left, and a portrait print silently ruins a batch of ninety slips - the
 * columns run off the edge and every one has to be reprinted.
 */
export const printVouchers = (vouchers: VoucherPayload[]) => {
  if (!vouchers.length) return;
  const logo = new URL(logoUrl, window.location.href).href;
  const title = vouchers.length === 1
    ? `Voucher ${vouchers[0].serial} - ${vouchers[0].student.name}`
    : `${vouchers.length} vouchers - ${vouchers[0].serial} to ${vouchers[vouchers.length - 1].serial}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
  <div class="v-warn">
    <strong>Before you print: set Layout to Landscape and Margins to Default.</strong>
    Each sheet is one voucher in three parts — bank's, school's and student's copy — to be cut along the dashed lines.
    ${vouchers.length > 1 ? `This is a run of ${vouchers.length}, numbered ${vouchers[0].serial} to ${vouchers[vouchers.length - 1].serial}.` : ''}
  </div>
  ${vouchers.map((v) => sheet(v, logo)).join('')}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  // Let the crest load before the dialog opens, or it prints a broken image.
  win.onload = () => setTimeout(() => win.print(), 250);
};
