-- Adjust job image slot constraint to allow 0-based ordering (0..4 => 5 slots)
ALTER TABLE `JobImage`
  DROP CONSTRAINT JobImage_slot_check;

ALTER TABLE `JobImage`
  ADD CONSTRAINT JobImage_slot_check CHECK (`slot` BETWEEN 0 AND 4);
