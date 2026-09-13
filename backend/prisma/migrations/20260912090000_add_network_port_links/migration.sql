-- Port-to-port links, so the topology diagram is drawn from the records rather
-- than hand-authored beside them and left to drift.
--
-- Two levels of precision, because the survey genuinely has both:
--   linkedPortId   - the exact cable, both ends known. UNIQUE: a port has at
--                    most one cable and it is never shared.
--   linkedDeviceId - the far device is known but nobody recorded which of its
--                    ports. Kept so the diagram can still draw the edge while
--                    the missing half stays visible (it renders dashed).
-- Anything that is not a switch on this page - a desktop, an access point, the
-- ISP, a whole room - stays in the free-text "connection" column.

ALTER TABLE "NetworkPort" ADD COLUMN "linkedPortId" TEXT;
ALTER TABLE "NetworkPort" ADD COLUMN "linkedDeviceId" TEXT;

CREATE UNIQUE INDEX "NetworkPort_linkedPortId_key" ON "NetworkPort"("linkedPortId");
CREATE INDEX "NetworkPort_linkedDeviceId_idx" ON "NetworkPort"("linkedDeviceId");

ALTER TABLE "NetworkPort" ADD CONSTRAINT "NetworkPort_linkedPortId_fkey"
  FOREIGN KEY ("linkedPortId") REFERENCES "NetworkPort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NetworkPort" ADD CONSTRAINT "NetworkPort_linkedDeviceId_fkey"
  FOREIGN KEY ("linkedDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
