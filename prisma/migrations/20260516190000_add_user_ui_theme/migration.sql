-- Add per-user UI theme preference.
CREATE TYPE "UiTheme" AS ENUM ('ORANGE', 'TEAL', 'BLUE', 'EMERALD', 'VIOLET', 'SLATE');

ALTER TABLE "User"
  ADD COLUMN "uiTheme" "UiTheme" NOT NULL DEFAULT 'ORANGE';
