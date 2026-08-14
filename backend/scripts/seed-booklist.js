/**
 * Seed the BooklistEntry table with the six booklists that were hardcoded into
 * booklist.html, so the page keeps showing exactly what it showed before the
 * switch to database-driven rendering.
 *
 * These rows point at the static files already in /documents rather than at
 * Supabase Storage (storagePath is null), so nothing needs uploading first.
 * Once an admin uploads a replacement through the dashboard, the new file goes
 * to Storage and these legacy rows are superseded.
 *
 * Safe to re-run: upserts on (schoolYear, gradeLabel).
 *
 *   node scripts/seed-booklist.js
 *
 * NOTE: the school year below matches the heading that was on the page
 * ("2024-2025") while the filenames are the 2023-2024 booklists. That mismatch
 * predates this script - it is exactly what the site was serving. Fix it by
 * uploading the current year's files in Admin > Booklist.
 */

import dotenv from 'dotenv';
import prisma from '../src/utils/prisma.js';

dotenv.config({ path: './.env' });

const SCHOOL_YEAR = '2024-2025';

// Filenames are load-bearing and inconsistently cased - copied verbatim from
// the original hrefs in booklist.html.
const ENTRIES = [
  { gradeLabel: 'Grade 7', fileName: 'gr-7-booklist-2023-2024.docx' },
  { gradeLabel: 'Grade 8', fileName: 'Gr-8-booklist-2023-2024.docx' },
  { gradeLabel: 'Grade 9', fileName: 'Gr-9-booklist-2023-2024.docx' },
  { gradeLabel: 'Grade 10', fileName: 'gr-10--2023-2024-booklist.docx' },
  { gradeLabel: 'Grade 11', fileName: 'gr-11-2023-2024-booklist.docx' },
  { gradeLabel: 'Sixth Form', fileName: 'Sixth-Form-Booklist-2023-2024.docx' },
];

async function main() {
  for (const [index, entry] of ENTRIES.entries()) {
    const data = {
      fileName: entry.fileName,
      fileUrl: `/documents/${entry.fileName}`,
      storagePath: null,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sortOrder: index,
      isPublished: true,
    };

    await prisma.booklistEntry.upsert({
      where: { schoolYear_gradeLabel: { schoolYear: SCHOOL_YEAR, gradeLabel: entry.gradeLabel } },
      update: {},
      create: { ...data, schoolYear: SCHOOL_YEAR, gradeLabel: entry.gradeLabel },
    });

    console.log(`  ${entry.gradeLabel} -> ${data.fileUrl}`);
  }

  console.log(`\nSeeded ${ENTRIES.length} booklist entries for ${SCHOOL_YEAR}.`);
}

main()
  .catch((error) => {
    console.error('Booklist seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
