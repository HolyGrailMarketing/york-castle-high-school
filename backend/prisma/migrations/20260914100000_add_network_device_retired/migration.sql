-- Retiring hardware instead of deleting it.
--
-- A switch that comes out of a rack still explains what the records used to
-- say, and its ports may be the only note of where a cable went. Deleting the
-- row would cascade those ports away and take the history with them, so a
-- swapped-out unit is stamped retired and simply drops out of the map, the
-- diagram and the CSV export.

ALTER TABLE "NetworkDevice" ADD COLUMN "retiredAt" TIMESTAMP(3);
CREATE INDEX "NetworkDevice_retiredAt_idx" ON "NetworkDevice"("retiredAt");
