# Network Map — handoff

Status as of 2026-09-12. The feature is **written, migrated and seeded**. What is
left is two local commands and a deploy — see [Pick up here](#pick-up-here).

A page at `/network.html` holding two views of the same data: a **topology
diagram generated from the recorded cables**, and a faceplate picture of every
switch where an administrator clicks a port to record what is plugged into it.
It replaces `NetworkDiagram_R1.xlsx`, which is now only a historical record.

The point of the design is that the diagram is not a separate drawing. It is
computed from the port records every time the page renders, so it cannot drift
out of step with them — which is exactly how the spreadsheet went wrong.

---

## Pick up here

Nothing below this line has been run on a developer machine. The database is
already migrated and seeded, so do **not** run `prisma migrate dev` expecting it
to create anything.

```bash
# 1. Teach the Prisma client about the two new models.
#    Without this the API throws "prisma.networkDevice is not a function".
npx prisma generate --schema=backend/prisma/schema.prisma

# 2. Inject the shared header/footer into network.html.
#    The file currently has empty BEGIN/END SHARED NAV|FOOTER regions.
npm run site:partials

# 3. Run it and sign in as an ADMIN user, then open /network.html
npm run dev
```

Then deploy. Vercel's `installCommand` already runs `prisma generate`, so
production picks the client up on its own.

### Verify it works

- `/network.html` while signed out → "Administrators only" gate, no data.
- Signed in as STAFF → "limited to administrator accounts", still no data.
- Signed in as ADMIN → 27 devices, 567 ports, 95 free, 135 needing checking.
- Click any port, change its status, Save → the square changes colour and grows
  a gold dot. Reload: the change persisted.
- **Undo to original** appears only on a port that differs from its seeded
  reading, and removes the gold dot.

---

## What exists

### Database

| Object | Notes |
| --- | --- |
| `NetworkPortStatus` | `USED FREE UPLINK TRUNK AP UNKNOWN` |
| `NetworkDevice` | 27 rows. `slug` is the natural key the seed upserts on. |
| `NetworkPort` | 567 rows. Natural key is `(deviceId, position)`. Carries the cable — see below. |

**The cable columns are what make the diagram editable.**

| Column | Meaning |
| --- | --- |
| `linkedPortId` | The exact far port. `UNIQUE`, so a port has at most one cable and it is never shared. Always written to both ends together. |
| `linkedDeviceId` | The far *device*, when nobody recorded which of its ports. Set automatically whenever `linkedPortId` is. |

A cable with both ends known draws a solid line; one with only the far device
draws dashed. Anything that is not a switch on this page — a desktop, an access
point, the ISP, a whole room — stays in the free-text `connection` column and is
not a link. Currently **9 cables** are exact and **3** are device-only.

Every port stores its state **twice**: `status`/`connection`/`note` is what is
true now, and `sourceStatus`/`sourceConnection`/`sourceNote` is the reading it
was seeded with. That pair is what powers "Originally recorded as ..." under the
editor and the **Undo to original** button, and it is why a helper can correct
records without anybody losing the original survey. Treat the `source*` columns
as owned by the seed script — nothing in the API writes them.

### API — `/api/network`, ADMIN only

`backend/src/routes/network.js` mounts `authenticate` then `authorize('ADMIN')`
for the whole router. There is deliberately **no public route** here, unlike
`booklist`: the map names every switch, its uplinks and its free ports.

| Method | Path | Does |
| --- | --- | --- |
| GET | `/api/network` | Whole map, grouped by room, with per-device counts. ~150 KB. |
| GET | `/api/network/export.csv` | The same data as a spreadsheet download. |
| PUT | `/api/network/ports/:id` | Partial update of `status`, `connection`, `note`, and the cable (`linkedPortId` / `linkedDeviceId`). Stamps `updatedById`/`updatedByName`. |
| POST | `/api/network/ports/:id/reset` | Restores the port to its `source*` values and clears the updater. |

`serializePort()` in the controller computes `edited` server-side so the page and
the CSV agree on what counts as a change.

`relinkPort()` is the one place cables are written. It runs in a transaction and
detaches whatever both ports were previously plugged into before making the new
pair, because a cable has two ends and skipping that leaves one-directional
ghosts the diagram then draws as real links. **Do not write `linkedPortId`
directly** — go through it, or symmetry breaks.

### Page — `network.html`

Plain HTML at the repo root, like `booklist.html`. No build step, no framework.
All CSS is `ycn-` prefixed so nothing collides with the Webflow theme; the
palette continues the ink/gold/cream tokens from `booklist.html` and
`signin.html`. Registered as `'minimal'` in `scripts/build-partials.js`.

The thirteen open questions are **commentary, not records**, so they live as a
`CONTENT` object inside the page's script. Everything else — including the whole
diagram — comes from the database.

`drawDiagram()` builds the picture each render: it finds the devices facing the
ISP (a port whose free-text connection names FLOW or Starlink), walks outward
over the cables to get each device's distance from there, and lays the tiers out
in SVG. Devices no cable reaches are not hidden — they go in a final *"not joined
to the core on paper"* band, grouped into the clusters they *are* cabled to. That
band is the most useful thing on the page: 20 switches currently sit there, and
each one is a room whose uplink nobody has written down.

---

## Files

Added:

```
network.html
backend/src/controllers/networkController.js
backend/src/routes/network.js
backend/scripts/network-seed.js
backend/prisma/network-seed-data.json
backend/prisma/migrations/20260910120000_add_network_map/migration.sql
supabase/migrations/20260910120500_enable_rls_network_tables.sql
```

Edited:

```
backend/prisma/schema.prisma   models appended at the end
backend/src/server.js          import + app.use('/api/network', networkRoutes)
package.json                   "network:seed" script
scripts/build-partials.js      'network.html': 'minimal'
```

---

## Things that will bite you

**The migration was applied out-of-band.** There was no working shell on the dev
machine, so the SQL went to Supabase directly and a matching row was inserted
into `_prisma_migrations` by hand (with the real SHA-256 of `migration.sql`, the
equivalent of `prisma migrate resolve --applied`). Prisma therefore considers
`20260910120000_add_network_map` already applied. If you edit that migration file
the checksum will no longer match and Prisma will complain — write a new
migration instead.

**`updatedAt` has no database default, on purpose.** Prisma sets `@updatedAt`
client-side. A `DEFAULT now()` was added temporarily to get the raw seed INSERTs
through and then dropped again, so the live schema matches the migration file
exactly. Any raw SQL you write against `NetworkPort` must supply `updatedAt`
itself.

**Re-seeding is safe and does not clobber corrections.** `npm run network:seed`
upserts on the natural keys and, for a port that already exists, refreshes only
the `source*` columns. A week of an administrator's survey work survives a
re-seed after a data-file fix. `npm run network:seed -- --reset` is the explicit
opt-in to throw corrections away.

**RLS is deny-by-default with no policies**, matching
`20260723133201_enable_rls_all_public_tables.sql`. The Security Advisor lists
both tables under INFO-level `rls_enabled_no_policy` alongside the other 18
tables. That is expected — all access is through the Express backend as
`postgres`, which bypasses RLS. Do not "fix" it by adding PostgREST policies.

**Marking a port Free clears its connection and note fields** in the editor, so a
released port does not keep the old cable's description. Deliberate.

**Saving a cable refetches the whole map rather than patching state in place.**
One save can touch four ports (the new pair, plus whatever each end was detached
from), so patching locally would leave the diagram wrong until reload. If you
optimise this later, handle the detachments.

**Two migrations were applied out-of-band**, not one — `20260910120000_add_network_map`
and `20260912090000_add_network_port_links`. Both are registered in
`_prisma_migrations` with real checksums. Same warning applies to each: edit the
file and the checksum stops matching.

---

## Where the data came from

`NetworkDiagram_R1.xlsx` — seven sheets, 539 rows — plus a photograph of the
E-Lab rack taken in September 2026. Where the two disagreed, the photograph won.
That accounts for the difference between 539 spreadsheet rows and 567 seeded
ports:

- The sheet's **Cisco SG300-10MP** is really a **Cisco Catalyst 1300** (12 ports
  modelled, against 10 in the sheet).
- A **NETGEAR ProSafe 24-port** switch carrying much of the building appears
  nowhere in the sheet. Added with 26 ports, all `UNKNOWN`.
- The **Dream Machine Pro**'s ports 3–8 are physically empty, though the sheet
  has them feeding five downstream switches.
- The **Juniper SRX320** downlink moved 0/3 → 0/2; the **Aruba 1830** uplink
  moved 7 → 8.
- 122 placeholder `"Unused"` / `"?"` strings were cleared to NULL, so
  "connected to" means something when it is filled in.

The 12 cables now on record were inferred from that spreadsheet text — strings
like `"Juniper SRX320 port 0/0"` matched back to real devices and ports, scoped
to the room first so the four different switches all called *"PoE Switch"* did
not get confused with each other. Three came out device-only because the far port
was never written down, and those three are precisely the links the rack
photograph invalidated.

The thirteen open questions on the page are the unresolved gaps, hardest first.
The biggest by far: **Main Office has 102 ports and no connection data at all.**
In diagram terms, that is why all six Main Office switches sit in the unjoined
band.
