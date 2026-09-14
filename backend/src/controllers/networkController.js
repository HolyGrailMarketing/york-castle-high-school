import prisma from '../utils/prisma.js';

/**
 * The campus network port map - what network.html reads and writes.
 *
 * Seeded from NetworkDiagram_R1.xlsx, the spreadsheet this replaced. Every port
 * keeps the reading it was seeded with alongside its current one, so a
 * correction made on the page can always be traced back or undone; see the
 * sourceStatus/sourceConnection/sourceNote columns on NetworkPort.
 *
 * Everything here is ADMIN-only (enforced in routes/network.js). The map names
 * every switch, its uplinks and its free ports, which is precisely what someone
 * would want in order to attach to the network unnoticed.
 */

const VALID_STATUSES = ['USED', 'FREE', 'UPLINK', 'TRUNK', 'AP', 'UNKNOWN'];

/**
 * Point a port at a far end, keeping both sides of the cable in step.
 *
 * A cable has two ends and a port has at most one cable, so setting A->B has to
 * unhook whatever A and B were previously plugged into, or the map grows
 * one-directional ghosts that the diagram then draws as real links. Everything
 * happens in one transaction for that reason.
 *
 * `farPortId` null clears the cable. `farDeviceId` alone records "it goes to
 * that switch, nobody wrote down which port" - the state most of this data
 * arrived in.
 */
const relinkPort = async (portId, farPortId, farDeviceId, actor) => {
  return prisma.$transaction(async (tx) => {
    const port = await tx.networkPort.findUnique({ where: { id: portId } });
    if (!port) return null;

    let far = null;
    if (farPortId) {
      far = await tx.networkPort.findUnique({ where: { id: farPortId } });
      if (!far) throw Object.assign(new Error('far port not found'), { code: 'FAR_MISSING' });
      if (far.id === port.id) throw Object.assign(new Error('a port cannot link to itself'), { code: 'SELF_LINK' });
    }

    // Unhook the old partners on both sides before making the new pair.
    const detach = [port.linkedPortId, far ? far.linkedPortId : null].filter(
      (id) => id && id !== portId && id !== farPortId,
    );
    for (const id of detach) {
      await tx.networkPort.update({
        where: { id },
        data: { linkedPortId: null, linkedDeviceId: null },
      });
    }

    const stamp = { updatedById: actor.id, updatedByName: actor.name || actor.email };

    if (far) {
      await tx.networkPort.update({
        where: { id: far.id },
        data: { linkedPortId: port.id, linkedDeviceId: port.deviceId, ...stamp },
      });
      return tx.networkPort.update({
        where: { id: port.id },
        data: { linkedPortId: far.id, linkedDeviceId: far.deviceId, ...stamp },
      });
    }

    return tx.networkPort.update({
      where: { id: port.id },
      data: { linkedPortId: null, linkedDeviceId: farDeviceId || null, ...stamp },
    });
  });
};

// Rooms in the order they should appear on the page: the core first, then the
// closet that most needs attention, then the rest as the spreadsheet had them.
const ROOM_ORDER = [
  'E_LAB',
  'MAINOOFICE',
  'CAPE_LAB',
  'CAD_LAB',
  'Bis_Room',
  'Library',
  'Chill_Room',
];

const roomRank = (roomKey) => {
  const index = ROOM_ORDER.indexOf(roomKey);
  return index === -1 ? ROOM_ORDER.length : index;
};

const serializePort = (port) => ({
  id: port.id,
  position: port.position,
  label: port.label,
  connector: port.connector,
  status: port.status,
  connection: port.connection || '',
  note: port.note || '',
  // The cable. linkedPortId is the exact far end; linkedDeviceId is the far
  // device when nobody has recorded which of its ports. The diagram draws an
  // edge from either, so a half-known cable still appears - visibly half-known.
  linkedPortId: port.linkedPortId || null,
  linkedDeviceId: port.linkedDeviceId || null,
  source: {
    status: port.sourceStatus,
    connection: port.sourceConnection || '',
    note: port.sourceNote || '',
  },
  // A port is "edited" when it no longer matches what it was seeded with. Kept
  // server-side so the page and the CSV agree on what counts as a change.
  edited:
    port.status !== port.sourceStatus ||
    (port.connection || '') !== (port.sourceConnection || '') ||
    (port.note || '') !== (port.sourceNote || ''),
  updatedByName: port.updatedByName || null,
  updatedAt: port.updatedAt,
});

const countByStatus = (ports) => {
  const counts = { USED: 0, FREE: 0, UPLINK: 0, TRUNK: 0, AP: 0, UNKNOWN: 0 };
  ports.forEach((port) => { counts[port.status] += 1; });
  return counts;
};

/**
 * GET /api/network - the whole map in one response.
 *
 * 27 devices and 567 ports is around 150 KB of JSON, small enough that paging
 * would cost more in round trips than it saves; the page needs every room at
 * once to draw its summary bars anyway.
 */
export const getNetwork = async (req, res, next) => {
  try {
    const devices = await prisma.networkDevice.findMany({
      orderBy: [{ roomKey: 'asc' }, { sortOrder: 'asc' }],
      include: { ports: { orderBy: { position: 'asc' } } },
    });

    const byRoom = new Map();

    devices.forEach((device) => {
      if (!byRoom.has(device.roomKey)) {
        byRoom.set(device.roomKey, {
          key: device.roomKey,
          label: device.roomLabel,
          devices: [],
        });
      }
      byRoom.get(device.roomKey).devices.push({
        id: device.id,
        slug: device.slug,
        name: device.name,
        note: device.note || '',
        photoVerified: device.photoVerified,
        counts: countByStatus(device.ports),
        ports: device.ports.map(serializePort),
      });
    });

    const rooms = [...byRoom.values()].sort((a, b) => roomRank(a.key) - roomRank(b.key));

    const totals = { USED: 0, FREE: 0, UPLINK: 0, TRUNK: 0, AP: 0, UNKNOWN: 0 };
    let portCount = 0;
    let lastEdit = null;

    devices.forEach((device) => {
      device.ports.forEach((port) => {
        totals[port.status] += 1;
        portCount += 1;
        if (port.updatedByName && (!lastEdit || port.updatedAt > lastEdit)) {
          lastEdit = port.updatedAt;
        }
      });
    });

    res.json({
      rooms,
      summary: {
        deviceCount: devices.length,
        portCount,
        totals,
        lastEdit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/network/ports/:id - record what a port is actually doing.
 *
 * Partial: only the fields present in the body change, so the page can save a
 * status without clearing a note somebody else wrote.
 */
export const updatePort = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, connection, note, linkedPortId, linkedDeviceId } = req.body;

    const data = {};

    if (status !== undefined) {
      const next = String(status).toUpperCase();
      if (!VALID_STATUSES.includes(next)) {
        return res.status(400).json({
          error: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      data.status = next;
    }

    if (connection !== undefined) data.connection = String(connection).trim() || null;
    if (note !== undefined) data.note = String(note).trim() || null;

    const relinking = linkedPortId !== undefined || linkedDeviceId !== undefined;

    if (Object.keys(data).length === 0 && !relinking) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    data.updatedById = req.user.id;
    data.updatedByName = req.user.name || req.user.email;

    let port;
    if (Object.keys(data).length) {
      port = await prisma.networkPort.update({ where: { id }, data });
    }

    if (relinking) {
      port = await relinkPort(id, linkedPortId || null, linkedDeviceId || null, req.user);
      if (!port) return res.status(404).json({ error: 'Port not found' });
    }

    res.json({ message: 'Port updated', port: serializePort(port) });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Port not found' });
    if (error.code === 'FAR_MISSING') return res.status(400).json({ error: 'That port does not exist' });
    if (error.code === 'SELF_LINK') return res.status(400).json({ error: 'A port cannot be linked to itself' });
    next(error);
  }
};

/**
 * POST /api/network/ports/:id/reset - put a port back to the reading it was
 * seeded with, for when a correction turns out to have been the wrong call.
 */
export const resetPort = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.networkPort.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Port not found' });
    }

    const port = await prisma.networkPort.update({
      where: { id },
      data: {
        status: existing.sourceStatus,
        connection: existing.sourceConnection,
        note: existing.sourceNote,
        updatedById: null,
        updatedByName: null,
      },
    });

    res.json({ message: 'Port reset to its original record', port: serializePort(port) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/network/export.csv - the whole map as a spreadsheet again, for
 * anyone who still wants it in Excel.
 */
export const exportNetworkCsv = async (req, res, next) => {
  try {
    const devices = await prisma.networkDevice.findMany({
      orderBy: [{ roomKey: 'asc' }, { sortOrder: 'asc' }],
      include: { ports: { orderBy: { position: 'asc' } } },
    });

    const escape = (value) => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = [
      ['Room', 'Device', 'Port No', 'Port Type', 'Status', 'Connection', 'Description', 'Updated by', 'Updated'],
    ];

    devices
      .sort((a, b) => roomRank(a.roomKey) - roomRank(b.roomKey) || a.sortOrder - b.sortOrder)
      .forEach((device) => {
        device.ports.forEach((port) => {
          rows.push([
            device.roomLabel,
            device.name,
            port.label,
            port.connector,
            port.status,
            port.connection || '',
            port.note || '',
            port.updatedByName || '',
            port.updatedByName ? port.updatedAt.toISOString() : '',
          ]);
        });
      });

    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="network-map-${stamp}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
