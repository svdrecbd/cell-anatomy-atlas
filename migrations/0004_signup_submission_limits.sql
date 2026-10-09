CREATE TABLE IF NOT EXISTS signup_submission_limits (
  scope_identifier TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  submissions INTEGER NOT NULL CHECK (submissions > 0),
  PRIMARY KEY (scope_identifier, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_signup_submission_limits_window
  ON signup_submission_limits (window_started_at);
