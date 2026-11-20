-- 项目库：一个项目一个 db（剧集、素材、片段、槽、关键帧、任务）。
-- schema v1，一次建库。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS episodes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  order_index   INTEGER NOT NULL,
  dir_path      TEXT,
  server_id     TEXT,
  series_sha256 TEXT NOT NULL DEFAULT '',
  -- 本集资产清单（series.json 的 assets：这集要画哪些人物/场景）。
  series_assets TEXT NOT NULL DEFAULT '[]',
  -- 1 = 手工创建的「自定义剧集」：没有 series.json，允许手动加片段
  custom        INTEGER NOT NULL DEFAULT 0,
  synced_at     TEXT,
  created_at    TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS assets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL CHECK (type IN ('image','video','audio')),
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  duration    REAL,
  width       INTEGER,
  height      INTEGER,
  fps         REAL,
  has_audio   INTEGER NOT NULL DEFAULT 0,
  library     TEXT NOT NULL DEFAULT 'project' CHECK (library IN ('project','episode')),
  episode_id  TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  transient   INTEGER NOT NULL DEFAULT 0,
  revision    INTEGER NOT NULL DEFAULT 0,
  aliases     TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS assets_library ON assets(library, episode_id);

CREATE TABLE IF NOT EXISTS asset_images (
  id          TEXT PRIMARY KEY,
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL UNIQUE,
  prompt      TEXT,
  workflow_id TEXT,
  seed        INTEGER,
  active      INTEGER NOT NULL DEFAULT 0,
  size        INTEGER NOT NULL,
  episode_id  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS episode_assets (
  episode_id TEXT NOT NULL,
  asset_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (episode_id, asset_id)
) STRICT;

CREATE TABLE IF NOT EXISTS clips (
  id                   TEXT PRIMARY KEY,
  episode_id           TEXT NOT NULL,
  order_index          INTEGER NOT NULL,
  series_key           TEXT NOT NULL DEFAULT '',
  mode                 TEXT NOT NULL CHECK (mode IN ('frames','reference')),
  prompt               TEXT NOT NULL DEFAULT '',
  prompt_en            TEXT NOT NULL DEFAULT '',
  duration             REAL NOT NULL,
  fps                  REAL,
  scale                REAL,
  ratio                TEXT,
  resolution           TEXT,
  seed                 INTEGER,
  first_pass_steps     INTEGER,
  second_pass          INTEGER NOT NULL DEFAULT 0,
  first_pass_tiled     INTEGER NOT NULL DEFAULT 0,
  second_pass_tiled    INTEGER NOT NULL DEFAULT 0,
  second_denoise       REAL,
  second_scale         REAL,
  second_steps         INTEGER,
  continue_from_prev   INTEGER NOT NULL DEFAULT 0,
  first_frame_from_prev INTEGER NOT NULL DEFAULT 0,
  guide_frame_count    INTEGER,
  first_frame_asset_id TEXT,
  last_frame_asset_id  TEXT,
  workflow_id          TEXT,
  loras                TEXT NOT NULL DEFAULT '[]',
  status               TEXT NOT NULL DEFAULT 'pending',
  result_video_path    TEXT,
  -- 独立二采放大完成的时间；非空 = 这段成片已经放大过（右栏按钮显绿）。
  second_pass_at       TEXT,
  generation_ms        INTEGER,
  error_message        TEXT,
  submission_json      TEXT NOT NULL DEFAULT '{}',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS clips_series_key ON clips(episode_id, series_key) WHERE series_key <> '';
CREATE INDEX IF NOT EXISTS clips_order ON clips(episode_id, order_index);

-- 每段生成过的成片历史：不覆盖，一次生成一条；active=1 的那条就是当前成片。
CREATE TABLE IF NOT EXISTS clip_videos (
  id         TEXT PRIMARY KEY,
  clip_id    TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  -- first / second / upscale / interp
  kind       TEXT NOT NULL,
  -- 尺寸：480P / 720P / 2K / 4K / 1 MP …
  label      TEXT NOT NULL DEFAULT '',
  active     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS clip_videos_clip ON clip_videos(clip_id, created_at);

CREATE TABLE IF NOT EXISTS clip_refs (
  clip_id      TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  position     INTEGER NOT NULL,
  asset_id     TEXT,
  asset_name   TEXT NOT NULL DEFAULT '',
  role         TEXT,
  window_start REAL,
  window_end   REAL,
  note         TEXT,
  PRIMARY KEY (clip_id, kind, position)
) STRICT;

-- 片段素材清单：series.json 的 clips[].slots[] 落库后的形态。
CREATE TABLE IF NOT EXISTS clip_slots (
  clip_id     TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  slot_key    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('first','keyframe','last','board')),
  n           INTEGER,
  at_seconds  REAL,
  frame_index INTEGER,
  prompt      TEXT NOT NULL DEFAULT '',
  -- 这一槽生图时该挂哪些参考图（series 的 slots[].imageRefs，按 <image1..N> 顺序存文件名）。
  image_refs  TEXT NOT NULL DEFAULT '[]',
  asset_id    TEXT,
  keyframe_id TEXT,
  source      TEXT NOT NULL DEFAULT 'series',
  PRIMARY KEY (clip_id, slot_key)
) STRICT;

-- 片段草稿图：生成的图先挂在片段上，确认后入库成素材。
CREATE TABLE IF NOT EXISTS clip_drafts (
  id          TEXT PRIMARY KEY,
  clip_id     TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL,
  prompt      TEXT NOT NULL DEFAULT '',
  workflow_id TEXT NOT NULL DEFAULT '',
  seed        INTEGER,
  size        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
) STRICT;

-- 剧集草稿图：与片段草稿同构，只是上级换成剧集（本集人物图/场景图的草稿）。
-- 单独一张表，是为了不动 clip_drafts 的外键与已有数据。
CREATE TABLE IF NOT EXISTS episode_drafts (
  id          TEXT PRIMARY KEY,
  episode_id  TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL,
  prompt      TEXT NOT NULL DEFAULT '',
  workflow_id TEXT NOT NULL DEFAULT '',
  seed        INTEGER,
  size        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS keyframes (
  id            TEXT PRIMARY KEY,
  clip_id       TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  slot_key      TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL,
  frame_index   INTEGER NOT NULL,
  prompt        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'planned',
  seed          INTEGER,
  revision      INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at    TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS keyframes_slot ON keyframes(clip_id, slot_key) WHERE slot_key <> '';

CREATE TABLE IF NOT EXISTS jobs (
  id            TEXT PRIMARY KEY,
  clip_id       TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL CHECK (kind IN ('clip','keyframe','picture')),
  slot_key      TEXT,
  asset_id      TEXT,
  server_id     TEXT NOT NULL,
  prompt_id     TEXT,
  status        TEXT NOT NULL,
  error         TEXT,
  queued_at     TEXT NOT NULL,
  started_at    TEXT,
  finished_at   TEXT,
  generation_ms INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS jobs_clip ON jobs(clip_id, queued_at);
