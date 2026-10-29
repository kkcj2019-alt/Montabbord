CREATE TABLE IF NOT EXISTS enterprise_data (
  enterprise_id TEXT NOT NULL,
  cle TEXT NOT NULL,
  valeur TEXT,
  updated_at TEXT,
  PRIMARY KEY (enterprise_id, cle)
);

CREATE TABLE IF NOT EXISTS enterprises (
  id TEXT PRIMARY KEY,
  identifiant TEXT,
  email TEXT,
  nom TEXT,
  data TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS enterprise_index (
  identifiant TEXT PRIMARY KEY,
  enterprise_id TEXT,
  nom TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  date TEXT,
  data TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data TEXT,
  updated_at TEXT,
  PRIMARY KEY (enterprise_id, user_id)
);
