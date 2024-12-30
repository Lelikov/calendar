ALTER TABLE users
  ALTER COLUMN "timeFormat" SET DEFAULT 24;

ALTER TABLE users
  ALTER COLUMN "weekStart" SET DEFAULT 'Monday';

ALTER TABLE users
  ALTER COLUMN "timeZone" SET DEFAULT 'Europe/Moscow';

ALTER TABLE users
  ALTER COLUMN "locale" SET DEFAULT 'ru';
