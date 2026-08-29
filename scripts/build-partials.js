#!/usr/bin/env node
/**
 * Inject the shared header and footer into the pages that use them.
 *
 * These pages each carried their own copy of the nav and footer, and the copies
 * had drifted: 20 menu items on index, 19 on booklist and timetable, 15 on the
 * other eight, with "Sports and Extra Curricular Activities" truncated on most
 * of them. Adding a single link meant editing thirteen files and missing some.
 *
 * Injection happens at BUILD time, not in the browser, for the same reason the
 * timetable page is pre-rendered: the site has to work with JavaScript off, and
 * a nav that arrives by fetch is a nav that sometimes does not arrive at all.
 *
 * Only the regions between the markers are rewritten, so anything else on a page
 * is left alone. Running twice produces identical files.
 *
 * Usage:
 *   node scripts/build-partials.js [--check]
 *
 *   --check  report what would change and exit non-zero, without writing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const NAV = ['<!-- BEGIN SHARED NAV -->', '<!-- END SHARED NAV -->'];
const FOOTER = ['<!-- BEGIN SHARED FOOTER -->', '<!-- END SHARED FOOTER -->'];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').trimEnd();

const partials = {
  nav: read('partials/site-nav.html'),
  navMinimal: read('partials/site-nav-minimal.html'),
  footer: read('partials/site-footer.html'),
  footerMinimal: read('partials/site-footer-minimal.html'),
};

/**
 * Which pages get the shared chrome, and which variant.
 *
 * `minimal` is the sign-in flow: a logo and a couple of links, no menu, so
 * someone resetting a password is not invited to wander off mid-flow.
 */
const PAGES = {
  'index.html': 'full',
  'signin.html': 'full',
  'booklist.html': 'full',
  'timetable.html': 'full',
  'cxc-update.html': 'full',
  'parent-portal.html': 'full',
  'privacy-policy.html': 'full',
  'terms-of-service.html': 'full',
  'application-status.html': 'full',
  'data-subject-request.html': 'full',
  'sixth-form-application.html': 'full',
  'reset-password.html': 'minimal',
  'forgot-password.html': 'minimal',
};

/** Pages with no footer of their own; the nav is still shared. */
const NO_FOOTER = new Set(['sixth-form-application.html']);

// --- helpers ----------------------------------------------------------------

/**
 * Mark the page you are on. This is what the hand-maintained `aria-current` and
 * Webflow `w--current` markers were doing, one file at a time.
 */
const markCurrent = (html, file) => {
  const re = new RegExp(`(<a\\s[^>]*href="${file.replace('.', '\\.')}")`, 'g');
  return html.replace(re, '$1 aria-current="page"');
};

const replaceRegion = (html, [begin, end], body) => {
  const a = html.indexOf(begin);
  const b = html.indexOf(end);
  if (a === -1 || b === -1) return null;
  return html.slice(0, a) + begin + '\n' + body + '\n' + ' '.repeat(4) + html.slice(b);
};

// --- run --------------------------------------------------------------------

let changed = 0;
let missing = [];

for (const [file, variant] of Object.entries(PAGES)) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { missing.push(`${file} (no such file)`); continue; }

  const before = fs.readFileSync(full, 'utf8');
  let after = before;

  const navBody = markCurrent(variant === 'minimal' ? partials.navMinimal : partials.nav, file);
  const withNav = replaceRegion(after, NAV, navBody);
  if (withNav === null) { missing.push(`${file} (no SHARED NAV markers)`); continue; }
  after = withNav;

  if (!NO_FOOTER.has(file)) {
    const footBody = markCurrent(
      variant === 'minimal' ? partials.footerMinimal : partials.footer, file);
    const withFooter = replaceRegion(after, FOOTER, footBody);
    if (withFooter === null) { missing.push(`${file} (no SHARED FOOTER markers)`); continue; }
    after = withFooter;
  }

  if (after !== before) {
    changed += 1;
    if (!checkOnly) fs.writeFileSync(full, after);
    console.log(`  ${checkOnly ? 'would update' : 'updated'}  ${file}`);
  }
}

const pageCount = Object.keys(PAGES).length;
console.log(`\n${pageCount} pages share the header` +
  ` (${Object.values(PAGES).filter((v) => v === 'minimal').length} minimal),` +
  ` ${pageCount - NO_FOOTER.size} share the footer.`);
console.log(`${changed} file(s) ${checkOnly ? 'would change' : 'changed'}.`);

if (missing.length) {
  console.error('\nSkipped:');
  for (const m of missing) console.error('  ' + m);
  process.exit(1);
}
if (checkOnly && changed) process.exit(1);
