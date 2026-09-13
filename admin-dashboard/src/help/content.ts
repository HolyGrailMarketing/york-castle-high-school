/**
 * Every piece of in-app guidance in the portal, in one place.
 *
 * Both the collapsible panel at the top of each page (components/PageHelp.tsx)
 * and the Help & Guide page (pages/Help.tsx) read from here, so the two can
 * never drift apart, and adding guidance for a new page is one entry in one
 * file rather than copy scattered through components.
 *
 * `roles` must stay in step with `allNavItems` in components/Layout.tsx — it is
 * what stops the Help page offering someone an area they cannot open.
 */

export type HelpAction = {
  /** The thing the user wants to do, in their words. */
  label: string;
  /** How to do it here — name the actual controls on the page. */
  detail: string;
};

export type PageHelp = {
  /** Route path without the leading slash. Also the localStorage key suffix. */
  key: string;
  title: string;
  /** One sentence: what this page is for. */
  summary: string;
  actions: HelpAction[];
  /** Same role strings as Layout.tsx's allNavItems. */
  roles: string[];
};

const ALL_STAFF = ['ADMIN', 'STAFF', 'TEACHER'];
const OFFICE = ['ADMIN', 'STAFF'];

export const PAGE_HELP: Record<string, PageHelp> = {
  dashboard: {
    key: 'dashboard',
    title: 'Dashboard',
    summary: 'Your starting point — what needs attention today, and shortcuts to the areas you use most.',
    roles: ALL_STAFF,
    actions: [
      { label: 'See what is waiting', detail: 'The number beside "pending review" counts applications nobody has decided on yet. Click it to go straight to them.' },
      { label: 'Jump to your work', detail: 'Quick Actions link to the areas you have access to. Everything you can open is also in the sidebar on the left.' },
      { label: 'Check recent arrivals', detail: 'Recent Applications lists the newest submissions from the website. "View All" opens the full list.' },
    ],
  },

  applications: {
    key: 'applications',
    title: 'Applications',
    summary: 'Applications to join the school submitted through the website, for grades other than Sixth Form.',
    roles: ALL_STAFF,
    actions: [
      { label: 'Read an application', detail: 'Click View on any row to see everything the applicant submitted, and to add notes.' },
      { label: 'Record a decision', detail: 'Change the status inside the View window. The applicant is not emailed automatically — the office contacts them separately.' },
      { label: 'Keep a paper copy', detail: 'PDF opens a print-ready copy of one application on school letterhead. Use your browser’s "Save as PDF".' },
      { label: 'Narrow the list', detail: 'The status filter at the top right shows only applications in that state.' },
    ],
  },

  'sixth-form': {
    key: 'sixth-form',
    title: 'Sixth Form Applications',
    summary: 'Applicants for the CAPE programme, and how ready each one is to be interviewed.',
    roles: ALL_STAFF,
    actions: [
      { label: 'See who is not ready', detail: 'Use the first dropdown to narrow the list to "CXC results outstanding", "Section D outstanding" or "Ready for interview". It filters the whole cohort, not just this page.' },
      { label: 'Chase the ones who are missing something', detail: 'Set the readiness filter to "CXC results outstanding", tick the box in the header to select the page, choose "Select all N matching", then pick a notification and Send.' },
      { label: 'Find one applicant', detail: 'Type a name or part of an email into the search box. It searches every application, not just this page, and works alongside the two filters.' },
      { label: 'Prepare for an interview', detail: 'View shows the full application, including any subjects still to be graded and whether Section D was ever completed.' },
      { label: 'See where an accepted student is going', detail: 'The Faculty column shows the placement for accepted students; everyone else shows a dash. View has it too, under Status.' },
      { label: 'Record the interview', detail: 'Inside View, the Interview tab holds the rating sheet and the recommendation. It saves against that applicant.' },
    ],
  },

  blog: {
    key: 'blog',
    title: 'Blog Posts',
    summary: 'News and articles published to the school website.',
    roles: ALL_STAFF,
    actions: [
      { label: 'Write a post', detail: 'Use the New Post button. Nothing appears on the website until you publish it.' },
      { label: 'Fix something already live', detail: 'Edit a published post and save — the website updates immediately.' },
    ],
  },

  events: {
    key: 'events',
    title: 'Events',
    summary: 'The events calendar shown on the school website.',
    roles: ALL_STAFF,
    actions: [
      { label: 'Add an event', detail: 'New Event. The date and time you set are what parents and students see.' },
      { label: 'Cancel or change one', detail: 'Edit the event, or delete it to take it off the website.' },
    ],
  },

  courses: {
    key: 'courses',
    title: 'Courses',
    summary: 'The subjects listed on the website, including the CAPE subjects offered in Sixth Form.',
    roles: ALL_STAFF,
    actions: [
      { label: 'Add or update a subject', detail: 'Changes here alter what prospective students see when they browse subjects.' },
    ],
  },

  documents: {
    key: 'documents',
    title: 'Documents',
    summary: 'Files the school makes available for download — forms, policies, and notices.',
    roles: ALL_STAFF,
    actions: [
      { label: 'Publish a file', detail: 'Upload it here and it becomes downloadable from the website.' },
      { label: 'Take a file down', detail: 'Delete it to remove the download. Anyone holding the old link will no longer be able to fetch it.' },
    ],
  },

  users: {
    key: 'users',
    title: 'Users',
    summary: 'Accounts that can sign in, and who gets emailed when work arrives.',
    roles: OFFICE,
    actions: [
      { label: 'Give someone access', detail: 'Create a user and set their role. The role decides which areas appear in their sidebar.' },
      { label: 'Route notifications', detail: 'The checkboxes on a user decide which submissions they are emailed about.' },
    ],
  },

  students: {
    key: 'students',
    title: 'Students',
    summary: 'Students who have made their own account on the website, and whether the office has confirmed their year and class.',
    roles: OFFICE,
    actions: [
      { label: 'Confirm a new student', detail: 'Students type their own year and class when they sign up, so it has to be checked against the class register before they can borrow anything. Open a student, correct the class if they got it wrong, and press Confirm.' },
      { label: 'Work through the backlog', detail: 'The Not confirmed tab is your queue \u2014 everyone waiting to be allowed to borrow books. The number on the tab is how many are left.' },
      { label: 'Spot a disagreement', detail: 'Where the class you confirmed is not the one the student typed, the list shows both. The student\u2019s own claim is never overwritten, so you can always see what they said.' },
      { label: 'Register someone at the counter', detail: 'Register at Desk creates the account for a student standing in front of you and confirms them at the same time, so the queue does not stop. Add their email if they have one; they set their own password afterwards with Forgot password, and you should never type a password for them.' },
      { label: 'Look someone up', detail: 'Search by name, student number or email. Owes money lists everyone with an unpaid charge.' },
    ],
  },

  'library/desk': {
    key: 'library/desk',
    title: 'Issue & Return',
    summary: 'The counter screen \u2014 scan a student, then scan their books out or back in.',
    roles: OFFICE,
    actions: [
      { label: 'Give a student their books', detail: 'Scan the student\u2019s card, or type their student number and press Enter. Their name stays on screen until you press Esc, so you can do a whole stack of books without scanning them again.' },
      { label: 'Take books back', detail: 'Scan the book on its own \u2014 you do not need the student. The screen tells you whose it was. If a book comes back damaged, set the condition to Damaged before you scan it.' },
      { label: 'Set the condition', detail: 'The buttons above the list set the condition for the next book scanned back. The keyboard shortcuts are G, F, P and D. Damaged raises a charge for the cost of the book and sends the copy for repair rather than back on the shelf.' },
      { label: 'When someone cannot be given a book', detail: 'A yellow bar explains why \u2014 usually the office has not confirmed their year and class yet, or they already have as many books as they are allowed. Send them to the office; do not hand the book over.' },
      { label: 'Undo a mistake', detail: 'Every scan has an Undo button for ten seconds. After that, scan the book back in instead \u2014 the school\u2019s records already show it moving, so the correction has to be another movement.' },
      { label: 'Keep the box armed', detail: 'The scanner types into whatever is selected on screen. The box says Ready to scan in green when it is listening; if it says Click here, click it before you scan.' },
    ],
  },

  'library/charges': {
    key: 'library/charges',
    title: 'Book Charges',
    summary: 'What each student owes for book rental, damage or replacement. This records the amount only \u2014 it does not take payment.',
    roles: OFFICE,
    actions: [
      { label: 'See who owes what', detail: 'One row per charge. Filter by form class to get a list for a form teacher. The figure at the top is the school-wide total; when you filter, a second figure shows what the list in front of you adds up to.' },
      { label: 'Charge the term\u2019s rental', detail: 'Raise Term Rental adds the rental fee for every book currently out. It shows you how many students and how much before anything is saved. Running it twice does not charge anyone twice.' },
      { label: 'Cancel a charge', detail: 'Cancel removes the amount owed and asks why. It is recorded against your name and cannot be undone here. Only an administrator can do it.' },
      { label: 'Hand the list to the bursary', detail: 'Export CSV downloads the outstanding amounts with student numbers and form classes. Payment is taken and recorded at the bursary, never here \u2014 a charge stays on this list until someone cancels it.' },
    ],
  },

  'library/loans': {
    key: 'library/loans',
    title: 'Book Loans',
    summary: 'Every book currently with a student, and everything that has been lent this year.',
    roles: ALL_STAFF,
    actions: [
      { label: 'See who is late', detail: 'The Overdue tab shows books past their return date. This is the list to chase in person.' },
      { label: 'Collect a whole class at the end of term', detail: 'End of Term Return takes back every book one form class still has. It shows you the full list first \u2014 read it before confirming, because it changes a lot of records at once and cannot be undone in bulk.' },
      { label: 'Record a book as lost', detail: 'Mark Lost closes the loan and charges the student the full replacement cost of the book. The charge shows on Book Charges and on the student\u2019s own page.' },
      { label: 'Check something that looks wrong', detail: 'Needs review lists loans the system was not certain about \u2014 usually recorded on a counter computer while it was offline, or given to a student who had not been confirmed. Each one says why.' },
    ],
  },

  'library/books': {
    key: 'library/books',
    title: 'Textbooks',
    summary: 'Every title the school lends, and every physical copy of it with its own barcode.',
    roles: ALL_STAFF,
    actions: [
      { label: 'Add a title', detail: 'Add Textbook records the book itself \u2014 title, subject, which years use it, and what it costs to replace. It does not add any copies yet.' },
      { label: 'Add copies you have bought', detail: 'Open a title and use Add Copies. Enter how many; the system gives each one its own barcode in order. Larger orders are sent in batches of 500 and you get one label sheet covering all of them.' },
      { label: 'Print the barcode labels', detail: 'After adding copies a label sheet opens \u2014 use your browser\u2019s Print. It prints a real scannable barcode with the code underneath, three across, sized for ordinary address label sheets. You can reprint a title\u2019s labels any time from Print Labels in its copy list.' },
      { label: 'Retire a damaged copy', detail: 'Withdraw sets one copy out of circulation and asks why. Its history is kept, but nobody can scan it out again. A copy that is currently with a student cannot be withdrawn \u2014 take it back first.' },
      { label: 'Get the list out as a spreadsheet', detail: 'Export CSV downloads every copy with its barcode, condition and who has it, for stocktaking.' },
    ],
  },

  booklist: {
    key: 'booklist',
    title: 'Booklist',
    summary: 'The book lists parents download for each year group.',
    roles: OFFICE,
    actions: [
      { label: 'Publish a year’s list', detail: 'Upload the PDF or Word file against the right year group.' },
    ],
  },

  requests: {
    key: 'requests',
    title: 'Requests',
    summary: 'Document, device, and lab requests submitted through the website, and where each one has got to.',
    roles: OFFICE,
    actions: [
      { label: 'Work through what is waiting', detail: 'The bell in the top bar and the sidebar badge both count pending requests.' },
      { label: 'Move a request along', detail: 'Open it and update the status so the requester can see progress.' },
    ],
  },

  analytics: {
    key: 'analytics',
    title: 'Analytics',
    summary: 'How people are using the school website.',
    roles: OFFICE,
    actions: [
      { label: 'See what visitors look at', detail: 'Traffic and page figures for the public website, not for this portal.' },
    ],
  },

  'audit-logs': {
    key: 'audit-logs',
    title: 'Audit Logs',
    summary: 'A record of who changed what in this portal, kept for accountability.',
    roles: ['ADMIN'],
    actions: [
      { label: 'Trace a change', detail: 'Search by user or record to see what was altered and when. Entries are written automatically and cannot be edited.' },
    ],
  },

  'data-subject-requests': {
    key: 'data-subject-requests',
    title: 'Data Subject Rights',
    summary: 'Requests from people asking to see, correct, or delete the personal data the school holds about them.',
    roles: ['ADMIN'],
    actions: [
      { label: 'Handle a request', detail: 'These carry legal deadlines under the Data Protection Act. Record what was done, and when.' },
    ],
  },
};

export type GlossaryEntry = {
  /** Stable id used by <Hint term="…" />. */
  term: string;
  label: string;
  definition: string;
};

/**
 * School-specific vocabulary that appears on screen. Anything here can be
 * attached to the place it appears with <Hint term="…" />.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'pending-scans',
    label: 'Scans waiting',
    definition:
      'Scans made while the counter computer had no internet. They are saved on that computer and send themselves as soon as the connection comes back. Nothing is lost \u2014 but they are only on that one machine, so do not shut it down for the day while the number is above zero. If you have to, print today\u2019s scans first.',
  },

  {
    term: 'station',
    label: 'Counter computer (station)',
    definition:
      'The computer at the library counter running the Issue & Return screen. Each one has a short name so two counters can be told apart when their records disagree about who has a book.',
  },
  {
    term: 'needs-attention',
    label: 'Needs attention',
    definition:
      'A scan the school\u2019s records would not accept \u2014 nearly always because the book was already recorded as out to a different student. The system will not guess which is right, because only someone who can see the actual book knows. Find out who has it, then choose.',
  },
  {
    term: 'end-of-term-return',
    label: 'End of Term Return',
    definition:
      'Marking every book from one form class returned at once, for the collection at the end of term. It affects a whole class in one action and cannot be undone in bulk \u2014 check the list on screen before confirming.',
  },

  {
    term: 'verified-student',
    label: 'Confirmed student',
    definition:
      'A student whose year group and form class the office has checked against the class register. Students type their own when they sign up, so anyone can claim to be in Grade 13. Only confirmed students can be given books; everyone else shows as Not confirmed at the counter.',
  },
  {
    term: 'desk-registration',
    label: 'Register at Desk',
    definition:
      'Creating an account for a student who turns up without one, right at the counter, and confirming them in the same step so they can be given their books immediately. They set their own password afterwards. It exists so one unregistered student does not hold up the queue.',
  },

  {
    term: 'copy-barcode',
    label: 'Copy barcode',
    definition:
      'The label stuck inside one individual book, like YCHS-000123. Every physical copy has its own, even when twenty copies are the same title \u2014 that is how the school knows which one a particular student has, and what condition that one was in. It is not the ISBN printed by the publisher.',
  },
  {
    term: 'condition-grade',
    label: 'Condition',
    definition:
      'How worn a copy is, recorded both when it goes out and when it comes back: New, Good, Fair, Poor or Damaged. The pair is what settles an argument about whether a student damaged a book or was handed it that way, so set it honestly on the way out as well as the way in.',
  },
  {
    term: 'withdrawn-copy',
    label: 'Withdrawn copy',
    definition:
      'A copy taken out of circulation for good \u2014 destroyed, lost beyond recovery, or too damaged to lend. Its history stays on record and the barcode is never reused, but it cannot be scanned out to anyone again.',
  },
  {
    term: 'rental-fee',
    label: 'Rental fee',
    definition:
      'What a student is charged for having a book for the term. It is recorded against them by the office once a term, not automatically when the book is handed over.',
  },

  {
    term: 'section-d',
    label: 'Section D (CAPE subject stream selection)',
    definition:
      'The part of the Sixth Form application where the student picks their CAPE stream and subjects. It was added to the form partway through the intake, so applications sent before that have nothing on file — those students must be asked for it at their interview.',
  },
  {
    term: 'faculty',
    label: 'Faculty',
    definition:
      'The faculty an accepted student has been placed in for September — Business, Humanities, Science or Technical. This is the school\u2019s placement decision, taken from the final candidate lists, and is not the same as the stream the applicant asked for on their application: a student can be placed in a faculty they did not choose. Only accepted students have one.',
  },
  {
    term: 'cxc-results',
    label: 'CXC results',
    definition:
      'The applicant’s CSEC subject grades. Students who applied before results came out saved the subjects they were still sitting, and are expected to come back and enter the real grades once results are released.',
  },
  {
    term: 'sitting',
    label: '"N sitting"',
    definition:
      'That many subjects on the application are still marked as being sat, with no grade yet. The school does not have those results. View shows which subjects they are, and the "CXC results outstanding" filter lists everyone still to come back with real grades.',
  },
  {
    term: 'readiness',
    label: 'Ready for interview',
    definition:
      'An applicant with real grades on every CXC subject and Section D completed. "Either outstanding" is everyone still missing one or the other — that is your chase-up list.',
  },
  {
    term: 'application-status',
    label: 'Application status',
    definition:
      'Pending means nobody has looked at it yet; Under Review means someone is considering it; Approved and Rejected record the final decision. Changing it does not email the applicant.',
  },
  {
    term: 'matriculation',
    label: 'Fully matriculated',
    definition:
      'The applicant meets the entry requirements outright — the required CSEC passes including English A and Mathematics. Recorded on the interview sheet.',
  },
  {
    term: 'interview-decision',
    label: 'Interview decision',
    definition:
      'The interviewer’s recommendation: Recommend for Admission, Do Not Recommend, or Defer if a decision cannot be made yet. It records what the panel thought; it does not by itself admit the student.',
  },
  {
    term: 'bulk-notification',
    label: 'Sending a notification',
    definition:
      'Sends a real email, immediately, to every applicant you have selected — an interview invitation, a results-released notice, or a message you write yourself. Check the recipient count before sending; it cannot be recalled.',
  },
];

export const glossaryEntry = (term: string) => GLOSSARY.find((g) => g.term === term);

/** The pages a given role can actually open, in sidebar order. */
export const helpForRole = (role?: string) =>
  Object.values(PAGE_HELP).filter((p) => (role ? p.roles.includes(role) : false));
