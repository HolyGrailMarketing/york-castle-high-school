# Admin / staff portal

The people using this portal are teachers and office staff, not software users by
trade. Most of them open it a few times a term. Assume no one has been trained on it.

## Every page explains itself

A new page, or a significant new feature on an existing page, is not finished until
someone who has never seen it can work out what to do. That means:

1. **A `PAGE_HELP` entry in `src/help/content.ts`** — one sentence on what the page is
   for, then two to four things the user can actually do, naming the real controls
   ("tick the box in the header, then choose Select all N matching"). Add
   `<PageHelp pageKey="…" />` as the first child of the page.
2. **A `GLOSSARY` entry, plus `<Hint term="…" />` where the word first appears**, for any
   term that is school-specific or that we invented — "Section D", "3 sitting", "Ready
   for interview", "fully matriculated". If you had to read the code to know what a label
   meant, so will they.

`src/help/content.ts` is the only place this copy lives; the page panels and the Help &
Guide page both read from it, so they cannot drift apart.

Write for the reader: say what the thing is and what it is for, not what the field is
called. Flag anything irreversible where it happens — sending notifications emails real
applicants immediately.

## Roles

`allNavItems` in `src/components/Layout.tsx` is the source of truth for who sees what.
Anything else that offers a route — dashboard shortcuts, stat cards, help entries — must
filter on the same role strings, or a teacher gets offered a page that bounces them back
to the dashboard. `PAGE_HELP` entries carry a `roles` field for exactly this.

## Conventions

- `.field-hint` (defined once, in `src/index.css`) is the helper text under a form field.
- Page stylesheets are imported globally — a class name defined in two page CSS files
  will collide, and which one wins depends on route order. Check before naming.
