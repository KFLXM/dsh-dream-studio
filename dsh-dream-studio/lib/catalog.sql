-- 目录库：跨项目的那部分（项目登记、ComfyUI 服务、工作流、设置）。
-- schema v1，一次建库；不再有增量迁移。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS projects (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  path               TEXT NOT NULL UNIQUE,
  created_at         TEXT NOT NULL,
  -- 项目级默认画幅与分辨率：新建片段时作初值，右栏没改过的片段也显示它。
  default_ratio      TEXT NOT NULL DEFAULT '16:9',
  default_resolution TEXT NOT NULL DEFAULT '1080P'
) STRICT;

CREATE TABLE IF NOT EXISTS servers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  base_url   TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('local','remote','cloud')),
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  family      TEXT NOT NULL CHECK (family IN ('film','picture')),
  modes       TEXT NOT NULL DEFAULT '[]',
  kind        TEXT NOT NULL,
  profile_id  TEXT NOT NULL,
  graph       TEXT NOT NULL,
  param_map   TEXT NOT NULL DEFAULT '{}',
  customized  INTEGER NOT NULL DEFAULT 0,
  builtin     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workflow_bindings (
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  server_id   TEXT NOT NULL,
  overrides   TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (workflow_id, server_id)
) STRICT;

CREATE TABLE IF NOT EXISTS workflow_defaults (
  mode        TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
