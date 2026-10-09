CREATE TABLE IF NOT EXISTS dataset_direct_arrivals (
  dataset_id TEXT NOT NULL,
  arrival_date TEXT NOT NULL,
  arrivals INTEGER NOT NULL CHECK (arrivals > 0),
  PRIMARY KEY (dataset_id, arrival_date)
);
