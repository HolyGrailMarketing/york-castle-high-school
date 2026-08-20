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
      { label: 'See who is not ready', detail: 'The CXC Results and Section D columns show what is still missing for each applicant. The figures above the list count the whole cohort, not just this page.' },
      { label: 'Chase the ones who are missing something', detail: 'Set the readiness filter to "CXC results outstanding", tick the box in the header to select the page, choose "Select all N matching", then pick a notification and Send.' },
      { label: 'Prepare for an interview', detail: 'View shows the full application, including any subjects still to be graded and whether Section D was ever completed.' },
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
    term: 'section-d',
    label: 'Section D (CAPE subject stream selection)',
    definition:
      'The part of the Sixth Form application where the student picks their CAPE stream and subjects. It was added to the form partway through the intake, so applications sent before that have nothing on file — those students must be asked for it at their interview.',
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
      'That many subjects on the application are still marked as being sat, with no grade yet. The school does not have those results, and the badge turns green once every subject carries a real grade.',
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
