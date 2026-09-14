/**
 * Load the "BOOKS ON RENTAL" sections of the school booklists into the textbook
 * rental catalogue (Book).
 *
 *   npm run library:import-rental -- --dry-run   # show what would change
 *   npm run library:import-rental                # write it
 *
 * Source: the six booklists in /documents. Five of them carry a BOOKS ON RENTAL
 * section - grades 7, 8, 9, 10 and 11. The Sixth Form booklist has no rental
 * section at all, so grades 12 and 13 contribute nothing here.
 *
 * Titles are transcribed as the booklists have them, with obvious typos in the
 * printed lists left alone in `title` and noted in `notes` where a correction
 * matters for finding the book. Where the same title is rented to more than one
 * year the years are merged onto a single row, because one title is one row and
 * the physical books are BookCopy.
 *
 * PRICES ARE NOT IN THE BOOKLISTS. Every row is created with replacementCost 0
 * and rentalFee 0, and the script prints how many titles still need pricing.
 * rentalFee 0 is safe - raise-rental-charges.js only charges where rentalFee > 0
 * - but replacementCost 0 means a lost book raises a JMD 0 charge, so the
 * bursary must set real figures in Admin > Library Books before books go out.
 *
 * Safe to re-run: rows are matched on exact title (case-insensitive). An
 * existing title is updated only where this script has something the row does
 * not already have, so hand-entered prices and ISBNs are never overwritten.
 */

import dotenv from 'dotenv';
import prisma from '../src/utils/prisma.js';

dotenv.config({ path: './.env' });

const dryRun = process.argv.includes('--dry-run');

/** Provenance marker, so these rows can be told apart from hand-entered ones. */
const SOURCE_NOTE = 'Imported from the BOOKS ON RENTAL section of the school booklist.';

// Fields: title, author, publisher, edition, subject, yearGroups, note.
// `note` is appended to SOURCE_NOTE and is where transcription caveats live.
const RENTAL_BOOKS = [
  // --- Grade 7 -------------------------------------------------------------
  { title: 'STP Mathematics Book 1 (Caribbean Mathematics)', subject: 'Mathematics', yearGroups: [7] },
  { title: 'Integrated Science for Jamaica Book 1', author: 'W. Braithwaite', subject: 'Integrated Science', yearGroups: [7] },
  { title: 'A Comprehensive English Course Book 1', author: 'U. Narinesingh, C. Narinesingh', edition: 'Revised Edition', subject: 'English Language', yearGroups: [7] },
  { title: 'Caribbean Hi Sec Series Book 1: Our People, Our Heritage, Our Life', subject: 'Social Studies', yearGroups: [7], note: 'Class set - kept in the classroom rather than issued to a student.' },
  { title: 'Caribbean Home Economics in Action Book 1', publisher: 'Heinemann', subject: 'Home Economics', yearGroups: [7, 10, 11], note: 'Class set. Printed as "Home Economics in Action Book 1" on the grade 7 list; grades 10 and 11 rent books 1, 2 and 3 as a set.' },
  { title: 'Leap Into Social Studies: A Level One Textbook', subject: 'Social Studies', yearGroups: [7] },
  { title: 'Leap Into History: A Level One Textbook', author: 'Kimberly Campbell & Tameka Henry', subject: 'History', yearGroups: [7] },

  // --- Grade 8 -------------------------------------------------------------
  { title: 'Growing Together: Social Studies for Grade 8 Students', publisher: 'Nelson Thornes', subject: 'Social Studies', yearGroups: [8] },
  { title: 'A Comprehensive English Course Book 2', author: 'U. Narinesingh', edition: 'Revised Edition', subject: 'English Language', yearGroups: [8] },
  { title: 'STP Mathematics Book 2', publisher: 'Nelson Thornes', subject: 'Mathematics', yearGroups: [8] },
  { title: 'Integrated Science for Jamaica Book 2', author: 'W. Brathwaite, O. J. Jegede, P. K. Oyebanji, D. P. Brown', subject: 'Integrated Science', yearGroups: [8] },
  { title: 'Caribbean Home Economics in Action Book 2', publisher: 'Heinemann', subject: 'Home Economics', yearGroups: [8, 10, 11], note: 'Class set. Grades 10 and 11 rent books 1, 2 and 3 as a set.' },
  { title: 'Leap Into Social Studies: A Level Two Textbook', subject: 'Social Studies', yearGroups: [8] },

  // --- Grade 9 -------------------------------------------------------------
  { title: 'STP Mathematics Book 3', subject: 'Mathematics', yearGroups: [9] },
  { title: 'English for Life Book 3', subject: 'English Language', yearGroups: [9] },
  { title: 'A Comprehensive English Course Book 3', edition: 'Revised Edition', subject: 'English Language', yearGroups: [9] },
  { title: 'Caribbean Home Economics in Action Book 3', publisher: 'Heinemann', edition: 'Revised Edition', subject: 'Home Economics', yearGroups: [9, 10, 11], note: 'Class set. Grades 10 and 11 rent books 1, 2 and 3 as a set.' },

  // --- Grades 10 and 11 (CSEC) ---------------------------------------------
  { title: 'Principles of Accounts for the Caribbean', author: 'Frank Wood', subject: 'Principles of Accounts', yearGroups: [10, 11], note: 'Printed as "Principles of Account for the Caribbean".' },
  { title: 'Office Administration', author: 'Frank Ramtahal', publisher: 'Caribbean Educational Publishers', subject: 'Office Administration', yearGroups: [10, 11], note: 'The rental list says only "Office Administration Books". Matched to the title named under OFFICE ADMINISTRATION on the same booklists - confirm before ordering.' },
  { title: 'Principles of Business for CSEC Examinations', author: 'Balliram, Budd, Emanuel, Guiness, McCloskey, Raghoo Bitu', publisher: 'Macmillan Education', subject: 'Principles of Business', yearGroups: [10], note: 'On the grade 10 rental list only.' },
  { title: 'Principles of Business for CSEC with Study Guides', author: 'Karlene Robinson, Sybile Hamil', subject: 'Principles of Business', yearGroups: [10, 11] },
  { title: 'Oxford Information Technology', publisher: 'Oxford', subject: 'Information Technology', yearGroups: [10, 11] },
  { title: 'Electronic Document Preparation and Management for CSEC', edition: '2nd Edition', subject: 'Electronic Document Preparation and Management', yearGroups: [10, 11] },
  { title: 'A Comprehensive English Course', subject: 'English Language', yearGroups: [10, 11], note: 'The CSEC-level volume, listed without a book number - distinct from the numbered books 1 to 3 rented in grades 7 to 9.' },
  { title: 'Mathematics: A Complete Course Volume 1', subject: 'Mathematics', yearGroups: [10, 11], note: 'Listed as "Mathematics, A Complete Course Book volume 1 & 2" - two physical books, so two rows.' },
  { title: 'Mathematics: A Complete Course Volume 2', subject: 'Mathematics', yearGroups: [10, 11], note: 'Listed as "Mathematics, A Complete Course Book volume 1 & 2" - two physical books, so two rows.' },
  { title: 'CXC Integrated Science', author: 'June Michelmore, John Phillips', subject: 'Integrated Science', yearGroups: [10, 11], note: 'Class set.' },
  { title: 'CXC Biology', author: 'Louis Chinnery, Joyce Glasgow, Mary Jones et al.', subject: 'Biology', yearGroups: [10, 11] },
  { title: 'C.X.C. Chemistry', author: 'Richard Hart & Jacqueline Ferguson', subject: 'Chemistry', yearGroups: [10, 11], note: 'Class set. Author printed as "Furguson".' },
  { title: 'Chemistry for CXC', author: 'Norman Lambert & Marine Mohammed', subject: 'Chemistry', yearGroups: [10, 11] },
  { title: 'Heinemann Physics for CXC', author: 'Norman Lambert, Natasha Lewis dos Santos, Trecia A. Samuel', publisher: 'Heinemann', subject: 'Physics', yearGroups: [10, 11] },
  { title: 'Longman Physics for CXC', publisher: 'Longman', subject: 'Physics', yearGroups: [10, 11], note: 'Printed as "Longman Physic for CXC".' },
  { title: 'CSEC Agricultural Science', author: 'Shaedu Rgoonan', edition: '3rd Edition', subject: 'Agricultural Science', yearGroups: [10, 11], note: 'Author name as printed; likely Sheaddon Ragoonan - confirm before ordering.' },
  { title: 'Certificate Management for Home and Families', subject: 'Home Economics', yearGroups: [10, 11] },
  { title: 'Home Economics for Caribbean Schools', subject: 'Home Economics', yearGroups: [10, 11], note: 'Class set. May be the same title as "Home Economics for Caribbean Schools: CXC Food & Nutrition - A Two Year Course"; merge the two rows if the librarian confirms they are one book.' },
  { title: 'Home Economics for Caribbean Schools: CXC Food & Nutrition - A Two Year Course', edition: '4th Edition', subject: 'Food, Nutrition and Health', yearGroups: [11], note: 'Marked "Rental" in the body of the grade 11 booklist rather than in its rental section. May duplicate "Home Economics for Caribbean Schools".' },
  { title: 'Food and Nutrition for CSEC', author: 'Anita Tull', subject: 'Food, Nutrition and Health', yearGroups: [10, 11], note: 'Grade 10 lists "Food and Nutrition for CSEC"; grade 11 lists "Food and Nutrition - Anita Tull". Treated as one title.' },
  { title: 'Needlework for Schools', subject: 'Clothing and Textiles', yearGroups: [10, 11], note: 'Printed as "Needlework for School".' },
  { title: 'Fibres and Fabrics for Today', subject: 'Clothing and Textiles', yearGroups: [10, 11] },
  { title: 'Religions for Today', subject: 'Religious Education', yearGroups: [10, 11] },
  { title: 'Modules in Social Studies with S.B.A. Guide', subject: 'Social Studies', yearGroups: [10, 11] },
  { title: 'Geography for CSEC', author: 'Paul Gunness, Jody Rocks', publisher: 'Nelson Thornes', subject: 'Geography', yearGroups: [10, 11] },
  { title: 'The Caribbean Environment for CXC Geography', author: 'Mark Wilson', subject: 'Geography', yearGroups: [10, 11] },
  { title: 'New Caribbean Geography with Map Reading', author: 'Vohn A. M. Rahil', subject: 'Geography', yearGroups: [10, 11] },
  { title: 'The World of Sport Examined', edition: '2nd Edition', subject: 'Physical Education and Sport', yearGroups: [10, 11] },
  { title: 'Technical Drawing 1: Plane & Solid Geometry', author: 'Bankole, Bland', subject: 'Technical Drawing', yearGroups: [10, 11] },
  { title: 'Physical Education and Sport for the CSEC Student', author: 'Kenny Kitsingh', subject: 'Physical Education and Sport', yearGroups: [10, 11], note: 'Printed as "Physical Education and Sports for the CSEC Student".' },
  { title: 'P.E. to 16 for the Caribbean', subject: 'Physical Education and Sport', yearGroups: [11], note: 'On the grade 11 rental list only.' },
];

const noteFor = (entry) => (entry.note ? `${SOURCE_NOTE} ${entry.note}` : SOURCE_NOTE);

/**
 * Merge year groups rather than replace them, so a year added by hand in the
 * dashboard survives a re-run.
 */
const mergeYears = (existing, incoming) =>
  [...new Set([...existing, ...incoming])].sort((a, b) => a - b);

async function main() {
  console.log(`${RENTAL_BOOKS.length} rental titles from the grade 7-11 booklists.`);
  console.log(dryRun ? 'Dry run - nothing will be written.\n' : 'Writing to the database.\n');

  // One read of the catalogue, then match in memory: title is not unique in the
  // database, so findUnique is not available and a query per title is wasteful.
  const existing = await prisma.book.findMany();
  const byTitle = new Map(existing.map((b) => [b.title.trim().toLowerCase(), b]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const entry of RENTAL_BOOKS) {
    const match = byTitle.get(entry.title.trim().toLowerCase());

    if (!match) {
      const data = {
        title: entry.title,
        author: entry.author ?? null,
        publisher: entry.publisher ?? null,
        edition: entry.edition ?? null,
        subject: entry.subject,
        yearGroups: entry.yearGroups,
        replacementCost: 0,
        rentalFee: 0,
        notes: noteFor(entry),
      };
      if (!dryRun) await prisma.book.create({ data });
      console.log(`  + ${entry.title}  [${entry.subject}, years ${entry.yearGroups.join('/')}]`);
      created += 1;
      continue;
    }

    // Fill gaps only. A field a human has already filled in is left alone.
    const patch = {};
    if (!match.author && entry.author) patch.author = entry.author;
    if (!match.publisher && entry.publisher) patch.publisher = entry.publisher;
    if (!match.edition && entry.edition) patch.edition = entry.edition;
    const years = mergeYears(match.yearGroups, entry.yearGroups);
    if (years.length !== match.yearGroups.length) patch.yearGroups = years;

    if (Object.keys(patch).length === 0) {
      unchanged += 1;
      continue;
    }

    if (!dryRun) await prisma.book.update({ where: { id: match.id }, data: patch });
    console.log(`  ~ ${entry.title}  (${Object.keys(patch).join(', ')})`);
    updated += 1;
  }

  console.log(`\n${created} created, ${updated} updated, ${unchanged} already correct.`);

  if (!dryRun) {
    const unpriced = await prisma.book.count({ where: { replacementCost: 0 } });
    if (unpriced > 0) {
      console.log(
        `\n${unpriced} title${unpriced === 1 ? '' : 's'} still ${unpriced === 1 ? 'has' : 'have'} a replacement cost of 0.\n` +
        '  The booklists do not carry prices. Set them in Admin > Library Books before\n' +
        '  any copy is issued, or a lost book will raise a JMD 0 charge.'
      );
    }
  }

  console.log('\nNo copies were created. Add physical copies, and print their barcode');
  console.log('labels, from Admin > Library Books once the titles have been checked.');
}

main()
  .catch((error) => {
    console.error('Rental book import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
