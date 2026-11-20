import { basename, delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, request } from "node:http";
import { request as request$1 } from "node:https";
import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
/** 数据根下的插件目录名。 */
const DATA_FOLDER = "dream-studio";
/** 目录库文件名。 */
const CATALOG_DB_FILE = "catalog.db";
/**
* 项目库文件名。
*
* 与旧插件的 `project.db` 明确分开：in-place 导入时两者住在同一个项目目录里，
* 同名会让新库的 CREATE TABLE 落到旧库头上（已踩过一次）。
*/
const PROJECT_DB_FILE = "dream-studio.db";
/** 项目目录下的素材目录。 */
const ASSET_FOLDER = "assets";
/** 资产图重绘历史目录（在 assets 下）。 */
const ASSET_IMAGE_FOLDER = "asset-images";
/** 关键帧图目录（在 assets 下）。 */
const KEYFRAME_FOLDER = "keyframes";
/** 剧集目录下的本集素材目录。 */
const EPISODE_MATERIAL_FOLDER = "material";
/** skill 产出的系列文档。 */
const SERIES_FILE = "series.json";
/** 片段包文件名。 */
const CLIPS_FILE = "clips.json";
/** 片段草稿图的子目录（`<项目>/assets/drafts/<clipId>/`）。 */
const DRAFT_FOLDER = "drafts";
// ../shared/lib/enums.js
/**
* 时空造梦的共享枚举与取值表。
*
* Host 与 Client 都从这里取"有哪些值"，因此这里的字面量就是数据库与 API 的契约。
* 旧插件的 `i2v` / `r2v` / `t2v` 只保留在 `legacyMode` 里，用于读旧库，不再出现在新代码里。
* @module @shikong-zaomeng/shared/enums
*/
/** 全部片段模式，按 UI 顺序。 */
const CLIP_MODES = ["frames", "reference"];
/**
* 把旧库里的模式映射成新值。
*
* 旧版把"文生视频"作为独立模式，新项目只内置 3 条工作流且没有文生视频模板，
* 因此 `t2v` 落到 `frames`（它同样只有首帧条件，可在右栏手动清空）。
* @param value - 旧库里读到的模式。
* @returns 新模式下对应的值。
*/
function fromLegacyMode(value) {
	if (value === "r2v") return "reference";
	return "frames";
}
// ../shared/lib/types/catalog.js
/** 空配置：全用模板自带值（新库默认）。 */
const EMPTY_WORKFLOW_MODELS = { templates: {} };
// ../shared/lib/view-model.js
/**
* 由短边档位与画幅推出画布。
* @param shortSide - 短边像素（480 / 540 / 1080 / 2160）。
* @param ratio - `width:height`。
* @returns 16 对齐的宽高。
*/
function resolutionForShortSide(shortSide, ratio) {
	const aspect = aspectOf(ratio);
	const side = Math.max(16, Math.round(shortSide));
	return aspect >= 1 ? {
		width: snap16(side * aspect),
		height: snap16(side)
	} : {
		width: snap16(side),
		height: snap16(side / aspect)
	};
}
/**
* 解析 `width:height`，非法值退回 16:9。
* @param ratio - 画幅字符串。
* @returns 宽高比。
*/
function aspectOf(ratio) {
	const [rawWidth, rawHeight] = ratio.split(":");
	const widthUnits = Number(rawWidth);
	const heightUnits = Number(rawHeight);
	return Number.isFinite(widthUnits) && Number.isFinite(heightUnits) && widthUnits > 0 && heightUnits > 0 ? widthUnits / heightUnits : 16 / 9;
}
/**
* 16 对齐并保证不小于 16。
* @param value - 原始像素。
* @returns 对齐后的像素。
*/
function snap16(value) {
	return Math.max(16, Math.round(value / 16) * 16);
}
// lib/types/graph/template-models.js
/**
* 工作流模板里的"模型槽位"：发现、覆盖、以及 LoRA 链的替换与追加。
*
* 设置页按模板分页签，每页列出该模板里所有需要选模型的输入（主模型 / CLIP / VAE /
* 音频 VAE / 补帧模型……）。这里不写死节点 id，而是按**节点类名 + 输入名**识别，
* 所以模板改连线、加节点都不会让配置串位。
* @module dsh-dream-studio-host/graph/template-models
*/
/** 各类加载器上"可选模型"的输入。 */
const SLOT_RULES = {
	UNETLoader: [{
		input: "unet_name",
		label: "主模型",
		folders: ["unet", "diffusion_models"]
	}],
	CheckpointLoaderSimple: [{
		input: "ckpt_name",
		label: "模型（Checkpoint）",
		folders: ["checkpoints"]
	}],
	CLIPLoader: [{
		input: "clip_name",
		label: "文本编码器 / CLIP",
		folders: ["text_encoders", "clip"]
	}],
	VAELoader: [{
		input: "vae_name",
		label: "VAE",
		folders: ["vae"]
	}],
	MiniMaxH3EasyLoader: [
		{
			input: "fl2va_model",
			label: "主模型（FL2VA）",
			folders: ["unet", "diffusion_models"]
		},
		{
			input: "ref2va_model",
			label: "参考模型（Ref2VA）",
			folders: ["unet", "diffusion_models"]
		},
		{
			input: "text_encoder",
			label: "文本编码器",
			folders: ["text_encoders", "clip"]
		},
		{
			input: "video_vae",
			label: "视频 VAE",
			folders: ["vae"]
		},
		{
			input: "audio_vae",
			label: "音频 VAE",
			folders: ["vae"]
		}
	],
	FrameInterpolationModelLoader: [{
		input: "model_name",
		label: "补帧模型",
		folders: ["frame_interpolation", "vae"]
	}],
	LatentUpscaleModelLoader: [{
		input: "model_name",
		label: "放大模型",
		folders: ["latent_upscale_models", "upscale_models"]
	}]
};
/** LoRA 加载器的类名。 */
const LORA_TYPES = ["LoraLoader", "LoraLoaderModelOnly"];
/**
* 一个槽位能选的全部模型名：把它的每个候选目录合起来去重排序。
*
* 只看第一个目录是不够的——ComfyUI 现在把底模放在 `diffusion_models`、文本编码器放在
* `text_encoders`，`unet`/`clip` 这些旧目录并不存在，返回空列表会让设置页的下拉框里
* 只剩当前值一项，看起来就是"选不了"。
* @param listing - 目录名 → 该目录下的文件名。
* @param slot - 槽位。
* @returns 去重并排序后的候选。
*/
function slotOptions(listing, slot) {
	const merged = /* @__PURE__ */ new Set();
	for (const folder of slot.folders) for (const name of listing[folder] ?? []) merged.add(name);
	return [...merged].sort();
}
/**
* 找出模板里所有可选的模型输入。
* @param graph - 模板图。
* @returns 按节点出现顺序排列的槽位。
*/
function discoverTemplateSlots(graph) {
	const hasEasy = Object.values(graph).some((node) => node.class_type === "MiniMaxH3EasyLoader");
	const slots = [];
	for (const [id, value] of Object.entries(graph)) {
		const node = value;
		const rules = SLOT_RULES[node.class_type];
		if (rules === void 0) continue;
		for (const rule of rules) {
			const current = node.inputs[rule.input];
			if (typeof current !== "string") continue;
			const label = node.class_type === "UNETLoader" && hasEasy ? "二采主模" : rule.label;
			const folders = rule.folders.length === 0 ? ["vae"] : rule.folders;
			slots.push({
				key: `${id}:${rule.input}`,
				label,
				current,
				folder: folders[0] ?? "vae",
				folders
			});
		}
	}
	return slots;
}
/**
* 这个模板的 LoRA 是否"一采/二采各挂一个、必须一致"。
*
* 全能工作流有两段模型链：一采走 EasyLoader、二采走 UNETLoader，各自挂一条加速 LoRA，
* 两条必须同名同强度才能保证两采口径一致。这里判定为 true 后，设置页只让配一份，
* 落地时写进所有 LoRA 节点。
* @param graph - 模板图。
* @returns 是否按"同一份 LoRA 挂到每段链"处理。
*/
function lorasAreMirrored(graph) {
	const values = Object.values(graph);
	if (!values.some((node) => node.class_type === "MiniMaxH3EasyLoader")) return false;
	return values.filter((node) => LORA_TYPES.includes(node.class_type)).length >= 2;
}
/**
* 模板里现有的 LoRA 配方（按出现顺序）。
* @param graph - 模板图。
* @returns 每条 LoRA 的文件名与强度。
*/
function templateLoras(graph) {
	const loras = [];
	for (const value of Object.values(graph)) {
		const node = value;
		if (!LORA_TYPES.includes(node.class_type)) continue;
		const name = node.inputs["lora_name"];
		if (typeof name !== "string" || name === "") continue;
		const strength = typeof node.inputs["strength_model"] === "number" ? node.inputs["strength_model"] : 1;
		loras.push({
			name,
			strength
		});
	}
	return loras;
}
/** 拆 `节点id:输入名`（从右边切，节点 id 里允许有冒号）。 */
function splitKey(key) {
	const at = key.lastIndexOf(":");
	if (at <= 0) return null;
	return [key.slice(0, at), key.slice(at + 1)];
}
/**
* 把一份配置写进模板图。
*
* 1. 模型槽位：只改值，不动连线；节点已经不存在的键直接忽略。
* 2. LoRA：按出现顺序替换；配置比加载器多时克隆最后一个加载器接到链尾，
*    并把原来读它的节点改读克隆节点（"手动加 LoRA" 就靠这一步）。
* @param graph - 模板图（会被就地修改）。
* @param config - 这一份模板的配置；没配就原样返回。
* @returns 同一个图。
*/
function applyTemplateModels(graph, config) {
	if (config === void 0) return graph;
	const target = graph;
	for (const [key, value] of Object.entries(config.slots)) {
		const parts = splitKey(key);
		if (parts === null) continue;
		const node = target[parts[0]];
		if (node === void 0) continue;
		if (!(parts[1] in node.inputs)) continue;
		node.inputs[parts[1]] = value;
	}
	if (config.loras.length === 0) return graph;
	const loraIds = Object.entries(target).filter(([, node]) => LORA_TYPES.includes(node.class_type)).map(([id]) => id);
	if (loraIds.length === 0) return graph;
	if (lorasAreMirrored(graph)) {
		const lora = config.loras[0];
		if (lora === void 0) return graph;
		for (const id of loraIds) {
			const node = target[id];
			if (node === void 0) continue;
			node.inputs["lora_name"] = lora.name;
			node.inputs["strength_model"] = lora.strength;
		}
		return graph;
	}
	const used = Math.min(loraIds.length, config.loras.length);
	for (let index = 0; index < used; index += 1) {
		const node = target[loraIds[index]];
		const lora = config.loras[index];
		if (node === void 0 || lora === void 0) continue;
		node.inputs["lora_name"] = lora.name;
		node.inputs["strength_model"] = lora.strength;
	}
	for (const id of loraIds.slice(used)) {
		const node = target[id];
		if (node === void 0) continue;
		node.mode = 4;
	}
	let tailId = loraIds[loraIds.length - 1];
	for (let index = loraIds.length; index < config.loras.length; index += 1) {
		const lora = config.loras[index];
		if (lora === void 0) break;
		const tail = target[tailId];
		if (tail === void 0) break;
		let cloneId = `${tailId}_lora${String(index)}`;
		let counter = 1;
		while (target[cloneId] !== void 0) {
			cloneId = `${tailId}_lora${String(index)}_${String(counter)}`;
			counter += 1;
		}
		target[cloneId] = {
			class_type: "LoraLoaderModelOnly",
			inputs: {
				...tail.inputs,
				lora_name: lora.name,
				strength_model: lora.strength,
				model: [tailId, 0]
			}
		};
		for (const node of Object.values(target)) {
			if (node === target[cloneId]) continue;
			for (const [input, value] of Object.entries(node.inputs)) if (input === "model" && Array.isArray(value) && value[0] === tailId) node.inputs[input] = [cloneId, 0];
		}
		tailId = cloneId;
	}
	return graph;
}
/** 从存的 JSON 里解出配置；只认新结构 `{ templates: {...} }`。 */
function parseWorkflowModels(raw) {
	if (raw === void 0 || raw === "") return EMPTY_WORKFLOW_MODELS;
	try {
		const value = JSON.parse(raw);
		if (value === null || typeof value !== "object" || value.templates === null || typeof value.templates !== "object") return EMPTY_WORKFLOW_MODELS;
		const templates = {};
		for (const [name, entry] of Object.entries(value.templates)) {
			if (entry === null || typeof entry !== "object") continue;
			const record = entry;
			const slots = {};
			if (record["slots"] !== null && typeof record["slots"] === "object") {
				for (const [key, slot] of Object.entries(record["slots"])) if (typeof slot === "string" && slot !== "") slots[key] = slot;
			}
			const loras = [];
			if (Array.isArray(record["loras"])) for (const item of record["loras"]) {
				if (item === null || typeof item !== "object") continue;
				const lora = item;
				if (typeof lora["name"] !== "string" || lora["name"] === "") continue;
				loras.push({
					name: lora["name"],
					strength: typeof lora["strength"] === "number" ? lora["strength"] : 1
				});
			}
			templates[name] = {
				slots,
				loras
			};
		}
		return { templates };
	} catch {
		return EMPTY_WORKFLOW_MODELS;
	}
}
/** 本模块所在目录。 */
const HERE$2 = dirname(fileURLToPath(import.meta.url));
/**
* schema 文件的候选目录，按顺序探测。
* @returns 目录列表。
*/
function schemaDirs() {
	return [
		HERE$2,
		join(HERE$2, "db"),
		join(HERE$2, "types", "db"),
		join(HERE$2, "..", "src", "db"),
		join(HERE$2, "..", "..", "src", "db"),
		join(HERE$2, "..", "..", "..", "src", "db")
	];
}
/**
* 读一个 schema 文件。
* @param name - `catalog.sql` 或 `project.sql`。
* @returns 文件内容。
*/
function schemaOf(name) {
	const tried = [];
	for (const dir of schemaDirs()) {
		const path = join(dir, name);
		tried.push(path);
		if (existsSync(path)) return readFileSync(path, "utf8");
	}
	throw new Error(`找不到 schema 文件 ${name}（已找过：${tried.join("、")}）`);
}
/**
* 给已存在的库补列（幂等）。
*
* schema v1 不写迁移脚本，但"项目默认画幅"是后来加的需求：老库没有这两列，
* 而删库重建会丢用户数据。所以只对新增的列做一次 `ALTER TABLE ADD COLUMN`——
* 这是唯一允许的 schema 变更形态，且必须幂等。
* @param db - 打开的库。
* @param table - 表名。
* @param columns - 列名 → 列定义（不含 DEFAULT 之外的限制）。
*/
function ensureColumns(db, table, columns) {
	const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
	for (const [name, definition] of Object.entries(columns)) {
		if (existing.has(name)) continue;
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
	}
}
/**
* 把旧 `clip_slots` 的 role CHECK 扩到包含 `board`（故事板槽）。
*
* schema v1 把 CHECK 写死了 `first/keyframe/last`，SQLite 不能直接改约束，只能整表重建；
* 只在检测到旧约束时执行一次，幂等。
* @param db - 打开的库。
*/
function migrateClipSlots(db) {
	const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'clip_slots'").get();
	if (row === void 0 || !row.sql.includes("CHECK (role IN ('first','keyframe','last'))")) return;
	db.exec(`
    CREATE TABLE clip_slots_new (
      clip_id     TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
      slot_key    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK (role IN ('first','keyframe','last','board')),
      n           INTEGER,
      at_seconds  REAL,
      frame_index INTEGER,
      prompt      TEXT NOT NULL DEFAULT '',
      image_refs  TEXT NOT NULL DEFAULT '[]',
      asset_id    TEXT,
      keyframe_id TEXT,
      source      TEXT NOT NULL DEFAULT 'series',
      PRIMARY KEY (clip_id, slot_key)
    ) STRICT;
    INSERT INTO clip_slots_new (clip_id, slot_key, role, n, at_seconds, frame_index, prompt, image_refs, asset_id, keyframe_id, source)
      SELECT clip_id, slot_key, role, n, at_seconds, frame_index, prompt, image_refs, asset_id, keyframe_id, source FROM clip_slots;
    DROP TABLE clip_slots;
    ALTER TABLE clip_slots_new RENAME TO clip_slots;
  `);
}
/**
* 打开一个库并建表（幂等）。
* @param path - 数据库文件路径。
* @param schema - schema 文件名。
* @returns 打开的连接。
*/
function openDatabase(path, schema) {
	mkdirSync(dirname(path), {
		recursive: true,
		mode: 448
	});
	const db = new DatabaseSync(path);
	db.exec(schemaOf(schema));
	if (schema === "project.sql") migrateClipSlots(db);
	if (db.prepare("SELECT value FROM meta WHERE key = ?").get("schema_version") === void 0) db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("schema_version", String(1));
	return db;
}
/**
* 打开一个项目库。
* @param projectDir - 项目目录。
* @param filename - 库文件名。
* @returns 打开的连接。
*/
function openProjectDatabase(projectDir, filename) {
	return openDatabase(join(projectDir, filename), "project.sql");
}
/**
* 现在时刻的 ISO 字符串。
* @returns ISO 时间。
*/
function nowIso() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
// lib/types/domain/assets.js
/**
* 素材与资产图的读写：导入、列、重绘历史、应用为主图。
*
* 素材文件不可变（同一 URL 同一字节），换主图时把新图写成素材的存储文件并把
* `revision` 加一，URL 随之变化，浏览器缓存自然失效（手册 5.8.2）。
* @module dsh-dream-studio-host/domain/assets
*/
/** 一个 MIME 对应的扩展名。 */
function extensionOf(mime, name) {
	const original = extname(name);
	if (original !== "") return original;
	if (mime === "image/png") return ".png";
	if (mime === "image/jpeg") return ".jpg";
	if (mime === "image/webp") return ".webp";
	if (mime === "video/mp4") return ".mp4";
	if (mime === "audio/mpeg") return ".mp3";
	return ".bin";
}
/**
* 由 MIME 判素材类型。
* @param mime - MIME。
* @returns 类型。
*/
function typeOf(mime) {
	if (mime.startsWith("image/")) return "image";
	if (mime.startsWith("video/")) return "video";
	if (mime.startsWith("audio/")) return "audio";
	throw new Error(`不支持的素材类型：${mime}`);
}
/**
* 清洗成磁盘安全的文件名（保留中文、字母数字与 `.` `-` `_`）。
* @param name - 原始名字。
* @returns 清洗后的名字。
*/
function sanitizeFile(name) {
	return basename(name).replace(/[^\w.\-\u4e00-\u9fa5]+/gu, "_") || "asset";
}
/**
* 找一个还没被占用的存储名：撞名时在扩展名前补 `-2`、`-3`…
*
* 指定 `storedAs` 意味着磁盘名要和显示名一致，所以不能直接覆盖已有文件；
* 同一秒内连点两次入库也是会撞的。
* @param dir - 目标目录。
* @param wanted - 想要的文件名。
* @returns 实际可用的文件名。
*/
function uniqueStoredName(dir, wanted, isFree) {
	const ext = extname(wanted);
	const stem = ext === "" ? wanted : wanted.slice(0, -ext.length);
	let candidate = wanted;
	for (let index = 2; existsSync(join(dir, candidate)) || !isFree(candidate); index += 1) candidate = `${stem}-${String(index)}${ext}`;
	return candidate;
}
/**
* 导入一份素材。
* @param store - 数据门面。
* @param projectId - 项目。
* @param input - 文件名、MIME、字节与落库选项。
* @returns 新素材。
*/
function importAsset(store, projectId, input) {
	const type = typeOf(input.mime);
	const id = crypto.randomUUID();
	const dir = input.library === "episode" && input.episodeId !== void 0 ? store.episodeMaterialDir(projectId, input.episodeId) : join(store.projectDir(projectId), ASSET_FOLDER);
	mkdirSync(dir, {
		recursive: true,
		mode: 448
	});
	const requested = (input.storedAs ?? "").trim();
	const asked = requested === "" ? "" : sanitizeFile(requested);
	const wanted = asked !== "" && extname(asked) === "" ? asked + extensionOf(input.mime, input.name) : asked;
	const stored = wanted === "" ? `${id.slice(0, 8)}-${sanitizeFile(input.name)}` : uniqueStoredName(dir, wanted, (candidate) => store.withProjectDb(projectId, (db) => db.prepare("SELECT 1 FROM assets WHERE stored_name = ?").get(candidate) === void 0));
	writeFileSync(join(dir, stored), input.bytes);
	const at = nowIso();
	store.withProjectDb(projectId, (db) => {
		db.prepare(`INSERT INTO assets (id, name, stored_name, type, mime, size, has_audio, library, episode_id, category, revision, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?)`).run(id, input.name, stored, type, input.mime, input.bytes.byteLength, input.library ?? "project", input.library === "episode" ? input.episodeId ?? "" : "", input.category ?? "", at);
		if (input.library === "episode" && input.episodeId !== void 0) db.prepare("INSERT OR REPLACE INTO episode_assets (episode_id, asset_id, created_at) VALUES (?, ?, ?)").run(input.episodeId, id, at);
	});
	store.log("Project", `导入素材 ${input.name}（${String(input.bytes.byteLength)} 字节）`);
	const created = store.listAssets(projectId, input.episodeId).find((asset) => asset.id === id);
	if (created === void 0) throw new Error("素材没有写入库");
	return created;
}
/**
* 删一份素材（连带它的重绘历史与关键帧图）。
* @param store - 数据门面。
* @param projectId - 项目。
* @param assetId - 素材。
* @param force - 有引用时是否强制删除。
* @returns 被清掉的引用数。
*/
function deleteAsset(store, projectId, assetId, force) {
	const refs = store.withProjectDb(projectId, (db) => {
		return db.prepare("SELECT COUNT(*) AS n FROM clip_refs WHERE asset_id = ?").get(assetId).n;
	});
	if (refs > 0 && !force) throw new Error(`该素材被 ${String(refs)} 个片段引用，确认后可用 force 删除`);
	const dir = join(store.projectDir(projectId), ASSET_FOLDER);
	const target = store.withProjectDb(projectId, (db) => {
		const row = db.prepare("SELECT stored_name, library, episode_id FROM assets WHERE id = ?").get(assetId);
		db.prepare("DELETE FROM assets WHERE id = ?").run(assetId);
		db.prepare("DELETE FROM clip_refs WHERE asset_id = ?").run(assetId);
		return row ?? null;
	});
	if (target !== null) {
		rmSync(join(dir, target.stored_name), { force: true });
		if (target.library === "episode" && target.episode_id !== "") rmSync(join(store.episodeMaterialDir(projectId, target.episode_id), target.stored_name), { force: true });
	}
	rmSync(join(dir, ASSET_IMAGE_FOLDER, assetId), {
		recursive: true,
		force: true
	});
	return refs;
}
/**
* 记一张重绘出来的资产图。
* @param store - 数据门面。
* @param projectId - 项目。
* @param assetId - 素材。
* @param input - 字节、提示词、工作流与 seed。
* @returns 新资产图。
*/
function addAssetImage(store, projectId, assetId, input) {
	const imageId = crypto.randomUUID();
	const dir = join(store.projectDir(projectId), ASSET_FOLDER, ASSET_IMAGE_FOLDER, assetId);
	mkdirSync(dir, {
		recursive: true,
		mode: 448
	});
	writeFileSync(join(dir, `${imageId}.png`), input.bytes);
	const at = nowIso();
	store.withProjectDb(projectId, (db) => {
		db.prepare(`INSERT INTO asset_images (id, asset_id, stored_name, prompt, workflow_id, seed, active, size, episode_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).run(imageId, assetId, `${imageId}.png`, input.prompt, input.workflowId, input.seed, input.bytes.byteLength, input.episodeId ?? "", at);
	});
	return {
		id: imageId,
		assetId,
		prompt: input.prompt,
		workflowId: input.workflowId,
		seed: input.seed,
		active: false,
		size: input.bytes.byteLength,
		episodeId: input.episodeId ?? "",
		createdAt: at
	};
}
/**
* 把一张资产图应用为素材主图。
* @param store - 数据门面。
* @param projectId - 项目。
* @param assetId - 素材。
* @param imageId - 资产图。
*/
function applyAssetImage(store, projectId, assetId, imageId) {
	const dir = join(store.projectDir(projectId), ASSET_FOLDER);
	const source = join(dir, ASSET_IMAGE_FOLDER, assetId, `${imageId}.png`);
	if (!existsSync(source)) throw new Error("这张图已经不在磁盘上");
	const target = store.withProjectDb(projectId, (db) => {
		const row = db.prepare("SELECT stored_name, library, episode_id FROM assets WHERE id = ?").get(assetId);
		if (row === void 0) throw new Error("素材不存在");
		db.prepare("UPDATE asset_images SET active = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE asset_id = ?").run(imageId, assetId);
		db.prepare("UPDATE assets SET revision = revision + 1 WHERE id = ?").run(assetId);
		return row;
	});
	const destDir = target.library === "episode" && target.episode_id !== "" ? store.episodeMaterialDir(projectId, target.episode_id) : dir;
	copyFileSync(source, join(destDir, target.stored_name));
	store.log("Project", `应用资产图 ${imageId} 为素材 ${assetId} 的主图`);
}
/**
* 列素材的重绘历史（新→旧）。
* @param store - 数据门面。
* @param projectId - 项目。
* @param assetId - 素材。
* @returns 资产图列表。
*/
function listAssetImages(store, projectId, assetId) {
	return store.listAssetImages(projectId, assetId);
}
// lib/types/store.js
/**
* 时空造梦的持久化门面。
*
* 一个类持有两本库：目录库（`catalog.db`，跨项目）与当前项目库（`project.db`，
* 打开项目时才连）。仓储逻辑按域拆在 `domain/` 下，这里只做装配与跨域事务边界。
* @module dsh-dream-studio-host/store
*/
/** 新建项目时的落点：已有同名目录时追加序号。 */
function uniqueDir(parent, name) {
	let candidate = join(parent, name);
	let index = 2;
	while (existsSync(candidate)) {
		candidate = join(parent, `${name} (${String(index)})`);
		index += 1;
	}
	return candidate;
}
/**
* 归一化一个目录路径：统一斜杠、去尾斜杠、小写（Windows 比较用）。
* @param path - 原始路径。
* @returns 可比较的字符串。
*/
function normalizePath(path) {
	return path.replace(/\\/gu, "/").replace(/\/+$/u, "").toLowerCase();
}
/** 把一行 projects 读成 ProjectSummary（clip 统计来自项目库）。 */
/** 目录里有没有剧本文件（series.json / plan.json）。 */
function seriesMarker(dir) {
	for (const name of ["series.json", "plan.json"]) if (existsSync(join(dir, name))) return true;
	return false;
}
function summaryOf(row) {
	return {
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		dirPath: row.path,
		clipCount: 0,
		episodeCount: 0,
		totalDuration: 0,
		coverAssetId: null,
		missing: !existsSync(row.path),
		defaultRatio: row.default_ratio ?? "16:9",
		defaultResolution: row.default_resolution ?? "1080P"
	};
}
/** 一行的 `INTEGER` 布尔。 */
function bit$1(value) {
	return Number(value ?? 0) === 1;
}
/** 安全取数字。 */
function num$1(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : value === null || value === void 0 ? null : Number(value);
}
/** 安全取字符串。 */
function str(value, fallback = "") {
	return typeof value === "string" ? value : fallback;
}
/** 读剧集资产清单那一列；坏数据当空数组。 */
function parseAssets(value) {
	const text = str(value, "[]");
	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
/** 读一列 JSON 文件名数组（`['a.png','b.png']`）；坏数据当空数组。 */
function parseNames(value) {
	const text = str(value, "[]");
	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
	} catch {
		return [];
	}
}
/** 时空造梦存储。 */
var DreamStore = class {
	root;
	catalog;
	project = null;
	projectId = null;
	logs = [];
	disposed = false;
	/**
	* @param root - 插件数据根（`<profile>/dream-studio`）。
	*/
	constructor(root) {
		this.root = resolve(root);
		mkdirSync(this.projectsRoot(), {
			recursive: true,
			mode: 448
		});
		this.catalog = openDatabase(join(this.root, CATALOG_DB_FILE), "catalog.sql");
		ensureColumns(this.catalog, "projects", {
			default_ratio: "TEXT NOT NULL DEFAULT '16:9'",
			default_resolution: "TEXT NOT NULL DEFAULT '1080P'"
		});
		this.log("System", `数据根 ${this.root}`);
	}
	/** 项目根目录。 */
	projectsRoot() {
		return join(this.root, "projects");
	}
	/** 记一条分类日志。 */
	log(category, message) {
		this.logs.push({
			at: nowIso(),
			category,
			message
		});
		if (this.logs.length > 2e3) this.logs.splice(0, this.logs.length - 2e3);
	}
	/** 最近日志。 */
	recentLogs(limit = 500) {
		return this.logs.slice(-limit);
	}
	/** 读设置。 */
	settings() {
		const rows = this.catalog.prepare("SELECT key, value FROM settings").all();
		const map = new Map(rows.map((row) => [row.key, row.value]));
		const dispatch = map.get("dispatchMode");
		return {
			projectRoot: map.get("projectRoot") ?? this.projectsRoot(),
			dispatchMode: dispatch === "parallel" ? "parallel" : "serial",
			ffmpegPath: map.get("ffmpegPath") ?? null,
			ffprobePath: map.get("ffprobePath") ?? null,
			cacheLimitBytes: Number(map.get("cacheLimitBytes") ?? 8589934592),
			media: {
				ffmpeg: null,
				ffprobe: null,
				bundled: false
			},
			workflowModels: parseWorkflowModels(map.get("workflowModels")),
			minimaxApiKey: map.get("minimaxApiKey") ?? "",
			samples: this.listSamples()
		};
	}
	/** 写设置。 */
	updateSettings(input) {
		const write = (key, value) => {
			this.catalog.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
		};
		if (input.projectRoot !== void 0) write("projectRoot", input.projectRoot);
		if (input.dispatchMode !== void 0) write("dispatchMode", input.dispatchMode);
		if (input.ffmpegPath !== void 0) write("ffmpegPath", input.ffmpegPath ?? "");
		if (input.ffprobePath !== void 0) write("ffprobePath", input.ffprobePath ?? "");
		if (input.cacheLimitBytes !== void 0) write("cacheLimitBytes", String(input.cacheLimitBytes));
		if (input.workflowModels !== void 0) write("workflowModels", JSON.stringify(input.workflowModels));
		if (input.minimaxApiKey !== void 0) write("minimaxApiKey", input.minimaxApiKey);
		return this.settings();
	}
	/** 列项目，附带片段的统计与封面。 */
	listProjects() {
		return this.catalog.prepare("SELECT id, name, path, created_at, default_ratio, default_resolution FROM projects ORDER BY created_at DESC").all().map((row) => {
			const base = summaryOf(row);
			if (base.missing) return base;
			try {
				const db = openProjectDatabase(row.path, PROJECT_DB_FILE);
				try {
					const episodes = db.prepare("SELECT COUNT(*) AS n FROM episodes").get();
					const clips = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(duration), 0) AS total FROM clips").get();
					const cover = db.prepare("SELECT id FROM assets WHERE type = 'image' ORDER BY created_at LIMIT 1").get();
					return {
						...base,
						episodeCount: episodes.n,
						clipCount: clips.n,
						totalDuration: clips.total,
						coverAssetId: cover?.id ?? null
					};
				} finally {
					db.close();
				}
			} catch {
				return base;
			}
		});
	}
	/**
	* 新建项目。
	* @param name - 项目名。
	* @param dir - 自选目录；缺省时在项目根下按名字建。
	* @returns 新项目。
	*/
	createProject(name, dir, defaults = {}) {
		const trimmed = name.trim();
		if (trimmed === "") throw new Error("请填写项目名称");
		const chosen = dir === void 0 || dir.trim() === "" ? null : resolve(dir.trim());
		if (chosen !== null) {
			const existing = this.catalog.prepare("SELECT id FROM projects WHERE path = ?").get(chosen);
			if (existing !== void 0) {
				const found = this.listProjects().find((entry) => entry.id === existing.id);
				if (found !== void 0) return found;
			}
			if (!existsSync(chosen)) throw new Error("所选目录不存在");
			if (!statSync(chosen).isDirectory()) throw new Error("所选路径不是目录");
		}
		const target = chosen ?? uniqueDir(this.projectsRoot(), trimmed);
		mkdirSync(join(target, ASSET_FOLDER), {
			recursive: true,
			mode: 448
		});
		const id = crypto.randomUUID();
		const at = nowIso();
		const ratio = defaults.ratio ?? "16:9";
		const resolution = defaults.resolution ?? "1080P";
		this.catalog.prepare("INSERT INTO projects (id, name, path, created_at, default_ratio, default_resolution) VALUES (?, ?, ?, ?, ?, ?)").run(id, trimmed, target, at, ratio, resolution);
		openProjectDatabase(target, PROJECT_DB_FILE).close();
		this.log("Project", `新建项目 ${trimmed}（${target}）`);
		return {
			...summaryOf({
				id,
				name: trimmed,
				path: target,
				created_at: at,
				default_ratio: ratio,
				default_resolution: resolution
			}),
			episodeCount: 0
		};
	}
	/** 改名。 */
	/**
	* 改项目的默认画幅与分辨率（只影响"没设过的片段"与预览框比例）。
	* @param id - 项目。
	* @param defaults - 要改的字段；缺省的不动。
	* @returns 更新后的项目摘要。
	*/
	setProjectDefaults(id, defaults) {
		const sets = [];
		const values = [];
		if (defaults.ratio !== void 0 && defaults.ratio.trim() !== "") {
			sets.push("default_ratio = ?");
			values.push(defaults.ratio.trim());
		}
		if (defaults.resolution !== void 0 && defaults.resolution.trim() !== "") {
			sets.push("default_resolution = ?");
			values.push(defaults.resolution.trim());
		}
		if (sets.length === 0) throw new Error("没有要修改的内容");
		this.catalog.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
		const row = this.catalog.prepare("SELECT id, name, path, created_at, default_ratio, default_resolution FROM projects WHERE id = ?").get(id);
		if (row === void 0) throw new Error("项目不存在");
		return summaryOf(row);
	}
	renameProject(id, name) {
		const trimmed = name.trim();
		if (trimmed === "") throw new Error("请填写项目名称");
		this.catalog.prepare("UPDATE projects SET name = ? WHERE id = ?").run(trimmed, id);
		const row = this.catalog.prepare("SELECT id, name, path, created_at, default_ratio, default_resolution FROM projects WHERE id = ?").get(id);
		if (row === void 0) throw new Error("项目不存在");
		return summaryOf(row);
	}
	/** 删除项目登记（素材目录保留）。 */
	deleteProject(id) {
		const row = this.catalog.prepare("SELECT path FROM projects WHERE id = ?").get(id);
		if (row === void 0) throw new Error("项目不存在");
		this.catalog.prepare("DELETE FROM projects WHERE id = ?").run(id);
		if (this.projectId === id) this.closeProject();
		this.log("Project", `删除项目登记 ${row.path}（目录保留）`);
	}
	/** 项目目录。 */
	projectDir(id) {
		const row = this.catalog.prepare("SELECT path FROM projects WHERE id = ?").get(id);
		if (row === void 0) throw new Error("项目不存在");
		return row.path;
	}
	/** 打开（或复用）一个项目库。 */
	projectHandle(projectId) {
		if (this.project !== null && this.projectId === projectId) return this.project;
		this.closeProject();
		const dir = this.projectDir(projectId);
		const db = openProjectDatabase(dir, PROJECT_DB_FILE);
		ensureColumns(db, "clip_slots", { image_refs: "TEXT NOT NULL DEFAULT '[]'" });
		ensureColumns(db, "clips", {
			first_pass_tiled: "INTEGER NOT NULL DEFAULT 0",
			second_pass_tiled: "INTEGER NOT NULL DEFAULT 0",
			second_pass_at: "TEXT"
		});
		ensureColumns(db, "assets", { aliases: "TEXT NOT NULL DEFAULT '[]'" });
		ensureColumns(db, "episodes", {
			series_assets: "TEXT NOT NULL DEFAULT '[]'",
			custom: "INTEGER NOT NULL DEFAULT 0"
		});
		this.project = {
			db,
			dir
		};
		this.projectId = projectId;
		this.healAssetFileNames(projectId, db);
		return this.project;
	}
	/** 关掉当前项目库。 */
	closeProject() {
		if (this.project !== null) try {
			this.project.db.close();
		} catch {}
		this.project = null;
		this.projectId = null;
	}
	/**
	* 在一个目录库上跑一段工作（导入器用）。
	* @param work - 拿到库句柄的回调。
	* @returns 回调的返回值。
	*/
	withCatalogDb(work) {
		return work(this.catalog);
	}
	/**
	* 按目录找已登记的项目。
	* @param path - 项目目录（绝对路径）。
	* @returns 项目 id 与名字，未登记为 null。
	*/
	findProjectByPath(path) {
		return this.withCatalogDb((db) => {
			const all = db.prepare("SELECT id, name, path FROM projects").all();
			const wanted = normalizePath(path);
			const found = all.find((row) => normalizePath(row.path) === wanted);
			return found === void 0 ? null : {
				id: found.id,
				name: found.name
			};
		});
	}
	/** 列剧集。 */
	listEpisodes(projectId) {
		const { db } = this.projectHandle(projectId);
		return db.prepare("SELECT * FROM episodes ORDER BY order_index").all().map((row) => this.episodeOf(db, row));
	}
	/** 读一行剧集。 */
	episodeOf(db, row) {
		const id = str(row["id"]);
		const stat = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(duration), 0) AS total FROM clips WHERE episode_id = ?").get(id);
		return {
			id,
			name: str(row["name"]),
			order: Number(row["order_index"]),
			dirPath: row["dir_path"] ?? null,
			serverId: row["server_id"] ?? null,
			custom: Number(row["custom"] ?? 0) === 1,
			seriesSha256: str(row["series_sha256"]),
			syncedAt: row["synced_at"] ?? null,
			clipCount: stat.n,
			totalDuration: stat.total,
			assets: parseAssets(row["series_assets"]),
			createdAt: str(row["created_at"])
		};
	}
	/**
	* 新建剧集。目录按剧集名建在项目目录下（skill 要在那里写 series.json）。
	* @param projectId - 项目。
	* @param name - 剧集名，缺省"第 N 集"。
	* @returns 剧集载荷。
	*/
	/**
	* 把项目目录里已有的剧集子目录登记成剧集（幂等）。
	*
	* 旧插件就是这么做的：目录是"有哪些剧集"的事实来源，数据库只补缺失的那些。
	* @param projectId - 项目。
	* @returns 新增的剧集数。
	*/
	adoptEpisodes(projectId) {
		const handle = this.projectHandle(projectId);
		const rows = handle.db.prepare("SELECT name, dir_path FROM episodes").all();
		const known = new Set(rows.map((row) => (row.dir_path ?? "").toLowerCase()));
		const knownNames = new Set(rows.map((row) => row.name.toLowerCase()));
		let next = handle.db.prepare("SELECT MAX(order_index) AS value FROM episodes").get().value ?? -1;
		let added = 0;
		for (const entry of readdirSync(handle.dir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (entry.name === "assets" || entry.name === "material") continue;
			const full = join(handle.dir, entry.name);
			if (known.has(full.toLowerCase())) continue;
			if (knownNames.has(entry.name.toLowerCase())) continue;
			if (!seriesMarker(full)) continue;
			next += 1;
			const id = crypto.randomUUID();
			handle.db.prepare("INSERT INTO episodes (id, name, order_index, dir_path, server_id, series_sha256, synced_at, created_at) VALUES (?, ?, ?, ?, NULL, '', NULL, ?)").run(id, entry.name, next, full, nowIso());
			known.add(full.toLowerCase());
			added += 1;
		}
		return added;
	}
	createEpisode(projectId, name) {
		const handle = this.projectHandle(projectId);
		const order = handle.db.prepare("SELECT id, name, order_index, dir_path FROM episodes ORDER BY order_index").all().reduce((highest, row) => Math.max(highest, row.order_index), -1) + 1;
		const trimmed = name === void 0 || name.trim() === "" ? `第${String(order + 1)}集` : name.trim();
		let finalDir = join(handle.dir, trimmed);
		let index = 2;
		while (existsSync(finalDir)) {
			finalDir = join(handle.dir, `${trimmed} (${String(index)})`);
			index += 1;
		}
		mkdirSync(join(finalDir, "material"), {
			recursive: true,
			mode: 448
		});
		const id = crypto.randomUUID();
		handle.db.prepare("INSERT INTO episodes (id, name, order_index, dir_path, created_at) VALUES (?, ?, ?, ?, ?)").run(id, trimmed, order, finalDir, nowIso());
		this.log("Project", `新建剧集 ${trimmed}（${finalDir}）`);
		return this.payload(projectId, id);
	}
	/**
	* 建（或复用）这个项目的「自定义剧集」：没有 series.json，允许手动加片段。
	*
	* 目录放在 `<项目>/自定义剧集`，不写 series.json，所以 skill 之后产出的
	* `第NN集/series.json` 扫描不到它，两者互不干扰。
	* @param projectId - 项目。
	* @returns 载荷（已切到该剧集，含自动建好的 S01）。
	*/
	createCustomEpisode(projectId) {
		const handle = this.projectHandle(projectId);
		const existing = handle.db.prepare("SELECT id FROM episodes WHERE custom = 1 ORDER BY order_index LIMIT 1").get();
		if (existing !== void 0) return this.payload(projectId, existing.id);
		const order = handle.db.prepare("SELECT order_index FROM episodes ORDER BY order_index").all().reduce((highest, row) => Math.max(highest, row.order_index), -1) + 1;
		let dir = join(handle.dir, "自定义剧集");
		let index = 2;
		while (existsSync(dir)) {
			dir = join(handle.dir, `自定义剧集 (${String(index)})`);
			index += 1;
		}
		mkdirSync(join(dir, "material"), {
			recursive: true,
			mode: 448
		});
		const id = crypto.randomUUID();
		handle.db.prepare("INSERT INTO episodes (id, name, order_index, dir_path, custom, created_at) VALUES (?, ?, ?, ?, 1, ?)").run(id, "自定义剧集", order, dir, nowIso());
		this.log("Project", `新建自定义剧集（${dir}）`);
		this.addClip(projectId, id, { mode: "reference" });
		return this.payload(projectId, id);
	}
	/** 剧集目录。 */
	episodeDir(projectId, episodeId) {
		const { db } = this.projectHandle(projectId);
		const row = db.prepare("SELECT dir_path FROM episodes WHERE id = ?").get(episodeId);
		if (row === void 0) throw new Error("剧集不存在");
		if (row.dir_path !== null) return row.dir_path;
		const dir = join(this.projectDir(projectId), "episodes", episodeId);
		mkdirSync(dir, {
			recursive: true,
			mode: 448
		});
		return dir;
	}
	/** 剧集的本集素材目录（剧集库与草稿都住这里）。 */
	episodeMaterialDir(projectId, episodeId) {
		const dir = join(this.episodeDir(projectId, episodeId), EPISODE_MATERIAL_FOLDER);
		mkdirSync(dir, {
			recursive: true,
			mode: 448
		});
		return dir;
	}
	/** 剧集里的系列文档路径（可能不存在）。 */
	seriesPath(projectId, episodeId) {
		return join(this.episodeDir(projectId, episodeId), SERIES_FILE);
	}
	/** 改名。 */
	renameEpisode(projectId, episodeId, name) {
		const trimmed = name.trim();
		if (trimmed === "") throw new Error("请填写剧集名称");
		const { db } = this.projectHandle(projectId);
		db.prepare("UPDATE episodes SET name = ? WHERE id = ?").run(trimmed, episodeId);
		return this.payload(projectId, episodeId);
	}
	/** 删除剧集（只删登记与片段，目录保留）。 */
	deleteEpisode(projectId, episodeId) {
		const { db } = this.projectHandle(projectId);
		db.prepare("DELETE FROM clips WHERE episode_id = ?").run(episodeId);
		db.prepare("DELETE FROM episodes WHERE id = ?").run(episodeId);
		const next = db.prepare("SELECT id FROM episodes ORDER BY order_index LIMIT 1").get()?.id ?? null;
		return this.payload(projectId, next);
	}
	/** 绑定服务。 */
	setEpisodeServer(projectId, episodeId, serverId) {
		const { db } = this.projectHandle(projectId);
		db.prepare("UPDATE episodes SET server_id = ? WHERE id = ?").run(serverId, episodeId);
		return this.payload(projectId, episodeId);
	}
	/**
	* 读一个剧集的完整载荷。
	* @param projectId - 项目。
	* @param episodeId - 剧集；null 时取第一个。
	* @returns 载荷。
	*/
	payload(projectId, episodeId) {
		const handle = this.projectHandle(projectId);
		const episodes = this.listEpisodes(projectId);
		const chosen = episodeId ?? episodes[0]?.id ?? null;
		const clips = chosen === null ? [] : this.listClips(handle.db, chosen);
		return {
			projectId,
			projectName: this.projectNameOf(projectId),
			dirPath: handle.dir,
			episodes,
			episodeId: chosen,
			clips,
			totalDuration: clips.reduce((sum, clip) => sum + clip.duration, 0)
		};
	}
	/** 项目名。 */
	projectNameOf(projectId) {
		return this.catalog.prepare("SELECT name FROM projects WHERE id = ?").get(projectId)?.name ?? "";
	}
	/** 列片段（带槽、参考位、关键帧）。 */
	listClips(db, episodeId) {
		return db.prepare("SELECT * FROM clips WHERE episode_id = ? ORDER BY order_index").all(episodeId).map((row) => this.clipOf(db, row));
	}
	/** 读一个片段。 */
	clipOf(db, row) {
		const id = str(row["id"]);
		const refs = db.prepare("SELECT * FROM clip_refs WHERE clip_id = ? ORDER BY kind, position").all(id).map((ref) => ({
			kind: str(ref["kind"], "image"),
			position: Number(ref["position"]),
			assetId: ref["asset_id"] ?? null,
			assetName: str(ref["asset_name"]),
			role: ref["role"] ?? null,
			windowStart: num$1(ref["window_start"]),
			windowEnd: num$1(ref["window_end"]),
			note: ref["note"] ?? null
		}));
		const slots = db.prepare("SELECT * FROM clip_slots WHERE clip_id = ? ORDER BY slot_key").all(id).map((slot) => ({
			key: str(slot["slot_key"]),
			role: str(slot["role"], "keyframe"),
			n: num$1(slot["n"]),
			atSeconds: num$1(slot["at_seconds"]),
			frameIndex: num$1(slot["frame_index"]),
			prompt: str(slot["prompt"]),
			imageRefs: parseNames(slot["image_refs"]),
			assetId: slot["asset_id"] ?? null,
			keyframeId: slot["keyframe_id"] ?? null,
			status: null,
			revision: null,
			seed: null
		}));
		const keyframes = db.prepare("SELECT * FROM keyframes WHERE clip_id = ? ORDER BY frame_index").all(id).map((entry) => ({
			id: str(entry["id"]),
			clipId: id,
			slotKey: str(entry["slot_key"]),
			position: Number(entry["position"]),
			frameIndex: Number(entry["frame_index"]),
			prompt: str(entry["prompt"]),
			status: str(entry["status"], "planned"),
			seed: num$1(entry["seed"]),
			revision: Number(entry["revision"] ?? 0),
			errorMessage: entry["error_message"] ?? null,
			createdAt: str(entry["created_at"])
		}));
		const byKeyframe = new Map(keyframes.map((entry) => [entry.id, entry]));
		const withStatus = slots.map((slot) => {
			const keyframe = slot.keyframeId === null ? void 0 : byKeyframe.get(slot.keyframeId);
			return keyframe === void 0 ? slot : {
				...slot,
				status: keyframe.status,
				revision: keyframe.revision,
				seed: keyframe.seed
			};
		});
		return {
			id,
			order: Number(row["order_index"]),
			seriesKey: str(row["series_key"]),
			mode: str(row["mode"], "reference"),
			prompt: str(row["prompt"]),
			promptEn: str(row["prompt_en"]),
			duration: Number(row["duration"]),
			fps: num$1(row["fps"]),
			scale: num$1(row["scale"]),
			ratio: row["ratio"] ?? null,
			resolution: row["resolution"] ?? null,
			seed: num$1(row["seed"]),
			firstPassSteps: num$1(row["first_pass_steps"]),
			secondPass: bit$1(row["second_pass"]),
			firstPassTiled: bit$1(row["first_pass_tiled"]),
			secondPassTiled: bit$1(row["second_pass_tiled"]),
			secondDenoise: num$1(row["second_denoise"]),
			secondScale: num$1(row["second_scale"]),
			secondSteps: num$1(row["second_steps"]),
			continueFromPrev: bit$1(row["continue_from_prev"]),
			firstFrameFromPrev: bit$1(row["first_frame_from_prev"]),
			guideFrameCount: num$1(row["guide_frame_count"]),
			firstFrameAssetId: row["first_frame_asset_id"] ?? null,
			lastFrameAssetId: row["last_frame_asset_id"] ?? null,
			workflowId: row["workflow_id"] ?? null,
			loras: JSON.parse(str(row["loras"], "[]")),
			status: str(row["status"], "pending"),
			resultVideoPath: row["result_video_path"] ?? null,
			secondPassAt: row["second_pass_at"] ?? null,
			videoCount: db.prepare("SELECT COUNT(*) AS n FROM clip_videos WHERE clip_id = ?").get(id).n,
			activeVideoId: db.prepare("SELECT id FROM clip_videos WHERE clip_id = ? AND active = 1 LIMIT 1").get(id)?.id ?? null,
			videoKinds: db.prepare("SELECT DISTINCT kind FROM clip_videos WHERE clip_id = ?").all(id).map((row) => row.kind),
			generationMs: num$1(row["generation_ms"]),
			errorMessage: row["error_message"] ?? null,
			createdAt: str(row["created_at"]),
			updatedAt: str(row["updated_at"]),
			refs,
			slots: withStatus,
			keyframes
		};
	}
	/**
	* 新建片段。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param input - 初始字段。
	* @returns 新载荷。
	*/
	addClip(projectId, episodeId, input = {}) {
		const db = this.projectHandle(projectId).db;
		const mode = input.mode ?? "reference";
		const duration = input.duration ?? 5;
		if (!(duration > 0)) throw new Error("时长必须大于 0");
		const order = db.prepare("SELECT COALESCE(MAX(order_index), -1) AS value FROM clips WHERE episode_id = ?").get(episodeId).value + 1;
		const id = crypto.randomUUID();
		const at = nowIso();
		const seriesKey = Number(db.prepare("SELECT custom FROM episodes WHERE id = ?").get(episodeId)?.custom ?? 0) === 1 ? `S${String(order + 1).padStart(2, "0")}` : "";
		const long = duration > 10;
		const firstTiled = input.firstPassTiled ?? long;
		const secondTiled = input.secondPassTiled ?? long;
		db.prepare(`INSERT INTO clips (id, episode_id, order_index, series_key, mode, prompt, prompt_en, duration, fps, first_pass_tiled, second_pass_tiled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).run(id, episodeId, order, seriesKey, mode, input.prompt ?? "", input.promptEn ?? "", duration, input.fps ?? 24, firstTiled ? 1 : 0, secondTiled ? 1 : 0, at, at);
		if (input.refs !== void 0) this.writeRefs(db, id, input.refs);
		return this.payload(projectId, episodeId);
	}
	/** 写参考位（整体替换）。 */
	writeRefs(db, clipId, refs) {
		db.prepare("DELETE FROM clip_refs WHERE clip_id = ?").run(clipId);
		for (const ref of refs) db.prepare("INSERT INTO clip_refs (clip_id, kind, position, asset_id, asset_name, role, window_start, window_end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(clipId, ref.kind, ref.position, ref.assetId, ref.assetName, ref.role, ref.windowStart, ref.windowEnd, ref.note);
	}
	/**
	* 改片段。只写传进来的字段，其余保持。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param input - 变更。
	* @returns 载荷。
	*/
	updateClip(projectId, clipId, input) {
		const db = this.projectHandle(projectId).db;
		const found = db.prepare("SELECT episode_id FROM clips WHERE id = ?").get(clipId);
		if (found === void 0) throw new Error("片段不存在");
		const patch = [];
		const put = (column, value) => {
			if (value !== void 0) patch.push([column, value]);
		};
		put("mode", input.mode);
		put("prompt", input.prompt);
		put("prompt_en", input.promptEn);
		put("duration", input.duration);
		put("fps", input.fps);
		put("scale", input.scale);
		put("ratio", input.ratio);
		put("resolution", input.resolution);
		put("seed", input.seed);
		put("first_pass_steps", input.firstPassSteps);
		put("second_pass", input.secondPass === void 0 ? void 0 : input.secondPass ? 1 : 0);
		put("first_pass_tiled", input.firstPassTiled === void 0 ? void 0 : input.firstPassTiled ? 1 : 0);
		put("second_pass_tiled", input.secondPassTiled === void 0 ? void 0 : input.secondPassTiled ? 1 : 0);
		put("second_denoise", input.secondDenoise);
		put("second_scale", input.secondScale);
		put("second_steps", input.secondSteps);
		put("continue_from_prev", input.continueFromPrev === void 0 ? void 0 : input.continueFromPrev ? 1 : 0);
		put("first_frame_from_prev", input.firstFrameFromPrev === void 0 ? void 0 : input.firstFrameFromPrev ? 1 : 0);
		put("guide_frame_count", input.guideFrameCount);
		put("first_frame_asset_id", input.firstFrameAssetId);
		put("last_frame_asset_id", input.lastFrameAssetId);
		put("workflow_id", input.workflowId);
		if (input.loras !== void 0) put("loras", JSON.stringify(input.loras));
		if (patch.length > 0) {
			const assignments = patch.map(([column]) => `${column} = ?`).join(", ");
			db.prepare(`UPDATE clips SET ${assignments}, updated_at = ? WHERE id = ?`).run(...patch.map(([, value]) => value), nowIso(), clipId);
		}
		if (input.refs !== void 0) this.writeRefs(db, clipId, input.refs);
		return this.payload(projectId, found.episode_id);
	}
	/** 删片段。 */
	deleteClip(projectId, clipId) {
		const db = this.projectHandle(projectId).db;
		const found = db.prepare("SELECT episode_id FROM clips WHERE id = ?").get(clipId);
		if (found === void 0) throw new Error("片段不存在");
		db.prepare("DELETE FROM clips WHERE id = ?").run(clipId);
		return this.payload(projectId, found.episode_id);
	}
	/**
	* 调整片段顺序。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param index - 目标位置，越界会被夹紧。
	* @returns 载荷。
	*/
	moveClip(projectId, clipId, index) {
		const db = this.projectHandle(projectId).db;
		const found = db.prepare("SELECT episode_id FROM clips WHERE id = ?").get(clipId);
		if (found === void 0) throw new Error("片段不存在");
		const ids = db.prepare("SELECT id FROM clips WHERE episode_id = ? ORDER BY order_index").all(found.episode_id).map((row) => row.id);
		const from = ids.indexOf(clipId);
		const to = Math.max(0, Math.min(index, ids.length - 1));
		if (from < 0 || from === to) return this.payload(projectId, found.episode_id);
		ids.splice(from, 1);
		ids.splice(to, 0, clipId);
		db.exec("BEGIN");
		try {
			ids.forEach((id, at) => {
				db.prepare("UPDATE clips SET order_index = ? WHERE id = ?").run(at, id);
			});
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
		return this.payload(projectId, found.episode_id);
	}
	/**
	* 列一段的所有成片历史（新的在前）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @returns 历史记录。
	*/
	listClipVideos(projectId, clipId) {
		const { db } = this.projectHandle(projectId);
		return db.prepare("SELECT * FROM clip_videos WHERE clip_id = ? ORDER BY created_at DESC").all(clipId).map((row) => ({
			id: str(row["id"]),
			clipId: str(row["clip_id"]),
			kind: str(row["kind"], "first"),
			label: str(row["label"]),
			active: Number(row["active"]) === 1,
			createdAt: str(row["created_at"])
		}));
	}
	/**
	* 追加一条成片历史并设为启用（新的默认启用）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param input - 路径、类型、尺寸标签。
	* @returns 新记录。
	*/
	addClipVideo(projectId, clipId, input) {
		const { db } = this.projectHandle(projectId);
		const id = crypto.randomUUID();
		const at = nowIso();
		db.exec("BEGIN");
		try {
			db.prepare("UPDATE clip_videos SET active = 0 WHERE clip_id = ?").run(clipId);
			db.prepare("INSERT INTO clip_videos (id, clip_id, path, kind, label, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)").run(id, clipId, input.path, input.kind, input.label, at);
			db.prepare("UPDATE clips SET result_video_path = ? WHERE id = ?").run(input.path, clipId);
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
		return {
			id,
			clipId,
			kind: input.kind,
			label: input.label,
			active: true,
			createdAt: at
		};
	}
	/**
	* 启用一条历史成片。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param videoId - 历史记录。
	*/
	activateClipVideo(projectId, clipId, videoId) {
		const { db } = this.projectHandle(projectId);
		const row = db.prepare("SELECT path FROM clip_videos WHERE id = ? AND clip_id = ?").get(videoId, clipId);
		if (row === void 0) throw new Error("这条视频记录不存在");
		db.exec("BEGIN");
		try {
			db.prepare("UPDATE clip_videos SET active = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE clip_id = ?").run(videoId, clipId);
			db.prepare("UPDATE clips SET result_video_path = ?, updated_at = ? WHERE id = ?").run(row.path, nowIso(), clipId);
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	}
	/**
	* 删除一条历史成片（文件留在磁盘上，只删记录；删的正好是启用中那条时，回落到最新一条）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param videoId - 历史记录。
	*/
	deleteClipVideo(projectId, clipId, videoId) {
		const { db } = this.projectHandle(projectId);
		db.exec("BEGIN");
		try {
			db.prepare("DELETE FROM clip_videos WHERE id = ? AND clip_id = ?").run(videoId, clipId);
			if (db.prepare("SELECT id, path FROM clip_videos WHERE clip_id = ? AND active = 1 LIMIT 1").get(clipId) === void 0) {
				const latest = db.prepare("SELECT id, path FROM clip_videos WHERE clip_id = ? ORDER BY created_at DESC LIMIT 1").get(clipId);
				if (latest === void 0) db.prepare("UPDATE clips SET result_video_path = NULL, updated_at = ? WHERE id = ?").run(nowIso(), clipId);
				else {
					db.prepare("UPDATE clip_videos SET active = 1 WHERE id = ?").run(latest.id);
					db.prepare("UPDATE clips SET result_video_path = ?, updated_at = ? WHERE id = ?").run(latest.path, nowIso(), clipId);
				}
			}
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	}
	/**
	* 在一个项目库上跑一段工作（事务由调用方自己开）。
	*
	* 给  这类跨表逻辑用：它们需要在一个库句柄上连续读写，
	* 又不该把 SQL 塞回 store。
	* @param projectId - 项目。
	* @param work - 拿到库句柄的回调。
	* @returns 回调的返回值。
	*/
	withProjectDb(projectId, work) {
		return work(this.projectHandle(projectId).db);
	}
	/**
	* 读一次剧集的 series 同步指纹。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @returns 指纹；从未同步过为空串。
	*/
	episodeSeriesHash(projectId, episodeId) {
		return this.withProjectDb(projectId, (db) => {
			return db.prepare("SELECT series_sha256 FROM episodes WHERE id = ?").get(episodeId)?.series_sha256 ?? "";
		});
	}
	/**
	* 取一个片段的成片文件。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @returns 文件路径与下载名；还没出片为 null。
	*/
	clipResult(projectId, clipId) {
		return this.withProjectDb(projectId, (db) => {
			const stored = db.prepare("SELECT result_video_path FROM clips WHERE id = ?").get(clipId)?.result_video_path ?? null;
			if (stored === null || stored === "") return null;
			return {
				path: stored,
				name: `${clipId}.mp4`
			};
		});
	}
	/**
	* 自愈：磁盘文件名与素材名不一致的老素材，顺手改成素材名。
	*
	* 早期版本导入时磁盘名带 uuid 前缀、改名又只改显示名，于是「插件里叫 A、
	* 磁盘上叫 af22b1ac-A」。剧集里按 series.json 认领了某张图的，优先用那个
	* 资产名（如 `SC-02_玄霄宗雅图_v01.png`）——插件、磁盘、series.json 三处同名。
	* 挂载项目时跑一次，幂等：名字已一致就跳过；目标名被占用、文件被占用
	* （Windows）就留到下次。
	* @param projectId - 项目。
	* @param db - 项目库。
	*/
	healAssetFileNames(projectId, db) {
		const rows = db.prepare("SELECT id, name, stored_name, library, episode_id FROM assets").all();
		const claimed = /* @__PURE__ */ new Map();
		const episodeRows = db.prepare("SELECT series_assets FROM episodes").all();
		for (const episode of episodeRows) for (const entry of parseAssets(episode.series_assets)) {
			if (typeof entry.file !== "string" || entry.file === "" || claimed.has(entry.file)) continue;
			claimed.set(entry.file, entry.name);
		}
		let healed = 0;
		for (const row of rows) {
			const target = claimed.get(row.stored_name) ?? row.name;
			const knownExt = extname(row.stored_name) !== "" ? extname(row.stored_name) : extname(row.name);
			const wanted = extname(target) !== "" || knownExt === "" ? sanitizeFile(target) : sanitizeFile(target) + knownExt;
			if (wanted === "" || wanted === row.stored_name) continue;
			const dir = row.library === "episode" && row.episode_id !== "" ? this.episodeMaterialDir(projectId, row.episode_id) : join(this.projectDir(projectId), ASSET_FOLDER);
			const from = join(dir, row.stored_name);
			if (!existsSync(from) || existsSync(join(dir, wanted))) continue;
			if (db.prepare("SELECT 1 FROM assets WHERE stored_name = ? AND id <> ?").get(wanted, row.id) !== void 0) continue;
			try {
				renameSync(from, join(dir, wanted));
				db.prepare("UPDATE assets SET name = ?, stored_name = ? WHERE id = ?").run(target, wanted, row.id);
				healed += 1;
			} catch {}
		}
		if (healed > 0) this.log("Project", "修正 " + String(healed) + " 个素材的文件名，使其与素材名一致");
	}
	/**
	* 把素材文件改成新名字（撞名时补 `-2`、`-3`），返回最终文件名。
	*
	* 只改显示名会让磁盘上留着 `<uuid8>-旧名`，用户按名字找图时对不上；
	* 素材 URL 按 id 取、跟文件名无关，所以这里可以安全改名。
	* @param dir - 素材所在目录。
	* @param stored - 当前文件名。
	* @param name - 想要的新名字（通常就是显示名）。
	* @returns 实际落盘的文件名。
	*/
	moveAssetFile(dir, stored, name, db, assetId) {
		const source = join(dir, stored);
		if (!existsSync(source)) return stored;
		const given = extname(name);
		const original = given !== "" ? given : extname(stored);
		const stem = (given === "" ? name : name.slice(0, -given.length)).replace(/[^\w.\-\u4e00-\u9fa5]+/gu, "_") || "asset";
		let wanted = stem + original;
		const isFree = (candidate) => db.prepare("SELECT 1 FROM assets WHERE stored_name = ? AND id <> ?").get(candidate, assetId) === void 0;
		for (let index = 2; existsSync(join(dir, wanted)) || !isFree(wanted); index += 1) wanted = stem + "-" + String(index) + original;
		if (wanted !== stored) renameSync(source, join(dir, wanted));
		return wanted;
	}
	/**
	* 改素材名（显示名 + 磁盘文件名一起改，URL 不变）。
	*
	* 素材 URL 是按 id 取的，所以改文件名不影响预览；但用户在资源管理器里
	* 按名字找图，磁盘名必须跟着显示名走（否则会出现「插件里叫 A、磁盘上叫
	* `af22b1ac-A`」这种对不上的情况）。
	* @param projectId - 项目。
	* @param assetId - 素材。
	* @param name - 新名字。
	*/
	renameAsset(projectId, assetId, name) {
		const trimmed = name.trim();
		if (trimmed === "") throw new Error("素材名不能为空");
		this.withProjectDb(projectId, (db) => {
			const row = db.prepare("SELECT name, stored_name, library, episode_id, aliases FROM assets WHERE id = ?").get(assetId);
			if (row === void 0) throw new Error("素材不存在");
			const dir = row.library === "episode" && row.episode_id !== "" ? this.episodeMaterialDir(projectId, row.episode_id) : join(this.projectDir(projectId), ASSET_FOLDER);
			const stored = this.moveAssetFile(dir, row.stored_name, trimmed, db, assetId);
			let aliases = [];
			try {
				aliases = JSON.parse(row.aliases === "" ? "[]" : row.aliases);
			} catch {
				aliases = [];
			}
			for (const alias of [row.name, row.stored_name]) if (alias !== "" && alias !== trimmed && !aliases.includes(alias)) aliases.push(alias);
			db.prepare("UPDATE assets SET name = ?, stored_name = ?, aliases = ? WHERE id = ?").run(trimmed, stored, JSON.stringify(aliases), assetId);
			const clash = db.prepare("SELECT id FROM assets WHERE name = ? AND id <> ?").all(trimmed, assetId);
			for (const row of clash) {
				db.prepare("UPDATE clip_refs SET asset_id = ? WHERE asset_id = ?").run(assetId, row.id);
				db.prepare("UPDATE clip_slots SET asset_id = ? WHERE asset_id = ?").run(assetId, row.id);
				db.prepare("UPDATE clips SET first_frame_asset_id = ? WHERE first_frame_asset_id = ?").run(assetId, row.id);
				db.prepare("UPDATE clips SET last_frame_asset_id = ? WHERE last_frame_asset_id = ?").run(assetId, row.id);
				db.prepare("DELETE FROM assets WHERE id = ?").run(row.id);
			}
			db.prepare("UPDATE clip_refs SET asset_name = ? WHERE asset_id = ?").run(trimmed, assetId);
		});
	}
	/**
	* 改关键帧槽的插入点（秒）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param slotKey - 槽键。
	* @param seconds - 插入点秒数；null 表示清空。
	*/
	setSlotAnchor(projectId, clipId, slotKey, seconds) {
		this.withProjectDb(projectId, (db) => {
			if (db.prepare("SELECT role FROM clip_slots WHERE clip_id = ? AND slot_key = ?").get(clipId, slotKey) === void 0) throw new Error("这个槽不存在（可能 series.json 里没有它）");
			db.prepare("UPDATE clip_slots SET at_seconds = ? WHERE clip_id = ? AND slot_key = ?").run(seconds, clipId, slotKey);
		});
	}
	/**
	* 删掉一个参考位，并重排其余位次（顺序就是 `<Picture N>`）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param position - 要删的位置。
	*/
	removeRef(projectId, clipId, position) {
		this.withProjectDb(projectId, (db) => {
			const rows = db.prepare("SELECT kind, position, asset_id, asset_name, role, window_start, window_end, note FROM clip_refs WHERE clip_id = ? AND kind = 'image' ORDER BY position").all(clipId);
			const kept = rows.filter((row) => row.position !== position);
			if (kept.length === rows.length) throw new Error("这个参考位不存在");
			db.prepare("DELETE FROM clip_refs WHERE clip_id = ? AND kind = 'image'").run(clipId);
			const insert = db.prepare("INSERT INTO clip_refs (clip_id, kind, position, asset_id, asset_name, role, window_start, window_end, note) VALUES (?, 'image', ?, ?, ?, ?, ?, ?, ?)");
			kept.forEach((row, index) => {
				const role = index === kept.length - 1 ? "scene" : row.role ?? "character";
				insert.run(clipId, index, row.asset_id, row.asset_name, role, row.window_start, row.window_end, row.note);
			});
			db.prepare("UPDATE clips SET updated_at = ? WHERE id = ?").run(nowIso(), clipId);
		});
	}
	/**
	* 删掉一个关键帧槽（整张卡片），并把剩下的重编号。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param slotKey - 槽键。
	*/
	/**
	* 给片段加一个关键帧槽（追加到末尾）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param atSeconds - 插入点秒数；缺省用时长的一半。
	* @returns 新槽键。
	*/
	addSlot(projectId, clipId, atSeconds) {
		return this.withProjectDb(projectId, (db) => {
			const clip = db.prepare("SELECT duration, fps FROM clips WHERE id = ?").get(clipId);
			if (clip === void 0) throw new Error("片段不存在");
			const next = db.prepare("SELECT n FROM clip_slots WHERE clip_id = ? AND role = 'keyframe'").all(clipId).reduce((max, row) => Math.max(max, row.n ?? 0), 0) + 1;
			const key = `kf-${crypto.randomUUID().slice(0, 8)}`;
			const seconds = atSeconds ?? clip.duration / 2;
			const fps = clip.fps === null || clip.fps <= 0 ? 24 : clip.fps;
			db.prepare("INSERT INTO clip_slots (clip_id, slot_key, role, n, at_seconds, frame_index, prompt, asset_id, keyframe_id, source) VALUES (?, ?, 'keyframe', ?, ?, ?, '', NULL, NULL, 'manual')").run(clipId, key, next, seconds, Math.round(seconds * fps));
			db.prepare("UPDATE clips SET updated_at = ? WHERE id = ?").run(nowIso(), clipId);
			return key;
		});
	}
	removeSlot(projectId, clipId, slotKey) {
		this.withProjectDb(projectId, (db) => {
			if (db.prepare("SELECT role, n, frame_index, at_seconds FROM clip_slots WHERE clip_id = ? AND slot_key = ?").get(clipId, slotKey) === void 0) throw new Error("这个槽不存在");
			db.prepare("DELETE FROM clip_slots WHERE clip_id = ? AND slot_key = ?").run(clipId, slotKey);
			db.prepare("SELECT slot_key FROM clip_slots WHERE clip_id = ? AND role = 'keyframe' ORDER BY n").all(clipId).forEach((entry, index) => {
				db.prepare("UPDATE clip_slots SET n = ? WHERE clip_id = ? AND slot_key = ?").run(index + 1, clipId, entry.slot_key);
			});
			db.prepare("UPDATE clips SET updated_at = ? WHERE id = ?").run(nowIso(), clipId);
		});
	}
	/**
	* 存一张片段草稿图（生成的图先挂在这里）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param input - 字节、提示词、工作流与 seed。
	* @returns 草稿。
	*/
	addClipDraft(projectId, clipId, input) {
		const id = crypto.randomUUID();
		const episodeId = this.clipEpisodeId(projectId, clipId);
		const base = episodeId === null ? join(this.projectDir(projectId), ASSET_FOLDER) : this.episodeMaterialDir(projectId, episodeId);
		const dir = join(base, DRAFT_FOLDER, clipId);
		mkdirSync(dir, {
			recursive: true,
			mode: 448
		});
		const stored = `${id}.png`;
		writeFileSync(join(dir, stored), input.bytes);
		const at = nowIso();
		this.withProjectDb(projectId, (db) => {
			db.prepare("INSERT INTO clip_drafts (id, clip_id, stored_name, prompt, workflow_id, seed, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, clipId, stored, input.prompt, input.workflowId, input.seed, input.bytes.byteLength, at);
		});
		return {
			id,
			clipId,
			prompt: input.prompt,
			workflowId: input.workflowId,
			seed: input.seed,
			size: input.bytes.byteLength,
			createdAt: at
		};
	}
	/**
	* 列一个片段的草稿图（新→旧）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @returns 草稿列表。
	*/
	listClipDrafts(projectId, clipId) {
		return this.withProjectDb(projectId, (db) => {
			return db.prepare("SELECT * FROM clip_drafts WHERE clip_id = ? ORDER BY created_at DESC").all(clipId).map((row) => ({
				id: String(row["id"]),
				clipId: String(row["clip_id"]),
				prompt: String(row["prompt"] ?? ""),
				workflowId: String(row["workflow_id"] ?? ""),
				seed: row["seed"] === null ? null : Number(row["seed"]),
				size: Number(row["size"] ?? 0),
				createdAt: String(row["created_at"])
			}));
		});
	}
	/**
	* 删一张草稿图（连带磁盘文件）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param draftId - 草稿。
	*/
	deleteClipDraft(projectId, clipId, draftId) {
		this.withProjectDb(projectId, (db) => {
			db.prepare("DELETE FROM clip_drafts WHERE id = ? AND clip_id = ?").run(draftId, clipId);
		});
		const episodeId = this.clipEpisodeId(projectId, clipId);
		const base = episodeId === null ? join(this.projectDir(projectId), ASSET_FOLDER) : this.episodeMaterialDir(projectId, episodeId);
		rmSync(join(base, DRAFT_FOLDER, clipId, `${draftId}.png`), { force: true });
		rmSync(join(this.projectDir(projectId), ASSET_FOLDER, DRAFT_FOLDER, clipId, `${draftId}.png`), { force: true });
	}
	/**
	* 草稿图文件路径。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param draftId - 草稿。
	* @returns 绝对路径。
	*/
	clipDraftPath(projectId, clipId, draftId) {
		const episodeId = this.clipEpisodeId(projectId, clipId);
		const base = episodeId === null ? join(this.projectDir(projectId), ASSET_FOLDER) : this.episodeMaterialDir(projectId, episodeId);
		const current = join(base, DRAFT_FOLDER, clipId, `${draftId}.png`);
		const legacy = join(this.projectDir(projectId), ASSET_FOLDER, DRAFT_FOLDER, clipId, `${draftId}.png`);
		return existsSync(current) || !existsSync(legacy) ? current : legacy;
	}
	/**
	* 存一张剧集草稿图（本集人物图 / 场景图的草稿）。
	*
	* 与片段草稿同构，只是上级换成剧集：入库仍由人审后点「应用为素材」。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param input - 图片字节与生成参数。
	* @returns 草稿。
	*/
	addEpisodeDraft(projectId, episodeId, input) {
		const id = crypto.randomUUID();
		const dir = join(this.episodeMaterialDir(projectId, episodeId), DRAFT_FOLDER, `episode-${episodeId}`);
		mkdirSync(dir, {
			recursive: true,
			mode: 448
		});
		const stored = `${id}.png`;
		writeFileSync(join(dir, stored), input.bytes);
		const at = nowIso();
		this.withProjectDb(projectId, (db) => {
			db.prepare("INSERT INTO episode_drafts (id, episode_id, stored_name, prompt, workflow_id, seed, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, episodeId, stored, input.prompt, input.workflowId, input.seed, input.bytes.byteLength, at);
		});
		return {
			id,
			episodeId,
			prompt: input.prompt,
			workflowId: input.workflowId,
			seed: input.seed,
			size: input.bytes.byteLength,
			createdAt: at
		};
	}
	/**
	* 列一个剧集的草稿图（新→旧）。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @returns 草稿列表。
	*/
	listEpisodeDrafts(projectId, episodeId) {
		return this.withProjectDb(projectId, (db) => {
			return db.prepare("SELECT * FROM episode_drafts WHERE episode_id = ? ORDER BY created_at DESC").all(episodeId).map((row) => ({
				id: String(row["id"]),
				episodeId: String(row["episode_id"]),
				prompt: String(row["prompt"] ?? ""),
				workflowId: String(row["workflow_id"] ?? ""),
				seed: row["seed"] === null ? null : Number(row["seed"]),
				size: Number(row["size"] ?? 0),
				createdAt: String(row["created_at"])
			}));
		});
	}
	/**
	* 删一张剧集草稿（连带磁盘文件）。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param draftId - 草稿。
	*/
	deleteEpisodeDraft(projectId, episodeId, draftId) {
		this.withProjectDb(projectId, (db) => {
			db.prepare("DELETE FROM episode_drafts WHERE id = ? AND episode_id = ?").run(draftId, episodeId);
		});
		rmSync(join(this.episodeMaterialDir(projectId, episodeId), DRAFT_FOLDER, `episode-${episodeId}`, `${draftId}.png`), { force: true });
		rmSync(join(this.projectDir(projectId), ASSET_FOLDER, DRAFT_FOLDER, `episode-${episodeId}`, `${draftId}.png`), { force: true });
	}
	/**
	* 剧集草稿图文件路径。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param draftId - 草稿。
	* @returns 绝对路径。
	*/
	episodeDraftPath(projectId, episodeId, draftId) {
		const current = join(this.episodeMaterialDir(projectId, episodeId), DRAFT_FOLDER, `episode-${episodeId}`, `${draftId}.png`);
		const legacy = join(this.projectDir(projectId), ASSET_FOLDER, DRAFT_FOLDER, `episode-${episodeId}`, `${draftId}.png`);
		return existsSync(current) || !existsSync(legacy) ? current : legacy;
	}
	/**
	* 片段所属的剧集 id（改槽这类操作要返回"这一集"的 payload，否则前端会跳回第一集）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @returns 剧集 id；片段不存在时 null。
	*/
	clipEpisodeId(projectId, clipId) {
		return this.withProjectDb(projectId, (db) => {
			return db.prepare("SELECT episode_id FROM clips WHERE id = ?").get(clipId)?.episode_id ?? null;
		});
	}
	/**
	* 记下这一片段提交给 ComfyUI 的关键参数（哪张图进哪个槽、锚点几帧），供事后回查。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param payload - 要落库的 JSON。
	*/
	setClipSubmission(projectId, clipId, payload) {
		this.withProjectDb(projectId, (db) => {
			db.prepare("UPDATE clips SET submission_json = ? WHERE id = ?").run(JSON.stringify(payload), clipId);
		});
	}
	/**
	* 自愈：已经有成片文件、却被标成失败的片段，恢复成成功。
	*
	* 典型场景是等待超时（"任务长时间没有进度"）——ComfyUI 其实跑完了、文件也落地了，
	* 只是宿主等不及。每次挂载项目时跑一次，幂等。
	* @param projectId - 项目。
	* @returns 修好的条数。
	*/
	healClipsWithFilm(projectId) {
		return this.withProjectDb(projectId, (db) => {
			const result = db.prepare("UPDATE clips SET status = 'success', error_message = '' WHERE status = 'failed' AND result_video_path IS NOT NULL AND result_video_path <> ''").run();
			return Number(result.changes ?? 0);
		});
	}
	/**
	* 写入本集资产清单（扫描 series.json 时调用，幂等）。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param assets - 资产清单。
	*/
	setEpisodeAssets(projectId, episodeId, assets) {
		this.withProjectDb(projectId, (db) => {
			db.prepare("UPDATE episodes SET series_assets = ? WHERE id = ?").run(JSON.stringify(assets), episodeId);
		});
	}
	/**
	* 把一个素材绑到一个槽上（拖放用）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param slotKey - 槽键（first / kf-1 / last）。
	* @param assetId - 素材 id，null 表示清空。
	*/
	setSlotAsset(projectId, clipId, slotKey, assetId) {
		this.withProjectDb(projectId, (db) => {
			const row = db.prepare("SELECT role FROM clip_slots WHERE clip_id = ? AND slot_key = ?").get(clipId, slotKey);
			if (row === void 0) throw new Error("这个槽不存在（可能 series.json 里没有它）");
			db.prepare("UPDATE clip_slots SET asset_id = ? WHERE clip_id = ? AND slot_key = ?").run(assetId, clipId, slotKey);
			if (row.role === "first") db.prepare("UPDATE clips SET first_frame_asset_id = ?, updated_at = ? WHERE id = ?").run(assetId, nowIso(), clipId);
			if (row.role === "last") db.prepare("UPDATE clips SET last_frame_asset_id = ?, updated_at = ? WHERE id = ?").run(assetId, nowIso(), clipId);
		});
	}
	/** 列素材（项目库 + 本集）。 */
	listAssets(projectId, episodeId) {
		const { db } = this.projectHandle(projectId);
		return (episodeId === void 0 ? db.prepare("SELECT * FROM assets WHERE library = 'project' ORDER BY name COLLATE NOCASE").all() : db.prepare("SELECT * FROM assets WHERE library = 'project' OR episode_id = ? ORDER BY name COLLATE NOCASE").all(episodeId)).map((row) => this.assetOf(row));
	}
	/** 读一行素材。 */
	assetOf(row) {
		return {
			id: str(row["id"]),
			name: str(row["name"]),
			type: str(row["type"], "image"),
			mime: str(row["mime"]),
			size: Number(row["size"]),
			duration: num$1(row["duration"]),
			width: num$1(row["width"]),
			height: num$1(row["height"]),
			fps: num$1(row["fps"]),
			hasAudio: bit$1(row["has_audio"]),
			library: str(row["library"], "project"),
			episodeId: str(row["episode_id"]),
			category: str(row["category"]),
			revision: Number(row["revision"] ?? 0),
			createdAt: str(row["created_at"])
		};
	}
	/** 素材文件路径。 */
	assetPath(projectId, assetId) {
		const { db, dir } = this.projectHandle(projectId);
		const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(assetId);
		if (row === void 0) throw new Error("素材不存在");
		const stored = str(row["stored_name"]);
		const legacy = join(dir, ASSET_FOLDER, stored);
		if (str(row["library"], "project") === "episode") {
			const episodeId = str(row["episode_id"]);
			if (episodeId !== "") {
				const current = join(this.episodeMaterialDir(projectId, episodeId), stored);
				return {
					path: existsSync(current) || !existsSync(legacy) ? current : legacy,
					asset: this.assetOf(row)
				};
			}
		}
		return {
			path: legacy,
			asset: this.assetOf(row)
		};
	}
	/** 资产图文件路径。 */
	assetImagePath(projectId, assetId, imageId) {
		const { dir } = this.projectHandle(projectId);
		return join(dir, ASSET_FOLDER, ASSET_IMAGE_FOLDER, assetId, `${imageId}.png`);
	}
	/** 关键帧图路径。 */
	keyframePath(projectId, clipId, keyframeId) {
		const { dir } = this.projectHandle(projectId);
		return join(dir, ASSET_FOLDER, KEYFRAME_FOLDER, clipId, `${keyframeId}.png`);
	}
	/** 列资产图重绘历史。 */
	listAssetImages(projectId, assetId) {
		const { db } = this.projectHandle(projectId);
		return db.prepare("SELECT * FROM asset_images WHERE asset_id = ? ORDER BY created_at DESC").all(assetId).map((row) => ({
			id: str(row["id"]),
			assetId,
			prompt: row["prompt"] ?? null,
			workflowId: row["workflow_id"] ?? null,
			seed: num$1(row["seed"]),
			active: bit$1(row["active"]),
			size: Number(row["size"]),
			episodeId: str(row["episode_id"]),
			createdAt: str(row["created_at"])
		}));
	}
	/** 列一个剧集的任务。 */
	listJobs(projectId, episodeId) {
		const { db } = this.projectHandle(projectId);
		return db.prepare(`SELECT j.* FROM jobs j JOIN clips c ON c.id = j.clip_id
         WHERE c.episode_id = ? ORDER BY j.queued_at DESC LIMIT 200`).all(episodeId).map((row) => ({
			id: str(row["id"]),
			clipId: str(row["clip_id"]),
			kind: str(row["kind"], "clip"),
			slotKey: row["slot_key"] ?? null,
			assetId: row["asset_id"] ?? null,
			serverId: str(row["server_id"]),
			promptId: row["prompt_id"] ?? null,
			status: str(row["status"], "queued"),
			error: row["error"] ?? null,
			queuedAt: str(row["queued_at"]),
			startedAt: row["started_at"] ?? null,
			finishedAt: row["finished_at"] ?? null,
			queuePosition: null,
			progress: null,
			note: null,
			generationMs: num$1(row["generation_ms"])
		}));
	}
	/** 内置片段模板（M5 再扩）。 */
	listTemplates() {
		return [
			{
				id: "establish",
				name: "环境建立",
				mode: "reference",
				duration: 5,
				ratio: "16:9",
				scale: .5,
				fps: 24,
				prompt: ""
			},
			{
				id: "medium",
				name: "中景动作",
				mode: "reference",
				duration: 5,
				ratio: "16:9",
				scale: .5,
				fps: 24,
				prompt: ""
			},
			{
				id: "closeup",
				name: "近景情绪",
				mode: "reference",
				duration: 4,
				ratio: "16:9",
				scale: .5,
				fps: 24,
				prompt: ""
			}
		];
	}
	/** 内置示例项目（M5 再扩）。 */
	listSamples() {
		return [];
	}
	/** 项目目录是否可写（创建前校验用）。 */
	canUseDirectory(dir) {
		try {
			return statSync(dir).isDirectory();
		} catch {
			return false;
		}
	}
	/** 片段包文件名（导出用）。 */
	clipsFileName() {
		return CLIPS_FILE;
	}
	/** 重命名素材存储名（导入去重时用）。 */
	renameStored(projectId, from, to) {
		const dir = join(this.projectDir(projectId), ASSET_FOLDER);
		renameSync(join(dir, from), join(dir, to));
	}
	/** 删除素材整目录（重置时用）。 */
	clearAssets(projectId) {
		rmSync(join(this.projectDir(projectId), ASSET_FOLDER), {
			recursive: true,
			force: true
		});
		mkdirSync(join(this.projectDir(projectId), ASSET_FOLDER), {
			recursive: true,
			mode: 448
		});
	}
	/** 素材存储名。 */
	storedName(name) {
		const safe = basename(name).replace(/[^\w.\-\u4e00-\u9fa5]+/gu, "_");
		return `${crypto.randomUUID().slice(0, 8)}-${safe}`;
	}
	/** 旧库导入时的模式映射。 */
	static legacyMode(value) {
		return fromLegacyMode(value);
	}
	/** 释放库连接。 */
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.closeProject();
		try {
			this.catalog.close();
		} catch {}
	}
};
// lib/types/comfy/client.js
/**
* ComfyUI HTTP and WebSocket client for one configured backend. The client
* owns transport concerns only: reachability, capability caching, media
* upload, prompt submission, progress subscription, and artifact download.
* @module dsh-dream-studio-host/comfy/client
*/
/** Folder names `/models` exposes, in the order the workflow editor lists them. */
const MODEL_FOLDERS = [
	"checkpoints",
	"unet",
	"diffusion_models",
	"clip",
	"text_encoders",
	"vae",
	"loras",
	"latent_upscale_models"
];
/** Nodes that load a video file natively, newest ComfyUI cores only. */
const NATIVE_VIDEO_NODES = [
	"LoadVideo",
	"LoadVideoUpload",
	"VHS_LoadVideo"
];
/** ComfyUI-VideoHelperSuite node that supplies the video-loading fallback. */
const VIDEO_HELPER_NODES = [
	"VHS_LoadVideo",
	"VHS_LoadVideoPath",
	"VHS_LoadVideoFFmpeg"
];
/** Read a JSON object body, rejecting non-object payloads. */
async function readJson(response) {
	const value = await response.json();
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("ComfyUI 返回了非对象 JSON");
	return value;
}
/** Read a JSON array body, degrading to an empty list for any other payload. */
async function readArray(response) {
	const value = await response.json();
	return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
/** Truncate a failure body so error messages stay one line. */
function brief(text) {
	const collapsed = text.replaceAll(/\s+/gu, " ").trim();
	return collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed;
}
/**
* 把 ComfyUI 的校验失败翻成"哪个节点、哪个输入不对"。
*
* `/prompt` 返回 400 时带 `node_errors`：每个节点下有 `errors[].details`，
* 形如 `ref2va_model: 'x.safetensors' not in ['none', 'None', '无']`。
* 只说"参数不匹配"没法排查，这里把前几条拼出来。
* @param text - 原始响应体。
* @returns 可读原因。
*/
function validationDetail(text) {
	try {
		const body = JSON.parse(text);
		const parts = [];
		for (const [id, node] of Object.entries(body.node_errors ?? {})) for (const error of node.errors ?? []) parts.push(`${node.class_type ?? "节点"}(${id})：${error.details ?? error.message ?? "参数不匹配"}`);
		if (parts.length > 0) return parts.slice(0, 3).join("；");
	} catch {}
	return brief(text);
}
/**
* Read the files one node declaration accepts on one input.
*
* ComfyUI declares a file input as a combo whose first element is the list of
* values it takes, and every other declaration is a scalar input carrying no
* file list at all.
* @param body - parsed `/object_info` body.
* @param request - loader class type and input key to read.
* @returns the accepted file names, or null when the declaration carries none.
*/
function comboFiles(body, request) {
	const declaration = body[request.classType];
	if (typeof declaration !== "object" || declaration === null) return null;
	const groups = declaration.input;
	if (typeof groups !== "object" || groups === null) return null;
	const { required, optional } = groups;
	for (const group of [required, optional]) {
		if (typeof group !== "object" || group === null) continue;
		const spec = group[request.input];
		if (!Array.isArray(spec) || !Array.isArray(spec[0])) continue;
		return spec[0].filter((value) => typeof value === "string");
	}
	return null;
}
/** Map a transport failure to an actionable Chinese message. */
function transportError(error, baseUrl) {
	if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) return /* @__PURE__ */ new Error(`连接 ${baseUrl} 超时，请确认服务已启动、地址正确`);
	return /* @__PURE__ */ new Error(`无法连接 ${baseUrl}，请确认服务已启动、地址正确`);
}
/**
* Read the artifact list out of one `/history` entry.
*
* A history entry also reports the preview of every node that loads media, which
* points at the file inside the server's `input` folder. Those are files the run
* was given rather than files it wrote: a continuation uploads the film before it,
* and `/history` lists that upload ahead of the film the run actually produced.
* @param entry - one `/history` record.
* @returns the files the run wrote.
*/
function artifactsOf(entry) {
	const outputs = entry.outputs;
	if (typeof outputs !== "object" || outputs === null) return [];
	const found = [];
	for (const output of Object.values(outputs)) {
		if (typeof output !== "object" || output === null) continue;
		for (const value of Object.values(output)) {
			if (!Array.isArray(value)) continue;
			for (const item of value) {
				if (typeof item !== "object" || item === null) continue;
				const file = item;
				if (typeof file.filename !== "string") continue;
				const type = typeof file.type === "string" ? file.type : "output";
				if (type === "input") continue;
				found.push({
					filename: file.filename,
					subfolder: typeof file.subfolder === "string" ? file.subfolder : "",
					type
				});
			}
		}
	}
	return found;
}
/** One HTTP and WebSocket conversation with a single ComfyUI backend. */
var ComfyClient = class {
	baseUrl;
	clientId;
	timeoutMs;
	capsTtlMs;
	capsCache;
	infoCache;
	modelsCache;
	socket;
	listeners = /* @__PURE__ */ new Set();
	/** @param options - backend URL, client id, and cache lifetimes. */
	constructor(options) {
		this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
		this.clientId = options.clientId;
		this.timeoutMs = options.timeoutMs ?? 2e4;
		this.capsTtlMs = options.capsTtlMs ?? 12e4;
	}
	/** Root URL this client talks to. */
	get url() {
		return this.baseUrl;
	}
	/** Drop cached capability, node-declaration, and model lists after a server configuration change. */
	invalidate() {
		this.capsCache = void 0;
		this.infoCache = void 0;
		this.modelsCache = void 0;
	}
	/** Perform one request against this backend. */
	async request(path, init = {}) {
		try {
			return await fetch(`${this.baseUrl}${path}`, {
				...init,
				signal: AbortSignal.timeout(this.timeoutMs)
			});
		} catch (error) {
			throw transportError(error, this.baseUrl);
		}
	}
	/**
	* Read ComfyUI system statistics (SRV-5).
	* @returns the backend's reported system statistics.
	*/
	async systemStats() {
		const response = await this.request("/system_stats");
		if (!response.ok) throw new Error(`/system_stats 返回 HTTP ${String(response.status)}`);
		return readJson(response);
	}
	/**
	* Probe `/object_info` and cache the node set (SRV-6).
	* @param refresh - ignore the cached probe.
	* @returns the detected capabilities, with `reachable: false` when the probe failed.
	*/
	async caps(refresh = false) {
		const cached = this.capsCache;
		if (!refresh && cached !== void 0 && Date.now() - cached.probedAt < this.capsTtlMs) return cached;
		const probed = await this.probeCaps();
		this.capsCache = probed;
		return probed;
	}
	/** Run one capability probe, degrading to an unreachable record. */
	async probeCaps() {
		const empty = {
			reachable: false,
			nodes: [],
			nativeLoadVideo: false,
			videoHelperSuite: false,
			hasModelsEndpoint: false,
			probedAt: Date.now()
		};
		try {
			const body = await this.objectInfo();
			if (body === null) return {
				...empty,
				probedAt: Date.now()
			};
			const nodes = Object.keys(body);
			const models = await this.request("/models");
			return {
				reachable: true,
				nodes,
				nativeLoadVideo: nodes.some((name) => NATIVE_VIDEO_NODES.includes(name) && name !== "VHS_LoadVideo"),
				videoHelperSuite: nodes.some((name) => VIDEO_HELPER_NODES.includes(name)),
				hasModelsEndpoint: models.ok,
				probedAt: Date.now()
			};
		} catch {
			return {
				...empty,
				probedAt: Date.now()
			};
		}
	}
	/**
	* Read `/object_info`，在缓存有效期内复用。
	*
	* 设置页的"检查配置"也走这里：节点声明、下拉候选都来自这份数据。
	* @returns 节点声明；服务器不答时为 null。
	*/
	async objectInfo() {
		const cached = this.infoCache;
		if (cached !== void 0 && Date.now() - cached.at < this.capsTtlMs) return cached.body;
		try {
			const response = await this.request("/object_info");
			if (!response.ok) return null;
			const body = await readJson(response);
			this.infoCache = {
				body,
				at: Date.now()
			};
			return body;
		} catch {
			return null;
		}
	}
	/**
	* Read the files the loader nodes of this server accept (WF-7).
	*
	* A ComfyUI node declares every file input as a combo, so this answers for a
	* server whose `/models` listing is absent, or names a folder differently
	* from the one a workflow's profile assumes.
	* @param requests - loader class type and input key pairs to look up.
	* @returns one entry per request, with `files: null` when the server declared none.
	*/
	async inputOptions(requests) {
		if (requests.length === 0) return [];
		const body = await this.objectInfo();
		return requests.map((request) => ({
			...request,
			files: body === null ? null : comboFiles(body, request)
		}));
	}
	/**
	* List selectable model files per folder (WF-7, SRV-7).
	* @param folder - restrict the listing to one ComfyUI models folder.
	* @returns folder/file pairs; empty on cloud backends without `/models`.
	*/
	async models(folder) {
		const cached = this.modelsCache;
		if (cached !== void 0 && folder === void 0) return cached;
		const folders = folder === void 0 ? MODEL_FOLDERS : [folder];
		const response = await this.request("/models");
		if (response.status === 404) return [];
		if (!response.ok) return [];
		const available = await readArray(response);
		const selected = available.length === 0 ? folders : available;
		const listing = [];
		for (const name of selected) {
			if (folder !== void 0 && name !== folder) continue;
			try {
				const files = await this.request(`/models/${encodeURIComponent(name)}`);
				listing.push({
					folder: name,
					files: files.ok ? await readArray(files) : []
				});
			} catch {
				listing.push({
					folder: name,
					files: []
				});
			}
		}
		if (folder === void 0) this.modelsCache = listing;
		return listing;
	}
	/**
	* Upload one image for a LoadImage node (ENG-9).
	* @param bytes - encoded image bytes.
	* @param filename - file name ComfyUI should record.
	* @param overwrite - replace an existing upload with the same name.
	* @returns the file name the graph must reference.
	*/
	async uploadImage(bytes, filename, overwrite = true) {
		const form = new FormData();
		form.set("image", new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }), filename);
		form.set("overwrite", overwrite ? "true" : "false");
		const response = await this.request("/upload/image", {
			method: "POST",
			body: form
		});
		if (!response.ok) throw new Error(`上传素材失败：HTTP ${String(response.status)} ${brief(await response.text().catch(() => ""))}`);
		const body = await readJson(response);
		if (typeof body.name !== "string") throw new Error("上传素材失败：ComfyUI 未返回文件名");
		return `${typeof body.subfolder === "string" && body.subfolder !== "" ? `${body.subfolder}/` : ""}${body.name}`;
	}
	/**
	* Submit one prepared workflow (ENG-11).
	* @param graph - ComfyUI API-format node graph.
	* @returns the accepted prompt id.
	*/
	async submit(graph) {
		const response = await this.request("/prompt", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				prompt: graph,
				client_id: this.clientId
			})
		});
		const text = await response.text();
		if (!response.ok) throw new Error(`工作流校验失败：${validationDetail(text)}`);
		let body;
		try {
			body = JSON.parse(text);
		} catch {
			throw new Error("ComfyUI 提交失败：响应不是 JSON");
		}
		if (typeof body !== "object" || body === null || typeof body.prompt_id !== "string") throw new Error(`ComfyUI 提交失败：${brief(text)}`);
		return body.prompt_id;
	}
	/**
	* Read one prompt's history entry.
	* @param promptId - id returned by `submit`.
	* @returns the artifacts the prompt wrote, plus any execution error text.
	*/
	async history(promptId) {
		const response = await this.request(`/history/${encodeURIComponent(promptId)}`);
		if (!response.ok) return {
			found: false,
			artifacts: [],
			error: null
		};
		const entry = (await readJson(response))[promptId];
		if (typeof entry !== "object" || entry === null) return {
			found: false,
			artifacts: [],
			error: null
		};
		const status = entry.status;
		const error = statusText(status);
		return {
			found: true,
			artifacts: artifactsOf(entry),
			error
		};
	}
	/**
	* 这个 prompt 现在还在 ComfyUI 队列里吗（排队或执行中）。
	* @param promptId - 提交返回的 id。
	* @returns 'running' | 'pending' | 'absent'（查不到就当不在）。
	*/
	async queueState(promptId) {
		const response = await this.request("/queue");
		if (!response.ok) return "absent";
		const record = await readJson(response);
		const has = (list) => Array.isArray(list) && list.some((entry) => Array.isArray(entry) && entry.includes(promptId));
		if (has(record.queue_running)) return "running";
		if (has(record.queue_pending)) return "pending";
		return "absent";
	}
	/** Ask ComfyUI to interrupt the prompt it is executing (ENG-3). */
	async interrupt() {
		const response = await this.request("/interrupt", { method: "POST" });
		if (!response.ok) throw new Error(`取消失败：HTTP ${String(response.status)}`);
	}
	/**
	* 让 ComfyUI 卸载模型、回收显存。
	*
	* 视频放大（RelayVSR）与补帧（film_net）是两套大模型：上一套还占着显存/文件句柄时，
	* 下一套的权重预取会失败（典型报错 `HostBuffer.read_file_slice failed`，errno 1450）。
	* 每次后处理前先卸干净，避免两套模型互相踩。
	*/
	async freeMemory() {
		try {
			await this.request("/free", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					unload_models: true,
					free_memory: true
				})
			});
		} catch {}
	}
	/**
	* Read the current queue depth.
	* @returns how many prompts are running and how many are pending.
	*/
	async queueDepth() {
		const response = await this.request("/queue");
		if (!response.ok) return {
			running: 0,
			pending: 0
		};
		const body = await readJson(response);
		const size = (value) => Array.isArray(value) ? value.length : 0;
		return {
			running: size(body.queue_running),
			pending: size(body.queue_pending)
		};
	}
	/**
	* Download one produced artifact.
	* @param artifact - file descriptor returned by `history`.
	* @returns the downloaded bytes.
	*/
	async download(artifact) {
		const query = new URLSearchParams({
			filename: artifact.filename,
			subfolder: artifact.subfolder,
			type: artifact.type
		});
		const response = await this.request(`/view?${query.toString()}`);
		if (!response.ok) throw new Error(`产物拉取失败：HTTP ${String(response.status)}`);
		return new Uint8Array(await response.arrayBuffer());
	}
	/**
	* Whether one file exists in the backend's output folder.
	* @param subfolder - folder below the output root, slash separated.
	* @param filename - file name inside that folder.
	* @returns true when the backend serves the file.
	*/
	async outputFileExists(subfolder, filename) {
		const query = new URLSearchParams({
			filename,
			subfolder,
			type: "output"
		});
		const response = await this.request(`/view?${query.toString()}`);
		await response.body?.cancel();
		return response.ok;
	}
	/**
	* 只取输出文件开头的一段字节（safetensors 的 8 字节头长 + JSON 头就够读形状）。
	* 用来在提交前确认上一段 latent 有多长：文件不存在时返回 null。
	* @param subfolder - 输出目录下的子目录（相对 output 根）。
	* @param filename - 文件名。
	* @param bytes - 最多读多少字节，默认 64 KiB。
	*/
	async outputFileHead(subfolder, filename, bytes = 65536) {
		const query = new URLSearchParams({
			filename,
			subfolder,
			type: "output"
		});
		const response = await this.request(`/view?${query.toString()}`);
		if (!response.ok) {
			await response.body?.cancel();
			return null;
		}
		const reader = response.body?.getReader();
		if (reader === void 0) return null;
		const chunks = [];
		let total = 0;
		while (total < bytes) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value !== void 0) {
				chunks.push(value);
				total += value.byteLength;
			}
		}
		await reader.cancel();
		const head = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			head.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return head;
	}
	/**
	* Subscribe to this backend's progress socket.
	* @param listener - receives every routed progress event.
	* @returns a disposer that closes the socket once its last listener leaves.
	*/
	subscribe(listener) {
		this.listeners.add(listener);
		this.openSocket();
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0) this.closeSocket();
		};
	}
	/** Open the shared WebSocket when the runtime supplies one. */
	openSocket() {
		if (this.socket !== void 0 || typeof WebSocket === "undefined") return;
		try {
			const socket = new WebSocket(`${this.baseUrl.replace(/^http/u, "ws")}/ws?clientId=${encodeURIComponent(this.clientId)}`);
			socket.addEventListener("message", (event) => {
				this.dispatch(typeof event.data === "string" ? event.data : "");
			});
			socket.addEventListener("close", () => {
				this.socket = void 0;
			});
			socket.addEventListener("error", () => {
				this.socket = void 0;
			});
			this.socket = socket;
		} catch {
			this.socket = void 0;
		}
	}
	/** Close the progress socket, tolerating an already-closed runtime handle. */
	closeSocket() {
		const socket = this.socket;
		this.socket = void 0;
		if (socket === void 0) return;
		try {
			socket.close();
		} catch {}
	}
	/** Route one raw WebSocket message to the registered listeners. */
	dispatch(raw) {
		if (raw === "") return;
		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}
		if (typeof parsed !== "object" || parsed === null) return;
		const message = parsed;
		const data = typeof message.data === "object" && message.data !== null ? message.data : {};
		const promptId = typeof data.prompt_id === "string" ? data.prompt_id : "";
		let value = typeof data.value === "number" ? data.value : null;
		let maximum = typeof data.max === "number" ? data.max : null;
		if (message.type === "progress_state") {
			const nodes = typeof data.nodes === "object" && data.nodes !== null ? data.nodes : {};
			let best = 0;
			for (const entry of Object.values(nodes)) {
				if (typeof entry !== "object" || entry === null) continue;
				const node = entry;
				const nodeMax = typeof node.max === "number" ? node.max : 0;
				const nodeValue = typeof node.value === "number" ? node.value : 0;
				if (nodeMax > best) {
					best = nodeMax;
					value = nodeValue;
					maximum = nodeMax;
				}
			}
		}
		const event = {
			promptId,
			kind: progressKind(message.type === "progress_state" ? "progress" : message.type),
			value,
			maximum,
			node: typeof data.node === "string" ? data.node : null,
			message: typeof data.exception_message === "string" ? data.exception_message : null
		};
		for (const listener of this.listeners) listener(event);
	}
};
/** Map a ComfyUI WebSocket message type onto the engine's progress vocabulary. */
function progressKind(type) {
	switch (type) {
		case "progress": return "progress";
		case "executing": return "executing";
		case "executed": return "executed";
		case "execution_success": return "success";
		case "execution_error": return "error";
		default: return "status";
	}
}
/** Read the failure text out of one history `status` record. */
function statusText(status) {
	if (typeof status !== "object" || status === null) return null;
	const record = status;
	if (typeof record.status_str === "string" && record.status_str === "error") {
		if (Array.isArray(record.messages)) {
			for (const entry of record.messages) if (Array.isArray(entry) && typeof entry[1] === "object" && entry[1] !== null) {
				const detail = entry[1];
				if (typeof detail.exception_message === "string") return detail.exception_message;
			}
		}
		return "ComfyUI 执行失败";
	}
	return null;
}
// lib/types/graph/profiles.js
/** MiniMax H3 family: t2v, i2v, and reference-to-video sharing one model stack. */
const MINIMAX_H3_PROFILE = {
	id: "minimax_h3",
	label: "MiniMax H3",
	modes: ["frames", "reference"],
	frameAlignment: {
		multiple: 17,
		offset: 5,
		minimum: 5
	},
	ratios: [
		"16:9",
		"9:16",
		"1:1",
		"4:3",
		"3:4",
		"21:9"
	],
	scales: [
		.2,
		.3,
		.5,
		.8,
		1
	],
	modelSlots: [
		{
			folder: "unet",
			nodeTypes: ["UNETLoader"],
			input: "unet_name",
			marker: "minimax_h3"
		},
		{
			folder: "clip",
			nodeTypes: ["CLIPLoader"],
			input: "clip_name",
			marker: "qwen3vl"
		},
		{
			folder: "vae",
			nodeTypes: ["VAELoader"],
			input: "vae_name",
			marker: "minimax_h3"
		},
		{
			folder: "loras",
			nodeTypes: ["LoraLoaderModelOnly", "LoraLoader"],
			input: "lora_name",
			marker: "minimax_h3"
		},
		{
			folder: "checkpoints",
			nodeTypes: ["CheckpointLoaderSimple"],
			input: "ckpt_name",
			marker: "minimax_h3"
		},
		{
			folder: "latent_upscale_models",
			nodeTypes: ["MinimaxH3LatentUpscaler3D"],
			input: "model_name",
			marker: "minimax_h3"
		}
	],
	referenceNodeTypes: ["MiniMaxH3ReferenceToVideo", "MiniMaxH3ReferenceToVideoLatent"],
	imageNodeTypes: [
		"LoadImage",
		"ImageResizeKJ",
		"VHS_LoadVideo"
	]
};
/** Every family this build recognizes, keyed by profile id. */
const TIME_RIVER_PROFILES = [MINIMAX_H3_PROFILE];
/** Node class types whose `inputs` receive a text prompt. */
const PROMPT_NODE_TYPES = [
	"PrimitiveStringMultiline",
	"CLIPTextEncode",
	"String Literal",
	"Text Multiline"
];
/** Node class types whose `inputs` receive a frame count or duration. */
const LENGTH_NODE_TYPES = [
	"PrimitiveInt",
	"PrimitiveFloat",
	"MathExpression",
	"ComfyMathExpression",
	"SimpleCalculator"
];
/** Node class types whose `inputs` receive a canvas size. */
const RESOLUTION_NODE_TYPES = [
	"ResolutionSelector",
	"MiniMaxH3Resolution",
	"EmptyMiniMaxH3LatentVideo"
];
/** Node class types carrying a random seed. */
const SEED_NODE_TYPES = [
	"RandomNoise",
	"KSampler",
	"SamplerCustomAdvanced",
	"MiniMaxH3Sampler"
];
/**
* Nodes carrying a sampler's step count, most specific first: the classic
* samplers hold it themselves, and the H3 pipeline keeps it on the scheduler
* stage that feeds `SamplerCustomAdvanced`.
*/
const STEP_NODE_TYPES = [
	"KSampler",
	"KSamplerAdvanced",
	"BasicScheduler"
];
/** Node class types carrying the frame rate a rendered film is muxed at. */
const FPS_NODE_TYPES = [
	"CreateVideo",
	"SaveVideo",
	"VHS_VideoCombine"
];
/** The frame inputs a video model names, paired with the parameter each carries. */
const FRAME_MEDIA_INPUTS = [["first_frame", "firstFrame"], ["last_frame", "lastFrame"]];
/** Node class type that pins a picture to a frame of the shot. */
const GUIDE_NODE_TYPE = "MiniMaxH3AddGuide";
/** Node class types that inject a frame into an existing conditioning latent. */
const GUIDE_NODE_TYPES = [GUIDE_NODE_TYPE];
/** Node class type that strips the pinned anchors back out of a conditioning. */
const GUIDE_STRIP_NODE_TYPES = ["MiniMaxH3StripKeyframes"];
/** Input keys carrying the conditioning a sampler or a guide stage reads. */
const CONDITIONING_INPUT_KEYS = ["conditioning", "positive"];
/** Node class type that archives a sampling pass's latent beside the server's own outputs. */
const LATENT_SAVE_NODE_TYPES = ["TimeRiver_LatentSave", "DreamStudio_LatentSave"];
/** Node class type that reads an archived latent back. */
const LATENT_LOAD_NODE_TYPES$1 = ["TimeRiver_LatentLoad", "DreamStudio_LatentLoad"];
/** Both halves of a family's latent handoff: the first pass writes one, the second reads it. */
const LATENT_ARCHIVE_NODE_TYPES = [...LATENT_SAVE_NODE_TYPES, ...LATENT_LOAD_NODE_TYPES$1];
/**
* Input on those nodes carrying the key their file lives under. The key is what
* keeps two clips of one project apart, so the engine always writes it; a graph
* carrying either node without one is reported rather than left to write every
* clip's pass over the last one's file.
*/
const LATENT_ARCHIVE_INPUT = "project_id";
/** Node class type whose switch selects between the first and second sampling pass. */
const SECOND_PASS_SWITCH_NODE_TYPES = ["LazySwitchKJ"];
/** Input on that switch receiving the second sampler's latent. */
const SECOND_PASS_SWITCH_INPUT = "on_true";
/**
* Node class types that enlarge the latent the second pass repaints. The H3
* upscaler is asked for a megapixel count rather than a factor, so the operator's
* choice is the size the second pass draws at.
*/
const SECOND_PASS_UPSCALER_NODE_TYPES = ["MinimaxH3LatentUpscaler3D"];
/** Input naming which of the upscaler's size modes applies. */
const UPSCALER_MODE_INPUT = "mode";
/** That mode's own size input, in megapixels. */
const UPSCALER_MEGAPIXEL_INPUT = "mode.megapixels";
/** The size mode {@link UPSCALER_MEGAPIXEL_INPUT} belongs to. */
const UPSCALER_MEGAPIXEL_MODE = "megapixels";
/**
* The guide count one clip states, when it states a usable one.
*
* The stage reads the last `num_frames` frames of the previous film, and the node
* that takes them refuses a count of zero — it solves the tail as the film's
* whole length and then rejects that index — so a package that writes `0` for
* clips it never meant to guide has stated no count at all.
* @param stated - the count the clip states, when it states one.
* @returns the stated count, or null when the clip states none it can use.
*/
function statedGuideCount(stated) {
	return typeof stated === "number" && Number.isFinite(stated) && stated >= 1 ? Math.trunc(stated) : null;
}
/**
* Frames one continuation takes from the previous film.
* @param stated - the count the clip states, when it states one.
* @returns the frame count to bind, which the previous film's tail always has room for.
*/
function guideFrames(stated) {
	return statedGuideCount(stated) ?? 5;
}
/** Nodes of the continuation chain a shipped guide workflow carries. */
const PRIOR_FILM_NODE_TYPES = ["LoadVideo"];
const GUIDE_COUNT_NODE_TYPES = ["PrimitiveInt"];
const GUIDE_RANGE_NODE_TYPES = ["GetImageRangeFromBatch"];
/** Node class types that write a finished artifact; they root the reachability walk. */
const OUTPUT_NODE_TYPES = [
	"SaveVideo",
	"SaveWEBM",
	"SaveAnimatedWEBP",
	"SaveImage",
	"SaveImageAdvanced",
	"SaveAudio",
	"PreviewImage",
	"PreviewAudio",
	"VHS_VideoCombine",
	"VHS_SaveVideo",
	"TimeRiver_LatentSave",
	"DreamStudio_LatentSave",
	"MiniMaxH3MotionContextSaveLatent"
];
/** Graph input keys that name one media file. */
const FILE_INPUT_KEYS = [
	"image",
	"file",
	"audio",
	"video",
	"path",
	"filename"
];
/** Input keys, per family, that carry the clip's duration in seconds rather than frames. */
const DURATION_INPUT_KEYS = [
	"length",
	"num_frames",
	"video_length",
	"frames"
];
/**
* `ResolutionSelector` aspect-ratio labels. The node publishes them as a
* dynamic combo, so the ratio the clip asks for is written as the label the
* installed node accepts.
*/
const ASPECT_RATIO_LABELS = {
	"1:1": "1:1 (Square)",
	"3:4": "3:4 (Portrait Standard)",
	"4:3": "4:3 (Standard)",
	"9:16": "9:16 (Portrait Widescreen)",
	"16:9": "16:9 (Widescreen)",
	"21:9": "21:9 (Ultrawide)"
};
/** Read one graph node, or undefined when the entry is not a node object. */
function node(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const candidate = value;
	if (typeof candidate.class_type !== "string") return void 0;
	if (typeof candidate.inputs !== "object" || candidate.inputs === null) return void 0;
	return value;
}
/**
* List graph entries that are ComfyUI nodes.
* @param graph - parsed workflow JSON.
* @returns node id and node pairs in ascending numeric id order.
*/
function graphNodes(graph) {
	const entries = [];
	for (const [id, value] of Object.entries(graph)) {
		const parsed = node(value);
		if (parsed !== void 0) entries.push([id, parsed]);
	}
	return entries.sort((left, right) => Number(left[0]) - Number(right[0]));
}
/** A node's title, falling back to its class type. */
function nodeTitle(value) {
	return value._meta?.title ?? value.class_type;
}
/**
* Align a requested duration to a model family's frame grid (ENG-13).
* @param duration - requested clip duration in seconds.
* @param fps - frame rate the clip is rendered at.
* @param alignment - the family's frame rule.
* @returns the nearest frame count satisfying `multiple * n + offset`.
*/
function alignFrames(duration, fps, alignment) {
	const target = Math.max(alignment.minimum, Math.round(duration * fps));
	const steps = Math.round((target - alignment.offset) / alignment.multiple);
	return Math.max(alignment.minimum, alignment.multiple * steps + alignment.offset);
}
/**
* Frame count implied by a clip's duration, fps, and the family rule.
* @param duration - requested clip duration in seconds.
* @param fps - frame rate the clip is rendered at.
* @param profile - model family supplying the frame rule.
* @returns the aligned frame count.
*/
function clipFrames(duration, fps, profile) {
	return alignFrames(duration, fps, profile.frameAlignment);
}
/**
* Convert a megapixel and aspect-ratio request into pixel dimensions.
* @param scale - requested megapixels.
* @param ratio - `width:height` aspect ratio.
* @param multiple - edge alignment, defaulting to 16.
* @returns even, multiple-aligned width and height.
*/
function resolutionFor(scale, ratio, multiple = 16) {
	const [rawWidth, rawHeight] = ratio.split(":");
	const widthUnits = Number(rawWidth);
	const heightUnits = Number(rawHeight);
	const aspect = Number.isFinite(widthUnits) && Number.isFinite(heightUnits) && widthUnits > 0 && heightUnits > 0 ? widthUnits / heightUnits : 16 / 9;
	const totalPixels = Math.max(.05, scale) * 1e6;
	const width = Math.sqrt(totalPixels * aspect);
	const snap = (value) => Math.max(multiple, Math.round(value / multiple) * multiple);
	return {
		width: snap(width),
		height: snap(width / aspect)
	};
}
/** Find the first node whose class type is listed and whose inputs carry a key matching the pattern. */
function matchNode(entries, classTypes, inputPattern, used) {
	for (const [id, value] of entries) {
		if (used.has(id) || !classTypes.includes(value.class_type)) continue;
		const key = Object.keys(value.inputs).find((name) => inputPattern.test(name));
		if (key !== void 0) return [
			id,
			value,
			key
		];
	}
}
/** Find a node by class type regardless of input names. */
function matchAnyNode(entries, classTypes, used) {
	for (const [id, value] of entries) if (!used.has(id) && classTypes.includes(value.class_type)) return [id, value];
}
/** Find a node by class type with a title matching the pattern, used for first/last frame slots. */
function matchTitledNode(entries, classTypes, titlePattern, used) {
	for (const [id, value] of entries) {
		if (used.has(id) || !classTypes.includes(value.class_type) || !titlePattern.test(nodeTitle(value))) continue;
		const key = Object.keys(value.inputs).find((name) => /^(image|file|video|path)$/u.test(name));
		if (key !== void 0) return [
			id,
			value,
			key
		];
	}
}
/** Find a titled node and the input key it carries, for parameters named by title. */
function matchTitledInput(entries, classTypes, titlePattern, inputKeys, used) {
	for (const [id, value] of entries) {
		if (used.has(id) || !classTypes.includes(value.class_type) || !titlePattern.test(nodeTitle(value))) continue;
		const key = Object.keys(value.inputs).find((name) => inputKeys.test(name));
		if (key !== void 0) return [
			id,
			value,
			key
		];
	}
}
/**
* Delete the chain that loads a template's own sample film, keeping the guide stage
* itself when the clip has a picture to pin there.
*
* The chain leaves rather than waiting for the reachability prune: its loader names
* the template's own sample video, and ComfyUI validates every file a node names
* before it runs anything. A stage is read by whatever consumes the conditioning it
* returns, so it is bypassed before it leaves — deleting it outright would leave
* those consumers pointing at a node the graph no longer holds, which ComfyUI
* refuses to run.
* @param prepared - the graph being prepared.
* @param entries - the graph's nodes.
* @param range - the guide range the stage reads its frames from.
* @param used - node ids already claimed by another parameter; the dropped chain
* joins it, so the stages that remain are the ones the graph still holds.
* @param keepStage - whether the clip anchors a picture, which the stage then carries
* instead of the film it no longer reads.
*/
function dropFilmGuide(prepared, entries, range, used, keepStage) {
	const chain = /* @__PURE__ */ new Set([range[0]]);
	const stages = [];
	for (const [id, node] of entries) if (GUIDE_NODE_TYPES.includes(node.class_type) && linkOf(node.inputs["image"])?.[0] === range[0]) {
		chain.add(id);
		stages.push(id);
	}
	const carrier = linkOf(range[1].inputs["num_frames"])?.[0];
	if (carrier !== void 0) chain.add(carrier);
	let link = linkOf(range[1].inputs["images"]);
	while (link !== void 0 && !chain.has(link[0])) {
		const node = entries.find((entry) => entry[0] === link?.[0]);
		if (node === void 0) break;
		chain.add(node[0]);
		link = linkOf(node[1].inputs["video"]) ?? linkOf(node[1].inputs["file"]) ?? linkOf(node[1].inputs["images"]);
	}
	for (const id of stages) if (keepStage) {
		chain.delete(id);
		const inputs = nodeInputs(prepared, id);
		if (inputs !== void 0) Reflect.deleteProperty(inputs, "image");
	} else bypassNode(prepared, id, "positive");
	for (const id of chain) {
		Reflect.deleteProperty(prepared, id);
		used.add(id);
	}
}
/**
* Bind one continuation clip's guide stage: the previous clip's film becomes the
* guide source, and the tail length the graph reads from it is the operator's
* frame count. Claiming the guide node here also keeps the first-frame stage
* from dropping it, since a continuation clip carries no first frame.
* @param prepared - the graph being prepared.
* @param input - resolved clip parameters and uploaded media names.
* @param entries - the graph's nodes.
* @param used - node ids already claimed by another parameter.
* @param bindings - collected bindings.
* @param anchored - whether the clip pins pictures of its own, which keep the stage.
* @returns the guide stage the previous film feeds, or undefined when it feeds none.
*/
function bindContinuationGuide(prepared, input, entries, used, bindings, anchored) {
	const range = matchAnyNode(entries, GUIDE_RANGE_NODE_TYPES, used);
	if (input.media.priorFilm === null) {
		if (range !== void 0) dropFilmGuide(prepared, entries, range, used, anchored);
		return;
	}
	if (range === void 0) return void 0;
	const frames = guideFrames(input.guideFrameCount);
	const claim = claimer(prepared, used, bindings);
	const source = matchTitledInput(entries, PRIOR_FILM_NODE_TYPES, /pre_video/iu, /^(file|video|path)$/u, used);
	if (source !== void 0) claim("priorFilm", source[0], source[2], input.media.priorFilm);
	const wired = linkOf(range[1].inputs["num_frames"]);
	const titled = matchTitledInput(entries, GUIDE_COUNT_NODE_TYPES, /guideFrameCount/iu, /^(value|int)$/u, used);
	if (titled !== void 0) claim("guideFrameCount", titled[0], titled[2], frames);
	else if (wired !== void 0) claim("guideFrameCount", wired[0], "value", frames);
	claim("guideStart", range[0], "start_index", -1);
	const guide = matchAnyNode(entries, GUIDE_NODE_TYPES, used);
	if (guide !== void 0) used.add(guide[0]);
	return guide?.[0];
}
/** Apply one resolved binding onto a copied graph node. */
function writeBinding(graph, binding) {
	const target = graph[binding.nodeId];
	if (typeof target !== "object" || target === null) return;
	const inputs = target.inputs;
	if (inputs === void 0) return;
	inputs[binding.input] = binding.value;
}
/**
* Build the helper one graph preparation claims nodes through: it marks the node
* as spoken for, records the binding, and writes the value onto the copy.
* @param prepared - the graph being prepared.
* @param used - node ids already claimed by another parameter.
* @param bindings - collected bindings.
* @returns a claim function for one parameter.
*/
function claimer(prepared, used, bindings) {
	return (parameter, nodeId, key, value) => {
		used.add(nodeId);
		const binding = {
			parameter,
			nodeId,
			input: key,
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	};
}
/** Read one graph entry as a node. */
function graphNode(graph, id) {
	return node(graph[id]);
}
/** The `[nodeId, outputSlot]` link one input carries, or undefined for a literal value. */
function linkOf(value) {
	return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number" ? [value[0], value[1]] : void 0;
}
/** The trailing slot number of a `family.N` input key, or undefined when it carries none. */
function slotIndex(key) {
	const match = /_(\d+)$/u.exec(key);
	return match === null ? void 0 : Number(match[1]);
}
/** One input of a graph node, as a mutable record. */
function nodeInputs(graph, id) {
	const target = graph[id];
	if (typeof target !== "object" || target === null) return void 0;
	return target.inputs;
}
/**
* Follow a reference input to the node that names a media file, so an uploaded
* asset lands where ComfyUI reads it — `LoadImage.image`, `LoadVideo.file`, or
* `LoadAudio.audio` behind a component split.
* @param graph - the graph being prepared.
* @param value - the reference input's link.
* @returns the file-carrying node and the input key holding its name.
*/
function fileSlot(graph, value) {
	const first = linkOf(value);
	if (first === void 0) return void 0;
	const seen = /* @__PURE__ */ new Set();
	let id = first[0];
	for (;;) {
		if (seen.has(id)) return void 0;
		seen.add(id);
		const current = graphNode(graph, id);
		if (current === void 0) return void 0;
		const key = Object.keys(current.inputs).find((name) => FILE_INPUT_KEYS.includes(name) && typeof current.inputs[name] === "string");
		if (key !== void 0) return {
			nodeId: id,
			input: key
		};
		const next = Object.values(current.inputs).map(linkOf).find((candidate) => candidate !== void 0);
		if (next === void 0) return void 0;
		id = next[0];
	}
}
/**
* Remove one pass-through node by rewiring its consumers to the input it
* forwards, which is how a template's optional guide stage disappears.
* @param graph - the graph being prepared.
* @param id - the pass-through node to drop.
* @param forward - the input key carrying the value the node returns.
*/
function bypassNode(graph, id, forward) {
	const replacement = nodeInputs(graph, id)?.[forward];
	if (replacement === void 0) return;
	for (const target of Object.values(graph)) {
		const inputs = typeof target === "object" && target !== null ? target.inputs : void 0;
		if (inputs === void 0) continue;
		for (const [key, input] of Object.entries(inputs)) {
			const link = linkOf(input);
			if (link !== void 0 && link[0] === id) inputs[key] = replacement;
		}
	}
	Reflect.deleteProperty(graph, id);
}
/**
* Drop every node no graph output reaches. A template carries sample media the
* clip does not fill; leaving those loaders in place would make ComfyUI
* validate files the deployment need not hold.
* @param graph - the graph being prepared.
*/
function pruneUnreachable(graph) {
	const entries = graphNodes(graph);
	const consumed = /* @__PURE__ */ new Set();
	for (const [, value] of entries) for (const input of Object.values(value.inputs)) {
		const link = linkOf(input);
		if (link !== void 0) consumed.add(link[0]);
	}
	const outputs = entries.filter(([, value]) => OUTPUT_NODE_TYPES.includes(value.class_type)).map(([id]) => id);
	const roots = outputs.length > 0 ? outputs : entries.filter(([id]) => !consumed.has(id)).map(([id]) => id);
	const reachable = /* @__PURE__ */ new Set();
	const walk = (id) => {
		if (reachable.has(id)) return;
		reachable.add(id);
		const current = graphNode(graph, id);
		if (current === void 0) return;
		for (const input of Object.values(current.inputs)) {
			const link = linkOf(input);
			if (link !== void 0) walk(link[0]);
		}
	};
	for (const id of roots) walk(id);
	for (const id of Object.keys(graph)) if (!reachable.has(id)) Reflect.deleteProperty(graph, id);
}
/** Retime a seconds-to-frames expression onto the frame rate the clip asks for. */
function retimeExpression(expression, fps) {
	return expression.replace(/(round\([^)]*\*\s*)(\d+(?:\.\d+)?)/gu, (_match, head) => `${head}${String(fps)}`);
}
/** Resolve the graph node a `paramMap` entry names, falling back to the profile default. */
function bindingFromMap(map, parameter) {
	return map[parameter];
}
/** Widen a matched node into the triple the binding writer expects. */
function asTriple(match, input) {
	return match === void 0 ? void 0 : [
		match[0],
		match[1],
		input
	];
}
/** The upscaler enlarging the latent one sampler repaints, when the template puts one between the passes. */
function secondPassUpscaler(entries, sampler) {
	const link = linkOf(sampler.inputs["latent_image"]);
	const producer = link === void 0 ? void 0 : entries.find((entry) => entry[0] === link[0]);
	return producer !== void 0 && SECOND_PASS_UPSCALER_NODE_TYPES.includes(producer[1].class_type) ? producer : void 0;
}
/**
* Find the sampler that repaints the enlarged latent.
*
* A fused template names it through the switch that selects between the passes.
* A standalone second-pass template has no switch, because it has no first pass
* to choose between: its sampler is the one whose latent is enlarged by the
* family's upscaler, which a fused template feeds from its own first sampler
* instead.
* @param entries - the graph's nodes.
* @param gate - the second-pass switch, when the template fuses both passes.
* @returns the second sampler, or undefined when the graph carries no such chain.
*/
function secondPassSampler(entries, gate) {
	if (gate !== void 0) {
		const link = linkOf(gate[1].inputs[SECOND_PASS_SWITCH_INPUT]);
		return link === void 0 ? void 0 : entries.find((entry) => entry[0] === link[0]);
	}
	return entries.find(([, value]) => Object.hasOwn(value.inputs, "sigmas") && secondPassUpscaler(entries, value) !== void 0);
}
/**
* Write the key a graph's latent archives live under.
*
* One clip's first pass writes a latent that its own second pass reads back, so
* the key is per clip: two clips of one project sharing it would have each pass
* overwrite the other's file, and a second pass would repaint a neighbouring
* shot. A graph that carries such a node without a key is reported rather than
* submitted, because the server would write to the unpartitioned archive.
* @param prepared - the graph being prepared.
* @param entries - the graph's nodes.
* @param used - node ids already claimed by another parameter.
* @param bindings - collected bindings.
* @param unbound - parameters the graph could not express.
* @param archive - the key, or undefined when the caller named none.
*/
function bindLatentArchive(prepared, entries, used, bindings, unbound, archive, clipIndex) {
	const nodes = entries.filter(([, value]) => LATENT_ARCHIVE_NODE_TYPES.includes(value.class_type));
	if (nodes.length === 0) return;
	if (archive === void 0) {
		unbound.push("latentArchive");
		return;
	}
	const claim = claimer(prepared, used, bindings);
	for (const [id, value] of nodes) {
		if (!Object.hasOwn(value.inputs, LATENT_ARCHIVE_INPUT)) {
			unbound.push("latentArchive");
			continue;
		}
		claim("latentArchive", id, LATENT_ARCHIVE_INPUT, archive);
		if (value.class_type === "DreamStudio_LatentSave" && Object.hasOwn(value.inputs, "file")) claim("latentFile", id, "file", `latent_${String(clipIndex + 1).padStart(5, "0")}.safetensors`);
	}
	for (const [id, value] of entries) {
		if (value.class_type !== "MiniMaxH3MotionContextLoadLatent") continue;
		if (!Object.hasOwn(value.inputs, "latent_path")) continue;
		claim("latentPath", id, "latent_path", archive);
		claim("latentIndex", id, "clip_index", clipIndex + 1);
	}
}
/**
* Copy one workflow graph and write every clip parameter the profile or the
* user's `paramMap` maps onto a node input (WF-6, §6.2).
* @param graph - the template graph; it is never mutated.
* @param profile - the family profile supplying default mappings.
* @param paramMap - user overrides keyed by parameter name.
* @param input - resolved clip parameters and uploaded media file names.
* @param overrides - per-server model file overrides keyed by node id.
* @returns the prepared graph plus the bindings applied and any unbound parameter.
*/
/**
* 摘掉一条没有在用的续写链。
*
* 新链式续写模板用 `MiniMaxH3MotionContext*` 而不是旧的 `GetImageRangeFromBatch`：
* 不续接时这串节点必须整条消失，否则 `LoadLatent` 会去读一个不存在的 latent。
* `Trim` 是"一采解码 → 成片"之间的直通节点，摘它要把它两个输出按各自的来源重接
* （`images` 接回解码、`audio` 接回音频解码），不能用一个替换值糊过去。
* @param prepared - 正在准备的图。
*/
function dropContinuationChain(prepared) {
	const nodes = graphNodes(prepared);
	const trim = nodes.find(([, node]) => node.class_type === "MiniMaxH3MotionContextTrim");
	if (trim !== void 0) {
		const [trimId, trimNode] = trim;
		const images = trimNode.inputs["images"];
		const audio = trimNode.inputs["audio"];
		for (const target of Object.values(prepared)) {
			const inputs = typeof target === "object" && target !== null ? target.inputs : void 0;
			if (inputs === void 0) continue;
			for (const [key, input] of Object.entries(inputs)) {
				const link = linkOf(input);
				if (link === void 0 || link[0] !== trimId) continue;
				const replacement = key === "audio" ? audio : images;
				if (replacement !== void 0) inputs[key] = replacement;
			}
		}
		Reflect.deleteProperty(prepared, trimId);
	}
	const context = nodes.find(([, node]) => node.class_type === "MiniMaxH3MotionContext");
	if (context !== void 0) bypassNode(prepared, context[0], "conditioning");
	for (const [id, node] of nodes) {
		if (trim !== void 0 && id === trim[0]) continue;
		if (node.class_type.startsWith("MiniMaxH3MotionContext")) Reflect.deleteProperty(prepared, id);
	}
	dropImageFromBatch(prepared);
}
/**
* Wire one clip’s continuation slots: this segment writes its own latent, a
* continuation segment reads the previous one and trims the pinned frames.
*
* The main template and the standalone second pass share this wiring, so a
* second pass continues from the previous clip’s **second-pass** latent
* instead of the low-res one the first pass archived.
* @param prepared - the graph being prepared.
* @param chain - slot prefix, this clip’s index, and whether it continues.
* @param fps - frame rate used to bind the trim node.
* @returns the bindings applied.
*/
/**
* H3 只出 17k+5 帧的段长（5、22、39、56…），和模板里 `_frame_length()` 的取整一致。
* 续写段要先按它算出目标帧数，再多要两个块（34 帧）给 22 帧引导 + 2 帧衔接（过渡帧 + 钉帧）留余量。
*/
function frameLength(seconds, fps) {
	const target = Math.max(5, seconds * fps);
	return Math.max(0, Math.round((target - 5) / 17)) * 17 + 5;
}
/** 续写段比目标多要的帧数：22 帧引导 + 1 帧过渡。 */
const CONTINUATION_LEAD_FRAMES = 34;
function bindContinuationChain(prepared, chain, fps, duration) {
	const bindings = [];
	const bindChain = (nodeId, key, value) => {
		const binding = {
			parameter: `chain:${key}`,
			nodeId,
			input: key,
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	};
	const nodes = graphNodes(prepared);
	const save = nodes.find(([, node]) => node.class_type === "MiniMaxH3MotionContextSaveLatent");
	if (save !== void 0) {
		bindChain(save[0], "filename_prefix", chain.prefix);
		bindChain(save[0], "clip_index", chain.index + 1);
	}
	const archiveSave = nodes.find(([, node]) => node.class_type === "DreamStudio_LatentSave");
	if (archiveSave !== void 0) {
		const folder = chain.prefix.includes("/") ? chain.prefix.slice(0, chain.prefix.lastIndexOf("/")) : chain.prefix;
		const project = folder.startsWith("dreamstudio_latent/") ? folder.slice(19) : folder;
		const stem = chain.prefix.slice(chain.prefix.lastIndexOf("/") + 1);
		bindChain(archiveSave[0], "project_id", project);
		bindChain(archiveSave[0], "file", `${stem}_${String(chain.index + 1).padStart(5, "0")}.safetensors`);
	}
	const trim = nodes.find(([, node]) => node.class_type === "MiniMaxH3MotionContextTrim");
	if (trim !== void 0) bindChain(trim[0], "fps", fps);
	if (trim !== void 0 && !chain.fromPrev) {
		const trimInputs = nodeInputs(prepared, trim[0]);
		if (trimInputs !== void 0) {
			Reflect.deleteProperty(trimInputs, "trim_frames");
			trimInputs["trim_frames"] = 0;
		}
	}
	const context = nodes.find(([, node]) => node.class_type === "MiniMaxH3MotionContext");
	const contextInputs = context === void 0 ? void 0 : nodeInputs(prepared, context[0]);
	const load = nodes.find(([, node]) => node.class_type === "MiniMaxH3MotionContextLoadLatent");
	if (load !== void 0) {
		if (chain.fromPrev) {
			const folder = chain.prefix.includes("/") ? chain.prefix.slice(0, chain.prefix.lastIndexOf("/")) : chain.prefix;
			bindChain(load[0], "latent_path", folder);
			bindChain(load[0], "clip_index", chain.index);
		} else {
			if (contextInputs !== void 0) Reflect.deleteProperty(contextInputs, "context_latent");
			Reflect.deleteProperty(prepared, load[0]);
		}
	}
	const batch = nodes.find(([, node]) => node.class_type === "ImageFromBatch");
	if (batch !== void 0) {
		if (chain.fromPrev) {
			bindChain(batch[0], "batch_index", 1);
			bindChain(batch[0], "length", frameLength(duration, fps));
		} else dropImageFromBatch(prepared, batch[0]);
	}
	return bindings;
}
/**
* 摘掉续写链里的 ImageFromBatch：把它下游接回它的上游（裁剪节点的输出），
* 否则 CreateVideo 会指向一个被删掉的节点。
*/
function dropImageFromBatch(prepared, only) {
	const batch = only === void 0 ? graphNodes(prepared).find(([, node]) => node.class_type === "ImageFromBatch") : graphNodes(prepared).find(([id]) => id === only);
	if (batch === void 0) return;
	const [id] = batch;
	const source = nodeInputs(prepared, id)?.["image"];
	if (source !== void 0) for (const target of Object.values(prepared)) {
		const inputs = typeof target === "object" && target !== null ? target.inputs : void 0;
		if (inputs === void 0) continue;
		for (const [key, input] of Object.entries(inputs)) {
			const link = linkOf(input);
			if (link === void 0 || link[0] !== id) continue;
			inputs[key] = source;
		}
	}
	Reflect.deleteProperty(prepared, id);
}
/** Node class type of the all-in-one MiniMax H3 template (prompt + canvas + media). */
const EASY_NODE_TYPE = "MiniMaxH3Easy";
/**
* Bind one all-in-one MiniMax H3 node.
*
* 这张模板把提示词、画布、时长、帧率与两张条件图都收在同一个节点里，所以它的
* 参数不走通用的“找 Primitive/Resolution 节点”那套。首尾帧走 firstFrame/lastFrame，
* 全能参考按顺序取参考图，两者都落到模板自己的 media_1/media_2；没有图就把那一路
* 摘掉，模板自带的样图不会参与生成。
* @param prepared - the graph being prepared.
* @param id - the MiniMaxH3Easy node.
* @param input - what the clip asks for.
* @param bindings - collected bindings.
* @param unbound - parameters the node cannot express.
*/
function bindEasyTemplate(prepared, id, input, bindings, unbound) {
	const set = (parameter, key, value) => {
		const binding = {
			parameter,
			nodeId: id,
			input: key,
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	};
	set("prompt", "prompt", input.prompt);
	const guideSeconds = graphNodes(prepared).some(([, node]) => node.class_type === "MiniMaxH3MotionContextTrim") && input.chain?.fromPrev === true ? CONTINUATION_LEAD_FRAMES / input.fps : 0;
	const seconds = guideSeconds === 0 ? Math.round(input.duration * 10) / 10 : Math.round((input.duration + guideSeconds) * 1e3) / 1e3;
	set("duration", "seconds", Math.min(30, Math.max(.2, seconds)));
	const raw = resolutionFor(input.scale, input.ratio);
	const tier = input.resolution === void 0 || input.resolution === null || input.resolution === "" ? null : input.resolution;
	if (tier !== null) set("resolution", "resolution", tier);
	else {
		set("resolution", "resolution", "custom");
		set("width", "width", Math.max(32, Math.round(raw.width / 32) * 32));
		set("height", "height", Math.max(32, Math.round(raw.height / 32) * 32));
	}
	set("fps", "fps", input.fps);
	if (input.ratio === "") unbound.push("ratio");
	else set("ratio", "aspect_ratio", input.ratio);
	const modeInputs = nodeInputs(prepared, id);
	if (modeInputs !== void 0 && Object.hasOwn(modeInputs, "mode")) set("mode", "mode", input.mode === "reference" ? "reference" : "image");
	else if (input.mode === "reference") unbound.push("mode");
	const referenceMode = input.mode === "reference";
	const refs = input.media.refImages.slice(0, 10);
	const wanted = referenceMode ? [...refs] : [input.media.firstFrame, input.media.lastFrame].filter((file) => file !== null);
	const easyInputs = nodeInputs(prepared, id);
	const existing = [];
	for (let slot = 1; slot <= 10; slot += 1) {
		const link = linkOf(easyInputs?.[`media_${String(slot)}`]);
		if (link !== void 0) existing.push({
			slot,
			loader: link[0]
		});
	}
	const seedId = Object.keys(prepared).find((candidate) => graphNode(prepared, candidate)?.class_type === "LoadImage");
	const seed = seedId === void 0 ? void 0 : graphNode(prepared, seedId);
	const seedKey = seed === void 0 ? void 0 : Object.keys(seed.inputs).find((name) => FILE_INPUT_KEYS.includes(name) && typeof seed.inputs[name] === "string");
	const mounted = [];
	wanted.forEach((file, index) => {
		const slot = index + 1;
		const found = existing.find((entry) => entry.slot === slot);
		if (found !== void 0) {
			const node = graphNode(prepared, found.loader);
			const target = node === void 0 || seedKey === void 0 ? void 0 : fileSlot(prepared, node.inputs[seedKey]);
			if (target !== void 0) {
				const binding = {
					parameter: `media_${String(slot)}`,
					nodeId: target.nodeId,
					input: target.input,
					value: file
				};
				bindings.push(binding);
				writeBinding(prepared, binding);
			} else if (node !== void 0) {
				const loaderInputs = nodeInputs(prepared, found.loader);
				if (loaderInputs !== void 0) loaderInputs[seedKey ?? "image"] = file;
			}
			const typeInputs = nodeInputs(prepared, id);
			if (typeInputs !== void 0) typeInputs[`media_type_${String(slot)}`] = "image";
		} else if (seed !== void 0 && seedKey !== void 0) {
			const loaderId = nextNodeId(prepared);
			prepared[loaderId] = {
				...structuredClone(seed),
				inputs: {
					...seed.inputs,
					[seedKey]: file
				}
			};
			const typeInputs = nodeInputs(prepared, id);
			if (typeInputs !== void 0) {
				typeInputs[`media_${String(slot)}`] = [loaderId, 0];
				typeInputs[`media_type_${String(slot)}`] = "image";
			}
		}
		mounted.push({
			slot,
			file
		});
	});
	for (const entry of existing) {
		if (entry.slot <= wanted.length) continue;
		Reflect.deleteProperty(prepared, entry.loader);
		const typeInputs = nodeInputs(prepared, id);
		if (typeInputs !== void 0) {
			Reflect.deleteProperty(typeInputs, `media_${String(entry.slot)}`);
			Reflect.deleteProperty(typeInputs, `media_type_${String(entry.slot)}`);
		}
	}
	if (mounted.length > 0) {
		const resources = mounted.map((entry, index) => ({
			type: "image",
			tag: `<Picture ${String(index + 1)}>`,
			name: entry.file,
			asset: {
				filename: entry.file,
				subfolder: "",
				storage: "input"
			}
		}));
		const inputs = nodeInputs(prepared, id);
		if (inputs !== void 0) inputs["prompt_optimizer_resources"] = JSON.stringify(resources);
	}
	if (input.chain === void 0) dropContinuationChain(prepared);
	else bindings.push(...bindContinuationChain(prepared, input.chain, input.fps, input.duration));
}
function prepareGraph(graph, profile, paramMap, input, overrides) {
	const prepared = structuredClone(graph);
	const entries = graphNodes(prepared);
	const used = /* @__PURE__ */ new Set();
	const bindings = [];
	const unbound = [];
	const add = (parameter, found, value, required = false) => {
		const mapped = bindingFromMap(paramMap, parameter);
		if (mapped !== void 0) {
			used.add(mapped.nodeId);
			const binding = {
				parameter,
				nodeId: mapped.nodeId,
				input: mapped.input,
				value
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
			return;
		}
		if (found === void 0) {
			if (required) unbound.push(parameter);
			return;
		}
		used.add(found[0]);
		const binding = {
			parameter,
			nodeId: found[0],
			input: found[2],
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	};
	const frames = clipFrames(input.duration, input.fps, profile);
	const easy = entries.find(([, node]) => node.class_type === EASY_NODE_TYPE);
	if (easy !== void 0) {
		bindEasyTemplate(prepared, easy[0], input, bindings, unbound);
		used.add(easy[0]);
	}
	if (easy === void 0) add("prompt", matchNode(entries, PROMPT_NODE_TYPES, /^(value|text|prompt|string)$/u, used), input.prompt, true);
	add("seed", matchNode(entries, SEED_NODE_TYPES, /^(noise_seed|seed)$/u, used), input.seed);
	if (input.steps !== void 0) {
		const stepsNode = matchNode(entries, STEP_NODE_TYPES, /^steps$/u, /* @__PURE__ */ new Set());
		if (stepsNode !== void 0) {
			const binding = {
				parameter: "steps",
				nodeId: stepsNode[0],
				input: stepsNode[2],
				value: input.steps
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
		}
	}
	if (easy === void 0) addLength(prepared, entries, used, bindings, unbound, input, frames);
	if (input.secondPass !== void 0 && easy !== void 0) {
		const gate = entries.find(([, node]) => node.class_type === SECOND_PASS_SWITCH_NODE_TYPES[0]);
		if (gate === void 0) {
			if (input.secondPass.enabled) unbound.push("secondPass");
		} else {
			const binding = {
				parameter: "secondPass:switch",
				nodeId: gate[0],
				input: "switch",
				value: input.secondPass.enabled
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
		}
		if (input.secondPass.enabled) {
			const scheduler = entries.find(([, node]) => node.class_type === "BasicScheduler" && node.inputs["denoise"] !== void 0 && node.inputs["denoise"] !== 1);
			if (scheduler !== void 0) {
				const stepBinding = {
					parameter: "secondPass:steps",
					nodeId: scheduler[0],
					input: "steps",
					value: input.secondPass.steps
				};
				const denoiseBinding = {
					parameter: "secondPass:denoise",
					nodeId: scheduler[0],
					input: "denoise",
					value: input.secondPass.denoise
				};
				bindings.push(stepBinding);
				writeBinding(prepared, stepBinding);
				bindings.push(denoiseBinding);
				writeBinding(prepared, denoiseBinding);
			} else unbound.push("secondPass:steps");
		}
		if (input.secondPass.enabled) {
			const upscaler = entries.find(([, node]) => node.class_type === "MinimaxH3LatentUpscaler3D" && Object.hasOwn(node.inputs, "mode.width"));
			if (upscaler !== void 0) {
				const canvas = resolutionFor(input.secondPass.megapixels, input.ratio, 32);
				const widthBinding = {
					parameter: "secondPass:width",
					nodeId: upscaler[0],
					input: "mode.width",
					value: canvas.width
				};
				const heightBinding = {
					parameter: "secondPass:height",
					nodeId: upscaler[0],
					input: "mode.height",
					value: canvas.height
				};
				bindings.push(widthBinding);
				writeBinding(prepared, widthBinding);
				bindings.push(heightBinding);
				writeBinding(prepared, heightBinding);
			} else {
				const sizeNode = entries.find(([, node]) => node.class_type === "ResolutionSelector");
				if (sizeNode === void 0) unbound.push("secondPass:megapixels");
				else if ("megapixels" in sizeNode[1].inputs) {
					const wanted = input.secondPass.megapixels;
					const sizeBinding = {
						parameter: "secondPass:megapixels",
						nodeId: sizeNode[0],
						input: "megapixels",
						value: wanted
					};
					bindings.push(sizeBinding);
					writeBinding(prepared, sizeBinding);
				}
			}
		}
	} else if (input.secondPass !== void 0) {
		const gate = entries.find(([, node]) => node.class_type === SECOND_PASS_SWITCH_NODE_TYPES[0]);
		const samplerEntry = secondPassSampler(entries, gate);
		const schedulerLink = samplerEntry === void 0 ? void 0 : linkOf(samplerEntry[1].inputs["sigmas"]);
		const scheduler = schedulerLink === void 0 ? void 0 : entries.find((entry) => entry[0] === schedulerLink[0]);
		const ups = samplerEntry === void 0 ? void 0 : secondPassUpscaler(entries, samplerEntry[1]);
		if (samplerEntry === void 0) {
			if (input.secondPass.enabled) unbound.push("secondPass");
		} else {
			const bind = (nodeId, inputKey, value) => {
				const binding = {
					parameter: `secondPass:${inputKey}`,
					nodeId,
					input: inputKey,
					value
				};
				bindings.push(binding);
				writeBinding(prepared, binding);
			};
			if (gate !== void 0) bind(gate[0], "switch", input.secondPass.enabled);
			if (input.secondPass.enabled) {
				if (scheduler === void 0 || scheduler[1].inputs["denoise"] === void 0 || scheduler[1].inputs["steps"] === void 0) unbound.push("secondPass");
				else {
					bind(scheduler[0], "denoise", input.secondPass.denoise);
					bind(scheduler[0], "steps", input.secondPass.steps);
				}
				const sizeNode = ups ?? entries.find(([, node]) => node.class_type === "ResolutionSelector");
				if (sizeNode !== void 0) {
					if ("megapixels" in sizeNode[1].inputs) bind(sizeNode[0], "megapixels", input.secondPass.megapixels);
					else {
						bind(sizeNode[0], UPSCALER_MODE_INPUT, UPSCALER_MEGAPIXEL_MODE);
						bind(sizeNode[0], UPSCALER_MEGAPIXEL_INPUT, input.secondPass.megapixels);
					}
				}
			}
		}
	}
	if (easy === void 0) bindLatentArchive(prepared, entries, used, bindings, unbound, input.latentArchive, input.chain?.index ?? 0);
	const fpsNode = matchNode(entries, FPS_NODE_TYPES, /^(fps|frame_rate)$/u, used);
	if (fpsNode !== void 0) {
		used.add(fpsNode[0]);
		const binding = {
			parameter: "fps",
			nodeId: fpsNode[0],
			input: fpsNode[2],
			value: input.fps
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	}
	for (const [id, value] of entries) {
		const expression = value.inputs["expression"];
		if (typeof expression !== "string") continue;
		const retimed = retimeExpression(expression, input.fps);
		if (retimed === expression) continue;
		const binding = {
			parameter: "fps:expression",
			nodeId: id,
			input: "expression",
			value: retimed
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	}
	const resolution = resolutionFor(input.scale, input.ratio);
	const sizeNode = easy === void 0 ? matchAnyNode(entries, RESOLUTION_NODE_TYPES, used) : void 0;
	if (easy !== void 0) {} else if (sizeNode !== void 0) {
		used.add(sizeNode[0]);
		const target = sizeNode[1].inputs;
		const label = ASPECT_RATIO_LABELS[input.ratio];
		for (const [key, value] of Object.entries(target)) {
			if (key === "width" && typeof value === "number") bindings.push({
				parameter: "width",
				nodeId: sizeNode[0],
				input: key,
				value: resolution.width
			});
			if (key === "height" && typeof value === "number") bindings.push({
				parameter: "height",
				nodeId: sizeNode[0],
				input: key,
				value: resolution.height
			});
			if (key === "megapixels" && typeof value === "number") bindings.push({
				parameter: "megapixels",
				nodeId: sizeNode[0],
				input: key,
				value: input.scale
			});
			if (key === "resolution" && typeof value === "string") bindings.push({
				parameter: "ratio",
				nodeId: sizeNode[0],
				input: key,
				value: input.ratio
			});
			if (key === "aspect_ratio" && typeof value === "string") {
				if (label === void 0) unbound.push("ratio");
				else bindings.push({
					parameter: "ratio",
					nodeId: sizeNode[0],
					input: key,
					value: label
				});
			}
		}
		for (const binding of bindings) writeBinding(prepared, binding);
	} else unbound.push("ratio");
	const filmStage = bindContinuationGuide(prepared, input, entries, used, bindings, anchored(input));
	const imageTypes = profile.imageNodeTypes.filter((type) => type === "LoadImage" || type === "VHS_LoadVideo");
	const named = entries.some(([, node]) => FRAME_MEDIA_INPUTS.some(([key]) => Object.hasOwn(node.inputs, key)));
	const declared = entries.filter(([, value]) => GUIDE_NODE_TYPES.includes(value.class_type));
	const hidden = entries.some(([, node]) => LATENT_LOAD_NODE_TYPES$1.includes(node.class_type));
	const mounted = declared.length > 0 || named || hidden || !anchored(input) ? void 0 : mountAnchorStage(prepared, profile, entries);
	const guideStages = mounted === void 0 ? declared : [...declared, mounted];
	for (const [id] of guideStages) used.add(id);
	if (guideStages.length > 0) bindGuideStages(prepared, guideStages, filmStage, guideAnchors(input, filmStage !== void 0), bindings, unbound);
	else if (named) for (const [key, parameter] of FRAME_MEDIA_INPUTS) {
		const owner = entries.find(([, node]) => Object.hasOwn(node.inputs, key));
		if (owner === void 0) continue;
		const value = parameter === "firstFrame" ? input.media.firstFrame : input.media.lastFrame;
		const link = linkOf(owner[1].inputs[key]);
		const replaced = parameter === "firstFrame" && input.media.priorFilm !== null;
		if (value === null || replaced) {
			Reflect.deleteProperty(owner[1].inputs, key);
			if (link !== void 0) Reflect.deleteProperty(prepared, link[0]);
			continue;
		}
		const slot = link === void 0 ? void 0 : fileSlot(prepared, owner[1].inputs[key]);
		if (slot === void 0) {
			unbound.push(parameter);
			continue;
		}
		const binding = {
			parameter,
			nodeId: slot.nodeId,
			input: slot.input,
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	}
	else {
		const guided = input.media.priorFilm !== null;
		if (!guided && input.media.firstFrame !== null) add("firstFrame", matchTitledNode(entries, imageTypes, /(first|start|begin|首)/iu, used) ?? asTriple(matchAnyNode(entries, imageTypes, used), "image"), input.media.firstFrame, true);
		if (!guided && input.media.lastFrame !== null) add("lastFrame", matchTitledNode(entries, imageTypes, /(last|end|tail|尾)/iu, used) ?? asTriple(matchAnyNode(entries, imageTypes, used), "image"), input.media.lastFrame, true);
	}
	bindPassTiling(prepared, entries, input, bindings, unbound);
	bindLoras(prepared, profile, input, entries, used, bindings, unbound);
	bindReferenceSlots(prepared, profile, input, entries, used, bindings, unbound);
	for (const [nodeId, fileName] of Object.entries(overrides)) {
		const target = prepared[nodeId];
		if (typeof target !== "object" || target === null) continue;
		const slot = profile.modelSlots.find((candidate) => candidate.nodeTypes.includes(target.class_type));
		if (slot === void 0) continue;
		const binding = {
			parameter: `model:${slot.folder}`,
			nodeId,
			input: slot.input,
			value: fileName
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	}
	if (unbound.length === 0) pruneUnreachable(prepared);
	return {
		graph: prepared,
		bindings,
		unbound,
		notes: []
	};
}
/**
* Copy a standalone second-pass workflow and write one clip's second pass onto it.
*
* Only the nodes that carry these parameters are touched, so the operator's own
* wiring (sampler, sparse attention, audio split, save) stays exactly as exported:
* the all-in-one node takes the prompt, canvas, and reference pictures; the latent
* loader takes the archive key the first pass wrote; the second pass's scheduler
* takes the step count and denoise; the upscaler takes the target canvas.
* @param graph - the template graph; it is never mutated.
* @param input - prompt, pictures, archive key, and the second pass's schedule.
* @returns the prepared graph plus the bindings applied and any unbound parameter.
*/
function prepareSecondPassGraph(graph, input) {
	const prepared = structuredClone(graph);
	const entries = graphNodes(prepared);
	const used = /* @__PURE__ */ new Set();
	const bindings = [];
	const unbound = [];
	const bind = claimer(prepared, used, bindings);
	const easy = entries.find(([, node]) => node.class_type === EASY_NODE_TYPE);
	if (easy === void 0) unbound.push("prompt");
	else bindEasyTemplate(prepared, easy[0], input, bindings, unbound);
	if (easy === void 0) {
		if (input.chain === void 0) dropContinuationChain(prepared);
		else bindings.push(...bindContinuationChain(prepared, input.chain, input.fps, input.duration));
	}
	const load = entries.find(([, node]) => LATENT_LOAD_NODE_TYPES$1.includes(node.class_type));
	if (load === void 0) unbound.push("latentArchive");
	else if (Object.hasOwn(load[1].inputs, "project_id")) {
		bind("latentArchive", load[0], "project_id", input.archive.folder);
		if (Object.hasOwn(load[1].inputs, "file")) bind("latentFile", load[0], "file", input.archive.file);
	} else if (Object.hasOwn(load[1].inputs, "latent_path")) bind("latentArchive", load[0], "latent_path", input.archive.folder);
	else unbound.push("latentArchive");
	const scheduler = entries.find(([, node]) => node.class_type === "BasicScheduler" && node.inputs["denoise"] !== void 0 && node.inputs["denoise"] !== 1);
	if (scheduler === void 0) unbound.push("secondPass");
	else {
		if (Object.hasOwn(scheduler[1].inputs, "steps")) bind("secondPass:steps", scheduler[0], "steps", input.steps);
		if (Object.hasOwn(scheduler[1].inputs, "denoise")) bind("secondPass:denoise", scheduler[0], "denoise", input.denoise);
	}
	const canvas = resolutionFor(input.megapixels, input.ratio, 32);
	const upscaler = entries.find(([, node]) => node.class_type === "MMH3LatentUpscaleWithModelParams" && Object.hasOwn(node.inputs, "width")) ?? entries.find(([, node]) => node.class_type === "MinimaxH3LatentUpscaler3D" && Object.hasOwn(node.inputs, "mode.width"));
	if (upscaler === void 0) unbound.push("secondPass:megapixels");
	else if (Object.hasOwn(upscaler[1].inputs, "width")) {
		bind("secondPass:width", upscaler[0], "width", canvas.width);
		bind("secondPass:height", upscaler[0], "height", canvas.height);
	} else {
		bind("secondPass:width", upscaler[0], "mode.width", canvas.width);
		bind("secondPass:height", upscaler[0], "mode.height", canvas.height);
	}
	const seed = matchNode(entries, SEED_NODE_TYPES, /^(noise_seed|seed)$/u, used);
	if (seed !== void 0) bind("seed", seed[0], seed[2], input.seed);
	if (unbound.length === 0) pruneUnreachable(prepared);
	return {
		graph: prepared,
		bindings,
		unbound,
		notes: []
	};
}
/** The frame one guide stage pins, or 0 when it pins none. */
function pinnedFrame(value) {
	const index = value.inputs["frame_idx"];
	return typeof index === "number" ? index : 0;
}
/**
* Whether one clip pins pictures of its own, which is what decides whether a
* template's film-fed stage stays to carry one instead of leaving with the film.
* @param input - resolved clip parameters and uploaded media names.
* @returns true when the clip pins at least one picture.
*/
function anchored(input) {
	return input.media.firstFrame !== null || (input.media.keyframeGuides?.length ?? 0) > 0;
}
/**
* Order the pictures one clip anchors a template's guide chain with (AI-11).
*
* The clip's confirmed keyframes come first, in frame order, and its own opening
* frame is one of them whenever nothing else anchors that frame. A clip the
* previous film guides contributes no opening picture: that film's tail frames are
* what the chain's first stage reads, so a keyframe pinned there would fight it.
* @param input - resolved clip parameters and uploaded media names.
* @param guided - whether the previous film feeds the chain's opening stage.
* @returns the anchors in frame order.
*/
function guideAnchors(input, guided) {
	const anchors = [];
	const keyframes = [...input.media.keyframeGuides ?? []].sort((left, right) => left.frameIndex - right.frameIndex);
	for (const [position, guide] of keyframes.entries()) {
		if (guided && guide.frameIndex === 0) continue;
		anchors.push({
			parameter: `keyframe_${String(position)}`,
			frameParameter: `keyframeFrame_${String(position)}`,
			frameIndex: guide.frameIndex,
			file: guide.file
		});
	}
	if (!(guided || input.media.firstFrame === null || anchors.some((anchor) => anchor.frameIndex === 0))) anchors.unshift({
		parameter: "firstFrame",
		frameParameter: "firstFrameFrame",
		frameIndex: 0,
		file: input.media.firstFrame
	});
	return anchors;
}
/**
* Mount the anchor stage a template does not declare.
*
* The reference family's exports condition a shot on their reference slots and put
* no guide node in the graph, so a clip whose own frame or keyframe anchors the
* opening has nowhere to put it. The stage mounted here is the one the operator's
* keyframe export carries: it reads the video model's conditioning and latent, the
* model's own VAE, and hands whatever consumes the model's conditioning the
* conditioning it returns. A second pass's strip stage keeps reading the model
* itself, which is how that export wires it.
* @param prepared - the graph being prepared.
* @param profile - the template's family profile.
* @param entries - the graph's nodes.
* @returns the mounted stage's id and node, or undefined when the graph names no
* reference model to anchor.
*/
function mountAnchorStage(prepared, profile, entries) {
	const sources = /* @__PURE__ */ new Set();
	for (const [, node] of entries) for (const [key, value] of Object.entries(node.inputs)) {
		const link = CONDITIONING_INPUT_KEYS.includes(key) ? linkOf(value) : void 0;
		if (link !== void 0) sources.add(link[0]);
	}
	const model = [...sources].map((id) => [id, graphNode(prepared, id)]).find((entry) => entry[1] !== void 0 && profile.referenceNodeTypes.includes(entry[1].class_type));
	const vae = model === void 0 ? void 0 : linkOf(model[1].inputs["vae"]);
	if (model === void 0 || vae === void 0) return void 0;
	const id = nextNodeId(prepared);
	const stage = {
		class_type: GUIDE_NODE_TYPE,
		inputs: {
			positive: [model[0], 0],
			latent: [model[0], 1],
			vae: [...vae],
			frame_idx: 0
		},
		_meta: { title: "首帧锚定（由时间长河按片段锚点插入）" }
	};
	prepared[id] = stage;
	for (const [owner, node] of entries) {
		if (GUIDE_STRIP_NODE_TYPES.includes(node.class_type)) continue;
		const inputs = nodeInputs(prepared, owner);
		if (inputs === void 0) continue;
		for (const [key, value] of Object.entries(inputs)) {
			const link = CONDITIONING_INPUT_KEYS.includes(key) ? linkOf(value) : void 0;
			if (link !== void 0 && link[0] === model[0] && link[1] === 0) inputs[key] = [id, 0];
		}
	}
	return [id, stage];
}
/**
* The family's LoRA loaders, in the order they patch the model.
*
* A loader's depth is how many loaders precede it, so sorting by it puts the chain
* in the order the model flows through it whatever ids the operator's export used.
* @param prepared - the graph being prepared.
* @param entries - the graph's nodes.
* @param types - the family's LoRA node class types.
* @returns the loaders, base first.
*/
function loraChain(prepared, entries, types) {
	const depth = (entry) => {
		const seen = /* @__PURE__ */ new Set([entry[0]]);
		let steps = 0;
		let link = linkOf(entry[1].inputs["model"]);
		while (link !== void 0 && !seen.has(link[0])) {
			seen.add(link[0]);
			const node = graphNode(prepared, link[0]);
			if (node === void 0 || !types.includes(node.class_type)) break;
			steps += 1;
			link = linkOf(node.inputs["model"]);
		}
		return steps;
	};
	return entries.filter(([, node]) => types.includes(node.class_type)).sort((left, right) => depth(left) - depth(right));
}
/**
* Put the clip's LoRA configuration on **every** model chain the template carries.
*
* 模板可能有两套模型链（全能工作流：一采走 MiniMaxH3EasyLoader，二采走 UNETLoader），
* 每条链各带自己的 LoRA 加载器。以前是把片段配的 LoRA 按顺序铺到「所有找到的加载器」
* 上：一采拿到第一个、二采拿到第二个，两采看到的权重根本不是页面上那一份，模板自带的
* 加速 LoRA 还会被挤掉。现在按链分组，每条链都追加片段配置的整份 LoRA；模板自带的
* （比如 4 步加速 LoRA）保持不动，清单里同名的只改强度，避免同一个 LoRA 叠两遍。
* 模板一个 LoRA 节点都没有时，就在模型源后面现场挂一条链。
* @param prepared - the graph being prepared.
* @param profile - the template's family profile.
* @param input - resolved clip parameters.
* @param entries - the graph's nodes.
* @param used - node ids already claimed by another parameter.
* @param bindings - collected bindings.
* @param unbound - parameters the graph could not express.
*/
/**
* 把「一采分块 / 二采分块」两个开关写到图上。
*
* 认法的依据是拓扑，不是节点 id：
* - 一采分块：VAEDecodeTiled 所在的那条 LazySwitchKJ 分支（普通 / 分块两个解码器）
* - 二采分块：MMH3SplitUpscale 或 MMH3UltimateUpscale 前面的 LazySwitchKJ 闸门
*
* 闸门的 switch 可能是字面量，也可能连着一个 PrimitiveBoolean；两种都支持。
*/
function bindPassTiling(prepared, entries, input, bindings, unbound) {
	const writeSwitch = (gateId, gate, value, parameter) => {
		const link = gate.inputs["switch"];
		if (Array.isArray(link) && typeof link[0] === "string") {
			const source = graphNode(prepared, link[0]);
			if (source === void 0 || !Object.hasOwn(source.inputs, "value")) return false;
			const binding = {
				parameter,
				nodeId: link[0],
				input: "value",
				value
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
			return true;
		}
		const binding = {
			parameter,
			nodeId: gateId,
			input: "switch",
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
		return true;
	};
	/** 找某个类型节点的上游 LazySwitchKJ 闸门。 */
	const gateFeeding = (targetTypes) => {
		for (const [id, node] of entries) {
			if (!targetTypes.includes(node.class_type)) continue;
			for (const [, other] of entries) {
				if (other.class_type !== "LazySwitchKJ") continue;
				for (const key of ["on_true", "on_false"]) {
					const link = other.inputs[key];
					if (Array.isArray(link) && link[0] === id) return [Object.entries(prepared).find(([, value]) => value === other)?.[0] ?? "", other];
				}
			}
		}
	};
	const first = gateFeeding(["VAEDecodeTiled"]);
	if (first !== void 0) writeSwitch(first[0], first[1], input.firstPassTiled, "firstPassTiled");
	else if (input.firstPassTiled) unbound.push("firstPassTiled");
	const spatial = entries.find(([, node]) => node.class_type === "MMH3SpatialSplitParams");
	const temporal = entries.find(([, node]) => node.class_type === "MMH3TemporalSplitParams");
	const writeTiling = (node, key, value) => {
		if (node === void 0 || !Object.hasOwn(node[1].inputs, key)) return;
		const binding = {
			parameter: `secondPassTiled:${key}`,
			nodeId: node[0],
			input: key,
			value
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
	};
	if (!input.secondPassTiled) {
		if (spatial !== void 0) {
			const rawWidth = spatial[1].inputs["upscale_width"];
			const rawHeight = spatial[1].inputs["upscale_height"];
			const rawWidthValue = typeof rawWidth === "number" ? rawWidth : 1280;
			const rawHeightValue = typeof rawHeight === "number" ? rawHeight : 704;
			const width = Math.max(32, Math.ceil(rawWidthValue / 32) * 32);
			const height = Math.max(32, Math.ceil(rawHeightValue / 32) * 32);
			writeTiling(spatial, "grid_rows", 1);
			writeTiling(spatial, "grid_cols", 1);
			writeTiling(spatial, "tile_width", width);
			writeTiling(spatial, "tile_height", height);
		}
		if (temporal !== void 0) {
			const frames = Math.max(17, Math.round(input.duration * input.fps));
			writeTiling(temporal, "chunk_length", Math.ceil(frames / 17) * 17);
			writeTiling(temporal, "temporal_overlap", 0);
		}
	}
	const second = gateFeeding(["MMH3SplitUpscale", "MMH3UltimateUpscale"]);
	if (second !== void 0) writeSwitch(second[0], second[1], input.secondPassTiled, "secondPassTiled");
	else if (input.secondPassTiled) unbound.push("secondPassTiled");
}
function bindLoras(prepared, profile, input, entries, used, bindings, unbound) {
	if (input.loras.length === 0) return;
	const slot = profile.modelSlots.find((candidate) => candidate.folder === "loras");
	const types = slot?.nodeTypes ?? [];
	const key = slot?.input ?? "lora_name";
	const declared = types.length === 0 ? [] : loraChain(prepared, entries, types);
	const shape = declared[declared.length - 1]?.[1];
	const base = linkOf(declared[0]?.[1].inputs["model"]) ?? modelSource(profile, entries);
	const chains = loraChains(prepared, declared);
	if (chains.length === 0) chains.push([]);
	for (const chain of chains) {
		let tail = chain.at(-1)?.[0] ?? base?.[0];
		if (tail === void 0) {
			unbound.push("loras");
			continue;
		}
		const byName = /* @__PURE__ */ new Map();
		for (const [id, node] of chain) {
			const name = node.inputs[key];
			if (typeof name === "string") byName.set(name, id);
		}
		for (const [position, lora] of input.loras.entries()) {
			const existing = byName.get(lora.name);
			const mountedId = existing ?? mountLora(prepared, tail, shape?.class_type ?? types[0], shape);
			if (mountedId === void 0) {
				unbound.push(`lora_${String(position)}`);
				continue;
			}
			if (existing === void 0) {
				const mounted = graphNode(prepared, mountedId);
				if (mounted !== void 0) chain.push([mountedId, mounted]);
				byName.set(lora.name, mountedId);
				tail = mountedId;
			}
			used.add(mountedId);
			const node = graphNode(prepared, mountedId);
			if (node === void 0) continue;
			const strengths = Object.hasOwn(node.inputs, "strength_clip") ? [["strength_model", lora.strength], ["strength_clip", lora.strength]] : [["strength_model", lora.strength]];
			const written = [{
				parameter: `lora_${String(position)}`,
				nodeId: mountedId,
				input: key,
				value: lora.name
			}, ...strengths.map(([input, value]) => ({
				parameter: `loraStrength_${String(position)}`,
				nodeId: mountedId,
				input,
				value
			}))];
			for (const binding of written) {
				bindings.push(binding);
				writeBinding(prepared, binding);
			}
		}
	}
}
/**
* Group declared LoRA loaders by the model chain they sit on.
*
* 全能工作流这类模板有两条独立的模型链（一采 EasyLoader、二采 UNETLoader），
* 每条链各带自己的 LoRA 加载器。片段配置的 LoRA 必须**每条链各来一份**，
* 否则一采只拿到第一个 LoRA、二采只拿到第二个，权重就和页面上写的对不上了。
* @param prepared - the graph being prepared.
* @param declared - every LoRA loader of the family, shallowest first.
* @returns one list of loaders per chain, each in chain order.
*/
function loraChains(prepared, declared) {
	const known = new Set(declared.map(([id]) => id));
	const headOf = (id) => {
		const seen = /* @__PURE__ */ new Set([id]);
		let current = id;
		for (;;) {
			const link = linkOf(graphNode(prepared, current)?.inputs["model"]);
			if (link === void 0 || !known.has(link[0]) || seen.has(link[0])) return current;
			seen.add(link[0]);
			current = link[0];
		}
	};
	const groups = /* @__PURE__ */ new Map();
	for (const entry of declared) {
		const head = headOf(entry[0]);
		const bucket = groups.get(head);
		if (bucket === void 0) groups.set(head, [[entry[0], entry[1]]]);
		else bucket.push([entry[0], entry[1]]);
	}
	return [...groups.values()];
}
/**
* The model one LoRA loader of this family would patch, for a template that carries
* no loader of its own.
* @param profile - the template's family profile.
* @param entries - the graph's nodes.
* @returns the link the loader takes its model from, or undefined when the graph
* names no loader of the family's model slots.
*/
function modelSource(profile, entries) {
	const loaders = profile.modelSlots.filter((candidate) => candidate.folder === "unet" || candidate.folder === "checkpoints").flatMap((candidate) => candidate.nodeTypes);
	for (const [, node] of entries) for (const value of Object.values(node.inputs)) {
		const link = linkOf(value);
		const owner = link === void 0 ? void 0 : entries.find((entry) => entry[0] === link[0]);
		if (link !== void 0 && owner !== void 0 && loaders.includes(owner[1].class_type)) return link;
	}
}
/**
* Append one LoRA loader by copying the loader it follows.
*
* The copy keeps every input of the shape it copies, so a loader that also patches
* text conditioning stays valid, and it takes that loader's place in the model
* chain: whatever read the loader it follows now reads this one. A template that
* carries no loader of its own gets a node of the family's own class type, which is
* what makes a clip's configuration work on any film template.
* @param prepared - the graph being prepared.
* @param after - id of the node whose model the new loader takes.
* @param classType - the loader's node class type, or undefined when the family declares none.
* @param shape - the loader whose inputs the copy takes, or undefined for a loader this build writes itself.
* @returns the new loader's id, or undefined when nothing can be mounted.
*/
function mountLora(prepared, after, classType, shape) {
	if (classType === void 0) return void 0;
	const id = nextNodeId(prepared);
	for (const target of Object.values(prepared)) {
		const inputs = typeof target === "object" && target !== null ? target.inputs : void 0;
		if (inputs === void 0) continue;
		for (const [key, input] of Object.entries(inputs)) {
			const link = linkOf(input);
			if (link !== void 0 && link[0] === after) inputs[key] = [id, 0];
		}
	}
	const inputs = shape === void 0 ? { model: [after, 0] } : {
		...structuredClone(shape.inputs),
		model: [after, 0]
	};
	prepared[id] = {
		...shape === void 0 ? {} : structuredClone(shape),
		class_type: classType,
		inputs,
		_meta: { title: "LoRA（按片段配置）" }
	};
	return id;
}
/**
* Normalize a template's guide chain to the anchors one clip actually holds (AI-11).
*
* The chain carries one stage per anchor: a stage for each confirmed keyframe, the
* opening frame where nothing else anchors it, and the stage a continuation feeds
* from the previous film. A template's own stage count is a starting point — the
* shipped keyframe graph pins three — so a stage no anchor reaches leaves the graph,
* and a clip carrying more anchors than the template declares grows the chain by
* copying the stage each extra anchor follows. A stage left holding the template's
* sample picture would make ComfyUI validate a file the server need not hold.
* @param prepared - the graph being prepared.
* @param stages - the template's guide stages.
* @param filmStage - the stage the previous film feeds, when the clip continues one.
* @param anchors - the clip's picture anchors, in frame order.
* @param bindings - collected bindings.
* @param unbound - parameters the graph could not express.
*/
/**
* 按 frame_idx 重接引导链。
*
* 模板的 AddGuide 是**链式**的（后一段的 positive 接前一段），ComfyUI 按链顺序处理。
* 锚点数量与模板顺序不一致时（比如锚点是 0/48/96/144，而模板节点自带 0/48/144/96），
* 只改 frame_idx 会让链条顺序与帧号错位——后半段就会出现别的画面。
* 这里统一按帧号升序重接，并把下游 Guider 的 conditioning 指到新的链尾。
* @param prepared - 图。
* @param ordered - 模板里按 frame_idx 排好的引导段。
* @param targets - 实际用到的段（与 anchors 一一对应）。
* @param anchors - 锚点。
*/
function rechainGuides(prepared, ordered, targets, anchors) {
	if (targets.length === 0 || ordered.length === 0) return;
	const first = ordered[0];
	if (first === void 0) return;
	const head = nodeInputs(prepared, first[0])?.["positive"];
	if (head === void 0) return;
	const targetSet = new Set(targets);
	const consumers = [];
	for (const id of Object.keys(prepared)) {
		const inputs = nodeInputs(prepared, id);
		if (inputs === void 0) continue;
		for (const [key, value] of Object.entries(inputs)) {
			if (key === "positive") continue;
			if (Array.isArray(value) && targetSet.has(String(value[0]))) consumers.push({
				inputs,
				key
			});
		}
	}
	const used = targets.map((id, index) => ({
		id,
		frameIndex: anchors[index]?.frameIndex ?? index
	})).sort((left, right) => left.frameIndex - right.frameIndex);
	let previous = head;
	for (const entry of used) {
		const inputs = nodeInputs(prepared, entry.id);
		if (inputs !== void 0) inputs["positive"] = previous;
		previous = [entry.id, 0];
	}
	for (const consumer of consumers) consumer.inputs[consumer.key] = previous;
}
function bindGuideStages(prepared, stages, filmStage, anchors, bindings, unbound) {
	const ordered = [...stages].sort((left, right) => pinnedFrame(left[1]) - pinnedFrame(right[1])).filter(([id]) => graphNode(prepared, id) !== void 0);
	const targets = ordered.filter(([id]) => id !== filmStage).slice(0, anchors.length).map(([id]) => id);
	const shape = ordered[ordered.length - 1]?.[1];
	while (targets.length < anchors.length) {
		const anchor = anchors[targets.length];
		const after = targets[targets.length - 1] ?? filmStage;
		const added = anchor === void 0 || after === void 0 || shape === void 0 ? void 0 : appendGuideStage(prepared, shape, after, anchor);
		if (added === void 0) break;
		targets.push(added);
	}
	const keep = new Set(targets);
	if (filmStage !== void 0) keep.add(filmStage);
	for (const [id] of ordered) if (!keep.has(id)) bypassNode(prepared, id, "positive");
	rechainGuides(prepared, ordered, targets, anchors);
	for (const [position, anchor] of anchors.entries()) {
		const id = targets[position];
		const slot = id === void 0 ? void 0 : mountGuidePicture(prepared, id, anchor);
		if (id === void 0 || slot === void 0) {
			unbound.push(anchor.parameter);
			continue;
		}
		const file = {
			parameter: anchor.parameter,
			nodeId: slot.nodeId,
			input: slot.input,
			value: anchor.file
		};
		bindings.push(file);
		writeBinding(prepared, file);
		const frame = {
			parameter: anchor.frameParameter,
			nodeId: id,
			input: "frame_idx",
			value: anchor.frameIndex
		};
		bindings.push(frame);
		writeBinding(prepared, frame);
	}
}
/**
* Mount one anchor's picture on a guide stage.
*
* A stage carries the loader it was authored with, or lost that loader with the film
* chain it no longer reads; in the second case a copy of any picture loader in the
* graph names the anchor's file, so the template's own sample file never survives as
* a file ComfyUI would validate.
* @param prepared - the graph being prepared.
* @param id - the guide stage carrying the picture.
* @param anchor - the picture anchor.
* @returns the node and input the file was written to, or undefined when the graph
* holds no picture loader to copy.
*/
function mountGuidePicture(prepared, id, anchor) {
	const stage = graphNode(prepared, id);
	if (stage === void 0) return void 0;
	const slot = fileSlot(prepared, stage.inputs["image"]);
	if (slot !== void 0) return slot;
	const seedId = Object.keys(prepared).find((candidate) => graphNode(prepared, candidate)?.class_type === "LoadImage");
	const seed = seedId === void 0 ? void 0 : graphNode(prepared, seedId);
	const key = seed === void 0 ? void 0 : Object.keys(seed.inputs).find((name) => FILE_INPUT_KEYS.includes(name) && typeof seed.inputs[name] === "string");
	if (seed === void 0 || key === void 0) return void 0;
	const loaderId = nextNodeId(prepared);
	prepared[loaderId] = {
		...structuredClone(seed),
		inputs: {
			...seed.inputs,
			[key]: anchor.file
		}
	};
	const inputs = nodeInputs(prepared, id);
	if (inputs !== void 0) inputs["image"] = [loaderId, 0];
	return {
		nodeId: loaderId,
		input: key
	};
}
/**
* Append one guide stage by copying the stage it follows.
*
* The copy keeps every input of the shape it copies, so a stage carrying more than
* its picture stays valid, and the copy takes that stage's place in the chain:
* whatever read the stage it follows now reads this one.
* @param prepared - the graph being prepared.
* @param shape - the guide stage the copy takes its inputs from.
* @param after - id of the stage the new one follows.
* @param anchor - the picture and frame the new stage carries.
* @returns the new stage's id, or undefined when no picture loader can be mounted.
*/
function appendGuideStage(prepared, shape, after, anchor) {
	const id = nextNodeId(prepared);
	for (const target of Object.values(prepared)) {
		const inputs = typeof target === "object" && target !== null ? target.inputs : void 0;
		if (inputs === void 0) continue;
		for (const [key, input] of Object.entries(inputs)) {
			const link = linkOf(input);
			if (link !== void 0 && link[0] === after) inputs[key] = [id, 0];
		}
	}
	const inputs = {
		...structuredClone(shape.inputs),
		positive: [after, 0],
		frame_idx: anchor.frameIndex
	};
	Reflect.deleteProperty(inputs, "image");
	prepared[id] = {
		...structuredClone(shape),
		inputs
	};
	if (mountGuidePicture(prepared, id, anchor) === void 0) {
		Reflect.deleteProperty(prepared, id);
		return;
	}
	return id;
}
/**
* Bind one clip's duration. A graph that converts seconds to the family's frame
* grid takes the seconds into the scalar feeding that expression; a graph that
* carries the frame count directly takes the aligned count. The chain is
* recorded as one binding so the panel can report which node received it.
* @param prepared - the graph being prepared.
* @param entries - the graph's nodes.
* @param used - node ids already claimed by another parameter.
* @param bindings - collected bindings.
* @param unbound - parameters the graph could not express.
* @param input - resolved clip parameters.
* @param frames - the clip's duration on the family's frame grid.
*/
function addLength(prepared, entries, used, bindings, unbound, input, frames) {
	const guideCounts = new Set(entries.filter(([, node]) => GUIDE_RANGE_NODE_TYPES.includes(node.class_type)).flatMap(([id, node]) => {
		const carrier = linkOf(node.inputs["num_frames"])?.[0];
		return carrier === void 0 ? [id] : [id, carrier];
	}));
	for (const [id, value] of entries) {
		if (guideCounts.has(id)) continue;
		const key = Object.keys(value.inputs).find((name) => DURATION_INPUT_KEYS.includes(name));
		if (key === void 0) continue;
		const link = linkOf(value.inputs[key]);
		const producer = link === void 0 ? void 0 : entries.find((entry) => entry[0] === link[0]);
		if (producer !== void 0 && typeof producer[1].inputs["expression"] === "string") {
			const scalar = Object.values(producer[1].inputs).map(linkOf).find((candidate) => candidate !== void 0);
			const source = scalar === void 0 ? void 0 : entries.find((entry) => entry[0] === scalar[0] && LENGTH_NODE_TYPES.includes(entry[1].class_type));
			const sourceKey = source === void 0 ? void 0 : Object.keys(source[1].inputs).find((name) => name === "value" || name === "int");
			if (source === void 0 || sourceKey === void 0) {
				unbound.push("duration");
				return;
			}
			used.add(source[0]);
			const binding = {
				parameter: "duration",
				nodeId: source[0],
				input: sourceKey,
				value: input.duration
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
			return;
		}
		if (producer !== void 0) {
			const sourceKey = Object.keys(producer[1].inputs).find((name) => name === "value" || name === "int");
			if (sourceKey !== void 0) {
				used.add(producer[0]);
				const binding = {
					parameter: "duration",
					nodeId: producer[0],
					input: sourceKey,
					value: frames
				};
				bindings.push(binding);
				writeBinding(prepared, binding);
				return;
			}
		}
		const binding = {
			parameter: "duration",
			nodeId: id,
			input: key,
			value: frames
		};
		bindings.push(binding);
		writeBinding(prepared, binding);
		return;
	}
	unbound.push("duration");
}
/**
* Bind a clip's ordered references. Each family's template slots are grouped by
* the file-loading node behind them, ordered by the slot number the template
* gave them, and filled from the clip in that order; a slot the clip does not
* fill loses the template's own media so the graph carries none of it, and a
* reference the template has no slot for is reported instead of dropped.
* @param prepared - the graph being prepared.
* @param profile - the family profile owning the reference node.
* @param input - resolved clip parameters and uploaded media names.
* @param entries - the graph's nodes.
* @param used - node ids already claimed by another parameter.
* @param bindings - collected bindings.
* @param unbound - parameters the template cannot carry.
*/
function bindReferenceSlots(prepared, profile, input, entries, used, bindings, unbound) {
	const reference = matchAnyNode(entries, profile.referenceNodeTypes, used);
	if (reference === void 0) return;
	used.add(reference[0]);
	const families = [
		[
			["LoadImage"],
			input.media.refImages,
			"ref_image"
		],
		[
			["LoadVideo"],
			input.media.refVideos,
			"ref_video"
		],
		[
			["LoadAudio"],
			input.media.refAudios,
			"ref_audio"
		]
	];
	for (const [types, files, parameter] of families) {
		const slots = /* @__PURE__ */ new Map();
		for (const [key, value] of Object.entries(reference[1].inputs)) {
			const slot = slotIndex(key);
			if (slot === void 0) continue;
			const target = fileSlot(prepared, value);
			if (target === void 0) continue;
			const owner = graphNode(prepared, target.nodeId);
			if (owner === void 0 || !types.includes(owner.class_type)) continue;
			const existing = slots.get(target.nodeId);
			if (existing === void 0) slots.set(target.nodeId, {
				input: target.input,
				index: slot,
				keys: [key]
			});
			else existing.keys.push(key);
		}
		const ordered = [...slots.entries()].sort((left, right) => left[1].index - right[1].index);
		for (const [index, [nodeId, slot]] of ordered.entries()) {
			const file = files[index];
			if (file === void 0) {
				const inputs = nodeInputs(prepared, reference[0]);
				for (const key of slot.keys) if (inputs !== void 0) Reflect.deleteProperty(inputs, key);
				continue;
			}
			const binding = {
				parameter: `${parameter}_${String(index)}`,
				nodeId,
				input: slot.input,
				value: file
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
		}
		const anchor = ordered[ordered.length - 1];
		for (let index = ordered.length; index < files.length; index += 1) {
			const file = files[index];
			const added = anchor === void 0 || file === void 0 ? void 0 : addImageReferenceSlot(prepared, reference[0], anchor, parameter, index, file);
			if (added === void 0) unbound.push(`${parameter}_${String(index)}`);
			else bindings.push(added);
		}
	}
}
/**
* Add one image reference slot the template does not declare. The copy keeps every
* input of the node it copies, so a loader carrying more than its media input stays
* valid, and the reference node takes it under the next slot number — the numbering
* ComfyUI's autogrow reference input reads.
* @param prepared - the graph being prepared.
* @param referenceId - the node owning the reference slots.
* @param anchor - the family's last declared slot: its loader node, media input, and keys.
* @param parameter - the binding name prefix of the family.
* @param index - the slot number to add.
* @param file - the uploaded file the added slot reads.
* @returns the binding written, or undefined when this family cannot be extended.
*/
function addImageReferenceSlot(prepared, referenceId, anchor, parameter, index, file) {
	const seed = graphNode(prepared, anchor[0]);
	const key = anchor[1].keys[0];
	const inputs = nodeInputs(prepared, referenceId);
	if (seed === void 0 || seed.class_type !== "LoadImage" || key === void 0 || inputs === void 0) return void 0;
	const id = nextNodeId(prepared);
	prepared[id] = {
		...structuredClone(seed),
		inputs: {
			...seed.inputs,
			[anchor[1].input]: file
		}
	};
	inputs[`${key.replace(/_\d+$/u, "")}_${String(index)}`] = [id, 0];
	return {
		parameter: `${parameter}_${String(index)}`,
		nodeId: id,
		input: anchor[1].input,
		value: file
	};
}
/** The lowest node id the graph leaves free, for a node preparation adds itself. */
function nextNodeId(graph) {
	let highest = 0;
	for (const id of Object.keys(graph)) {
		const numeric = Number(id);
		if (Number.isInteger(numeric) && numeric > highest) highest = numeric;
	}
	return String(highest + 1);
}
/** Node class types that sample an interpolated keyframe picture. */
const PICTURE_SAMPLER_TYPES = ["KSampler", "KSamplerAdvanced"];
/** Node class types carrying the empty canvas a picture sampler fills. */
const PICTURE_CANVAS_TYPES = [
	"EmptySD3LatentImage",
	"EmptyLatentImage",
	"LatentUpscale"
];
/** Node class types that pick between a fixed canvas and a preset resolver. */
const PICTURE_SWITCH_TYPES = ["ComfySwitchNode", "ComfySwitch"];
/** Node class types holding the boolean a picture switch reads. */
const PICTURE_BOOLEAN_TYPES = ["PrimitiveBoolean"];
/** Node class types that resolve a megapixel preset into a canvas. */
const PICTURE_RESOLVER_TYPES = ["ResolutionSelector"];
/** Node class types whose boolean picks the tiled output over the single picture. */
const PICTURE_TILE_SWITCH_TYPES = ["easy imageSwitch", "easy imageSwitch (custom)"];
/**
* Make a switching picture template read its fixed-canvas branch.
*
* A graph that offers both a resolution preset and an empty latent chooses
* between them with a boolean (`custom_size`). Binding the latent's width alone
* changes nothing while that boolean still selects the preset — which is why a
* 1632×912 request used to come back at the preset's 960×544. The boolean is
* written here to whatever branch leads to the canvas node the caller is about
* to bind, so the requested size is the one the sampler actually fills.
* @param graph - the prepared graph, mutated in place.
* @param canvasId - the empty-canvas node being bound, when the graph has one.
*/
function forceFixedCanvas(graph, canvasId) {
	if (canvasId === void 0) return;
	for (const [, node] of graphNodes(graph)) {
		if (!PICTURE_SWITCH_TYPES.includes(node.class_type)) continue;
		const control = linkOf(node.inputs["switch"]);
		if (control === void 0) continue;
		const controlNode = graphNode(graph, control[0]);
		if (controlNode === void 0 || !PICTURE_BOOLEAN_TYPES.includes(controlNode.class_type)) continue;
		const branch = [["on_true", true], ["on_false", false]].find(([key]) => linkOf(node.inputs[key])?.[0] === canvasId);
		if (branch === void 0) continue;
		const controlInputs = nodeInputs(graph, control[0]);
		if (controlInputs !== void 0) controlInputs["value"] = branch[1];
	}
}
/**
* Point a tiling picture template at the output the caller asked for.
*
* A template that carries a tiling switch (`easy imageSwitch`) saves either the
* tiled grid or the whole decoded picture. The fragments pane offers the same
* switch as 「是否切块」, so this writes it to what the operator picked; a
* template without such a switch is left exactly as it was.
* @param graph - the prepared graph, mutated in place.
* @param tile - whether the draw should be cut into its grid tiles.
*/
function forceTiledOutput(graph, tile) {
	for (const [id, node] of graphNodes(graph)) {
		if (!PICTURE_TILE_SWITCH_TYPES.includes(node.class_type)) continue;
		const inputs = nodeInputs(graph, id);
		if (inputs !== void 0 && typeof inputs["boolean"] === "boolean") inputs["boolean"] = tile;
	}
}
/**
* The preset label a resolution resolver can read for a canvas.
*
* A resolver states its ratio as a label (`16:9 (Widescreen)`), so only a label
* already carrying the same ratio can be written back; anything else keeps the
* preset's own ratio and the megapixel count alone is set.
* @param current - the resolver's current `aspect_ratio` value.
* @param width - requested canvas width.
* @param height - requested canvas height.
* @returns the label to write, or undefined when it cannot state this ratio.
*/
function resolverAspect(current, width, height) {
	if (typeof current !== "string") return void 0;
	const stated = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/u.exec(current);
	if (stated === null) return void 0;
	const ratio = Number(stated[1]) / Number(stated[2]);
	const wanted = width / height;
	return Math.abs(ratio - wanted) / wanted <= .02 ? current : void 0;
}
/** Canvas inputs a picture graph states as numbers. */
const CANVAS_INPUT_KEYS = [["width", "width"], ["height", "height"]];
/** Node class types that enlarge a latent or an image after the first pass. */
const UPSCALE_NODE_TYPES = [
	"LatentUpscaleBy",
	"ImageScaleBy",
	"LatentUpscale",
	"ImageUpscaleWithModel"
];
/** Side a latent canvas is rounded to, in pixels. */
const LATENT_GRID = 16;
/**
* The canvas one picture template has to draw so its own stages land on the
* clip's canvas.
*
* A template that enlarges its latent after the first pass (the shipped
* text-to-picture graph doubles it) is asked for the pre-upscale size, rounded
* to a latent grid; a template that draws at final size is asked for that size.
* @param graph - the prepared picture graph.
* @param input - the clip's canvas.
* @returns the width and height to write onto the empty-canvas node.
*/
function pictureSourceSize(graph, input) {
	let factor = 1;
	for (const [, node] of graphNodes(graph)) {
		if (!UPSCALE_NODE_TYPES.includes(node.class_type)) continue;
		const scale = node.inputs["scale_by"];
		if (typeof scale === "number" && scale > 1) factor *= scale;
	}
	if (factor === 1) return {
		width: input.width,
		height: input.height
	};
	const align = (value) => Math.max(LATENT_GRID, Math.round(value / LATENT_GRID) * LATENT_GRID);
	return {
		width: align(input.width / factor),
		height: align(input.height / factor)
	};
}
/**
* Follow a conditioning link to the node that writes its text, which is how a
* picture encoder sits behind the sampler's positive input.
* @param graph - the graph being prepared.
* @param value - the sampler's conditioning link.
* @returns the prompt-carrying node and its input key.
*/
function promptSlot(graph, value) {
	const first = linkOf(value);
	if (first === void 0) return void 0;
	const seen = /* @__PURE__ */ new Set();
	let id = first[0];
	for (;;) {
		if (seen.has(id)) return void 0;
		seen.add(id);
		const current = graphNode(graph, id);
		if (current === void 0) return void 0;
		const key = Object.keys(current.inputs).find((name) => /^(prompt|text|value)$/u.test(name) && typeof current.inputs[name] === "string");
		if (key !== void 0) return {
			nodeId: id,
			input: key
		};
		const next = Object.values(current.inputs).map(linkOf).find((candidate) => candidate !== void 0);
		if (next === void 0) return void 0;
		id = next[0];
	}
}
/**
* Copy one picture workflow and write the keyframe's prompt, seed, canvas, and
* two reference pictures onto it (AI-11).
*
* A picture graph is not a clip graph: it has no duration, no frame grid, and no
* model family of its own, so the clip path's parameter mapping does not apply.
* The graph is expected to name its two pictures `image1` (character) and
* `image2` (scene) on the node feeding the sampler's positive input; a graph that
* names them differently falls back to the order of its image loaders, first
* character then scene.
* @param graph - the template graph; it is never mutated.
* @param paramMap - user overrides keyed by parameter name.
* @param input - the prompt, seed, canvas, and uploaded picture names.
* @param overrides - per-server model file overrides keyed by node id.
* @returns the prepared graph plus the bindings applied and any unbound parameter.
*/
function prepareKeyframeGraph(graph, paramMap, input, overrides) {
	const prepared = structuredClone(graph);
	const entries = graphNodes(prepared);
	const used = /* @__PURE__ */ new Set();
	const bindings = [];
	const unbound = [];
	const notes = [];
	const bind = claimer(prepared, used, bindings);
	const mapped = (parameter) => bindingFromMap(paramMap, parameter);
	const sampler = matchAnyNode(entries, PICTURE_SAMPLER_TYPES, used);
	const positive = sampler?.[1].inputs["positive"];
	const encoder = sampler === void 0 ? void 0 : promptSlot(prepared, positive);
	const prompt = mapped("prompt") ?? encoder;
	if (prompt === void 0) unbound.push("prompt");
	else bind("prompt", prompt.nodeId, prompt.input, input.prompt);
	const seedKey = sampler === void 0 ? void 0 : ["seed", "noise_seed"].find((key) => typeof sampler[1].inputs[key] === "number");
	if (seedKey !== void 0 && sampler !== void 0) bind("seed", sampler[0], seedKey, input.seed);
	else {
		const noise = matchNode(entries, SEED_NODE_TYPES, /^(noise_seed|seed)$/u, used);
		if (noise === void 0) unbound.push("seed");
		else bind("seed", noise[0], noise[2], input.seed);
	}
	if (sampler !== void 0) {
		if (input.cfg !== void 0) bind("cfg", sampler[0], "cfg", input.cfg);
		if (input.steps !== void 0) bind("steps", sampler[0], "steps", input.steps);
	}
	if (sampler !== void 0) used.add(sampler[0]);
	const canvas = matchAnyNode(entries, PICTURE_CANVAS_TYPES, used);
	forceFixedCanvas(prepared, canvas?.[0]);
	forceTiledOutput(prepared, input.tile === true);
	if (input.tile === true) {
		const tileNode = entries.find(([, value]) => value.class_type.startsWith("ImageTile"));
		if (tileNode !== void 0) {
			if (input.tileY !== void 0) bind("tileY", tileNode[0], "cols", Math.max(1, Math.round(input.tileY)));
			if (input.tileX !== void 0) bind("tileX", tileNode[0], "rows", Math.max(1, Math.round(input.tileX)));
		}
	}
	if (canvas === void 0) {
		const resolver = matchAnyNode(entries, PICTURE_RESOLVER_TYPES, used);
		if (resolver === void 0) unbound.push("width");
		else {
			used.add(resolver[0]);
			const megapixels = Math.round(input.width * input.height / 1e6 * 100) / 100;
			if (typeof resolver[1].inputs["megapixels"] === "number") bind("width", resolver[0], "megapixels", megapixels);
			const aspect = resolverAspect(resolver[1].inputs["aspect_ratio"], input.width, input.height);
			if (aspect !== void 0) bind("ratio", resolver[0], "aspect_ratio", aspect);
		}
	} else {
		used.add(canvas[0]);
		const drawn = pictureSourceSize(prepared, input);
		for (const [key, edge] of CANVAS_INPUT_KEYS) {
			if (typeof canvas[1].inputs[key] !== "number") continue;
			const binding = {
				parameter: edge,
				nodeId: canvas[0],
				input: key,
				value: drawn[edge]
			};
			bindings.push(binding);
			writeBinding(prepared, binding);
		}
	}
	const claimed = /* @__PURE__ */ new Set();
	const refFiles = [
		input.character,
		input.scene,
		...input.extras ?? []
	].filter((file) => typeof file === "string" && file !== "").slice(0, 5);
	const slotPattern = /^(?:images\.)?image[_\s]?(\d+)$/iu;
	const declared = [];
	for (const key of Object.keys(encoder === void 0 ? {} : nodeInputs(prepared, encoder.nodeId) ?? {})) {
		const match = slotPattern.exec(key);
		if (match === null) continue;
		declared.push({
			key,
			index: Number(match[1])
		});
	}
	declared.sort((left, right) => left.index - right.index);
	const keyPrefix = declared[0] === void 0 ? "image_" : declared[0].key.replace(/\d+$/u, "");
	const candidates = entries.filter(([, value]) => value.class_type === "LoadImage");
	const seedEntry = entries.find(([, value]) => value.class_type === "LoadImage");
	refFiles.forEach((file, index) => {
		const slot = declared[index];
		const target = slot === void 0 || encoder === void 0 ? void 0 : fileSlot(prepared, nodeInputs(prepared, encoder.nodeId)?.[slot.key]);
		if (target !== void 0) {
			claimed.add(target.nodeId);
			bind(`image${String(index + 1)}`, target.nodeId, target.input, file);
			return;
		}
		const fallback = candidates.find(([id]) => !claimed.has(id));
		const loaderId = fallback === void 0 ? nextNodeId(prepared) : fallback[0];
		if (fallback === void 0) {
			if (seedEntry === void 0) return;
			const seedInputs = seedEntry[1].inputs;
			const seedKey = Object.keys(seedInputs).find((name) => FILE_INPUT_KEYS.includes(name) && typeof seedInputs[name] === "string") ?? "image";
			prepared[loaderId] = {
				class_type: "LoadImage",
				inputs: {
					...seedInputs,
					[seedKey]: file
				}
			};
		} else {
			const loaderInputs = nodeInputs(prepared, loaderId);
			if (loaderInputs !== void 0) loaderInputs["image"] = file;
		}
		claimed.add(loaderId);
		const inputs = encoder === void 0 ? void 0 : nodeInputs(prepared, encoder.nodeId);
		if (inputs !== void 0) inputs[`${keyPrefix}${String(index + 1)}`] = [loaderId, 0];
		bind(`image${String(index + 1)}`, loaderId, "image", file);
	});
	for (const slot of declared.slice(refFiles.length)) {
		if (encoder === void 0) continue;
		const inputs = nodeInputs(prepared, encoder.nodeId);
		if (inputs === void 0) continue;
		const target = fileSlot(prepared, inputs[slot.key]);
		Reflect.deleteProperty(inputs, slot.key);
		if (target !== void 0) Reflect.deleteProperty(prepared, target.nodeId);
	}
	const extras = input.extras ?? [];
	if (extras.length > 0 && encoder !== void 0) {
		const encoderInputs = graphNode(prepared, encoder.nodeId)?.inputs ?? {};
		const extraSlots = Object.keys(encoderInputs).filter((name) => /^(?:images\.)?image[_\s]?([4-9])$/iu.test(name)).sort((left, right) => Number(/(\d+)$/u.exec(left)?.[1] ?? 0) - Number(/(\d+)$/u.exec(right)?.[1] ?? 0));
		extras.forEach((file, index) => {
			const slot = extraSlots[index];
			if (slot === void 0) return;
			const target = fileSlot(prepared, encoderInputs[slot]);
			if (target === void 0 || claimed.has(target.nodeId)) return;
			claimed.add(target.nodeId);
			bind(`extra_${String(index + 1)}`, target.nodeId, target.input, file);
		});
	}
	for (const [nodeId, fileName] of Object.entries(overrides)) {
		const target = prepared[nodeId];
		if (typeof target !== "object" || target === null) continue;
		const slot = TIME_RIVER_PROFILES.flatMap((candidate) => candidate.modelSlots).find((candidate) => candidate.nodeTypes.includes(target.class_type));
		if (slot === void 0) continue;
		bind(`model:${slot.folder}`, nodeId, slot.input, fileName);
	}
	return {
		graph: prepared,
		bindings,
		unbound,
		notes
	};
}
// lib/types/graph/postpass.js
/**
* 视频后处理模板的编译：视频放大（RelayVSR）与视频补帧（FrameInterpolate）。
*
* 这两条模板都从 `LoadVideo` 读一段现成视频，只改"读哪个文件"，其余节点（模型、VAE、
* 采样、编码）保持作者导出的样子。所以这里不做通用图编译，只按类名把文件写进去。
* @module dsh-dream-studio-host/graph/postpass
*/
/** 把值写进节点。 */
function write(graph, nodeId, input, value) {
	const node = graph[nodeId];
	if (node === void 0) return;
	node.inputs[input] = value;
}
/** 找第一个指定类名的节点。 */
function find(graph, classType) {
	for (const [id, value] of Object.entries(graph)) {
		const node = value;
		if (node.class_type === classType) return [id, node];
	}
}
/**
* 编译"视频放大"图：只把上传后的文件名写进 `LoadVideo.file`。
* @param template - 2K / 4K 放大模板。
* @param video - 上传到 ComfyUI input 目录后的文件名。
* @returns 可提交的图与绑定。
*/
function prepareVideoUpscaleGraph(template, video) {
	const graph = structuredClone(template);
	const load = find(graph, "LoadVideo");
	const bindings = [];
	if (load === void 0) return {
		graph,
		bindings,
		unbound: ["video"]
	};
	write(graph, load[0], "file", video);
	bindings.push({
		parameter: "video",
		nodeId: load[0],
		input: "file",
		value: video
	});
	return {
		graph,
		bindings,
		unbound: []
	};
}
/**
* 编译"视频补帧"图：写 `LoadVideo.file`，并把每秒补充的帧数写进 `FrameInterpolate.multiplier`
* 的来源 `PrimitiveInt.value`（模板里同步驱动 CreateVideo 的 fps 表达式）。
* @param template - 补帧模板。
* @param video - 上传后的文件名。
* @param multiplier - 每秒补充的帧数（默认 10）。
* @returns 可提交的图与绑定。
*/
function prepareVideoInterpolationGraph(template, video, multiplier) {
	const graph = structuredClone(template);
	const bindings = [];
	const unbound = [];
	const load = find(graph, "LoadVideo");
	if (load === void 0) unbound.push("video");
	else {
		write(graph, load[0], "file", video);
		bindings.push({
			parameter: "video",
			nodeId: load[0],
			input: "file",
			value: video
		});
	}
	const link = find(graph, "FrameInterpolate")?.[1].inputs["multiplier"];
	const sourceId = Array.isArray(link) && typeof link[0] === "string" ? link[0] : void 0;
	const source = sourceId === void 0 ? void 0 : graph[sourceId];
	const target = source !== void 0 && source.class_type === "PrimitiveInt" ? [sourceId, source] : find(graph, "PrimitiveInt");
	if (target === void 0) unbound.push("multiplier");
	else {
		const value = Math.trunc(multiplier);
		write(graph, target[0], "value", value);
		bindings.push({
			parameter: "multiplier",
			nodeId: target[0],
			input: "value",
			value
		});
	}
	return {
		graph,
		bindings,
		unbound
	};
}
// lib/types/graph/templates.js
/**
* 内置工作流模板：读 `resources/workflows/*.json`，推断用途与服务模式，量出能力上限。
*
* 内置四份：
* - `Qwen2.1文生图`
* - `Qwen2.1万能图生图`
* - `时空造梦全能工作流`（同时服务首尾帧与全能参考）
* - `时空造梦-独立二采`（只读一采留下的 latent，重绘放大成高清成片）
*
* 能力上限由**节点**决定，不写死在代码里：参考图数 = `media_*` 输入个数，
* 关键帧阶段 = `MiniMaxH3AddGuide` 个数，LoRA 槽 = loader 个数，二采/续写看有没有对应节点。
* 用户导入自定义模板后，这些数字自动跟着变。
* @module dsh-dream-studio-host/graph/templates
*/
/** 资源目录（相对本模块）。 */
const HERE$1 = fileURLToPath(new URL(".", import.meta.url));
/**
* 读 latent 的节点：带它的模板不画一采，只把已有 latent 重绘放大。
* 新节点包是 `DreamStudio_LatentLoad`，旧的是 `TimeRiver_LatentLoad`。
*/
const LATENT_LOAD_NODE_TYPES = ["DreamStudio_LatentLoad", "TimeRiver_LatentLoad"];
/**
* 内置工作流所在目录。
*
* 源码运行时在 `host/src/graph/`，构建后落在 `host/lib/types/graph/`，
* 两者到 `resources/workflows` 的相对层级相同（上两级）。
* @returns 绝对目录。
*/
function templateDirs() {
	return [
		join(HERE$1, "..", "resources", "workflows"),
		join(HERE$1, "..", "..", "resources", "workflows"),
		join(HERE$1, "..", "..", "..", "resources", "workflows")
	];
}
/**
* 内置工作流目录：取第一个存在的候选。
* @returns 绝对目录；都不存在时返回第一个候选（读取时会得到空列表）。
*/
function templatesDir() {
	return templateDirs().find((dir) => existsSync(dir)) ?? templateDirs()[0] ?? join(HERE$1, "..", "..", "resources", "workflows");
}
/**
* 把一段 JSON 读成节点图。
* @param value - 解析后的对象。
* @returns 节点图。
*/
function asGraph(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("工作流必须是 ComfyUI API 格式的节点对象");
	const out = {};
	for (const [id, node] of Object.entries(value)) {
		if (typeof node !== "object" || node === null) throw new Error(`节点 ${id} 不是对象`);
		const record = node;
		if (typeof record["class_type"] !== "string") throw new Error(`节点 ${id} 缺少 class_type`);
		out[id] = {
			class_type: record["class_type"],
			inputs: typeof record["inputs"] === "object" && record["inputs"] !== null ? record["inputs"] : {},
			...typeof record["_meta"] === "object" && record["_meta"] !== null ? { _meta: record["_meta"] } : {}
		};
	}
	return out;
}
/**
* 列出图里所有 class_type。
* @param graph - 节点图。
* @returns 类型集合。
*/
function classTypesOf(graph) {
	return Object.values(graph).map((node) => node.class_type);
}
/**
* 推断用途：含 H3 系列节点的是视频，其余按图片处理。
* @param graph - 节点图。
* @returns family。
*/
function familyOf(graph) {
	return classTypesOf(graph).some((type) => type.startsWith("MiniMaxH3")) ? "film" : "picture";
}
/**
* 推断服务的片段模式。
*
* 「全能链式续写」靠 `MiniMaxH3Easy.mode` 在 `image` / `reference` 之间切换，
* 所以一条视频模板同时服务两种模式；图片模板不服务任何片段模式。
* @param graph - 节点图。
* @returns 模式列表。
*/
function modesOf(graph) {
	if (familyOf(graph) !== "film") return [];
	return Object.values(graph).find((node) => node.class_type === "MiniMaxH3Easy") === void 0 ? ["reference"] : ["frames", "reference"];
}
/**
* 推断分类（沿用旧 `TimeRiverWorkflowKind`，给体检与旧库映射用）。
* @param graph - 节点图。
* @returns 分类。
*/
function kindOf(graph) {
	const types = classTypesOf(graph);
	if (types.some((type) => type === "SaveImage" || type === "SaveImageAdvanced")) return "picture";
	if (types.includes("RelayVSRConditioning")) return "video-upscale";
	if (types.includes("FrameInterpolate")) return "video-interp";
	if (types.some((type) => LATENT_LOAD_NODE_TYPES.includes(type))) return "second-pass";
	if (types.includes("LazySwitchKJ") && types.includes("ImageResizeKJv2") && !types.includes("MiniMaxH3Easy")) return "second-pass";
	if (types.includes("MiniMaxH3Easy")) return types.includes("MiniMaxH3MotionContext") ? "r2v" : "i2v";
	return "other";
}
/**
* 数出 `media_1..media_N` 里 N 的最大值。
* @param graph - 节点图。
* @returns 参考图上限；没有 `media_*` 输入时为 0。
*/
function mediaSlotsOf(graph) {
	let highest = 0;
	for (const node of Object.values(graph)) for (const key of Object.keys(node.inputs)) {
		const matched = /^media_(\d+)$/u.exec(key);
		if (matched !== null) highest = Math.max(highest, Number(matched[1]));
	}
	return highest;
}
/**
* 量一份模板的能力上限。
* @param graph - 节点图。
* @returns 上限。
*/
function limitsOf(graph) {
	const types = classTypesOf(graph);
	const count = (predicate) => types.filter(predicate).length;
	const carrier = mediaSlotsOf(graph);
	const film = familyOf(graph) === "film";
	return {
		referenceImages: film ? Math.max(carrier, 10) : 0,
		pictureReferences: film ? 0 : count((type) => type === "LoadImage"),
		guideStages: count((type) => type === "MiniMaxH3AddGuide"),
		loraSlots: count((type) => type === "LoraLoader" || type === "LoraLoaderModelOnly"),
		secondPass: count((type) => type === "LazySwitchKJ"),
		continuation: types.some((type) => type.startsWith("MiniMaxH3MotionContext"))
	};
}
/**
* 读一个模板文件。
* @param path - 文件路径。
* @returns 模板。
*/
function readTemplate(path) {
	const graph = asGraph(JSON.parse(readFileSync(path, "utf8")));
	return {
		name: basename(path, ".json"),
		family: familyOf(graph),
		modes: modesOf(graph),
		kind: kindOf(graph),
		graph,
		limits: limitsOf(graph)
	};
}
/**
* 读全部内置模板。
* @param dir - 目录，缺省资源目录。
* @returns 模板列表，按名字排序。
*/
function loadTemplates(dir = templatesDir()) {
	let names;
	try {
		names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
	} catch {
		return [];
	}
	return names.map((name) => readTemplate(join(dir, name)));
}
/**
* 按用途找默认模板：图片优先文生图，视频只有一条。
* @param templates - 模板列表。
* @param family - 用途。
* @param picture - 图片时选文生图还是图生图（`t2i` / `i2i`）。
* @returns 模板，没有则 null。
*/
function defaultTemplate(templates, family, picture = "t2i") {
	if (family === "film") return templates.find((template) => template.kind === "i2v" || template.kind === "r2v") ?? null;
	const wanted = picture === "t2i" ? "文生图" : "图生图";
	return templates.find((template) => template.family === "picture" && template.kind === "picture" && template.name.includes(wanted)) ?? templates.find((template) => template.family === "picture" && template.kind === "picture") ?? null;
}
/**
* 取视频放大模板。
* @param templates - 模板列表。
* @param level - `2k` / `4k`。
* @returns 模板，没有则 null。
*/
function videoUpscaleTemplate(templates, level) {
	const wanted = level === "4k" ? "4K放大" : "2K放大";
	return templates.find((template) => template.kind === "video-upscale" && template.name.includes(wanted)) ?? templates.find((template) => template.kind === "video-upscale") ?? null;
}
/**
* 取视频补帧模板。
* @param templates - 模板列表。
* @returns 模板，没有则 null。
*/
function videoInterpolationTemplate(templates) {
	return templates.find((template) => template.kind === "video-interp") ?? null;
}
/**
* 取独立二采模板：先按内置名字，退回到任何 `kind=second-pass` 的模板。
* @param templates - 模板列表。
* @returns 模板，没有则 null。
*/
function secondPassTemplate(templates) {
	return templates.find((template) => template.name === "时空造梦-独立二采") ?? templates.find((template) => template.kind === "second-pass") ?? null;
}
// lib/types/engine/await.js
/** 连续多久「既不在队列里、也没有产物」才认定任务丢了（不是慢，是丢了）。 */
const LOST_AFTER_MS = 12e4;
/** 绝对上限：再慢也总得有个头，防止真的挂死（3 小时）。 */
const ABSOLUTE_CAP_MS = 108e5;
/**
* 等一个 prompt 跑完。
* @param client - ComfyUI 客户端。
* @param promptId - 提交返回的 id。
* @param options - 中断信号与轮询间隔。
* @returns 产物或错误。
*/
async function awaitCompletion(client, promptId, options) {
	const interval = options.pollIntervalMs ?? 1500;
	const startedAt = Date.now();
	let lastAliveAt = startedAt;
	for (;;) {
		if (options.signal.aborted) throw new Error("已取消");
		const state = await client.history(promptId);
		if (state.error !== null) return {
			artifacts: [],
			error: state.error
		};
		if (state.found && state.artifacts.length > 0) return {
			artifacts: state.artifacts,
			error: null
		};
		const queue = client.queueState === void 0 ? "absent" : await client.queueState(promptId).catch(() => "absent");
		const now = Date.now();
		if (queue === "running" || queue === "pending" || state.found) lastAliveAt = now;
		if (now - lastAliveAt > LOST_AFTER_MS) return {
			artifacts: [],
			error: "任务在 ComfyUI 里已经消失（既不在队列、也没有产物），已停止等待"
		};
		if (now - startedAt > ABSOLUTE_CAP_MS) return {
			artifacts: [],
			error: "等待超过 3 小时仍未出片，已停止等待"
		};
		await new Promise((resolve) => {
			const timer = setTimeout(resolve, interval);
			options.signal.addEventListener("abort", () => {
				clearTimeout(timer);
				resolve();
			}, { once: true });
		});
	}
}
// lib/types/domain/engine-repo.js
/**
* engine 需要的读写：任务行、片段结果、素材字节、服务与工作流查找。
*
* 这些函数不挂在 `DreamStore` 上，是因为它们只服务调度器；store 保持"业务读写"，
* 调度器的记账放在这里，谁也不往那个已经很大的类里再塞东西。
* @module dsh-dream-studio-host/domain/engine-repo
*/
/**
* 建一条任务行。
* @param store - 数据门面。
* @param projectId - 项目。
* @param input - 任务字段。
* @returns 任务 id。
*/
function createJob(store, projectId, input) {
	const id = crypto.randomUUID();
	store.withProjectDb(projectId, (db) => {
		db.prepare(`INSERT INTO jobs (id, clip_id, kind, slot_key, asset_id, server_id, status, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`).run(id, input.clipId, input.kind, input.slotKey ?? null, input.assetId ?? null, input.serverId, nowIso());
	});
	return id;
}
/**
* 更新一条任务行。
* @param store - 数据门面。
* @param projectId - 项目。
* @param jobId - 任务。
* @param patch - 要改的字段。
*/
function updateJob(store, projectId, jobId, patch) {
	const sets = [];
	const values = [];
	if (patch.status !== void 0) {
		sets.push("status = ?");
		values.push(patch.status);
	}
	if (patch.promptId !== void 0) {
		sets.push("prompt_id = ?");
		values.push(patch.promptId);
	}
	if (patch.error !== void 0) {
		sets.push("error = ?");
		values.push(patch.error);
	}
	if (patch.startedAt !== void 0) {
		sets.push("started_at = ?");
		values.push(patch.startedAt);
	}
	if (patch.finishedAt !== void 0) {
		sets.push("finished_at = ?");
		values.push(patch.finishedAt);
	}
	if (patch.generationMs !== void 0) {
		sets.push("generation_ms = ?");
		values.push(patch.generationMs);
	}
	if (sets.length === 0) return;
	try {
		store.withProjectDb(projectId, (db) => {
			db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values, jobId);
		});
	} catch {}
}
/**
* 列一个剧集的任务。
* @param store - 数据门面。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @returns 任务列表。
*/
function listJobs(store, projectId, episodeId) {
	return store.withProjectDb(projectId, (db) => {
		return db.prepare(`SELECT j.* FROM jobs j JOIN clips c ON c.id = j.clip_id
         WHERE c.episode_id = ? ORDER BY j.queued_at DESC LIMIT 200`).all(episodeId).map((row) => ({
			id: String(row["id"]),
			clipId: String(row["clip_id"]),
			kind: String(row["kind"] ?? "clip"),
			slotKey: row["slot_key"] ?? null,
			assetId: row["asset_id"] ?? null,
			serverId: String(row["server_id"]),
			promptId: row["prompt_id"] ?? null,
			status: String(row["status"] ?? "queued"),
			error: row["error"] ?? null,
			queuedAt: String(row["queued_at"]),
			startedAt: row["started_at"] ?? null,
			finishedAt: row["finished_at"] ?? null,
			queuePosition: null,
			progress: null,
			note: null,
			generationMs: row["generation_ms"] ?? null
		}));
	});
}
/**
* 改片段状态。
* @param store - 数据门面。
* @param projectId - 项目。
* @param clipId - 片段。
* @param status - 新状态。
* @param error - 失败原因。
*/
function setClipStatus(store, projectId, clipId, status, error = null) {
	store.withProjectDb(projectId, (db) => {
		db.prepare("UPDATE clips SET status = ?, error_message = ?, updated_at = ? WHERE id = ?").run(status, error, nowIso(), clipId);
	});
}
/**
* 记一条片段的成片。
* @param store - 数据门面。
* @param projectId - 项目。
* @param clipId - 片段。
* @param path - 成片绝对路径。
* @param generationMs - 本次渲染耗时。
* @param options - `secondPass` 为真时记下"这段已经独立二采放大过"（右栏按钮显绿）。
*/
function setClipResult(store, projectId, clipId, path, generationMs, options = {}) {
	store.withProjectDb(projectId, (db) => {
		const at = nowIso();
		if (options.secondPass === true) {
			db.prepare("UPDATE clips SET result_video_path = ?, second_pass_at = ?, status = 'success', error_message = NULL, generation_ms = ?, updated_at = ? WHERE id = ?").run(path, at, generationMs, at, clipId);
			return;
		}
		db.prepare("UPDATE clips SET result_video_path = ?, status = 'success', error_message = NULL, generation_ms = ?, updated_at = ? WHERE id = ?").run(path, generationMs, at, clipId);
	});
}
/**
* 读一份素材的字节。
* @param store - 数据门面。
* @param projectId - 项目。
* @param assetId - 素材。
* @returns 字节、mime 与显示名。
*/
function assetBytes(store, projectId, assetId) {
	const found = store.assetPath(projectId, assetId);
	if (!existsSync(found.path)) throw new Error(`素材「${found.asset.name}」的文件不在磁盘上（可能被清理过）。请重新选一张，或从项目库重新入库后再生成。`);
	return {
		bytes: new Uint8Array(readFileSync(found.path)),
		mime: found.asset.mime,
		name: found.asset.name
	};
}
/**
* 给一次产物分配落盘路径。
* @param store - 数据门面。
* @param projectId - 项目。
* @param clipId - 片段（用于文件名）。
* @returns 绝对路径。
*/
function outputPath(store, projectId, clipId) {
	const dir = join(store.projectDir(projectId), ASSET_FOLDER);
	mkdirSync(dir, {
		recursive: true,
		mode: 448
	});
	return join(dir, `${clipId}-${String(Date.now())}.mp4`);
}
/**
* 写一份产物。
* @param path - 目标路径。
* @param bytes - 字节。
*/
function writeOutput(path, bytes) {
	writeFileSync(path, bytes);
}
/**
* 列已配置的 ComfyUI 服务。
* @param store - 数据门面。
* @returns 服务列表。
*/
function listServers$1(store) {
	return store.withCatalogDb((db) => {
		return db.prepare("SELECT * FROM servers ORDER BY is_default DESC, created_at").all().map((row) => ({
			id: String(row["id"]),
			name: String(row["name"]),
			baseUrl: String(row["base_url"]),
			type: String(row["type"] ?? "local"),
			isDefault: Number(row["is_default"] ?? 0) === 1,
			available: false,
			caps: null,
			createdAt: String(row["created_at"])
		}));
	});
}
/**
* 取一个服务。
* @param store - 数据门面。
* @param serverId - 服务 id。
* @returns 服务，找不到为 null。
*/
function serverById(store, serverId) {
	return listServers$1(store).find((server) => server.id === serverId) ?? null;
}
/**
* 取默认服务。
* @param store - 数据门面。
* @returns 默认服务，没有为 null。
*/
function defaultServer(store) {
	const servers = listServers$1(store);
	return servers.find((server) => server.isDefault) ?? servers[0] ?? null;
}
/**
* 列目录里的自定义工作流。
* @param store - 数据门面。
* @returns 工作流列表。
*/
function listWorkflows$1(store) {
	return store.withCatalogDb((db) => {
		return db.prepare("SELECT * FROM workflows ORDER BY name").all().map((row) => ({
			id: String(row["id"]),
			name: String(row["name"]),
			family: String(row["family"] ?? "film"),
			modes: JSON.parse(String(row["modes"] ?? "[]")),
			kind: String(row["kind"] ?? "other"),
			profileId: String(row["profile_id"] ?? "minimax_h3"),
			graph: JSON.parse(String(row["graph"] ?? "{}")),
			paramMap: JSON.parse(String(row["param_map"] ?? "{}")),
			customized: Number(row["customized"] ?? 0) === 1,
			builtin: Number(row["builtin"] ?? 0) === 1,
			createdAt: String(row["created_at"]),
			updatedAt: String(row["updated_at"])
		}));
	});
}
/**
* 取一个工作流。
* @param store - 数据门面。
* @param workflowId - 工作流 id。
* @returns 工作流，找不到为 null。
*/
function workflowById(store, workflowId) {
	return listWorkflows$1(store).find((workflow) => workflow.id === workflowId) ?? null;
}
// lib/types/engine/scheduler.js
/**
* 生成调度器：队列、串并行、提交、轮询、取消、成片落库。
*
* 一采的流程与旧 `engine.ts` 一致：解析服务 → 上传条件图 → 编译图 → 提交 →
* 轮询 history → 下载产物 → 写盘 → 更新片段。差别只有三处：
* 1. 任务记账走 `domain/engine-repo.ts`，不进 store；
* 2. 工作流优先取片段绑定的自定义模板，否则用内置的链式续写；
* 3. 并发有上限（旧实现按模式分两路，不限并行数，容易把 ComfyUI 打崩）。
* @module dsh-dream-studio-host/engine/scheduler
*/
/** 并行模式下的默认并发。 */
const DEFAULT_CONCURRENCY = 4;
/**
* 把 ComfyUI 的报错翻成中文。
* @param message - 原始文本。
* @returns 可读原因。
*/
function explainComfyError(message) {
	const text = message.toLowerCase();
	if (text.includes("prompt_outputs_failed_validation")) return "ComfyUI 校验失败：节点参数不匹配（多半是工作流与当前模型版本不一致）";
	if (text.includes("latent") && (text.includes("missing") || text.includes("not found") || text.includes("exist"))) return "找不到一采留下的 latent 存档：这段可能没跑过一采，或换过工作流。先生成一采，再点独立二采。";
	if (text.includes("cuda") && text.includes("out of memory")) return "ComfyUI 显存不足，请降低分辨率或关闭二采后重试";
	if (text.includes("read_file_slice") || text.includes("hostbuffer") || text.includes("errno 1450") || text.includes("error=1450")) return "ComfyUI 加载模型时内存/显存不够（模型预取失败）。插件已尝试自动卸载旧模型；仍失败请重启 ComfyUI，或依次单独跑放大/补帧，别让两套模型同时占显存。";
	if (text.includes("missing") && text.includes("model")) return "ComfyUI 缺少模型文件，请在设置里跑一次工作流体检";
	if (text.includes("connection") || text.includes("fetch failed")) return "连不上 ComfyUI，请确认服务已启动";
	if (text.includes("interrupted")) return "任务被中断";
	return message;
}
/** 调度器。 */
/** 目录名安全化：去掉路径分隔符与控制字符。 */
function safeSegment(value) {
	return value.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_").trim() || "_";
}
/**
* 从 safetensors 头部算出一段 H3 latent 覆盖多少帧。
*
* 视频 latent 的 token 数满足 `5k+2`，每个 token 覆盖 17/5 帧再补 5 帧，所以
* `tokens = 72` 就是 243 帧（10.125 秒 @24fps）。二采的成片长度由它载入的 latent
* 决定，提交前先算一下，避免又出一段短一截的片子。
* @param head - 文件开头的字节（至少含 8 字节头长与 JSON 头）。
* @returns 帧数，读不出来时 null。
*/
function latentFramesOf(head) {
	if (head.byteLength < 9) return null;
	const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
	const length = Number(view.getBigUint64(0, true));
	if (!Number.isFinite(length) || length <= 0 || length > head.byteLength - 8) return null;
	try {
		const tokens = JSON.parse(new TextDecoder().decode(head.subarray(8, 8 + length)))["video"]?.shape?.[2];
		if (typeof tokens !== "number") return null;
		const blocks = (tokens - 2) / 5;
		if (!Number.isInteger(blocks) || blocks < 0) return null;
		return blocks * 17 + 5;
	} catch {
		return null;
	}
}
/**
* 一采 latent 存档的键：目录（`项目/剧集`）与文件名。
*
* 一采的 Save 节点写这个键，独立二采的 Load 节点读同一个键。两边都从
* 「项目名 / 剧集名 / 片段序号」算，所以只要片段还在原位就不会错位。
* @param projectName - 项目名。
* @param episodeName - 剧集名。
* @param clipIndex - 片段在本集的序号（0 起）。
* @returns 目录与文件名。
*/
function latentArchive(projectName, episodeName, clipIndex) {
	const index = clipIndex < 0 ? 0 : clipIndex;
	return {
		folder: `${safeSegment(projectName)}/${safeSegment(episodeName)}`,
		file: `latent_${String(index + 1).padStart(5, "0")}.safetensors`
	};
}
var Engine = class {
	store;
	options;
	clients = /* @__PURE__ */ new Map();
	queue = [];
	running = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	progress = /* @__PURE__ */ new Map();
	/** 每个任务收到过多少条 websocket 事件（诊断用）。 */
	wsSeen = /* @__PURE__ */ new Map();
	pictures = /* @__PURE__ */ new Map();
	pollIntervalMs;
	concurrency;
	lastOutcome = null;
	outcomeTick = 0;
	disposed = false;
	/**
	* @param options - 存储、调度模式、模板与轮询参数。
	*/
	constructor(options) {
		this.options = options;
		this.store = options.store;
		this.pollIntervalMs = options.pollIntervalMs ?? 1500;
		this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
	}
	/**
	* 订阅任务变化。
	* @param listener - 接收事件的回调。
	* @returns 取消订阅。
	*/
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	/** 当前占用。 */
	snapshot() {
		return {
			running: [...this.running.values()].map((entry) => ({
				jobId: entry.jobId,
				clipId: entry.clipId,
				kind: entry.kind ?? "clip",
				progress: this.progress.get(entry.jobId)?.value ?? null,
				note: this.progress.get(entry.jobId)?.note ?? null
			})),
			queued: this.queue.map((entry, index) => ({
				jobId: entry.jobId,
				clipId: entry.clipId,
				position: index + 1
			})),
			lastOutcome: this.lastOutcome,
			outcomeTick: this.outcomeTick
		};
	}
	/**
	* 取一个服务的客户端（首次使用时建）。
	* @param serverId - 服务 id。
	* @returns 客户端。
	*/
	comfy(serverId) {
		const existing = this.clients.get(serverId);
		if (existing !== void 0) return existing;
		const server = serverById(this.store, serverId);
		if (server === null) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		const created = this.options.createClient === void 0 ? new ComfyClient({
			baseUrl: server.baseUrl,
			clientId: `dream-studio-${serverId.slice(0, 8)}`
		}) : this.options.createClient(serverId, server.baseUrl);
		this.clients.set(serverId, created);
		return created;
	}
	/** 服务配置变了：丢掉缓存。 */
	invalidate(serverId) {
		this.clients.get(serverId)?.invalidate();
		this.clients.delete(serverId);
	}
	/** 发一个事件。 */
	emit(event) {
		for (const listener of this.listeners) listener(event);
	}
	/**
	* 把一条片段排队。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param clipId - 片段。
	* @param serverId - 指定服务，缺省用默认。
	* @returns 任务 id。
	*/
	enqueue(projectId, episodeId, clipId, serverId) {
		if (this.disposed) throw new Error("调度器已释放");
		const resolved = serverId ?? this.store.payload(projectId, episodeId).episodes.find((entry) => entry.id === episodeId)?.serverId ?? defaultServer(this.store)?.id;
		if (resolved === null || resolved === void 0) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		if (this.store.payload(projectId, episodeId).clips.find((entry) => entry.id === clipId) === void 0) throw new Error("片段不存在");
		const busy = [...this.queue, ...[...this.running.values()]].find((entry) => entry.clipId === clipId && !entry.secondPass);
		if (busy !== void 0) return busy.jobId;
		const jobId = createJob(this.store, projectId, {
			clipId,
			kind: "clip",
			serverId: resolved
		});
		setClipStatus(this.store, projectId, clipId, "queued");
		this.queue.push({
			jobId,
			projectId,
			episodeId,
			clipId,
			serverId: resolved,
			secondPass: false
		});
		this.emit({
			jobId,
			clipId,
			kind: "clip",
			slotKey: null,
			assetId: null,
			status: "queued",
			progress: null,
			note: null,
			error: null
		});
		this.pump();
		return jobId;
	}
	/**
	* 排一次「独立二采」。
	*
	* 不画一采：读一采留下的 latent，按二采模板重绘放大成高清成片。放大倍率、
	* 重绘幅度、二采步数都取片段自己存的值（就是右栏那三个输入框），所以确认
	* 低分辨率样片可用后，不用再改任何参数就能放大。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param clipId - 片段。
	* @param serverId - 指定服务，缺省用默认。
	* @returns 任务 id。
	*/
	enqueueSecondPass(projectId, episodeId, clipId, serverId) {
		if (this.disposed) throw new Error("调度器已释放");
		const resolved = serverId ?? this.store.payload(projectId, episodeId).episodes.find((entry) => entry.id === episodeId)?.serverId ?? defaultServer(this.store)?.id;
		if (resolved === null || resolved === void 0) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		const clip = this.store.payload(projectId, episodeId).clips.find((entry) => entry.id === clipId);
		if (clip === void 0) throw new Error("片段不存在");
		if (clip.mode === "frames") throw new Error("不支持首尾帧模式，推荐使用全能参考+关键帧模式");
		if (clip.resultVideoPath === null) throw new Error("这段还没有一采成片，先生成一采再独立二采");
		if (this.store.listClipVideos(projectId, clipId).some((video) => video.kind === "second")) throw new Error("这段已经有独立二采视频了，先到成片历史里删除那条记录再生成");
		if (secondPassTemplate(this.options.templates) === null) throw new Error("内置工作流里找不到「时空造梦-独立二采」，请重新安装插件");
		const busy = [...this.queue, ...[...this.running.values()]].find((entry) => entry.clipId === clipId);
		if (busy !== void 0) return busy.jobId;
		const jobId = createJob(this.store, projectId, {
			clipId,
			kind: "clip",
			serverId: resolved
		});
		setClipStatus(this.store, projectId, clipId, "queued");
		this.queue.push({
			jobId,
			projectId,
			episodeId,
			clipId,
			serverId: resolved,
			secondPass: false,
			upscale: true
		});
		this.emit({
			jobId,
			clipId,
			kind: "clip",
			slotKey: null,
			assetId: null,
			status: "queued",
			progress: null,
			note: null,
			error: null
		});
		this.pump();
		return jobId;
	}
	/**
	* 排一次「视频放大」：读本段成片，用 RelayVSR 模板放大到 2K / 4K。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param clipId - 片段。
	* @param level - `2k` / `4k`。
	* @param serverId - 指定服务，缺省用默认。
	* @returns 任务 id。
	*/
	enqueueVideoUpscale(projectId, episodeId, clipId, level, serverId) {
		return this.enqueuePost(projectId, episodeId, clipId, {
			kind: "video-upscale",
			level
		}, serverId);
	}
	/**
	* 排一次「视频补帧」：读本段成片，用 FrameInterpolate 模板每秒补充指定帧数。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param clipId - 片段。
	* @param multiplier - 每秒补充的帧数（默认 10）。
	* @param serverId - 指定服务，缺省用默认。
	* @returns 任务 id。
	*/
	enqueueVideoInterpolate(projectId, episodeId, clipId, multiplier, serverId) {
		const factor = Number.isFinite(multiplier) ? Math.min(16, Math.max(2, Math.trunc(multiplier))) : 10;
		return this.enqueuePost(projectId, episodeId, clipId, {
			kind: "video-interpolate",
			multiplier: factor
		}, serverId);
	}
	/** 视频后处理入队的共用部分。 */
	enqueuePost(projectId, episodeId, clipId, post, serverId) {
		if (this.disposed) throw new Error("调度器已释放");
		const resolved = serverId ?? this.store.payload(projectId, episodeId).episodes.find((entry) => entry.id === episodeId)?.serverId ?? defaultServer(this.store)?.id;
		if (resolved === null || resolved === void 0) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		const clip = this.store.payload(projectId, episodeId).clips.find((entry) => entry.id === clipId);
		if (clip === void 0) throw new Error("片段不存在");
		if (clip.resultVideoPath === null) throw new Error("这段还没有成片，先生成视频再做后处理");
		const existingKind = post.kind === "video-upscale" ? "upscale" : "interp";
		if (this.store.listClipVideos(projectId, clipId).some((video) => video.kind === existingKind)) throw new Error(`这段已经有${post.kind === "video-upscale" ? "视频放大" : "视频补帧"}视频了，先到成片历史里删除那条记录再生成`);
		if ((post.kind === "video-upscale" ? videoUpscaleTemplate(this.options.templates, post.level) : videoInterpolationTemplate(this.options.templates)) === null) throw new Error("内置工作流里找不到视频放大 / 补帧模板，请重新安装插件");
		const busy = [...this.queue, ...[...this.running.values()]].find((entry) => entry.clipId === clipId);
		if (busy !== void 0) return busy.jobId;
		const jobId = createJob(this.store, projectId, {
			clipId,
			kind: "clip",
			serverId: resolved
		});
		setClipStatus(this.store, projectId, clipId, "queued");
		this.queue.push({
			jobId,
			projectId,
			episodeId,
			clipId,
			serverId: resolved,
			secondPass: false,
			post
		});
		this.emit({
			jobId,
			clipId,
			kind: "clip",
			slotKey: null,
			assetId: null,
			status: "queued",
			progress: null,
			note: null,
			error: null
		});
		this.pump();
		return jobId;
	}
	/**
	* 排一张资产图。
	* @param projectId - 项目。
	* @param assetId - 目标素材。
	* @param input - 提示词、画布、切块与参考图。
	* @param serverId - 指定服务。
	* @returns 任务 id。
	*/
	enqueuePicture(projectId, assetId, input, serverId) {
		if (this.disposed) throw new Error("调度器已释放");
		if (input.prompt.trim() === "") throw new Error("请先填写提示词");
		const resolved = serverId ?? defaultServer(this.store)?.id;
		if (resolved === null || resolved === void 0) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		const jobId = createJob(this.store, projectId, {
			clipId: "",
			kind: "picture",
			serverId: resolved,
			assetId
		});
		this.pictures.set(jobId, {
			prompt: input.prompt,
			seed: input.seed ?? Math.floor(Math.random() * 2 ** 31),
			tile: input.tile === true,
			tileX: input.tileX ?? null,
			tileY: input.tileY ?? null,
			cfg: input.cfg ?? null,
			steps: input.steps ?? null,
			reference: input.reference === true,
			ratio: input.ratio ?? "16:9",
			shortSide: input.shortSide ?? 1080,
			refAssetIds: input.refAssetIds ?? [],
			draftClipId: input.draftClipId ?? null
		});
		this.queue.push({
			jobId,
			projectId,
			episodeId: input.episodeId ?? "",
			clipId: "",
			serverId: resolved,
			secondPass: false,
			kind: "picture",
			assetId
		});
		this.emit({
			jobId,
			clipId: "",
			kind: "picture",
			slotKey: null,
			assetId,
			status: "queued",
			progress: null,
			note: null,
			error: null
		});
		this.pump();
		return jobId;
	}
	/**
	* 给一个片段画草稿图（不写素材库，产物挂在片段上，确认后再入库）。
	* @param projectId - 项目。
	* @param clipId - 片段。
	* @param input - 提示词、画布与参考图。
	* @param serverId - 指定服务。
	* @returns 任务 id。
	*/
	enqueueClipPicture(projectId, clipId, input, serverId) {
		if (this.disposed) throw new Error("调度器已释放");
		if (input.prompt.trim() === "") throw new Error("请先填写提示词");
		const resolved = serverId ?? defaultServer(this.store)?.id;
		if (resolved === null || resolved === void 0) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		const jobId = createJob(this.store, projectId, {
			clipId,
			kind: "picture",
			serverId: resolved,
			assetId: null
		});
		this.pictures.set(jobId, {
			prompt: input.prompt,
			seed: input.seed ?? Math.floor(Math.random() * 2 ** 31),
			tile: input.tile === true,
			tileX: input.tileX ?? null,
			tileY: input.tileY ?? null,
			cfg: input.cfg ?? null,
			steps: input.steps ?? null,
			reference: input.reference === true,
			ratio: input.ratio ?? "16:9",
			shortSide: input.shortSide ?? 1080,
			refAssetIds: input.refAssetIds ?? [],
			draftClipId: clipId
		});
		this.queue.push({
			jobId,
			projectId,
			episodeId: input.episodeId ?? "",
			clipId,
			serverId: resolved,
			secondPass: false,
			kind: "picture",
			assetId: null
		});
		this.emit({
			jobId,
			clipId,
			kind: "picture",
			slotKey: null,
			assetId: null,
			status: "queued",
			progress: null,
			note: null,
			error: null
		});
		this.pump();
		return jobId;
	}
	/**
	* 排一张剧集草稿图（本集人物图 / 场景图）。
	*
	* 与片段草稿同一条出图链路，只是产物挂在剧集上：入库仍由人审后点「应用为素材」。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param input - 提示词、画布与参考图。
	* @param serverId - 指定服务。
	* @returns 任务 id。
	*/
	enqueueEpisodePicture(projectId, episodeId, input, serverId) {
		if (this.disposed) throw new Error("调度器已释放");
		if (input.prompt.trim() === "") throw new Error("请先填写提示词");
		const resolved = serverId ?? defaultServer(this.store)?.id;
		if (resolved === null || resolved === void 0) throw new Error("尚未配置 ComfyUI 服务，请先在设置里添加");
		const jobId = createJob(this.store, projectId, {
			clipId: "",
			kind: "picture",
			serverId: resolved,
			assetId: null
		});
		this.pictures.set(jobId, {
			prompt: input.prompt,
			seed: input.seed ?? Math.floor(Math.random() * 2 ** 31),
			tile: input.tile === true,
			tileX: input.tileX ?? null,
			tileY: input.tileY ?? null,
			cfg: input.cfg ?? null,
			steps: input.steps ?? null,
			reference: input.reference === true,
			ratio: input.ratio ?? "16:9",
			shortSide: input.shortSide ?? 1080,
			refAssetIds: input.refAssetIds ?? [],
			draftClipId: null,
			draftEpisodeId: episodeId
		});
		this.queue.push({
			jobId,
			projectId,
			episodeId,
			clipId: "",
			serverId: resolved,
			secondPass: false,
			kind: "picture",
			assetId: null
		});
		this.emit({
			jobId,
			clipId: "",
			kind: "picture",
			slotKey: null,
			assetId: null,
			status: "queued",
			progress: null,
			note: null,
			error: null
		});
		this.pump();
		return jobId;
	}
	/**
	* 把一集里没出片的片段全部排队。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param includeDone - 是否连已出片的一起重跑。
	* @param serverId - 指定服务。
	* @returns 任务 id 列表。
	*/
	enqueueAll(projectId, episodeId, includeDone = false, serverId) {
		const payload = this.store.payload(projectId, episodeId);
		const busy = /* @__PURE__ */ new Set([...this.queue.map((entry) => entry.clipId), ...[...this.running.values()].map((entry) => entry.clipId)]);
		const targets = payload.clips.filter((clip) => !busy.has(clip.id) && (includeDone || clip.status !== "success"));
		if (targets.length === 0) throw new Error("没有需要生成的片段");
		return targets.map((clip) => this.enqueue(projectId, episodeId, clip.id, serverId));
	}
	/**
	* 取消一条任务。
	* @param projectId - 项目。
	* @param jobId - 任务。
	*/
	async cancel(projectId, jobId) {
		const waiting = this.queue.findIndex((entry) => entry.jobId === jobId);
		if (waiting !== -1) {
			const [entry] = this.queue.splice(waiting, 1);
			if (entry !== void 0) {
				updateJob(this.store, projectId, jobId, {
					status: "cancelled",
					finishedAt: (/* @__PURE__ */ new Date()).toISOString()
				});
				if (entry.kind !== "picture") setClipStatus(this.store, projectId, entry.clipId, "cancelled");
				this.emit({
					jobId,
					clipId: entry.clipId,
					kind: entry.kind ?? "clip",
					slotKey: null,
					assetId: null,
					status: "cancelled",
					progress: null,
					note: null,
					error: null
				});
				await this.cancelDependents(projectId, entry.episodeId, entry.clipId);
			}
			return;
		}
		const active = this.running.get(jobId);
		if (active === void 0) throw new Error("任务不在运行或等待中");
		active.controller.abort();
		try {
			await this.comfy(active.serverId).interrupt();
		} catch {
			this.store.log("ComfyUI", "中断请求失败（任务可能已结束）");
		}
		this.finish(active, "cancelled", null);
		if (!active.secondPass) await this.cancelDependents(projectId, active.episodeId, active.clipId);
	}
	/**
	* 取消依赖某片段的等待任务（续写要读它的成片）。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	* @param clipId - 被取消的片段。
	*/
	async cancelDependents(projectId, episodeId, clipId) {
		const payload = this.store.payload(projectId, episodeId);
		const gone = /* @__PURE__ */ new Set();
		const order = payload.clips.find((clip) => clip.id === clipId)?.order;
		if (order === void 0) return;
		gone.add(order);
		for (const clip of payload.clips) {
			const prior = payload.clips.find((entry) => entry.order === clip.order - 1);
			if (prior === void 0 || !gone.has(prior.order)) continue;
			if (!clip.continueFromPrev && !clip.firstFrameFromPrev) continue;
			gone.add(clip.order);
			const waiting = this.queue.find((entry) => entry.clipId === clip.id);
			if (waiting === void 0) continue;
			try {
				await this.cancel(projectId, waiting.jobId);
			} catch {}
		}
	}
	/**
	* 取消一集里所有等待与运行的任务。
	* @param projectId - 项目。
	* @param episodeId - 剧集。
	*/
	async cancelAll(projectId, episodeId) {
		const pending = [...this.queue.filter((entry) => entry.projectId === projectId && entry.episodeId === episodeId).map((entry) => entry.jobId), ...[...this.running.values()].filter((entry) => entry.projectId === projectId && entry.episodeId === episodeId).map((entry) => entry.jobId)];
		for (const jobId of pending) try {
			await this.cancel(projectId, jobId);
		} catch {}
	}
	/** 取消全部任务（退出前）。 */
	async cancelEvery() {
		const pending = [...this.queue.map((entry) => ({
			projectId: entry.projectId,
			jobId: entry.jobId
		})), ...[...this.running.values()].map((entry) => ({
			projectId: entry.projectId,
			jobId: entry.jobId
		}))];
		for (const job of pending) try {
			await this.cancel(job.projectId, job.jobId);
		} catch {}
	}
	/** 按调度模式启动任务。 */
	pump() {
		if (this.disposed) return;
		const limit = this.options.dispatchMode() === "parallel" ? this.concurrency : 1;
		while (this.running.size < limit && this.queue.length > 0) {
			const entry = this.queue.shift();
			if (entry === void 0) break;
			this.run(entry);
		}
	}
	/**
	* 跑一条任务。
	* @param entry - 队列项。
	*/
	async run(entry) {
		const controller = new AbortController();
		const active = {
			...entry,
			startedAt: Date.now(),
			controller,
			promptId: null,
			unsubscribe: null
		};
		this.running.set(entry.jobId, active);
		updateJob(this.store, entry.projectId, entry.jobId, {
			status: "running",
			startedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (entry.kind !== "picture") setClipStatus(this.store, entry.projectId, entry.clipId, "running");
		this.emit({
			jobId: entry.jobId,
			clipId: entry.clipId,
			kind: entry.kind ?? "clip",
			slotKey: null,
			assetId: null,
			status: "running",
			progress: 0,
			note: "准备中",
			error: null
		});
		try {
			if (active.kind === "picture") await this.renderPicture(active);
			else if (active.post !== void 0) await this.renderPostProcess(active);
			else if (active.upscale === true) await this.renderSecondPass(active);
			else await this.render(active);
			this.finish(active, "success", null);
		} catch (error) {
			const raw = error instanceof Error ? error.message : String(error);
			if (this.disposed || controller.signal.aborted) this.finish(active, "cancelled", null);
			else this.finish(active, "failed", explainComfyError(raw));
		} finally {
			active.unsubscribe?.();
			this.running.delete(entry.jobId);
			this.progress.delete(entry.jobId);
			this.pump();
		}
	}
	/**
	* 一条任务的实际渲染。
	* @param active - 运行中任务。
	*/
	async render(active) {
		const payload = this.store.payload(active.projectId, active.episodeId);
		const clip = payload.clips.find((entry) => entry.id === active.clipId);
		if (clip === void 0) throw new Error("片段已不存在");
		const client = this.comfy(active.serverId);
		const upload = async (assetId) => {
			const file = assetBytes(this.store, active.projectId, assetId);
			return await client.uploadImage(file.bytes, file.name);
		};
		const refImages = [];
		for (const ref of [...clip.refs].filter((entry) => entry.kind === "image").sort((left, right) => left.position - right.position)) {
			if (ref.assetId === null) continue;
			refImages.push(await upload(ref.assetId));
		}
		const firstFrame = clip.firstFrameAssetId === null ? null : await upload(clip.firstFrameAssetId);
		const lastFrame = clip.lastFrameAssetId === null ? null : await upload(clip.lastFrameAssetId);
		const guides = [];
		const clipFps = clip.fps ?? 24;
		for (const slot of clip.slots.filter((entry) => entry.role === "keyframe")) {
			const anchorFrame = slot.atSeconds !== null ? Math.round(slot.atSeconds * clipFps) : slot.frameIndex;
			if (anchorFrame === null) continue;
			if (slot.assetId !== null) {
				const bytes = assetBytes(this.store, active.projectId, slot.assetId).bytes;
				guides.push({
					frameIndex: anchorFrame,
					file: await client.uploadImage(bytes, `${slot.key}.png`)
				});
				continue;
			}
			if (slot.keyframeId === null) continue;
			const bytes = assetBytesRaw(this.store.keyframePath(active.projectId, clip.id, slot.keyframeId));
			if (bytes === null) continue;
			guides.push({
				frameIndex: anchorFrame,
				file: await client.uploadImage(bytes, `${slot.key}.png`)
			});
		}
		const projectRow = this.store.listProjects().find((entry) => entry.id === active.projectId);
		const fallbackRatio = projectRow?.defaultRatio ?? "16:9";
		const fallbackResolution = projectRow?.defaultResolution ?? "1080P";
		const clipIndex = payload.clips.findIndex((entry) => entry.id === clip.id);
		const chain = {
			prefix: `dreamstudio_latent/${latentArchive(this.store.listProjects().find((entry) => entry.id === active.projectId)?.name ?? "project", this.store.listEpisodes(active.projectId).find((entry) => entry.id === active.episodeId)?.name ?? "episode", clipIndex).folder}/latent`,
			index: clipIndex < 0 ? 0 : clipIndex,
			fromPrev: clip.continueFromPrev
		};
		const input = {
			mode: clip.mode,
			prompt: clip.promptEn !== "" ? clip.promptEn : clip.prompt,
			duration: clip.duration,
			fps: clip.fps ?? 24,
			scale: clip.scale ?? .5,
			ratio: clip.ratio ?? fallbackRatio,
			resolution: clip.resolution ?? fallbackResolution,
			seed: clip.seed ?? Math.floor(Math.random() * 2 ** 31),
			steps: clip.firstPassSteps ?? 4,
			guideFrameCount: clip.guideFrameCount,
			firstPassTiled: clip.firstPassTiled,
			secondPassTiled: clip.secondPassTiled,
			chain,
			loras: clip.loras,
			media: {
				firstFrame,
				lastFrame,
				refImages,
				refVideos: [],
				refAudios: [],
				priorFilm: null,
				...guides.length === 0 ? {} : { keyframeGuides: guides }
			},
			secondPass: {
				enabled: clip.secondPass,
				denoise: clip.secondDenoise ?? .35,
				megapixels: Math.max(1, clip.secondScale ?? 1),
				steps: clip.secondSteps ?? 4
			}
		};
		const custom = clip.workflowId === null ? null : workflowById(this.store, clip.workflowId);
		const template = custom === null ? defaultTemplate(this.options.templates, "film") : null;
		if (custom === null && template === null) throw new Error("没有可用的视频工作流");
		const graph = applyTemplateModels(custom === null ? template?.graph : custom.graph, this.store.settings().workflowModels.templates[template?.name ?? custom?.name ?? ""]);
		const paramMap = custom?.paramMap ?? {};
		const prepared = prepareGraph(graph, MINIMAX_H3_PROFILE, paramMap, input, {});
		if (prepared.unbound.length > 0) throw new Error(`工作流参数没绑上：${prepared.unbound.join("、")}`);
		this.store.setClipSubmission(active.projectId, clip.id, {
			mode: clip.mode,
			duration: clip.duration,
			firstFrameAssetId: clip.firstFrameAssetId,
			lastFrameAssetId: clip.lastFrameAssetId,
			keyframeGuides: clip.slots.filter((slot) => slot.role === "keyframe").map((slot) => ({
				key: slot.key,
				at: slot.atSeconds,
				assetId: slot.assetId,
				keyframeId: slot.keyframeId
			})),
			bindings: prepared.bindings
		});
		this.store.log("Engine", `片段 ${clip.seriesKey} 提交 ${String(Object.keys(prepared.graph).length)} 个节点`);
		const promptId = await client.submit(prepared.graph);
		active.promptId = promptId;
		updateJob(this.store, active.projectId, active.jobId, { promptId });
		active.unsubscribe = client.subscribe((event) => {
			this.onProgress(active, event);
		});
		const outcome = await awaitCompletion(client, promptId, {
			signal: active.controller.signal,
			pollIntervalMs: this.pollIntervalMs
		});
		if (active.controller.signal.aborted) throw new Error("已取消");
		if (outcome.error !== null) throw new Error(outcome.error);
		const films = outcome.artifacts.filter(isFilm);
		if (films.length === 0) throw new Error("ComfyUI 没有返回视频文件");
		const chosen = films[0];
		if (chosen === void 0) throw new Error("ComfyUI 没有返回视频文件");
		const bytes = await client.download(chosen);
		const target = outputPath(this.store, active.projectId, clip.id);
		writeOutput(target, bytes);
		setClipResult(this.store, active.projectId, clip.id, target, Date.now() - active.startedAt);
		this.store.addClipVideo(active.projectId, clip.id, {
			path: target,
			kind: "first",
			label: clip.resolution ?? "跟随"
		});
	}
	/**
	* 视频后处理：读本段成片 → 上传给 ComfyUI → 按模板放大 / 补帧 → 落回本段成片。
	* @param active - 运行中任务。
	*/
	async renderPostProcess(active) {
		const post = active.post;
		if (post === void 0) throw new Error("后处理参数缺失");
		const clip = this.store.payload(active.projectId, active.episodeId).clips.find((entry) => entry.id === active.clipId);
		if (clip === void 0) throw new Error("片段已不存在");
		if (clip.resultVideoPath === null) throw new Error("这段还没有成片，先生成视频再做后处理");
		const template = post.kind === "video-upscale" ? videoUpscaleTemplate(this.options.templates, post.level) : videoInterpolationTemplate(this.options.templates);
		if (template === null) throw new Error("内置工作流里找不到视频放大 / 补帧模板，请重新安装插件");
		const client = this.comfy(active.serverId);
		await client.freeMemory?.();
		const source = readFileSync(clip.resultVideoPath);
		const label = clip.seriesKey === "" ? clip.id.slice(0, 8) : clip.seriesKey;
		const uploadName = `${label}-post-${String(Date.now())}.mp4`.replace(/[\\/:*?"<>|]/gu, "_");
		const uploaded = await client.uploadImage(new Uint8Array(source), uploadName);
		const prepared = post.kind === "video-upscale" ? prepareVideoUpscaleGraph(template.graph, uploaded) : prepareVideoInterpolationGraph(template.graph, uploaded, post.multiplier);
		if (prepared.unbound.length > 0) throw new Error(`后处理参数没绑上：${prepared.unbound.join("、")}`);
		this.store.log("Engine", post.kind === "video-upscale" ? `视频放大 ${post.level.toUpperCase()}：片段 ${label}` : `视频补帧 每秒 +${String(post.multiplier)} 帧：片段 ${label}`);
		const promptId = await client.submit(prepared.graph);
		active.promptId = promptId;
		updateJob(this.store, active.projectId, active.jobId, { promptId });
		active.unsubscribe = client.subscribe((event) => {
			this.onProgress(active, event);
		});
		const outcome = await awaitCompletion(client, promptId, {
			signal: active.controller.signal,
			pollIntervalMs: this.pollIntervalMs
		});
		if (active.controller.signal.aborted) throw new Error("已取消");
		if (outcome.error !== null) throw new Error(outcome.error);
		const film = outcome.artifacts.filter(isFilm)[0];
		if (film === void 0) throw new Error("ComfyUI 没有返回视频文件");
		const output = await client.download(film);
		const target = outputPath(this.store, active.projectId, clip.id);
		writeOutput(target, output);
		setClipResult(this.store, active.projectId, clip.id, target, Date.now() - active.startedAt);
		this.store.addClipVideo(active.projectId, clip.id, {
			path: target,
			kind: post.kind === "video-upscale" ? "upscale" : "interp",
			label: post.kind === "video-upscale" ? post.level.toUpperCase() : `+${String(post.multiplier)} 帧/秒`
		});
		await client.freeMemory?.();
	}
	/**
	* 独立二采：读一采留下的 latent，按内置的二采模板重绘放大成高清成片。
	*
	* 提示词、参考图、画幅、时长都按片段现在的值重新绑一次——要的正是"和一采
	* 同一套条件、只换一个大画布重画"。latent 的位置由一采的存档键决定；新的高清
	* 成片另存一个文件并接管这段的成片指针，低分辨率样片仍留在项目素材目录里。
	* @param active - 运行中任务。
	*/
	async renderSecondPass(active) {
		const payload = this.store.payload(active.projectId, active.episodeId);
		const clip = payload.clips.find((entry) => entry.id === active.clipId);
		if (clip === void 0) throw new Error("片段已不存在");
		const template = secondPassTemplate(this.options.templates);
		if (template === null) throw new Error("内置工作流里找不到「时空造梦-独立二采」");
		const client = this.comfy(active.serverId);
		const upload = async (assetId) => {
			const file = assetBytes(this.store, active.projectId, assetId);
			return await client.uploadImage(file.bytes, file.name);
		};
		const refImages = [];
		for (const ref of [...clip.refs].filter((entry) => entry.kind === "image").sort((left, right) => left.position - right.position)) {
			if (ref.assetId === null) continue;
			refImages.push(await upload(ref.assetId));
		}
		const firstFrame = clip.firstFrameAssetId === null ? null : await upload(clip.firstFrameAssetId);
		const lastFrame = clip.lastFrameAssetId === null ? null : await upload(clip.lastFrameAssetId);
		const projectRow = this.store.listProjects().find((entry) => entry.id === active.projectId);
		const fallbackRatio = projectRow?.defaultRatio ?? "16:9";
		const fallbackResolution = projectRow?.defaultResolution ?? "1080P";
		const clipIndex = payload.clips.findIndex((entry) => entry.id === clip.id);
		const archive = latentArchive(projectRow?.name ?? "project", this.store.listEpisodes(active.projectId).find((entry) => entry.id === active.episodeId)?.name ?? "episode", clipIndex);
		const previousClip = clipIndex > 0 ? payload.clips[clipIndex - 1] : void 0;
		const canvasKey = (entry) => [
			entry.resolution ?? fallbackResolution,
			entry.ratio ?? fallbackRatio,
			String(entry.scale ?? .5)
		].join("|");
		const latentDir = `dreamstudio_latent/${archive.folder}`;
		const sameCanvas = previousClip !== void 0 && previousClip.resultVideoPath !== null && canvasKey(previousClip) === canvasKey(clip);
		const chain = {
			prefix: `${latentDir}/latent`,
			index: clipIndex < 0 ? 0 : clipIndex,
			fromPrev: sameCanvas
		};
		const targetFrames = frameLength(clip.duration, clip.fps ?? 24);
		const neededFrames = targetFrames + (chain.fromPrev ? 23 : 0);
		const head = await (client.outputFileHead?.(archive.folder, archive.file) ?? Promise.resolve(null));
		const latentFrames = head === null ? null : latentFramesOf(head);
		if (latentFrames !== null && latentFrames < neededFrames) throw new Error(`这段的一采 latent 只有 ${String(latentFrames)} 帧，二采至少要 ${String(neededFrames)} 帧才能裁掉引导帧后仍保住 ${String(targetFrames)} 帧。这多半是旧版本一采留下的 latent：先重新生成一次一采，再点独立二采。`);
		const input = {
			mode: clip.mode,
			prompt: clip.promptEn !== "" ? clip.promptEn : clip.prompt,
			duration: clip.duration,
			fps: clip.fps ?? 24,
			scale: clip.scale ?? .5,
			ratio: clip.ratio ?? fallbackRatio,
			resolution: clip.resolution ?? fallbackResolution,
			seed: clip.seed ?? Math.floor(Math.random() * 2 ** 31),
			denoise: clip.secondDenoise ?? .35,
			steps: clip.secondSteps ?? 4,
			megapixels: Math.max(1, clip.secondScale ?? 1),
			archive,
			chain,
			media: {
				firstFrame,
				lastFrame,
				refImages,
				refVideos: [],
				refAudios: [],
				priorFilm: null
			}
		};
		const prepared = prepareSecondPassGraph(applyTemplateModels(template.graph, this.store.settings().workflowModels.templates[template.name]), input);
		if (prepared.unbound.length > 0) throw new Error(`独立二采参数没绑上：${prepared.unbound.join("、")}`);
		this.store.setClipSubmission(active.projectId, clip.id, {
			mode: clip.mode,
			duration: clip.duration,
			secondPass: true,
			latent: archive,
			bindings: prepared.bindings
		});
		this.store.log("Engine", `片段 ${clip.seriesKey} 独立二采：读 ${archive.folder}/${archive.file} → ${String(input.megapixels)} MP，${String(input.steps)} 步 / denoise ${String(input.denoise)}${chain.fromPrev ? "，续接上一段成片的最后 22 帧（裁掉引导帧）" : ""}`);
		const promptId = await client.submit(prepared.graph);
		active.promptId = promptId;
		updateJob(this.store, active.projectId, active.jobId, { promptId });
		active.unsubscribe = client.subscribe((event) => {
			this.onProgress(active, event);
		});
		const outcome = await awaitCompletion(client, promptId, {
			signal: active.controller.signal,
			pollIntervalMs: this.pollIntervalMs
		});
		if (active.controller.signal.aborted) throw new Error("已取消");
		if (outcome.error !== null) throw new Error(outcome.error);
		const chosen = outcome.artifacts.filter(isFilm)[0];
		if (chosen === void 0) throw new Error("ComfyUI 没有返回视频文件");
		const bytes = await client.download(chosen);
		const target = outputPath(this.store, active.projectId, clip.id);
		writeOutput(target, bytes);
		setClipResult(this.store, active.projectId, clip.id, target, Date.now() - active.startedAt, { secondPass: true });
		this.store.addClipVideo(active.projectId, clip.id, {
			path: target,
			kind: "second",
			label: `${String(Math.max(1, clip.secondScale ?? 1))} MP`
		});
	}
	/**
	* 画一张资产图：选图片模板 → 编译 → 提交 → 落成资产图版本。
	* @param active - 运行中任务。
	*/
	async renderPicture(active) {
		const assetId = active.assetId ?? null;
		const input = this.pictures.get(active.jobId);
		if (input === void 0) throw new Error("图片任务缺少参数");
		if (assetId === null && input.draftClipId === null && (input.draftEpisodeId ?? null) === null) throw new Error("图片任务缺少目标");
		const client = this.comfy(active.serverId);
		const files = [];
		for (const refAssetId of input.refAssetIds) {
			const bytes = assetBytes(this.store, active.projectId, refAssetId).bytes;
			files.push(await client.uploadImage(bytes, `${refAssetId}.png`));
		}
		const template = defaultTemplate(this.options.templates, "picture", input.reference ? "i2i" : "t2i");
		if (template === null) throw new Error("没有可用的图片工作流");
		const canvas = resolutionForShortSide(input.shortSide, input.ratio);
		const prepared = prepareKeyframeGraph(applyTemplateModels(template.graph, this.store.settings().workflowModels.templates[template.name]), {}, {
			prompt: input.prompt,
			seed: input.seed,
			width: canvas.width,
			height: canvas.height,
			character: files[0] ?? null,
			scene: files[1] ?? null,
			previous: null,
			extras: files.slice(2),
			...input.tile ? { tile: true } : {},
			...input.cfg === null ? {} : { cfg: input.cfg },
			...input.steps === null ? {} : { steps: input.steps },
			...input.tileX === null ? {} : { tileX: input.tileX },
			...input.tileY === null ? {} : { tileY: input.tileY }
		}, {});
		for (const note of prepared.notes) this.store.log("ComfyUI", note);
		if (prepared.unbound.length > 0) throw new Error(`图片工作流参数没绑上：${prepared.unbound.join("、")}`);
		const promptId = await client.submit(prepared.graph);
		active.promptId = promptId;
		updateJob(this.store, active.projectId, active.jobId, { promptId });
		active.unsubscribe = client.subscribe((event) => {
			this.onProgress(active, event);
		});
		const outcome = await awaitCompletion(client, promptId, {
			signal: active.controller.signal,
			pollIntervalMs: this.pollIntervalMs
		});
		if (active.controller.signal.aborted) throw new Error("已取消");
		if (outcome.error !== null) throw new Error(outcome.error);
		const pictures = outcome.artifacts.filter((artifact) => /\.(?:png|jpe?g|webp)$/iu.test(artifact.filename));
		if (pictures.length === 0) throw new Error("ComfyUI 没有返回图片");
		if (input.draftClipId !== null) {
			for (const picture of pictures) {
				const bytes = await client.download(picture);
				this.store.addClipDraft(active.projectId, input.draftClipId, {
					bytes,
					prompt: input.prompt,
					workflowId: template.name,
					seed: input.seed
				});
			}
			this.store.log("Engine", `片段草稿图完成：${String(pictures.length)} 张（${template.name}）`);
			return;
		}
		const episodeDraftId = input.draftEpisodeId ?? null;
		if (episodeDraftId !== null) {
			for (const picture of pictures) {
				const bytes = await client.download(picture);
				this.store.addEpisodeDraft(active.projectId, episodeDraftId, {
					bytes,
					prompt: input.prompt,
					workflowId: template.name,
					seed: input.seed
				});
			}
			this.store.log("Engine", `剧集草稿图完成：${String(pictures.length)} 张（${template.name}）`);
			return;
		}
		const target = assetId ?? "";
		const before = listAssetImages(this.store, active.projectId, target);
		for (const picture of pictures) {
			const bytes = await client.download(picture);
			addAssetImage(this.store, active.projectId, target, {
				bytes,
				prompt: input.prompt,
				workflowId: template.name,
				seed: input.seed,
				...active.episodeId === "" ? {} : { episodeId: active.episodeId }
			});
		}
		if (!before.some((image) => image.active)) {
			const created = listAssetImages(this.store, active.projectId, target)[0];
			if (created !== void 0) applyAssetImage(this.store, active.projectId, target, created.id);
		}
		this.store.log("Engine", `资产图完成：${String(pictures.length)} 张（${template.name}）`);
	}
	/**
	* 处理一次进度回调。
	* @param active - 运行中任务。
	* @param event - 进度事件。
	*/
	onProgress(active, event) {
		if (active.controller.signal.aborted) return;
		const maximum = event.maximum;
		const value = event.value;
		const seen = (this.wsSeen.get(active.jobId) ?? 0) + 1;
		this.wsSeen.set(active.jobId, seen);
		if (seen <= 10) this.store.log("ComfyUI", `ws#${String(seen)} ${event.kind} ${String(value)}/${String(maximum)} node=${event.node ?? "-"}`);
		if (value === null || maximum === null || maximum <= 0) return;
		const note = maximum === null || value === null ? null : `step ${String(value)}/${String(maximum)}`;
		const percent = maximum === null || value === null || maximum <= 0 ? null : Math.round(value / maximum * 100);
		this.progress.set(active.jobId, {
			value: percent,
			note
		});
		this.emit({
			jobId: active.jobId,
			clipId: active.clipId,
			kind: active.kind ?? "clip",
			slotKey: null,
			assetId: null,
			status: "running",
			progress: percent,
			note,
			error: null
		});
	}
	/**
	* 收尾一条任务。
	* @param active - 运行中任务。
	* @param status - 终态。
	* @param error - 失败原因。
	*/
	finish(active, status, error) {
		const at = (/* @__PURE__ */ new Date()).toISOString();
		try {
			updateJob(this.store, active.projectId, active.jobId, {
				status,
				finishedAt: at,
				...error === null ? {} : { error }
			});
			if (status !== "success" && active.kind !== "picture") setClipStatus(this.store, active.projectId, active.clipId, status, error);
			this.store.log("Engine", status === "success" ? `片段 ${active.clipId} 生成完成` : `片段 ${active.clipId} ${status}：${error ?? ""}`);
		} catch {}
		this.emit({
			jobId: active.jobId,
			clipId: active.clipId,
			kind: active.kind ?? "clip",
			slotKey: null,
			assetId: null,
			status,
			progress: null,
			note: null,
			error
		});
		this.lastOutcome = {
			status,
			clipId: active.clipId,
			error
		};
		this.outcomeTick += 1;
	}
	/** 释放调度器。 */
	dispose() {
		this.disposed = true;
		this.queue.length = 0;
		for (const active of this.running.values()) active.controller.abort();
	}
};
/**
* 读一张关键帧图。
* @param path - 文件路径。
* @returns 字节，读不到为 null。
*/
function assetBytesRaw(path) {
	try {
		return new Uint8Array(readFileSync(path));
	} catch {
		return null;
	}
}
/**
* 判断一个产物是不是视频。
* @param artifact - 产物。
* @returns 是则 true。
*/
function isFilm(artifact) {
	return /\.(?:mp4|webm|mov|mkv)$/iu.test(artifact.filename);
}
// lib/types/http/respond.js
/**
* 响应构造：JSON、错误、SSE 流。
*
* 所有错误都以 `{ error: '中文原因' }` 返回，前端只需读 `error` 字段。
* @module dsh-dream-studio-host/http/respond
*/
/**
* JSON 响应。
* @param value - 任意可序列化值。
* @param status - HTTP 状态码。
* @returns 响应。
*/
function json(value, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
/**
* 错误响应。
* @param message - 面向用户的中文原因。
* @param status - 状态码，默认 400。
* @returns 响应。
*/
function failure(message, status = 400) {
	return json({ error: message }, status);
}
/**
* 打开一条 SSE 流。
*
* 首帧发 `snapshot`，之后由调用方通过 `send` 推送，`ping` 每 15 秒一次保活。
* @param start - 建立流时的回调，拿到 `send` 与关闭句柄。
* @returns 响应。
*/
function eventStream(start) {
	const encoder = new TextEncoder();
	let close = null;
	const stream = new ReadableStream({
		start(controller) {
			const send = (value) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
				} catch {
					controller.close();
				}
			};
			const keepAlive = setInterval(() => {
				send({ type: "ping" });
			}, 15e3);
			const stop = start(send);
			close = () => {
				clearInterval(keepAlive);
				stop();
				try {
					controller.close();
				} catch {
					controller.close();
				}
			};
		},
		cancel() {
			close?.();
		}
	});
	return new Response(stream, { headers: {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-store"
	} });
}
// lib/types/http/router.js
/**
* 把一条模式与路径段匹配。
* @param pattern - 路由模式。
* @param parts - 已按 `/` 切开的路径。
* @returns 参数表，未匹配返回 null。
*/
function match(pattern, parts) {
	const wanted = pattern.split("/").filter(Boolean);
	if (wanted.length !== parts.length) return null;
	const params = {};
	for (const [index, segment] of wanted.entries()) {
		const actual = parts[index];
		if (actual === void 0) return null;
		if (segment.startsWith(":")) {
			params[segment.slice(1)] = decodeURIComponent(actual);
			continue;
		}
		if (segment !== actual) return null;
	}
	return params;
}
/**
* 建立路由分派器。
* @param prefix - HTTP 前缀，例如 `/dream-studio`。
* @param store - 数据门面。
* @param routes - 路由表。
* @returns fetch 形状的处理函数。
*/
function createRouter(prefix, store, routes, deps = {}) {
	const normalized = prefix.replace(/\/+$/u, "");
	return {
		requestBodyMode: () => "buffered",
		async fetch(request) {
			try {
				const url = new URL(request.url);
				const parts = url.pathname.split("/").filter(Boolean);
				if (`/${parts[0] ?? ""}` !== normalized) return failure("路由不存在", 404);
				const rest = parts.slice(1);
				if (rest.length === 0) return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
				for (const route of routes) {
					const params = match(route.pattern, rest);
					if (params === null) continue;
					if (route.method !== "ANY" && route.method !== request.method) continue;
					return await route.handler({
						request,
						url,
						params,
						store,
						engine: deps.engine ?? null
					});
				}
				return failure("路由不存在", 404);
			} catch (error) {
				return failure(error instanceof Error ? error.message : String(error), 400);
			}
		}
	};
}
/**
* 读请求体为对象。
* @param request - 请求。
* @returns 解析后的对象；空体返回空对象。
*/
async function bodyOf(request) {
	const text = await request.text();
	if (text.trim() === "") return {};
	const parsed = JSON.parse(text);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("请求体必须是 JSON 对象");
	return parsed;
}
/**
* 从请求体取字符串。
* @param source - 请求体。
* @param key - 字段名。
* @returns 字符串，缺失或类型不对为 undefined。
*/
function textOf(source, key) {
	const value = source[key];
	return typeof value === "string" ? value : void 0;
}
/**
* 从请求体取数字。
* @param source - 请求体。
* @param key - 字段名。
* @returns 有限数字，缺失或类型不对为 undefined。
*/
function numberOf(source, key) {
	const value = source[key];
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/**
* 从请求体取布尔。
* @param source - 请求体。
* @param key - 字段名。
* @returns 布尔，缺失或类型不对为 undefined。
*/
function boolOf(source, key) {
	const value = source[key];
	return typeof value === "boolean" ? value : void 0;
}
// lib/types/http/node-route.js
/** 一个缓冲路由保留的最大请求体（与浏览器承载一致）。 */
const MAX_BUFFERED_BODY_BYTES = 314572800;
/**
* 把一个 fetch 形状的面包装成 node:http 路由处理函数。
* @param handler - fetch 形状的处理函数。
* @param maxBufferedBodyBytes - 单个缓冲请求体的上限。
* @returns 拥有完整响应生命周期的路由处理函数。
*/
function nodeRoute(handler, maxBufferedBodyBytes = MAX_BUFFERED_BODY_BYTES) {
	return async (req, res) => {
		const abort = new AbortController();
		res.on("close", () => {
			if (!res.writableEnded) abort.abort();
		});
		const url = new URL(req.url ?? "/", "http://dream-studio.internal");
		const method = req.method ?? "GET";
		const headers = Object.fromEntries(Object.entries(req.headers).filter(([, value]) => typeof value === "string"));
		const streaming = handler.requestBodyMode({
			method,
			url
		}) === "streaming";
		let request;
		if (streaming) request = new Request(url, {
			method,
			headers,
			body: Readable.toWeb(req),
			signal: abort.signal,
			duplex: "half"
		});
		else {
			const declared = req.headers["content-length"];
			if (declared !== void 0 && Number(declared) > maxBufferedBodyBytes) {
				res.writeHead(413, { connection: "close" });
				res.end();
				req.destroy();
				return;
			}
			const chunks = [];
			let received = 0;
			for await (const chunk of req) {
				const buffer = chunk;
				received += buffer.byteLength;
				if (received > maxBufferedBodyBytes) {
					res.writeHead(413, { connection: "close" });
					res.end();
					req.destroy();
					return;
				}
				chunks.push(buffer);
			}
			request = new Request(url, {
				method,
				headers,
				...chunks.length > 0 ? { body: Buffer.concat(chunks) } : {},
				signal: abort.signal
			});
		}
		const response = await handler.fetch(request);
		const requestUnread = streaming && !req.readableEnded;
		const responseHeaders = Object.fromEntries(response.headers.entries());
		res.writeHead(response.status, requestUnread ? {
			...responseHeaders,
			connection: "close"
		} : responseHeaders);
		if (response.body === null) {
			res.end();
			if (requestUnread) req.destroy();
			return;
		}
		for await (const chunk of Readable.fromWeb(response.body)) {
			if (abort.signal.aborted) continue;
			if (!res.write(chunk) && !res.destroyed) await new Promise((resolve) => {
				const done = () => {
					res.off("drain", done);
					res.off("close", done);
					resolve();
				};
				res.once("drain", done);
				res.once("close", done);
			});
		}
		res.end();
		if (requestUnread) req.destroy();
	};
}
// lib/types/http/serve-file.js
/**
* 把一个磁盘文件回答给渲染层。
*
* 承载层会框住响应体，所以这里是读流而不是整块拷贝；`ETag` / `Cache-Control` /
* `Range` 都按标准语义工作，渲染层因此不会重复拉取已经有缓存的多媒体。
* @module dsh-dream-studio-host/http/serve-file
*/
/** 不可变文件的缓存时长（一年）。 */
const IMMUTABLE_MAX_AGE = "31536000";
/**
* 解析单段 `Range`。
* @param header - 请求头，没有则 null。
* @param size - 文件大小。
* @returns 范围、null（无范围）或 undefined（不可满足）。
*/
function parseRange(header, size) {
	if (header === null) return null;
	const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
	if (match === null) return null;
	const [, rawStart = "", rawEnd = ""] = match;
	if (rawStart === "" && rawEnd === "") return null;
	if (rawStart === "") {
		const length = Number(rawEnd);
		if (!Number.isFinite(length) || length <= 0) return void 0;
		return {
			start: Math.max(0, size - length),
			end: size - 1
		};
	}
	const start = Number(rawStart);
	const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
	if (!Number.isFinite(start) || start >= size || end < start) return void 0;
	return {
		start,
		end
	};
}
/**
* 回答一次媒体请求：条件请求重验、范围请求切片、其余整文件流。
* @param request - 请求。
* @param file - 要服务的文件。
* @returns 响应。
*/
function serveFile(request, file) {
	const stat = statSync(file.path);
	const size = stat.size;
	const etag = `"${String(size)}-${String(Math.floor(stat.mtimeMs))}"`;
	const lastModified = new Date(stat.mtimeMs).toUTCString();
	const headers = new Headers({
		"content-type": file.mime,
		"content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
		"etag": etag,
		"last-modified": lastModified,
		"accept-ranges": "bytes",
		"cache-control": file.mutable ? "private, no-cache" : `private, max-age=${IMMUTABLE_MAX_AGE}, immutable`
	});
	if (matchesValidator(request, etag, stat.mtimeMs)) return new Response(null, {
		status: 304,
		headers
	});
	const range = parseRange(request.headers.get("range"), size);
	if (range === void 0) {
		headers.set("content-range", `bytes */${String(size)}`);
		return new Response(null, {
			status: 416,
			headers
		});
	}
	if (range !== null) {
		headers.set("content-range", `bytes ${String(range.start)}-${String(range.end)}/${String(size)}`);
		headers.set("content-length", String(range.end - range.start + 1));
		if (request.method === "HEAD") return new Response(null, {
			status: 206,
			headers
		});
		const slice = createReadStream(file.path, {
			start: range.start,
			end: range.end
		});
		return new Response(Readable.toWeb(slice), {
			status: 206,
			headers
		});
	}
	headers.set("content-length", String(size));
	if (request.method === "HEAD") return new Response(null, {
		status: 200,
		headers
	});
	const whole = createReadStream(file.path);
	return new Response(Readable.toWeb(whole), {
		status: 200,
		headers
	});
}
/**
* 请求手里的版本是否已经是最新。
* @param request - 请求。
* @param etag - 当前校验值。
* @param mtimeMs - 修改时间（毫秒）。
* @returns 为 true 时回 304。
*/
function matchesValidator(request, etag, mtimeMs) {
	const noneMatch = request.headers.get("if-none-match");
	if (noneMatch !== null) return noneMatch.split(",").some((candidate) => candidate.trim() === etag || candidate.trim() === "*");
	const since = request.headers.get("if-modified-since");
	if (since === null) return false;
	const parsed = Date.parse(since);
	return Number.isFinite(parsed) && Math.floor(mtimeMs / 1e3) * 1e3 <= parsed;
}
// lib/types/http/routes/assets.js
/**
* 素材路由：导入、列表、文件、重绘（资产图）、应用主图、关键帧图。
*
* 素材文件不可变（强校验 + 一年缓存）；资产图与关键帧图可变（每次重绘换字节），
* 所以它们走重新校验，而不是不可变缓存。
* @module dsh-dream-studio-host/http/routes/assets
*/
/** 允许的分类。 */
const CATEGORIES = [
	"character",
	"scene",
	"prop",
	"generated",
	""
];
/** 素材路由表。 */
const assetRoutes = [
	{
		method: "GET",
		pattern: "/projects/:project/assets",
		handler: ({ store, params, url }) => {
			const episodeId = url.searchParams.get("episodeId");
			return json(store.listAssets(params["project"] ?? "", episodeId === null || episodeId === "" ? void 0 : episodeId));
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/assets",
		handler: async ({ request, store, params }) => {
			const form = await request.formData();
			const file = form.get("file");
			if (!(file instanceof File)) return failure("请选择要导入的文件");
			const library = form.get("library") === "episode" ? "episode" : "project";
			const category = String(form.get("category") ?? "");
			const episodeId = form.get("episodeId");
			return json(importAsset(store, params["project"] ?? "", {
				name: file.name,
				mime: file.type === "" ? "image/png" : file.type,
				bytes: new Uint8Array(await file.arrayBuffer()),
				library,
				...library === "episode" && typeof episodeId === "string" ? { episodeId } : {},
				category: CATEGORIES.includes(category) ? category : ""
			}), 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/assets/:asset",
		handler: ({ request, store, params }) => {
			const found = store.assetPath(params["project"] ?? "", params["asset"] ?? "");
			if (!existsSync(found.path)) return failure("素材文件已不在磁盘上", 404);
			return serveFile(request, {
				path: found.path,
				name: found.asset.name,
				mime: found.asset.mime,
				mutable: false
			});
		}
	},
	{
		method: "PATCH",
		pattern: "/projects/:project/assets/:asset",
		handler: async ({ request, store, params }) => {
			const name = textOf(await bodyOf(request), "name");
			if (name === void 0) return failure("请提供新的素材名");
			store.renameAsset(params["project"] ?? "", params["asset"] ?? "", name);
			return json(store.listAssets(params["project"] ?? ""));
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/assets/:asset",
		handler: ({ store, params, url }) => {
			const force = url.searchParams.get("force") === "true";
			return json({ refs: deleteAsset(store, params["project"] ?? "", params["asset"] ?? "", force) });
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/assets/:asset/images",
		handler: ({ store, params }) => json(listAssetImages(store, params["project"] ?? "", params["asset"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/assets/:asset/images",
		handler: async ({ request, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const source = await bodyOf(request);
			const prompt = textOf(source, "prompt");
			if (prompt === void 0 || prompt.trim() === "") return failure("请先填写提示词再生成图片");
			const refs = Array.isArray(source["refImages"]) ? source["refImages"].filter((entry) => typeof entry === "string") : [];
			const episodeId = textOf(source, "episodeId");
			const seed = numberOf(source, "seed");
			const ratio = textOf(source, "ratio");
			const size = numberOf(source, "size");
			const serverId = textOf(source, "serverId");
			return json({ jobId: engine.enqueuePicture(params["project"] ?? "", params["asset"] ?? "", {
				prompt,
				...seed === void 0 ? {} : { seed },
				...source["tile"] === true ? { tile: true } : {},
				...source["reference"] === true ? { reference: true } : {},
				...ratio === void 0 ? {} : { ratio },
				...size === void 0 ? {} : { shortSide: size },
				...refs.length === 0 ? {} : { refAssetIds: refs },
				...episodeId === void 0 ? {} : { episodeId }
			}, serverId) }, 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/assets/:asset/images/:image",
		handler: ({ request, store, params }) => {
			const path = store.assetImagePath(params["project"] ?? "", params["asset"] ?? "", params["image"] ?? "");
			if (!existsSync(path)) return failure("这张图已经不在磁盘上", 404);
			return serveFile(request, {
				path,
				name: `${params["image"] ?? "image"}.png`,
				mime: "image/png",
				mutable: true
			});
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/assets/:asset/images/:image/apply",
		handler: ({ store, params }) => {
			applyAssetImage(store, params["project"] ?? "", params["asset"] ?? "", params["image"] ?? "");
			return json({ ok: true });
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/keyframes/:clip/:keyframe",
		handler: ({ request, store, params }) => {
			const path = store.keyframePath(params["project"] ?? "", params["clip"] ?? "", params["keyframe"] ?? "");
			if (!existsSync(path)) return failure("该关键帧图还没有生成", 404);
			return serveFile(request, {
				path,
				name: `${params["keyframe"] ?? "keyframe"}.png`,
				mime: "image/png",
				mutable: true
			});
		}
	}
];
// lib/types/domain/workflows.js
/**
* 把内置模板同步进目录库（幂等）。
*
* 按名字匹配：已存在且 `customized=0` 的就地更新图与能力；用户改过的（customized=1）不覆盖。
* @param store - 数据门面。
* @param templates - 内置模板。
* @returns 写入的条数。
*/
function syncBuiltinWorkflows(store, templates) {
	let written = 0;
	store.withCatalogDb((db) => {
		for (const template of templates) {
			const existing = db.prepare("SELECT id, customized FROM workflows WHERE name = ?").get(template.name);
			if (existing !== void 0 && Number(existing.customized) === 1) continue;
			const id = existing?.id ?? crypto.randomUUID();
			const at = nowIso();
			db.prepare(`INSERT INTO workflows (id, name, family, modes, kind, profile_id, graph, param_map, customized, builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 0, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           family = excluded.family, modes = excluded.modes, kind = excluded.kind,
           graph = excluded.graph, builtin = 1, updated_at = excluded.updated_at`).run(id, template.name, template.family, JSON.stringify(template.modes), template.kind, "minimax_h3", JSON.stringify(template.graph), at, at);
			written += 1;
		}
		db.prepare("UPDATE workflows SET kind = 'other' WHERE builtin = 0 AND customized = 0").run();
	});
	return written;
}
/**
* 导入一份自定义工作流。
* @param store - 数据门面。
* @param input - 名称、图与推断出的分类。
* @returns 新工作流。
*/
function importWorkflow(store, input) {
	const name = input.name.trim();
	if (name === "") throw new Error("请填写工作流名称");
	const at = nowIso();
	const id = crypto.randomUUID();
	store.withCatalogDb((db) => {
		const existing = db.prepare("SELECT id FROM workflows WHERE name = ?").get(name);
		if (existing !== void 0) {
			db.prepare(`UPDATE workflows SET family = ?, modes = ?, kind = ?, graph = ?, param_map = ?, customized = 1, builtin = 0, updated_at = ? WHERE id = ?`).run(input.family, JSON.stringify(input.modes), input.kind, JSON.stringify(input.graph), JSON.stringify(input.paramMap ?? {}), at, existing.id);
			return;
		}
		db.prepare(`INSERT INTO workflows (id, name, family, modes, kind, profile_id, graph, param_map, customized, builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`).run(id, name, input.family, JSON.stringify(input.modes), input.kind, "minimax_h3", JSON.stringify(input.graph), JSON.stringify(input.paramMap ?? {}), at, at);
	});
	const created = listWorkflows(store).find((workflow) => workflow.name === name);
	if (created === void 0) throw new Error("工作流没有写入目录");
	return created;
}
/**
* 列工作流。
* @param store - 数据门面。
* @returns 工作流列表。
*/
function listWorkflows(store) {
	return store.withCatalogDb((db) => {
		return db.prepare("SELECT * FROM workflows ORDER BY builtin DESC, name").all().map((row) => workflowOf(row));
	});
}
/** 一行工作流 → 类型。 */
function workflowOf(row) {
	return {
		id: String(row["id"]),
		name: String(row["name"]),
		family: String(row["family"] ?? "film"),
		modes: JSON.parse(String(row["modes"] ?? "[]")),
		kind: String(row["kind"] ?? "other"),
		profileId: String(row["profile_id"] ?? "minimax_h3"),
		graph: JSON.parse(String(row["graph"] ?? "{}")),
		paramMap: JSON.parse(String(row["param_map"] ?? "{}")),
		customized: Number(row["customized"] ?? 0) === 1,
		builtin: Number(row["builtin"] ?? 0) === 1,
		createdAt: String(row["created_at"]),
		updatedAt: String(row["updated_at"])
	};
}
/**
* 删除一个工作流（内置不可删）。
* @param store - 数据门面。
* @param workflowId - 工作流 id。
*/
function deleteWorkflow(store, workflowId) {
	store.withCatalogDb((db) => {
		const row = db.prepare("SELECT builtin FROM workflows WHERE id = ?").get(workflowId);
		if (row === void 0) throw new Error("工作流不存在");
		if (Number(row.builtin) === 1) throw new Error("内置工作流不能删除，只能重新导入覆盖");
		db.prepare("DELETE FROM workflows WHERE id = ?").run(workflowId);
	});
}
/**
* 列服务。
* @param store - 数据门面。
* @returns 服务列表。
*/
function listServers(store) {
	return store.withCatalogDb((db) => {
		return db.prepare("SELECT * FROM servers ORDER BY is_default DESC, created_at").all().map((row) => ({
			id: String(row["id"]),
			name: String(row["name"]),
			baseUrl: String(row["base_url"]),
			type: String(row["type"] ?? "local"),
			isDefault: Number(row["is_default"] ?? 0) === 1,
			available: false,
			caps: null,
			createdAt: String(row["created_at"])
		}));
	});
}
/**
* 新增服务。
* @param store - 数据门面。
* @param input - 名称、地址、类型。
* @returns 新服务。
*/
function addServer(store, input) {
	const name = input.name.trim();
	const baseUrl = input.baseUrl.trim().replace(/\/+$/u, "");
	if (name === "") throw new Error("请填写服务名称");
	if (!/^https?:\/\//u.test(baseUrl)) throw new Error("服务地址必须以 http:// 或 https:// 开头");
	const id = crypto.randomUUID();
	const at = nowIso();
	const first = store.withCatalogDb((db) => {
		const count = db.prepare("SELECT COUNT(*) AS n FROM servers").get().n;
		db.prepare("INSERT INTO servers (id, name, base_url, type, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, name, baseUrl, input.type ?? "local", count === 0 ? 1 : 0, at);
		return count === 0;
	});
	return {
		id,
		name,
		baseUrl,
		type: input.type ?? "local",
		isDefault: first,
		available: false,
		caps: null,
		createdAt: at
	};
}
/**
* 设默认服务。
* @param store - 数据门面。
* @param serverId - 服务 id。
*/
function setDefaultServer(store, serverId) {
	store.withCatalogDb((db) => {
		db.prepare("UPDATE servers SET is_default = 0").run();
		db.prepare("UPDATE servers SET is_default = 1 WHERE id = ?").run(serverId);
	});
}
/**
* 删除服务。
* @param store - 数据门面。
* @param serverId - 服务 id。
*/
function deleteServer(store, serverId) {
	store.withCatalogDb((db) => {
		db.prepare("DELETE FROM servers WHERE id = ?").run(serverId);
	});
}
// lib/types/comfy/mirror.js
/**
* 「时空节点」用的本地反代：把 ComfyUI 原样挂到 `127.0.0.1:<随机端口>/<随机前缀>/` 上。
*
* 为什么要多这一层：ComfyUI 的 `origin_only` 中间件（server.py 的
* `create_origin_only_middleware`）对浏览器的跨源请求直接回 403 —— 任何跨源
* iframe 导航都会带 `Sec-Fetch-Site: cross-site`，所以网页里嵌 `:8188` 只会得到
* 一片空白。反代在服务端转一手，浏览器请求的是它自己的同源地址，ComfyUI 那边
* 看到的请求不带 Origin / Sec-Fetch-*。
*
* 前缀不是装饰：ComfyUI 前端用 `location.pathname` 推 API 基址
* （`readLaunchContext()` 的 `base`），所以挂到 `/<token>/` 下之后，`/api/*`、
* `/ws`、`/view` 这些根绝对路径会自动带上同一个前缀，反代剥掉前缀再转发即可。
* @module dsh-dream-studio-host/comfy/mirror
*/
/** 转发时丢掉的请求头：跨源头与逐跳头。 */
const DROP_REQUEST = /* @__PURE__ */ new Set([
	"origin",
	"referer",
	"host",
	"connection",
	"keep-alive",
	"proxy-connection",
	"upgrade",
	"te",
	"trailer",
	"sec-fetch-site",
	"sec-fetch-mode",
	"sec-fetch-dest",
	"sec-fetch-user"
]);
/** 回写时丢掉的响应头：逐跳头，外加可能挡住 iframe 的两个。 */
const DROP_RESPONSE = /* @__PURE__ */ new Set([
	"connection",
	"keep-alive",
	"proxy-connection",
	"transfer-encoding",
	"upgrade",
	"x-frame-options",
	"content-security-policy"
]);
/**
* 复制一份可转发的请求头。
* @param headers - 浏览器发来的头。
* @returns 剥掉跨源标记与逐跳头之后的新对象。
*/
function forwardHeaders(headers) {
	const out = {};
	for (const [key, value] of Object.entries(headers)) {
		if (value === void 0) continue;
		if (DROP_REQUEST.has(key.toLowerCase())) continue;
		out[key] = value;
	}
	return out;
}
/**
* 复制一份可回写的响应头。
* @param headers - ComfyUI 的响应头。
* @returns 剥掉逐跳头之后的新对象。
*/
function responseHeaders(headers) {
	const out = {};
	for (const [key, value] of Object.entries(headers)) {
		if (value === void 0) continue;
		if (DROP_RESPONSE.has(key.toLowerCase())) continue;
		out[key] = value;
	}
	return out;
}
/**
* 升级（WebSocket）请求用的头：保留握手字段，只丢掉跨源标记。
* @param headers - 浏览器发来的头。
* @returns 可转发的头。
*/
function upgradeHeaders(headers) {
	const out = {};
	for (const [key, value] of Object.entries(headers)) {
		if (value === void 0) continue;
		const lower = key.toLowerCase();
		if (lower === "origin" || lower === "referer" || lower === "host") continue;
		out[key] = value;
	}
	out.connection = "Upgrade";
	out.upgrade = typeof headers.upgrade === "string" ? headers.upgrade : "websocket";
	return out;
}
/**
* 校验并解析目标地址。
* @param target - 设置里配的 ComfyUI 地址。
* @returns 解析后的 URL。
*/
function parseTarget(target) {
	const parsed = new URL(target);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("ComfyUI 地址必须以 http:// 或 https:// 开头");
	return parsed;
}
/**
* 起一个反代服务器。
* @param target - ComfyUI 根地址。
* @returns 地址与服务器句柄。
*/
async function start(target) {
	const prefix = `/${randomBytes(8).toString("hex")}`;
	const basePath = target.pathname.replace(/\/+$/u, "");
	const send = target.protocol === "https:" ? request$1 : request;
	/** 把浏览器路径换成上游路径。 */
	const upstreamPath = (rest, search) => `${basePath}${rest === "" ? "/" : rest}${search}`;
	/** 发一条上游请求。 */
	const open = (request) => send(request);
	const server = createServer((incoming, outgoing) => {
		const view = new URL(incoming.url ?? "/", "http://127.0.0.1");
		if (!view.pathname.startsWith(prefix)) {
			outgoing.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("反代前缀不正确");
			return;
		}
		const rest = view.pathname.slice(prefix.length);
		const upstream = open({
			protocol: target.protocol,
			hostname: target.hostname,
			port: target.port === "" ? void 0 : target.port,
			method: incoming.method ?? "GET",
			path: upstreamPath(rest, view.search),
			headers: forwardHeaders(incoming.headers)
		});
		upstream.on("response", (answer) => {
			outgoing.writeHead(answer.statusCode ?? 502, responseHeaders(answer.headers));
			answer.pipe(outgoing);
		});
		upstream.on("error", (error) => {
			if (!outgoing.headersSent) outgoing.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
			outgoing.end(`连不上 ComfyUI：${error.message}`);
		});
		outgoing.on("close", () => {
			upstream.destroy();
		});
		incoming.pipe(upstream);
	});
	server.on("upgrade", (incoming, socket, head) => {
		const view = new URL(incoming.url ?? "/", "http://127.0.0.1");
		if (!view.pathname.startsWith(prefix)) {
			socket.destroy();
			return;
		}
		const rest = view.pathname.slice(prefix.length);
		const upstream = open({
			protocol: target.protocol,
			hostname: target.hostname,
			port: target.port === "" ? void 0 : target.port,
			method: incoming.method ?? "GET",
			path: upstreamPath(rest, view.search),
			headers: upgradeHeaders(incoming.headers)
		});
		upstream.on("upgrade", (answer, upstreamSocket, upstreamHead) => {
			const lines = ["HTTP/1.1 101 Switching Protocols"];
			for (let index = 0; index < answer.rawHeaders.length; index += 2) lines.push(`${String(answer.rawHeaders[index])}: ${String(answer.rawHeaders[index + 1])}`);
			socket.write(`${lines.join("\r\n")}\r\n\r\n`);
			if (upstreamHead.length > 0) socket.write(upstreamHead);
			if (head.length > 0) upstreamSocket.write(head);
			upstreamSocket.on("error", () => {
				socket.destroy();
			});
			socket.on("error", () => {
				upstreamSocket.destroy();
			});
			upstreamSocket.pipe(socket);
			socket.pipe(upstreamSocket);
		});
		upstream.on("error", () => {
			socket.destroy();
		});
		upstream.end();
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		server.close();
		throw new Error("反代端口没分配成功");
	}
	return {
		url: `http://127.0.0.1:${String(address.port)}${prefix}/`,
		server
	};
}
/** 进程内共享的反代登记表：同一个 ComfyUI 地址只起一个。 */
var ComfyMirror = class {
	running = /* @__PURE__ */ new Map();
	/**
	* 拿到目标地址对应的反代地址；第一次调用时起服务。
	* @param target - 设置里配的 ComfyUI 地址。
	* @returns 浏览器里应该打开的地址。
	*/
	async url(target) {
		const parsed = parseTarget(target);
		const key = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/u, "")}`;
		const existing = this.running.get(key);
		if (existing !== void 0) return existing.url;
		const started = await start(parsed);
		this.running.set(key, started);
		return started.url;
	}
	/** 关掉所有反代（插件卸载时用）。 */
	close() {
		for (const entry of this.running.values()) entry.server.close();
		this.running.clear();
	}
};
/** 宿主里唯一的反代实例。 */
const comfyMirror = new ComfyMirror();
// lib/types/http/routes/mirror.js
/** 反代路由表。 */
const mirrorRoutes = [{
	method: "GET",
	pattern: "/comfy-mirror",
	handler: async ({ store, url }) => {
		const servers = listServers(store);
		const wanted = url.searchParams.get("server");
		const chosen = (wanted === null ? void 0 : servers.find((server) => server.id === wanted)) ?? servers.find((server) => server.isDefault) ?? servers[0];
		if (chosen === void 0) return failure("还没有配置 ComfyUI 服务：到「设置 → 通用设置」里加一个地址");
		try {
			return json({
				url: await comfyMirror.url(chosen.baseUrl),
				target: chosen.baseUrl,
				serverId: chosen.id
			});
		} catch (thrown) {
			return failure(`起不了内嵌地址：${thrown instanceof Error ? thrown.message : String(thrown)}`, 502);
		}
	}
}];
// lib/types/media/status.js
/**
* FFmpeg / FFprobe 的定位与状态。
*
* 查找顺序：设置里指定的路径 → 环境变量 → 打包的 `resources/ffmpeg/bin` → PATH。
* 找不到不是错误：状态报"未就绪"，需要合并时再给中文提示（手册 5.13.6）。
* @module dsh-dream-studio-host/media/status
*/
/** 模块目录（源码在 src/media，构建后在 lib/types/media）。 */
const HERE = fileURLToPath(new URL(".", import.meta.url));
/**
* 打包的二进制目录（两个层级都试：源码与构建产物到 resources 的相对路径相同）。
* @returns 目录列表。
*/
function bundledDirs() {
	return [
		join(HERE, "..", "resources", "ffmpeg", "bin"),
		join(HERE, "..", "..", "resources", "ffmpeg", "bin"),
		join(HERE, "..", "..", "..", "..", "resources", "ffmpeg", "bin")
	];
}
/**
* 在 PATH 里找一个可执行文件。
* @param name - 文件名（不含扩展名）。
* @returns 绝对路径，找不到为 null。
*/
function fromPath(name) {
	const extensions = process.platform === "win32" ? [".exe", ""] : [""];
	for (const dir of (process.env["PATH"] ?? "").split(delimiter)) {
		if (dir.trim() === "") continue;
		for (const extension of extensions) {
			const candidate = join(dir, `${name}${extension}`);
			if (existsSync(candidate)) return candidate;
		}
	}
	return null;
}
/**
* 定位一个二进制。
* @param name - 二进制名。
* @param configured - 设置里指定的路径。
* @returns 绝对路径，找不到为 null。
*/
function resolveBinary$1(name, configured) {
	if (configured !== null && configured.trim() !== "") {
		const candidate = resolve(configured.trim());
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	const fromEnv = process.env[name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"];
	if (fromEnv !== void 0 && fromEnv.trim() !== "" && existsSync(fromEnv)) return resolve(fromEnv);
	for (const dir of bundledDirs()) {
		const candidate = join(dir, process.platform === "win32" ? `${name}.exe` : name);
		if (existsSync(candidate)) return candidate;
	}
	return fromPath(name);
}
/**
* 当前工具链状态。
* @param configured - `{ ffmpegPath, ffprobePath }`，来自设置。
* @returns 状态。
*/
function mediaStatus(configured) {
	return {
		ffmpeg: resolveBinary$1("ffmpeg", configured.ffmpegPath ?? null),
		ffprobe: resolveBinary$1("ffprobe", configured.ffprobePath ?? null),
		bundled: bundledDirs().some((dir) => existsSync(dir))
	};
}
/**
* 合并前检查工具链，缺就抛中文原因。
* @param status - 工具链状态。
*/
function requireTools(status) {
	if (status.ffmpeg === null || status.ffprobe === null) throw new Error("ffmpeg / ffprobe 未就绪：请把旧插件的 resources/ffmpeg/bin 复制到本插件，或在设置里指定路径");
}
// lib/types/graph/validate.js
/**
* 用 ComfyUI 的 `/object_info` 校验一张模板图：节点是否存在、输入名是否存在、
* 下拉类输入的值是否在候选列表里。
*
* 只做"静态"校验，不排队、不占卡：适合设置页点一下确认模型配置有没有写错。
* @module dsh-dream-studio-host/graph/validate
*/
/**
* 运行时才填的输入：这些节点的下拉候选是本机文件列表（用户上传的参考图、视频），
* 模板里留的是占位值，提交前由调度器换成真实文件名 —— 静态校验应当放过。
*/
const RUNTIME_FILE_NODES = [
	"LoadImage",
	"LoadVideo",
	"LoadAudio"
];
/** 从声明里取下拉候选：`[[...values], {...}]` 这种结构。 */
function comboValues(declaration) {
	const first = declaration?.[0];
	if (!Array.isArray(first)) return null;
	return first.filter((entry) => typeof entry === "string");
}
/**
* 校验整张图。
* @param graph - 要提交的图。
* @param objectInfo - ComfyUI 的 `/object_info` 响应。
* @returns 问题列表；空数组表示通过。
*/
function validateTemplateGraph(graph, objectInfo) {
	const issues = [];
	for (const [nodeId, value] of Object.entries(graph)) {
		const node = value;
		const info = objectInfo[node.class_type];
		if (info === void 0 || typeof info !== "object" || info === null) {
			issues.push({
				nodeId,
				classType: node.class_type,
				input: null,
				value: null,
				message: `节点类型未安装：${node.class_type}`
			});
			continue;
		}
		if (node.mode === 4) continue;
		if (RUNTIME_FILE_NODES.includes(node.class_type)) continue;
		const input = info.input;
		const declared = {
			...input?.required ?? {},
			...input?.optional ?? {}
		};
		for (const [key, raw] of Object.entries(node.inputs)) {
			if (Array.isArray(raw) && typeof raw[0] === "string") continue;
			const declaration = declared[key];
			if (declaration === void 0) {
				if ((key.includes(".") ? declared[key.slice(0, key.indexOf("."))] : void 0) !== void 0) continue;
				issues.push({
					nodeId,
					classType: node.class_type,
					input: key,
					value: String(raw),
					message: `参数不存在：${node.class_type}.${key}`
				});
				continue;
			}
			const values = comboValues(declaration);
			if (values !== null && typeof raw === "string" && !values.includes(raw)) issues.push({
				nodeId,
				classType: node.class_type,
				input: key,
				value: raw,
				message: `值不在候选里：${node.class_type}.${key} = ${raw}`
			});
		}
	}
	return issues;
}
// lib/types/http/routes/catalog.js
/** 允许的调度模式。 */
const DISPATCH_MODES = ["serial", "parallel"];
/** 目录级路由表。 */
const catalogRoutes = [
	{
		method: "GET",
		pattern: "/health",
		handler: ({ store }) => json({
			ok: true,
			projectsRoot: store.projectsRoot()
		})
	},
	{
		method: "GET",
		pattern: "/settings",
		handler: ({ store }) => {
			const settings = store.settings();
			return json({
				...settings,
				media: mediaStatus({
					ffmpegPath: settings.ffmpegPath,
					ffprobePath: settings.ffprobePath
				})
			});
		}
	},
	{
		method: "GET",
		pattern: "/settings/workflow-models",
		handler: async ({ store, engine }) => {
			const folders = {};
			if (engine !== null) try {
				const servers = listServers$1(store);
				const server = servers.find((entry) => entry.isDefault) ?? servers[0];
				if (server !== void 0) {
					const client = engine.comfy(server.id);
					const results = await Promise.all([
						"unet",
						"diffusion_models",
						"checkpoints",
						"text_encoders",
						"clip",
						"vae",
						"loras",
						"frame_interpolation",
						"latent_upscale_models",
						"upscale_models"
					].map(async (folder) => {
						try {
							const list = await client.models(folder);
							return [folder, [...new Set(list.flatMap((entry) => entry.files))].sort()];
						} catch {
							return [folder, []];
						}
					}));
					for (const [folder, files] of results) folders[folder] = files;
				}
			} catch {}
			return json({
				templates: loadTemplates().map((template) => {
					const graph = template.graph;
					const mirrored = lorasAreMirrored(graph);
					const loras = templateLoras(graph);
					return {
						name: template.name,
						kind: template.kind,
						family: template.family,
						slots: discoverTemplateSlots(graph).map((slot) => ({
							key: slot.key,
							label: slot.label,
							current: slot.current,
							folder: slot.folder,
							folders: slot.folders,
							options: slotOptions(folders, slot)
						})),
						loras: mirrored ? loras.slice(0, 1) : loras,
						loraMirrored: mirrored,
						loraOptions: folders["loras"] ?? []
					};
				}),
				current: store.settings().workflowModels.templates
			});
		}
	},
	{
		method: "POST",
		pattern: "/settings/workflow-models/check",
		handler: async ({ request, store, engine }) => {
			if (engine === null) return failure("调度器未启动");
			const source = await bodyOf(request);
			const name = textOf(source, "name") ?? "";
			const template = loadTemplates().find((entry) => entry.name === name);
			if (template === void 0) return failure("找不到这个工作流模板", 404);
			const rawConfig = source["config"];
			const config = rawConfig === void 0 || rawConfig === null ? void 0 : parseWorkflowModels(JSON.stringify({ templates: { [name]: rawConfig } })).templates[name];
			let objectInfo = null;
			try {
				const servers = listServers$1(store);
				const server = servers.find((entry) => entry.isDefault) ?? servers[0];
				if (server !== void 0) objectInfo = await engine.comfy(server.id).objectInfo();
			} catch {
				objectInfo = null;
			}
			if (objectInfo === null) return failure("连不上 ComfyUI，无法检查（先确认服务在线）");
			const graph = applyTemplateModels(template.graph, config);
			const issues = validateTemplateGraph(graph, objectInfo);
			return json({
				ok: issues.length === 0,
				nodeCount: Object.keys(graph).length,
				issues
			});
		}
	},
	{
		method: "PATCH",
		pattern: "/settings",
		handler: async ({ request, store }) => {
			const source = await bodyOf(request);
			const dispatch = textOf(source, "dispatchMode");
			if (dispatch !== void 0 && !DISPATCH_MODES.includes(dispatch)) return failure("调度模式只能是串行（serial）或并行（parallel）");
			const cacheLimitBytes = numberOf(source, "cacheLimitBytes");
			if (cacheLimitBytes !== void 0 && cacheLimitBytes < 0) return failure("缓存上限不能为负数");
			const projectRoot = textOf(source, "projectRoot");
			const ffmpegPath = textOf(source, "ffmpegPath");
			const ffprobePath = textOf(source, "ffprobePath");
			const minimaxApiKey = textOf(source, "minimaxApiKey");
			const modelsRaw = source["workflowModels"];
			const workflowModels = modelsRaw === void 0 || modelsRaw === null ? void 0 : parseWorkflowModels(JSON.stringify(modelsRaw));
			const next = store.updateSettings({
				...projectRoot === void 0 ? {} : { projectRoot },
				...dispatch === void 0 ? {} : { dispatchMode: dispatch },
				...ffmpegPath === void 0 ? {} : { ffmpegPath },
				...ffprobePath === void 0 ? {} : { ffprobePath },
				...cacheLimitBytes === void 0 ? {} : { cacheLimitBytes },
				...workflowModels === void 0 ? {} : { workflowModels },
				...minimaxApiKey === void 0 ? {} : { minimaxApiKey }
			});
			return json({
				...next,
				media: mediaStatus({
					ffmpegPath: next.ffmpegPath,
					ffprobePath: next.ffprobePath
				})
			});
		}
	},
	{
		method: "GET",
		pattern: "/logs",
		handler: ({ store }) => json(store.recentLogs())
	},
	{
		method: "GET",
		pattern: "/templates",
		handler: ({ store }) => json(store.listTemplates())
	},
	{
		method: "GET",
		pattern: "/samples",
		handler: ({ store }) => json(store.listSamples())
	},
	{
		method: "GET",
		pattern: "/progress",
		handler: ({ engine }) => json(engine === null ? {
			running: [],
			queued: [],
			lastOutcome: null,
			outcomeTick: 0
		} : engine.snapshot())
	},
	{
		method: "GET",
		pattern: "/events",
		handler: ({ engine }) => eventStream((send) => {
			if (engine === null) {
				send({
					type: "snapshot",
					running: [],
					queued: [],
					lastOutcome: null,
					outcomeTick: 0
				});
				return () => void 0;
			}
			send({
				type: "snapshot",
				...engine.snapshot()
			});
			const tick = setInterval(() => {
				try {
					send({
						type: "snapshot",
						...engine.snapshot()
					});
				} catch {
					clearInterval(tick);
				}
			}, 3e3);
			const unsubscribe = engine.subscribe((event) => send({
				type: "job",
				...event
			}));
			return () => {
				clearInterval(tick);
				unsubscribe();
			};
		})
	}
];
// lib/types/http/routes/catalog-deep.js
/** 服务与工作流路由表。 */
const catalogDeepRoutes = [
	{
		method: "GET",
		pattern: "/servers",
		handler: async ({ store, engine }) => {
			const servers = listServers(store);
			return json(await Promise.all(servers.map(async (server) => {
				if (engine === null) return {
					...server,
					available: false,
					caps: null
				};
				try {
					const caps = await engine.comfy(server.id).caps();
					return {
						...server,
						available: caps.reachable,
						caps
					};
				} catch {
					return {
						...server,
						available: false,
						caps: null
					};
				}
			})));
		}
	},
	{
		method: "POST",
		pattern: "/servers",
		handler: async ({ request, store, engine }) => {
			const source = await bodyOf(request);
			const type = textOf(source, "type");
			if (type !== void 0 && type !== "local" && type !== "remote" && type !== "cloud") return failure("服务类型只能是本地 / 远程 / 云端");
			const created = addServer(store, {
				name: textOf(source, "name") ?? "",
				baseUrl: textOf(source, "baseUrl") ?? "",
				...type === void 0 ? {} : { type }
			});
			engine?.invalidate(created.id);
			return json(created, 201);
		}
	},
	{
		method: "GET",
		pattern: "/servers/:server/caps",
		handler: async ({ engine, params, url }) => {
			if (engine === null) return failure("调度器未启动");
			return json(await engine.comfy(params["server"] ?? "").caps(url.searchParams.get("refresh") === "true"));
		}
	},
	{
		method: "POST",
		pattern: "/servers/:server/test",
		handler: async ({ store, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const caps = await engine.comfy(params["server"] ?? "").caps(true);
			engine.invalidate(params["server"] ?? "");
			store.log("ComfyUI", `探测 ${params["server"] ?? ""}：${caps.reachable ? "可达" : "不可达"}`);
			return json({
				available: caps.reachable,
				caps
			});
		}
	},
	{
		method: "GET",
		pattern: "/servers/:server/models",
		handler: async ({ engine, params, url }) => {
			if (engine === null) return failure("调度器未启动");
			const folder = url.searchParams.get("folder");
			return json(await engine.comfy(params["server"] ?? "").models(folder ?? void 0));
		}
	},
	{
		method: "POST",
		pattern: "/servers/:server/default",
		handler: ({ store, params }) => {
			setDefaultServer(store, params["server"] ?? "");
			return json({ ok: true });
		}
	},
	{
		method: "DELETE",
		pattern: "/servers/:server",
		handler: ({ store, engine, params }) => {
			deleteServer(store, params["server"] ?? "");
			engine?.invalidate(params["server"] ?? "");
			return json({ ok: true });
		}
	},
	{
		method: "GET",
		pattern: "/workflows",
		handler: ({ store }) => json(listWorkflows(store).map((workflow) => ({
			id: workflow.id,
			name: workflow.name,
			family: workflow.family,
			modes: workflow.modes,
			kind: workflow.kind,
			nodeCount: Object.keys(workflow.graph).length,
			customized: workflow.customized,
			builtin: workflow.builtin,
			createdAt: workflow.createdAt,
			updatedAt: workflow.updatedAt
		})))
	},
	{
		method: "POST",
		pattern: "/workflows",
		handler: async ({ request, store }) => {
			const source = await bodyOf(request);
			const name = textOf(source, "name");
			if (name === void 0 || name.trim() === "") return failure("请填写工作流名称");
			const raw = source["graph"];
			if (typeof raw !== "object" || raw === null) return failure("请提供 ComfyUI API 格式（导出 API）的节点图");
			const graph = asGraph(raw);
			const body = graph;
			const family = familyOf(graph);
			const kind = kindOf(graph);
			const created = importWorkflow(store, {
				name,
				graph: body,
				family,
				modes: modesOf(graph),
				kind
			});
			store.log("Workflow", `导入工作流 ${created.name}（${String(Object.keys(graph).length)} 节点）`);
			return json(created, 201);
		}
	},
	{
		method: "POST",
		pattern: "/workflows/sync-builtin",
		handler: ({ store }) => {
			const written = syncBuiltinWorkflows(store, loadTemplates());
			store.log("Workflow", `同步内置模板 ${String(written)} 条`);
			return json({ written });
		}
	},
	{
		method: "POST",
		pattern: "/workflows/:workflow/validate",
		handler: async ({ request, store, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const source = await bodyOf(request);
			const workflow = listWorkflows(store).find((entry) => entry.id === params["workflow"]);
			if (workflow === void 0) return failure("工作流不存在", 404);
			const servers = listServers(store);
			const resolved = textOf(source, "serverId") ?? (servers.find((server) => server.isDefault) ?? servers[0])?.id ?? null;
			if (resolved === null) return failure("还没有配置 ComfyUI 服务");
			const caps = await engine.comfy(resolved).caps(true);
			const models = await engine.comfy(resolved).models();
			const installed = new Set(caps.nodes);
			const files = new Set(models.flatMap((folder) => folder.files));
			const needed = /* @__PURE__ */ new Set();
			const wanted = /* @__PURE__ */ new Set();
			for (const node of Object.values(workflow.graph)) {
				const entry = node;
				if (typeof entry.class_type === "string") needed.add(entry.class_type);
				for (const value of Object.values(entry.inputs ?? {})) if (typeof value === "string" && /\.(?:safetensors|ckpt|pt|pth|bin)$/iu.test(value)) wanted.add(value);
			}
			const missingNodes = [...needed].filter((name) => !installed.has(name)).sort();
			const missingModels = [...wanted].filter((name) => !files.has(name)).sort();
			return json({
				ok: caps.reachable && missingNodes.length === 0 && missingModels.length === 0,
				serverId: resolved,
				reachable: caps.reachable,
				nodeCount: needed.size,
				modelCount: wanted.size,
				missingNodes,
				missingModels
			});
		}
	},
	{
		method: "GET",
		pattern: "/workflows/:workflow",
		handler: ({ store, params }) => {
			const found = listWorkflows(store).find((workflow) => workflow.id === params["workflow"]);
			return found === void 0 ? failure("工作流不存在", 404) : json(found);
		}
	},
	{
		method: "DELETE",
		pattern: "/workflows/:workflow",
		handler: ({ store, params }) => {
			deleteWorkflow(store, params["workflow"] ?? "");
			return json({ ok: true });
		}
	}
];
// lib/types/assistant/llm.js
/**
* 列出所有可调用路由。
* @param llm - 宿主 LLM 服务。
* @returns 路由列表（按 provider 顺序）。
*/
async function listAssistantRoutes(llm) {
	const routes = [];
	for (const provider of llm.listProviders()) {
		const models = await llm.listModels(provider.id);
		for (const model of models) routes.push({
			provider: provider.id,
			model: model.id,
			vision: (model.inputModalities ?? []).includes("image")
		});
	}
	return routes;
}
/**
* 造一条用户消息，与 `@deepseek-ai/dsh-llm` 的 `createUserMessage` 同义：补一个 uuid
* 身份、角色固定成 `user`、整条深冻结。这里自带实现，是为了让打包产物不再依赖宿主的
* 依赖树（否则单独安装时找不到 `@deepseek-ai/dsh-llm`）。
* @param input - 内容与来源。
* @returns 冻结后的用户消息。
*/
function createUserMessage(input) {
	return deepFreeze({
		...input,
		id: randomUUID(),
		role: "user"
	});
}
/**
* 深冻结一个值。
* @param value - 待冻结的值。
* @returns 同一个值。
*/
function deepFreeze(value) {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}
/**
* 跑一次补全。
* @param llm - 宿主 LLM 服务。
* @param request - 系统提示、用户提示、温度与上限。
* @returns 文本与用量。
*/
async function completeAssistant(llm, request) {
	const options = {
		provider: request.route.provider,
		model: request.route.model,
		system: request.system,
		messages: [createUserMessage({
			content: [{
				type: "text",
				text: request.prompt
			}, ...(request.images ?? []).map((attachment) => ({
				type: "image",
				attachment
			}))],
			source: { kind: "user" }
		})],
		temperature: request.temperature,
		maxTokens: request.maxTokens,
		...request.signal === void 0 ? {} : { signal: request.signal }
	};
	let text = "";
	let aux = "";
	const kinds = [];
	const samples = [];
	let usage = null;
	for await (const chunk of llm.stream(options)) {
		kinds.push(chunk.type);
		if (samples.length < 6) samples.push(JSON.stringify(chunk).slice(0, 220));
		if (chunk.type === "text-delta") {
			text += chunk.text;
			request.onDelta?.(chunk.text);
			continue;
		}
		if (chunk.type !== "usage") {
			const record = chunk;
			for (const key of [
				"text",
				"reasoning",
				"delta",
				"content"
			]) {
				const value = record[key];
				if (typeof value === "string") aux += value;
			}
			continue;
		}
		if (chunk.type === "usage") {
			const total = chunk.usage;
			usage = { totalTokens: total.totalTokens ?? (total.inputTokens ?? 0) + (total.outputTokens ?? 0) };
		}
	}
	try {
		if (process.env["VITEST"] !== void 0) throw new Error("skip-in-test");
		const { writeFileSync, mkdirSync } = await import("node:fs");
		const { tmpdir } = await import("node:os");
		const { join } = await import("node:path");
		const dir = join(tmpdir(), "dream-studio-debug");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "llm-last.json"), JSON.stringify({
			provider: request.route.provider,
			model: request.route.model,
			kinds,
			samples,
			textLen: text.length,
			auxLen: aux.length,
			textPreview: text.slice(0, 400),
			auxPreview: aux.slice(0, 400),
			systemLen: request.system?.length ?? 0
		}, null, 2));
	} catch {}
	if (text.trim() === "") throw new Error("模型没有返回任何内容，请重试或换一个模型");
	return {
		text,
		usage
	};
}
// lib/types/assistant/index.js
/** 六段结构（手册 5.11）。 */
/**
* 取一条可调用的路由：优先用请求里指定的，否则用第一条。
* @param llm - 宿主 LLM 服务。
* @param wanted - 请求指定的路由。
* @returns 路由。
*/
async function routeOf(llm, wanted) {
	if (wanted !== void 0) return wanted;
	const first = (await listAssistantRoutes(llm))[0];
	if (first === void 0) throw new Error("宿主还没有配置模型，无法使用助手");
	return first;
}
/**
* 改写提示词。
* @param llm - 宿主 LLM 服务。
* @param input - 原文、模式与风格。
* @returns 改写结果。
*/
/**
* 把中文稿改写成 MiniMax H3 **官方模板**（英文）。
*
* 首尾帧走官方 FL2VA：对齐行 + integrated_multimodal_description（四拍路径）+
* overall_soundscape + non_diegetic_music。
* 全能参考走官方 Ref2VA：subject_definitions / summary / retention_analysis /
* detailed_description / overall_soundscape / non_diegetic_music。
* @param llm - 宿主 LLM 服务。
* @param input - 原文、模式、时长与镜头数。
* @returns 改写结果（英文提示词）。
*/
async function rewritePrompt(llm, input) {
	const text = input.text.trim();
	if (text === "") throw new Error("请先写下要改写的提示词");
	const route = await routeOf(llm, input.route);
	const duration = typeof input.duration === "number" && Number.isFinite(input.duration) && input.duration > 0 ? input.duration.toFixed(2) : "10.00";
	const lastShot = Math.max(1, Math.round(input.shots ?? 1));
	const system = input.mode === "frames" ? [
		"Write the English fields of a MiniMax H3 FL2VA prompt from the Chinese storyboard below.",
		"Output ONLY these three lines, nothing else. Do not analyse the template, do not explain, do not think out loud.",
		"integrated_multimodal_description: <English description>",
		"overall_soundscape: <English sound description>",
		"non_diegetic_music: <English music description or N/A>",
		"How to write integrated_multimodal_description:",
		"- Shot 1 opens with: [Shot 1] <style>, <what Picture 1 shows>, matching the position, framing and lighting established by Picture 1.",
		"- Then describe what happens between the frames: camera motion (type + amplitude + speed as one natural phrase), then the observable intermediate changes in order.",
		"- The last shot ends with: the differences narrow until <what Picture 2 shows>, landing on the exact pose, spacing and composition established by Picture 2 at the " + duration + "-second mark.",
		"- Keep the Chinese shot order and cut times; later shots open with [Shot N] At 00:0X.XXX, the camera cuts to ...",
		"- Copy dialogue verbatim, keep the [中文] tag: The character (S1) says: <d>[中文] …</d>",
		"- English only outside dialogue. Never invent people, props or places."
	].join(NL) : [
		"Write the English fields of a MiniMax H3 Ref2VA prompt from the Chinese draft below.",
		"Output ONLY these six lines, nothing else. Do not analyse the format, do not explain, do not think out loud.",
		"subject_definitions: <English>",
		"summary: <task type + one line, English>",
		"retention_analysis: <English, use fully_preserved / partially_preserved / attribute_transfer / weak_reference>",
		"detailed_description: <English playback-order description>",
		"overall_soundscape: <English or N/A>",
		"non_diegetic_music: <English or N/A>",
		"Rules: name content as <Subject N> and wired images as <Picture N>; summary starts with one of: keyframe completion / reference generation / video editing / video continuation / audio reuse / audio reference; copy dialogue verbatim with the [中文] tag; English only outside dialogue; never invent people or props."
	].join(NL);
	const attempts = input.mode === "frames" ? [
		system,
		[
			"Convert this Chinese shot into three English fields, one per line, as \"key: value\":",
			"integrated_multimodal_description / overall_soundscape / non_diegetic_music",
			"English only, but keep every <d>[中文] …</d> dialogue exactly as in the source."
		].join(String.fromCharCode(10)),
		"Translate this Chinese storyboard shot into English. Keep every <d>[中文] …</d> dialogue in Chinese, verbatim. Output only the translation, no headings, no commentary, one paragraph."
	] : [
		system,
		[
			"Convert this Chinese draft into six English fields, one per line, as \"key: value\":",
			"subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music",
			"English only."
		].join(String.fromCharCode(10)),
		"Translate this Chinese director draft into English. Keep every <d>[中文] …</d> dialogue in Chinese, verbatim. Output only the translation, no headings, no commentary."
	];
	let completion = null;
	for (const attempt of attempts) try {
		const result = await completeAssistant(llm, {
			route,
			system: attempt,
			prompt: text,
			temperature: .6,
			maxTokens: 6e3
		});
		if (result.text.trim() !== "") {
			completion = result;
			break;
		}
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes("没有返回任何内容")) throw error;
	}
	if (completion === null) {
		const others = (await listAssistantRoutes(llm)).filter((each) => each.provider !== route.provider || each.model !== route.model);
		for (const other of others.slice(0, 2)) try {
			const retried = await completeAssistant(llm, {
				route: other,
				system: attempts[attempts.length - 1] ?? "",
				prompt: text,
				temperature: .6,
				maxTokens: 6e3
			});
			if (retried.text.trim() !== "") {
				completion = retried;
				break;
			}
		} catch {}
	}
	if (completion === null) return {
		text: input.mode === "frames" ? assembleFrames({ integrated_multimodal_description: text }, duration, lastShot) : assembleReference({ detailed_description: text }),
		usage: null,
		route
	};
	const fields = fieldsOf(completion.text);
	const assembled = input.mode === "frames" ? assembleFrames(fields, duration, lastShot) : assembleReference(fields);
	return {
		...completion,
		text: restoreDialogue(text, assembled),
		route
	};
}
/**
* 中英互译（英译中保留 <Picture N> 与六段结构）。
* @param llm - 宿主 LLM 服务。
* @param input - 原文与方向。
* @returns 译文。
*/
async function translatePrompt(llm, input) {
	const text = input.text.trim();
	if (text === "") throw new Error("请先写下要翻译的提示词");
	const route = await routeOf(llm, input.route);
	return {
		...await completeAssistant(llm, {
			route,
			system: input.direction === "zh-en" ? [
				"你是影视提示词译者，把中文导演稿译成英文，供 MiniMax H3 使用。",
				"要求：",
				"1. 保留 <Picture N> 原样，编号不变。",
				"2. 保留原有的分段（最多六段），不要合并、不要加小标题。",
				"3. 用短句、动词开头；不用 \"the camera does a ...\" 这类元描述。",
				"4. 只输出译文。"
			].join("\n") : [
				"你是影视提示词译者，把英文提示词译回中文导演稿。",
				"要求：",
				"1. 保留 <Picture N> 原样，编号不变。",
				"2. 保留原有分段，不要合并、不要加小标题。",
				"3. 用中文导演口吻，避免翻译腔。",
				"4. 只输出译文。"
			].join("\n"),
			prompt: text,
			temperature: .2,
			maxTokens: 900
		}),
		route
	};
}
/**
* 从一段描述里提取素材提示词（人物三视图 / 场景）。
* @param llm - 宿主 LLM 服务。
* @param input - 描述与类型。
* @returns 提取结果。
*/
async function describeAsset(llm, input) {
	const text = input.prompt.trim();
	if (text === "") throw new Error("请先写下这个素材的描述");
	const route = await routeOf(llm, input.route);
	return {
		...await completeAssistant(llm, {
			route,
			system: input.kind === "character" ? [
				"你在为漫剧写\"人物三视图\"的生成提示词。",
				"输出三段，每段一行，段首标注：正面全身：/ 侧面全身：/ 背面全身：。",
				"每段写清：年龄与性别、发型、服装（材质与颜色）、体态、表情基调。",
				"背景统一写\"纯白背景，棚拍柔光，全身入画，无遮挡\"。",
				"不写名字、不写剧情、不写镜头运动，只输出三段正文。"
			].join("\n") : [
				"你在为漫剧写\"场景概念图\"的生成提示词。",
				"输出一段，写清：地点与时代、主要建筑/地形、天气与时间、主光方向、色彩基调、画面里应出现的道具。",
				"不出现人物（除非描述里明确要求），不写镜头运动，只输出一段正文。"
			].join("\n"),
			prompt: text,
			temperature: .5,
			maxTokens: 700
		}),
		route
	};
}
/** Ref2VA 的六个字段（官方顺序）。 */
const REF_FIELDS = [
	"subject_definitions",
	"summary",
	"retention_analysis",
	"detailed_description",
	"overall_soundscape",
	"non_diegetic_music"
];
/** 逗号换行（避免在源码里写模板字符串）。 */
const NL = String.fromCharCode(10);
/**
* 从模型输出取字段：先按 JSON 解，失败就按 `key: value` 逐行扫。
* @param raw - 模型原始输出。
* @returns 字段表。
*/
function fieldsOf(raw) {
	const tick = String.fromCharCode(96);
	const cleaned = raw.split(/\r?\n/u).filter((line) => !line.trim().startsWith(tick)).join(NL).trim();
	const first = cleaned.indexOf("{");
	const last = cleaned.lastIndexOf("}");
	if (first >= 0 && last > first) try {
		const parsed = JSON.parse(cleaned.slice(first, last + 1));
		if (typeof parsed === "object" && parsed !== null) {
			const out = {};
			for (const [key, value] of Object.entries(parsed)) if (typeof value === "string" && value.trim() !== "") out[key] = value.trim();
			if (Object.keys(out).length > 0) return out;
		}
	} catch {}
	const out = {};
	let current = "";
	for (const line of cleaned.split(/\r?\n/u)) {
		const match = /^([a-z_]+):\s*(.*)$/u.exec(line);
		if (match !== null && match[1] !== void 0) {
			current = match[1];
			out[current] = (match[2] ?? "").trim();
		} else if (current !== "") out[current] = ((out[current] ?? "") + " " + line.trim()).trim();
	}
	if (Object.keys(out).length === 0) out["integrated_multimodal_description"] = cleaned;
	return out;
}
/**
* 拼 FL2VA：对齐行 + 三个字段，骨架由宿主固定。
* @param fields - 模型给的字段。
* @param duration - 片段时长（两位小数）。
* @param lastShot - 最后一格序号。
* @returns 官方格式文本。
*/
function assembleFrames(fields, duration, lastShot) {
	const alignment = "How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot " + String(lastShot) + ") aligns with the " + duration + "-second mark of the target video.";
	const body = fields["integrated_multimodal_description"] ?? fields["detailed_description"] ?? "";
	const sound = fields["overall_soundscape"] ?? "N/A";
	const music = fields["non_diegetic_music"] ?? "N/A";
	return [
		alignment,
		"",
		"integrated_multimodal_description: " + body,
		"overall_soundscape: " + sound,
		"non_diegetic_music: " + music
	].join(NL);
}
/**
* 拼 Ref2VA：六个字段按官方顺序，缺的补 N/A。
* @param fields - 模型给的字段。
* @returns 官方格式文本。
*/
function assembleReference(fields) {
	const prose = fields["detailed_description"] ?? fields["integrated_multimodal_description"] ?? "";
	const merged = { ...fields };
	if (merged["detailed_description"] === void 0 && prose !== "") merged["detailed_description"] = prose;
	return REF_FIELDS.map((name) => name + ": " + (merged[name] ?? "N/A")).join(NL);
}
/**
* 把输出里的台词换回原文（按出现顺序一一对应）。
* @param source - 用户原文（含 <d>…</d>）。
* @param output - 模型输出（可能把台词译成了英文）。
* @returns 台词已还原的文本。
*/
function restoreDialogue(source, output) {
	const originals = [...source.matchAll(/<d>([\s\S]*?)<\/d>/gu)].map((each) => (each[1] ?? "").trim());
	if (originals.length === 0) return output;
	let index = 0;
	return output.replace(/<d>([\s\S]*?)<\/d>/gu, (whole) => {
		const original = originals[index];
		index += 1;
		return original === void 0 ? whole : "<d>" + original + "</d>";
	});
}
// lib/types/http/routes/assistant.js
/** 路由需要宿主 LLM 服务；没配就返回中文原因。 */
function llmOf(deps) {
	if (deps.llm === null) throw new Error("宿主没有提供 LLM 服务，助手不可用");
	return deps.llm;
}
/** 构造路由表。 */
function assistantRoutes(deps) {
	const llm = () => llmOf(deps);
	return [
		{
			method: "GET",
			pattern: "/assistant/models",
			handler: async () => {
				if (deps.llm === null) return json({ routes: [] });
				return json({ routes: await listAssistantRoutes(llm()) });
			}
		},
		{
			method: "POST",
			pattern: "/assistant/rewrite",
			handler: async ({ request }) => {
				const source = await bodyOf(request);
				const text = textOf(source, "text");
				if (text === void 0) return failure("请提供要改写的提示词");
				const mode = textOf(source, "mode") === "frames" ? "frames" : "reference";
				const tone = textOf(source, "tone");
				const duration = numberOf(source, "duration");
				const shots = numberOf(source, "shots");
				return json(await rewritePrompt(llm(), {
					text,
					mode,
					...tone === "concise" || tone === "literal" ? { tone } : {},
					...duration === void 0 ? {} : { duration },
					...shots === void 0 ? {} : { shots }
				}));
			}
		},
		{
			method: "POST",
			pattern: "/assistant/translate",
			handler: async ({ request }) => {
				const source = await bodyOf(request);
				const text = textOf(source, "text");
				if (text === void 0) return failure("请提供要翻译的提示词");
				const direction = textOf(source, "direction") === "en-zh" ? "en-zh" : "zh-en";
				return json(await translatePrompt(llm(), {
					text,
					direction
				}));
			}
		},
		{
			method: "POST",
			pattern: "/assistant/describe",
			handler: async ({ request }) => {
				const source = await bodyOf(request);
				const prompt = textOf(source, "prompt");
				if (prompt === void 0) return failure("请提供素材描述");
				const kind = textOf(source, "kind") === "scene" ? "scene" : "character";
				return json(await describeAsset(llm(), {
					prompt,
					kind
				}));
			}
		}
	];
}
// lib/types/http/routes/clips.js
/**
* 片段路由：新建、改、删、排序、读、取成片。
*
* 路径都带项目前缀，这样每次写都能直接定位到项目库，不需要从片段 id 反查项目。
* @module dsh-dream-studio-host/http/routes/clips
*/
/**
* 把一个可选值写进变更对象。
* @param out - 变更对象。
* @param key - 字段。
* @param value - 值；undefined 表示"这次不改"。
*/
function assign(out, key, value) {
	if (value !== void 0) out[key] = value;
}
/**
* 把请求体读成片段变更。
* @param source - 请求体。
* @returns 变更对象；字段类型不对时抛中文错误。
*/
function clipInput(source) {
	const out = {};
	const mode = textOf(source, "mode");
	if (mode !== void 0 && !CLIP_MODES.includes(mode)) throw new Error("片段模式只能是首尾帧或全能参考");
	assign(out, "mode", mode === void 0 ? void 0 : mode);
	assign(out, "prompt", textOf(source, "prompt"));
	assign(out, "promptEn", textOf(source, "promptEn"));
	assign(out, "duration", numberOf(source, "duration"));
	assign(out, "fps", source["fps"] === null ? null : numberOf(source, "fps"));
	assign(out, "scale", source["scale"] === null ? null : numberOf(source, "scale"));
	assign(out, "ratio", source["ratio"] === null ? null : textOf(source, "ratio"));
	assign(out, "resolution", source["resolution"] === null ? null : textOf(source, "resolution"));
	assign(out, "seed", source["seed"] === null ? null : numberOf(source, "seed"));
	assign(out, "firstPassSteps", source["firstPassSteps"] === null ? null : numberOf(source, "firstPassSteps"));
	assign(out, "secondPass", boolOf(source, "secondPass"));
	assign(out, "secondDenoise", source["secondDenoise"] === null ? null : numberOf(source, "secondDenoise"));
	assign(out, "secondScale", source["secondScale"] === null ? null : numberOf(source, "secondScale"));
	assign(out, "secondSteps", source["secondSteps"] === null ? null : numberOf(source, "secondSteps"));
	assign(out, "continueFromPrev", boolOf(source, "continueFromPrev"));
	assign(out, "firstFrameFromPrev", boolOf(source, "firstFrameFromPrev"));
	assign(out, "guideFrameCount", source["guideFrameCount"] === null ? null : numberOf(source, "guideFrameCount"));
	assign(out, "firstFrameAssetId", source["firstFrameAssetId"] === null ? null : textOf(source, "firstFrameAssetId"));
	assign(out, "lastFrameAssetId", source["lastFrameAssetId"] === null ? null : textOf(source, "lastFrameAssetId"));
	assign(out, "workflowId", source["workflowId"] === null ? null : textOf(source, "workflowId"));
	if (Array.isArray(source["loras"])) assign(out, "loras", source["loras"]);
	if (Array.isArray(source["refs"])) assign(out, "refs", source["refs"]);
	return out;
}
/** 片段路由表。 */
const clipRoutes = [
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/clips",
		handler: async ({ request, store, params }) => {
			const projectId = params["project"] ?? "";
			const episodeId = params["episode"] ?? "";
			const episode = store.listEpisodes(projectId).find((entry) => entry.id === episodeId);
			if (episode === void 0) return failure("剧集不存在", 404);
			if (!episode.custom) return failure("只有「自定义剧集」可以手动新增片段；系列剧集请改 series.json 后重新扫描");
			const source = await bodyOf(request);
			return json(store.addClip(projectId, episodeId, clipInput(source)), 201);
		}
	},
	{
		method: "PATCH",
		pattern: "/projects/:project/clips/:clip",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			return json(store.updateClip(params["project"] ?? "", params["clip"] ?? "", clipInput(source)));
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/clips/:clip",
		handler: ({ store, params }) => json(store.deleteClip(params["project"] ?? "", params["clip"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/move",
		handler: async ({ request, store, params }) => {
			const index = numberOf(await bodyOf(request), "index");
			if (index === void 0) return failure("请指定目标位置 index");
			return json(store.moveClip(params["project"] ?? "", params["clip"] ?? "", index));
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/clips/:clip",
		handler: ({ store, params }) => {
			const clip = store.payload(params["project"] ?? "", null).clips.find((entry) => entry.id === params["clip"]);
			if (clip === void 0) return failure("片段不存在", 404);
			return json(clip);
		}
	},
	{
		method: "PUT",
		pattern: "/projects/:project/clips/:clip/slots",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const slotKey = textOf(source, "slotKey");
			if (slotKey === void 0 || slotKey.trim() === "") return failure("请指定槽位");
			const assetId = source["assetId"] === null ? null : textOf(source, "assetId");
			if (assetId === void 0) return failure("assetId 必须是字符串或 null");
			store.setSlotAsset(params["project"] ?? "", params["clip"] ?? "", slotKey, assetId);
			return json(store.payload(params["project"] ?? "", null));
		}
	},
	{
		method: "PATCH",
		pattern: "/projects/:project/clips/:clip/slots/:slot",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			const slot = params["slot"] ?? "";
			if ("assetId" in source) {
				const assetId = source["assetId"] === null ? null : textOf(source, "assetId");
				if (assetId === void 0) return failure("assetId 必须是字符串或 null");
				store.setSlotAsset(projectId, clipId, slot, assetId);
			}
			if ("atSeconds" in source) {
				const at = source["atSeconds"];
				if (at !== null && typeof at !== "number") return failure("atSeconds 必须是数字或 null");
				store.setSlotAnchor(projectId, clipId, slot, at === null ? null : at);
			}
			return json(store.payload(projectId, store.clipEpisodeId(projectId, params["clip"] ?? "")));
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/slots",
		handler: async ({ request, store, params }) => {
			const at = (await bodyOf(request))["atSeconds"];
			if (at !== void 0 && at !== null && typeof at !== "number") return failure("atSeconds 必须是数字");
			const projectId = params["project"] ?? "";
			return json({
				slotKey: store.addSlot(projectId, params["clip"] ?? "", at === null || at === void 0 ? void 0 : at),
				payload: store.payload(projectId, store.clipEpisodeId(projectId, params["clip"] ?? ""))
			}, 201);
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/clips/:clip/slots/:slot",
		handler: ({ store, params }) => {
			const projectId = params["project"] ?? "";
			store.removeSlot(projectId, params["clip"] ?? "", params["slot"] ?? "");
			return json(store.payload(projectId, store.clipEpisodeId(projectId, params["clip"] ?? "")));
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/clips/:clip/refs/:position",
		handler: ({ store, params }) => {
			const position = Number(params["position"] ?? "");
			if (!Number.isFinite(position)) return failure("参考位序号不合法");
			const projectId = params["project"] ?? "";
			store.removeRef(projectId, params["clip"] ?? "", position);
			return json(store.payload(projectId, store.clipEpisodeId(projectId, params["clip"] ?? "")));
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/drafts",
		handler: async ({ request, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const source = await bodyOf(request);
			const prompt = textOf(source, "prompt");
			if (prompt === void 0 || prompt.trim() === "") return failure("请先填写提示词再生成图片");
			const refs = Array.isArray(source["refImages"]) ? source["refImages"].filter((entry) => typeof entry === "string") : [];
			const seed = numberOf(source, "seed");
			const ratio = textOf(source, "ratio");
			const size = numberOf(source, "size");
			const tileX = numberOf(source, "tileX");
			const tileY = numberOf(source, "tileY");
			const cfg = numberOf(source, "cfg");
			const steps = numberOf(source, "steps");
			return json({ jobId: engine.enqueueClipPicture(params["project"] ?? "", params["clip"] ?? "", {
				prompt,
				...seed === void 0 ? {} : { seed },
				...source["tile"] === true ? { tile: true } : {},
				...tileX === void 0 ? {} : { tileX },
				...tileY === void 0 ? {} : { tileY },
				...cfg === void 0 ? {} : { cfg },
				...steps === void 0 ? {} : { steps },
				...source["reference"] === true ? { reference: true } : {},
				...ratio === void 0 ? {} : { ratio },
				...size === void 0 ? {} : { shortSide: size },
				...refs.length === 0 ? {} : { refAssetIds: refs }
			}, textOf(source, "serverId")) }, 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/clips/:clip/drafts",
		handler: ({ store, params }) => json(store.listClipDrafts(params["project"] ?? "", params["clip"] ?? ""))
	},
	{
		method: "GET",
		pattern: "/projects/:project/clips/:clip/drafts/:draft",
		handler: ({ request, store, params }) => {
			const path = store.clipDraftPath(params["project"] ?? "", params["clip"] ?? "", params["draft"] ?? "");
			if (!existsSync(path)) return failure("这张草稿图已经不在磁盘上", 404);
			return serveFile(request, {
				path,
				name: `${params["draft"] ?? "draft"}.png`,
				mime: "image/png",
				mutable: true
			});
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/clips/:clip/drafts/:draft",
		handler: ({ store, params }) => {
			store.deleteClipDraft(params["project"] ?? "", params["clip"] ?? "", params["draft"] ?? "");
			return json({ ok: true });
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/drafts/:draft/adopt",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const library = textOf(source, "library") === "episode" ? "episode" : "project";
			const episodeId = textOf(source, "episodeId");
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			const draftId = params["draft"] ?? "";
			const draft = store.listClipDrafts(projectId, clipId).find((entry) => entry.id === draftId);
			if (draft === void 0) return failure("草稿不存在", 404);
			const bytes = new Uint8Array(readFileSync(store.clipDraftPath(projectId, clipId, draftId)));
			const stated = textOf(source, "name");
			return json(importAsset(store, projectId, {
				name: (stated ?? "").trim() !== "" ? String(stated) : `${draft.prompt.slice(0, 12).replace(/[\/:*?"<>|]/gu, "_") || "草稿"}.png`,
				mime: "image/png",
				bytes,
				library,
				...library === "episode" && episodeId !== void 0 ? { episodeId } : {},
				category: "generated"
			}), 201);
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/second-pass",
		handler: ({ engine, store, params }) => {
			if (engine === null) return failure("调度器未启动");
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			const episodeId = store.clipEpisodeId(projectId, clipId);
			if (episodeId === null) return failure("片段不存在", 404);
			return json({ jobId: engine.enqueueSecondPass(projectId, episodeId, clipId) }, 201);
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/upscale",
		handler: async ({ request, engine, store, params }) => {
			if (engine === null) return failure("调度器未启动");
			const level = textOf(await bodyOf(request), "level") === "4k" ? "4k" : "2k";
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			const episodeId = store.clipEpisodeId(projectId, clipId);
			if (episodeId === null) return failure("片段不存在", 404);
			return json({ jobId: engine.enqueueVideoUpscale(projectId, episodeId, clipId, level) }, 201);
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/interpolate",
		handler: async ({ request, engine, store, params }) => {
			if (engine === null) return failure("调度器未启动");
			const multiplier = numberOf(await bodyOf(request), "multiplier") ?? 10;
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			const episodeId = store.clipEpisodeId(projectId, clipId);
			if (episodeId === null) return failure("片段不存在", 404);
			return json({ jobId: engine.enqueueVideoInterpolate(projectId, episodeId, clipId, multiplier) }, 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/clips/:clip/videos",
		handler: ({ store, params }) => json(store.listClipVideos(params["project"] ?? "", params["clip"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/clips/:clip/videos/:video/activate",
		handler: ({ store, params }) => {
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			store.activateClipVideo(projectId, clipId, params["video"] ?? "");
			const episodeId = store.clipEpisodeId(projectId, clipId);
			return episodeId === null ? json({ ok: true }) : json(store.payload(projectId, episodeId));
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/clips/:clip/videos/:video",
		handler: ({ store, params }) => {
			const projectId = params["project"] ?? "";
			const clipId = params["clip"] ?? "";
			store.deleteClipVideo(projectId, clipId, params["video"] ?? "");
			const episodeId = store.clipEpisodeId(projectId, clipId);
			return episodeId === null ? json({ ok: true }) : json(store.payload(projectId, episodeId));
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/clips/:clip/result",
		handler: ({ request, store, params }) => {
			const found = store.clipResult(params["project"] ?? "", params["clip"] ?? "");
			if (found === null) return failure("该片段还没有成片", 404);
			if (!existsSync(found.path)) return failure("成片文件已不在磁盘上", 404);
			return serveFile(request, {
				path: found.path,
				name: found.name,
				mime: "video/mp4",
				mutable: true
			});
		}
	}
];
// lib/types/series/plan.js
/** 安全取对象。 */
function recordOf(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
/** 安全取数组。 */
function arrayOf(value) {
	return Array.isArray(value) ? value : [];
}
/** 安全取字符串。 */
function stringOf(value, fallback = "") {
	return typeof value === "string" ? value : fallback;
}
/** 安全取数字。 */
function numberOrNull(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
/**
* 读一个片段的制作模式。
*
* 新契约（skill v2）直接写 `frames` / `reference`；旧库与旧片段包写
* `i2v` / `r2v` / `fl2v` / `t2v`。这里两套字面量都认——**只认旧字面量会让
* `reference` 被静默降级成 frames**（写集的人以为走了全能参考，插件却按首尾帧出片）。
* 不认识的写法仍按 frames 处理，但记一条 issue，不再静默。
* @param value - 文档里写的模式。
* @param issues - 收集问题的列表。
* @param tag - 片段标识，用于报错定位。
* @returns 落库用的模式。
*/
function modeOf(value, issues, tag) {
	const text = value.trim().toLowerCase();
	if (text === "reference" || text === "r2v") return "reference";
	if (text === "frames" || text === "i2v" || text === "fl2v" || text === "t2v") return "frames";
	issues.push(`${tag}：mode=${text === "" ? "（空）" : text} 不认识，按 frames 处理`);
	return "frames";
}
/**
* 判断一个已解析的文档是不是 series。
* @param value - 解析后的 JSON。
* @returns 是则 true。
*/
function isSeriesDocument(value) {
	const record = recordOf(value);
	const stories = arrayOf(record["stories"]);
	if (stories.length === 0) return false;
	if (stringOf(record["schema"]).startsWith("time-river/series")) return true;
	return stories.every((story) => typeof recordOf(story)["text"] === "string");
}
/**
* 把一条 series slot 换算成落库形态。
*
* `frameIndex` 优先用 skill 写的值，否则用 `round(at × fps)`；两者都没有就留空，
* 由生成前的 `alignFrames` 决定。
* @param slot - skill 写的槽。
* @param fps - 片段帧率。
* @returns 落库输入，或 null（角色非法）。
*/
function slotOf(slot, fps) {
	const rawRole = stringOf(slot["role"]);
	const role = rawRole === "first" || rawRole === "last" ? rawRole : rawRole === "keyframe" ? "keyframe" : rawRole === "board" ? "board" : null;
	if (role === null) return null;
	const prompt = stringOf(slot["prompt"]);
	if (prompt.trim() === "") return null;
	const at = numberOrNull(slot["at"]);
	const stated = numberOrNull(slot["frameIndex"]);
	const n = role === "keyframe" ? Math.max(1, Math.round(numberOrNull(slot["n"]) ?? 1)) : null;
	const key = role === "first" ? "first" : role === "last" ? "last" : role === "board" ? "board" : `kf-${String(n ?? 1)}`;
	const imageRefs = arrayOf(slot["imageRefs"]).filter((name) => typeof name === "string");
	return {
		key,
		role,
		n,
		atSeconds: at ?? (stated === null || fps <= 0 ? null : Math.round(stated / fps * 1e3) / 1e3),
		frameIndex: stated ?? (at === null ? null : Math.round(at * fps)),
		prompt,
		imageRefs
	};
}
/**
* 把 series 文档投影成期望片段列表。
* @param series - 已解析的文档。
* @param fallbackFps - `consts.fps` 缺失时用的帧率。
* @returns 计划。
*/
/** 把 series 的 assets 块读成落库形态。 */
function assetsOf(value) {
	const out = [];
	const push = (list, kind) => {
		for (const entry of arrayOf(list)) {
			const record = recordOf(entry);
			const id = stringOf(record["id"]);
			if (id === "") continue;
			out.push({
				id,
				name: stringOf(record["name"], id),
				kind,
				file: stringOf(record["file"]),
				version: numberOrNull(record["version"]) ?? 0,
				status: stringOf(record["status"]),
				desc: stringOf(record["desc"]),
				prompt: stringOf(record["prompt"]),
				segments: arrayOf(record["segments"]).filter((each) => typeof each === "string")
			});
		}
	};
	const block = recordOf(value);
	push(block["characters"], "character");
	push(block["scenes"], "scene");
	push(block["props"], "prop");
	return out;
}
function planSeries(series, fallbackFps = 24) {
	const root = recordOf(series);
	const fps = numberOrNull(recordOf(root["consts"])["fps"]) ?? fallbackFps;
	const meta = recordOf(root["series"]);
	const derived = recordOf(root["derived"]);
	const index = /* @__PURE__ */ new Map();
	for (const entry of arrayOf(derived["clips"])) {
		const value = recordOf(entry);
		const sid = stringOf(value["sid"]);
		const k = stringOf(value["k"]);
		if (sid === "" || k === "") continue;
		index.set(`${sid}/${k}`, {
			id: stringOf(value["id"]) === "" ? `${sid}-${k}` : stringOf(value["id"]),
			dur: numberOrNull(value["dur"])
		});
	}
	const clips = [];
	const issues = [];
	const pictures = /* @__PURE__ */ new Set();
	for (const storyValue of arrayOf(root["stories"])) {
		const story = recordOf(storyValue);
		const sid = stringOf(story["sid"]);
		for (const clipValue of arrayOf(story["clips"])) {
			const clip = recordOf(clipValue);
			const k = stringOf(clip["k"]);
			if (k === "") {
				issues.push(`${sid || "?"}：有一个片段缺少 k，已跳过`);
				continue;
			}
			const solved = index.get(`${sid}/${k}`);
			const duration = solved?.dur ?? null;
			if (duration === null || duration <= 0) {
				issues.push(`${sid}-${k}：derived 里没有时长（dur），已跳过——请让 skill 重新出 derived`);
				continue;
			}
			const slots = [];
			for (const slotValue of arrayOf(clip["slots"])) {
				const slot = slotOf(recordOf(slotValue), fps);
				if (slot !== null) slots.push(slot);
			}
			const refNames = arrayOf(clip["refImages"]).filter((name) => typeof name === "string");
			for (const name of refNames) pictures.add(name);
			clips.push({
				seriesKey: solved?.id ?? `${sid}-${k}`,
				mode: modeOf(stringOf(clip["mode"], "r2v"), issues, `${sid}-${k}`),
				prompt: stringOf(clip["prompt"]) === "" ? stringOf(clip["desc"]) : stringOf(clip["prompt"]),
				duration,
				continueFromPrev: clip["cont"] === true,
				seed: numberOrNull(clip["seed"]),
				guideFrameCount: numberOrNull(clip["guideFrameCount"]),
				refNames,
				slots
			});
		}
	}
	return {
		title: stringOf(meta["title"]),
		clips,
		issues,
		pictures: [...pictures],
		assets: assetsOf(root["assets"])
	};
}
// lib/types/series/sync.js
/**
* 整体替换一个片段的槽清单（保留素材与关键帧绑定）。
* @param db - 项目库。
* @param clipId - 片段。
* @param slots - 期望槽。
*/
function replaceSlots(db, clipId, slots) {
	const keys = new Set(slots.map((slot) => slot.key));
	const existing = db.prepare("SELECT slot_key FROM clip_slots WHERE clip_id = ?").all(clipId);
	for (const row of existing) if (!keys.has(row.slot_key)) db.prepare("DELETE FROM clip_slots WHERE clip_id = ? AND slot_key = ?").run(clipId, row.slot_key);
	for (const slot of slots) db.prepare(`INSERT INTO clip_slots (clip_id, slot_key, role, n, at_seconds, frame_index, prompt, image_refs, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'series')
       ON CONFLICT(clip_id, slot_key) DO UPDATE SET
         role = excluded.role, n = excluded.n, at_seconds = excluded.at_seconds,
         frame_index = excluded.frame_index, prompt = excluded.prompt,
         image_refs = excluded.image_refs`).run(clipId, slot.key, slot.role, slot.n ?? null, slot.atSeconds ?? null, slot.frameIndex ?? null, slot.prompt ?? "", JSON.stringify(slot.imageRefs ?? []));
}
/**
* 按名字找素材：名字、存储名、存储名后缀三种都认。
*
* 为什么不能只按 `name`：插件导入时磁盘文件会被改成 `<uuid8>-<原名>`，用户在素材库里
* 重命名之后 `name` 又变一次。`series.json` 里的参考图名可能写成其中任何一种，
* 只按 `name` 精确匹配会让改名后的素材全部绑不上（右栏变成空白参考位）。
* @param db - 项目库。
* @param name - series 里写的参考图名。
* @returns 素材 id；找不到为 null。
*/
function resolveAssetId(db, name) {
	const exact = db.prepare("SELECT id FROM assets WHERE name = ? ORDER BY created_at LIMIT 1").get(name);
	if (exact !== void 0) return exact.id;
	const stored = db.prepare("SELECT id FROM assets WHERE stored_name = ? ORDER BY created_at LIMIT 1").get(name);
	if (stored !== void 0) return stored.id;
	const alias = db.prepare("SELECT id FROM assets WHERE instr(aliases, ?) > 0 ORDER BY created_at LIMIT 1").get("\"" + name + "\"");
	if (alias !== void 0) return alias.id;
	const stem = name.replace(/\.[^.]+$/u, "");
	const head = `${stem}-`;
	if (stem !== "") {
		const prefixed = db.prepare("SELECT id FROM assets WHERE substr(stored_name, 1, ?) = ? OR substr(name, 1, ?) = ? ORDER BY created_at DESC LIMIT 1").get(head.length, head, head.length, head);
		if (prefixed !== void 0) return prefixed.id;
	}
	return db.prepare("SELECT id FROM assets WHERE stored_name LIKE '%' || ? ORDER BY created_at LIMIT 1").get(name)?.id ?? null;
}
/**
* 整体替换一个片段的图片参考位（按文件名匹配已导入的素材）。
*
* 绑定的依据是 `asset_id`——名字只是"重新扫描时怎么找回这张素材"的钥匙。
* 素材还没导入时 id 留空、名字照记：右栏因此能显示"缺图"，素材一导入下次同步就绑上。
* @param db - 项目库。
* @param clipId - 片段。
* @param names - 参考图文件名，顺序即 position。
*/
function replaceRefs(db, clipId, names) {
	const previous = /* @__PURE__ */ new Map();
	for (const row of db.prepare("SELECT position, asset_id FROM clip_refs WHERE clip_id = ? AND kind = 'image'").all(clipId)) if (row.asset_id !== null) previous.set(String(row.position), row.asset_id);
	db.prepare("DELETE FROM clip_refs WHERE clip_id = ? AND kind = 'image'").run(clipId);
	names.forEach((name, position) => {
		let assetId = null;
		const kept = previous.get(String(position));
		if (kept !== void 0) {
			const alive = db.prepare("SELECT name, stored_name FROM assets WHERE id = ?").get(kept);
			if (alive !== void 0 && (alive.name === name || alive.stored_name === name || alive.stored_name.endsWith(name))) assetId = kept;
		}
		if (assetId === null) assetId = resolveAssetId(db, name);
		let label = name;
		if (assetId !== null) {
			const row = db.prepare("SELECT name FROM assets WHERE id = ?").get(assetId);
			if (row !== void 0 && row.name.trim() !== "") label = row.name;
		}
		db.prepare("INSERT INTO clip_refs (clip_id, kind, position, asset_id, asset_name, role) VALUES (?, 'image', ?, ?, ?, NULL)").run(clipId, position, assetId, label);
	});
}
/**
* 同步一个剧集的片段。
* @param store - 数据门面。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @param desired - 期望片段，按 series 顺序。
* @param hash - 本次 `series.json` 的 sha256。
* @param missing - 磁盘上找不到的图片名（由扫描阶段给出）。
* @returns 同步统计与新载荷。
*/
function syncSeries(store, projectId, episodeId, desired, hash, missing = []) {
	const issues = [];
	const result = store.withProjectDb(projectId, (db) => {
		db.exec("BEGIN");
		try {
			const existing = db.prepare("SELECT id, series_key, order_index, mode FROM clips WHERE episode_id = ? ORDER BY order_index").all(episodeId);
			const byKey = new Map(existing.filter((entry) => entry.series_key !== "").map((entry) => [entry.series_key, entry]));
			const wanted = new Set(desired.map((item) => item.seriesKey));
			const at = nowIso();
			let created = 0;
			let updated = 0;
			let cursor = -1;
			for (const item of desired) {
				const found = byKey.get(item.seriesKey);
				if (found !== void 0) {
					if (found.mode !== item.mode) issues.push(`${item.seriesKey}：series 写的是 ${item.mode}，片段当前是 ${found.mode}，已保留当前模式`);
					db.prepare(`UPDATE clips SET prompt = ?, duration = ?, continue_from_prev = ?,
               seed = COALESCE(?, seed), guide_frame_count = COALESCE(?, guide_frame_count), updated_at = ?
             WHERE id = ?`).run(item.prompt, item.duration, item.continueFromPrev ? 1 : 0, item.seed, item.guideFrameCount, at, found.id);
					replaceSlots(db, found.id, item.slots);
					replaceRefs(db, found.id, item.refNames);
					cursor = found.order_index;
					updated += 1;
					continue;
				}
				const insertAt = cursor + 1;
				db.prepare("UPDATE clips SET order_index = order_index + 1 WHERE episode_id = ? AND order_index >= ?").run(episodeId, insertAt);
				const id = crypto.randomUUID();
				db.prepare(`INSERT INTO clips (id, episode_id, order_index, series_key, mode, prompt, prompt_en, duration, fps,
             continue_from_prev, guide_frame_count, seed, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 'pending', ?, ?)`).run(id, episodeId, insertAt, item.seriesKey, item.mode, item.prompt, item.duration, 24, item.continueFromPrev ? 1 : 0, item.guideFrameCount, item.seed, at, at);
				replaceSlots(db, id, item.slots);
				replaceRefs(db, id, item.refNames);
				cursor = insertAt;
				created += 1;
			}
			const orphaned = existing.filter((entry) => entry.series_key !== "" && !wanted.has(entry.series_key)).map((entry) => entry.series_key);
			db.prepare("UPDATE episodes SET series_sha256 = ?, synced_at = ? WHERE id = ?").run(hash, at, episodeId);
			db.exec("COMMIT");
			return {
				created,
				updated,
				orphaned,
				issues
			};
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	});
	store.log("Project", `同步 series：新增 ${String(result.created)}、更新 ${String(result.updated)}、失联 ${String(result.orphaned.length)}`);
	return {
		created: result.created,
		updated: result.updated,
		orphaned: result.orphaned,
		issues: result.issues,
		missing,
		payload: store.payload(projectId, episodeId)
	};
}
// lib/types/series/scan.js
/**
* 工作区扫描：读剧集目录里的 `series.json`，算出计划，交给同步。
*
* 进入剧集与点"重新扫描"都走这里。指纹相同且不强制时直接返回"没变化"，
* 因此重复进入一个没改过的剧集不产生任何写操作。
* @module dsh-dream-studio-host/series/scan
*/
/**
* 读一个文件的 sha256。
* @param text - 文件内容。
* @returns 十六进制摘要。
*/
function sha256(text) {
	return createHash("sha256").update(text, "utf8").digest("hex");
}
/**
* 列一个剧集目录里可用的图片文件名（含 `material/` 子目录）。
* @param dir - 剧集目录。
* @returns 文件名集合。
*/
function picturesIn(dir) {
	const names = /* @__PURE__ */ new Set();
	const visit = (at, depth) => {
		if (depth > 2) return;
		let entries;
		try {
			entries = readdirSync(at);
		} catch {
			return;
		}
		for (const name of entries) {
			const full = join(at, name);
			try {
				if (statSync(full).isDirectory()) {
					visit(full, depth + 1);
					continue;
				}
				if (/\.(?:png|jpe?g|webp)$/iu.test(name)) names.add(name);
			} catch {}
		}
	};
	visit(dir, 0);
	return names;
}
/**
* 扫描并（可选）同步一个剧集。
* @param store - 数据门面。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @param force - 忽略指纹强制重解析。
* @returns 扫描结论。
*/
function scanEpisode(store, projectId, episodeId, force = false) {
	const dir = store.episodeDir(projectId, episodeId);
	const seriesPath = join(dir, SERIES_FILE);
	if (!existsSync(seriesPath)) {
		if (existsSync(join(dir, "plan.json"))) return {
			reason: "plan-only",
			hash: "",
			plan: null,
			missing: [],
			message: "这个剧集只有旧版 plan.json。新项目先支持 series.json（skill 的 v2 产物）；请让 skill 重新产出 series.json 后再扫描。",
			sync: null
		};
		return {
			reason: "no-document",
			hash: "",
			plan: null,
			missing: [],
			message: "剧集目录里没有 series.json，跳过。",
			sync: null
		};
	}
	const text = readFileSync(seriesPath, "utf8");
	const hash = sha256(text);
	const recorded = store.episodeSeriesHash(projectId, episodeId);
	if (!force && recorded !== "" && recorded === hash) return {
		reason: "unchanged",
		hash,
		plan: null,
		missing: [],
		message: "series.json 没有变化。",
		sync: null
	};
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return {
			reason: "invalid",
			hash,
			plan: null,
			missing: [],
			message: "series.json 不是合法 JSON，已停止同步。",
			sync: null
		};
	}
	if (!isSeriesDocument(parsed)) return {
		reason: "invalid",
		hash,
		plan: null,
		missing: [],
		message: "series.json 缺少 stories[].text，按旧格式处理：请让 skill 重新产出。",
		sync: null
	};
	const plan = planSeries(parsed);
	store.setEpisodeAssets(projectId, episodeId, plan.assets);
	const available = picturesIn(dir);
	const missing = plan.pictures.filter((name) => {
		if (available.has(name)) return false;
		return store.withProjectDb(projectId, (db) => resolveAssetId(db, name) === null);
	});
	const sync = syncSeries(store, projectId, episodeId, plan.clips, hash, missing);
	return {
		reason: "parsed",
		hash,
		plan,
		missing,
		message: plan.clips.length === 0 ? "series.json 里没有可用片段（derived 缺时长？）。" : `已同步 ${String(plan.clips.length)} 个片段。`,
		sync
	};
}
// lib/types/series/write-back.js
/**
* 反向同步：把界面里改过的片段写回 `series.json`。
*
* 正向同步（scan → sync）是「文档 → 库」，会覆盖界面上的人工调整：
* 改了时长、换了参考图、润过提示词，一点「重新扫描」就全被文档里的旧值盖掉。
* 这个模块做相反方向：以**库里的片段为准**，把这几项写回文档，之后的正向同步
* 就不会再把它们回退。
*
* 只覆盖三样（刻意不动其余字段，避免把 skill 产出的结构写坏）：
* - `stories[].estimatedDuration` ← 片段时长
* - `stories[].clips[].prompt`     ← 片段提示词
* - `stories[].clips[].refImages`  ← 片段参考图（按 position 排序后的素材名）
* - `stories[].clips[].slots[].imageRefs` ← 同名槽位（role + n/at）的参考图
* @module dsh-dream-studio-host/series/write-back
*/
/** 片段在库里的参考图名字（按 position 排序）。 */
function refNames(clip) {
	return [...clip.refs].filter((ref) => ref.kind === "image").sort((left, right) => left.position - right.position).map((ref) => ref.assetName);
}
/** 用库里的槽位图去改文档里同一角色的槽。 */
function syncSlots(clip, slots) {
	if (slots === void 0) return 0;
	let changed = 0;
	for (const slot of slots) {
		const role = slot.role;
		if (role === void 0) continue;
		const source = clip.slots.find((entry) => {
			if (entry.role !== role) return false;
			if (entry.n === null || slot.n === void 0) return entry.role === role;
			return entry.n === slot.n;
		});
		if (source === void 0) continue;
		const names = source.imageRefs;
		const before = JSON.stringify(slot.imageRefs ?? []);
		if (JSON.stringify(names) === before) continue;
		slot.imageRefs = [...names];
		changed += 1;
	}
	return changed;
}
/**
* 把一集的片段改动写回它的 `series.json`。
* @param store - 存储。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @returns 写回统计。
*/
function writeBackToSeries(store, projectId, episodeId, only) {
	const path = store.seriesPath(projectId, episodeId);
	if (!existsSync(path)) return {
		updated: 0,
		path: null,
		missing: []
	};
	const doc = JSON.parse(readFileSync(path, "utf8"));
	const stories = doc.stories ?? [];
	const clips = store.payload(projectId, episodeId).clips;
	const byKey = new Map(clips.map((clip) => [clip.seriesKey, clip]));
	const missing = [];
	let updated = 0;
	const wanted = only === void 0 || only.length === 0 ? null : new Set(only);
	for (const story of stories) {
		const sid = story.sid;
		if (sid === void 0) continue;
		if (wanted !== null && !wanted.has(sid)) continue;
		const clip = byKey.get(sid);
		if (clip === void 0) {
			missing.push(sid);
			continue;
		}
		let touched = false;
		const shots = story.shots;
		if (Array.isArray(shots) && shots.length > 0) {
			const total = shots.reduce((sum, shot) => sum + (typeof shot.seconds === "number" ? shot.seconds : 0), 0);
			if (total > 0 && Math.abs(total - clip.duration) > .001) {
				const factor = clip.duration / total;
				for (const shot of shots) if (typeof shot.seconds === "number") shot.seconds = Math.round(shot.seconds * factor * 1e3) / 1e3;
				touched = true;
			}
		}
		if (Math.abs((story.estimatedDuration ?? 0) - clip.duration) > .001) {
			story.estimatedDuration = clip.duration;
			touched = true;
		}
		const docK = story.clips?.[0]?.k;
		const derivedClip = doc.derived?.clips?.find((entry) => entry.sid === sid && (docK === void 0 || entry.k === void 0 || entry.k === docK));
		if (derivedClip !== void 0) {
			if (typeof derivedClip.dur !== "number" || Math.abs(derivedClip.dur - clip.duration) > .001) {
				derivedClip.dur = clip.duration;
				touched = true;
			}
			const lengths = derivedClip.shotLen;
			if (Array.isArray(lengths) && lengths.length > 0) {
				const totalLen = lengths.reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
				if (totalLen > 0 && Math.abs(totalLen - clip.duration) > .001) {
					const factor = clip.duration / totalLen;
					derivedClip.shotLen = lengths.map((value) => typeof value === "number" ? Math.round(value * factor * 1e3) / 1e3 : value);
					touched = true;
				}
			}
		}
		const derivedStory = doc.derived?.stories?.find((entry) => entry.sid === sid);
		if (derivedStory !== void 0) {
			if (typeof derivedStory.estimatedDuration === "number" && Math.abs(derivedStory.estimatedDuration - clip.duration) > .001) {
				derivedStory.estimatedDuration = clip.duration;
				touched = true;
			}
			if (typeof derivedStory.plannedDuration === "number" && Math.abs(derivedStory.plannedDuration - clip.duration) > .001) {
				derivedStory.plannedDuration = clip.duration;
				touched = true;
			}
		}
		const docClip = story.clips?.[0];
		if (docClip !== void 0) {
			if (clip.prompt.trim() !== "" && docClip.prompt !== clip.prompt) {
				docClip.prompt = clip.prompt;
				touched = true;
			}
			const names = refNames(clip);
			if (names.length > 0 && JSON.stringify(docClip.refImages ?? []) !== JSON.stringify(names)) {
				docClip.refImages = [...names];
				touched = true;
			}
			if (syncSlots(clip, docClip.slots) > 0) touched = true;
		}
		if (touched) updated += 1;
	}
	if (updated > 0) {
		try {
			copyFileSync(path, `${path}.bak`);
		} catch {}
		writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
	}
	return {
		updated,
		path,
		missing
	};
}
/** Largest stdout/stderr capture retained for one child process. */
const MAX_CAPTURE_BYTES = 16777216;
/** Characters of ffmpeg stderr carried into one thrown message. */
const STDERR_TAIL_CHARS = 400;
const MISSING_FFMPEG = "未找到 ffmpeg，请在设置中指定内置二进制路径";
const MISSING_FFPROBE = "未找到 ffprobe，请在设置中指定内置二进制路径";
const PROBE_PARSE_FAILURE = "ffprobe 返回了无法解析的结果";
const DURATION_FAILURE = "无法读取媒体时长";
/** H.264/AAC arguments shared by re-encoded slices, concatenation, and MP4/MOV transcodes. */
const H264_AAC_ARGS = [
	"-c:v",
	"libx264",
	"-preset",
	"veryfast",
	"-crf",
	"18",
	"-c:a",
	"aac"
];
/** MP4 arguments: H.264/AAC plus a fast-start index for progressive playback. */
const MP4_ARGS = [
	...H264_AAC_ARGS,
	"-movflags",
	"+faststart"
];
/** VP9/Opus arguments for a WebM transcode. */
const VP9_OPUS_ARGS = [
	"-c:v",
	"libvpx-vp9",
	"-b:v",
	"0",
	"-crf",
	"32",
	"-c:a",
	"libopus"
];
/** Stream-copy arguments for a slice, keeping the cut self-contained. */
const SLICE_COPY_ARGS = [
	"-c",
	"copy",
	"-avoid_negative_ts",
	"make_zero"
];
/**
* How far before the end a tail-frame seek lands. A frame needs an exact
* timestamp, and the last one sits within a frame's duration of the end, so the
* read starts a moment earlier and ffmpeg takes the frame that follows.
*/
const TAIL_FRAME_SEEK_SECONDS = .1;
/**
* Arguments that write one film's last frame as a PNG on standard output.
*
* `-sseof` seeks back from the end of the file, so its offset is negative: ffmpeg
* refuses a positive one outright, and a stream's last frame is not addressable at
* the end itself, which is why the read starts a moment before it.
*
* The frame travels back over standard output rather than into a named file. A
* deployment can run the toolchain under a confinement that lets it read anywhere
* and create files only inside particular directories — an AppContainer-confined
* host is one — and a pipe needs no directory grant at all. It also removes the
* temporary file this used to write, read back, and delete.
* @param input - source film.
* @returns the arguments ffmpeg is invoked with, after the executable.
*/
function tailFrameArguments(input) {
	return [
		"-nostdin",
		"-loglevel",
		"error",
		"-sseof",
		`-${String(TAIL_FRAME_SEEK_SECONDS)}`,
		"-i",
		resolve(input),
		"-frames:v",
		"1",
		"-f",
		"image2pipe",
		"-vcodec",
		"png",
		"-"
	];
}
/**
* Run one binary without a shell and capture both output streams.
* @param executable - resolved path or bare name of the binary.
* @param args - argument vector; never a shell string.
* @param timeoutMs - wall-clock limit before the child is killed.
* @returns the exit outcome, which reports a spawn failure or timeout as data.
*/
function execute(executable, args, timeoutMs) {
	const options = {
		timeout: timeoutMs,
		killSignal: "SIGKILL",
		windowsHide: true,
		maxBuffer: MAX_CAPTURE_BYTES,
		encoding: "utf8",
		shell: false
	};
	return new Promise((resolveOutcome) => {
		try {
			execFile(executable, [...args], options, (error, stdout, stderr) => {
				if (error === null) {
					resolveOutcome({
						ok: true,
						stdout,
						stderr,
						failure: ""
					});
					return;
				}
				resolveOutcome({
					ok: false,
					stdout,
					stderr,
					failure: failureDetail(error, stderr, timeoutMs)
				});
			});
		} catch (error) {
			resolveOutcome({
				ok: false,
				stdout: "",
				stderr: "",
				failure: error instanceof Error ? error.message : "无法启动子进程"
			});
		}
	});
}
/**
* Run one binary and capture its standard output as raw bytes.
*
* The text counterpart decodes both streams, which is right for a tool that
* answers in text and wrong for one that answers with a picture: a frame read
* through a UTF-8 decoder comes back mangled. Standard error is still decoded,
* because that is where the diagnosis lives.
* @param executable - resolved path or bare name of the binary.
* @param args - argument vector; never a shell string.
* @param timeoutMs - wall-clock limit before the child is killed.
* @returns the exit outcome, carrying the bytes it wrote on success.
*/
function capture(executable, args, timeoutMs) {
	const options = {
		timeout: timeoutMs,
		killSignal: "SIGKILL",
		windowsHide: true,
		maxBuffer: MAX_CAPTURE_BYTES,
		encoding: "buffer",
		shell: false
	};
	return new Promise((resolveOutcome) => {
		try {
			execFile(executable, [...args], options, (error, stdout, stderr) => {
				const text = stderr.toString("utf8");
				if (error === null) {
					resolveOutcome({
						ok: true,
						stdout,
						stderr: text,
						failure: ""
					});
					return;
				}
				resolveOutcome({
					ok: false,
					stdout,
					stderr: text,
					failure: failureDetail(error, text, timeoutMs)
				});
			});
		} catch (error) {
			const reason = error instanceof Error ? error.message : "无法启动子进程";
			resolveOutcome({
				ok: false,
				stdout: Buffer.alloc(0),
				stderr: "",
				failure: reason
			});
		}
	});
}
/**
* Describe one child-process failure in a single line.
* @param error - the callback failure.
* @param stderr - captured standard error.
* @param timeoutMs - limit the child ran under.
* @returns the timeout note, the stderr tail, or the raw error message.
*/
function failureDetail(error, stderr, timeoutMs) {
	if (error.killed === true) return `执行超时（${timeoutMs} 毫秒）`;
	const tail = stderrTail(stderr);
	return tail === "" ? error.message : tail;
}
/**
* Keep the end of ffmpeg's stderr, where the failing input and reason appear.
* @param stderr - captured standard error.
* @returns the trimmed tail, or an empty string.
*/
function stderrTail(stderr) {
	const text = stderr.trim();
	return text.length > STDERR_TAIL_CHARS ? text.slice(-400) : text;
}
/**
* Wrap a failed invocation in the message every media operation reports.
* @param outcome - an outcome whose `ok` is false.
* @returns the error to throw.
*/
function executionFailure(outcome) {
	return /* @__PURE__ */ new Error(`FFmpeg 执行失败：${outcome.failure}`);
}
/**
* Return a resolved binary or refuse with the caller-facing diagnostic.
* @param executable - resolved path, or null when the binary was not found.
* @param message - Chinese diagnostic naming the missing binary.
* @returns the resolved path.
*/
function requireBinary(executable, message) {
	if (executable === null) throw new Error(message);
	return executable;
}
/**
* Resolve one media binary without spawning it.
* @param name - bare executable name, e.g. `ffmpeg`.
* @param explicit - caller-supplied path, used as-is when it exists.
* @param directories - search roots in order.
* @returns the located path, or null when nothing exists.
*/
function resolveBinary(name, explicit, directories) {
	if (explicit !== void 0) return existsSync(explicit) ? explicit : null;
	const file = process.platform === "win32" ? `${name}.exe` : name;
	for (const directory of directories) for (const candidate of bundledCandidates(directory, file)) if (existsSync(candidate)) return candidate;
	return null;
}
/**
* Candidate paths of one binary inside one bundled toolchain root.
* @param directory - toolchain root.
* @param file - executable file name including any platform extension.
* @returns candidate paths in preference order.
*/
function bundledCandidates(directory, file) {
	return [
		join(directory, "ffmpeg", "bin", file),
		join(directory, "bin", file),
		join(directory, file)
	];
}
/**
* Build the binary search order: the caller's bundle root and the deployment's
* own `<cacheDir>/../..`, then every PATH entry.
* @param cacheDir - absolute cache directory.
* @param bundledDir - caller-supplied bundle root, or undefined.
* @returns directories to search, in order.
*/
function searchDirectories(cacheDir, bundledDir) {
	const roots = [resolve(cacheDir, "..", "..")];
	if (bundledDir !== void 0) roots.unshift(resolve(bundledDir));
	const pathValue = process.env.PATH;
	if (pathValue !== void 0) roots.push(...pathValue.split(delimiter).filter((entry) => entry !== ""));
	return roots;
}
/** True for a JSON object that is not an array. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Keep only the object entries of a JSON value that should be an array.
* @param value - decoded JSON value.
* @returns the object entries, or an empty list.
*/
function recordList(value) {
	const list = [];
	if (!Array.isArray(value)) return list;
	for (const entry of value) if (isRecord(entry)) list.push(entry);
	return list;
}
/**
* Parse ffprobe's JSON document.
* @param stdout - captured standard output.
* @returns the decoded JSON object.
*/
function parseProbeDocument(stdout) {
	let value;
	try {
		value = JSON.parse(stdout);
	} catch {
		throw new Error(PROBE_PARSE_FAILURE);
	}
	if (!isRecord(value)) throw new Error(PROBE_PARSE_FAILURE);
	return value;
}
/**
* Read a non-empty string field.
* @param value - decoded JSON value.
* @returns the string, or null.
*/
function text$1(value) {
	return typeof value === "string" && value !== "" ? value : null;
}
/**
* Read a positive finite duration from a JSON number or numeric string.
* @param value - decoded JSON value.
* @returns the number of seconds, or null.
*/
function positiveNumber(value) {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
/**
* Read a positive integer pixel dimension.
* @param value - decoded JSON value.
* @returns the pixel count, or null.
*/
function dimension(value) {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
/**
* Read a frame rate from an ffprobe rate such as `30000/1001`.
* @param value - decoded JSON value.
* @returns frames per second, or null for an absent or degenerate rate.
*/
function frameRate(value) {
	if (typeof value !== "string") return null;
	const parts = value.split("/");
	const numerator = Number.parseFloat(parts[0] ?? "");
	const denominator = parts.length > 1 ? Number.parseFloat(parts[1] ?? "") : 1;
	if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) return null;
	return numerator / denominator;
}
/**
* First stream of one codec type.
* @param streams - decoded stream records.
* @param type - ffprobe `codec_type` to match.
* @returns the matching stream, or null.
*/
function firstStream(streams, type) {
	return streams.find((stream) => stream.codec_type === type) ?? null;
}
/**
* First line of a `-version` report.
* @param stdout - captured standard output.
* @returns the trimmed first line, or null when the report was empty.
*/
function versionLine(stdout) {
	const line = stdout.split("\n")[0]?.trim() ?? "";
	return line === "" ? null : line;
}
/**
* Container extension to keep for a stream copy, taken from the source file.
* @param input - absolute source path.
* @returns a lowercase extension, defaulting to `mp4` for an unusable one.
*/
function containerExtension(input) {
	const candidate = extname(input).slice(1).toLowerCase();
	return /^[a-z0-9]{1,5}$/u.test(candidate) ? candidate : "mp4";
}
/**
* Deterministic cache key for one slice window of one source revision.
* @param input - absolute source path.
* @param source - size and modification time of the source file.
* @param request - requested window and mode.
* @returns the hex sha256 digest.
*/
function cacheKey(input, source, request) {
	const mode = request.reencode === true ? "reencode" : "copy";
	const material = `${input}\u0000${source.size}\u0000${source.mtimeMs}\u0000${request.start}\u0000${request.end ?? ""}\u0000${mode}`;
	return createHash("sha256").update(material).digest("hex");
}
/**
* Total size of the regular files directly inside one directory.
* @param directory - directory to measure.
* @returns the summed byte size; zero when the directory is absent.
*/
async function directoryBytes(directory) {
	if (!existsSync(directory)) return 0;
	let total = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		try {
			total += (await stat(join(directory, entry.name))).size;
		} catch {}
	}
	return total;
}
/**
* Evict least-recently-written slices until the cache fits its cap.
* @param slicesDir - cache directory holding slice files.
* @param limitBytes - byte cap applied to the total of every file in the directory.
* @param keep - file just produced by the caller, never evicted.
*/
async function evictSlices(slicesDir, limitBytes, keep) {
	const entries = [];
	let total = 0;
	for (const entry of await readdir(slicesDir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const file = join(slicesDir, entry.name);
		try {
			const stats = await stat(file);
			entries.push({
				path: file,
				size: stats.size,
				mtimeMs: stats.mtimeMs
			});
			total += stats.size;
		} catch {}
	}
	entries.sort((left, right) => left.mtimeMs - right.mtimeMs);
	for (const entry of entries) {
		if (total <= limitBytes) return;
		if (entry.path === keep) continue;
		await rm(entry.path, { force: true });
		total -= entry.size;
	}
}
/**
* Resolve the FFmpeg toolchain and return its tools.
* @param options - binary locations, cache directory, and limits.
* @returns tools whose `available` is false when a binary is missing.
*/
function createMediaTools(options) {
	const cacheDir = resolve(options.cacheDir);
	const slicesDir = join(cacheDir, "slices");
	const temporaryDir = join(cacheDir, "tmp");
	const timeoutMs = options.timeoutMs ?? 12e4;
	const probeTimeoutMs = options.timeoutMs ?? 3e4;
	const cacheLimitBytes = options.cacheLimitBytes ?? 8589934592;
	const directories = searchDirectories(cacheDir, options.bundledDir);
	const ffmpegPath = resolveBinary("ffmpeg", options.ffmpegPath, directories);
	const ffprobePath = resolveBinary("ffprobe", options.ffprobePath, directories);
	let version = null;
	let versionLookup = null;
	/**
	* Read `ffmpeg -version` at most once so `status.version` fills in later; a
	* failed lookup leaves the version unknown instead of failing the caller.
	* @returns a promise settled once the lookup ran or was skipped.
	*/
	function recordVersion() {
		if (version !== null || ffmpegPath === null) return Promise.resolve();
		versionLookup ??= execute(ffmpegPath, ["-version"], timeoutMs).then((outcome) => {
			if (outcome.ok) version = versionLine(outcome.stdout);
		});
		return versionLookup;
	}
	/**
	* Probe duration, dimensions, frame rate, and audio presence.
	* @param path - source media file to inspect.
	* @returns the probed metadata.
	*/
	async function probe(path) {
		const outcome = await execute(requireBinary(ffprobePath, MISSING_FFPROBE), [
			"-v",
			"error",
			"-print_format",
			"json",
			"-show_format",
			"-show_streams",
			resolve(path)
		], probeTimeoutMs);
		if (!outcome.ok) throw executionFailure(outcome);
		await recordVersion();
		const document = parseProbeDocument(outcome.stdout);
		const duration = positiveNumber(isRecord(document.format) ? document.format.duration : void 0);
		if (duration === null) throw new Error(DURATION_FAILURE);
		const streams = recordList(document.streams);
		const video = firstStream(streams, "video");
		const audio = firstStream(streams, "audio");
		return {
			duration,
			width: dimension(video?.width),
			height: dimension(video?.height),
			fps: frameRate(video?.avg_frame_rate) ?? frameRate(video?.r_frame_rate),
			hasAudio: audio !== null,
			videoCodec: video === null ? null : text$1(video.codec_name),
			audioCodec: audio === null ? null : text$1(audio.codec_name)
		};
	}
	/**
	* Cut one window out of a source file, reusing a cached render when possible.
	* @param request - source, window, and re-encode flag.
	* @returns the absolute path of the cached slice file.
	*/
	async function slice(request) {
		const executable = requireBinary(ffmpegPath, MISSING_FFMPEG);
		const { start, end } = request;
		if (!Number.isFinite(start) || start < 0) throw new Error("切片起点必须为非负数");
		if (end !== null && (!Number.isFinite(end) || end <= start)) throw new Error("切片终点必须大于起点");
		const input = resolve(request.input);
		const reencode = request.reencode === true;
		const extension = reencode ? "mp4" : containerExtension(input);
		const source = await stat(input);
		const cached = join(slicesDir, `${cacheKey(input, source, request)}.${extension}`);
		if (existsSync(cached)) return cached;
		await mkdir(slicesDir, { recursive: true });
		await mkdir(temporaryDir, { recursive: true });
		const temporary = join(temporaryDir, `${randomUUID()}.${extension}`);
		const args = [
			"-nostdin",
			"-y",
			"-ss",
			String(start),
			"-i",
			input
		];
		if (end !== null) args.push("-t", String(end - start));
		args.push(...reencode ? H264_AAC_ARGS : SLICE_COPY_ARGS);
		args.push(temporary);
		const outcome = await execute(executable, args, timeoutMs);
		if (!outcome.ok) {
			await rm(temporary, { force: true });
			throw executionFailure(outcome);
		}
		try {
			await rename(temporary, cached);
		} catch (failure) {
			await rm(temporary, { force: true });
			if (!existsSync(cached)) throw new Error(`无法写入切片缓存：${failure instanceof Error ? failure.message : "未知错误"}`);
		}
		await evictSlices(slicesDir, cacheLimitBytes, cached);
		return cached;
	}
	/**
	* Concatenate already-cut parts in order into one output file.
	* @param parts - part files, in playback order.
	* @param output - destination media file.
	* @param strategy - stream copy or a full re-encode.
	*/
	async function concat(parts, output, strategy) {
		const executable = requireBinary(ffmpegPath, MISSING_FFMPEG);
		const files = parts.map((part) => resolve(part));
		if (files.length === 0) throw new Error("合并失败：没有可合并的片段");
		await mkdir(cacheDir, { recursive: true });
		const listFile = join(cacheDir, `concat-${randomUUID()}.txt`);
		try {
			await writeFile(listFile, `${files.map(concatListLine).join("\n")}\n`, "utf8");
			const args = [
				"-nostdin",
				"-y",
				"-f",
				"concat",
				"-safe",
				"0",
				"-i",
				listFile
			];
			args.push(...strategy === "copy" ? ["-c", "copy"] : H264_AAC_ARGS);
			args.push(resolve(output));
			const outcome = await execute(executable, args, timeoutMs);
			if (outcome.ok) return;
			const offender = files.find((file) => outcome.stderr.includes(file));
			const detail = offender === void 0 ? outcome.failure : `${offender}：${outcome.failure}`;
			throw new Error(`合并失败：${detail}`);
		} finally {
			await rm(listFile, { force: true });
		}
	}
	/**
	* Transcode or remux one file into a target container.
	* @param input - source media file.
	* @param output - destination media file.
	* @param container - target container, which selects the codec arguments.
	*/
	async function transcode(input, output, container) {
		const executable = requireBinary(ffmpegPath, MISSING_FFMPEG);
		const codecs = container === "webm" ? VP9_OPUS_ARGS : container === "mp4" ? MP4_ARGS : H264_AAC_ARGS;
		const outcome = await execute(executable, [
			"-nostdin",
			"-y",
			"-i",
			resolve(input),
			...codecs,
			resolve(output)
		], timeoutMs);
		if (!outcome.ok) throw executionFailure(outcome);
	}
	/**
	* Read the last frame of one film as PNG bytes (ENG-12).
	*
	* A clip that continues from the film before it starts from that film's final
	* picture, so the frame is read back rather than guessed. The bytes arrive over a
	* pipe, which is what lets this run where the toolchain may read anywhere but
	* create files only inside particular directories.
	* @param input - source film.
	* @returns the frame as a PNG.
	* @throws when ffmpeg fails, or answers with nothing at all.
	*/
	async function tailFrame(input) {
		const outcome = await capture(requireBinary(ffmpegPath, MISSING_FFMPEG), [...tailFrameArguments(input)], timeoutMs);
		if (!outcome.ok) throw new Error(`截取上一片段尾帧失败：${outcome.failure}`);
		if (outcome.stdout.length === 0) throw new Error("截取上一片段尾帧失败：ffmpeg 没有写出图片");
		return outcome.stdout;
	}
	/**
	* Report the current slice-cache size.
	* @returns the summed byte size of the cached slices.
	*/
	async function cacheBytes() {
		return directoryBytes(slicesDir);
	}
	/** Delete every cached slice and any partial render left behind. */
	async function clearCache() {
		await rm(slicesDir, {
			recursive: true,
			force: true
		});
		await rm(temporaryDir, {
			recursive: true,
			force: true
		});
	}
	return {
		available: ffmpegPath !== null && ffprobePath !== null,
		status: {
			get ffmpeg() {
				return ffmpegPath;
			},
			get ffprobe() {
				return ffprobePath;
			},
			get version() {
				return version;
			}
		},
		probe,
		slice,
		concat,
		transcode,
		tailFrame,
		cacheBytes,
		clearCache
	};
}
/**
* One ffmpeg concat-demuxer entry for an absolute path, with `'` escaped as `'\''`.
* @param file - absolute media path.
* @returns the list line, without its newline.
*/
function concatListLine(file) {
	return `file '${file.replaceAll("'", "'\\''")}'`;
}
// lib/types/media/merge.js
/**
* 合并与导出：把一集里已出片的片段拼成一条，或按顺序导出单个文件。
*
* 合并策略（🔒 沿用旧实现）：
* - `copy`：直接拼流，要求各段编码一致；
* - `reencode`：统一重编码，慢但不会因为一段编码不同就失败。
* 段按片段 `order` 排，跳过没有成片的（返回 `skippedClips` 让 UI 说清楚）。
* @module dsh-dream-studio-host/media/merge
*/
/**
* 按当前设置造一套媒体工具。
* @param store - 数据门面（读设置）。
* @param cacheDir - 切片缓存目录。
* @returns 工具链。
*/
function toolsOf(store, cacheDir) {
	const settings = store.settings();
	const status = mediaStatus({
		ffmpegPath: settings.ffmpegPath,
		ffprobePath: settings.ffprobePath
	});
	requireTools(status);
	return createMediaTools({
		...status.ffmpeg === null ? {} : { ffmpegPath: status.ffmpeg },
		...status.ffprobe === null ? {} : { ffprobePath: status.ffprobe },
		cacheDir,
		cacheLimitBytes: settings.cacheLimitBytes
	});
}
/**
* 把一集里已出片的片段合并成一条。
* @param store - 数据门面。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @param output - 目标文件路径。
* @param strategy - 合并策略。
* @returns 合并结果。
*/
async function mergeEpisode(store, projectId, episodeId, output, strategy) {
	const payload = store.payload(projectId, episodeId);
	const ready = payload.clips.filter((clip) => clip.resultVideoPath !== null && existsSync(clip.resultVideoPath)).sort((left, right) => left.order - right.order);
	const skipped = payload.clips.filter((clip) => !ready.includes(clip)).map((clip) => clip.id);
	if (ready.length === 0) throw new Error("这一集还没有可合并的成片");
	const tools = toolsOf(store, join(store.projectDir(projectId), "cache"));
	const target = output.trim() === "" ? join(store.episodeDir(projectId, episodeId), "成片.mp4") : output;
	mkdirSync(join(target, ".."), { recursive: true });
	await tools.concat(ready.map((clip) => clip.resultVideoPath ?? ""), target, strategy);
	const probe = await tools.probe(target);
	store.log("FFmpeg", `合并 ${String(ready.length)} 段 → ${target}（${String(probe.duration)}s）`);
	return {
		output: target,
		usedClips: ready.map((clip) => clip.id),
		skippedClips: skipped,
		duration: probe.duration
	};
}
/**
* 把已出片的片段按顺序导出为独立文件。
* @param store - 数据门面。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @param targetDir - 目标目录。
* @returns 写出的文件路径。
*/
function exportClipFilms(store, projectId, episodeId, targetDir) {
	const ready = store.payload(projectId, episodeId).clips.filter((clip) => clip.resultVideoPath !== null && existsSync(clip.resultVideoPath)).sort((left, right) => left.order - right.order);
	if (ready.length === 0) throw new Error("这一集还没有可导出的成片");
	mkdirSync(targetDir, { recursive: true });
	const written = [];
	ready.forEach((clip, index) => {
		const name = `${String(index + 1).padStart(3, "0")}-${clip.seriesKey === "" ? clip.id : clip.seriesKey}.mp4`;
		const target = join(targetDir, name);
		copyFileSync(clip.resultVideoPath ?? "", target);
		written.push(target);
	});
	store.log("FFmpeg", `导出 ${String(written.length)} 个成片 → ${targetDir}`);
	return written;
}
// lib/types/http/routes/episodes.js
/** 按资产 id 前缀判素材分类：CH- 人物 / SC- 场景 / PR- 道具。 */
function categoryOf$1(source) {
	const text = source.trim().toUpperCase();
	if (text.startsWith("CH-")) return "character";
	if (text.startsWith("SC-")) return "scene";
	if (text.startsWith("PR-")) return "prop";
	return "";
}
/** 把 query 里的 `doc` 归一成受支持的值。 */
function scriptDocOf(source) {
	if (source === "outline") return "outline";
	if (source === "characters") return "characters";
	return "script";
}
/**
* 找这一集相关的剧本 / 大纲 / 人物档案文件。
*
* - `script`：剧集目录里的 `第NN集.md`（优先剧集名，其次目录里第一个 `第*集.md`）
* - `outline` / `characters`：**项目根目录**里的 `*大纲*.md` / `*人物档案*.md`
*   （skill 的约定名是 `01_大纲.md` / `00_人物档案.md`，改名过也能认出来）
*
* 文件不存在时返回约定的默认路径，供前端首次保存时创建。
* @param store - 数据门面。
* @param projectId - 项目。
* @param episodeId - 剧集。
* @param doc - 要读哪一份。
* @returns 绝对路径、文件名与是否已存在。
*/
function docFileOf(store, projectId, episodeId, doc) {
	if (doc === "script") {
		const dir = store.episodeDir(projectId, episodeId);
		const safeName = (store.listEpisodes(projectId).find((entry) => entry.id === episodeId)?.name ?? "剧本").replace(/[\\/:*?"<>|]/gu, "_");
		const exact = join(dir, `${safeName}.md`);
		if (existsSync(exact)) return {
			path: exact,
			name: `${safeName}.md`,
			exists: true
		};
		try {
			const first = readdirSync(dir).filter((name) => /^第.+集\.md$/u.test(name)).sort()[0];
			if (first !== void 0) return {
				path: join(dir, first),
				name: first,
				exists: true
			};
		} catch {}
		return {
			path: exact,
			name: `${safeName}.md`,
			exists: false
		};
	}
	const projectDir = store.projectDir(projectId);
	const fallback = doc === "outline" ? "01_大纲.md" : "00_人物档案.md";
	const pattern = doc === "outline" ? /大纲/u : /人物档案/u;
	try {
		const found = readdirSync(projectDir).filter((name) => name.endsWith(".md") && pattern.test(name)).sort()[0];
		if (found !== void 0) return {
			path: join(projectDir, found),
			name: found,
			exists: true
		};
	} catch {}
	return {
		path: join(projectDir, fallback),
		name: fallback,
		exists: false
	};
}
/** 剧集路由表。 */
const episodeRoutes = [
	{
		method: "POST",
		pattern: "/projects/:project/custom-episode",
		handler: ({ store, params }) => json(store.createCustomEpisode(params["project"] ?? ""), 201)
	},
	{
		method: "GET",
		pattern: "/projects/:project/episodes",
		handler: ({ store, params }) => json(store.listEpisodes(params["project"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			return json(store.createEpisode(params["project"] ?? "", textOf(source, "name")), 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/episodes/:episode",
		handler: ({ store, params }) => json(store.payload(params["project"] ?? "", params["episode"] ?? ""))
	},
	{
		method: "PATCH",
		pattern: "/projects/:project/episodes/:episode",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const name = textOf(source, "name");
			if (name !== void 0) return json(store.renameEpisode(params["project"] ?? "", params["episode"] ?? "", name));
			if ("serverId" in source) {
				const value = source["serverId"];
				if (value !== null && typeof value !== "string") throw new Error("serverId 必须是字符串或 null");
				return json(store.setEpisodeServer(params["project"] ?? "", params["episode"] ?? "", value));
			}
			return json(store.payload(params["project"] ?? "", params["episode"] ?? ""));
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/episodes/:episode",
		handler: ({ store, params }) => json(store.deleteEpisode(params["project"] ?? "", params["episode"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/adopt",
		handler: ({ store, params }) => {
			const projectId = params["project"] ?? "";
			return json({
				added: store.adoptEpisodes(projectId),
				episodes: store.listEpisodes(projectId)
			});
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/sync-out",
		handler: async ({ request, store, params }) => {
			const projectId = params["project"] ?? "";
			const episodeId = params["episode"] ?? "";
			const text = await request.text();
			const source = text.trim() === "" ? {} : JSON.parse(text);
			const clipId = typeof source["clipId"] === "string" ? source["clipId"] : null;
			const result = writeBackToSeries(store, projectId, episodeId, clipId === null ? void 0 : (() => {
				const clip = store.payload(projectId, episodeId).clips.find((entry) => entry.id === clipId);
				return clip === void 0 ? [] : [clip.seriesKey];
			})());
			if (result.path === null) return failure("这一集没有 series.json，无法写回");
			const missing = result.missing.length === 0 ? "" : `；文档里没有对应片段的段：${result.missing.join("、")}`;
			store.log("Project", `同步回文档：${String(result.updated)} 段 → ${result.path}`);
			return json({
				updated: result.updated,
				path: result.path,
				missing: result.missing,
				message: result.updated === 0 ? `没有需要写回的改动${missing}` : `已写回 ${String(result.updated)} 段${missing}`
			});
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/sync",
		handler: async ({ request, store, params }) => {
			const text = await request.text();
			const force = (text.trim() === "" ? {} : JSON.parse(text))["force"] === true;
			const projectId = params["project"] ?? "";
			const episodeId = params["episode"] ?? "";
			const adopted = store.adoptEpisodes(projectId);
			const outcome = scanEpisode(store, projectId, episodeId, force);
			const others = [];
			for (const episode of store.listEpisodes(projectId)) {
				if (episode.id === episodeId) continue;
				try {
					const result = scanEpisode(store, projectId, episode.id, false);
					if (result.reason === "parsed" && (result.sync?.created ?? 0) > 0) others.push({
						name: episode.name,
						created: result.sync?.created ?? 0
					});
				} catch {}
			}
			const notes = [adopted > 0 ? `认领新剧集 ${String(adopted)} 个` : "", others.length > 0 ? `${others.map((each) => `${each.name} +${String(each.created)}`).join("、")}` : ""].filter((each) => each !== "");
			return json({
				reason: outcome.reason,
				message: notes.length === 0 ? outcome.message : `${outcome.message}（${notes.join("；")}）`,
				adopted,
				created: outcome.sync?.created ?? 0,
				updated: outcome.sync?.updated ?? 0,
				orphaned: outcome.sync?.orphaned ?? [],
				issues: outcome.sync?.issues ?? [],
				missing: outcome.missing,
				payload: outcome.sync?.payload ?? store.payload(projectId, episodeId)
			});
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/episodes/:episode/drafts",
		handler: ({ store, params }) => json(store.listEpisodeDrafts(params["project"] ?? "", params["episode"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/drafts",
		handler: async ({ request, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const source = await bodyOf(request);
			const prompt = textOf(source, "prompt");
			if (prompt === void 0 || prompt.trim() === "") return failure("请先填写提示词再生成图片");
			const refs = Array.isArray(source["refImages"]) ? source["refImages"].filter((entry) => typeof entry === "string") : [];
			const seed = typeof source["seed"] === "number" ? source["seed"] : void 0;
			const ratio = textOf(source, "ratio");
			const size = typeof source["size"] === "number" ? source["size"] : void 0;
			return json({ jobId: engine.enqueueEpisodePicture(params["project"] ?? "", params["episode"] ?? "", {
				prompt,
				...seed === void 0 ? {} : { seed },
				...source["tile"] === true ? { tile: true } : {},
				...source["reference"] === true ? { reference: true } : {},
				...ratio === void 0 ? {} : { ratio },
				...size === void 0 ? {} : { shortSide: size },
				...refs.length === 0 ? {} : { refAssetIds: refs }
			}, textOf(source, "serverId")) }, 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/episodes/:episode/drafts/:draft",
		handler: ({ request, store, params }) => {
			const path = store.episodeDraftPath(params["project"] ?? "", params["episode"] ?? "", params["draft"] ?? "");
			if (!existsSync(path)) return failure("这张草稿图已经不在磁盘上", 404);
			return serveFile(request, {
				path,
				name: `${params["draft"] ?? "draft"}.png`,
				mime: "image/png",
				mutable: true
			});
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project/episodes/:episode/drafts/:draft",
		handler: ({ store, params }) => {
			store.deleteEpisodeDraft(params["project"] ?? "", params["episode"] ?? "", params["draft"] ?? "");
			return json({ ok: true });
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/drafts/:draft/adopt",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const projectId = params["project"] ?? "";
			const episodeId = params["episode"] ?? "";
			const draftId = params["draft"] ?? "";
			const draft = store.listEpisodeDrafts(projectId, episodeId).find((entry) => entry["id"] === draftId);
			if (draft === void 0) return failure("草稿不存在", 404);
			const bytes = new Uint8Array(readFileSync(store.episodeDraftPath(projectId, episodeId, draftId)));
			const category = categoryOf$1(textOf(source, "assetId") ?? textOf(source, "categoryFrom") ?? "");
			const explicit = textOf(source, "name") ?? "";
			const fallback = String(draft["prompt"] ?? "").slice(0, 12).replace(/[\\/:*?"<>|]/gu, "_") || "草稿";
			const base = explicit.trim() !== "" ? explicit.trim() : fallback;
			const name = /\.[\w]{2,5}$/u.test(base) ? base : `${base}.png`;
			return json(importAsset(store, projectId, {
				name,
				mime: "image/png",
				bytes,
				library: "episode",
				episodeId,
				category,
				storedAs: name
			}), 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/episodes/:episode/script",
		handler: ({ store, params, url }) => {
			const doc = scriptDocOf(url.searchParams.get("doc"));
			const file = docFileOf(store, params["project"] ?? "", params["episode"] ?? "", doc);
			const text = file.exists ? readFileSync(file.path, "utf8") : "";
			return json({
				doc,
				name: file.name,
				path: file.path,
				text,
				exists: file.exists
			});
		}
	},
	{
		method: "PUT",
		pattern: "/projects/:project/episodes/:episode/script",
		handler: async ({ request, store, params, url }) => {
			const text = textOf(await bodyOf(request), "text");
			if (text === void 0) return failure("请提供剧本内容");
			const doc = scriptDocOf(url.searchParams.get("doc"));
			const file = docFileOf(store, params["project"] ?? "", params["episode"] ?? "", doc);
			writeFileSync(file.path, text, "utf8");
			return json({
				ok: true,
				doc,
				name: file.name,
				path: file.path,
				savedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/generate",
		handler: async ({ request, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const text = await request.text();
			const source = text.trim() === "" ? {} : JSON.parse(text);
			const projectId = params["project"] ?? "";
			const episodeId = params["episode"] ?? "";
			const clipId = typeof source["clipId"] === "string" ? source["clipId"] : void 0;
			const serverId = typeof source["serverId"] === "string" ? source["serverId"] : void 0;
			if (clipId !== void 0) return json({ jobIds: [engine.enqueue(projectId, episodeId, clipId, serverId)] }, 201);
			return json({ jobIds: engine.enqueueAll(projectId, episodeId, source["includeDone"] === true, serverId) }, 201);
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/cancel",
		handler: async ({ request, engine, params }) => {
			if (engine === null) return failure("调度器未启动");
			const text = await request.text();
			const source = text.trim() === "" ? {} : JSON.parse(text);
			const projectId = params["project"] ?? "";
			const episodeId = params["episode"] ?? "";
			const jobId = typeof source["jobId"] === "string" ? source["jobId"] : void 0;
			if (jobId === void 0) await engine.cancelAll(projectId, episodeId);
			else await engine.cancel(projectId, jobId);
			return json({ ok: true });
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/episodes/:episode/jobs",
		handler: ({ store, params }) => json(listJobs(store, params["project"] ?? "", params["episode"] ?? ""))
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/merge",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const output = textOf(source, "output");
			if (output === void 0 || output.trim() === "") return failure("请指定输出文件路径");
			const strategy = source["strategy"] === "reencode" ? "reencode" : "copy";
			return json(await mergeEpisode(store, params["project"] ?? "", params["episode"] ?? "", output, strategy));
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/episodes/:episode/export-clips",
		handler: async ({ request, store, params }) => {
			const target = textOf(await bodyOf(request), "targetDir");
			if (target === void 0 || target.trim() === "") return failure("请指定导出目录");
			return json({ files: exportClipFilms(store, params["project"] ?? "", params["episode"] ?? "", target) });
		}
	}
];
// lib/types/db/legacy-import.js
/**
* 旧插件数据导入器：只读 `<profile>/time-river`，写进新库。
*
* 三种东西只读不写：旧 catalog.db、各项目 project.db、素材文件本身。
* 导入可以反复跑（已登记的项目按目录识别，跳过）；正式导入前先 `inspectLegacy`
* 出一份报告，确认项目数、剧集数、片段数、缺文件。
*
* 不导入的东西（手册 1.4.2）：旧工作流（新项目只内置 3 条）、console_* 分镜数据
* （槽改由 `clips.slots_json` 与 series 扫描提供）、tracks、历史 jobs。
* @module dsh-dream-studio-host/db/legacy-import
*/
/** 旧插件的项目库文件名（只读打开）。 */
const LEGACY_DB_FILE = "project.db";
/** 只读打开一个旧库。 */
function openLegacy(path) {
	return new DatabaseSync(path, { readOnly: true });
}
/** 表是否存在。 */
function hasTable(db, name) {
	return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== void 0;
}
/** 安全读一列。 */
function value(row, key) {
	return Object.hasOwn(row, key) ? row[key] : void 0;
}
/** 读字符串。 */
function text(row, key, fallback = "") {
	const found = value(row, key);
	return typeof found === "string" ? found : fallback;
}
/** 读数字或 null。 */
function num(row, key) {
	const found = value(row, key);
	if (typeof found === "number" && Number.isFinite(found)) return found;
	if (typeof found === "string" && found.trim() !== "" && Number.isFinite(Number(found))) return Number(found);
	return null;
}
/** 读 0/1 布尔。 */
function bit(row, key) {
	return Number(value(row, key) ?? 0) === 1;
}
/** 旧素材分类映射到新枚举。 */
function categoryOf(raw) {
	return raw === "character" || raw === "scene" || raw === "prop" || raw === "generated" ? raw : "";
}
/**
* 解析旧 `slots_json`。
*
* 旧格式是 `{ i2v: [...] }` 或 `[]`；每条含 `role` / `n` / `frameIndex` / `prompt`。
* @param raw - 列内容。
* @returns 槽列表。
*/
function parseLegacySlots(raw) {
	if (raw.trim() === "" || raw.trim() === "[]") return [];
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	const list = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null ? Object.values(parsed).find(Array.isArray) ?? [] : [];
	const out = [];
	for (const entry of list) {
		if (typeof entry !== "object" || entry === null) continue;
		const slot = entry;
		const roleText = typeof slot["role"] === "string" ? slot["role"] : "";
		if (roleText !== "first" && roleText !== "last" && roleText !== "keyframe") continue;
		const prompt = typeof slot["prompt"] === "string" ? slot["prompt"] : "";
		const n = roleText === "keyframe" ? Math.max(1, Math.round(Number(slot["n"] ?? 1))) : null;
		out.push({
			key: roleText === "first" ? "first" : roleText === "last" ? "last" : `kf-${String(n ?? 1)}`,
			role: roleText,
			n,
			frameIndex: typeof slot["frameIndex"] === "number" && Number.isFinite(slot["frameIndex"]) ? slot["frameIndex"] : null,
			prompt
		});
	}
	return out;
}
/**
* 只读探查**一个项目目录**（旧插件的 project.db 就在里面）。
*
* 用于"新建项目时选了一个已经有旧数据的目录"：目录即项目，不需要旧 catalog.db。
* @param dir - 项目目录。
* @param name - 项目名（缺省用目录名）。
* @returns 探查报告（只有一个项目）。
*/
function inspectLegacyProject(dir, name) {
	const warnings = [];
	const missingFiles = [];
	const dbPath = join(dir, LEGACY_DB_FILE);
	if (!existsSync(dbPath)) return {
		root: dir,
		catalogOk: false,
		projects: [],
		servers: [],
		workflowCount: 0,
		missingFiles,
		warnings: ["这个目录里没有旧库 project.db"]
	};
	const db = openLegacy(dbPath);
	let episodes = [];
	try {
		const hasSetup = hasTable(db, "console_setup");
		const setupOf = /* @__PURE__ */ new Map();
		if (hasSetup) for (const entry of db.prepare("SELECT episode_id, series_sha256 FROM console_setup").all()) setupOf.set(text(entry, "episode_id"), text(entry, "series_sha256"));
		episodes = (hasTable(db, "episodes") ? db.prepare("SELECT * FROM episodes ORDER BY order_index").all() : []).map((entry) => {
			const id = text(entry, "id");
			const count = (sql, param) => {
				try {
					return db.prepare(sql).get(param).n;
				} catch {
					return 0;
				}
			};
			let slots = 0;
			if (hasTable(db, "clips")) {
				const rows = db.prepare("SELECT slots_json FROM clips WHERE episode_id = ? AND slots_json <> ''").all(id);
				for (const clip of rows) slots += parseLegacySlots(text(clip, "slots_json")).length;
			}
			return {
				id,
				name: text(entry, "name"),
				order: Number(value(entry, "order_index") ?? 0),
				dirPath: typeof value(entry, "dir_path") === "string" ? String(value(entry, "dir_path")) : null,
				seriesSha256: setupOf.get(id) ?? "",
				counts: {
					clips: count("SELECT COUNT(*) AS n FROM clips WHERE episode_id = ?", id),
					assets: count("SELECT COUNT(*) AS n FROM episode_assets WHERE episode_id = ?", id),
					keyframes: count("SELECT COUNT(*) AS n FROM keyframes k JOIN clips c ON c.id = k.clip_id WHERE c.episode_id = ?", id),
					refs: count("SELECT COUNT(*) AS n FROM clip_refs r JOIN clips c ON c.id = r.clip_id WHERE c.episode_id = ?", id),
					slots
				}
			};
		});
		if (hasTable(db, "assets")) for (const asset of db.prepare("SELECT name, stored_name FROM assets").all()) {
			const stored = text(asset, "stored_name");
			if (!existsSync(join(dir, "assets", stored))) missingFiles.push(join(dir, "assets", stored));
		}
	} finally {
		db.close();
	}
	return {
		root: dir,
		catalogOk: true,
		projects: [{
			id: `legacy-${String(Date.now())}`,
			name: name ?? dir.split(/[\\/]/u).pop() ?? dir,
			path: dir,
			exists: true,
			dbOk: true,
			episodes,
			workflowCount: 0
		}],
		servers: [],
		workflowCount: 0,
		missingFiles,
		warnings
	};
}
/**
* 只读探查旧数据根。
* @param root - `<profile>/time-river`。
* @returns 报告。
*/
function inspectLegacy(root) {
	const warnings = [];
	const missingFiles = [];
	const catalogPath = join(root, "catalog.db");
	if (!existsSync(catalogPath)) {
		if (existsSync(join(root, LEGACY_DB_FILE))) return inspectLegacyProject(root);
		return {
			root,
			catalogOk: false,
			projects: [],
			servers: [],
			workflowCount: 0,
			missingFiles,
			warnings: ["没有找到 catalog.db"]
		};
	}
	const catalog = openLegacy(catalogPath);
	try {
		const projectRows = hasTable(catalog, "projects") ? catalog.prepare("SELECT id, name, path, created_at FROM projects ORDER BY created_at").all() : [];
		const serverRows = hasTable(catalog, "servers") ? catalog.prepare("SELECT * FROM servers").all() : [];
		const workflowCount = hasTable(catalog, "workflows") ? catalog.prepare("SELECT COUNT(*) AS n FROM workflows").get().n : 0;
		const projects = [];
		for (const row of projectRows) {
			const path = text(row, "path");
			const exists = existsSync(path);
			let dbOk = false;
			let episodes = [];
			if (exists && existsSync(join(path, LEGACY_DB_FILE))) {
				const db = openLegacy(join(path, LEGACY_DB_FILE));
				try {
					dbOk = true;
					const hasSetup = hasTable(db, "console_setup");
					const setupOf = /* @__PURE__ */ new Map();
					if (hasSetup) for (const entry of db.prepare("SELECT episode_id, series_sha256 FROM console_setup").all()) setupOf.set(text(entry, "episode_id"), text(entry, "series_sha256"));
					episodes = (hasTable(db, "episodes") ? db.prepare("SELECT * FROM episodes ORDER BY order_index").all() : []).map((entry) => {
						const id = text(entry, "id");
						const count = (sql, param) => {
							try {
								return db.prepare(sql).get(param).n;
							} catch {
								return 0;
							}
						};
						let slots = 0;
						if (hasTable(db, "clips")) {
							const rows = db.prepare("SELECT slots_json FROM clips WHERE episode_id = ? AND slots_json <> ''").all(id);
							for (const clip of rows) slots += parseLegacySlots(text(clip, "slots_json")).length;
						}
						return {
							id,
							name: text(entry, "name"),
							order: Number(value(entry, "order_index") ?? 0),
							dirPath: typeof value(entry, "dir_path") === "string" ? String(value(entry, "dir_path")) : null,
							seriesSha256: setupOf.get(id) ?? "",
							counts: {
								clips: count("SELECT COUNT(*) AS n FROM clips WHERE episode_id = ?", id),
								assets: count("SELECT COUNT(*) AS n FROM episode_assets WHERE episode_id = ?", id),
								keyframes: count("SELECT COUNT(*) AS n FROM keyframes k JOIN clips c ON c.id = k.clip_id WHERE c.episode_id = ?", id),
								refs: count("SELECT COUNT(*) AS n FROM clip_refs r JOIN clips c ON c.id = r.clip_id WHERE c.episode_id = ?", id),
								slots
							}
						};
					});
					if (hasTable(db, "assets")) for (const asset of db.prepare("SELECT name, stored_name FROM assets").all()) {
						const stored = text(asset, "stored_name");
						if (!existsSync(join(path, "assets", stored))) missingFiles.push(join(path, "assets", stored));
					}
				} finally {
					db.close();
				}
			} else if (!exists) warnings.push(`项目「${text(row, "name")}」的目录已不在：${path}`);
			else warnings.push(`项目「${text(row, "name")}」没有 project.db：${path}`);
			projects.push({
				id: text(row, "id"),
				name: text(row, "name"),
				path,
				exists,
				dbOk,
				episodes,
				workflowCount
			});
		}
		return {
			root,
			catalogOk: true,
			projects,
			servers: serverRows.map((row) => ({
				id: text(row, "id"),
				name: text(row, "name"),
				baseUrl: text(row, "base_url"),
				type: text(row, "type", "local"),
				isDefault: bit(row, "is_default"),
				createdAt: text(row, "created_at")
			})),
			workflowCount,
			missingFiles,
			warnings
		};
	} finally {
		catalog.close();
	}
}
/**
* 把探查结果写进新库。
*
* 规则：项目按目录识别（已登记则跳过整项目）；剧集按 `dir_path` 或名字识别；
* 素材、片段、参考位、关键帧、槽按旧 id 原样写入，`INSERT OR REPLACE` 保证可重跑。
* @param store - 新库门面。
* @param report - 探查结果。
* @returns 导入统计。
*/
function importLegacy(store, report) {
	const warnings = [];
	const skippedProjects = [];
	let projects = 0;
	let episodes = 0;
	let assets = 0;
	let assetImages = 0;
	let clips = 0;
	let refs = 0;
	let keyframes = 0;
	let slots = 0;
	for (const project of report.projects) {
		if (!project.exists || !project.dbOk) {
			skippedProjects.push(project.path);
			continue;
		}
		const known = store.findProjectByPath(project.path);
		const projectId = known?.id ?? project.id;
		if (known === null) {
			store.withCatalogDb((db) => {
				db.prepare("INSERT OR REPLACE INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)").run(projectId, project.name, project.path, nowIso());
				for (const server of report.servers) db.prepare("INSERT OR REPLACE INTO servers (id, name, base_url, type, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(server.id, server.name, server.baseUrl, server.type === "remote" || server.type === "cloud" ? server.type : "local", server.isDefault ? 1 : 0, server.createdAt === "" ? nowIso() : server.createdAt);
			});
			projects += 1;
		}
		openProjectDatabase(project.path, PROJECT_DB_FILE).close();
		const legacy = openLegacy(join(project.path, LEGACY_DB_FILE));
		try {
			store.withProjectDb(projectId, (db) => {
				db.exec("BEGIN");
				try {
					const episodeRows = hasTable(legacy, "episodes") ? legacy.prepare("SELECT * FROM episodes ORDER BY order_index").all() : [];
					for (const row of episodeRows) {
						const id = text(row, "id");
						const dirPath = typeof value(row, "dir_path") === "string" ? String(value(row, "dir_path")) : null;
						const found = db.prepare("SELECT id FROM episodes WHERE id = ? OR (dir_path IS NOT NULL AND dir_path = ?)").get(id, dirPath ?? "");
						const matched = report.projects.find((entry) => entry.id === project.id)?.episodes.find((entry) => entry.id === id);
						if (found === void 0) {
							db.prepare("INSERT INTO episodes (id, name, order_index, dir_path, server_id, series_sha256, synced_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, text(row, "name"), Number(value(row, "order_index") ?? 0), dirPath, typeof value(row, "server_id") === "string" ? String(value(row, "server_id")) : null, matched?.seriesSha256 ?? "", matched?.seriesSha256 === "" ? null : nowIso(), text(row, "created_at", nowIso()));
							episodes += 1;
						}
					}
					if (hasTable(legacy, "assets")) for (const row of legacy.prepare("SELECT * FROM assets").all()) {
						db.prepare(`INSERT OR REPLACE INTO assets (id, name, stored_name, type, mime, size, duration, width, height, fps, has_audio,
                   library, episode_id, category, transient, revision, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(text(row, "id"), text(row, "name"), text(row, "stored_name"), text(row, "type", "image"), text(row, "mime", "image/png"), Number(value(row, "size") ?? 0), num(row, "duration"), num(row, "width"), num(row, "height"), num(row, "fps"), bit(row, "has_audio") ? 1 : 0, text(row, "library", "project") === "episode" ? "episode" : "project", text(row, "episode_id"), categoryOf(text(row, "category")), bit(row, "transient") ? 1 : 0, Number(value(row, "revision") ?? 0), text(row, "created_at", nowIso()));
						assets += 1;
					}
					if (hasTable(legacy, "asset_images")) for (const row of legacy.prepare("SELECT * FROM asset_images").all()) {
						db.prepare(`INSERT OR REPLACE INTO asset_images (id, asset_id, stored_name, prompt, workflow_id, seed, active, size, episode_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(text(row, "id"), text(row, "asset_id"), text(row, "stored_name"), typeof value(row, "prompt") === "string" ? String(value(row, "prompt")) : null, typeof value(row, "workflow_id") === "string" ? String(value(row, "workflow_id")) : null, num(row, "seed"), bit(row, "active") ? 1 : 0, Number(value(row, "size") ?? 0), text(row, "episode_id"), text(row, "created_at", nowIso()));
						assetImages += 1;
					}
					if (hasTable(legacy, "episode_assets")) for (const row of legacy.prepare("SELECT * FROM episode_assets").all()) db.prepare("INSERT OR REPLACE INTO episode_assets (episode_id, asset_id, created_at) VALUES (?, ?, ?)").run(text(row, "episode_id"), text(row, "asset_id"), text(row, "created_at", nowIso()));
					const clipRows = hasTable(legacy, "clips") ? legacy.prepare("SELECT * FROM clips ORDER BY order_index").all() : [];
					for (const row of clipRows) {
						const id = text(row, "id");
						const seriesKey = text(row, "series_key") === "" ? text(row, "console_key") : text(row, "series_key");
						db.prepare(`INSERT OR REPLACE INTO clips (id, episode_id, order_index, series_key, mode, prompt, prompt_en, duration, fps, scale, ratio,
                 resolution, seed, first_pass_steps, second_pass, second_denoise, second_scale, second_steps,
                 continue_from_prev, first_frame_from_prev, guide_frame_count, first_frame_asset_id, last_frame_asset_id,
                 workflow_id, loras, status, result_video_path, generation_ms, error_message, submission_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`).run(id, text(row, "episode_id"), Number(value(row, "order_index") ?? 0), seriesKey, fromLegacyMode(text(row, "mode", "r2v")), text(row, "prompt"), text(row, "prompt_zh"), Number(value(row, "duration") ?? 5), num(row, "fps"), num(row, "scale"), typeof value(row, "ratio") === "string" ? String(value(row, "ratio")) : null, typeof value(row, "resolution") === "string" ? String(value(row, "resolution")) : null, num(row, "seed"), num(row, "steps"), bit(row, "second_pass") ? 1 : 0, num(row, "second_denoise"), num(row, "second_scale"), num(row, "second_steps"), bit(row, "continue_from_prev") ? 1 : 0, bit(row, "first_frame_from_prev") ? 1 : 0, num(row, "guide_frame_count"), typeof value(row, "first_frame_asset_id") === "string" ? String(value(row, "first_frame_asset_id")) : null, typeof value(row, "last_frame_asset_id") === "string" ? String(value(row, "last_frame_asset_id")) : null, typeof value(row, "workflow_id") === "string" ? String(value(row, "workflow_id")) : null, text(row, "loras", "[]"), text(row, "status", "pending"), typeof value(row, "result_video_path") === "string" ? String(value(row, "result_video_path")) : null, typeof value(row, "error_message") === "string" ? String(value(row, "error_message")) : null, text(row, "submission_json", "{}"), text(row, "created_at", nowIso()), nowIso());
						clips += 1;
						const slotList = parseLegacySlots(text(row, "slots_json"));
						if (slotList.length > 0) {
							db.prepare("DELETE FROM clip_slots WHERE clip_id = ? AND source = ?").run(id, "series");
							for (const slot of slotList) {
								const keyframe = slot.frameIndex === null ? void 0 : db.prepare("SELECT id FROM keyframes WHERE clip_id = ? AND frame_index = ?").get(id, slot.frameIndex);
								db.prepare(`INSERT OR REPLACE INTO clip_slots (clip_id, slot_key, role, n, at_seconds, frame_index, prompt, asset_id, keyframe_id, source)
                   VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, ?, 'series')`).run(id, slot.key, slot.role, slot.n, slot.frameIndex, slot.prompt, keyframe?.id ?? null);
								slots += 1;
							}
						}
					}
					const keyframeRows = hasTable(legacy, "keyframes") ? legacy.prepare("SELECT * FROM keyframes").all() : [];
					for (const row of keyframeRows) {
						db.prepare(`INSERT OR REPLACE INTO keyframes (id, clip_id, slot_key, position, frame_index, prompt, status, seed, revision, error_message, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(text(row, "id"), text(row, "clip_id"), text(row, "slot_key"), Number(value(row, "position") ?? 0), Number(value(row, "frame_index") ?? 0), text(row, "prompt"), text(row, "status", "planned"), num(row, "seed"), Number(value(row, "revision") ?? 0), typeof value(row, "error_message") === "string" ? String(value(row, "error_message")) : null, text(row, "created_at", nowIso()));
						keyframes += 1;
					}
					db.prepare(`UPDATE clip_slots SET keyframe_id = (
            SELECT id FROM keyframes k WHERE k.clip_id = clip_slots.clip_id AND k.frame_index = clip_slots.frame_index
          ) WHERE role = 'keyframe' AND keyframe_id IS NULL`).run();
					if (hasTable(legacy, "clip_refs")) for (const row of legacy.prepare("SELECT * FROM clip_refs").all()) {
						db.prepare("INSERT OR REPLACE INTO clip_refs (clip_id, kind, position, asset_id, asset_name, role, window_start, window_end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(text(row, "clip_id"), text(row, "kind", "image"), Number(value(row, "position") ?? 0), typeof value(row, "asset_id") === "string" ? String(value(row, "asset_id")) : null, text(row, "asset_name"), typeof value(row, "role") === "string" ? String(value(row, "role")) : null, num(row, "window_start"), num(row, "window_end"), typeof value(row, "note") === "string" ? String(value(row, "note")) : null);
						refs += 1;
					}
					db.exec("COMMIT");
				} catch (error) {
					db.exec("ROLLBACK");
					throw error;
				}
			});
		} finally {
			legacy.close();
		}
	}
	if (report.workflowCount > 0) warnings.push(`旧库的 ${String(report.workflowCount)} 条工作流未导入：新项目内置 3 条（文生图 / 万能图生图 / 全能链式续写），自定义模板请用「导入工作流」。`);
	return {
		projects,
		episodes,
		assets,
		assetImages,
		clips,
		refs,
		keyframes,
		slots,
		skippedProjects,
		warnings
	};
}
// lib/types/http/routes/projects.js
/** 项目路由表。 */
const projectRoutes = [
	{
		method: "GET",
		pattern: "/projects",
		handler: ({ store }) => json(store.listProjects())
	},
	{
		method: "POST",
		pattern: "/projects",
		handler: async ({ request, store }) => {
			const source = await bodyOf(request);
			const name = textOf(source, "name") ?? "";
			const dir = textOf(source, "dir");
			const ratio = textOf(source, "ratio");
			const resolution = textOf(source, "resolution");
			const created = store.createProject(name, dir, {
				...ratio === void 0 ? {} : { ratio },
				...resolution === void 0 ? {} : { resolution }
			});
			try {
				const report = inspectLegacy(created.dirPath);
				if (report.projects.length > 0 && report.projects[0]?.dbOk === true) importLegacy(store, report);
			} catch {}
			const adopted = store.adoptEpisodes(created.id);
			if (adopted > 0) store.log("Project", `认领目录内已有剧集 ${String(adopted)} 个`);
			for (const episode of store.listEpisodes(created.id)) try {
				scanEpisode(store, created.id, episode.id, true);
			} catch {}
			return json(store.listProjects().find((entry) => entry.id === created.id) ?? created, 201);
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project",
		handler: ({ store, params }) => json(store.payload(params["project"] ?? "", null))
	},
	{
		method: "PATCH",
		pattern: "/projects/:project",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const id = params["project"] ?? "";
			const name = textOf(source, "name");
			const ratio = textOf(source, "ratio");
			const resolution = textOf(source, "resolution");
			if (ratio !== void 0 || resolution !== void 0) store.setProjectDefaults(id, {
				...ratio === void 0 ? {} : { ratio },
				...resolution === void 0 ? {} : { resolution }
			});
			if (name !== void 0) store.renameProject(id, name);
			const updated = store.listProjects().find((entry) => entry.id === id);
			return updated === void 0 ? failure("项目不存在", 404) : json(updated);
		}
	},
	{
		method: "DELETE",
		pattern: "/projects/:project",
		handler: ({ store, params }) => {
			store.deleteProject(params["project"] ?? "");
			return json({ ok: true });
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/reveal",
		handler: ({ store, params }) => {
			const dir = store.projectDir(params["project"] ?? "");
			return openWithShell(dir) ? json({
				ok: true,
				target: dir
			}) : failure("打不开项目文件夹（宿主不支持打开系统窗口）");
		}
	},
	{
		method: "POST",
		pattern: "/projects/:project/open-path",
		handler: async ({ request, store, params }) => {
			const source = await bodyOf(request);
			const raw = (textOf(source, "path") ?? "").trim();
			const base = (textOf(source, "base") ?? "").trim();
			if (raw === "") return failure("要打开的文件路径是空的");
			const target = resolveProjectPath(store.projectDir(params["project"] ?? ""), raw, base);
			if (target === null) return failure(`找不到这个文件：${raw}`, 404);
			return openWithShell(target) ? json({
				ok: true,
				target
			}) : failure("打不开这个文件（宿主不支持打开系统窗口）");
		}
	},
	{
		method: "GET",
		pattern: "/projects/:project/file",
		handler: ({ request, store, params, url }) => {
			const raw = (url.searchParams.get("path") ?? "").trim();
			const base = (url.searchParams.get("base") ?? "").trim();
			if (raw === "") return failure("要打开的文件路径是空的");
			const target = resolveProjectPath(store.projectDir(params["project"] ?? ""), raw, base);
			if (target === null) return failure(`找不到这个文件：${raw}`, 404);
			const name = basename(target);
			return serveFile(request, {
				path: target,
				name,
				mime: mimeOf(name),
				mutable: true
			});
		}
	}
];
/**
* 把聊天里写的文件路径落到磁盘上的真实文件。
*
* 用户写的多是相对路径（`series.json`、`第01集/剧本.md`），也可能带 `@` 或引号；先按
* 绝对路径找，再按项目根找，最后在每个剧集目录下找一遍。
* @param projectDir - 项目根目录。
* @param raw - 原始路径文本。
* @param base - 优先尝试的目录（一般是当前剧集目录）。
* @returns 存在的绝对路径；找不到就是 null。
*/
function resolveProjectPath(projectDir, raw, base = "") {
	const cleaned = raw.replace(/^@+/u, "").replace(/^"|"$/gu, "").replace(/^'|'$/gu, "").trim();
	if (cleaned === "") return null;
	const normalized = cleaned.replace(/[\\/]+/gu, sep());
	if (isAbsolute(normalized)) return existsSync(normalized) ? normalized : null;
	if (base !== "") {
		const preferred = join(base, normalized);
		if (existsSync(preferred)) return preferred;
	}
	const direct = join(projectDir, normalized);
	if (existsSync(direct)) return direct;
	let entries = [];
	try {
		entries = readdirSync(projectDir, { withFileTypes: true });
	} catch {
		return null;
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const candidate = join(projectDir, entry.name, normalized);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}
/** 平台路径分隔符。 */
function sep() {
	return process.platform === "win32" ? "\\" : "/";
}
/**
* 按后缀猜 MIME：预览要按类型渲染（文本用 `<pre>`，图片/视频直接给标签）。
* @param name - 文件名。
* @returns MIME 字符串，未知就是二进制。
*/
function mimeOf(name) {
	return {
		md: "text/markdown; charset=utf-8",
		markdown: "text/markdown; charset=utf-8",
		txt: "text/plain; charset=utf-8",
		log: "text/plain; charset=utf-8",
		json: "application/json; charset=utf-8",
		jsonl: "application/jsonl; charset=utf-8",
		csv: "text/csv; charset=utf-8",
		yml: "text/yaml; charset=utf-8",
		yaml: "text/yaml; charset=utf-8",
		srt: "text/plain; charset=utf-8",
		js: "text/plain; charset=utf-8",
		mjs: "text/plain; charset=utf-8",
		ts: "text/plain; charset=utf-8",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		webp: "image/webp",
		gif: "image/gif",
		bmp: "image/bmp",
		mp4: "video/mp4",
		webm: "video/webm",
		mov: "video/quicktime",
		m4v: "video/mp4",
		mp3: "audio/mpeg",
		wav: "audio/wav",
		flac: "audio/flac",
		pdf: "application/pdf"
	}[name.slice(name.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";
}
/**
* 交给系统默认程序打开（文件）或资源管理器（目录）。
* @param target - 绝对路径。
* @returns 是否成功发起（系统调用本身是异步的，这里只报"有没有抛错"）。
*/
function openWithShell(target) {
	try {
		const directory = statSync(target).isDirectory();
		const [command, args] = process.platform === "win32" ? directory ? ["explorer.exe", [target]] : ["rundll32.exe", ["url.dll,FileProtocolHandler", target]] : process.platform === "darwin" ? ["open", [target]] : ["xdg-open", [target]];
		spawn(command, args, {
			detached: true,
			stdio: "ignore",
			windowsHide: true
		}).unref();
		return true;
	} catch {
		return false;
	}
}
// lib/types/index.js
/**
* 时空造梦宿主插件：装配存储与私有 HTTP 面。
*
* 一个 Cordis 插件，两种宿主都能挂：Electron 宿主提供 `fetchRouter`（按前缀登记），
* 标准 composition 提供 `webServer`（登记 node:http 前缀路由）。两侧都只在服务到位
* 时才装配，因此没有承载的 composition 里它就是一行不生效的插件。
* @module dsh-dream-studio-host
*/
/** 全部路由，按资源分组。 */
const ROUTES = [
	...catalogRoutes,
	...catalogDeepRoutes,
	...projectRoutes,
	...episodeRoutes,
	...clipRoutes,
	...assetRoutes,
	...mirrorRoutes
];
/**
* 挂载时空造梦宿主。
* @param ctx - 所属 composition 上下文。
* @param config - 前缀与数据根。
*/
function apply(ctx, config = {}) {
	const prefix = (config.prefix ?? "/dream-studio").replace(/\/+$/u, "");
	let store;
	let engine;
	let handler;
	let llm = null;
	let mountError = null;
	const mount = () => {
		if (store === void 0 || handler === void 0 || engine === void 0) try {
			const bridge = ctx.get("desktopBridge");
			const profile = ctx.get("profileContext");
			const dataRoot = config.dataRoot ?? bridge?.dataRoot ?? profile?.home;
			if (dataRoot === void 0) throw new Error("时空造梦：composition 没有提供数据根，请在插件行里设置 config.dataRoot");
			store = new DreamStore(join(resolve(dataRoot), DATA_FOLDER));
			const templates = loadTemplates();
			syncBuiltinWorkflows(store, templates);
			for (const project of store.listProjects()) store.healClipsWithFilm(project.id);
			engine = new Engine({
				store,
				dispatchMode: () => store?.settings().dispatchMode ?? "serial",
				templates
			});
			handler = createRouter(prefix, store, [...ROUTES, ...assistantRoutes({ llm })], { engine });
			mountError = null;
		} catch (thrown) {
			mountError = thrown instanceof Error ? thrown.message : String(thrown);
			store?.log("System", `挂载失败：${mountError}`);
			throw thrown;
		}
		if (store === void 0 || handler === void 0) throw new Error(mountError ?? "时空造梦未就绪");
		return {
			store,
			handler
		};
	};
	/** 挂载失败时给前端一个可读的 503，而不是让请求静默超时。 */
	const fallbackHandler = {
		async fetch() {
			return new Response(JSON.stringify({ error: mountError ?? "时空造梦未就绪" }), {
				status: 503,
				headers: { "content-type": "application/json" }
			});
		},
		requestBodyMode: () => "buffered"
	};
	ctx.effect(() => () => {
		engine?.dispose();
		store?.dispose();
	}, "dream-studio runtime");
	ctx.inject(["llm"], (carrier) => {
		const service = carrier.get("llm");
		llm = service === void 0 ? null : service;
	});
	ctx.inject(["fetchRouter"], (carrier) => {
		let handlerForRoute = fallbackHandler;
		try {
			handlerForRoute = mount().handler;
		} catch {}
		carrier.get("fetchRouter").register(prefix, handlerForRoute);
	});
	ctx.inject(["webServer"], (carrier) => {
		let nodeHandler = fallbackHandler;
		try {
			nodeHandler = mount().handler;
		} catch {}
		const route = {
			kind: "prefix",
			path: prefix,
			handler: nodeRoute(nodeHandler)
		};
		carrier.effect(() => carrier.get("webServer").register(route), "dream-studio HTTP route");
	});
}
export { DreamStore, apply };
