-- How long an appointment is expected to take, used for the calendar entry.
ALTER TABLE "appointments" ADD COLUMN "durationMins" INTEGER NOT NULL DEFAULT 60;
