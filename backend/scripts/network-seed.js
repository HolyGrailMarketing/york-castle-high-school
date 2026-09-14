/**
 * Seed (or re-seed) the campus network port map.
 *
 *   npm run network:seed            # add anything missing, leave edits alone
 *   npm run network:seed -- --reset # also discard corrections made on the page
 *
 * The data file is the September 2026 state of NetworkDiagram_R1.xlsx, with the
 * E-Lab rack corrected against a photograph: the Cisco SG300-10MP in the sheet
 * is really a Catalyst 1300, an undocumented 24-port NETGEAR carries much of the
 * building, and the Dream Machine Pro's downlinks are no longer patched.
 *
 * Devices and ports are upserted on their natural keys (slug, and deviceId +
 * position), so running this twice is safe. By default an existing port keeps
 * whatever an admin has since recorded on it and only its *source* columns are
 * refreshed - re-running after a data-file fix will not wipe a week of survey
 * work. Pass --reset to overwrite the live values too.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../prisma/network-seed-data.json');

const reset = process.argv.includes('--reset');

async function main() {
  const devices = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  let deviceCount = 0;
  let portCount = 0;

  for (const device of devices) {
    const record = await prisma.networkDevice.upsert({
      where: { slug: device.slug },
      update: {
        name: device.name,
        roomKey: device.roomKey,
        roomLabel: device.roomLabel,
        sortOrder: device.sortOrder,
        note: device.note,
        photoVerified: device.photoVerified,
      },
      create: {
        slug: device.slug,
        name: device.name,
        roomKey: device.roomKey,
        roomLabel: device.roomLabel,
        sortOrder: device.sortOrder,
        note: device.note,
        photoVerified: device.photoVerified,
      },
    });
    deviceCount += 1;

    for (const port of device.ports) {
      // The source columns are the seed's own record of what the survey found;
      // they are refreshed on every run. The live columns are only set on
      // create, or when --reset says to throw corrections away.
      const source = {
        label: port.label,
        connector: port.connector,
        sourceStatus: port.status,
        sourceConnection: port.connection,
        sourceNote: port.note,
      };

      const live = {
        status: port.status,
        connection: port.connection,
        note: port.note,
        updatedById: null,
        updatedByName: null,
      };

      await prisma.networkPort.upsert({
        where: { deviceId_position: { deviceId: record.id, position: port.position } },
        update: reset ? { ...source, ...live } : source,
        create: { deviceId: record.id, position: port.position, ...source, ...live },
      });
      portCount += 1;
    }
  }

  // A device dropped from the data file is almost always a rename, which the
  // upsert above has already inserted under its new slug. Deleting the old row
  // is left to a human - it would take its ports' corrections with it.
  const orphans = await prisma.networkDevice.findMany({
    where: { slug: { notIn: devices.map((d) => d.slug) } },
    select: { slug: true, name: true },
  });

  console.log(`Seeded ${deviceCount} devices and ${portCount} ports${reset ? ' (corrections reset)' : ''}.`);
  if (orphans.length) {
    console.log('\nIn the database but not in the data file - delete by hand if they are gone for good:');
    orphans.forEach((o) => console.log(`  ${o.slug}  (${o.name})`));
  }
}

main()
  .catch((error) => {
    console.error('Network seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
