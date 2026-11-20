window.__ModuleLoader__.load({
	id: "dsh-dream-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		// \0dsh-global-css:F:\时空造梦\client\src\client\styles\tokens.css.mjs
		const css$1 = ":root,[data-studio]{--ds-space-1:4px;--ds-space-2:8px;--ds-space-3:12px;--ds-space-4:16px;--ds-space-5:24px;--ds-space-6:32px;--ds-radius-s:4px;--ds-radius-m:6px;--ds-radius-l:10px;--ds-left:220px;--ds-right:340px;--ds-header:52px;--ds-tabs:36px;--ds-status:26px;--ds-font:system-ui, \"PingFang SC\", \"Microsoft YaHei\", sans-serif;--ds-bg:transparent;--ds-surface:transparent;--ds-raised:#fff;--ds-hover:#0000000f;--ds-line:#00000024;--ds-line-strong:#00000047;--ds-text:#1a1d21;--ds-text-2:#4a5058;--ds-text-3:#6b7280;--ds-muted:#8b919a;--ds-primary:#2f6bff;--ds-primary-dim:#2f6bff2e;--ds-primary-weak:#2f6bff1a;--ds-danger:#d64545;--ds-success:#1a9c62;--ds-warning:#c07a00;--ds-shadow-1:0 1px 2px #00000014;--ds-shadow-2:0 6px 20px #00000029;--studio-ratio:16 / 9}[data-studio]{color-scheme:light}[data-scheme=dark]{color-scheme:dark;--ds-raised:#22262c;--ds-hover:#ffffff14;--ds-line:#ffffff29;--ds-line-strong:#ffffff4d;--ds-text:#eceef1;--ds-text-2:#b6bcc4;--ds-text-3:#8f969f;--ds-muted:#777e87;--ds-primary:#6b8dff;--ds-primary-dim:#6b8dff38;--ds-primary-weak:#6b8dff24;--ds-danger:#ef5f5f;--ds-success:#38c98a;--ds-warning:#e0a843;--ds-shadow-1:0 1px 2px #0006;--ds-shadow-2:0 6px 20px #00000080}";
		const tagId$1 = "dsh-dream-studio/tokens.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-dream-studio";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		// src/client/HallMark.tsx
		/** 渲染入口图形。 */
		function HallMark(_props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "20",
				height: "20",
				viewBox: "0 0 20 20",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2 10c3-5 6-5 8 0s5 5 8 0",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinecap: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "10",
					cy: "10",
					r: "1.6",
					fill: "currentColor"
				})]
			});
		}
		// src/client/api.ts
		/** HTTP 前缀。 */
		const ROOT = "/dream-studio";
		/** 一次失败请求。 */
		var HttpError = class extends Error {
			status;
			constructor(status, message) {
				super(message);
				this.status = status;
				this.name = "HttpError";
			}
		};
		/**
		* 发一次请求并解 JSON。
		* @param path - 前缀之后的路径。
		* @param init - fetch 初始化。
		* @returns 解析后的值。
		*/
		async function request(path, init) {
			const response = await fetch(`${ROOT}${path}`, {
				...init,
				headers: {
					"content-type": "application/json",
					...init?.headers ?? {}
				}
			});
			const text = await response.text();
			if (!response.ok) {
				let message = `请求失败（${String(response.status)}）`;
				try {
					const parsed = JSON.parse(text);
					if (typeof parsed === "object" && parsed !== null && "error" in parsed) message = String(parsed.error);
				} catch {}
				throw new HttpError(response.status, message);
			}
			return text === "" ? null : JSON.parse(text);
		}
		/**
		* 直接拉一次进度真值（事件流的兜底）。
		* @returns 服务端快照。
		*/
		async function fetchProgress() {
			return await request("/progress");
		}
		async function listProjects() {
			return await request("/projects");
		}
		/**
		* 用系统默认程序打开项目里的文件（插件面板里点文件芯片的兜底）。
		*
		* 面板是全局面板，DSH 自己的「在右侧栏打开」没有会话页面可挂，必然失败。
		* @param projectId - 项目 id。
		* @param path - 文件路径（可相对项目根）。
		* @param base - 优先解析的目录（一般是当前剧集目录）。
		*/
		async function openProjectPath(projectId, path, base) {
			return await request(`/projects/${encodeURIComponent(projectId)}/open-path`, {
				method: "POST",
				body: JSON.stringify(base === void 0 ? { path } : {
					path,
					base
				})
			});
		}
		/**
		* 文件预览地址：插件面板内直接读原文件，绕开 DSH「在右侧栏打开」那条必失败的路。
		* @param projectId - 项目。
		* @param path - 用户点的文件路径（相对项目根或剧集目录）。
		* @param base - 优先尝试的目录（一般是当前剧集目录）。
		* @returns 可直接放进 `<img>` / `<video>` / `fetch` 的地址。
		*/
		function projectFileUrl(projectId, path, base) {
			const query = `path=${encodeURIComponent(path)}${base === void 0 ? "" : `&base=${encodeURIComponent(base)}`}`;
			return `${ROOT}/projects/${encodeURIComponent(projectId)}/file?${query}`;
		}
		/** 新建项目。 */
		async function createProject(name, dir, defaults = {}) {
			return await request("/projects", {
				method: "POST",
				body: JSON.stringify({
					name,
					...dir === void 0 ? {} : { dir },
					...defaults
				})
			});
		}
		/** 删除项目。 */
		async function deleteProject(id) {
			await request(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
		}
		/**
		* 读一份文档。
		* @param projectId - 项目。
		* @param episodeId - 剧集（`script` 用；大纲/人物档案是项目级文件）。
		* @param doc - 读哪一份，默认本集剧本。
		*/
		async function readEpisodeScript(projectId, episodeId, doc = "script") {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/script?doc=${doc}`);
		}
		/** 写一份文档（自动保存用；没有文件会创建）。 */
		async function saveEpisodeScript(projectId, episodeId, text, doc = "script") {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/script?doc=${doc}`, {
				method: "PUT",
				body: JSON.stringify({ text })
			});
		}
		/** 让 ComfyUI 校验一下这个模板的模型配置（不排队、不占卡）。 */
		async function checkWorkflowModels(name, config) {
			return await request("/settings/workflow-models/check", {
				method: "POST",
				body: JSON.stringify({
					name,
					config
				})
			});
		}
		/** 列一段的成片历史。 */
		async function listClipVideos(projectId, clipId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/videos`);
		}
		/** 启用某条历史成片。 */
		async function activateClipVideo(projectId, clipId, videoId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/videos/${encodeURIComponent(videoId)}/activate`, {
				method: "POST",
				body: "{}"
			});
		}
		/** 删除一条历史成片记录。 */
		async function deleteClipVideo(projectId, clipId, videoId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });
		}
		/** 建 / 复用「自定义剧集」（没有 series.json，可手动加片段）。 */
		async function createCustomEpisode(projectId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/custom-episode`, {
				method: "POST",
				body: "{}"
			});
		}
		/** 在自定义剧集里加一个片段。 */
		async function addClip(projectId, episodeId, draft = {}) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/clips`, {
				method: "POST",
				body: JSON.stringify(draft)
			});
		}
		/** 读一个剧集载荷。 */
		async function readEpisode(projectId, episodeId) {
			return await request(episodeId === void 0 ? `/projects/${encodeURIComponent(projectId)}` : `/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}`);
		}
		/** 部署设置。 */
		async function readSettings() {
			return await request("/settings");
		}
		/** 读工作流模型的可选清单与默认值。 */
		async function readWorkflowModelOptions() {
			return await request("/settings/workflow-models");
		}
		/**
		* 素材文件地址。
		* @param projectId - 项目。
		* @param assetId - 素材。
		* @param revision - 素材版本，进 URL 让缓存自然失效。
		* @returns 可直接放进 `<img src>` 的地址。
		*/
		function assetUrl(projectId, assetId, revision = 0) {
			return `${ROOT}/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}?v=${String(revision)}`;
		}
		/** 认领项目目录里的集目录（为空的剧集列表补登记）。 */
		async function adoptEpisodes(projectId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/adopt`, { method: "POST" });
		}
		/**
		* 扫描剧集的 `series.json` 并同步到片段。
		* @param projectId - 项目。
		* @param episodeId - 剧集。
		* @param force - 忽略指纹。
		* @returns 扫描结果。
		*/
		async function syncEpisode(projectId, episodeId, force = false) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/sync`, {
				method: "POST",
				body: JSON.stringify({ force })
			});
		}
		/**
		* 反向同步：把界面里改过的时长 / 参考图 / 提示词写回 `series.json`。
		* @param projectId - 项目。
		* @param episodeId - 剧集。
		* @returns 写回结果。
		*/
		async function writeBackSeries(projectId, episodeId, clipId = null) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/sync-out`, {
				method: "POST",
				body: JSON.stringify({ clipId })
			});
		}
		/**
		* 片段成片地址。
		* @param projectId - 项目。
		* @param clipId - 片段。
		* @param version - 版本标记（用 generationMs 或 updatedAt 都行），进 URL 让缓存失效。
		* @returns 可直接放进 `<video src>` 的地址。
		*/
		/**
		* 成片 URL 的版本号。
		*
		* 用「生成耗时/更新时间 + 当前启用的历史记录」拼：只按时间戳的话，在成片历史里
		* 切到另一条（时间戳没变）浏览器会继续用缓存里的旧片，看起来就是"启用没反应"。
		* @param clip - 片段。
		*/
		function clipVideoVersion(clip) {
			return [String(clip.generationMs ?? clip.updatedAt ?? ""), clip.activeVideoId ?? ""].join("-");
		}
		function clipResultUrl(projectId, clipId, version) {
			return `${ROOT}/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/result?v=${encodeURIComponent(String(version))}`;
		}
		/**
		* 改一个片段。
		* @param projectId - 项目。
		* @param clipId - 片段。
		* @param input - 变更字段。
		* @returns 新载荷。
		*/
		async function updateClip(projectId, clipId, input) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}`, {
				method: "PATCH",
				body: JSON.stringify(input)
			});
		}
		/**
		* 列一个项目的素材（可带剧集作用域）。
		* @param projectId - 项目。
		* @param episodeId - 剧集；给了就把本集素材也算进来。
		* @returns 素材列表。
		*/
		async function listAssets(projectId, episodeId) {
			const query = episodeId === void 0 ? "" : `?episodeId=${encodeURIComponent(episodeId)}`;
			return await request(`/projects/${encodeURIComponent(projectId)}/assets${query}`);
		}
		/** 列 ComfyUI 服务（带可达性）。 */
		async function listServers() {
			return await request("/servers");
		}
		/**
		* 取内嵌地址。
		*
		* ComfyUI 拒绝跨源嵌入（403），所以由宿主起一个本地反代再嵌；这里只负责要地址。
		* @param serverId - 指定服务；不给就用默认服务。
		* @returns 反代地址与目标。
		*/
		async function comfyMirror(serverId) {
			return await request(`/comfy-mirror${serverId === void 0 ? "" : `?server=${encodeURIComponent(serverId)}`}`);
		}
		/** 读最近的运行日志。 */
		async function readLogs() {
			return await request("/logs");
		}
		/** 新增 ComfyUI 服务。 */
		async function addServer(input) {
			return await request("/servers", {
				method: "POST",
				body: JSON.stringify(input)
			});
		}
		/** 强制重探一个服务的能力。 */
		async function testServer(serverId) {
			return await request(`/servers/${encodeURIComponent(serverId)}/test`, { method: "POST" });
		}
		/** 设为默认服务。 */
		async function setDefaultServer(serverId) {
			return await request(`/servers/${encodeURIComponent(serverId)}/default`, { method: "POST" });
		}
		/** 删除服务。 */
		async function deleteServer(serverId) {
			return await request(`/servers/${encodeURIComponent(serverId)}`, { method: "DELETE" });
		}
		/** 改设置（调度模式、ffmpeg 路径等）。 */
		async function updateSettings(patch) {
			return await request("/settings", {
				method: "PATCH",
				body: JSON.stringify(patch)
			});
		}
		/** 排队生成一个片段或整集。 */
		async function generate(projectId, episodeId, clipId, includeDone = false) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/generate`, {
				method: "POST",
				body: JSON.stringify(clipId === void 0 ? { includeDone } : { clipId })
			});
		}
		/** 排队一个片段的「独立二采」：读一采 latent，按片段上的倍率/降噪/步数放大成高清成片。 */
		async function startSecondPass(projectId, clipId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/second-pass`, {
				method: "POST",
				body: JSON.stringify({})
			});
		}
		/** 排队「视频放大」：把本段成片按 RelayVSR 放大到 2K / 4K。 */
		async function startVideoUpscale(projectId, clipId, level) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/upscale`, {
				method: "POST",
				body: JSON.stringify({ level })
			});
		}
		/** 排队「视频补帧」：把本段成片按每秒补充的帧数补帧（默认 10 帧）。 */
		async function startVideoInterpolate(projectId, clipId, multiplier) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/interpolate`, {
				method: "POST",
				body: JSON.stringify({ multiplier })
			});
		}
		/** 取消一个任务或整集。 */
		async function cancel$1(projectId, episodeId, jobId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/cancel`, {
				method: "POST",
				body: JSON.stringify(jobId === void 0 ? {} : { jobId })
			});
		}
		/** 列一集的任务。 */
		async function listJobs(projectId, episodeId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/jobs`);
		}
		/** 事件流地址。 */
		function eventsUrl() {
			return `${ROOT}/events`;
		}
		/** 导入一份素材（multipart）。 */
		async function uploadAsset(projectId, file, options = {}) {
			const form = new FormData();
			form.set("file", file);
			if (options.library !== void 0) form.set("library", options.library);
			if (options.episodeId !== void 0) form.set("episodeId", options.episodeId);
			if (options.category !== void 0) form.set("category", options.category);
			const response = await fetch(`${ROOT}/projects/${encodeURIComponent(projectId)}/assets`, {
				method: "POST",
				body: form
			});
			const text = await response.text();
			if (!response.ok) {
				let message = `导入失败（${String(response.status)}）`;
				try {
					const parsed = JSON.parse(text);
					if (typeof parsed === "object" && parsed !== null && "error" in parsed) message = String(parsed.error);
				} catch {}
				throw new HttpError(response.status, message);
			}
			return JSON.parse(text);
		}
		/** 把一集里已出片的片段导出成独立文件。 */
		async function exportClipFilms(projectId, episodeId, targetDir) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/export-clips`, {
				method: "POST",
				body: JSON.stringify({ targetDir })
			});
		}
		/** 删一份素材。 */
		async function removeAsset(projectId, assetId, force = false) {
			return await request(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}${force ? "?force=true" : ""}`, { method: "DELETE" });
		}
		/** 拖放协议：素材卡写进去的 MIME。 */
		const ASSET_DRAG_MIME = "application/x-ds-asset";
		/** 助手：改写提示词。 */
		async function assistantRewrite(text, mode, extra) {
			return await request("/assistant/rewrite", {
				method: "POST",
				body: JSON.stringify({
					text,
					mode,
					...extra ?? {}
				})
			});
		}
		/** 列 ComfyUI 某个服务的模型文件夹（`folder` 省略时返回全部）。 */
		async function listModels(serverId, folder) {
			const query = folder === void 0 ? "" : `?folder=${encodeURIComponent(folder)}`;
			return await request(`/servers/${encodeURIComponent(serverId)}/models${query}`);
		}
		/** 改项目的默认画幅 / 分辨率。 */
		async function updateProjectDefaults(projectId, defaults) {
			return await request(`/projects/${encodeURIComponent(projectId)}`, {
				method: "PATCH",
				body: JSON.stringify(defaults)
			});
		}
		/** 改素材显示名。 */
		async function renameAsset(projectId, assetId, name) {
			return await request(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
				method: "PATCH",
				body: JSON.stringify({ name })
			});
		}
		/** 改槽：绑图（assetId）或插入点（atSeconds）。 */
		async function patchSlot(projectId, clipId, slotKey, patch) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/slots/${encodeURIComponent(slotKey)}`, {
				method: "PATCH",
				body: JSON.stringify(patch)
			});
		}
		/** 给片段加一个关键帧槽。 */
		async function addSlot(projectId, clipId, atSeconds) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/slots`, {
				method: "POST",
				body: JSON.stringify(atSeconds === void 0 ? {} : { atSeconds })
			});
		}
		/** 删掉一个关键帧槽（整张卡）。 */
		async function removeSlot(projectId, clipId, slotKey) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/slots/${encodeURIComponent(slotKey)}`, { method: "DELETE" });
		}
		/** 删一个参考位。 */
		async function removeRef(projectId, clipId, position) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/refs/${String(position)}`, { method: "DELETE" });
		}
		/** 片段草稿图：列。 */
		async function listDrafts(projectId, clipId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/drafts`);
		}
		/** 片段草稿图：生成一张。 */
		async function generateDraft(projectId, clipId, input) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/drafts`, {
				method: "POST",
				body: JSON.stringify(input)
			});
		}
		/** 片段草稿图：删除。 */
		async function deleteDraft(projectId, clipId, draftId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
		}
		/** 片段草稿图：入库成素材。 */
		async function adoptDraft(projectId, clipId, draftId, input) {
			return await request(`/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/drafts/${encodeURIComponent(draftId)}/adopt`, {
				method: "POST",
				body: JSON.stringify(input)
			});
		}
		/** 片段草稿图地址。 */
		function draftUrl(projectId, clipId, draftId) {
			return `${ROOT}/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/drafts/${encodeURIComponent(draftId)}`;
		}
		/** 剧集草稿图（本集人物 / 场景）：列表。 */
		async function listEpisodeDrafts(projectId, episodeId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/drafts`);
		}
		/** 剧集草稿图：生成一张。 */
		async function generateEpisodeDraft(projectId, episodeId, input) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/drafts`, {
				method: "POST",
				body: JSON.stringify(input)
			});
		}
		/** 剧集草稿图：删除。 */
		async function deleteEpisodeDraft(projectId, episodeId, draftId) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
		}
		/** 剧集草稿图：入库成素材（category 由资产 id 前缀决定）。 */
		async function adoptEpisodeDraft(projectId, episodeId, draftId, input) {
			return await request(`/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/drafts/${encodeURIComponent(draftId)}/adopt`, {
				method: "POST",
				body: JSON.stringify(input)
			});
		}
		/** 剧集草稿图地址。 */
		function episodeDraftUrl(projectId, episodeId, draftId) {
			return `${ROOT}/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/drafts/${encodeURIComponent(draftId)}`;
		}
		// src/client/lib/scheme.ts
		/**
		* 量宿主当前是深色还是浅色。
		*
		* 不用 `prefers-color-scheme` 猜：DSH 的主题是应用内设置，可能和系统主题不同。
		* 判断顺序：
		* 1. 宿主自己挂的主题标记（`data-theme` / `data-dsh-theme` / class 里的 dark/light）；
		* 2. 量宿主给面板的那块背景，从 body 往上找第一个不透明背景色算亮度；
		* 3. 都拿不到才退回系统偏好。
		*
		* 挂 MutationObserver 与媒体查询监听，主题切换时重新判断。
		* @module @shikong-zaomeng/dsh-client-ui-dream-studio/lib/scheme
		*/
		/** 解析颜色（rgb()/rgba()/#rgb/#rrggbb）的亮度；透明色返回 null。 */
		function luminanceOf(color) {
			const text = color.trim();
			const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(text);
			if (hex !== null) {
				const body = hex[1] ?? "";
				const full = body.length === 3 ? body.split("").map((char) => char + char).join("") : body;
				const [red, green, blue] = [
					0,
					2,
					4
				].map((at) => parseInt(full.slice(at, at + 2), 16));
				return (.299 * (red ?? 0) + .587 * (green ?? 0) + .114 * (blue ?? 0)) / 255;
			}
			const match = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,]+([\d.]+))?\s*\)/u.exec(text);
			if (match === null) return null;
			if ((match[4] === void 0 ? 1 : Number(match[4])) === 0) return null;
			const [red, green, blue] = [
				Number(match[1]),
				Number(match[2]),
				Number(match[3])
			];
			return (.299 * red + .587 * green + .114 * blue) / 255;
		}
		/** 从元素往上找第一个有背景色的祖先。 */
		function backgroundLuminance(start) {
			let node = start;
			while (node !== null) {
				const value = luminanceOf(getComputedStyle(node).backgroundColor);
				if (value !== null) return value;
				node = node.parentElement;
			}
			return null;
		}
		/** 读宿主挂出来的主题标记；没有就返回 null。 */
		function themeHint() {
			if (document.body?.hasAttribute("data-ds-dark-theme") === true) return "dark";
			const computed = getComputedStyle(document.documentElement).colorScheme;
			if (computed === "dark") return "dark";
			if (computed === "light") return "light";
			const aliasLuminance = luminanceOf(document.body === null ? "" : getComputedStyle(document.body).getPropertyValue("--dsw-alias-bg-layer-1"));
			if (aliasLuminance !== null) return aliasLuminance < .5 ? "dark" : "light";
			for (const element of [document.documentElement, document.body]) {
				if (element === null) continue;
				for (const name of [
					"data-theme",
					"data-dsh-theme",
					"data-color-scheme",
					"data-scheme"
				]) {
					const value = element.getAttribute(name);
					if (value === "dark" || value === "light") return value;
				}
				const className = element.getAttribute("class") ?? "";
				if (/(^|\s)(dark|theme-dark)(\s|$)/u.test(className)) return "dark";
				if (/(^|\s)(light|theme-light)(\s|$)/u.test(className)) return "light";
			}
			return null;
		}
		/**
		* 宿主配色。
		* @returns `'dark'` 或 `'light'`。
		*/
		function useHostScheme() {
			const [scheme, setScheme] = (0, react.useState)("light");
			(0, react.useEffect)(() => {
				const measure = () => {
					const hinted = themeHint();
					if (hinted !== null) {
						setScheme(hinted);
						return;
					}
					const value = backgroundLuminance(document.querySelector("main, [data-dsh-theme], #root") ?? document.body) ?? backgroundLuminance(document.documentElement);
					if (value !== null) {
						setScheme(value < .5 ? "dark" : "light");
						return;
					}
					setScheme(window.matchMedia?.("(prefers-color-scheme: dark)").matches === true ? "dark" : "light");
				};
				measure();
				const observer = new MutationObserver(measure);
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: [
						"class",
						"data-theme",
						"data-dsh-theme",
						"data-color-scheme",
						"data-ds-dark-theme",
						"style"
					]
				});
				if (document.body !== null) observer.observe(document.body, {
					attributes: true,
					attributeFilter: [
						"class",
						"data-theme",
						"data-dsh-theme",
						"data-color-scheme",
						"data-ds-dark-theme",
						"style"
					]
				});
				const media = window.matchMedia?.("(prefers-color-scheme: dark)");
				media?.addEventListener?.("change", measure);
				return () => {
					observer.disconnect();
					media?.removeEventListener?.("change", measure);
				};
			}, []);
			return scheme;
		}
		// \0dsh-css:F:\时空造梦\client\src\client\StudioPanel.module.css.mjs
		const css = ".-\\30 eMCq_root{--ds-font:system-ui, \"PingFang SC\", \"Microsoft YaHei\", sans-serif;height:100%;min-height:0;color:var(--ds-text);font-family:var(--ds-font);background:0 0;flex-direction:column;font-size:13px;line-height:20px;display:flex}.-\\30 eMCq_header{align-items:center;gap:var(--ds-space-3);height:var(--ds-header);padding:0 var(--ds-space-4);border-bottom:1px solid var(--ds-line);background:0 0;display:flex}.-\\30 eMCq_title{align-items:baseline;gap:var(--ds-space-2);min-width:0;display:flex}.-\\30 eMCq_title h1{white-space:nowrap;text-overflow:ellipsis;margin:0;font-size:15px;font-weight:600;overflow:hidden}.-\\30 eMCq_title small{color:var(--ds-text-3);font-size:12px}.-\\30 eMCq_headerActions{align-items:center;gap:var(--ds-space-2);margin-left:auto;display:flex}.-\\30 eMCq_tabs{align-items:center;gap:var(--ds-space-1);height:var(--ds-tabs);padding:0 var(--ds-space-3);border-bottom:1px solid var(--ds-line);background:0 0;display:flex}.-\\30 eMCq_tab{height:26px;padding:0 var(--ds-space-3);border-radius:var(--ds-radius-m);color:var(--ds-text-2);font:inherit;cursor:pointer;background:0 0;border:0}.-\\30 eMCq_tab:hover{background:var(--ds-primary-weak)}.-\\30 eMCq_tabOn{background:var(--ds-primary-weak);color:var(--ds-primary);font-weight:600}.-\\30 eMCq_body{flex:auto;min-height:0;display:flex}.-\\30 eMCq_left{width:var(--ds-left);border-right:1px solid var(--ds-line);background:0 0;flex:none;overflow:auto}.-\\30 eMCq_leftCollapsed{width:48px}.-\\30 eMCq_center{background:0 0;flex-direction:column;flex:auto;min-width:480px;min-height:0;display:flex;overflow:hidden}.-\\30 eMCq_right{width:var(--ds-right);border-left:1px solid var(--ds-line);background:0 0;flex:none;overflow:auto}.-\\30 eMCq_status{align-items:center;gap:var(--ds-space-4);height:var(--ds-status);padding:0 var(--ds-space-4);border-top:1px solid var(--ds-line);color:var(--ds-text-2);background:0 0;font-size:11px;display:flex}.-\\30 eMCq_pill{align-items:center;gap:var(--ds-space-1);display:inline-flex}.-\\30 eMCq_dotOk,.-\\30 eMCq_dotBad,.-\\30 eMCq_dotIdle{border-radius:50%;width:8px;height:8px;display:inline-block}.-\\30 eMCq_dotBad{background:var(--ds-danger)}.-\\30 eMCq_spacer{margin-left:auto}.-\\30 eMCq_primary,.-\\30 eMCq_secondary,.-\\30 eMCq_ghost,.-\\30 eMCq_danger{height:28px;padding:0 var(--ds-space-3);border-radius:var(--ds-radius-m);border:1px solid var(--ds-line);color:var(--ds-text);font:inherit;cursor:pointer;white-space:nowrap;background:0 0;justify-content:center;align-items:center;display:inline-flex}.-\\30 eMCq_primary{border-color:var(--ds-primary);background:var(--ds-primary);color:#fff}.-\\30 eMCq_secondary{border-color:var(--ds-primary);color:var(--ds-primary)}.-\\30 eMCq_ghost{color:var(--ds-text-2);background:0 0;border-color:#0000}.-\\30 eMCq_ghost:hover{background:var(--ds-primary-weak);color:var(--ds-primary)}.-\\30 eMCq_danger{border-color:var(--ds-danger);color:var(--ds-danger)}.-\\30 eMCq_primary:disabled,.-\\30 eMCq_secondary:disabled,.-\\30 eMCq_ghost:disabled,.-\\30 eMCq_danger:disabled{opacity:.4;cursor:not-allowed}.-\\30 eMCq_empty{color:var(--ds-text-3);padding:var(--ds-space-5);text-align:center;flex:auto;justify-content:center;align-items:center;font-size:13px;display:flex}.-\\30 eMCq_sectionTitle{color:var(--ds-text);font-size:13px;font-weight:600}.-\\30 eMCq_message{padding:var(--ds-space-2) var(--ds-space-4);border-bottom:1px solid var(--ds-line);background:var(--ds-primary-weak);color:var(--ds-text-2);margin:0}.-\\30 eMCq_messageError{color:var(--ds-danger);background:#d6454514}.-\\30 eMCq_board{gap:var(--ds-space-4);padding:var(--ds-space-5);flex-direction:column;flex:auto;min-height:0;display:flex;overflow:auto}.-\\30 eMCq_cardGrid{gap:var(--ds-space-4);grid-template-columns:repeat(auto-fill,minmax(220px,1fr));display:grid}.-\\30 eMCq_card{border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-hover);box-shadow:var(--ds-shadow-1);flex-direction:column;display:flex;overflow:hidden}.-\\30 eMCq_cardCover{aspect-ratio:16/9;background:var(--ds-bg);color:var(--ds-text-3);cursor:pointer;border:0;justify-content:center;align-items:center;padding:0;display:flex}.-\\30 eMCq_cardCover img{object-fit:cover;width:100%;height:100%}.-\\30 eMCq_cardBody{padding:var(--ds-space-3);flex-direction:column;gap:2px;display:flex}.-\\30 eMCq_cardBody strong{white-space:nowrap;text-overflow:ellipsis;font-size:13px;overflow:hidden}.-\\30 eMCq_cardActions{gap:var(--ds-space-2);padding:0 var(--ds-space-3) var(--ds-space-3);display:flex}.-\\30 eMCq_episodeTree{padding:var(--ds-space-2);gap:var(--ds-space-1);flex-direction:column;display:flex}.-\\30 eMCq_treeHead{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-1) var(--ds-space-2);color:var(--ds-text-3);font-size:12px;display:flex}.-\\30 eMCq_treeRow{align-items:center;gap:var(--ds-space-2);width:100%;padding:var(--ds-space-1) var(--ds-space-2);border-radius:var(--ds-radius-s);color:var(--ds-text-2);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;display:flex}.-\\30 eMCq_treeRow:hover{background:var(--ds-primary-weak)}.-\\30 eMCq_treeRowOn{background:var(--ds-primary-weak);color:var(--ds-primary);font-weight:600}.-\\30 eMCq_treeClip{padding-left:var(--ds-space-5)}.-\\30 eMCq_lamp{background:var(--ds-muted);border-radius:50%;flex:none;width:6px;height:6px}.-\\30 eMCq_lampReady{background:var(--ds-success)}.-\\30 eMCq_lampBusy{background:var(--ds-warning)}.-\\30 eMCq_lampFailed{background:var(--ds-danger)}.-\\30 eMCq_stage{justify-content:center;align-items:center;gap:var(--ds-space-3);min-height:0;color:var(--ds-text-3);background:#000;flex-direction:column;flex:auto;display:flex}.-\\30 eMCq_stage video{object-fit:contain;background:#000;width:100%;height:100%}.-\\30 eMCq_clipStrip{align-items:stretch;gap:var(--ds-space-2);padding:var(--ds-space-2);border-top:1px solid var(--ds-line);background:0 0;display:flex;overflow-x:auto}.-\\30 eMCq_clipCard{width:104px;padding:var(--ds-space-1);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;flex-direction:column;flex:none;gap:2px;display:flex}.-\\30 eMCq_clipCardOn{border-color:var(--ds-primary);box-shadow:0 0 0 1px var(--ds-primary) inset}.-\\30 eMCq_clipCard strong{font-size:12px;display:block}.-\\30 eMCq_inspector{gap:var(--ds-space-3);padding:var(--ds-space-3);flex-direction:column;display:flex}.-\\30 eMCq_section{gap:var(--ds-space-2);padding-bottom:var(--ds-space-3);border-bottom:1px solid var(--ds-line);flex-direction:column;display:flex}.-\\30 eMCq_fieldRow{gap:var(--ds-space-2);grid-template-columns:1fr 1fr;display:grid}.-\\30 eMCq_field{color:var(--ds-text-2);flex-direction:column;gap:2px;font-size:12px;display:flex}.-\\30 eMCq_field input,.-\\30 eMCq_field select,.-\\30 eMCq_field textarea{height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);color:var(--ds-text);font:inherit}.-\\30 eMCq_field textarea{height:auto;min-height:96px;padding:var(--ds-space-2);resize:vertical}.-\\30 eMCq_field input:focus,.-\\30 eMCq_field select:focus,.-\\30 eMCq_field textarea:focus{border-color:var(--ds-primary);box-shadow:0 0 0 2px var(--ds-primary-dim);outline:none}.-\\30 eMCq_modeSwitch{gap:var(--ds-space-1);border-radius:var(--ds-radius-m);background:var(--ds-hover);grid-template-columns:1fr 1fr;padding:2px;display:grid}.-\\30 eMCq_modeButton{border-radius:var(--ds-radius-s);height:26px;color:var(--ds-text-2);font:inherit;cursor:pointer;background:0 0;border:0}.-\\30 eMCq_modeOn{background:var(--ds-primary-weak);color:var(--ds-primary);font-weight:600}@media (width<=1200px){.-\\30 eMCq_root{--ds-left:48px;--ds-right:300px}}.-\\30 eMCq_boardHead{align-items:center;gap:var(--ds-space-2);display:flex}.-\\30 eMCq_nameInput{width:220px;height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);color:var(--ds-text);font:inherit}.-\\30 eMCq_nameInput:focus{border-color:var(--ds-primary);box-shadow:0 0 0 2px var(--ds-primary-dim);outline:none}.-\\30 eMCq_cardMissing{opacity:.7}.-\\30 eMCq_dangerText{color:var(--ds-danger);font-size:12px}.-\\30 eMCq_treeGroup{flex-direction:column;display:flex}.-\\30 eMCq_treeLabel{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;overflow:hidden}.-\\30 eMCq_treeClips{flex-direction:column;display:flex}.-\\30 eMCq_treeEmpty{margin:var(--ds-space-1) 0 var(--ds-space-2) var(--ds-space-5);color:var(--ds-text-3);font-size:12px}.-\\30 eMCq_badge{background:var(--ds-primary-weak);min-width:16px;color:var(--ds-primary);text-align:center;border-radius:8px;padding:0 4px;font-size:11px;line-height:16px}.-\\30 eMCq_pane{gap:var(--ds-space-2);height:100%;min-height:0;padding:var(--ds-space-4);flex-direction:column;display:flex;overflow:auto}.-\\30 eMCq_paneHead{align-items:baseline;gap:var(--ds-space-2);display:flex}.-\\30 eMCq_paneHint{color:var(--ds-text-3);margin:0;font-size:12px}.-\\30 eMCq_slotList{gap:var(--ds-space-1);flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.-\\30 eMCq_slotRow{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-1) var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);display:flex}.-\\30 eMCq_slotPrompt{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--ds-text-2);flex:auto;font-size:12px;overflow:hidden}.-\\30 eMCq_clipCardHead{align-items:center;gap:var(--ds-space-1);margin-bottom:2px;display:flex}.-\\30 eMCq_moreMenu{position:relative}.-\\30 eMCq_moreList{z-index:20;min-width:140px;padding:var(--ds-space-1);border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-raised);box-shadow:var(--ds-shadow-2);flex-direction:column;display:flex;position:absolute;top:32px;right:0}.-\\30 eMCq_stageFilled{background:#000;padding:0}.-\\30 eMCq_stageFilled video{width:100%;height:100%}.-\\30 eMCq_inspectorHead{justify-content:space-between;align-items:baseline;display:flex}.-\\30 eMCq_generateBar{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-2) 0;background:var(--ds-hover);border-top:1px solid var(--ds-line);display:flex;position:sticky;bottom:0}.-\\30 eMCq_frameRow{gap:var(--ds-space-2);align-items:center;display:flex}.-\\30 eMCq_frameThumb{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-s);color:var(--ds-text-3);background:0 0;flex:none;justify-content:center;align-items:center;font-size:11px;display:flex;overflow:hidden}.-\\30 eMCq_frameThumb img{object-fit:cover;width:100%;height:100%}.-\\30 eMCq_frameFields{gap:var(--ds-space-1);flex:auto;grid-template-columns:1fr auto;align-items:center;min-width:0;display:grid}.-\\30 eMCq_frameFields select{height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);color:var(--ds-text);font:inherit;min-width:0}.-\\30 eMCq_durationRow{align-items:center;gap:var(--ds-space-2);display:flex}.-\\30 eMCq_durationRow input[type=range]{flex:auto}.-\\30 eMCq_durationRow input[type=number]{width:64px;height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);font:inherit;text-align:right}.-\\30 eMCq_check{align-items:center;gap:var(--ds-space-1);color:var(--ds-text-2);font-size:12px;display:inline-flex}.-\\30 eMCq_keyframeStrip{gap:var(--ds-space-2);padding-bottom:var(--ds-space-1);display:flex;overflow-x:auto}.-\\30 eMCq_keyframeCard{border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-s);background:0 0;flex-direction:column;flex:none;align-items:center;gap:2px;width:56px;padding:2px;display:flex}.-\\30 eMCq_keyframeLabel{color:var(--ds-text-2);font-size:11px}.-\\30 eMCq_keyframeAnchor{color:var(--ds-text-3);font-variant-numeric:tabular-nums;font-size:11px}.-\\30 eMCq_keyframeState{color:var(--ds-success)}.-\\30 eMCq_loraList{gap:var(--ds-space-1);flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.-\\30 eMCq_loraName{color:var(--ds-text-2);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.-\\30 eMCq_loraAdd{gap:var(--ds-space-1);grid-template-columns:1fr 64px auto;display:grid}.-\\30 eMCq_loraAdd input{height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);font:inherit;min-width:0}.-\\30 eMCq_promptTabs{gap:var(--ds-space-1);display:flex}.-\\30 eMCq_promptArea{width:100%;min-height:120px;padding:var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);color:var(--ds-text);font:inherit;resize:vertical}.-\\30 eMCq_promptArea:focus{border-color:var(--ds-primary);box-shadow:0 0 0 2px var(--ds-primary-dim);outline:none}.-\\30 eMCq_progressText{color:var(--ds-primary);font-variant-numeric:tabular-nums;font-size:12px}.-\\30 eMCq_fragmentsPage{--studio-ratio:16 / 9;height:100%;min-height:0;display:flex}.-\\30 eMCq_fragmentsLeft{gap:var(--ds-space-2);width:208px;padding:var(--ds-space-2);border-right:1px solid var(--ds-line);background:0 0;flex-direction:column;flex:none;display:flex;overflow:auto}.-\\30 eMCq_fragmentsMain{gap:var(--ds-space-2);min-width:0;min-height:0;padding:var(--ds-space-2) var(--ds-space-3);flex-direction:column;flex:auto;display:flex;overflow:hidden}.-\\30 eMCq_assetGrid{grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;display:grid}.-\\30 eMCq_assetCard{border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);cursor:pointer;text-align:left;font:inherit;background:0 0;flex-direction:column;gap:2px;padding:0;display:flex;overflow:hidden}.-\\30 eMCq_assetCard:hover{border-color:var(--ds-primary)}.-\\30 eMCq_assetCardOn{border-color:var(--ds-primary);box-shadow:0 0 0 1px var(--ds-primary) inset}.-\\30 eMCq_assetCard img{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);object-fit:contain;background:var(--ds-bg)}.-\\30 eMCq_assetName{color:var(--ds-text-2);text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.-\\30 eMCq_resultGrid{gap:var(--ds-space-2);grid-template-columns:repeat(auto-fill,minmax(160px,1fr));display:grid}.-\\30 eMCq_resultCard{gap:var(--ds-space-1);padding:var(--ds-space-1);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:0 0;flex-direction:column;margin:0;display:flex}.-\\30 eMCq_resultCard img{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);object-fit:cover;border-radius:var(--ds-radius-s);background:var(--ds-bg)}.-\\30 eMCq_resultMeta{color:var(--ds-text-2);text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.-\\30 eMCq_resultActions{justify-content:space-between;align-items:center;gap:var(--ds-space-1);display:flex}.-\\30 eMCq_pictureBar{gap:var(--ds-space-2);padding-top:var(--ds-space-2);border-top:1px solid var(--ds-line);background:0 0;flex-direction:column;flex:none;display:flex}.-\\30 eMCq_pictureRow{align-items:center;gap:var(--ds-space-2);flex-wrap:wrap;display:flex}.-\\30 eMCq_pictureRow select{height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);font:inherit}.-\\30 eMCq_keyframeCardFilled{border-style:solid;border-color:var(--ds-primary);background:var(--ds-hover)}.-\\30 eMCq_keyframeThumb{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);object-fit:cover;border-radius:3px;margin-bottom:2px}.-\\30 eMCq_chatPane{flex-direction:column;flex:auto;min-height:0;display:flex;overflow:hidden}.-\\30 eMCq_chatBar{align-items:flex-end;gap:var(--ds-space-2);padding:var(--ds-space-2) var(--ds-space-3);border-bottom:1px solid var(--ds-line);background:var(--ds-hover);flex:none;display:flex}.-\\30 eMCq_chatBar select{min-width:200px;height:28px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);font:inherit}.-\\30 eMCq_frameGrid{gap:var(--ds-space-2);grid-template-columns:1fr 1fr;display:grid}.-\\30 eMCq_frameCard{flex-direction:column;gap:4px;min-width:0;display:flex}.-\\30 eMCq_frameSelect{width:100%;height:24px;padding:0 var(--ds-space-1);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);color:var(--ds-text);font:inherit;background:0 0;min-width:0;font-size:12px}.-\\30 eMCq_linkish{color:var(--ds-text-3);font:inherit;cursor:pointer;background:0 0;border:0;align-self:flex-start;padding:0;font-size:11px}.-\\30 eMCq_linkish:hover{color:var(--ds-primary)}.-\\30 eMCq_keyframeThumb{aspect-ratio:1;object-fit:cover;background:var(--ds-bg);border-radius:3px;width:100%}.-\\30 eMCq_keyframeEmpty{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);background:var(--ds-bg);color:var(--ds-text-3);border-radius:3px;justify-content:center;align-items:center;font-size:11px;display:flex}.-\\30 eMCq_refStrip{flex-wrap:wrap;gap:6px;display:flex}.-\\30 eMCq_refCard{flex-direction:column;gap:2px;width:56px;margin:0;display:flex}.-\\30 eMCq_refCard img,.-\\30 eMCq_refIndex{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);object-fit:contain;background:var(--ds-bg);border-radius:3px}.-\\30 eMCq_refIndex{color:var(--ds-text-3);justify-content:center;align-items:center;font-size:11px;display:flex}.-\\30 eMCq_refCaption{color:var(--ds-text-3);white-space:nowrap;align-items:center;gap:2px;font-size:10px;display:flex;overflow:hidden}.-\\30 eMCq_refRole{text-overflow:ellipsis;overflow:hidden}.-\\30 eMCq_fragmentsScroll{flex:auto;min-height:0;overflow:auto}.-\\30 eMCq_fragmentsMain>.-\\30 eMCq_resultGrid{flex:none;align-content:start;max-height:min(42vh,400px);overflow:auto}.-\\30 eMCq_fragmentsMain .-\\30 eMCq_resultCard img{object-fit:contain}.-\\30 eMCq_clipStripWrap{border-top:1px solid var(--ds-line);flex:none;position:relative}.-\\30 eMCq_playhead{background:var(--ds-primary);width:2px;box-shadow:0 0 6px var(--ds-primary);pointer-events:none;z-index:2;margin-left:-1px;position:absolute;top:0;bottom:0}.-\\30 eMCq_clipThumb{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);background:var(--ds-bg);border-radius:3px;display:block;overflow:hidden}.-\\30 eMCq_clipThumb video,.-\\30 eMCq_clipThumb img{object-fit:cover;width:100%;height:100%;display:block}.-\\30 eMCq_cardEdit{gap:var(--ds-space-1);display:flex}.-\\30 eMCq_cardEdit select{min-width:0;height:24px;padding:0 var(--ds-space-1);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);color:var(--ds-text);font:inherit;background:0 0;flex:1 1 0;font-size:12px}.-\\30 eMCq_field input,.-\\30 eMCq_field select,.-\\30 eMCq_field textarea,.-\\30 eMCq_nameInput,.-\\30 eMCq_frameSelect,.-\\30 eMCq_pictureRow select,.-\\30 eMCq_cardEdit select,.-\\30 eMCq_chatBar select{background:0 0}.-\\30 eMCq_frameClear{color:#fff;cursor:pointer;background:#0000008c;border:0;border-radius:3px;width:18px;height:18px;padding:0;font-size:13px;line-height:1;position:absolute;bottom:2px;right:2px}.-\\30 eMCq_frameClear:hover{background:var(--ds-danger)}.-\\30 eMCq_keyframeCard{width:84px;position:relative}.-\\30 eMCq_keyframeTitle{color:var(--ds-text-3);text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.-\\30 eMCq_keyframeThumbWrap{width:100%;position:relative}.-\\30 eMCq_keyframeClear{color:#fff;cursor:pointer;background:#0000008c;border:0;border-radius:3px;width:16px;height:16px;padding:0;font-size:12px;line-height:1;position:absolute;bottom:2px;right:2px}.-\\30 eMCq_keyframeClear:hover{background:var(--ds-danger)}.-\\30 eMCq_keyframeAnchorInput{border:1px solid var(--ds-line);width:44px;height:20px;color:var(--ds-text);font:inherit;background:0 0;border-radius:3px;align-self:flex-start;padding:0 4px;font-size:11px}.-\\30 eMCq_sectionHead{justify-content:space-between;align-items:center;gap:var(--ds-space-2);display:flex}.-\\30 eMCq_refGrid{gap:var(--ds-space-2);grid-template-columns:1fr 1fr;display:grid}.-\\30 eMCq_refCard{flex-direction:column;gap:2px;min-width:0;display:flex}.-\\30 eMCq_refTitle{color:var(--ds-text-3);font-size:11px}.-\\30 eMCq_refThumb{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-bg);justify-content:center;align-items:center;display:flex;overflow:hidden}.-\\30 eMCq_refThumb img{object-fit:contain;width:100%;height:100%}.-\\30 eMCq_refFoot{justify-content:space-between;align-items:center;gap:var(--ds-space-1);color:var(--ds-text-2);font-size:11px;display:flex}.-\\30 eMCq_refRemove{color:var(--ds-text-3);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.-\\30 eMCq_refRemove:hover{color:var(--ds-danger)}.-\\30 eMCq_refAdd{aspect-ratio:1;border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-s);min-height:56px;color:var(--ds-text-3);cursor:copy;justify-content:center;align-items:center;font-size:20px;display:flex}.-\\30 eMCq_assetFoot{align-items:center;gap:2px;min-width:0;display:flex}.-\\30 eMCq_assetNameInput{min-width:0;height:20px;color:var(--ds-text-2);font:inherit;background:0 0;border:1px solid #0000;border-radius:3px;flex:auto;padding:0 2px;font-size:11px}.-\\30 eMCq_assetNameInput:hover,.-\\30 eMCq_assetNameInput:focus{border-color:var(--ds-line);background:var(--ds-bg);color:var(--ds-text);outline:none}.-\\30 eMCq_assetRemove{width:18px;height:18px;color:var(--ds-text-3);cursor:pointer;background:0 0;border:0;border-radius:3px;flex:none;padding:0;font-size:13px;line-height:1}.-\\30 eMCq_assetRemove:hover{color:var(--ds-danger)}.-\\30 eMCq_root :is(input,select,textarea){font:inherit;color:inherit;border:.5px solid var(--ds-line);border-radius:var(--ds-radius-m);background:0 0;min-width:0}.-\\30 eMCq_root :is(input,select,textarea):focus-visible{outline:1px solid var(--ds-primary);outline-offset:1px;border-color:var(--ds-primary)}.-\\30 eMCq_root :is(input,select,textarea)::placeholder{color:var(--ds-text-3)}.-\\30 eMCq_refThumb{aspect-ratio:1}.-\\30 eMCq_message{top:calc(var(--ds-header) + var(--ds-space-2));right:var(--ds-space-4);z-index:40;max-width:420px;padding:var(--ds-space-2) var(--ds-space-3);border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-raised);box-shadow:var(--ds-shadow-2);margin:0;font-size:12px;position:fixed}.-\\30 eMCq_meta{color:var(--ds-text-3);font-size:11.5px}.-\\30 eMCq_fieldLabel,.-\\30 eMCq_field>span,.-\\30 eMCq_field span:first-child{color:var(--ds-text-2);font-size:12px}.-\\30 eMCq_paneHint{color:var(--ds-text-3);font-size:12px}.-\\30 eMCq_assetNameInput,.-\\30 eMCq_keyframeTitle,.-\\30 eMCq_refTitle{color:var(--ds-text-2);font-size:11.5px}.-\\30 eMCq_frameEmpty{color:var(--ds-text-3);font-size:12px}.-\\30 eMCq_sectionTitle{color:var(--ds-text);font-weight:500}.-\\30 eMCq_root,.-\\30 eMCq_root *{box-sizing:border-box}.-\\30 eMCq_right .-\\30 eMCq_refGrid{gap:var(--ds-space-2);grid-template-columns:repeat(2,104px);place-content:start;display:grid}.-\\30 eMCq_right .-\\30 eMCq_refCard{flex-direction:column;gap:2px;width:104px;min-width:0;margin:0;display:flex}.-\\30 eMCq_right .-\\30 eMCq_refThumb{aspect-ratio:auto;border:1px solid var(--ds-line);border-radius:var(--ds-radius-s);background:var(--ds-hover);justify-content:center;align-items:center;width:104px;height:104px;display:flex;overflow:hidden}.-\\30 eMCq_right .-\\30 eMCq_refThumb img{object-fit:cover;width:100%;height:100%;display:block}.-\\30 eMCq_right .-\\30 eMCq_refAdd{aspect-ratio:auto;border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-s);width:104px;height:104px;min-height:0;color:var(--ds-text-3);cursor:copy;justify-content:center;align-items:center;font-size:20px;display:flex}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeStrip{align-items:flex-start;gap:var(--ds-space-2);padding-bottom:var(--ds-space-1);display:flex;overflow-x:auto}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeCard{border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-m);background:0 0;flex-direction:column;flex:none;gap:4px;width:84px;height:134px;padding:4px;display:flex;overflow:hidden}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeCardFilled{border-style:solid;border-color:var(--ds-line)}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeTitle{color:var(--ds-text-2);text-overflow:ellipsis;white-space:nowrap;flex:none;font-size:11px;line-height:14px;overflow:hidden}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeThumbWrap{flex:none;width:74px;height:74px;position:relative}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeThumb{object-fit:cover;background:var(--ds-hover);border-radius:3px;width:74px;height:74px;display:block}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeAnchorInput{flex:none;width:100%;height:22px;margin-top:auto;padding:0 4px;font-size:11px}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeAdd{border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-m);width:84px;height:134px;color:var(--ds-text-3);cursor:copy;flex:none;justify-content:center;align-items:center;font-size:20px;display:flex}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeAdd:hover{border-color:var(--ds-primary);color:var(--ds-primary)}.-\\30 eMCq_inspector .-\\30 eMCq_promptArea,.-\\30 eMCq_fragmentsMain .-\\30 eMCq_promptArea{width:100%;max-width:100%;display:block}.-\\30 eMCq_fragmentsMain .-\\30 eMCq_promptArea{height:220px;min-height:220px}.-\\30 eMCq_chatBar{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-1) var(--ds-space-3);border-bottom:1px solid var(--ds-line);background:0 0;display:flex}.-\\30 eMCq_chatSelect{flex:0 260px;height:24px;font-size:12px}.-\\30 eMCq_chatNew{height:24px;padding:0 var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);color:var(--ds-primary);font:inherit;cursor:pointer;white-space:nowrap;background:0 0;flex:none;font-size:12px}.-\\30 eMCq_chatNew:hover{background:var(--ds-primary-weak)}.-\\30 eMCq_timeline{border-top:1px solid var(--ds-line);flex-direction:column;flex:none;display:flex;overflow-x:auto}.-\\30 eMCq_ruler{border-bottom:1px solid var(--ds-line);height:18px;color:var(--ds-text-3);user-select:none;cursor:ew-resize;padding:0;font-size:9.5px}.-\\30 eMCq_rulerTrack{min-width:100%;height:100%;display:flex}.-\\30 eMCq_rulerTick{border-left:1px solid var(--ds-line);color:var(--ds-text-3);font-variant-numeric:tabular-nums;flex:none;align-items:flex-end;padding:0 3px;display:flex}.-\\30 eMCq_lane{cursor:ew-resize;position:relative;overflow-x:visible}.-\\30 eMCq_lane .-\\30 eMCq_clipStrip{background:0 0;border-top:0;align-items:stretch;gap:0;width:max-content;min-width:100%;padding:0;display:flex}.-\\30 eMCq_lane .-\\30 eMCq_clipCard{border:0;border-right:1px solid var(--ds-line);border-radius:0;flex:none;width:auto;margin:0;padding:4px;overflow:hidden}.-\\30 eMCq_lane .-\\30 eMCq_clipCardOn{background:var(--ds-primary-weak);box-shadow:inset 0 0 0 1px var(--ds-primary)}.-\\30 eMCq_lane .-\\30 eMCq_clipThumb{aspect-ratio:auto;height:48px}.-\\30 eMCq_lane .-\\30 eMCq_clipThumb video,.-\\30 eMCq_lane .-\\30 eMCq_clipThumb img{object-fit:cover;width:100%;height:100%}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeStrip{align-items:flex-start;gap:var(--ds-space-2);flex-wrap:wrap;padding-bottom:0;display:flex}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeItem{flex-direction:column;gap:2px;width:104px;display:flex}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeTitle{color:var(--ds-text-2);text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:14px;overflow:hidden}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeBox{border:1px dashed var(--ds-line-strong);border-radius:var(--ds-radius-m);background:var(--ds-hover);width:104px;height:62px;position:relative;overflow:hidden}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeBoxFilled{border-style:solid;border-color:var(--ds-line)}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeThumb{object-fit:cover;background:0 0;border-radius:0;width:100%;height:100%;display:block;position:absolute;inset:0}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeAnchorInput{border:1px solid var(--ds-line);color:#1a1d21;width:34px;height:18px;font:inherit;background:#ffffffd9;border-radius:3px;padding:0 3px;font-size:11px;line-height:16px;position:absolute;bottom:4px;left:4px}[data-scheme=dark] .-\\30 eMCq_inspector .-\\30 eMCq_keyframeAnchorInput{color:#eceef1;background:#0009}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeClear{color:#fff;cursor:pointer;background:#0000008c;border:0;border-radius:3px;width:16px;height:16px;padding:0;font-size:12px;line-height:1;position:absolute;bottom:3px;right:3px}.-\\30 eMCq_right .-\\30 eMCq_refGrid{gap:var(--ds-space-2);grid-template-columns:repeat(2,minmax(0,1fr))}.-\\30 eMCq_right .-\\30 eMCq_refCard{width:auto;min-width:0}.-\\30 eMCq_right .-\\30 eMCq_refThumb{aspect-ratio:16/9;width:100%;height:auto}.-\\30 eMCq_right .-\\30 eMCq_refAdd{aspect-ratio:16/9;width:100%;height:auto;min-height:0}.-\\30 eMCq_inspector .-\\30 eMCq_frameClear{color:#fff;cursor:pointer;background:#0000008c;border:0;border-radius:3px;width:16px;height:16px;padding:0;font-size:12px;line-height:1;position:absolute;bottom:3px;right:3px}.-\\30 eMCq_timeline{border:.5px solid var(--ds-line);border-radius:8px;flex:none;margin:0 10px 10px;overflow:auto hidden}.-\\30 eMCq_timeline .-\\30 eMCq_ruler{border-bottom:.5px solid var(--ds-line);width:max-content;height:20px;color:var(--ds-text-3);user-select:none;align-items:flex-end;padding:0 8px;font-size:9.5px;display:flex}.-\\30 eMCq_timeline .-\\30 eMCq_rulerTrack{cursor:ew-resize;flex:none;align-self:stretch;align-items:flex-end;display:flex;position:relative}.-\\30 eMCq_timeline .-\\30 eMCq_rulerTick{box-sizing:border-box;border-left:.5px solid var(--ds-line);flex:none;padding-left:3px}.-\\30 eMCq_timeline .-\\30 eMCq_lane{cursor:ew-resize;width:max-content;min-height:46px;padding:6px 8px;display:flex}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipStrip{background:0 0;border:0;flex:none;gap:0;width:max-content;padding:0;display:flex;position:relative}.-\\30 eMCq_timeline .-\\30 eMCq_playhead{background:var(--ds-primary);cursor:ew-resize;z-index:3;width:2px;margin-left:-1px;position:absolute;top:-6px;bottom:0}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCard{text-align:left;border:0;border-right:.5px solid var(--ds-line);background:0 0;border-radius:0;flex-direction:column;flex:none;height:100px;margin:0;padding:0;display:flex;position:relative;overflow:hidden}.-\\30 eMCq_timeline .-\\30 eMCq_clipCover{background:var(--ds-hover);flex:1;min-height:0;display:block;overflow:hidden}.-\\30 eMCq_timeline .-\\30 eMCq_clipCover video,.-\\30 eMCq_timeline .-\\30 eMCq_clipCover img{object-fit:cover;width:100%;height:100%;display:block}.-\\30 eMCq_timeline .-\\30 eMCq_clipCover .-\\30 eMCq_meta,.-\\30 eMCq_timeline .-\\30 eMCq_clipCover>.-\\30 eMCq_meta{place-items:center;height:100%;font-size:9px;display:grid}.-\\30 eMCq_timeline .-\\30 eMCq_clipCardBody{color:#fff;background:linear-gradient(#0000,#00000026 30%,#000000b8);border-radius:4px;flex-direction:column;gap:1px;padding:7px 5px 3px;display:flex;position:absolute;bottom:3px;left:3px;right:3px}.-\\30 eMCq_timeline .-\\30 eMCq_clipCardTitle{align-items:baseline;gap:5px;min-width:0;display:flex}.-\\30 eMCq_timeline .-\\30 eMCq_clipCardTitle strong{white-space:nowrap;text-overflow:ellipsis;font-size:10.5px;overflow:hidden}.-\\30 eMCq_timeline .-\\30 eMCq_clipCardMode{color:#ffffffb8;white-space:nowrap;flex:none;font-size:9.5px}.-\\30 eMCq_timeline .-\\30 eMCq_clipCardBody small{color:#ffffffb8;font-size:9.5px}.-\\30 eMCq_clipLamp,.-\\30 eMCq_clipLampReady,.-\\30 eMCq_clipLampBusy,.-\\30 eMCq_clipLampFailed{z-index:2;background:0 0;border-radius:50%;width:6px;height:6px;position:absolute;top:4px;left:4px}.-\\30 eMCq_clipLampReady{background:var(--ds-success)}.-\\30 eMCq_clipLampBusy{background:var(--ds-warning)}.-\\30 eMCq_clipLampFailed{background:var(--ds-danger)}.-\\30 eMCq_right{flex-direction:column;display:flex;overflow:hidden}.-\\30 eMCq_inspector{flex-direction:column;height:100%;min-height:0;display:flex;overflow:hidden}.-\\30 eMCq_inspectorScroll{gap:var(--ds-space-2);min-height:0;padding:var(--ds-space-2) var(--ds-space-3) 0;flex-direction:column;flex:auto;display:flex;overflow:hidden auto}.-\\30 eMCq_generateBar{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-2) var(--ds-space-3);border-top:1px solid var(--ds-line);background:var(--ds-raised);flex:none;display:flex}.-\\30 eMCq_right .-\\30 eMCq_refThumb{position:relative;overflow:hidden}.-\\30 eMCq_right .-\\30 eMCq_refOverlay{justify-content:space-between;align-items:center;gap:var(--ds-space-1);color:#fff;background:linear-gradient(#0000,#000000b3);padding:3px 5px;font-size:11px;display:flex;position:absolute;bottom:0;left:0;right:0}.-\\30 eMCq_right .-\\30 eMCq_refRole{color:#fff}.-\\30 eMCq_right .-\\30 eMCq_refRemove{color:#fff;font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.-\\30 eMCq_right .-\\30 eMCq_refRemove:hover{color:#ffb4b4}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeStrip{align-items:flex-start;gap:var(--ds-space-2);flex-wrap:wrap;display:flex}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeItem{width:calc((100% - 2 * var(--ds-space-2)) / 3);min-width:0}.-\\30 eMCq_inspector .-\\30 eMCq_keyframeBox{width:100%}.-\\30 eMCq_stage{background:0 0}.-\\30 eMCq_inspector .-\\30 eMCq_frameThumb{aspect-ratio:16/9;position:relative;overflow:hidden}.-\\30 eMCq_inspector .-\\30 eMCq_frameThumb img{object-fit:contain;width:100%;height:100%;display:block}.-\\30 eMCq_header,.-\\30 eMCq_tabs,.-\\30 eMCq_status{flex:none}.-\\30 eMCq_body{flex:auto;min-height:0}.-\\30 eMCq_inspectorScroll{scrollbar-gutter:stable}.-\\30 eMCq_fragmentsLeft .-\\30 eMCq_assetGrid{gap:var(--ds-space-2);grid-template-columns:1fr}.-\\30 eMCq_fragmentsLeft .-\\30 eMCq_assetCard img{width:100%;aspect-ratio:var(--studio-ratio,16 / 9);object-fit:contain;background:var(--ds-hover)}.-\\30 eMCq_generateBar{background:0 0}.-\\30 eMCq_fragmentsPage .-\\30 eMCq_fragmentsLeft{width:264px;min-width:264px}.-\\30 eMCq_fragmentsLeft .-\\30 eMCq_promptTabs{gap:var(--ds-space-1);flex-wrap:nowrap}.-\\30 eMCq_fragmentsLeft .-\\30 eMCq_promptTabs .-\\30 eMCq_tab,.-\\30 eMCq_fragmentsLeft .-\\30 eMCq_promptTabs .-\\30 eMCq_ghost{padding:0 var(--ds-space-2);white-space:nowrap;flex:none;font-size:12px}.-\\30 eMCq_inspector .-\\30 eMCq_field input,.-\\30 eMCq_inspector .-\\30 eMCq_field select,.-\\30 eMCq_inspector .-\\30 eMCq_field textarea{box-sizing:border-box;width:100%;min-width:0}.-\\30 eMCq_root{position:relative}.-\\30 eMCq_genProgress{background:var(--ds-line);border-radius:3px;flex:auto;min-width:60px;height:6px;overflow:hidden}.-\\30 eMCq_genProgressFill{background:var(--ds-primary);border-radius:2px;height:100%;transition:width .2s ease-out;display:block}.-\\30 eMCq_genPhase{color:var(--ds-text-3);text-align:right;font-variant-numeric:tabular-nums;margin-top:4px;font-size:11px;display:block}.-\\30 eMCq_genPercent{text-align:right;min-width:34px;color:var(--ds-text-3);font-variant-numeric:tabular-nums;flex:none;font-size:11px}.-\\30 eMCq_message{top:calc(var(--ds-header) + 6px);z-index:40;border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-raised);max-width:420px;box-shadow:var(--ds-shadow-1);margin:0;padding:4px 10px;font-size:12px;position:absolute;right:16px}.-\\30 eMCq_timeline .-\\30 eMCq_clipProgress{pointer-events:none;z-index:2;background:0 0;height:5px;position:absolute;bottom:0;left:0;right:0}.-\\30 eMCq_timeline .-\\30 eMCq_clipProgressFill{background:var(--ds-primary);height:100%;transition:width .2s ease-out;display:block}.-\\30 eMCq_timeline .-\\30 eMCq_clipProgressOk{background:var(--ds-success)}.-\\30 eMCq_timeline .-\\30 eMCq_clipProgressBad{background:var(--ds-danger)}.-\\30 eMCq_genProgressOk{background:var(--ds-success)}.-\\30 eMCq_genProgressBad{background:var(--ds-danger)}.-\\30 eMCq_root .-\\30 eMCq_message{top:calc(var(--ds-header) + 2px);z-index:40;align-items:center;gap:var(--ds-space-2);height:var(--ds-tabs);max-width:520px;box-shadow:none;color:var(--ds-text-2);font-size:12px;line-height:var(--ds-tabs);white-space:nowrap;background:0 0;border:0;border-radius:0;margin:0;padding:0;display:inline-flex;position:absolute;right:12px}.-\\30 eMCq_root .-\\30 eMCq_message.-\\30 eMCq_messageError{color:var(--ds-danger);background:0 0}.-\\30 eMCq_root .-\\30 eMCq_message .-\\30 eMCq_ghost{height:auto;color:var(--ds-text-3);font-size:12px;line-height:inherit;background:0 0;border:0;padding:0}.-\\30 eMCq_root .-\\30 eMCq_message .-\\30 eMCq_ghost:hover{color:var(--ds-primary);background:0 0}.-\\30 eMCq_library{gap:var(--ds-space-2);padding:var(--ds-space-2);flex-direction:column;min-height:100%;display:flex}.-\\30 eMCq_library .-\\30 eMCq_assetGrid{grid-template-columns:1fr}.-\\30 eMCq_library .-\\30 eMCq_assetCard img{aspect-ratio:16/9;object-fit:contain;background:var(--ds-hover);width:100%}.-\\30 eMCq_assetRemoveConfirm{width:auto;color:var(--ds-danger);white-space:nowrap;padding:0 4px;font-size:11px}.-\\30 eMCq_timeline .-\\30 eMCq_clipBadge{z-index:3;color:#fff;white-space:nowrap;pointer-events:none;border-radius:3px;padding:0 5px;font-size:9.5px;line-height:15px;position:absolute;top:4px;left:4px}.-\\30 eMCq_timeline .-\\30 eMCq_clipBadgeQueued{background:#787878d9}.-\\30 eMCq_timeline .-\\30 eMCq_clipBadgeRunning{background:var(--ds-primary)}.-\\30 eMCq_timeline .-\\30 eMCq_clipBadgeFailed{background:var(--ds-danger)}.-\\30 eMCq_pictureRefs{gap:var(--ds-space-2);margin-bottom:var(--ds-space-2);flex-wrap:wrap;display:flex}.-\\30 eMCq_pictureRefCard,.-\\30 eMCq_pictureRefAdd{border-radius:var(--ds-radius-s);background:var(--ds-hover);width:118px;height:66px;position:relative;overflow:hidden}.-\\30 eMCq_pictureRefCard{border:1px solid var(--ds-line)}.-\\30 eMCq_pictureRefCard img{object-fit:cover;width:100%;height:100%;display:block}.-\\30 eMCq_pictureRefAdd{padding:0 var(--ds-space-2);border:1px dashed var(--ds-line-strong);color:var(--ds-text-3);text-align:center;cursor:copy;justify-content:center;align-items:center;font-size:11px;line-height:1.3;display:flex}.-\\30 eMCq_pictureRefRemove{color:#fff;cursor:pointer;background:#0000008c;border:0;border-radius:3px;width:16px;height:16px;padding:0;font-size:12px;line-height:1;position:absolute;bottom:2px;right:2px}.-\\30 eMCq_pictureRefRemove:hover{background:var(--ds-danger)}.-\\30 eMCq_serverList{gap:var(--ds-space-1);flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.-\\30 eMCq_serverRow{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-1) 0;border-bottom:1px solid var(--ds-line);display:flex}.-\\30 eMCq_serverName{color:var(--ds-text);font-size:12px}.-\\30 eMCq_serverRow .-\\30 eMCq_meta{text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.-\\30 eMCq_serverTag{background:var(--ds-primary-weak);color:var(--ds-primary);border-radius:3px;padding:0 4px;font-size:10px}.-\\30 eMCq_serverAdd{gap:var(--ds-space-2);margin-top:var(--ds-space-2);display:flex}.-\\30 eMCq_serverAdd input:first-child{flex:0 0 140px}.-\\30 eMCq_serverAdd input:nth-child(2){flex:auto}.-\\30 eMCq_keyAdd{gap:var(--ds-space-2);margin-top:var(--ds-space-2);display:flex}.-\\30 eMCq_keyAdd input{flex:auto;min-width:0}.-\\30 eMCq_dotOk,.-\\30 eMCq_dotIdle{border-radius:50%;flex:none;width:8px;height:8px;display:inline-block}.-\\30 eMCq_dotOk{background:var(--ds-success)}.-\\30 eMCq_dotIdle{background:var(--ds-text-3)}.-\\30 eMCq_settingsPage{gap:var(--ds-space-5);padding:var(--ds-space-4) var(--ds-space-5);flex-direction:column;max-width:760px;display:flex}.-\\30 eMCq_settingsPage>.-\\30 eMCq_sectionTitle{color:var(--ds-text);font-size:15px;font-weight:600}.-\\30 eMCq_settingsPage .-\\30 eMCq_section{gap:var(--ds-space-2);border-bottom:0;flex-direction:column;padding:0;display:flex}.-\\30 eMCq_settingsPage .-\\30 eMCq_section>.-\\30 eMCq_sectionTitle{color:var(--ds-text-2);letter-spacing:.02em;font-size:12px;font-weight:500}.-\\30 eMCq_settingsPage .-\\30 eMCq_field input,.-\\30 eMCq_settingsPage .-\\30 eMCq_serverAdd input,.-\\30 eMCq_settingsPage .-\\30 eMCq_serverAdd button,.-\\30 eMCq_settingsPage .-\\30 eMCq_keyAdd input,.-\\30 eMCq_settingsPage .-\\30 eMCq_keyAdd button{border:.5px solid var(--ds-line);border-radius:var(--ds-radius-m);color:var(--ds-text);background:0 0;height:28px;font-size:12px}.-\\30 eMCq_settingsPage .-\\30 eMCq_field span,.-\\30 eMCq_settingsPage label>span{color:var(--ds-text-2);font-size:12px}.-\\30 eMCq_settingsPage .-\\30 eMCq_modeSwitch{background:var(--ds-hover);border-radius:var(--ds-radius-m);max-width:320px;padding:2px}.-\\30 eMCq_settingsPage .-\\30 eMCq_modeButton{height:26px;color:var(--ds-text-2);border-radius:var(--ds-radius-s);background:0 0;font-size:12px}.-\\30 eMCq_settingsPage .-\\30 eMCq_modeOn{background:var(--ds-raised);color:var(--ds-text);box-shadow:var(--ds-shadow-1);font-weight:500}.-\\30 eMCq_settingsPage .-\\30 eMCq_serverRow{border-bottom:.5px solid var(--ds-line);padding:var(--ds-space-2) 0}.-\\30 eMCq_settingsPage .-\\30 eMCq_serverName{color:var(--ds-text);font-size:13px}.-\\30 eMCq_settingsPage .-\\30 eMCq_serverRow .-\\30 eMCq_meta{color:var(--ds-text-3);font-size:11.5px}.-\\30 eMCq_settingsPage .-\\30 eMCq_serverTag{background:var(--ds-hover);color:var(--ds-text-2)}.-\\30 eMCq_settingsPage .-\\30 eMCq_paneHint{color:var(--ds-text-3);margin:0;font-size:12px}.-\\30 eMCq_settingsPage .-\\30 eMCq_linkish{color:var(--ds-text-2);font-size:12px}.-\\30 eMCq_settingsPage .-\\30 eMCq_linkish:hover{color:var(--ds-primary)}.-\\30 eMCq_draftImage{cursor:pointer}.-\\30 eMCq_draftImage:hover{outline:1px solid var(--ds-primary);outline-offset:-1px}.-\\30 eMCq_lightbox{z-index:100;padding:var(--ds-space-5);cursor:zoom-out;background:#000000d1;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.-\\30 eMCq_lightboxImage{object-fit:contain;border-radius:var(--ds-radius-m);cursor:default;max-width:92vw;max-height:92vh;box-shadow:0 12px 48px #0009}.-\\30 eMCq_zoomable{cursor:zoom-in}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCardOn{box-shadow:inset 0 0 0 2px var(--ds-primary), inset 0 -3px 0 var(--ds-primary);background:#6b8dff1f}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCardOn .-\\30 eMCq_clipCover{filter:brightness(1.06)saturate(1.05)}.-\\30 eMCq_timeline .-\\30 eMCq_lane{scrollbar-width:thin}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCard{position:relative}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCardOn:after{content:\"\";z-index:6;border:2px solid var(--ds-primary);border-radius:inherit;pointer-events:none;position:absolute;inset:0;box-shadow:inset 0 0 0 1px #6b8dff59}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCardOn{background:#6b8dff1a}.-\\30 eMCq_timeline .-\\30 eMCq_lane .-\\30 eMCq_clipCardOn .-\\30 eMCq_clipCardTitle strong{color:var(--ds-primary)}.-\\30 eMCq_logPanel{z-index:80;border:.5px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-raised);width:min(560px,60vw);max-height:50vh;box-shadow:var(--ds-shadow-2);flex-direction:column;display:flex;position:absolute;bottom:40px;right:16px;overflow:hidden}.-\\30 eMCq_logHead{align-items:center;gap:var(--ds-space-2);padding:var(--ds-space-2) var(--ds-space-3);border-bottom:.5px solid var(--ds-line);font-size:12px;display:flex}.-\\30 eMCq_logBody{min-height:0;padding:var(--ds-space-2) var(--ds-space-3);flex:auto;overflow:auto}.-\\30 eMCq_logRow{gap:var(--ds-space-2);color:var(--ds-text-2);white-space:pre-wrap;word-break:break-all;margin:0 0 2px;font-size:11.5px;display:flex}.-\\30 eMCq_logRowError{color:var(--ds-danger)}.-\\30 eMCq_logScope{color:var(--ds-text-3);flex:none}.-\\30 eMCq_crash{gap:var(--ds-space-2);margin:var(--ds-space-4);padding:var(--ds-space-4);border:.5px solid var(--ds-danger);border-radius:var(--ds-radius-m);color:var(--ds-text);background:#d6454514;flex-direction:column;align-items:flex-start;font-size:12px;display:flex}.-\\30 eMCq_crashDetail{white-space:pre-wrap;word-break:break-all;max-height:40vh;color:var(--ds-danger);margin:0;font-size:11.5px;overflow:auto}.-\\30 eMCq_fieldLabel{opacity:.75;margin:12px 0 6px;font-size:12px;display:block}.-\\30 eMCq_combo,.-\\30 eMCq_loraStrength,.-\\30 eMCq_rowButton{box-sizing:border-box;border:1px solid var(--ds-line);background:var(--ds-panel);height:30px;color:inherit;font:inherit;border-radius:6px;font-size:12px}.-\\30 eMCq_combo{border:1px solid var(--ds-line);background-color:var(--ds-panel);min-width:0;height:30px;color:var(--ds-text);text-align:left;border-radius:6px;flex:1;padding:0 8px;font-family:inherit;font-size:12px;line-height:28px}.-\\30 eMCq_loraStrength{border:1px solid var(--ds-line);background-color:var(--ds-panel);width:72px;height:30px;color:var(--ds-text);text-align:left;border-radius:6px;flex:0 0 72px;padding:0 6px;font-family:inherit;font-size:12px}.-\\30 eMCq_rowButton{cursor:pointer;white-space:nowrap;flex:none;min-width:52px;padding:0 10px}.-\\30 eMCq_rowButton:hover:not(:disabled){border-color:var(--ds-accent,#4a90d9)}.-\\30 eMCq_rowButton:disabled{opacity:.5;cursor:default}.-\\30 eMCq_loraRow{grid-template-columns:minmax(0,1fr) 72px 56px;align-items:center;gap:8px;margin-bottom:6px;display:grid}.-\\30 eMCq_filmRow{flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px;display:flex}.-\\30 eMCq_filmLabel{opacity:.75;white-space:nowrap;text-overflow:ellipsis;flex:0 0 100%;font-size:12px;overflow:hidden}.-\\30 eMCq_addRow{color:var(--ds-accent,#4a90d9);font:inherit;cursor:pointer;background:0 0;border:0;margin:2px 0 4px;padding:2px 0;font-size:12px}.-\\30 eMCq_addRow:disabled{opacity:.5;cursor:default}.-\\30 eMCq_saveRow{justify-content:flex-end;align-items:center;gap:8px;margin-top:10px;display:flex}.-\\30 eMCq_hint{opacity:.6;margin-top:6px;font-size:11px;line-height:1.5;display:block}.-\\30 eMCq_secondPassDone,.-\\30 eMCq_secondPassDone:hover{border-color:var(--ds-success);background:var(--ds-success);color:#fff}.-\\30 eMCq_secondPassDone:disabled{border-color:var(--ds-success);color:var(--ds-success);background:0 0}.-\\30 eMCq_scriptPage{gap:var(--ds-space-2);min-height:0;padding:var(--ds-space-2) var(--ds-space-3);flex-direction:column;flex:auto;display:flex}.-\\30 eMCq_scriptBar{align-items:center;gap:var(--ds-space-2);flex:none;min-width:0;display:flex}.-\\30 eMCq_scriptName{color:var(--ds-text-2);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.-\\30 eMCq_scriptStatus{color:var(--ds-text-3);white-space:nowrap;margin-left:auto;font-size:11px}.-\\30 eMCq_scriptStatusError{color:var(--ds-danger)}.-\\30 eMCq_scriptArea{resize:none;width:100%;min-height:0;padding:var(--ds-space-3);border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-hover);color:var(--ds-text);font:inherit;tab-size:2;flex:auto;font-size:13px;line-height:1.75}.-\\30 eMCq_scriptArea:focus{border-color:var(--ds-primary);box-shadow:0 0 0 2px var(--ds-primary-dim);outline:none}.-\\30 eMCq_scriptDocs{align-items:center;gap:var(--ds-space-1);flex:none;display:flex}.-\\30 eMCq_checkRow{align-items:center;gap:var(--ds-space-2);flex-wrap:nowrap;min-width:0;display:flex}.-\\30 eMCq_checkRow .-\\30 eMCq_check{white-space:nowrap;min-width:0}.-\\30 eMCq_fieldInline{align-items:center;gap:var(--ds-space-1);flex-direction:row;min-width:0}.-\\30 eMCq_fieldInline>span{white-space:nowrap;flex:none}.-\\30 eMCq_inspector .-\\30 eMCq_fieldInline>input,.-\\30 eMCq_inspector .-\\30 eMCq_fieldInline>select{flex:auto;width:auto;min-width:0}.-\\30 eMCq_inspector .-\\30 eMCq_section{gap:var(--ds-space-1);padding-bottom:var(--ds-space-2)}.-\\30 eMCq_generateBar{align-items:stretch;gap:var(--ds-space-1);flex-direction:column}.-\\30 eMCq_genActions{align-items:center;gap:var(--ds-space-1);display:flex}.-\\30 eMCq_genActions>button{white-space:nowrap;flex:1 1 0;min-width:0;padding:0 6px}.-\\30 eMCq_genProgressRow{align-items:center;gap:var(--ds-space-2);display:flex}.-\\30 eMCq_sectionDivider{border-top:1px solid var(--ds-line);margin:2px 0}.-\\30 eMCq_modelTabs{gap:var(--ds-space-1);border-bottom:1px solid var(--ds-line);padding-bottom:var(--ds-space-1);flex-wrap:wrap;display:flex}.-\\30 eMCq_modelTab{height:26px;padding:0 var(--ds-space-2);border-radius:var(--ds-radius-m);color:var(--ds-text-2);font:inherit;cursor:pointer;background:0 0;border:0;font-size:12px}.-\\30 eMCq_modelTab:hover{background:var(--ds-primary-weak)}.-\\30 eMCq_modelTabOn{background:var(--ds-primary-weak);color:var(--ds-primary);font-weight:600}.-\\30 eMCq_modelField{align-items:center;gap:var(--ds-space-2);min-width:0;display:flex}.-\\30 eMCq_modelLabel{color:var(--ds-text-2);white-space:nowrap;text-overflow:ellipsis;flex:0 0 120px;font-size:12px;overflow:hidden}.-\\30 eMCq_modelField input,.-\\30 eMCq_modelField select{flex:auto;min-width:0}.-\\30 eMCq_checkResult{padding:var(--ds-space-2);border-radius:var(--ds-radius-m);border:1px solid var(--ds-line);background:var(--ds-hover);flex-direction:column;gap:4px;font-size:12px;display:flex}.-\\30 eMCq_checkOk{border-color:var(--ds-success);color:var(--ds-success)}.-\\30 eMCq_checkBad{border-color:var(--ds-danger);color:var(--ds-danger)}.-\\30 eMCq_checkList{color:var(--ds-text-2);margin:0;padding-left:18px;font-size:11px;line-height:1.6}.-\\30 eMCq_clipVideoCount{background:var(--ds-primary);color:#fff;text-align:center;font-variant-numeric:tabular-nums;z-index:2;border-radius:9px;min-width:18px;height:18px;padding:0 5px;font-size:11px;line-height:18px;position:absolute;top:4px;right:4px}.-\\30 eMCq_modalBackdrop{z-index:40;padding:var(--ds-space-4);background:#00000073;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.-\\30 eMCq_modal{gap:var(--ds-space-2);width:min(720px,92vw);max-height:82vh;padding:var(--ds-space-3);border-radius:var(--ds-radius-l);background:var(--ds-raised);color:var(--ds-text);border:1px solid var(--ds-line);flex-direction:column;display:flex;overflow:auto;box-shadow:0 18px 48px #00000059}.-\\30 eMCq_modalHead{align-items:center;gap:var(--ds-space-2);display:flex}.-\\30 eMCq_modalHead .-\\30 eMCq_ghost{margin-left:auto}.-\\30 eMCq_videoList{gap:var(--ds-space-1);flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.-\\30 eMCq_videoRow{align-items:center;gap:var(--ds-space-2);border:1px solid var(--ds-line);border-radius:var(--ds-radius-m);background:var(--ds-hover);padding:6px 8px;font-size:12px;display:flex}.-\\30 eMCq_videoRowOn{border-color:var(--ds-success)}.-\\30 eMCq_videoKind{color:var(--ds-text);flex:0 0 44px;font-weight:600}.-\\30 eMCq_videoLabel{color:var(--ds-text-2);flex:0 0 72px}.-\\30 eMCq_videoTime{color:var(--ds-text-3);font-variant-numeric:tabular-nums;flex:auto}.-\\30 eMCq_videoActive{color:var(--ds-success);flex:none;font-size:11px}.-\\30 eMCq_videoPreview{border-radius:var(--ds-radius-m);background:#000;width:100%;max-height:240px}.-\\30 eMCq_genProgressLoading{background:linear-gradient(90deg, var(--ds-primary-dim), var(--ds-primary), var(--ds-primary-dim));background-size:200% 100%;border-radius:2px;width:100%;height:100%;animation:2s ease-in-out infinite -\\30 eMCq_genWaveShift;display:block;position:relative;overflow:hidden}.-\\30 eMCq_genProgressLoading:after{content:\"\";background:linear-gradient(90deg,#0000 0%,#ffffff73 50%,#0000 100%) 0 0/40% 100% no-repeat;animation:1.3s linear infinite -\\30 eMCq_genWaveSweep;position:absolute;inset:0}@keyframes -\\30 eMCq_genWaveShift{0%{background-position:0%}to{background-position:200%}}@keyframes -\\30 eMCq_genWaveSweep{0%{background-position:-40% 0}to{background-position:140% 0}}.-\\30 eMCq_library{height:100%;min-height:0;overflow:hidden}.-\\30 eMCq_libraryScroll{flex:auto;min-height:0;overflow:hidden auto}.-\\30 eMCq_videoModal{gap:var(--ds-space-2);width:min(960px,94vw);max-height:88vh;padding:var(--ds-space-4);border-radius:var(--ds-radius-l);border:1px solid var(--ds-line);flex-direction:column;display:flex;overflow:auto;box-shadow:0 18px 48px #00000073}.-\\30 eMCq_videoModal .-\\30 eMCq_videoPreview{max-height:56vh}.-\\30 eMCq_videoModal .-\\30 eMCq_videoRow{padding:8px 10px}.-\\30 eMCq_bodyFull .-\\30 eMCq_center{min-width:0}.-\\30 eMCq_comfyPane{background:#14161a;flex-direction:column;flex:auto;min-height:0;display:flex}.-\\30 eMCq_comfyFail{color:var(--ds-danger);flex:none}.-\\30 eMCq_comfyFrame{background:#14161a;border:0;flex:auto;width:100%;height:100%;display:block}.-\\30 eMCq_fileModal{gap:var(--ds-space-2);width:min(1000px,94vw);max-height:88vh;padding:var(--ds-space-4);border-radius:var(--ds-radius-l);border:1px solid var(--ds-line);flex-direction:column;display:flex;box-shadow:0 18px 48px #00000073}.-\\30 eMCq_fileHead{align-items:center;gap:var(--ds-space-2);min-width:0;display:flex}.-\\30 eMCq_fileName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:var(--ds-font-mono,ui-monospace, monospace);opacity:.8;flex:auto;font-size:12px;overflow:hidden}.-\\30 eMCq_filePre{min-height:0;padding:var(--ds-space-3);border-radius:var(--ds-radius-m);border:1px solid var(--ds-line);font-family:var(--ds-font-mono,ui-monospace, monospace);white-space:pre-wrap;word-break:break-word;flex:auto;margin:0;font-size:12.5px;line-height:1.65;overflow:auto}.-\\30 eMCq_fileImage,.-\\30 eMCq_fileVideo{object-fit:contain;border-radius:var(--ds-radius-m);align-self:center;max-width:100%;max-height:66vh}.-\\30 eMCq_fileAudio{width:100%}.-\\30 eMCq_fileNote{align-items:center;gap:var(--ds-space-2);opacity:.85;margin:0;font-size:12.5px;display:flex}";
		const tagId = "dsh-dream-studio/StudioPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-dream-studio";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var StudioPanel_module_css_default = {
			"addRow": "-0eMCq_addRow",
			"assetCard": "-0eMCq_assetCard",
			"assetCardOn": "-0eMCq_assetCardOn",
			"assetFoot": "-0eMCq_assetFoot",
			"assetGrid": "-0eMCq_assetGrid",
			"assetName": "-0eMCq_assetName",
			"assetNameInput": "-0eMCq_assetNameInput",
			"assetRemove": "-0eMCq_assetRemove",
			"assetRemoveConfirm": "-0eMCq_assetRemoveConfirm",
			"badge": "-0eMCq_badge",
			"board": "-0eMCq_board",
			"boardHead": "-0eMCq_boardHead",
			"body": "-0eMCq_body",
			"bodyFull": "-0eMCq_bodyFull",
			"card": "-0eMCq_card",
			"cardActions": "-0eMCq_cardActions",
			"cardBody": "-0eMCq_cardBody",
			"cardCover": "-0eMCq_cardCover",
			"cardEdit": "-0eMCq_cardEdit",
			"cardGrid": "-0eMCq_cardGrid",
			"cardMissing": "-0eMCq_cardMissing",
			"center": "-0eMCq_center",
			"chatBar": "-0eMCq_chatBar",
			"chatNew": "-0eMCq_chatNew",
			"chatPane": "-0eMCq_chatPane",
			"chatSelect": "-0eMCq_chatSelect",
			"check": "-0eMCq_check",
			"checkBad": "-0eMCq_checkBad",
			"checkList": "-0eMCq_checkList",
			"checkOk": "-0eMCq_checkOk",
			"checkResult": "-0eMCq_checkResult",
			"checkRow": "-0eMCq_checkRow",
			"clipBadge": "-0eMCq_clipBadge",
			"clipBadgeFailed": "-0eMCq_clipBadgeFailed",
			"clipBadgeQueued": "-0eMCq_clipBadgeQueued",
			"clipBadgeRunning": "-0eMCq_clipBadgeRunning",
			"clipCard": "-0eMCq_clipCard",
			"clipCardBody": "-0eMCq_clipCardBody",
			"clipCardHead": "-0eMCq_clipCardHead",
			"clipCardMode": "-0eMCq_clipCardMode",
			"clipCardOn": "-0eMCq_clipCardOn",
			"clipCardTitle": "-0eMCq_clipCardTitle",
			"clipCover": "-0eMCq_clipCover",
			"clipLamp": "-0eMCq_clipLamp",
			"clipLampBusy": "-0eMCq_clipLampBusy",
			"clipLampFailed": "-0eMCq_clipLampFailed",
			"clipLampReady": "-0eMCq_clipLampReady",
			"clipProgress": "-0eMCq_clipProgress",
			"clipProgressBad": "-0eMCq_clipProgressBad",
			"clipProgressFill": "-0eMCq_clipProgressFill",
			"clipProgressOk": "-0eMCq_clipProgressOk",
			"clipStrip": "-0eMCq_clipStrip",
			"clipStripWrap": "-0eMCq_clipStripWrap",
			"clipThumb": "-0eMCq_clipThumb",
			"clipVideoCount": "-0eMCq_clipVideoCount",
			"combo": "-0eMCq_combo",
			"comfyFail": "-0eMCq_comfyFail",
			"comfyFrame": "-0eMCq_comfyFrame",
			"comfyPane": "-0eMCq_comfyPane",
			"crash": "-0eMCq_crash",
			"crashDetail": "-0eMCq_crashDetail",
			"danger": "-0eMCq_danger",
			"dangerText": "-0eMCq_dangerText",
			"dotBad": "-0eMCq_dotBad",
			"dotIdle": "-0eMCq_dotIdle",
			"dotOk": "-0eMCq_dotOk",
			"draftImage": "-0eMCq_draftImage",
			"durationRow": "-0eMCq_durationRow",
			"empty": "-0eMCq_empty",
			"episodeTree": "-0eMCq_episodeTree",
			"field": "-0eMCq_field",
			"fieldInline": "-0eMCq_fieldInline",
			"fieldLabel": "-0eMCq_fieldLabel",
			"fieldRow": "-0eMCq_fieldRow",
			"fileAudio": "-0eMCq_fileAudio",
			"fileHead": "-0eMCq_fileHead",
			"fileImage": "-0eMCq_fileImage",
			"fileModal": "-0eMCq_fileModal",
			"fileName": "-0eMCq_fileName",
			"fileNote": "-0eMCq_fileNote",
			"filePre": "-0eMCq_filePre",
			"fileVideo": "-0eMCq_fileVideo",
			"filmLabel": "-0eMCq_filmLabel",
			"filmRow": "-0eMCq_filmRow",
			"fragmentsLeft": "-0eMCq_fragmentsLeft",
			"fragmentsMain": "-0eMCq_fragmentsMain",
			"fragmentsPage": "-0eMCq_fragmentsPage",
			"fragmentsScroll": "-0eMCq_fragmentsScroll",
			"frameCard": "-0eMCq_frameCard",
			"frameClear": "-0eMCq_frameClear",
			"frameEmpty": "-0eMCq_frameEmpty",
			"frameFields": "-0eMCq_frameFields",
			"frameGrid": "-0eMCq_frameGrid",
			"frameRow": "-0eMCq_frameRow",
			"frameSelect": "-0eMCq_frameSelect",
			"frameThumb": "-0eMCq_frameThumb",
			"genActions": "-0eMCq_genActions",
			"genPercent": "-0eMCq_genPercent",
			"genPhase": "-0eMCq_genPhase",
			"genProgress": "-0eMCq_genProgress",
			"genProgressBad": "-0eMCq_genProgressBad",
			"genProgressFill": "-0eMCq_genProgressFill",
			"genProgressLoading": "-0eMCq_genProgressLoading",
			"genProgressOk": "-0eMCq_genProgressOk",
			"genProgressRow": "-0eMCq_genProgressRow",
			"genWaveShift": "-0eMCq_genWaveShift",
			"genWaveSweep": "-0eMCq_genWaveSweep",
			"generateBar": "-0eMCq_generateBar",
			"ghost": "-0eMCq_ghost",
			"header": "-0eMCq_header",
			"headerActions": "-0eMCq_headerActions",
			"hint": "-0eMCq_hint",
			"inspector": "-0eMCq_inspector",
			"inspectorHead": "-0eMCq_inspectorHead",
			"inspectorScroll": "-0eMCq_inspectorScroll",
			"keyAdd": "-0eMCq_keyAdd",
			"keyframeAdd": "-0eMCq_keyframeAdd",
			"keyframeAnchor": "-0eMCq_keyframeAnchor",
			"keyframeAnchorInput": "-0eMCq_keyframeAnchorInput",
			"keyframeBox": "-0eMCq_keyframeBox",
			"keyframeBoxFilled": "-0eMCq_keyframeBoxFilled",
			"keyframeCard": "-0eMCq_keyframeCard",
			"keyframeCardFilled": "-0eMCq_keyframeCardFilled",
			"keyframeClear": "-0eMCq_keyframeClear",
			"keyframeEmpty": "-0eMCq_keyframeEmpty",
			"keyframeItem": "-0eMCq_keyframeItem",
			"keyframeLabel": "-0eMCq_keyframeLabel",
			"keyframeState": "-0eMCq_keyframeState",
			"keyframeStrip": "-0eMCq_keyframeStrip",
			"keyframeThumb": "-0eMCq_keyframeThumb",
			"keyframeThumbWrap": "-0eMCq_keyframeThumbWrap",
			"keyframeTitle": "-0eMCq_keyframeTitle",
			"lamp": "-0eMCq_lamp",
			"lampBusy": "-0eMCq_lampBusy",
			"lampFailed": "-0eMCq_lampFailed",
			"lampReady": "-0eMCq_lampReady",
			"lane": "-0eMCq_lane",
			"left": "-0eMCq_left",
			"leftCollapsed": "-0eMCq_leftCollapsed",
			"library": "-0eMCq_library",
			"libraryScroll": "-0eMCq_libraryScroll",
			"lightbox": "-0eMCq_lightbox",
			"lightboxImage": "-0eMCq_lightboxImage",
			"linkish": "-0eMCq_linkish",
			"logBody": "-0eMCq_logBody",
			"logHead": "-0eMCq_logHead",
			"logPanel": "-0eMCq_logPanel",
			"logRow": "-0eMCq_logRow",
			"logRowError": "-0eMCq_logRowError",
			"logScope": "-0eMCq_logScope",
			"loraAdd": "-0eMCq_loraAdd",
			"loraList": "-0eMCq_loraList",
			"loraName": "-0eMCq_loraName",
			"loraRow": "-0eMCq_loraRow",
			"loraStrength": "-0eMCq_loraStrength",
			"message": "-0eMCq_message",
			"messageError": "-0eMCq_messageError",
			"meta": "-0eMCq_meta",
			"modal": "-0eMCq_modal",
			"modalBackdrop": "-0eMCq_modalBackdrop",
			"modalHead": "-0eMCq_modalHead",
			"modeButton": "-0eMCq_modeButton",
			"modeOn": "-0eMCq_modeOn",
			"modeSwitch": "-0eMCq_modeSwitch",
			"modelField": "-0eMCq_modelField",
			"modelLabel": "-0eMCq_modelLabel",
			"modelTab": "-0eMCq_modelTab",
			"modelTabOn": "-0eMCq_modelTabOn",
			"modelTabs": "-0eMCq_modelTabs",
			"moreList": "-0eMCq_moreList",
			"moreMenu": "-0eMCq_moreMenu",
			"nameInput": "-0eMCq_nameInput",
			"pane": "-0eMCq_pane",
			"paneHead": "-0eMCq_paneHead",
			"paneHint": "-0eMCq_paneHint",
			"pictureBar": "-0eMCq_pictureBar",
			"pictureRefAdd": "-0eMCq_pictureRefAdd",
			"pictureRefCard": "-0eMCq_pictureRefCard",
			"pictureRefRemove": "-0eMCq_pictureRefRemove",
			"pictureRefs": "-0eMCq_pictureRefs",
			"pictureRow": "-0eMCq_pictureRow",
			"pill": "-0eMCq_pill",
			"playhead": "-0eMCq_playhead",
			"primary": "-0eMCq_primary",
			"progressText": "-0eMCq_progressText",
			"promptArea": "-0eMCq_promptArea",
			"promptTabs": "-0eMCq_promptTabs",
			"refAdd": "-0eMCq_refAdd",
			"refCaption": "-0eMCq_refCaption",
			"refCard": "-0eMCq_refCard",
			"refFoot": "-0eMCq_refFoot",
			"refGrid": "-0eMCq_refGrid",
			"refIndex": "-0eMCq_refIndex",
			"refOverlay": "-0eMCq_refOverlay",
			"refRemove": "-0eMCq_refRemove",
			"refRole": "-0eMCq_refRole",
			"refStrip": "-0eMCq_refStrip",
			"refThumb": "-0eMCq_refThumb",
			"refTitle": "-0eMCq_refTitle",
			"resultActions": "-0eMCq_resultActions",
			"resultCard": "-0eMCq_resultCard",
			"resultGrid": "-0eMCq_resultGrid",
			"resultMeta": "-0eMCq_resultMeta",
			"right": "-0eMCq_right",
			"root": "-0eMCq_root",
			"rowButton": "-0eMCq_rowButton",
			"ruler": "-0eMCq_ruler",
			"rulerTick": "-0eMCq_rulerTick",
			"rulerTrack": "-0eMCq_rulerTrack",
			"saveRow": "-0eMCq_saveRow",
			"scriptArea": "-0eMCq_scriptArea",
			"scriptBar": "-0eMCq_scriptBar",
			"scriptDocs": "-0eMCq_scriptDocs",
			"scriptName": "-0eMCq_scriptName",
			"scriptPage": "-0eMCq_scriptPage",
			"scriptStatus": "-0eMCq_scriptStatus",
			"scriptStatusError": "-0eMCq_scriptStatusError",
			"secondPassDone": "-0eMCq_secondPassDone",
			"secondary": "-0eMCq_secondary",
			"section": "-0eMCq_section",
			"sectionDivider": "-0eMCq_sectionDivider",
			"sectionHead": "-0eMCq_sectionHead",
			"sectionTitle": "-0eMCq_sectionTitle",
			"serverAdd": "-0eMCq_serverAdd",
			"serverList": "-0eMCq_serverList",
			"serverName": "-0eMCq_serverName",
			"serverRow": "-0eMCq_serverRow",
			"serverTag": "-0eMCq_serverTag",
			"settingsPage": "-0eMCq_settingsPage",
			"slotList": "-0eMCq_slotList",
			"slotPrompt": "-0eMCq_slotPrompt",
			"slotRow": "-0eMCq_slotRow",
			"spacer": "-0eMCq_spacer",
			"stage": "-0eMCq_stage",
			"stageFilled": "-0eMCq_stageFilled",
			"status": "-0eMCq_status",
			"tab": "-0eMCq_tab",
			"tabOn": "-0eMCq_tabOn",
			"tabs": "-0eMCq_tabs",
			"timeline": "-0eMCq_timeline",
			"title": "-0eMCq_title",
			"treeClip": "-0eMCq_treeClip",
			"treeClips": "-0eMCq_treeClips",
			"treeEmpty": "-0eMCq_treeEmpty",
			"treeGroup": "-0eMCq_treeGroup",
			"treeHead": "-0eMCq_treeHead",
			"treeLabel": "-0eMCq_treeLabel",
			"treeRow": "-0eMCq_treeRow",
			"treeRowOn": "-0eMCq_treeRowOn",
			"videoActive": "-0eMCq_videoActive",
			"videoKind": "-0eMCq_videoKind",
			"videoLabel": "-0eMCq_videoLabel",
			"videoList": "-0eMCq_videoList",
			"videoModal": "-0eMCq_videoModal",
			"videoPreview": "-0eMCq_videoPreview",
			"videoRow": "-0eMCq_videoRow",
			"videoRowOn": "-0eMCq_videoRowOn",
			"videoTime": "-0eMCq_videoTime",
			"zoomable": "-0eMCq_zoomable"
		};
		// src/client/WorkflowModelsSection.tsx
		/**
		* 设置页的「工作流模型」区块：每个工作流一个页签，页内列出该模板所有可选模型
		* （主模型 / 文本编码器 / VAE / 音频 VAE / 补帧模型……）与 LoRA 配方。
		*
		* 模型项是下拉框（候选来自 ComfyUI 的模型目录，跨目录合并）；拿不到候选时退回可输入
		* 的文本框，离线也能手填。
		* @module dsh-dream-studio/WorkflowModelsSection
		*/
		/** 模型下拉：选项来自 ComfyUI 对应目录，当前值不在列表里时补进去。 */
		function ModelSelect({ value, options, disabled, onChange }) {
			if (options.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: StudioPanel_module_css_default.combo,
				type: "text",
				value,
				disabled,
				spellCheck: false,
				onChange: (event) => {
					onChange(event.currentTarget.value);
				}
			});
			const merged = options.includes(value) || value === "" ? options : [value, ...options];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				className: StudioPanel_module_css_default.combo,
				value,
				disabled,
				title: value,
				onChange: (event) => {
					onChange(event.currentTarget.value);
				},
				children: merged.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: name,
					children: name
				}, name))
			});
		}
		/** 一组 LoRA 配方（可加可删）。 */
		function LoraList({ list, options, disabled, t, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [list.map((lora, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.loraRow,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSelect, {
						value: lora.name,
						options,
						disabled,
						onChange: (name) => {
							onChange(list.map((entry, at) => at === index ? {
								...entry,
								name
							} : entry));
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: StudioPanel_module_css_default.loraStrength,
						type: "number",
						step: "0.05",
						min: "0",
						max: "2",
						"aria-label": t("settings.loraStrength"),
						value: lora.strength,
						disabled,
						onChange: (event) => {
							const strength = Number(event.currentTarget.value);
							onChange(list.map((entry, at) => at === index ? {
								...entry,
								strength
							} : entry));
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: StudioPanel_module_css_default.rowButton,
						disabled,
						onClick: () => {
							onChange(list.filter((_, at) => at !== index));
						},
						children: t("inspector.remove")
					})
				]
			}, `${String(index)}-${lora.name}`)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: StudioPanel_module_css_default.addRow,
				disabled,
				onClick: () => {
					onChange([...list, {
						name: "",
						strength: 1
					}]);
				},
				children: ["+ ", t("settings.addLora")]
			})] });
		}
		/** 取某个模板当前的配置（没配过就是空覆盖 + 模板自带 LoRA）。 */
		function configOf(models, template) {
			return models[template.name] ?? {
				slots: {},
				loras: template.loras
			};
		}
		/** 设置页里的「工作流模型」区块。 */
		function WorkflowModelsSection({ t, disabled, onSave }) {
			const [options, setOptions] = (0, react.useState)(null);
			const [models, setModels] = (0, react.useState)({});
			const [dirty, setDirty] = (0, react.useState)([]);
			const [active, setActive] = (0, react.useState)("");
			const [checking, setChecking] = (0, react.useState)(false);
			const [check, setCheck] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let live = true;
				readWorkflowModelOptions().then((loaded) => {
					if (!live) return;
					setOptions(loaded);
					setModels({ ...loaded.current });
					setActive(loaded.templates[0]?.name ?? "");
				}).catch(() => {
					if (live) setOptions(null);
				});
				return () => {
					live = false;
				};
			}, []);
			const templates = options?.templates ?? [];
			const template = templates.find((entry) => entry.name === active) ?? templates[0];
			const markDirty = (name) => {
				setDirty((current) => current.includes(name) ? current : [...current, name]);
			};
			const patch = (name, next) => {
				setModels((current) => ({
					...current,
					[name]: next
				}));
				markDirty(name);
			};
			const value = template === void 0 ? {
				slots: {},
				loras: []
			} : configOf(models, template);
			const loras = value.loras;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				templates.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.modelTabs,
					role: "tablist",
					children: templates.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						role: "tab",
						"aria-selected": entry.name === template?.name,
						className: entry.name === template?.name ? `${StudioPanel_module_css_default.modelTab} ${StudioPanel_module_css_default.modelTabOn}` : StudioPanel_module_css_default.modelTab,
						onClick: () => {
							setActive(entry.name);
						},
						children: entry.name
					}, entry.name))
				}),
				template === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.meta,
					children: options === null ? t("settings.modelsOffline") : t("settings.noModels")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					template.slots.map((slot) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.modelField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: StudioPanel_module_css_default.modelLabel,
							children: slot.label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSelect, {
							value: value.slots[slot.key] ?? slot.current,
							options: slot.options,
							disabled,
							onChange: (next) => {
								patch(template.name, {
									...value,
									slots: next === "" ? omitKey(value.slots, slot.key) : {
										...value.slots,
										[slot.key]: next
									}
								});
							}
						})]
					}, slot.key)),
					template.slots.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: StudioPanel_module_css_default.meta,
						children: t("settings.noModels")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: StudioPanel_module_css_default.fieldLabel,
						children: [
							t("settings.loras"),
							" ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: StudioPanel_module_css_default.meta,
								children: String(loras.length)
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoraList, {
						list: loras,
						options: template.loraOptions,
						disabled,
						t,
						onChange: (next) => {
							patch(template.name, {
								...value,
								loras: next
							});
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						className: StudioPanel_module_css_default.meta,
						children: template.loraMirrored ? t("settings.loraMirrorHint") : t("settings.loraChainHint")
					})
				] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.saveRow,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
							className: StudioPanel_module_css_default.meta,
							children: options === null ? t("settings.modelsOffline") : t("settings.workflowModelsSaveHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.rowButton,
							disabled: disabled || options === null || checking,
							title: t("settings.checkModelsHint"),
							onClick: () => {
								if (template === void 0) return;
								setChecking(true);
								setCheck(null);
								checkWorkflowModels(template.name, {
									slots: value.slots,
									loras: value.loras.filter((lora) => lora.name !== "")
								}).then((result) => {
									setCheck(result);
								}).catch((thrown) => {
									setCheck({
										ok: false,
										nodeCount: 0,
										issues: [{
											nodeId: "",
											classType: "",
											input: null,
											value: null,
											message: thrown instanceof Error ? thrown.message : String(thrown)
										}]
									});
								}).finally(() => {
									setChecking(false);
								});
							},
							children: checking ? t("settings.checking") : t("settings.checkModels")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.rowButton,
							disabled,
							onClick: () => {
								const saved = {};
								const keep = /* @__PURE__ */ new Set([...dirty, ...Object.keys(models)]);
								for (const name of keep) {
									const entry = models[name];
									if (entry === void 0) continue;
									const slots = {};
									for (const [key, slot] of Object.entries(entry.slots)) if (slot !== "") slots[key] = slot;
									saved[name] = {
										slots,
										loras: entry.loras.filter((lora) => lora.name !== "")
									};
								}
								onSave({ templates: saved });
							},
							children: t("board.save")
						})
					]
				}),
				check !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: check.ok ? `${StudioPanel_module_css_default.checkResult} ${StudioPanel_module_css_default.checkOk}` : `${StudioPanel_module_css_default.checkResult} ${StudioPanel_module_css_default.checkBad}`,
					role: "status",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: check.ok ? t("settings.checkOk", { count: String(check.nodeCount) }) : t("settings.checkIssues", { count: String(check.issues.length) }) }), check.issues.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: StudioPanel_module_css_default.checkList,
						children: check.issues.slice(0, 8).map((issue) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: issue.message }, `${issue.nodeId}-${issue.input ?? issue.classType}`))
					})]
				})
			] });
		}
		/** 去掉一个键（清空输入框 = 回到模板默认值）。 */
		function omitKey(source, key) {
			const next = {};
			for (const [name, value] of Object.entries(source)) if (name !== key) next[name] = value;
			return next;
		}
		// src/client/SettingsPage.tsx
		/**
		* 设置节：ComfyUI 服务、调度模式、工作流模型。
		*
		* 服务与调度是新库开箱后必须配的东西；工作流模型（主模型 / 一采二采 LoRA）
		* 让同一份模板能按项目换模型，不必改 ComfyUI 那边的图。
		* @module dsh-dream-studio/SettingsPage
		*/
		/** 渲染设置节。 */
		function SettingsPage({ t }) {
			const scheme = useHostScheme();
			const [settings, setSettings] = (0, react.useState)(null);
			const [servers, setServers] = (0, react.useState)([]);
			const [name, setName] = (0, react.useState)("");
			const [baseUrl, setBaseUrl] = (0, react.useState)("http://127.0.0.1:8188");
			const [minimaxKey, setMinimaxKey] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				try {
					const [nextSettings, nextServers] = await Promise.all([readSettings(), listServers()]);
					setSettings(nextSettings);
					setServers(nextServers);
					setMinimaxKey(nextSettings.minimaxApiKey);
					setError(null);
				} catch (thrown) {
					setError(thrown instanceof Error ? thrown.message : String(thrown));
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const fail = (thrown) => {
				setError(thrown instanceof Error ? thrown.message : String(thrown));
				setNotice(null);
			};
			const add = async () => {
				setBusy(true);
				try {
					await addServer({
						name: name.trim(),
						baseUrl: baseUrl.trim()
					});
					setName("");
					await refresh();
					setNotice("已添加服务");
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			const probe = async (serverId) => {
				setBusy(true);
				try {
					const result = await testServer(serverId);
					await refresh();
					setNotice(result.available ? "连接正常" : "连接失败：服务没有响应");
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			const remove = async (serverId) => {
				setBusy(true);
				try {
					await deleteServer(serverId);
					await refresh();
					setNotice("已删除服务");
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			const makeDefault = async (serverId) => {
				setBusy(true);
				try {
					await setDefaultServer(serverId);
					await refresh();
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			const switchDispatch = async (mode) => {
				setBusy(true);
				try {
					setSettings(await updateSettings({ dispatchMode: mode }));
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			/** 保存三个工作流的模型配置（子组件算好脏数据清洗后交过来）。 */
			const saveModels = async (next) => {
				setBusy(true);
				try {
					setSettings(await updateSettings({ workflowModels: next }));
					setNotice(t("settings.workflowModelsSaved"));
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			/** 保存 MiniMax Context IR 的 API key。 */
			const saveMinimaxKey = async () => {
				setBusy(true);
				try {
					setSettings(await updateSettings({ minimaxApiKey: minimaxKey.trim() }));
					setNotice(t("settings.minimaxKeySaved"));
				} catch (thrown) {
					fail(thrown);
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: StudioPanel_module_css_default.settingsPage,
				"data-studio": "",
				"data-scheme": scheme,
				"aria-label": t("settings.title"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: StudioPanel_module_css_default.sectionTitle,
						children: t("settings.title")
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `${StudioPanel_module_css_default.message} ${StudioPanel_module_css_default.messageError}`,
						children: error
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: StudioPanel_module_css_default.message,
						children: notice
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.sectionTitle,
								children: t("settings.servers")
							}),
							servers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: StudioPanel_module_css_default.paneHint,
								children: t("settings.noServer")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: StudioPanel_module_css_default.serverList,
								children: servers.map((server) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: StudioPanel_module_css_default.serverRow,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: server.available ? StudioPanel_module_css_default.dotOk : StudioPanel_module_css_default.dotIdle }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: StudioPanel_module_css_default.serverName,
											title: server.baseUrl,
											children: server.name
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: StudioPanel_module_css_default.meta,
											children: server.baseUrl
										}),
										server.isDefault && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: StudioPanel_module_css_default.serverTag,
											children: t("settings.default")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: StudioPanel_module_css_default.linkish,
											disabled: busy,
											onClick: () => {
												probe(server.id);
											},
											children: t("settings.test")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: StudioPanel_module_css_default.linkish,
											disabled: busy || server.isDefault,
											onClick: () => {
												makeDefault(server.id);
											},
											children: t("settings.makeDefault")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: StudioPanel_module_css_default.linkish,
											disabled: busy,
											onClick: () => {
												remove(server.id);
											},
											children: t("inspector.remove")
										})
									]
								}, server.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.serverAdd,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										"aria-label": t("settings.serverName"),
										placeholder: t("settings.serverName"),
										value: name,
										onChange: (event) => {
											setName(event.currentTarget.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										"aria-label": t("settings.serverUrl"),
										placeholder: "http://127.0.0.1:8188",
										value: baseUrl,
										onChange: (event) => {
											setBaseUrl(event.currentTarget.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: StudioPanel_module_css_default.secondary,
										disabled: busy || name.trim() === "",
										onClick: () => {
											add();
										},
										children: t("inspector.add")
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.section,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: StudioPanel_module_css_default.sectionTitle,
							children: t("status.dispatch")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.modeSwitch,
							role: "group",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: settings?.dispatchMode === "serial" ? `${StudioPanel_module_css_default.modeButton} ${StudioPanel_module_css_default.modeOn}` : StudioPanel_module_css_default.modeButton,
								disabled: busy,
								onClick: () => {
									switchDispatch("serial");
								},
								children: t("status.serial")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: settings?.dispatchMode === "parallel" ? `${StudioPanel_module_css_default.modeButton} ${StudioPanel_module_css_default.modeOn}` : StudioPanel_module_css_default.modeButton,
								disabled: busy,
								onClick: () => {
									switchDispatch("parallel");
								},
								children: t("status.parallel")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.section,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: StudioPanel_module_css_default.sectionTitle,
							children: t("settings.paths")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: StudioPanel_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.dataRoot") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								readOnly: true,
								value: settings?.projectRoot ?? ""
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.sectionTitle,
								children: t("settings.minimaxKey")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: StudioPanel_module_css_default.paneHint,
								children: t("settings.minimaxKeyHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.keyAdd,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": t("settings.minimaxKey"),
									placeholder: t("settings.minimaxKeyPlaceholder"),
									value: minimaxKey,
									type: "password",
									onChange: (event) => {
										setMinimaxKey(event.currentTarget.value);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: StudioPanel_module_css_default.secondary,
									disabled: busy,
									onClick: () => {
										saveMinimaxKey();
									},
									children: t("inspector.save")
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.sectionTitle,
								children: t("settings.workflowModels")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: StudioPanel_module_css_default.paneHint,
								children: t("settings.workflowModelsHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowModelsSection, {
								t,
								disabled: busy,
								onSave: saveModels
							})
						]
					})
				]
			});
		}
		// src/client/state/index.ts
		/**
		* 面板状态：按域切片的最小 observable。
		*
		* 每个域一个 store，组件只订阅自己要的字段（`useProjects(s => s.route)`），
		* 所以切换片段不会让看板重渲染，反之亦然。这是旧插件"一个 50 字段大 state
		* 全量推送"的对立面。
		* @module dsh-dream-studio/state
		*/
		/**
		* 造一个单元格。
		* @param initial - 初始值。
		* @returns 单元格。
		*/
		function createCell(initial) {
			let value = initial;
			const listeners = /* @__PURE__ */ new Set();
			return {
				get: () => value,
				set: (next) => {
					const resolved = typeof next === "function" ? next(value) : next;
					if (Object.is(resolved, value)) return;
					value = resolved;
					for (const listener of listeners) listener();
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				}
			};
		}
		/**
		* 订阅单元格的一个切片。
		* @param cell - 单元格。
		* @param select - 取切片。
		* @returns 切片值。
		*/
		function useCell(cell, select) {
			return (0, react.useSyncExternalStore)(cell.subscribe, () => select(cell.get()), () => select(cell.get()));
		}
		/** 外壳单元格。 */
		const shell = createCell({
			route: "board",
			tab: "studio",
			leftCollapsed: false,
			moreOpen: false,
			logsOpen: false,
			error: null,
			notice: null
		});
		/**
		* 改外壳状态。
		* @param patch - 要改的字段。
		*/
		function updateShell(patch) {
			shell.set((previous) => ({
				...previous,
				...patch
			}));
		}
		/** 看板单元格。 */
		const projects = createCell({
			projects: null,
			busy: false
		});
		/** 片段单元格。 */
		/** 左栏当前选中的是「剧集」还是「片段」：碎片页据此只显示一类卡片。 */
		const selectionScope = createCell("clip");
		const episode = createCell({
			projectId: null,
			projectName: "",
			episodes: [],
			episodeId: null,
			clips: [],
			totalDuration: 0,
			busy: false
		});
		/** 选中的片段 id。 */
		const selectedClip = createCell(null);
		/** 目录单元格。 */
		/** ComfyUI 服务（带可达性）；顶栏的连接灯读它。 */
		const servers = createCell([]);
		const catalog = createCell({ settings: null });
		/**
		* 取当前选中的片段。
		* @param state - 片段状态。
		* @param id - 选中 id。
		* @returns 片段，没有则 null。
		*/
		function clipById(state, id) {
			return id === null ? null : state.clips.find((clip) => clip.id === id) ?? null;
		}
		/** 当前选中片段的派生 hook。 */
		function useSelectedClip() {
			return clipById(useCell(episode, (value) => value), useCell(selectedClip, (value) => value));
		}
		/**
		* 由片段状态推出灯色。
		* @param clip - 片段。
		* @returns 灯。
		*/
		function lampOf(clip) {
			if (clip.resultVideoPath !== null) return "ready";
			if (clip.status === "failed") return "failed";
			if (clip.status === "queued" || clip.status === "running") return "busy";
			return clip.prompt.trim() === "" && clip.slots.length === 0 ? "idle" : "busy";
		}
		/** 素材列表（项目库 + 本集）。 */
		const assets = createCell([]);
		// src/client/state/actions.ts
		/**
		* 把异常转成可显示的文案。
		* @param thrown - 捕获到的值。
		* @returns 文案。
		*/
		function messageOf(thrown) {
			if (thrown instanceof HttpError || thrown instanceof Error) return thrown.message;
			return String(thrown);
		}
		/**
		* 在一次动作里置忙并兜住错误。
		* @param work - 动作体。
		*/
		async function guard(work) {
			try {
				updateShell({ error: null });
				await work();
			} catch (thrown) {
				updateShell({ error: messageOf(thrown) });
			}
		}
		/**
		* 把剧集载荷写进片段域，并修正选中项。
		* @param payload - 载荷。
		*/
		function applyPayload(payload) {
			episode.set({
				projectId: payload.projectId,
				projectName: payload.projectName,
				episodes: payload.episodes,
				episodeId: payload.episodeId,
				clips: payload.clips,
				totalDuration: payload.totalDuration,
				busy: false
			});
			const current = selectedClip.get();
			if (!(current !== null && payload.clips.some((clip) => clip.id === current))) selectedClip.set(payload.clips[0]?.id ?? null);
		}
		/** 读项目列表。 */
		async function loadProjects() {
			await guard(async () => {
				projects.set((previous) => ({
					...previous,
					busy: true
				}));
				try {
					projects.set({
						projects: await listProjects(),
						busy: false
					});
				} catch (thrown) {
					projects.set((previous) => ({
						...previous,
						busy: false
					}));
					throw thrown;
				}
			});
		}
		/** 读设置。 */
		/**
		* 读 ComfyUI 服务与可达性（顶栏连接灯用）。
		*/
		async function loadServers() {
			try {
				const list = await listServers();
				servers.set(Array.isArray(list) ? list : []);
			} catch {}
		}
		async function loadSettings() {
			await guard(async () => {
				catalog.set({ settings: await readSettings() });
			});
			loadServers();
		}
		/**
		* 打开一个项目，落在它的第一个剧集上。
		* @param id - 项目 id。
		*/
		async function openProject(id) {
			await guard(async () => {
				episode.set((previous) => ({
					...previous,
					busy: true
				}));
				applyPayload(await readEpisode(id));
				updateShell({
					route: "project",
					tab: "chat"
				});
			});
		}
		/** 回到看板。 */
		function backToBoard() {
			updateShell({ route: "board" });
			selectedClip.set(null);
			episode.set({
				projectId: null,
				projectName: "",
				episodes: [],
				episodeId: null,
				clips: [],
				totalDuration: 0,
				busy: false
			});
		}
		/**
		* 切到某个剧集。
		* @param episodeId - 剧集 id。
		*/
		async function openEpisode(episodeId) {
			const projectId = episode.get().projectId;
			if (projectId === null) return;
			await guard(async () => {
				episode.set((previous) => ({
					...previous,
					busy: true
				}));
				applyPayload(await readEpisode(projectId, episodeId));
			});
		}
		/** 重读当前剧集。 */
		async function reloadEpisode() {
			const state = episode.get();
			if (state.projectId === null) return;
			await guard(async () => {
				applyPayload(await readEpisode(state.projectId ?? "", state.episodeId ?? void 0));
			});
		}
		/**
		* 新建一个项目并打开它。
		* @param name - 项目名，缺省"未命名项目"。
		*/
		/**
		* 改项目的默认画幅/分辨率，成功后重读列表。
		* @param projectId - 项目。
		* @param defaults - 要改的字段。
		*/
		async function saveProjectDefaults(projectId, defaults) {
			await guard(async () => {
				await updateProjectDefaults(projectId, defaults);
				projects.set((previous) => ({
					...previous,
					projects: previous.projects
				}));
				projects.set({
					projects: await listProjects(),
					busy: false
				});
				updateShell({ notice: "已更新项目默认画幅" });
			});
		}
		async function addProject(name = "未命名项目", defaults = {}) {
			await guard(async () => {
				projects.set((previous) => ({
					...previous,
					busy: true
				}));
				const created = await createProject(name, defaults.dir, {
					...defaults.ratio === void 0 ? {} : { ratio: defaults.ratio },
					...defaults.resolution === void 0 ? {} : { resolution: defaults.resolution }
				});
				projects.set({
					projects: await listProjects(),
					busy: false
				});
				await openProject(created.id);
			});
		}
		/**
		* 删除一个项目。
		* @param id - 项目 id。
		*/
		async function removeProject(id) {
			await guard(async () => {
				projects.set((previous) => ({
					...previous,
					busy: true
				}));
				await deleteProject(id);
				projects.set({
					projects: await listProjects(),
					busy: false
				});
				if (episode.get().projectId === id) backToBoard();
			});
		}
		/**
		* 建（或切到）「自定义剧集」：没有 series.json 也能直接出片，自动带一个 S01。
		*/
		async function createCustomEpisodeNow() {
			const projectId = episode.get().projectId;
			if (projectId === null) return;
			await guard(async () => {
				const payload = await createCustomEpisode(projectId);
				applyPayload(payload);
				selectedClip.set(payload.clips[0]?.id ?? null);
				updateShell({ notice: "已切到「自定义剧集」，直接写提示词就能出片" });
			});
		}
		/**
		* 在自定义剧集里追加一个片段。
		*/
		async function addClipNow() {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			await guard(async () => {
				const payload = await addClip(state.projectId ?? "", state.episodeId ?? "", {});
				applyPayload(payload);
				selectedClip.set(payload.clips.at(-1)?.id ?? null);
				updateShell({ notice: `已新增片段 ${String(payload.clips.length)}` });
			});
		}
		/**
		* 扫描当前剧集的 `series.json`。
		* @param force - 忽略指纹。
		*/
		async function syncCurrentEpisode(force = false) {
			const state = episode.get();
			if (state.projectId === null) return;
			if (state.episodeId === null) {
				await guard(async () => {
					const result = await adoptEpisodes(state.projectId ?? "");
					applyPayload(await readEpisode(state.projectId ?? ""));
					updateShell({ notice: result.added > 0 ? `认领了 ${String(result.added)} 集` : "项目目录里还没有集目录" });
				});
				return;
			}
			await guard(async () => {
				const result = await syncEpisode(state.projectId ?? "", state.episodeId ?? "", force);
				applyPayload(result.payload);
				updateShell({ notice: `${result.message}（新增 ${String(result.created)} · 更新 ${String(result.updated)}${result.adopted > 0 ? ` · 认领 ${String(result.adopted)} 集` : ""}${result.orphaned.length > 0 ? ` · 失联 ${String(result.orphaned.length)}` : ""}）` });
			});
		}
		/**
		* 选中一个片段。
		* @param id - 片段 id。
		*/
		function selectClip(id) {
			selectedClip.set(id);
		}
		/** 清掉外壳的提示与错误。 */
		function dismissMessage() {
			updateShell({
				error: null,
				notice: null
			});
		}
		/**
		* 读素材（项目库 + 本集）。
		* @param projectId - 项目。
		* @param episodeId - 剧集。
		*/
		async function loadAssets(projectId, episodeId) {
			await guard(async () => {
				const list = await listAssets(projectId, episodeId);
				assets.set(Array.isArray(list) ? list : []);
			});
		}
		// src/client/state/jobs.ts
		/** 任务单元格。 */
		const jobs = createCell({
			list: [],
			progress: {},
			pictures: {},
			connected: false
		});
		/** 当前连接。 */
		let source = null;
		/**
		* 每个片段/任务最后拿到的百分比。
		*
		* 快照每 3 秒重建一次进度表；服务端那一轮没带百分比时（刚起任务、ComfyUI 还没报步数、
		* ws 断过一瞬间）会把已知的 75% 冲成 null，界面上就退化回"加载中"的波浪条。
		* 这里留一份"最后已知值"，只要这次运行里报过一次步数，就不会再退回加载中。
		*/
		const lastPercent = /* @__PURE__ */ new Map();
		/**
		* 读一个片段最后已知的百分比。
		* @param clipId - 片段 id。
		* @returns 百分比；这次运行还没报过步数时为 null。
		*/
		function lastKnownPercent(clipId) {
			return lastPercent.get(clipId) ?? null;
		}
		const pictureDoneListeners = /* @__PURE__ */ new Set();
		/**
		* 订阅「有图片任务结束」。
		* @param listener - 结束时要做什么。
		* @returns 取消订阅的函数。
		*/
		function onPictureDone(listener) {
			pictureDoneListeners.add(listener);
			return () => {
				pictureDoneListeners.delete(listener);
			};
		}
		/**
		* 挨个通知订阅者。
		* @param outcome - 收尾结果；快照兜底时按成功处理（拿不到具体状态）。
		*/
		function firePictureDone(outcome = {
			status: "success",
			error: null
		}) {
			for (const listener of pictureDoneListeners) listener(outcome);
		}
		/** 上次用快照兜底刷新剧集的时间（节流，避免每 3 秒拉一次）。 */
		let lastReconcile = 0;
		/**
		* 读一次当前剧集的任务列表。
		*/
		async function loadJobs() {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				const list = await listJobs(state.projectId, state.episodeId);
				jobs.set((previous) => ({
					...previous,
					list
				}));
			} catch {}
		}
		/**
		* 排队一个片段。
		* @param clipId - 片段。
		*/
		async function generateClip(clipId) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				jobs.set((previous) => ({
					...previous,
					progress: {
						...previous.progress,
						[clipId]: {
							percent: 0,
							note: "排队中"
						}
					}
				}));
				lastPercent.set(clipId, 0);
				await generate(state.projectId, state.episodeId, clipId);
				updateShell({ notice: "已排队" });
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 排队一次「独立二采」：把这段已出的低分辨率样片按倍率/降噪/步数放大成高清成片。
		* @param clipId - 片段。
		*/
		async function generateSecondPass(clipId) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				jobs.set((previous) => ({
					...previous,
					progress: {
						...previous.progress,
						[clipId]: {
							percent: 0,
							note: "独立二采排队中"
						}
					}
				}));
				lastPercent.set(clipId, 0);
				await startSecondPass(state.projectId, clipId);
				episode.set((previous) => ({
					...previous,
					clips: previous.clips.map((entry) => entry.id === clipId ? {
						...entry,
						status: "queued"
					} : entry)
				}));
				updateShell({ notice: "已排独立二采：按右栏的二采尺寸 / 重绘幅度 / 二采步数放大" });
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 排队一次「视频放大」：把本段成片放大到 2K / 4K。
		* @param clipId - 片段。
		* @param level - `2k` / `4k`。
		*/
		async function generateVideoUpscale(clipId, level) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				jobs.set((previous) => ({
					...previous,
					progress: {
						...previous.progress,
						[clipId]: {
							percent: 0,
							note: "视频放大排队中"
						}
					}
				}));
				lastPercent.set(clipId, 0);
				await startVideoUpscale(state.projectId, clipId, level);
				episode.set((previous) => ({
					...previous,
					clips: previous.clips.map((entry) => entry.id === clipId ? {
						...entry,
						status: "queued"
					} : entry)
				}));
				updateShell({ notice: `已排视频放大（${level.toUpperCase()}）` });
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 排队一次「视频补帧」：把本段成片每秒补充指定帧数。
		* @param clipId - 片段。
		* @param multiplier - 每秒补充的帧数。
		*/
		async function generateVideoInterpolate(clipId, multiplier) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				jobs.set((previous) => ({
					...previous,
					progress: {
						...previous.progress,
						[clipId]: {
							percent: 0,
							note: "视频补帧排队中"
						}
					}
				}));
				lastPercent.set(clipId, 0);
				await startVideoInterpolate(state.projectId, clipId, multiplier);
				episode.set((previous) => ({
					...previous,
					clips: previous.clips.map((entry) => entry.id === clipId ? {
						...entry,
						status: "queued"
					} : entry)
				}));
				updateShell({ notice: `已排视频补帧（每秒 +${String(multiplier)} 帧）` });
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 排队整集。
		* @param includeDone - 是否重跑已出片的。
		*/
		async function generateAll(includeDone = false) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				const result = await generate(state.projectId, state.episodeId, void 0, includeDone);
				jobs.set((previous) => {
					const next = { ...previous.progress };
					for (const id of result.jobIds) {
						next[id] = {
							percent: 0,
							note: "排队中"
						};
						lastPercent.set(id, 0);
					}
					return {
						...previous,
						progress: next
					};
				});
				const queued = new Set(result.jobIds);
				episode.set((previous) => ({
					...previous,
					clips: previous.clips.map((entry) => queued.has(entry.id) ? {
						...entry,
						status: "queued"
					} : entry)
				}));
				updateShell({ notice: `已排队 ${String(result.jobIds.length)} 个片段` });
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 取消：给了 jobId 取消一条，否则取消整集。
		* @param jobId - 任务 id。
		*/
		async function cancelJob(jobId) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				await cancel$1(state.projectId, state.episodeId, jobId);
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 连上事件流。
		* @returns 断开连接的函数。
		*/
		let fallback = null;
		/** 停掉兜底轮询。 */
		function stopFallback() {
			if (fallback !== null) {
				clearInterval(fallback);
				fallback = null;
			}
		}
		/** 启动兜底轮询：只在事件流断开时生效，5 秒一次，避免状态卡在「待响应」。 */
		function startFallback() {
			if (fallback !== null) return;
			fallback = setInterval(() => {
				if (jobs.get().connected) return;
				loadJobs();
				reloadEpisode();
			}, 5e3);
		}
		/**
		* 把一份快照套到状态上。
		*
		* 快照是"当前真值"：用它重建进度表，补上断线期间丢掉的 progress 事件；
		* 同时收拾"服务端已经没有、本地还挂着"的残留（终态事件丢了的情况）。
		* @param message - 快照。
		*/
		function applySnapshot(message) {
			const snapshotRunning = message.running ?? [];
			const pendingPictures = Object.keys(jobs.get().pictures);
			jobs.set((previous) => {
				const merge = (entries, bucket) => Object.fromEntries(entries.map((entry) => {
					const prior = bucket[entry.clipId]?.percent ?? lastPercent.get(entry.clipId) ?? null;
					const percent = typeof entry.progress === "number" ? entry.progress : prior;
					if (typeof percent === "number") lastPercent.set(entry.clipId, percent);
					return [entry.clipId, {
						percent,
						note: entry.note
					}];
				}));
				return {
					...previous,
					progress: merge(snapshotRunning.filter((entry) => entry.kind !== "picture"), previous.progress),
					pictures: merge(snapshotRunning.filter((entry) => entry.kind === "picture"), previous.pictures)
				};
			});
			const live = /* @__PURE__ */ new Set([...snapshotRunning.map((entry) => entry.clipId), ...(message.queued ?? []).map((entry) => entry.clipId)]);
			if (episode.get().clips.some((clip) => (clip.status === "running" || clip.status === "queued") && !live.has(clip.id)) && Date.now() - lastReconcile > 1e3) {
				lastReconcile = Date.now();
				reloadEpisode();
			}
			if (pendingPictures.length > 0 && pendingPictures.every((id) => !live.has(id))) firePictureDone();
			loadJobs();
		}
		/**
		* 拉一次进度真值。
		*
		* 事件流有可能悄悄断掉（断了就收不到任何 progress / 终态），这时界面上会一直停在
		* "0%"或"取消亮着"。轮询只在真有任务时开，靠它自愈。
		*/
		async function pullProgress() {
			try {
				applySnapshot(await fetchProgress());
			} catch {}
		}
		/** 轮询句柄。 */
		let poller = null;
		/** 有任务在跑时才轮询，没任务就停，避免空转。 */
		function startPoller() {
			if (poller !== null) return;
			poller = setInterval(() => {
				const state = jobs.get();
				if (!(Object.keys(state.progress).length > 0 || Object.keys(state.pictures).length > 0 || episode.get().clips.some((clip) => clip.status === "running" || clip.status === "queued"))) return;
				pullProgress();
			}, 2500);
		}
		/** 停掉轮询。 */
		function stopPoller() {
			if (poller !== null) {
				clearInterval(poller);
				poller = null;
			}
		}
		function connectEvents() {
			if (typeof EventSource === "undefined") return () => void 0;
			disconnectEvents();
			startFallback();
			startPoller();
			const created = new EventSource(eventsUrl());
			source = created;
			created.onopen = () => {
				jobs.set((previous) => ({
					...previous,
					connected: true
				}));
				loadJobs();
				reloadEpisode();
			};
			created.onerror = () => {
				jobs.set((previous) => ({
					...previous,
					connected: false
				}));
			};
			created.onmessage = (event) => {
				let parsed;
				try {
					parsed = JSON.parse(event.data);
				} catch {
					return;
				}
				if (typeof parsed !== "object" || parsed === null) return;
				const message = parsed;
				if (message.type === "snapshot") {
					applySnapshot(message);
					return;
				}
				if (message.type === "ping") return;
				if (message.type !== "job") return;
				const clipId = message.clipId ?? "";
				const status = message.status ?? "queued";
				if (message.kind !== "picture" && (status === "queued" || status === "running" || status === "success" || status === "failed" || status === "cancelled")) episode.set((previous) => ({
					...previous,
					clips: previous.clips.map((entry) => entry.id === clipId ? {
						...entry,
						status
					} : entry)
				}));
				jobs.set((previous) => {
					if (status === "queued" || status === "running") {
						const prior = (message.kind === "picture" ? previous.pictures : previous.progress)[clipId]?.percent ?? lastPercent.get(clipId) ?? null;
						const percent = typeof message.progress === "number" ? message.progress : prior;
						if (typeof percent === "number") lastPercent.set(clipId, percent);
						const entry = {
							percent,
							note: message.note ?? null
						};
						return message.kind === "picture" ? {
							...previous,
							pictures: {
								...previous.pictures,
								[clipId]: entry
							}
						} : {
							...previous,
							progress: {
								...previous.progress,
								[clipId]: entry
							}
						};
					}
					lastPercent.delete(clipId);
					const pictures = { ...previous.pictures };
					const progress = { ...previous.progress };
					delete pictures[clipId];
					delete progress[clipId];
					return {
						...previous,
						pictures,
						progress
					};
				});
				if (status === "success" || status === "failed" || status === "cancelled") {
					if (message.kind === "picture") firePictureDone({
						status: status === "success" ? "success" : status === "cancelled" ? "cancelled" : "failed",
						error: message.error ?? null
					});
					reloadEpisode();
					loadJobs();
				}
			};
			return disconnectEvents;
		}
		/** 断开事件流。 */
		function disconnectEvents() {
			source?.close();
			stopFallback();
			stopPoller();
			source = null;
			jobs.set((previous) => ({
				...previous,
				connected: false
			}));
		}
		/**
		* 把已出片的片段导出成独立文件。
		* @param targetDir - 目标目录。
		*/
		async function exportEpisode(targetDir) {
			const state = episode.get();
			if (state.projectId === null || state.episodeId === null) return;
			try {
				const result = await exportClipFilms(state.projectId, state.episodeId, targetDir);
				updateShell({ notice: `已导出 ${String(result.files.length)} 个文件 → ${targetDir}` });
			} catch (thrown) {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 生图刚点下时在本地落一个 0% 的占位。
		*
		* 图片任务的进度只靠 SSE 推送，第一帧到来前如果沿用上一次的 100%，
		* 点下去的一瞬间就会显示"已完成"。
		* @param clipId - 片段 id。
		*/
		function markPicturePending(clipId) {
			jobs.set((previous) => ({
				...previous,
				pictures: {
					...previous.pictures,
					[clipId]: {
						percent: 0,
						note: null
					}
				}
			}));
		}
		// src/client/shell/Header.tsx
		/** 渲染顶栏。 */
		function Header({ t, onExport }) {
			const route = useCell(shell, (value) => value.route);
			const state = useCell(episode, (value) => value);
			const list = useCell(projects, (value) => value.projects);
			const settings = useCell(catalog, (value) => value.settings);
			const servers$2 = useCell(servers, (list) => list);
			const online = servers$2.some((server) => server.available);
			const serverName = servers$2.find((server) => server.available)?.name ?? null;
			const active = useCell(jobs, (value) => Object.keys(value.progress).length);
			const current = list?.find((entry) => entry.id === state.projectId) ?? null;
			const episodeIndex = state.episodes.findIndex((entry) => entry.id === state.episodeId);
			const mergeable = state.clips.filter((clip) => clip.resultVideoPath !== null).length;
			const currentEpisode = state.episodes.find((entry) => entry.id === state.episodeId) ?? null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: StudioPanel_module_css_default.header,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.title,
					children: [
						route === "project" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.ghost,
							onClick: backToBoard,
							children: t("shell.backToProjects")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: current === null ? t("app.name") : `${current.name} · ${t("app.subtitle")}` }),
						route === "project" && episodeIndex >= 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
							className: StudioPanel_module_css_default.meta,
							children: `${t("shell.episode")} ${String(episodeIndex + 1)} · ${t("board.clips", { count: state.clips.length })}`
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.headerActions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: StudioPanel_module_css_default.pill,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { className: online ? StudioPanel_module_css_default.dotOk : StudioPanel_module_css_default.dotIdle }), settings === null ? t("status.notConfigured") : online ? `${serverName ?? t("status.server")} · ${t("status.connected")}` : t("status.disconnected")]
					}), route === "project" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							disabled: state.busy,
							onClick: () => {
								createCustomEpisodeNow();
							},
							children: t("shell.createEpisode")
						}),
						currentEpisode?.custom === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							disabled: state.busy,
							onClick: () => {
								addClipNow();
							},
							children: t("shell.addClip")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							disabled: state.busy,
							onClick: () => {
								syncCurrentEpisode(true);
							},
							children: state.busy ? t("shell.syncing") : t("shell.sync")
						}),
						active > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.danger,
							onClick: () => {
								cancelJob();
							},
							children: t("inspector.cancel")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.primary,
							onClick: () => {
								generateAll();
							},
							children: t("studio.generateAll")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							disabled: mergeable === 0,
							title: mergeable === 0 ? t("studio.exportHintEmpty") : void 0,
							onClick: () => {
								onExport();
							},
							children: t("studio.exportClips")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							onClick: () => {
								updateShell({ logsOpen: true });
							},
							children: t("shell.logs")
						})
					] })]
				})]
			});
		}
		// src/client/shell/Tabs.tsx
		/** 页签的键。 */
		const TABS = [
			{
				id: "chat",
				key: "shell.tab.chat"
			},
			{
				id: "script",
				key: "shell.tab.script"
			},
			{
				id: "fragments",
				key: "shell.tab.fragments"
			},
			{
				id: "studio",
				key: "shell.tab.studio"
			},
			{
				id: "comfy",
				key: "shell.tab.comfy"
			}
		];
		/** 渲染页签行。 */
		function Tabs({ t }) {
			const tab = useCell(shell, (value) => value.tab);
			const collapsed = useCell(shell, (value) => value.leftCollapsed);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
				className: StudioPanel_module_css_default.tabs,
				"aria-label": t("app.name"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: StudioPanel_module_css_default.ghost,
					"aria-pressed": collapsed,
					onClick: () => {
						updateShell({ leftCollapsed: !collapsed });
					},
					children: [t("shell.episodes"), " ←"]
				}), TABS.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					role: "tab",
					"aria-selected": tab === entry.id,
					className: tab === entry.id ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
					onClick: () => {
						updateShell({ tab: entry.id });
					},
					children: t(entry.key)
				}, entry.id))]
			});
		}
		// ../shared/lib/view-model.js
		/** 右栏提供的画幅选项。 */
		const RATIO_OPTIONS = [
			"16:9",
			"9:16",
			"1:1",
			"4:3",
			"3:4",
			"21:9"
		];
		/** H3 Easy 的 resolution 档位：短边像素，360P–1080P。 */
		const RESOLUTION_TIERS = [
			"360P",
			"416P",
			"480P",
			"540P",
			"640P",
			"720P",
			"768P",
			"832P",
			"928P",
			"1024P",
			"1080P"
		];
		/** 二采相对一采的线性倍率。 */
		const SECOND_FACTOR_OPTIONS = [
			1,
			1.5,
			2,
			2.5,
			3
		];
		/** 图片短边档位（P）。360 是图生图专用：模板会自动放大 2 倍，出片即 720P。 */
		const PICTURE_TIERS = [
			360,
			480,
			540,
			720,
			1080,
			2160
		];
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
		* 由画幅与档位拼出可读标签。
		* @param tier - 短边像素。
		* @param ratio - 画幅。
		* @returns 例如 `1080P · 1920×1080`。
		*/
		function pictureTierLabel(tier, ratio) {
			const canvas = resolutionForShortSide(tier, ratio);
			return `${String(tier)}P · ${String(canvas.width)}×${String(canvas.height)}`;
		}
		/**
		* 16 对齐并保证不小于 16。
		* @param value - 原始像素。
		* @returns 对齐后的像素。
		*/
		function snap16(value) {
			return Math.max(16, Math.round(value / 16) * 16);
		}
		/**
		* 秒数格式化为一位小数。
		* @param seconds - 秒。
		* @returns 文本。
		*/
		function formatSeconds(seconds) {
			return seconds.toFixed(1);
		}
		// src/client/shell/StatusBar.tsx
		/**
		* 底栏：服务、调度、队列、可合并段数、二进制状态。
		* @module dsh-dream-studio/shell/StatusBar
		*/
		/** 渲染底栏。 */
		function StatusBar({ t }) {
			const settings = useCell(catalog, (value) => value.settings);
			const state = useCell(episode, (value) => value);
			const filmed = state.clips.filter((clip) => clip.resultVideoPath !== null).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
				className: StudioPanel_module_css_default.status,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: settings === null ? t("status.notConfigured") : t("status.server") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: settings?.dispatchMode === "parallel" ? `${t("status.dispatch")}: ${t("status.parallel")}` : `${t("status.dispatch")}: ${t("status.serial")}` }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: `${t("status.queue")}: 0` }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("status.filmed", { count: filmed }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: StudioPanel_module_css_default.meta,
						children: [formatSeconds(state.totalDuration), "s"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: StudioPanel_module_css_default.spacer })
				]
			});
		}
		// src/client/components/FileViewer.tsx
		/**
		* 文件预览弹框：在插件面板里直接看剧本 / 大纲 / series.json / 图片 / 视频。
		*
		* DSH 的「在右侧栏打开文件」要求主面板后面挂着一个会话页，插件是全局 `main` 面板，
		* 那条路必然报 `sidebarRight: no session surface is mounted`。加上本机 `.md` 未必有
		* 可用的默认程序，所以这里自己读原文件渲染，仍然给一个「用默认程序打开」的出口。
		* @module dsh-dream-studio/components/FileViewer
		*/
		/** 当作文本预览的后缀。 */
		const TEXT_EXT = /\.(md|markdown|txt|log|json|jsonl|csv|tsv|yml|yaml|srt|ass|vtt|js|mjs|cjs|ts|tsx|py|bat|cmd|ps1|sh)$/iu;
		/** 直接交给 `<img>` 的后缀。 */
		const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/iu;
		/** 直接交给 `<video>` 的后缀。 */
		const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)$/iu;
		/** 直接交给 `<audio>` 的后缀。 */
		const AUDIO_EXT = /\.(mp3|wav|flac|m4a|aac)$/iu;
		/**
		* 把失败响应翻成一句人话：Host 的 `{ error }` 比状态码有用得多（能区分"路由不存在"和"找不到文件"）。
		* @param response - 失败的响应。
		* @param fallback - 没有 error 字段时的兜底文案。
		* @returns 展示用文案。
		*/
		async function failureText(response, fallback) {
			try {
				const raw = await response.text();
				const parsed = JSON.parse(raw);
				if (typeof parsed === "object" && parsed !== null && "error" in parsed) return `${String(parsed.error)}（${String(response.status)}）`;
			} catch {}
			return `${fallback}（${String(response.status)}）`;
		}
		/**
		* 渲染文件预览弹框。
		* @param props - 项目、路径、优先目录、翻译与关闭回调。
		*/
		function FileViewer({ projectId, path, base, t, onClose }) {
			const [text, setText] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const url = projectFileUrl(projectId, path, base);
			const isText = TEXT_EXT.test(path);
			const isImage = IMAGE_EXT.test(path);
			const isVideo = VIDEO_EXT.test(path);
			const isAudio = AUDIO_EXT.test(path);
			(0, react.useEffect)(() => {
				if (!isText) return void 0;
				let live = true;
				setLoading(true);
				setError(null);
				fetch(url).then(async (response) => {
					if (!response.ok) throw new Error(await failureText(response, t("fileViewer.failed")));
					return await response.text();
				}).then((body) => {
					if (live) setText(body);
				}).catch((thrown) => {
					if (live) setError(thrown instanceof Error ? thrown.message : String(thrown));
				}).finally(() => {
					if (live) setLoading(false);
				});
				return () => {
					live = false;
				};
			}, [
				url,
				isText,
				t
			]);
			const openWithSystem = () => {
				openProjectPath(projectId, path, base).catch((thrown) => {
					setError(thrown instanceof Error ? thrown.message : String(thrown));
				});
			};
			const theme = {
				background: "#ffffff",
				color: "#1a1d21",
				borderColor: "rgba(0,0,0,0.16)"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.modalBackdrop,
				role: "presentation",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.fileModal,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("fileViewer.title"),
					style: theme,
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: StudioPanel_module_css_default.fileHead,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.fileName,
									title: path,
									children: path
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: StudioPanel_module_css_default.ghost,
									onClick: openWithSystem,
									children: t("fileViewer.openWithSystem")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: StudioPanel_module_css_default.ghost,
									onClick: onClose,
									children: t("common.close")
								})
							]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.fileNote,
							children: error
						}),
						error === null && loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.fileNote,
							children: t("fileViewer.loading")
						}),
						error === null && isText && text !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							className: StudioPanel_module_css_default.filePre,
							style: theme,
							children: text
						}),
						error === null && isImage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: StudioPanel_module_css_default.fileImage,
							src: url,
							alt: path
						}),
						error === null && isVideo && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
							className: StudioPanel_module_css_default.fileVideo,
							src: url,
							controls: true
						}),
						error === null && isAudio && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("audio", {
							className: StudioPanel_module_css_default.fileAudio,
							src: url,
							controls: true
						}),
						error === null && !isText && !isImage && !isVideo && !isAudio && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: StudioPanel_module_css_default.fileNote,
							children: [t("fileViewer.unsupported"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: StudioPanel_module_css_default.ghost,
								onClick: openWithSystem,
								children: t("fileViewer.openWithSystem")
							})]
						})
					]
				})
			});
		}
		// src/client/lib/time.ts
		/**
		* 时间显示与文件命名统一走本地时区。
		*
		* 数据库里存的是 UTC（`2026-11-19T02:45:53.530Z`），直接 `slice(0, 19)` 展示
		* 出来的就是 UTC 时间，东八区用户会看到比墙上时钟慢 8 小时的时间戳。文件名的
		* 时间戳同理：素材名里的时间应该是创作者看到的时间。
		*/
		/** 两位数补零。 */
		const pad = (value) => String(value).padStart(2, "0");
		/** 解析 ISO 字符串；解析不出来时退回原文，避免界面显示 Invalid Date。 */
		function parse(iso) {
			const when = new Date(iso);
			return Number.isNaN(when.getTime()) ? null : when;
		}
		/**
		* 本地时间戳（文件名用）：`20261119104553`。
		* @param when - 要格式化的时刻，默认当前时间。
		* @returns 紧凑的本地时间串。
		*/
		function localStamp(when = /* @__PURE__ */ new Date()) {
			return `${String(when.getFullYear())}${pad(when.getMonth() + 1)}${pad(when.getDate())}${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
		}
		/**
		* 本地日期时间（列表用）：`2026-11-19 10:45:53`。
		* @param iso - 数据库里的 UTC ISO 串。
		* @returns 本地时间的可读串；解析失败时退回原串前 19 个字符。
		*/
		function formatDateTime(iso) {
			const when = parse(iso);
			if (when === null) return iso.replace("T", " ").slice(0, 19);
			return `${String(when.getFullYear())}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}`;
		}
		/**
		* 本地时钟（日志用）：`10:45:53`。
		* @param iso - 数据库里的 UTC ISO 串。
		* @returns 本地时间的时分秒；解析失败时退回原串第 11–19 位。
		*/
		function formatClock(iso) {
			const when = parse(iso);
			if (when === null) return iso.slice(11, 19);
			return `${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}`;
		}
		// src/client/components/LogPanel.tsx
		/**
		* 日志面板：从 `/logs` 读最近的运行记录，浮在面板右下角。
		* @module dsh-dream-studio/components/LogPanel
		*/
		/** 渲染日志面板（未打开时不占位）。 */
		function LogPanel({ t }) {
			const open = useCell(shell, (value) => value.logsOpen);
			const [rows, setRows] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!open) return;
				(async () => {
					try {
						setRows([...await readLogs()].reverse());
						setError(null);
					} catch (thrown) {
						setError(thrown instanceof Error ? thrown.message : String(thrown));
					}
				})();
			}, [open]);
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.logPanel,
				role: "dialog",
				"aria-label": t("shell.logs"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.logHead,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("shell.logs") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.meta,
								children: `${String(rows.length)} 条`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: StudioPanel_module_css_default.spacer }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.ghost,
								onClick: () => {
									updateShell({ logsOpen: false });
								},
								children: t("common.close")
							})
						]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `${StudioPanel_module_css_default.message} ${StudioPanel_module_css_default.messageError}`,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.logBody,
						children: rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.paneHint,
							children: t("common.empty")
						}) : rows.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: row.message.includes("失败") || row.message.includes("错误") ? `${StudioPanel_module_css_default.logRow} ${StudioPanel_module_css_default.logRowError}` : StudioPanel_module_css_default.logRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: StudioPanel_module_css_default.meta,
									children: formatClock(String(row.at ?? ""))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.logScope,
									children: row.category
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.message })
							]
						}, `${String(index)}-${row.at}`))
					})
				]
			});
		}
		// src/client/components/ErrorBoundary.tsx
		/**
		* 渲染错误边界：插件里任何组件抛错时，只在这一块显示原因与「重试」，
		* 而不是让宿主主区域变成黑屏、连切页签的入口都没有。
		* @module dsh-dream-studio/components/ErrorBoundary
		*/
		/** 包住面板内容的错误边界。 */
		var ErrorBoundary = class extends react.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(thrown) {
				const message = thrown instanceof Error ? thrown.message : String(thrown);
				return { error: message === "" ? "未知渲染错误" : message };
			}
			render() {
				const { error } = this.state;
				if (error === null) return this.props.children;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.crash,
					role: "alert",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: this.props.label }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							className: StudioPanel_module_css_default.crashDetail,
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							onClick: () => {
								this.setState({ error: null });
							},
							children: this.props.retry
						})
					]
				});
			}
		};
		// src/client/pages/board/Board.tsx
		/**
		* 项目看板：新建、卡片网格、删除确认。
		*
		* 新建流程**照旧插件**：输入名称 → 点「新建项目」→ 立刻弹目录选择器 → 选中目录才
		* 建，取消就什么都不做。项目建好后再把该目录登记成工作区（后面开新会话直接用），
		* 登记失败不影响项目本身。
		* @module dsh-dream-studio/pages/board/Board
		*/
		/** 渲染看板。 */
		function Board({ t, pickDirectory, registerWorkspace }) {
			const state = useCell(projects, (value) => value);
			const [name, setName] = (0, react.useState)("");
			const [ratio, setRatio] = (0, react.useState)("16:9");
			const [resolution, setResolution] = (0, react.useState)("1080P");
			/**
			* 建在操作者选的目录里。
			*
			* 一个项目的剧集里放的是脚本、片段包和每一张渲染出来的图，所以默认不往数据根
			* （通常在系统盘）里堆：目录必须由操作者指定，取消就什么都不建。
			* @param value - 项目名。
			*/
			const create = (value) => {
				const trimmed = value.trim();
				if (trimmed === "") return;
				if (pickDirectory === void 0) {
					updateShell({ error: "当前宿主不支持选择目录" });
					return;
				}
				pickDirectory().then(async (dir) => {
					if (dir === null) return;
					setName("");
					await addProject(trimmed, {
						dir,
						ratio,
						resolution
					});
					if (registerWorkspace !== void 0) try {
						await registerWorkspace(dir);
					} catch {}
				});
			};
			if (state.projects === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: t("common.loading")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.board,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.boardHead,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: StudioPanel_module_css_default.nameInput,
							"aria-label": t("board.projectName"),
							placeholder: t("board.projectName"),
							value: name,
							onChange: (event) => {
								setName(event.currentTarget.value);
							},
							onKeyDown: (event) => {
								if (event.key !== "Enter") return;
								create(name);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							"aria-label": t("board.ratio"),
							value: ratio,
							onChange: (event) => {
								setRatio(event.currentTarget.value);
							},
							children: RATIO_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option,
								children: option
							}, option))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							"aria-label": t("board.resolution"),
							value: resolution,
							onChange: (event) => {
								setResolution(event.currentTarget.value);
							},
							children: RESOLUTION_TIERS.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: tier,
								children: tier
							}, tier))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.primary,
							disabled: state.busy || name.trim() === "",
							onClick: () => {
								create(name);
							},
							children: t("board.newProject")
						})
					]
				}), state.projects.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.empty,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("board.empty.title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: StudioPanel_module_css_default.meta,
						children: t("board.empty.hint")
					})] })
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.cardGrid,
					children: state.projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectCard, {
						t,
						project,
						busy: state.busy,
						onOpen: () => {
							openProject(project.id);
						},
						onDelete: () => {
							removeProject(project.id);
						}
					}, project.id))
				})]
			});
		}
		/** 一张项目卡（可编辑默认画幅；删除要二次确认）。 */
		function ProjectCard(props) {
			const { t, project, busy, onOpen, onDelete } = props;
			const [editing, setEditing] = (0, react.useState)(false);
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [ratio, setRatio] = (0, react.useState)(project.defaultRatio);
			const [resolution, setResolution] = (0, react.useState)(project.defaultResolution);
			const begin = () => {
				setRatio(project.defaultRatio);
				setResolution(project.defaultResolution);
				setEditing(true);
			};
			const save = () => {
				saveProjectDefaults(project.id, {
					ratio,
					resolution
				});
				setEditing(false);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: project.missing ? `${StudioPanel_module_css_default.card} ${StudioPanel_module_css_default.cardMissing}` : StudioPanel_module_css_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: StudioPanel_module_css_default.cardCover,
						disabled: project.missing,
						"aria-label": `${t("board.openProject")} ${project.name}`,
						onClick: onOpen,
						children: project.coverAssetId === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: StudioPanel_module_css_default.meta,
							children: t("board.empty.title")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							src: assetUrl(project.id, project.coverAssetId),
							alt: "",
							loading: "lazy",
							decoding: "async"
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.cardBody,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								title: project.name,
								children: project.name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", {
								className: StudioPanel_module_css_default.meta,
								children: [
									t("board.clips", { count: project.clipCount }),
									" · ",
									t("board.episodes", { count: project.episodeCount }),
									" · ",
									formatSeconds(project.totalDuration),
									"s"
								]
							}),
							editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.cardEdit,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									"aria-label": t("board.ratio"),
									value: ratio,
									onChange: (event) => {
										setRatio(event.currentTarget.value);
									},
									children: RATIO_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: option,
										children: option
									}, option))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									"aria-label": t("board.resolution"),
									value: resolution,
									onChange: (event) => {
										setResolution(event.currentTarget.value);
									},
									children: RESOLUTION_TIERS.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: tier,
										children: tier
									}, tier))
								})]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: StudioPanel_module_css_default.meta,
								children: project.defaultResolution + " · " + project.defaultRatio
							}),
							project.missing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: StudioPanel_module_css_default.dangerText,
								children: t("board.missing")
							}),
							confirming && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: StudioPanel_module_css_default.dangerText,
								children: t("board.deleteHint")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.cardActions,
						children: editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.primary,
							disabled: busy,
							onClick: save,
							children: t("board.save")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							onClick: () => {
								setEditing(false);
							},
							children: t("board.cancel")
						})] }) : confirming ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.danger,
							disabled: busy,
							onClick: onDelete,
							children: t("board.confirmDelete")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.secondary,
							onClick: () => {
								setConfirming(false);
							},
							children: t("board.cancel")
						})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.secondary,
								disabled: project.missing,
								onClick: onOpen,
								children: t("board.open")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.secondary,
								disabled: busy,
								onClick: begin,
								children: t("board.edit")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.danger,
								disabled: busy,
								onClick: () => {
									setConfirming(true);
								},
								children: t("board.delete")
							})
						] })
					})
				]
			});
		}
		// src/client/lib/drop.ts
		/**
		* 从一次拖放事件里取素材 id。
		* @param event - 拖放事件。
		* @returns 素材 id，取不到为 null。
		*/
		function droppedAssetId(event) {
			const direct = event.dataTransfer.getData(ASSET_DRAG_MIME);
			if (direct !== "") return direct;
			const text = event.dataTransfer.getData("text/plain");
			return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(text) ? text : null;
		}
		/**
		* 一个落点的 props：阻止默认、落点高亮由调用方自己加。
		* @param onAsset - 拿到素材 id 后的动作。
		* @returns 可直接展开到元素上的 props。
		*/
		function assetDropTarget(onAsset) {
			return {
				onDragOver: (event) => {
					if (!event.dataTransfer.types.includes("application/x-ds-asset")) return;
					event.preventDefault();
					event.dataTransfer.dropEffect = "copy";
				},
				onDrop: (event) => {
					event.preventDefault();
					const assetId = droppedAssetId(event);
					if (assetId !== null) onAsset(assetId);
				}
			};
		}
		// src/client/components/Lightbox.tsx
		/**
		* 大图预览：双击缩略图弹出，Esc 或点背景关闭。
		*
		* 缩略图只有一两百像素，看不清服装纹理与构图细节，所以素材库和草稿区都接这一个。
		* @module dsh-dream-studio/components/Lightbox
		*/
		/** 渲染大图预览；`src` 为 null 时不渲染。 */
		function Lightbox({ src, alt, onClose }) {
			(0, react.useEffect)(() => {
				if (src === null) return void 0;
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("keydown", onKey);
				};
			}, [src, onClose]);
			if (src === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.lightbox,
				role: "dialog",
				"aria-modal": "true",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					className: StudioPanel_module_css_default.lightboxImage,
					src,
					alt: alt ?? "",
					onClick: (event) => {
						event.stopPropagation();
					}
				})
			});
		}
		// src/client/pages/fragments/Fragments.tsx
		/**
		* 时空碎片：左边是素材库，中间是**当前片段的草稿图**。
		*
		* 关键语义：生成的图不是素材，而是"这个片段的草稿"——先挂在片段上审阅，满意了再
		* 点「入库」变成素材（项目库/剧集库），最后从库里拖到首尾帧、关键帧或参考位。
		* @module dsh-dream-studio/pages/fragments/Fragments
		*/
		/** 槽认识的素材文件名：series 没写 `file` 时按 `id_名字.png` 兜底。 */
		function canonicalFile(asset) {
			return asset.file !== "" ? asset.file : `${asset.id}_${asset.name}.png`;
		}
		/**
		* 资产卡怎么认自己的实图。
		*
		* 草稿入库时名字是 `<规范名>-<时间戳>.png`（插件里与磁盘上都一样），所以除了
		* 全等，也认「规范名 + `-`」开头的：同一张资产重新出图会多一张，卡片取最新的。
		* @param file - 素材的显示名。
		* @param canonical - 资产清单里的规范文件名。
		* @returns 这张素材是不是该资产的实图。
		*/
		function sameAssetFile(file, canonical) {
			if (file === canonical) return true;
			const stem = canonical.replace(/\.[^.]+$/u, "");
			return stem !== "" && file.startsWith(`${stem}-`);
		}
		/**
		* 生图的默认值。
		*
		* 图生图只做「在已有图上改」，480P 足够验证构图，省时间也省显存；
		* 文生图要出素材，仍用 1080P。步数 10 是实测够用的档位（原来 20 步太慢）。
		* 故事板是四格拼板，单格只有整图四分之一大，用 720P 起步（四格各约 640×360）。
		* 比例不写死在这里：它跟在项目画幅后面（`projectDefaultRatio`）。
		*/
		const PICTURE_DEFAULTS = {
			t2iSize: 1080,
			i2iSize: 480,
			boardSize: 720,
			steps: 10
		};
		/**
		* 把存档里的尺寸 / 步数换成当前默认。
		*
		* 老存档（没有 `v`）里 360 是旧的图生图默认、20 是旧的步数默认；这两支一律
		* 迁移到新默认，其余值视为用户自己改过、原样保留。没有这一步，升级后
		* "步数默认 10"会被每条片段里存着的 20 顶掉，看起来像没改。
		* @param saved - 读出来的存档。
		* @returns 归一后的尺寸与步数（存档没写的字段为 undefined）。
		*/
		function migratePhotoDefaults(saved) {
			return {
				size: typeof saved.size === "number" && Number.isFinite(saved.size) ? saved.v === 2 || saved.size !== 360 ? saved.size : PICTURE_DEFAULTS.i2iSize : void 0,
				steps: typeof saved.steps === "number" && Number.isFinite(saved.steps) ? saved.v === 2 || saved.steps !== 20 ? saved.steps : PICTURE_DEFAULTS.steps : void 0
			};
		}
		/** 渲染时空碎片。 */
		function Fragments({ t }) {
			const state = useCell(episode, (value) => value);
			const selectedClipId = useCell(selectedClip, (value) => value);
			const scope = useCell(selectionScope, (value) => value);
			const [library, setLibrary] = (0, react.useState)("project");
			const [drafts, setDrafts] = (0, react.useState)([]);
			const [mode, setMode] = (0, react.useState)("t2i");
			const [tile, setTile] = (0, react.useState)(false);
			const [cfg, setCfg] = (0, react.useState)(1);
			const [steps, setSteps] = (0, react.useState)(PICTURE_DEFAULTS.steps);
			const [tileX, setTileX] = (0, react.useState)(2);
			const [tileY, setTileY] = (0, react.useState)(2);
			const [ratio, setRatio] = (0, react.useState)("16:9");
			const [size, setSize] = (0, react.useState)(PICTURE_DEFAULTS.t2iSize);
			const [prompt, setPrompt] = (0, react.useState)("");
			const [pictureRefs, setPictureRefs] = (0, react.useState)([]);
			const [activeSlot, setActiveSlot] = (0, react.useState)(null);
			const [assetTarget, setAssetTarget] = (0, react.useState)(null);
			const [episodeDrafts, setEpisodeDrafts] = (0, react.useState)([]);
			const episodeAssets = state.episodes.find((entry) => entry.id === state.episodeId)?.assets ?? [];
			const slotPending = (0, react.useRef)(null);
			const [slotDrafts, setSlotDrafts] = (0, react.useState)({});
			const [photoJobId, setPhotoJobId] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [confirmAsset, setConfirmAsset] = (0, react.useState)(null);
			const fileInput = (0, react.useRef)(null);
			const projectId = state.projectId;
			const episodeId = state.episodeId;
			const clip = state.clips.find((entry) => entry.id === selectedClipId) ?? state.clips[0] ?? null;
			const clipId = clip?.id ?? null;
			const all = useCell(assets, (list) => list);
			const projectDefaultRatio = useCell(projects, (value) => value.projects?.find((entry) => entry.id === state.projectId)?.defaultRatio ?? "16:9");
			const ratioPinned = (0, react.useRef)(false);
			const pictureProgress = useCell(jobs, (state) => state.pictures[clipId ?? ""]);
			const visible = (0, react.useMemo)(() => all.filter((asset) => library === "project" ? asset.library === "project" : asset.library === "episode"), [all, library]);
			/**
			* 本片段"待生成的参考图"：series 的 refImages 里点了名、但素材库还没有那张图。
			* 它们不进剧集库（那是"本集要画谁"的清单，变体不该单开一张卡），而是挂在片段自己的
			* 草稿区上方，点一下就把该资产的提示词灌进下面的生图面板，出完拖回参考位即可。
			*/
			const pendingRefs = (clip?.refs ?? []).filter((ref) => ref.kind === "image" && ref.assetId === null && ref.assetName.trim() !== "");
			(0, react.useEffect)(() => {
				ratioPinned.current = false;
				if (clipId === null) return;
				const raw = sessionStorage.getItem(`dream:photo:${clipId}`);
				if (raw === null) return;
				try {
					const saved = JSON.parse(raw);
					if (typeof saved.prompt === "string") setPrompt(saved.prompt);
					if (Array.isArray(saved.refs)) setPictureRefs(saved.refs);
					if (saved.mode === "t2i" || saved.mode === "i2i") setMode(saved.mode);
					if (typeof saved.ratio === "string" && saved.ratio !== "") setRatio(saved.ratio);
					if (saved.ratioPinned === true) ratioPinned.current = true;
					const migrated = migratePhotoDefaults(saved);
					if (migrated.size !== void 0) setSize(migrated.size);
					if (typeof saved.cfg === "number" && Number.isFinite(saved.cfg)) setCfg(saved.cfg);
					if (migrated.steps !== void 0) setSteps(migrated.steps);
					if (typeof saved.tile === "boolean") setTile(saved.tile);
					if (typeof saved.tileX === "number" && Number.isFinite(saved.tileX)) setTileX(Math.max(1, Math.round(saved.tileX)));
					if (typeof saved.tileY === "number" && Number.isFinite(saved.tileY)) setTileY(Math.max(1, Math.round(saved.tileY)));
				} catch {}
			}, [clipId]);
			(0, react.useEffect)(() => {
				if (!ratioPinned.current) setRatio(projectDefaultRatio);
			}, [projectDefaultRatio, clipId]);
			(0, react.useEffect)(() => {
				if (clipId === null) return;
				const timer = setTimeout(() => {
					try {
						sessionStorage.setItem(`dream:photo:${clipId}`, JSON.stringify({
							v: 2,
							prompt,
							refs: pictureRefs,
							mode,
							ratio,
							ratioPinned: ratioPinned.current,
							size,
							cfg,
							steps,
							tile,
							tileX,
							tileY
						}));
					} catch {}
				}, 300);
				return () => {
					clearTimeout(timer);
				};
			}, [
				clipId,
				mode,
				pictureRefs,
				prompt,
				ratio,
				size,
				cfg,
				steps,
				tile,
				tileX,
				tileY
			]);
			/** 读当前片段的草稿。 */
			const refreshDrafts = (0, react.useCallback)(async () => {
				if (projectId === null || clipId === null) {
					setDrafts([]);
					return;
				}
				try {
					const list = await listDrafts(projectId, clipId);
					if (!Array.isArray(list)) {
						setDrafts([]);
						return;
					}
					setDrafts(list);
					const pending = slotPending.current;
					const fresh = pending === null ? void 0 : list.find((entry) => !pending.before.has(entry.id));
					if (pending !== null && fresh !== void 0) {
						slotPending.current = null;
						setSlotDrafts((previous) => ({
							...previous,
							[pending.key]: fresh.id
						}));
						updateShell({ notice: "已生成，点卡片上的「入库」挂到这一格" });
					}
				} catch {
					setDrafts([]);
				}
			}, [projectId, clipId]);
			(0, react.useEffect)(() => {
				refreshDrafts();
			}, [refreshDrafts]);
			/** 读本集的剧集草稿（没有片段时唯一能挂图的地方）。 */
			const refreshEpisodeDrafts = (0, react.useCallback)(async () => {
				if (projectId === null || episodeId === null) {
					setEpisodeDrafts([]);
					return;
				}
				try {
					const list = await listEpisodeDrafts(projectId, episodeId);
					setEpisodeDrafts(Array.isArray(list) ? list : []);
				} catch {
					setEpisodeDrafts([]);
				}
			}, [projectId, episodeId]);
			(0, react.useEffect)(() => {
				refreshEpisodeDrafts();
			}, [refreshEpisodeDrafts]);
			const photoJob = useCell(jobs, (state) => photoJobId === null ? void 0 : state.list.find((entry) => entry.id === photoJobId));
			(0, react.useEffect)(() => {
				const status = photoJob?.status;
				if (status === void 0) return;
				if (status === "success" || status === "failed" || status === "cancelled") {
					setPhotoJobId(null);
					if (status === "failed") updateShell({ error: "图片任务失败：" + (photoJob?.error || "工作流没有返回原因") });
					refreshDrafts();
					refreshEpisodeDrafts();
				}
			}, [
				photoJob?.status,
				refreshDrafts,
				refreshEpisodeDrafts
			]);
			(0, react.useEffect)(() => onPictureDone((outcome) => {
				setPhotoJobId(null);
				if (outcome.status === "failed") updateShell({ error: "图片任务失败：" + (outcome.error ?? "工作流没有返回原因") });
				refreshDrafts();
				refreshEpisodeDrafts();
			}), [refreshDrafts, refreshEpisodeDrafts]);
			const refreshLibrary = (0, react.useCallback)(async () => {
				if (projectId === null) return;
				await loadAssets(projectId, episodeId ?? void 0);
			}, [projectId, episodeId]);
			const onPick = (0, react.useCallback)(async (files) => {
				if (projectId === null || files === null) return;
				setBusy(true);
				try {
					for (const file of Array.from(files)) await uploadAsset(projectId, file, {
						library,
						...episodeId === null ? {} : { episodeId },
						...library === "episode" ? { category: "generated" } : {}
					});
					await refreshLibrary();
					updateShell({ notice: `已导入 ${String(files.length)} 个文件` });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				} finally {
					setBusy(false);
				}
			}, [
				episodeId,
				library,
				projectId,
				refreshLibrary
			]);
			const onRename = (0, react.useCallback)(async (assetId, name) => {
				if (projectId === null) return;
				const next = name.trim();
				if (next === "") return;
				try {
					await renameAsset(projectId, assetId, next);
					await refreshLibrary();
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [projectId, refreshLibrary]);
			const onRemove = (0, react.useCallback)(async (assetId) => {
				if (projectId === null) return;
				try {
					await removeAsset(projectId, assetId, true);
					await refreshLibrary();
					updateShell({ notice: "已删除素材" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [projectId, refreshLibrary]);
			/** 生成一张草稿图：有片段就挂片段，一集还没有片段时挂在剧集上。 */
			const onGenerate = (0, react.useCallback)(async () => {
				if (projectId === null || clipId === null && episodeId === null) {
					updateShell({ error: "先从左栏选一集或一个片段" });
					return;
				}
				if (prompt.trim() === "") {
					updateShell({ error: "请先填写提示词" });
					return;
				}
				if (photoJobId !== null) {
					updateShell({ notice: "已有一张图在生成，等它跑完或取消后再点" });
					return;
				}
				jobs.set((previous) => ({
					...previous,
					pictures: {
						...previous.pictures,
						[clipId ?? ""]: {
							percent: 0,
							note: "排队中"
						}
					}
				}));
				setBusy(true);
				try {
					const input = {
						prompt: prompt.trim(),
						ratio,
						size,
						cfg,
						steps,
						...tile ? {
							tile: true,
							tileX,
							tileY
						} : {},
						...mode === "i2i" ? { reference: true } : {},
						...mode === "i2i" && pictureRefs.length > 0 ? { refImages: pictureRefs.length === 1 ? [String(pictureRefs[0] ?? ""), String(pictureRefs[0] ?? "")] : pictureRefs } : {}
					};
					if (clipId !== null) {
						if (activeSlot !== null) slotPending.current = {
							key: activeSlot,
							before: new Set(drafts.map((entry) => entry.id))
						};
						markPicturePending(clipId);
						const created = await generateDraft(projectId, clipId, input);
						setPhotoJobId(created.jobId);
						updateShell({ notice: "已排队生成草稿图" });
						setTimeout(() => {
							refreshDrafts();
						}, 3e3);
					} else {
						const created = await generateEpisodeDraft(projectId, episodeId ?? "", input);
						setPhotoJobId(created.jobId);
						updateShell({ notice: "已排队生成本集资产图" });
						setTimeout(() => {
							refreshEpisodeDrafts();
						}, 3e3);
					}
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				} finally {
					setBusy(false);
				}
			}, [
				clipId,
				episodeId,
				projectId,
				prompt,
				ratio,
				refreshDrafts,
				refreshEpisodeDrafts,
				size,
				tile,
				tileX,
				tileY,
				cfg,
				steps,
				mode,
				pictureRefs,
				activeSlot,
				drafts,
				photoJobId
			]);
			/**
			* 把某一槽的草稿入库并绑回该槽。
			* @param slotKey - 槽键。
			* @param draftId - 草稿 id。
			*/
			const adoptSlotDraft = (0, react.useCallback)(async (slotKey, draftId) => {
				if (projectId === null || clipId === null) return;
				try {
					const current = episode.get().clips.find((entry) => entry.id === clipId);
					const slot = current?.slots.find((entry) => entry.key === slotKey);
					const slotLabel = slotKey === "first" ? "首帧" : slotKey === "last" ? "尾帧" : `关键帧${String(slot?.n ?? "")}`;
					const stamp = localStamp();
					const seriesKey = current?.seriesKey ?? "clip";
					const asset = await adoptDraft(projectId, clipId, draftId, {
						library: "episode",
						...episodeId === null ? {} : { episodeId },
						name: `${seriesKey}-${slotLabel}-${stamp}.png`
					});
					applyPayload(slotKey === "first" ? await updateClip(projectId, clipId, { firstFrameAssetId: asset.id }) : slotKey === "last" ? await updateClip(projectId, clipId, { lastFrameAssetId: asset.id }) : await patchSlot(projectId, clipId, slotKey, { assetId: asset.id }));
					setSlotDrafts((previous) => {
						const next = { ...previous };
						delete next[slotKey];
						return next;
					});
					await loadAssets(projectId, episodeId ?? void 0);
					updateShell({ notice: "已入库并挂到这一格" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [
				projectId,
				clipId,
				episodeId
			]);
			const onAdopt = (0, react.useCallback)(async (draftId) => {
				const stampNow = localStamp();
				const draftName = `${episode.get().clips.find((entry) => entry.id === clipId)?.seriesKey ?? "clip"}-草稿-${stampNow}.png`;
				if (projectId === null || clipId === null) return;
				try {
					const adopted = await adoptDraft(projectId, clipId, draftId, {
						library,
						...library === "episode" && episodeId !== null ? { episodeId } : {},
						name: draftName
					});
					if (activeSlot !== null) {
						applyPayload(activeSlot === "first" ? await updateClip(projectId, clipId, { firstFrameAssetId: adopted.id }) : activeSlot === "last" ? await updateClip(projectId, clipId, { lastFrameAssetId: adopted.id }) : await patchSlot(projectId, clipId, activeSlot, { assetId: adopted.id }));
						setSlotDrafts((previous) => {
							const next = { ...previous };
							delete next[activeSlot];
							return next;
						});
						updateShell({ notice: "已入库并绑到当前槽" });
					} else updateShell({ notice: "已入库到素材库" });
					await refreshLibrary();
					updateShell({ notice: "已入库为素材" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [
				clipId,
				episodeId,
				library,
				projectId,
				refreshLibrary
			]);
			const onDeleteDraft = (0, react.useCallback)(async (draftId) => {
				if (projectId === null || clipId === null) return;
				try {
					await deleteDraft(projectId, clipId, draftId);
					await refreshDrafts();
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [
				clipId,
				projectId,
				refreshDrafts
			]);
			/**
			* 剧集草稿入库成「剧集库」素材。
			*
			* 名字 = 资产清单里的规范名 + 时间戳（`SC-02_西湖_v01-20261117140443.png`），
			* 插件里与磁盘上用的是同一个名字；资产卡靠 `sameAssetFile` 的前缀规则认它。
			* 没点资产卡时按时间戳命名，只当普通素材。
			* @param draftId - 剧集草稿 id。
			*/
			const adoptEpisodeAssetDraft = (0, react.useCallback)(async (draftId) => {
				if (projectId === null || episodeId === null) return;
				const stampNow = localStamp();
				const targetName = assetTarget === null ? `本集资产-${stampNow}.png` : `${canonicalFile({
					id: assetTarget.id,
					name: assetTarget.name,
					file: assetTarget.file
				}).replace(/\.[^.]+$/u, "")}-${stampNow}.png`;
				try {
					await adoptEpisodeDraft(projectId, episodeId, draftId, {
						name: targetName,
						...assetTarget === null ? {} : { assetId: assetTarget.id }
					});
					await loadAssets(projectId, episodeId);
					applyPayload(await readEpisode(projectId, episodeId));
					await refreshEpisodeDrafts();
					updateShell({ notice: assetTarget === null ? "已入库为剧集素材" : `已入库并关联为 ${assetTarget.id}` });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [
				assetTarget,
				episodeId,
				projectId,
				refreshEpisodeDrafts
			]);
			const onDeleteEpisodeDraft = (0, react.useCallback)(async (draftId) => {
				if (projectId === null || episodeId === null) return;
				try {
					await deleteEpisodeDraft(projectId, episodeId, draftId);
					await refreshEpisodeDrafts();
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [
				episodeId,
				projectId,
				refreshEpisodeDrafts
			]);
			const shownDrafts = clipId === null ? episodeDrafts : drafts;
			if (projectId === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: t("fragments.empty")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.fragmentsPage,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: StudioPanel_module_css_default.fragmentsLeft,
						"aria-label": t("shell.tab.fragments"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.promptTabs,
							role: "tablist",
							style: {
								flex: "0 0 auto",
								paddingBottom: 4,
								boxShadow: "inset 0 -1px 0 var(--ds-line)"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									role: "tab",
									"aria-selected": library === "project",
									className: library === "project" ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
									onClick: () => {
										setLibrary("project");
									},
									children: t("fragments.project")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									role: "tab",
									"aria-selected": library === "episode",
									className: library === "episode" ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
									onClick: () => {
										setLibrary("episode");
									},
									children: t("fragments.episode")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: StudioPanel_module_css_default.ghost,
									style: { marginLeft: "auto" },
									disabled: busy,
									onClick: () => {
										fileInput.current?.click();
									},
									children: t("fragments.import")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: fileInput,
									type: "file",
									multiple: true,
									accept: "image/*,video/*,audio/*",
									hidden: true,
									onChange: (event) => {
										onPick(event.currentTarget.files);
									}
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								flex: "1 1 auto",
								minHeight: 0,
								overflowY: "auto",
								overflowX: "hidden"
							},
							children: visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: StudioPanel_module_css_default.paneHint,
								children: t("fragments.emptyLibrary")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: StudioPanel_module_css_default.assetGrid,
								children: visible.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: StudioPanel_module_css_default.assetCard,
									draggable: true,
									onDragStart: (event) => {
										event.dataTransfer.setData(ASSET_DRAG_MIME, asset.id);
										event.dataTransfer.effectAllowed = "copy";
									},
									title: asset.name,
									children: [asset.type === "image" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: assetUrl(projectId, asset.id, asset.revision),
										alt: "",
										loading: "lazy",
										decoding: "async",
										className: StudioPanel_module_css_default.zoomable,
										onDoubleClick: () => {
											setPreview(assetUrl(projectId, asset.id, asset.revision));
										}
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StudioPanel_module_css_default.meta,
										children: asset.type
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: StudioPanel_module_css_default.assetFoot,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: StudioPanel_module_css_default.assetNameInput,
											"aria-label": t("fragments.rename"),
											defaultValue: asset.name,
											onClick: (event) => {
												event.stopPropagation();
											},
											onBlur: (event) => {
												onRename(asset.id, event.currentTarget.value);
											},
											onKeyDown: (event) => {
												if (event.key === "Enter") event.currentTarget.blur();
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: confirmAsset === asset.id ? `${StudioPanel_module_css_default.assetRemove} ${StudioPanel_module_css_default.assetRemoveConfirm}` : StudioPanel_module_css_default.assetRemove,
											"aria-label": `${t("inspector.remove")} ${asset.name}`,
											onClick: (event) => {
												event.stopPropagation();
												if (confirmAsset !== asset.id) {
													setConfirmAsset(asset.id);
													return;
												}
												setConfirmAsset(null);
												onRemove(asset.id);
											},
											children: confirmAsset === asset.id ? t("board.confirmDelete") : "×"
										})]
									})]
								}, asset.id))
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: StudioPanel_module_css_default.fragmentsMain,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: StudioPanel_module_css_default.paneHead,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.sectionTitle,
									children: clip === null ? episodeDrafts.length === 0 ? t("fragments.ready") : t("fragments.episodeDrafts", { count: episodeDrafts.length }) : `${clip.seriesKey} · ${t("fragments.drafts", { count: drafts.length })}`
								})
							}),
							scope === "episode" && episodeAssets.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: StudioPanel_module_css_default.resultGrid,
								children: episodeAssets.filter((asset) => !asset.id.includes("@")).map((asset) => {
									const canonicalName = canonicalFile(asset);
									const preview = [...all].reverse().find((entry) => sameAssetFile(entry.name, canonicalName));
									const kindLabel = asset.kind === "scene" ? "场景" : asset.kind === "prop" ? "道具" : "人物";
									const pick = () => {
										setAssetTarget({
											id: asset.id,
											name: asset.name,
											kind: asset.kind,
											desc: asset.desc,
											file: asset.file ?? ""
										});
										setActiveSlot(null);
										setMode("t2i");
										setPictureRefs([]);
										setPrompt(asset.prompt !== "" ? asset.prompt : (asset.kind === "character" ? "人物三视图：" : "") + (asset.desc || asset.name) + (asset.kind === "character" ? "；3D半写实古风CG质感，高清细节，纯白干净背景，一图四格（头肩特写 + 正面/侧面/背面全身），无文字无水印" : "；无文字无水印"));
									};
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
										className: StudioPanel_module_css_default.resultCard,
										onClick: pick,
										style: { cursor: "pointer" },
										...assetDropTarget((assetId) => {
											if (projectId === null) return;
											const canonical = canonicalFile(asset);
											renameAsset(projectId, assetId, canonical).then(async () => {
												await loadAssets(projectId, episodeId ?? void 0);
												applyPayload(await readEpisode(projectId, episodeId ?? void 0));
												updateShell({ notice: "已关联为 " + asset.id + "：" + canonical });
											}).catch((thrown) => {
												updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
											});
										}),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											title: asset.desc || asset.name,
											style: {
												width: "100%",
												aspectRatio: "var(--studio-ratio, 16 / 9)",
												borderRadius: "var(--ds-radius-s)",
												background: "var(--ds-bg)",
												border: assetTarget?.id === asset.id ? "1px solid var(--ds-primary)" : "1px dashed var(--ds-line)",
												display: "grid",
												placeItems: "center",
												fontSize: 11,
												color: "var(--ds-text-2)",
												overflow: "hidden"
											},
											children: preview !== void 0 && projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												src: assetUrl(projectId, preview.id, preview.revision),
												alt: "",
												loading: "lazy",
												style: {
													width: "100%",
													height: "100%",
													objectFit: "cover"
												}
											}, `${preview.id}-${String(preview.revision)}`) : "待生成"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
											className: StudioPanel_module_css_default.resultMeta,
											title: asset.desc,
											children: [
												asset.name,
												" · ",
												kindLabel,
												" · ",
												asset.status
											]
										})]
									}, asset.id);
								})
							}),
							scope === "clip" && clip !== null && clip.slots.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: StudioPanel_module_css_default.resultGrid,
								children: clip.slots.map((slot) => {
									const label = slot.role === "first" ? t("inspector.firstFrame") : slot.role === "last" ? t("inspector.lastFrame") : slot.role === "board" ? "故事板" : t("inspector.keyframes") + String(slot.n ?? "");
									const anchor = slot.atSeconds === null ? "" : " · " + String(slot.atSeconds) + "s";
									const previewId = slot.role === "first" ? clip.firstFrameAssetId : slot.role === "last" ? clip.lastFrameAssetId : slot.assetId;
									const draftId = slotDrafts[slot.key];
									const previewSrc = draftId !== void 0 && clipId !== null ? draftUrl(projectId, clipId, draftId) : previewId !== null && projectId !== null ? assetUrl(projectId, previewId, slot.revision ?? 0) : null;
									const pick = () => {
										setActiveSlot(slot.key);
										setPrompt(slot.prompt);
										const ids = slot.imageRefs.map((name) => all.find((asset) => asset.name === name)?.id).filter((id) => id !== void 0);
										setPictureRefs(ids);
										setMode(ids.length > 0 ? "i2i" : "t2i");
										if (slot.role === "board") {
											setRatio("16:9");
											setSize(PICTURE_DEFAULTS.boardSize);
										} else setSize(ids.length > 0 ? PICTURE_DEFAULTS.i2iSize : PICTURE_DEFAULTS.t2iSize);
									};
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
										className: StudioPanel_module_css_default.resultCard,
										onClick: pick,
										style: { cursor: "pointer" },
										...assetDropTarget((assetId) => {
											if (projectId === null || clipId === null) return;
											(slot.role === "first" ? updateClip(projectId, clipId, { firstFrameAssetId: assetId }) : slot.role === "last" ? updateClip(projectId, clipId, { lastFrameAssetId: assetId }) : patchSlot(projectId, clipId, slot.key, { assetId })).then((payload) => {
												applyPayload(payload);
												updateShell({ notice: "已把这张图绑到这一格" });
											}).catch((thrown) => {
												updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
											});
										}),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												title: slot.prompt,
												style: {
													width: "100%",
													aspectRatio: "var(--studio-ratio, 16 / 9)",
													borderRadius: "var(--ds-radius-s)",
													background: "var(--ds-bg)",
													border: activeSlot === slot.key ? "1px solid var(--ds-primary)" : "1px dashed var(--ds-line)",
													display: "grid",
													placeItems: "center",
													fontSize: 11,
													color: "var(--ds-text-2)",
													overflow: "hidden"
												},
												children: previewSrc !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
													src: previewSrc,
													alt: "",
													loading: "lazy",
													style: {
														width: "100%",
														height: "100%",
														objectFit: "cover"
													},
													onError: (event) => {
														event.currentTarget.style.display = "none";
													}
												}) : t("fragments.noDrafts").slice(0, 2)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
												className: StudioPanel_module_css_default.resultMeta,
												title: slot.prompt,
												children: [
													label,
													anchor,
													previewSrc === null ? " · 待生成" : draftId === void 0 ? "" : " · 待入库"
												]
											}),
											draftId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: StudioPanel_module_css_default.resultActions,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: StudioPanel_module_css_default.secondary,
													onClick: (event) => {
														event.stopPropagation();
														adoptSlotDraft(slot.key, draftId);
													},
													children: t("fragments.adopt")
												})
											})
										]
									}, slot.key);
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.fragmentsScroll,
								children: [scope === "clip" && pendingRefs.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: StudioPanel_module_css_default.resultGrid,
									style: { marginBottom: 12 },
									children: pendingRefs.map((ref) => {
										const target = episodeAssets.find((asset) => canonicalFile(asset) === ref.assetName);
										const label = target?.name ?? ref.assetName;
										const baseId = target !== void 0 && target.id.includes("@") ? target.id.split("@")[0] : "";
										const baseAsset = baseId === "" ? void 0 : episodeAssets.find((asset) => asset.id === baseId);
										const basePicture = baseAsset === void 0 ? void 0 : all.find((asset) => asset.name === canonicalFile(baseAsset));
										const usePrompt = () => {
											setPrompt(target?.prompt !== void 0 && target.prompt !== "" ? target.prompt : target?.desc ?? ref.assetName);
											setActiveSlot(null);
											if (basePicture !== void 0) {
												setMode("i2i");
												setPictureRefs([basePicture.id]);
												setRatio("4:3");
												setSize(PICTURE_DEFAULTS.i2iSize);
											} else {
												setMode("t2i");
												setPictureRefs([]);
											}
										};
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
											className: StudioPanel_module_css_default.resultCard,
											onClick: usePrompt,
											style: { cursor: "pointer" },
											title: target?.desc ?? ref.assetName,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													width: "100%",
													aspectRatio: "var(--studio-ratio, 16 / 9)",
													borderRadius: "var(--ds-radius-s)",
													background: "var(--ds-bg)",
													border: "1px dashed var(--ds-line)",
													display: "grid",
													placeItems: "center",
													color: "var(--ds-muted)",
													fontSize: 12,
													gap: 4
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fragments.pendingRef") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: { color: "var(--ds-text)" },
													children: label
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("figcaption", {
												className: StudioPanel_module_css_default.resultMeta,
												children: ref.assetName
											})]
										}, `pending-${String(ref.position)}`);
									})
								}), shownDrafts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: StudioPanel_module_css_default.paneHint,
									children: clip === null ? t("fragments.readyHint") : t("fragments.noDrafts")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: StudioPanel_module_css_default.resultGrid,
									children: shownDrafts.map((draft) => {
										const src = clipId === null ? episodeDraftUrl(projectId, episodeId ?? "", draft.id) : draftUrl(projectId, clipId, draft.id);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
											className: StudioPanel_module_css_default.resultCard,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
													src,
													alt: "",
													loading: "lazy",
													decoding: "async",
													className: StudioPanel_module_css_default.draftImage,
													title: t("fragments.useDraftPrompt"),
													onClick: () => {
														setPrompt(draft.prompt);
													},
													onDoubleClick: () => {
														setPreview(src);
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("figcaption", {
													className: StudioPanel_module_css_default.resultMeta,
													title: draft.prompt,
													children: draft.prompt
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: StudioPanel_module_css_default.resultActions,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: StudioPanel_module_css_default.secondary,
														onClick: () => {
															clipId === null ? adoptEpisodeAssetDraft(draft.id) : onAdopt(draft.id);
														},
														children: t("fragments.adopt")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: StudioPanel_module_css_default.linkish,
														onClick: () => {
															clipId === null ? onDeleteEpisodeDraft(draft.id) : onDeleteDraft(draft.id);
														},
														children: t("inspector.remove")
													})]
												})
											]
										}, draft.id);
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.pictureBar,
								children: [
									mode === "i2i" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: StudioPanel_module_css_default.pictureRefs,
										children: [pictureRefs.map((assetId) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: StudioPanel_module_css_default.pictureRefCard,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												src: assetUrl(projectId, assetId, 0),
												alt: "",
												loading: "lazy"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: StudioPanel_module_css_default.pictureRefRemove,
												"aria-label": t("inspector.remove"),
												onClick: () => {
													setPictureRefs((current) => current.filter((entry) => entry !== assetId));
												},
												children: "×"
											})]
										}, assetId)), pictureRefs.length < 4 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: StudioPanel_module_css_default.pictureRefAdd,
											onDragOver: (event) => {
												if (!event.dataTransfer.types.includes("application/x-ds-asset")) return;
												event.preventDefault();
												event.dataTransfer.dropEffect = "copy";
											},
											onDrop: (event) => {
												event.preventDefault();
												const assetId = event.dataTransfer.getData("application/x-ds-asset");
												if (assetId === "") return;
												setPictureRefs((current) => current.includes(assetId) || current.length >= 4 ? current : [...current, assetId]);
											},
											children: t("fragments.dropRef")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: StudioPanel_module_css_default.pictureRow,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: StudioPanel_module_css_default.modeSwitch,
												role: "group",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: mode === "t2i" ? `${StudioPanel_module_css_default.modeButton} ${StudioPanel_module_css_default.modeOn}` : StudioPanel_module_css_default.modeButton,
													onClick: () => {
														setMode("t2i");
														setSize(PICTURE_DEFAULTS.t2iSize);
													},
													children: t("fragments.t2i")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: mode === "i2i" ? `${StudioPanel_module_css_default.modeButton} ${StudioPanel_module_css_default.modeOn}` : StudioPanel_module_css_default.modeButton,
													onClick: () => {
														setMode("i2i");
														setSize(PICTURE_DEFAULTS.i2iSize);
													},
													children: t("fragments.i2i")
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												"aria-label": t("fragments.size"),
												value: String(size),
												onChange: (event) => {
													setSize(Number(event.currentTarget.value));
												},
												children: PICTURE_TIERS.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: String(tier),
													children: pictureTierLabel(tier, ratio)
												}, tier))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												"aria-label": t("inspector.ratio"),
												value: ratio,
												onChange: (event) => {
													ratioPinned.current = true;
													setRatio(event.currentTarget.value);
												},
												children: RATIO_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: option,
													children: option
												}, option))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: StudioPanel_module_css_default.check,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: tile,
													onChange: (event) => {
														setTile(event.currentTarget.checked);
													}
												}), t("fragments.tile")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: StudioPanel_module_css_default.check,
												children: [t("fragments.cfg"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "number",
													min: 0,
													max: 30,
													step: .5,
													value: cfg,
													style: { width: 56 },
													onChange: (event) => {
														setCfg(Number(event.currentTarget.value));
													}
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: StudioPanel_module_css_default.check,
												children: [t("fragments.steps"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "number",
													min: 1,
													max: 150,
													step: 1,
													value: steps,
													style: { width: 56 },
													onChange: (event) => {
														setSteps(Number(event.currentTarget.value));
													}
												})]
											}),
											tile && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: StudioPanel_module_css_default.check,
												children: [t("fragments.tileX"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "number",
													min: 1,
													max: 12,
													step: 1,
													value: tileX,
													style: { width: 48 },
													onChange: (event) => {
														setTileX(Math.max(1, Math.round(Number(event.currentTarget.value) || 1)));
													}
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: StudioPanel_module_css_default.check,
												children: [t("fragments.tileY"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "number",
													min: 1,
													max: 12,
													step: 1,
													value: tileY,
													style: { width: 48 },
													onChange: (event) => {
														setTileY(Math.max(1, Math.round(Number(event.currentTarget.value) || 1)));
													}
												})]
											})] })
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: StudioPanel_module_css_default.promptArea,
										"aria-label": t("fragments.prompt"),
										rows: 4,
										placeholder: t("fragments.promptHint"),
										value: prompt,
										onChange: (event) => {
											setPrompt(event.currentTarget.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: StudioPanel_module_css_default.pictureRow,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: StudioPanel_module_css_default.primary,
												disabled: busy || clipId === null && episodeId === null || photoJobId !== null,
												onClick: () => {
													onGenerate();
												},
												children: t("fragments.generate")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: StudioPanel_module_css_default.danger,
												disabled: photoJobId === null,
												onClick: () => {
													if (projectId !== null && episodeId !== null && photoJobId !== null) {
														cancel$1(projectId, episodeId, photoJobId);
														setPhotoJobId(null);
													}
												},
												children: t("inspector.cancel")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: StudioPanel_module_css_default.genProgress,
												role: "progressbar",
												"aria-valuenow": pictureProgress?.percent ?? 0,
												"aria-valuemin": 0,
												"aria-valuemax": 100,
												children: photoJobId !== null && (pictureProgress?.percent === null || pictureProgress?.percent === void 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: StudioPanel_module_css_default.genProgressLoading }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: StudioPanel_module_css_default.genProgressFill,
													style: { width: `${String(Math.min(pictureProgress?.percent ?? 0, 99))}%` }
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
												className: StudioPanel_module_css_default.genPercent,
												children: photoJobId !== null && (pictureProgress?.percent === null || pictureProgress?.percent === void 0) ? "0%" : `${String(pictureProgress === void 0 ? 0 : Math.min(pictureProgress.percent ?? 0, 99))}%`
											})
										]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Lightbox, {
						src: preview,
						onClose: () => {
							setPreview(null);
						}
					})
				]
			});
		}
		// src/client/pages/script/Script.tsx
		/**
		* 时空剧本：整页一个大文本域，读 / 写当前剧集的 `第NN集.md`，以及项目级的
		* `01_大纲.md`（漫剧大纲）和 `00_人物档案.md`（人物档案）。
		*
		* 左栏选哪一集就作用于哪一集；编辑 700ms 后自动保存，不给"保存"按钮。
		* 换集、换文档或离开页签前会把没保存的内容补写掉，避免丢字。
		* @module dsh-dream-studio/pages/script/Script
		*/
		/** 渲染剧本页。 */
		function Script({ t }) {
			const projectId = useCell(episode, (value) => value.projectId);
			const episodeId = useCell(episode, (value) => value.episodeId);
			const [doc, setDoc] = (0, react.useState)("script");
			const docs = [
				{
					id: "script",
					label: t("script.doc.script")
				},
				{
					id: "outline",
					label: t("script.doc.outline")
				},
				{
					id: "characters",
					label: t("script.doc.characters")
				}
			];
			const [text, setText] = (0, react.useState)("");
			const [name, setName] = (0, react.useState)("");
			const [state, setState] = (0, react.useState)("idle");
			const [error, setError] = (0, react.useState)(null);
			/** 有未保存的改动。 */
			const dirty = (0, react.useRef)(false);
			/** 最近一次待保存的内容（换集/换文档/卸载时补写它）。 */
			const pending = (0, react.useRef)(null);
			/** 已经加载完的 `项目:剧集:文档`；没对上说明还在读，别把空文本写回去。 */
			const loadedKey = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (projectId === null || episodeId === null) return;
				const previous = pending.current;
				if (previous !== null && dirty.current) saveEpisodeScript(previous.projectId, previous.episodeId, previous.text, previous.doc);
				dirty.current = false;
				pending.current = null;
				loadedKey.current = null;
				let live = true;
				setState("idle");
				setError(null);
				readEpisodeScript(projectId, episodeId, doc).then((result) => {
					if (!live) return;
					setText(result.text);
					setName(result.name);
					loadedKey.current = `${projectId}:${episodeId}:${doc}`;
				}).catch((thrown) => {
					if (!live) return;
					setState("error");
					setError(thrown instanceof Error ? thrown.message : String(thrown));
				});
				return () => {
					live = false;
				};
			}, [
				projectId,
				episodeId,
				doc
			]);
			(0, react.useEffect)(() => {
				if (projectId === null || episodeId === null) return;
				if (loadedKey.current !== `${projectId}:${episodeId}:${doc}`) return;
				if (!dirty.current) return;
				const job = {
					projectId,
					episodeId,
					doc,
					text
				};
				pending.current = job;
				setState("saving");
				const timer = setTimeout(() => {
					saveEpisodeScript(job.projectId, job.episodeId, job.text, job.doc).then(() => {
						if (pending.current !== job) return;
						dirty.current = false;
						pending.current = null;
						setState("saved");
						setError(null);
					}).catch((thrown) => {
						setState("error");
						setError(thrown instanceof Error ? thrown.message : String(thrown));
					});
				}, 700);
				return () => {
					clearTimeout(timer);
				};
			}, [
				text,
				projectId,
				episodeId,
				doc
			]);
			(0, react.useEffect)(() => () => {
				const job = pending.current;
				if (job !== null && dirty.current) saveEpisodeScript(job.projectId, job.episodeId, job.text, job.doc);
			}, []);
			if (projectId === null || episodeId === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("script.noEpisode") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.meta,
					children: t("script.noEpisodeHint")
				})] })
			});
			const status = state === "saving" ? t("script.saving") : state === "saved" ? t("script.saved") : state === "error" ? error ?? t("script.saveFailed") : t("script.autoSave");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.scriptPage,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.scriptBar,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StudioPanel_module_css_default.scriptDocs,
							role: "tablist",
							children: docs.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								role: "tab",
								"aria-selected": doc === entry.id,
								className: doc === entry.id ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
								onClick: () => {
									setDoc(entry.id);
								},
								children: entry.label
							}, entry.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: StudioPanel_module_css_default.scriptName,
							children: name === "" ? t("script.loading") : name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
							className: state === "error" ? `${StudioPanel_module_css_default.scriptStatus} ${StudioPanel_module_css_default.scriptStatusError}` : StudioPanel_module_css_default.scriptStatus,
							children: status
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					className: StudioPanel_module_css_default.scriptArea,
					"aria-label": t("shell.tab.script"),
					value: text,
					spellCheck: false,
					placeholder: t("script.placeholder"),
					onChange: (event) => {
						dirty.current = true;
						setText(event.currentTarget.value);
					}
				})]
			});
		}
		// src/client/pages/VideoHistory.tsx
		/**
		* 成片历史弹框：列出这一段生成过的所有视频，可启用其中一版或删除记录。
		*
		* 双击片段轨卡片打开。启用后右栏的成片卡与「独立二采 / 放大 / 补帧」都会跟着换到这一版。
		* @module dsh-dream-studio/pages/VideoHistory
		*/
		/** 把记录里的 kind 翻成短标签。 */
		function kindLabel(t, kind) {
			if (kind === "second") return t("video.kind.second");
			if (kind === "upscale") return t("video.kind.upscale");
			if (kind === "interp") return t("video.kind.interp");
			return t("video.kind.first");
		}
		/** 渲染成片历史弹框。 */
		function VideoHistory({ clip, t, onClose }) {
			const projectId = useCell(episode, (state) => state.projectId);
			const [rows, setRows] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (projectId === null) return;
				let live = true;
				listClipVideos(projectId, clip.id).then((list) => {
					if (live) setRows(list);
				}).catch((thrown) => {
					if (live) setError(thrown instanceof Error ? thrown.message : String(thrown));
				});
				return () => {
					live = false;
				};
			}, [projectId, clip.id]);
			const run = (action) => {
				if (projectId === null) return;
				setBusy(true);
				setError(null);
				action().then(async () => {
					const list = await listClipVideos(projectId, clip.id);
					setRows(list);
				}).catch((thrown) => {
					setError(thrown instanceof Error ? thrown.message : String(thrown));
				}).finally(() => {
					setBusy(false);
				});
			};
			const theme = {
				background: "#ffffff",
				color: "#1a1d21",
				borderColor: "rgba(0,0,0,0.16)"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.modalBackdrop,
				role: "presentation",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.videoModal,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("video.title"),
					"data-scheme": "light",
					style: {
						background: theme.background,
						color: theme.color,
						borderColor: theme.borderColor
					},
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: StudioPanel_module_css_default.modalHead,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									style: { color: theme.color },
									children: t("video.title")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: StudioPanel_module_css_default.meta,
									style: { color: "#4a5058" },
									children: `${String(rows?.length ?? 0)} ${t("video.count")}`
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: StudioPanel_module_css_default.ghost,
									style: { color: "#4a5058" },
									onClick: onClose,
									children: t("common.close")
								})
							]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.messageError,
							children: error
						}),
						rows === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.meta,
							style: { color: "#4a5058" },
							children: t("video.loading")
						}) : rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.meta,
							style: { color: "#4a5058" },
							children: t("video.empty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: StudioPanel_module_css_default.videoList,
							children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: row.active ? `${StudioPanel_module_css_default.videoRow} ${StudioPanel_module_css_default.videoRowOn}` : StudioPanel_module_css_default.videoRow,
								style: {
									background: "rgba(0,0,0,0.045)",
									borderColor: row.active ? "#1a9c62" : theme.borderColor,
									color: theme.color
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StudioPanel_module_css_default.videoKind,
										style: { color: theme.color },
										children: kindLabel(t, row.kind)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StudioPanel_module_css_default.videoLabel,
										style: { color: "#4a5058" },
										children: row.label === "" ? "—" : row.label
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
										className: StudioPanel_module_css_default.videoTime,
										style: { color: "#6b7280" },
										children: formatDateTime(row.createdAt)
									}),
									row.active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StudioPanel_module_css_default.videoActive,
										style: {
											color: "#1a9c62",
											fontWeight: 600
										},
										children: t("video.active")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: StudioPanel_module_css_default.rowButton,
										style: { color: theme.color },
										disabled: busy || projectId === null,
										onClick: () => {
											if (projectId === null) return;
											run(() => activateClipVideo(projectId, clip.id, row.id).then(applyPayload));
										},
										children: t("video.activate")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: StudioPanel_module_css_default.rowButton,
										style: { color: theme.color },
										disabled: busy || projectId === null,
										onClick: () => {
											if (projectId === null) return;
											run(() => deleteClipVideo(projectId, clip.id, row.id).then(applyPayload));
										},
										children: t("inspector.remove")
									})
								]
							}, row.id))
						}),
						clip.resultVideoPath !== null && projectId !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
							className: StudioPanel_module_css_default.videoPreview,
							src: clipResultUrl(projectId, clip.id, clipVideoVersion(clip)),
							controls: true,
							playsInline: true
						}, clip.resultVideoPath)
					]
				})
			});
		}
		// src/client/pages/Content.tsx
		/**
		* 中栏：三个页签的内容。
		*
		* 造梦页的片段轨按旧插件的做法重建：卡片宽度严格等于 `时长 × 每秒像素`、卡片之间
		* 没有间隙（它们本身就是时间轴）、上方一条标尺、游标可拖、播完自动接下一段。
		* @module dsh-dream-studio/pages/Content
		*/
		/** 生成耗时：秒数或 "1m 05s"。 */
		function elapsedOf(ms) {
			const total = Math.round(ms / 1e3);
			if (total < 60) return `${String(total)}s`;
			return `${String(Math.floor(total / 60))}m ${String(total % 60).padStart(2, "0")}s`;
		}
		/** 每秒多少像素（与旧插件同一档，可缩放）。 */
		const PX_PER_SECOND = 40;
		/** 标尺候选步长，从细到粗（旧插件同一套）。 */
		const TICK_STEPS = [
			1,
			2,
			5,
			10,
			30,
			60
		];
		/** 两个刻度标签之间至少留多少像素。 */
		const MIN_TICK_SPACING = 44;
		/**
		* 当前缩放下该用多粗的刻度。
		* @param pxPerSecond - 每秒像素。
		* @returns 步长（秒）。
		*/
		function tickStepOf(pxPerSecond) {
			for (const step of TICK_STEPS) if (step * pxPerSecond >= MIN_TICK_SPACING) return step;
			return TICK_STEPS[TICK_STEPS.length - 1] ?? 60;
		}
		/** 渲染当前页签。 */
		function Content({ t }) {
			const tab = useCell(shell, (value) => value.tab);
			if (tab === "script") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Script, { t });
			if (tab === "fragments") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fragments, { t });
			if (tab === "studio") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Studio, { t });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chat, { t });
		}
		/** 对话页：M6 接入 shell 会话，这里先说明。 */
		function Chat({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("chat.empty") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.meta,
					children: t("chat.newChat")
				})] })
			});
		}
		/** 造梦页：舞台（播放器）+ 片段轨。 */
		function Studio({ t }) {
			const state = useCell(episode, (value) => value);
			const selected = useCell(selectedClip, (value) => value);
			const [scrub, setScrub] = (0, react.useState)(null);
			const [dragging, setDragging] = (0, react.useState)(false);
			/** 双击卡片打开的历史弹框：记录片段 id。 */
			const [historyClipId, setHistoryClipId] = (0, react.useState)(null);
			const [autoAdvance, setAutoAdvance] = (0, react.useState)(false);
			const live = useCell(jobs, (value) => value.progress);
			const stage = (0, react.useRef)(null);
			const strip = (0, react.useRef)(null);
			const timelineRef = (0, react.useRef)(null);
			const clip = state.clips.find((entry) => entry.id === selected) ?? null;
			const starts = [];
			let total = 0;
			for (const entry of state.clips) {
				starts.push(total);
				total += entry.duration;
			}
			const index = Math.max(0, state.clips.findIndex((entry) => entry.id === selected));
			const step = tickStepOf(PX_PER_SECOND);
			const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, at) => at * step);
			/** 轨道横坐标 → 秒。 */
			const secondAt = (clientX) => {
				const element = strip.current;
				if (element === null) return 0;
				const raw = (clientX - element.getBoundingClientRect().left + element.scrollLeft) / PX_PER_SECOND;
				return Math.max(0, Math.min(total, raw));
			};
			/** 把指针位置换算成「第几段 + 段内秒数」，选中并 seek。 */
			const seekTo = (clientX) => {
				const seconds = secondAt(clientX);
				setScrub(seconds);
				let target = state.clips.length - 1;
				for (let cursor = 0; cursor < state.clips.length; cursor += 1) if (seconds <= (starts[cursor] ?? 0) + (state.clips[cursor]?.duration ?? 0)) {
					target = cursor;
					break;
				}
				const targetClip = state.clips[target];
				if (targetClip === void 0) return;
				if (targetClip.id !== selected) selectClip(targetClip.id);
				const element = stage.current;
				const within = seconds - (starts[target] ?? 0);
				if (element !== null && Number.isFinite(element.duration) && element.duration > 0) element.currentTime = Math.min(element.duration, Math.max(0, within));
			};
			(0, react.useEffect)(() => {
				const element = timelineRef.current;
				if (element === null) return void 0;
				const onWheel = (event) => {
					if (event.shiftKey || event.ctrlKey) return;
					if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
					event.preventDefault();
					element.scrollLeft += event.deltaY;
				};
				element.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					element.removeEventListener("wheel", onWheel);
				};
			}, []);
			(0, react.useEffect)(() => {
				if (!dragging) return void 0;
				const follow = (event) => {
					seekTo(event.clientX);
				};
				const drop = () => {
					setDragging(false);
				};
				window.addEventListener("pointermove", follow);
				window.addEventListener("pointerup", drop);
				return () => {
					window.removeEventListener("pointermove", follow);
					window.removeEventListener("pointerup", drop);
				};
			});
			const cursorSecond = scrub ?? starts[index] ?? 0;
			if (state.clips.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: t("studio.empty")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: clip?.resultVideoPath === null || clip === null ? StudioPanel_module_css_default.stage : `${StudioPanel_module_css_default.stage} ${StudioPanel_module_css_default.stageFilled}`,
					children: clip !== null && clip.resultVideoPath !== null && state.projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
						ref: stage,
						src: clipResultUrl(state.projectId, clip.id, clipVideoVersion(clip)),
						controls: true,
						playsInline: true,
						preload: "metadata",
						onTimeUpdate: (event) => {
							if (dragging) return;
							setScrub((starts[index] ?? 0) + event.currentTarget.currentTime);
						},
						onEnded: () => {
							const next = state.clips[index + 1];
							if (next === void 0) return;
							setAutoAdvance(true);
							selectClip(next.id);
							setScrub(starts[index + 1] ?? 0);
						},
						onLoadedMetadata: (event) => {
							if (!autoAdvance) return;
							setAutoAdvance(false);
							event.currentTarget.play();
						}
					}, clip.id) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: clip === null ? t("studio.empty") : t("studio.noVideo") })
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.timeline,
					ref: timelineRef,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.ruler,
						onPointerDown: (event) => {
							seekTo(event.clientX);
							setDragging(true);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StudioPanel_module_css_default.rulerTrack,
							style: { width: total * PX_PER_SECOND },
							children: ticks.map((second) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.rulerTick,
								style: { width: step * PX_PER_SECOND },
								children: `${String(second)}s`
							}, second))
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.lane,
						ref: strip,
						onPointerDown: (event) => {
							if (event.target instanceof HTMLElement && event.target.closest("button") !== null) return;
							seekTo(event.clientX);
							setDragging(true);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.clipStrip,
							style: { width: total * PX_PER_SECOND },
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.playhead,
								style: { left: cursorSecond * PX_PER_SECOND },
								"aria-hidden": true
							}), state.clips.map((entry, at) => {
								const lamp = lampOf(entry);
								const film = entry.resultVideoPath !== null && state.projectId !== null ? clipResultUrl(state.projectId, entry.id, clipVideoVersion(entry)) : null;
								const posterId = entry.firstFrameAssetId ?? entry.refs.find((ref) => ref.kind === "image" && ref.assetId !== null)?.assetId ?? null;
								const still = posterId !== null && state.projectId !== null ? assetUrl(state.projectId, posterId, 0) : null;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: entry.id === selected ? `${StudioPanel_module_css_default.clipCard} ${StudioPanel_module_css_default.clipCardOn}` : StudioPanel_module_css_default.clipCard,
									style: { width: entry.duration * PX_PER_SECOND },
									onClick: (event) => {
										event.stopPropagation();
										selectClip(entry.id);
										setScrub(starts[at] ?? 0);
									},
									onDoubleClick: (event) => {
										event.stopPropagation();
										setHistoryClipId(entry.id);
									},
									title: entry.prompt,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: StudioPanel_module_css_default.clipCover,
											children: film !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
												src: `${film}#t=0.1`,
												muted: true,
												preload: "metadata",
												playsInline: true
											}) : still !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												src: still,
												alt: "",
												loading: "lazy"
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: StudioPanel_module_css_default.meta,
												children: String(at + 1)
											})
										}),
										entry.videoCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: StudioPanel_module_css_default.clipVideoCount,
											title: t("video.title"),
											children: String(entry.videoCount)
										}),
										entry.status === "queued" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${StudioPanel_module_css_default.clipBadge} ${StudioPanel_module_css_default.clipBadgeQueued}`,
											children: t("studio.queued")
										}),
										entry.status === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${StudioPanel_module_css_default.clipBadge} ${StudioPanel_module_css_default.clipBadgeRunning}`,
											children: live[entry.id]?.percent === null || live[entry.id]?.percent === void 0 ? "0%" : `${String(live[entry.id]?.percent)}%`
										}),
										entry.status === "failed" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${StudioPanel_module_css_default.clipBadge} ${StudioPanel_module_css_default.clipBadgeFailed}`,
											children: t("inspector.failed")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: StudioPanel_module_css_default.clipCardBody,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: StudioPanel_module_css_default.clipCardTitle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: entry.seriesKey === "" ? t("tree.clip", { index: at + 1 }) : entry.seriesKey }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: StudioPanel_module_css_default.clipCardMode,
													children: entry.mode === "frames" ? t("inspector.mode") : t("inspector.modeReference")
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
												entry.duration.toFixed(1),
												"s",
												entry.generationMs === null ? "" : ` · ${elapsedOf(entry.generationMs)}`
											] })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: lamp === "ready" ? StudioPanel_module_css_default.clipLampReady : lamp === "busy" ? StudioPanel_module_css_default.clipLampBusy : lamp === "failed" ? StudioPanel_module_css_default.clipLampFailed : StudioPanel_module_css_default.clipLamp }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: StudioPanel_module_css_default.clipProgress,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: StudioPanel_module_css_default.clipProgressFill,
												style: {
													width: `${String(live[entry.id]?.percent ?? (entry.status === "success" || entry.status === "failed" ? 100 : 0))}%`,
													background: live[entry.id]?.percent !== void 0 && live[entry.id]?.percent !== null ? "var(--ds-primary)" : entry.status === "success" ? "var(--ds-success)" : entry.status === "failed" ? "var(--ds-danger)" : "var(--ds-primary)"
												}
											})
										})
									]
								}, entry.id);
							})]
						})
					})]
				}),
				(() => {
					const historyClip = historyClipId === null ? null : state.clips.find((clip) => clip.id === historyClipId) ?? null;
					return historyClip === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VideoHistory, {
						clip: historyClip,
						t,
						onClose: () => {
							setHistoryClipId(null);
						}
					});
				})()
			] });
		}
		// src/client/pages/conversation/Conversation.tsx
		/** 渲染对话页。 */
		function Conversation({ t, sessions, reference, sessionId, busy, onCreate, onSelect, renderSlot, SessionProvider }) {
			if (sessionId === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("chat.empty") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: StudioPanel_module_css_default.meta,
						children: t("chat.emptyHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: StudioPanel_module_css_default.primary,
						disabled: busy,
						onClick: onCreate,
						children: t("chat.newChat")
					})
				] })
			});
			const supported = SessionProvider !== void 0 && renderSlot !== void 0;
			const listed = sessions.find((row) => row.id === sessionId);
			const rows = listed === void 0 ? [{
				id: sessionId,
				title: t("chat.newSession"),
				cwd: ""
			}, ...sessions] : sessions;
			const body = !supported ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("chat.unsupported") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.meta,
					children: listed?.title ?? ""
				})] })
			}) : reference === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("chat.preparing") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.meta,
					children: listed?.title ?? ""
				})] })
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.chatPane,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionProvider, {
					session: reference,
					children: renderSlot("dream-studio.embedded.chat", { sessionId })
				}, sessionId)
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.chatBar,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
					className: StudioPanel_module_css_default.chatSelect,
					"aria-label": t("chat.sessions"),
					value: sessionId,
					onChange: (event) => {
						onSelect(event.currentTarget.value);
					},
					children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: row.id,
						children: row.title
					}, row.id))
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: StudioPanel_module_css_default.chatNew,
					disabled: busy,
					onClick: onCreate,
					children: ["+ ", t("chat.newSession")]
				})]
			}), body] });
		}
		// src/client/columns/episodes/EpisodesTree.tsx
		/**
		* 左栏：剧集 → 片段两层树。
		*
		* 设计图只有两层（剧集 / 片段），旧插件那棵"剧集 → 故事段 → 片段"的三层树在
		* 新项目里被压平：故事段的信息留在 `seriesKey` 里（`S01-C01`）。
		* @module dsh-dream-studio/columns/episodes/EpisodesTree
		*/
		/** 渲染剧集树。 */
		function EpisodesTree({ t }) {
			const state = useCell(episode, (value) => value);
			const selected = useCell(selectedClip, (value) => value);
			const [openMap, setOpenMap] = (0, react.useState)({});
			const [clipsByEpisode, setClipsByEpisode] = (0, react.useState)({});
			const [loadingIds, setLoadingIds] = (0, react.useState)({});
			const ensureClips = (episodeId) => {
				const projectId = state.projectId;
				if (projectId === null || episodeId === state.episodeId) return;
				if (clipsByEpisode[episodeId] !== void 0 || loadingIds[episodeId] === true) return;
				setLoadingIds((previous) => ({
					...previous,
					[episodeId]: true
				}));
				readEpisode(projectId, episodeId).then((payload) => {
					setClipsByEpisode((previous) => ({
						...previous,
						[episodeId]: payload.clips
					}));
				}).catch(() => {
					setClipsByEpisode((previous) => ({
						...previous,
						[episodeId]: []
					}));
				}).finally(() => {
					setLoadingIds((previous) => ({
						...previous,
						[episodeId]: false
					}));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.episodeTree,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.treeHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("shell.episodes") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						className: StudioPanel_module_css_default.meta,
						children: String(state.episodes.length)
					})]
				}), state.episodes.map((entry) => {
					const active = entry.id === state.episodeId;
					const open = openMap[entry.id] ?? active;
					const list = active ? state.clips : clipsByEpisode[entry.id] ?? [];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.treeGroup,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							className: active ? `${StudioPanel_module_css_default.treeRow} ${StudioPanel_module_css_default.treeRowOn}` : StudioPanel_module_css_default.treeRow,
							"aria-expanded": open,
							onClick: () => {
								selectionScope.set("episode");
								if (!active) openEpisode(entry.id);
								setOpenMap((previous) => ({
									...previous,
									[entry.id]: !open
								}));
								if (!open) ensureClips(entry.id);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: StudioPanel_module_css_default.lamp }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.treeLabel,
									title: entry.name,
									children: entry.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: StudioPanel_module_css_default.meta,
									children: String(entry.clipCount)
								})
							]
						}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.treeClips,
							children: [list.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: StudioPanel_module_css_default.treeEmpty,
								children: t("tree.noClips")
							}), list.map((clip) => {
								const lamp = lampOf(clip);
								const isSelected = clip.id === selected;
								const label = clip.seriesKey === "" ? t("tree.clip", { index: clip.order + 1 }) : clip.seriesKey;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `${StudioPanel_module_css_default.treeRow} ${StudioPanel_module_css_default.treeClip} ${isSelected ? StudioPanel_module_css_default.treeRowOn : ""}`,
									onClick: () => {
										selectionScope.set("clip");
										selectClip(clip.id);
									},
									title: clip.prompt,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${StudioPanel_module_css_default.lamp} ${lamp === "ready" ? StudioPanel_module_css_default.lampReady : lamp === "busy" ? StudioPanel_module_css_default.lampBusy : lamp === "failed" ? StudioPanel_module_css_default.lampFailed : ""}` }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: StudioPanel_module_css_default.treeLabel,
											children: label
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: StudioPanel_module_css_default.meta,
											children: `${clip.duration.toFixed(1)}s`
										}),
										clip.slots.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: StudioPanel_module_css_default.badge,
											children: String(clip.slots.length)
										})
									]
								}, clip.id);
							})]
						})]
					}, entry.id);
				})]
			});
		}
		// src/client/components/AssetLibrary.tsx
		/**
		* 素材库侧栏：项目库 / 剧集库两个页签、导入、改名、删除，卡片可拖到右栏槽位。
		*
		* 碎片页与造梦页共用这一个组件：前者是"生成草稿"的工作台，后者只需要一个能拖的
		* 素材抽屉——两边看到的必须是同一批素材，所以只写一份。
		* @module dsh-dream-studio/components/AssetLibrary
		*/
		/** 渲染素材库。 */
		function AssetLibrary({ t }) {
			const projectId = useCell(episode, (state) => state.projectId);
			const episodeId = useCell(episode, (state) => state.episodeId);
			const all = useCell(assets, (list) => list);
			const [library, setLibrary] = (0, react.useState)("project");
			const [busy, setBusy] = (0, react.useState)(false);
			const [confirmId, setConfirmId] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const fileInput = (0, react.useRef)(null);
			const visible = (0, react.useMemo)(() => all.filter((asset) => library === "project" ? asset.library === "project" : asset.library === "episode"), [all, library]);
			const refresh = (0, react.useCallback)(async () => {
				if (projectId === null) return;
				await loadAssets(projectId, episodeId ?? void 0);
			}, [projectId, episodeId]);
			const onPick = (0, react.useCallback)(async (files) => {
				if (projectId === null || files === null) return;
				setBusy(true);
				try {
					for (const file of Array.from(files)) await uploadAsset(projectId, file, {
						library,
						...episodeId === null ? {} : { episodeId },
						...library === "episode" ? { category: "generated" } : {}
					});
					await refresh();
					updateShell({ notice: `已导入 ${String(files.length)} 个文件` });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				} finally {
					setBusy(false);
				}
			}, [
				episodeId,
				library,
				projectId,
				refresh
			]);
			const onRename = (0, react.useCallback)(async (assetId, name) => {
				if (projectId === null) return;
				const next = name.trim();
				if (next === "") return;
				try {
					await renameAsset(projectId, assetId, next);
					await refresh();
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [projectId, refresh]);
			const onRemove = (0, react.useCallback)(async (assetId) => {
				if (projectId === null) return;
				try {
					await removeAsset(projectId, assetId, true);
					await refresh();
					updateShell({ notice: "已删除素材" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			}, [projectId, refresh]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.library,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.promptTabs,
						role: "tablist",
						style: {
							flex: "0 0 auto",
							paddingBottom: 4,
							boxShadow: "inset 0 -1px 0 var(--ds-line)"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								role: "tab",
								"aria-selected": library === "project",
								className: library === "project" ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
								onClick: () => {
									setLibrary("project");
								},
								children: t("fragments.project")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								role: "tab",
								"aria-selected": library === "episode",
								className: library === "episode" ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
								onClick: () => {
									setLibrary("episode");
								},
								children: t("fragments.episode")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.ghost,
								disabled: busy,
								onClick: () => {
									fileInput.current?.click();
								},
								children: t("fragments.import")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: fileInput,
								type: "file",
								multiple: true,
								accept: "image/*,video/*,audio/*",
								hidden: true,
								onChange: (event) => {
									onPick(event.currentTarget.files);
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.libraryScroll,
						children: visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: StudioPanel_module_css_default.paneHint,
							children: t("fragments.emptyLibrary")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StudioPanel_module_css_default.assetGrid,
							children: visible.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.assetCard,
								draggable: true,
								onDragStart: (event) => {
									event.dataTransfer.setData(ASSET_DRAG_MIME, asset.id);
									event.dataTransfer.effectAllowed = "copy";
								},
								title: asset.name,
								children: [asset.type === "image" && projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: assetUrl(projectId, asset.id, asset.revision),
									alt: "",
									loading: "lazy",
									decoding: "async",
									className: StudioPanel_module_css_default.zoomable,
									onDoubleClick: () => {
										setPreview(assetUrl(projectId, asset.id, asset.revision));
									}
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.meta,
									children: asset.type
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: StudioPanel_module_css_default.assetFoot,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: StudioPanel_module_css_default.assetNameInput,
										"aria-label": t("fragments.rename"),
										defaultValue: asset.name,
										onClick: (event) => {
											event.stopPropagation();
										},
										onBlur: (event) => {
											onRename(asset.id, event.currentTarget.value);
										},
										onKeyDown: (event) => {
											if (event.key === "Enter") event.currentTarget.blur();
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: confirmId === asset.id ? `${StudioPanel_module_css_default.assetRemove} ${StudioPanel_module_css_default.assetRemoveConfirm}` : StudioPanel_module_css_default.assetRemove,
										"aria-label": `${t("inspector.remove")} ${asset.name}`,
										title: confirmId === asset.id ? t("board.confirmDelete") : t("inspector.remove"),
										onClick: (event) => {
											event.stopPropagation();
											if (confirmId !== asset.id) {
												setConfirmId(asset.id);
												return;
											}
											setConfirmId(null);
											onRemove(asset.id);
										},
										children: confirmId === asset.id ? t("board.confirmDelete") : "×"
									})]
								})]
							}, asset.id))
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Lightbox, {
						src: preview,
						onClose: () => {
							setPreview(null);
						}
					})
				]
			});
		}
		// src/client/state/studio.ts
		/** 空草稿。 */
		const EMPTY = {
			clipId: null,
			mode: "reference",
			firstFrameAssetId: null,
			lastFrameAssetId: null,
			duration: 5,
			continueFromPrev: false,
			secondPass: false,
			firstPassTiled: false,
			secondPassTiled: false,
			resolution: null,
			ratio: null,
			steps: "4",
			secondSteps: "4",
			secondScale: null,
			secondDenoise: "0.35",
			loras: [],
			prompt: "",
			promptEn: "",
			dirty: false
		};
		/** 草稿单元格。 */
		const draft = createCell(EMPTY);
		/** 视频后处理参数单元格：默认 2K、10 倍补帧。 */
		const postProcess = createCell({
			level: "2k",
			multiplier: 10
		});
		/**
		* 改视频后处理参数。
		* @param patch - 要改的字段。
		*/
		function editPostProcess(patch) {
			postProcess.set((current) => ({
				...current,
				...patch
			}));
		}
		/** 防抖计时器。 */
		let timer = null;
		/**
		* 由片段造一份草稿。
		* @param clip - 片段。
		* @returns 草稿。
		*/
		function draftOf(clip) {
			return {
				clipId: clip.id,
				mode: clip.mode,
				firstFrameAssetId: clip.firstFrameAssetId,
				lastFrameAssetId: clip.lastFrameAssetId,
				duration: clip.duration,
				continueFromPrev: clip.continueFromPrev,
				secondPass: clip.secondPass,
				firstPassTiled: clip.firstPassTiled,
				secondPassTiled: clip.secondPassTiled,
				resolution: clip.resolution,
				ratio: clip.ratio,
				steps: clip.firstPassSteps === null ? "4" : String(clip.firstPassSteps),
				secondSteps: clip.secondSteps === null ? "4" : String(clip.secondSteps),
				secondScale: clip.secondScale,
				secondDenoise: clip.secondDenoise === null ? "0.35" : String(clip.secondDenoise),
				loras: clip.loras,
				prompt: clip.prompt,
				promptEn: clip.promptEn,
				dirty: false
			};
		}
		/**
		* 换片段：先把旧草稿写掉，再载入新的。
		* @param clip - 新选中的片段。
		*/
		function loadDraft(clip) {
			if (clip === null) {
				cancel();
				draft.set(EMPTY);
				return;
			}
			if (draft.get().clipId === clip.id) return;
			flushNow();
			cancel();
			draft.set(draftOf(clip));
		}
		/**
		* 改草稿字段并安排一次写库。
		* @param patch - 要改的字段。
		* @param immediate - 选择类控件立即写。
		*/
		function editDraft(patch, immediate = false) {
			draft.set((previous) => ({
				...previous,
				...patch,
				dirty: true
			}));
			if (immediate) flushNow();
			else schedule();
		}
		/** 安排一次防抖写。 */
		function schedule() {
			cancel();
			timer = setTimeout(() => {
				flushNow();
			}, 400);
		}
		/** 取消待写的防抖。 */
		function cancel() {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		}
		/**
		* 把草稿与库里的片段比对，算出要提交的字段。
		* @param clip - 库里的片段。
		* @param value - 草稿。
		* @returns 变更；没有差异为空对象。
		*/
		function diffOf(clip, value) {
			const input = {};
			if (value.mode !== clip.mode) input.mode = value.mode;
			if (value.firstFrameAssetId !== clip.firstFrameAssetId) input.firstFrameAssetId = value.firstFrameAssetId;
			if (value.lastFrameAssetId !== clip.lastFrameAssetId) input.lastFrameAssetId = value.lastFrameAssetId;
			if (Math.abs(value.duration - clip.duration) > .001) input.duration = value.duration;
			if (value.continueFromPrev !== clip.continueFromPrev) input.continueFromPrev = value.continueFromPrev;
			if (value.secondPass !== clip.secondPass) input.secondPass = value.secondPass;
			if (value.firstPassTiled !== clip.firstPassTiled) input.firstPassTiled = value.firstPassTiled;
			if (value.secondPassTiled !== clip.secondPassTiled) input.secondPassTiled = value.secondPassTiled;
			if (value.resolution !== clip.resolution) input.resolution = value.resolution;
			if (value.ratio !== clip.ratio) input.ratio = value.ratio;
			const steps = value.steps.trim() === "" ? null : Number(value.steps);
			if ((steps ?? 4) !== (clip.firstPassSteps ?? 4) && (steps === null || Number.isInteger(steps))) input.firstPassSteps = steps;
			const secondSteps = value.secondSteps.trim() === "" ? null : Number(value.secondSteps);
			if ((secondSteps ?? 4) !== (clip.secondSteps ?? 4) && (secondSteps === null || Number.isInteger(secondSteps))) input.secondSteps = secondSteps;
			if (value.secondScale !== clip.secondScale) input.secondScale = value.secondScale;
			const denoise = Number(value.secondDenoise);
			if (Number.isFinite(denoise) && Math.abs(denoise - (clip.secondDenoise ?? .35)) > 1e-4) input.secondDenoise = denoise;
			if (value.prompt !== clip.prompt) input.prompt = value.prompt;
			if (value.promptEn !== clip.promptEn) input.promptEn = value.promptEn;
			if (JSON.stringify(value.loras) !== JSON.stringify(clip.loras)) input.loras = value.loras;
			return input;
		}
		/** 立刻把草稿写回库。 */
		async function flushNow() {
			cancel();
			const value = draft.get();
			if (value.clipId === null || !value.dirty) return;
			const state = episode.get();
			const clip = state.clips.find((entry) => entry.id === value.clipId);
			if (clip === void 0) return;
			const input = diffOf(clip, value);
			if (Object.keys(input).length === 0) {
				draft.set((previous) => ({
					...previous,
					dirty: false
				}));
				return;
			}
			try {
				const payload = await updateClip(state.projectId ?? "", clip.id, input);
				draft.set((previous) => ({
					...previous,
					dirty: false
				}));
				applyPayload(payload);
			} catch (thrown) {
				updateShell({ error: thrown instanceof HttpError || thrown instanceof Error ? thrown.message : String(thrown) });
			}
		}
		/**
		* 切模式。两张图的字段与参考位各自独立，所以只改模式，不清任何数据。
		* @param mode - 目标模式。
		*/
		function setMode(mode) {
			editDraft({ mode }, true);
		}
		/**
		* 写 LoRA 列表。
		* @param loras - 新列表。
		*/
		function setLoras(loras) {
			editDraft({ loras }, true);
		}
		/** 清空草稿（面板卸载时用）。 */
		function disposeDraft() {
			cancel();
			draft.set(EMPTY);
		}
		// src/client/columns/inspector/FrameSlots.tsx
		/**
		* 右栏：首尾帧两张卡（只有图，没有下拉；清除在右下角，可拖入）。
		*
		* 手册原型里首尾帧就是两个预览框：空着显示"首帧/尾帧"，拖素材进来就绑上，
		* 绑上后右下角出现一个小 × 用来清掉。不再给下拉——选择走碎片页拖放。
		* @module dsh-dream-studio/columns/inspector/FrameSlots
		*/
		/** 渲染首帧/尾帧两张卡。 */
		function FrameSlots({ t }) {
			const value = useCell(draft, (current) => current);
			const all = useCell(assets, (list) => list);
			const images = (0, react.useMemo)(() => all.filter((asset) => asset.type === "image"), [all]);
			const projectId = useCell(episode, (state) => state.projectId);
			const rows = [{
				key: "firstFrameAssetId",
				label: t("inspector.firstFrame"),
				id: value.firstFrameAssetId
			}, {
				key: "lastFrameAssetId",
				label: t("inspector.lastFrame"),
				id: value.lastFrameAssetId
			}];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.frameGrid,
				children: rows.map((row) => {
					const chosen = row.id === null ? void 0 : images.find((asset) => asset.id === row.id);
					const drop = assetDropTarget((assetId) => {
						editDraft({ [row.key]: assetId }, true);
					});
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.frameCard,
						...drop,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.frameThumb,
							title: chosen?.name ?? row.label,
							children: [chosen !== void 0 && projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								src: assetUrl(projectId, chosen.id, chosen.revision),
								alt: chosen.name,
								loading: "lazy"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: StudioPanel_module_css_default.frameEmpty,
								children: row.label
							}), row.id !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.frameClear,
								"aria-label": `${t("inspector.clear")} ${row.label}`,
								title: t("inspector.clear"),
								onClick: (event) => {
									event.stopPropagation();
									editDraft({ [row.key]: null }, true);
								},
								children: "×"
							})]
						})
					}, row.key);
				})
			});
		}
		// src/client/columns/inspector/KeyframeSlots.tsx
		/**
		* 右栏：关键帧槽（横条卡，照图三）。
		*
		* 每张卡是一个横向矩形：上半是缩略图，左下角是插入点秒数输入，右下角是 × 删除整张卡；
		* 卡上方一行小字「关键帧 N」，标题行右侧一个「添加」用于新增。
		* @module dsh-dream-studio/columns/inspector/KeyframeSlots
		*/
		/** 一格关键帧。 */
		function KeyframeCell({ t, clip, slot, projectId }) {
			const [anchor, setAnchor] = (0, react.useState)(slot.atSeconds === null ? "" : String(slot.atSeconds));
			(0, react.useEffect)(() => {
				setAnchor(slot.atSeconds === null ? "" : String(slot.atSeconds));
			}, [
				slot.atSeconds,
				clip.id,
				slot.key
			]);
			const fail = (thrown) => {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			};
			const drop = assetDropTarget((assetId) => {
				if (projectId === null) return;
				patchSlot(projectId, clip.id, slot.key, { assetId }).then((payload) => {
					applyPayload(payload);
					updateShell({ notice: t("inspector.keyframeDropped") });
				}).catch(fail);
			});
			const commitAnchor = () => {
				if (projectId === null) return;
				const seconds = anchor.trim() === "" ? null : Number(anchor);
				if (seconds !== null && !Number.isFinite(seconds)) return;
				if (seconds === slot.atSeconds) return;
				patchSlot(projectId, clip.id, slot.key, { atSeconds: seconds }).then(applyPayload).catch(fail);
			};
			const dropSlot = () => {
				if (projectId === null) return;
				removeSlot(projectId, clip.id, slot.key).then(applyPayload).catch(fail);
			};
			const filled = slot.assetId !== null || slot.keyframeId !== null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.keyframeItem,
				...drop,
				title: slot.prompt,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: StudioPanel_module_css_default.keyframeTitle,
					children: `${t("inspector.keyframes")}${String(slot.n ?? "")}`
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: filled ? `${StudioPanel_module_css_default.keyframeBox} ${StudioPanel_module_css_default.keyframeBoxFilled}` : StudioPanel_module_css_default.keyframeBox,
					children: [
						slot.assetId !== null && projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: StudioPanel_module_css_default.keyframeThumb,
							src: assetUrl(projectId, slot.assetId, slot.revision ?? 0),
							alt: "",
							loading: "lazy"
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: StudioPanel_module_css_default.keyframeAnchorInput,
							"aria-label": `${t("inspector.keyframes")}${String(slot.n ?? "")} ${t("inspector.anchor")}`,
							value: anchor,
							placeholder: "s",
							onChange: (event) => {
								setAnchor(event.currentTarget.value);
							},
							onBlur: commitAnchor,
							onKeyDown: (event) => {
								if (event.key === "Enter") event.currentTarget.blur();
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.keyframeClear,
							"aria-label": t("inspector.remove"),
							onClick: (event) => {
								event.stopPropagation();
								dropSlot();
							},
							children: "×"
						})
					]
				})]
			});
		}
		/** 渲染关键帧槽。 */
		function KeyframeSlots({ t, clip }) {
			const projectId = useCell(episode, (state) => state.projectId);
			const slots = clip.slots.filter((slot) => slot.role === "keyframe").slice().sort((left, right) => (left.n ?? 0) - (right.n ?? 0));
			const add = () => {
				if (projectId === null) return;
				addSlot(projectId, clip.id).then((result) => {
					applyPayload(result.payload);
				}).catch((thrown) => {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.section,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: StudioPanel_module_css_default.sectionTitle,
						children: t("inspector.keyframes")
					}), slots.length < 8 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: StudioPanel_module_css_default.linkish,
						"aria-label": t("inspector.addKeyframe"),
						onClick: add,
						children: t("inspector.add")
					})]
				}), slots.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.paneHint,
					children: t("inspector.noKeyframe")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.keyframeStrip,
					children: slots.map((slot) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KeyframeCell, {
						t,
						clip,
						slot,
						projectId
					}, `${clip.id}-${slot.key}`))
				})]
			});
		}
		// src/client/columns/inspector/Params.tsx
		/**
		* 右栏：时长、续写、二采、画布、步数、倍率、重绘与 LoRA。
		*
		* 约束（手册 5.7.4）：时长 1–20 步长 0.5；步数正整数或空；重绘 0.01–1；
		* 二采三项在二采关闭时禁用。数值输入走防抖，"选择类"立刻写。
		* @module dsh-dream-studio/columns/inspector/Params
		*/
		/** H3 的时长网格：17n+5 帧，只取 4s~15s 之间的档位（n = 6..21）。 */
		const DURATION_GRID = Array.from({ length: 16 }, (_, index) => 17 * (index + 6) + 5);
		/** 渲染参数区。 */
		/**
		* 网格里第 index 档对应的秒数。
		* @param index - 档位（0 = 22 帧）。
		* @returns 秒。
		*/
		function durationAt(index) {
			const frames = DURATION_GRID[Math.max(0, Math.min(DURATION_GRID.length - 1, index))] ?? 107;
			return Math.round(frames / 24 * 100) / 100;
		}
		/**
		* 把任意秒数吸附到 17n+5 网格。
		* @param seconds - 想要的秒数。
		* @returns 最近一档的秒数。
		*/
		function snapDuration(seconds) {
			const frames = Math.round(seconds * 24);
			const n = Math.max(6, Math.min(21, Math.round((frames - 5) / 17)));
			return Math.round((17 * n + 5) / 24 * 100) / 100;
		}
		function Params({ t }) {
			const value = useCell(draft, (current) => current);
			const post = useCell(postProcess, (current) => current);
			const projectId = useCell(episode, (state) => state.projectId);
			const projectDefaults = useCell(projects, (state) => state.projects?.find((entry) => entry.id === projectId));
			const projectRatio = projectDefaults?.defaultRatio ?? "16:9";
			const projectResolution = projectDefaults?.defaultResolution ?? "1080P";
			const [loraOptions, setLoraOptions] = (0, react.useState)(null);
			const [pending, setPending] = (0, react.useState)(null);
			const openPicker = async () => {
				if (loraOptions !== null) {
					setPending({
						name: "",
						strength: "1"
					});
					return;
				}
				const servers$1 = servers.get();
				const server = servers$1.find((entry) => entry.available) ?? servers$1[0];
				if (server === void 0) {
					updateShell({ error: "先在设置里配置一条 ComfyUI 服务，才能列出 LoRA" });
					return;
				}
				try {
					const files = (await listModels(server.id, "loras")).flatMap((folder) => folder.files).filter((name) => /\.(?:safetensors|pt|ckpt|bin)$/iu.test(name));
					setLoraOptions(files);
					setPending({
						name: "",
						strength: "1"
					});
					if (files.length === 0) updateShell({ notice: "这个 ComfyUI 的 loras 文件夹是空的" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				}
			};
			const fps = 24;
			const durationIndex = Math.max(0, DURATION_GRID.findIndex((frames) => Math.abs(frames / fps - value.duration) < 17 / fps / 2));
			/** 首尾帧模式下不给独立二采：首帧会糊、关键帧点会飘。 */
			const framesMode = value.mode === "frames";
			/**
			* 独立二采读的是**一采写下的 latent**：这段没跑过一采（没有成片）就没有 latent，
			* 点了只会等到 ComfyUI 报"找不到 latent 存档"。这里跟服务端同一条判据先禁掉。
			*/
			const hasFirstPass = useCell(episode, (state) => {
				const clip = state.clips.find((entry) => entry.id === value.clipId);
				return clip !== void 0 && clip.resultVideoPath !== null;
			});
			/** 正在生成（排队/跑着）：这时点后处理只会拿回同一个 jobId，给一句说明。 */
			const generating = useCell(episode, (state) => {
				const clip = state.clips.find((entry) => entry.id === value.clipId);
				return clip !== void 0 && (clip.status === "queued" || clip.status === "running");
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: StudioPanel_module_css_default.sectionTitle,
							children: t("inspector.duration")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.durationRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "range",
								min: "0",
								max: String(DURATION_GRID.length - 1),
								step: "1",
								"aria-label": t("inspector.duration"),
								value: String(durationIndex),
								onChange: (event) => {
									editDraft({ duration: durationAt(Number(event.currentTarget.value)) });
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: String(durationAt(0).toFixed(2)),
								max: String(durationAt(DURATION_GRID.length - 1).toFixed(2)),
								step: String(17 / fps),
								value: Number(value.duration.toFixed(2)),
								onChange: (event) => {
									const next = Number(event.currentTarget.value);
									if (Number.isFinite(next)) editDraft({ duration: snapDuration(next) });
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
							className: StudioPanel_module_css_default.meta,
							children: t("inspector.durationGrid", {
								frames: String(Math.round(value.duration * fps)),
								fps: String(fps)
							})
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.section,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.checkRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: StudioPanel_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: value.continueFromPrev,
									onChange: (event) => {
										editDraft({ continueFromPrev: event.currentTarget.checked }, true);
									}
								}), t("inspector.continuation")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: StudioPanel_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: value.secondPass,
									onChange: (event) => {
										editDraft({ secondPass: event.currentTarget.checked }, true);
									}
								}), t("inspector.secondPass")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: StudioPanel_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: value.firstPassTiled,
									onChange: (event) => {
										editDraft({ firstPassTiled: event.currentTarget.checked }, true);
									}
								}), t("inspector.firstPassTiled")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: StudioPanel_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: value.secondPassTiled,
									onChange: (event) => {
										editDraft({ secondPassTiled: event.currentTarget.checked }, true);
									}
								}), t("inspector.secondPassTiled")]
							})
						]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.section,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.resolution") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								"aria-label": t("inspector.resolution"),
								value: value.resolution ?? "",
								onChange: (event) => {
									editDraft({ resolution: event.currentTarget.value === "" ? null : event.currentTarget.value }, true);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: "",
									children: [
										t("inspector.follow"),
										" · ",
										projectResolution
									]
								}), RESOLUTION_TIERS.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: tier,
									children: tier
								}, tier))]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.ratio") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								"aria-label": t("inspector.ratio"),
								value: value.ratio ?? "",
								onChange: (event) => {
									editDraft({ ratio: event.currentTarget.value === "" ? null : event.currentTarget.value }, true);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: "",
									children: [
										t("inspector.follow"),
										" · ",
										projectRatio
									]
								}), RATIO_OPTIONS.map((ratio) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: ratio,
									children: ratio
								}, ratio))]
							})]
						})]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.section,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.steps") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: "1",
								step: "1",
								value: value.steps,
								onChange: (event) => {
									editDraft({ steps: event.currentTarget.value.replace(/[^\d]/gu, "") });
								}
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.secondSteps") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: "1",
								step: "1",
								value: value.secondSteps,
								onChange: (event) => {
									editDraft({ secondSteps: event.currentTarget.value.replace(/[^\d]/gu, "") });
								}
							})]
						})]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.fieldRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.secondScale") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									"aria-label": t("inspector.secondScale"),
									value: String(Math.max(1, value.secondScale ?? 1)),
									onChange: (event) => {
										editDraft({ secondScale: Number(event.currentTarget.value) }, true);
									},
									children: [.../* @__PURE__ */ new Set([Math.max(1, value.secondScale ?? 1), ...SECOND_FACTOR_OPTIONS])].sort((left, right) => left - right).map((factor) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: String(factor),
										children: `${String(factor)} MP`
									}, factor))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.secondDenoise") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0.01",
									max: "1",
									step: "0.01",
									"aria-label": t("inspector.secondDenoise"),
									value: value.secondDenoise,
									onChange: (event) => {
										const next = event.currentTarget.value;
										if (next === "" || Number(next) > 0 && Number(next) <= 1) editDraft({ secondDenoise: next });
									}
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: StudioPanel_module_css_default.sectionDivider }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.fieldRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.videoUpscale") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									"aria-label": t("inspector.videoUpscale"),
									value: post.level,
									onChange: (event) => {
										editPostProcess({ level: event.currentTarget.value === "4k" ? "4k" : "2k" });
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "2k",
										children: "2K"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "4k",
										children: "4K"
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: `${StudioPanel_module_css_default.field} ${StudioPanel_module_css_default.fieldInline}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("inspector.videoInterpolate") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "number",
									min: "2",
									max: "16",
									step: "1",
									"aria-label": t("inspector.videoInterpolate"),
									value: String(post.multiplier),
									onChange: (event) => {
										const next = Math.trunc(Number(event.currentTarget.value));
										if (Number.isFinite(next) && next >= 2 && next <= 16) editPostProcess({ multiplier: next });
									}
								})]
							})]
						}),
						(framesMode || generating || !hasFirstPass) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
							className: StudioPanel_module_css_default.hint,
							children: framesMode ? t("inspector.standaloneSecondPassFrames") : generating ? t("inspector.standaloneSecondPassBusy") : t("inspector.standaloneSecondPassNoLatent")
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.sectionHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: StudioPanel_module_css_default.sectionTitle,
								children: [
									t("inspector.loras"),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
										className: StudioPanel_module_css_default.meta,
										children: String(value.loras.length)
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.linkish,
								"aria-label": t("inspector.addLora"),
								onClick: () => {
									openPicker();
								},
								children: t("inspector.add")
							})]
						}),
						value.loras.map((lora) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.loraRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.loraName,
									title: lora.name,
									children: lora.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: StudioPanel_module_css_default.loraWeight,
									type: "number",
									min: "0",
									max: "2",
									step: "0.05",
									"aria-label": t("inspector.loraStrength"),
									value: lora.strength,
									onChange: (event) => {
										const strength = Number(event.currentTarget.value);
										if (!Number.isFinite(strength)) return;
										setLoras(value.loras.map((entry) => entry.name === lora.name ? {
											...entry,
											strength
										} : entry));
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: StudioPanel_module_css_default.linkish,
									onClick: () => {
										setLoras(value.loras.filter((entry) => entry.name !== lora.name));
									},
									children: t("inspector.remove")
								})
							]
						}, lora.name)),
						pending !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: StudioPanel_module_css_default.loraRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: StudioPanel_module_css_default.loraPick,
									"aria-label": t("inspector.loraPick"),
									value: pending.name,
									onChange: (event) => {
										const name = event.currentTarget.value;
										if (name === "") {
											setPending({
												...pending,
												name
											});
											return;
										}
										setLoras([...value.loras, {
											name,
											strength: Number(pending.strength) || 1
										}]);
										setPending(null);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("inspector.loraPick")
									}), (loraOptions ?? []).map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: name,
										children: name
									}, name))]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: StudioPanel_module_css_default.loraWeight,
									type: "number",
									min: "0",
									max: "2",
									step: "0.05",
									"aria-label": t("inspector.loraStrength"),
									value: pending.strength,
									onChange: (event) => {
										setPending({
											...pending,
											strength: event.currentTarget.value
										});
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: StudioPanel_module_css_default.linkish,
									onClick: () => {
										setPending(null);
									},
									children: t("inspector.remove")
								})
							]
						})
					]
				})
			] });
		}
		// src/client/columns/inspector/PromptEditor.tsx
		/**
		* 右栏：中英两页提示词。
		*
		* 两份都用单个文本域：整份提示词是提交给节点的一个字段，拆成六段只是"读法"，
		* 但会让整段粘贴（例如从 skill 里拷来的官方六段稿）无处落脚，所以不拆。
		* @module dsh-dream-studio/columns/inspector/PromptEditor
		*/
		/** 渲染提示词编辑区。 */
		function PromptEditor({ t }) {
			const value = useCell(draft, (current) => current);
			const [lang, setLang] = (0, react.useState)("zh");
			const body = lang === "zh" ? value.prompt : value.promptEn;
			const [assisting, setAssisting] = (0, react.useState)(false);
			const improve = async () => {
				if (body.trim() === "") {
					updateShell({ error: "先写一段提示词，再让助手改" });
					return;
				}
				setAssisting(true);
				try {
					editDraft({ promptEn: (await assistantRewrite(body, value.mode === "frames" ? "frames" : "reference", { duration: value.duration })).text }, true);
					setLang("en");
					updateShell({ notice: "已改写成官方模板（英文）" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				} finally {
					setAssisting(false);
				}
			};
			/** 把这一集的人工改动（时长 / 参考图 / 提示词）写回 series.json。 */
			const syncOut = async () => {
				const state = episode.get();
				if (state.projectId === null || state.episodeId === null) return;
				setAssisting(true);
				try {
					updateShell({ notice: (await writeBackSeries(state.projectId, state.episodeId, value.clipId)).message });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				} finally {
					setAssisting(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.section,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.promptTabs,
					role: "tablist",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							role: "tab",
							"aria-selected": lang === "zh",
							className: lang === "zh" ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
							onClick: () => {
								setLang("zh");
							},
							children: t("inspector.promptZh")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							role: "tab",
							"aria-selected": lang === "en",
							className: lang === "en" ? `${StudioPanel_module_css_default.tab} ${StudioPanel_module_css_default.tabOn}` : StudioPanel_module_css_default.tab,
							onClick: () => {
								setLang("en");
							},
							children: t("inspector.promptEn")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: StudioPanel_module_css_default.spacer }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.ghost,
							disabled: assisting,
							onClick: () => {
								improve();
							},
							children: t("assistant.rewrite")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.ghost,
							disabled: assisting,
							title: t("inspector.syncOutHint"),
							onClick: () => {
								syncOut();
							},
							children: t("inspector.syncOut")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					className: StudioPanel_module_css_default.promptArea,
					"aria-label": lang === "zh" ? t("inspector.promptZh") : t("inspector.promptEn"),
					rows: 10,
					value: body,
					onChange: (event) => {
						if (lang === "zh") editDraft({ prompt: event.currentTarget.value });
						else editDraft({ promptEn: event.currentTarget.value });
					}
				})]
			});
		}
		// src/client/columns/inspector/GenerateBar.tsx
		/** 渲染底部按钮条。 */
		function GenerateBar({ t, clip }) {
			const progress = useCell(jobs, (state) => state.progress[clip.id]);
			const post = useCell(postProcess, (current) => current);
			const [clicked, setClicked] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (clip.status === "success" || clip.status === "failed" || clip.status === "cancelled") setClicked(false);
			}, [clip.status]);
			const running = clicked || clip.status === "queued" || clip.status === "running";
			const live = progress?.percent ?? (running ? lastKnownPercent(clip.id) : null);
			const tone = running ? StudioPanel_module_css_default.genProgressFill : clip.status === "success" ? `${StudioPanel_module_css_default.genProgressFill} ${StudioPanel_module_css_default.genProgressOk}` : clip.status === "failed" ? `${StudioPanel_module_css_default.genProgressFill} ${StudioPanel_module_css_default.genProgressBad}` : StudioPanel_module_css_default.genProgressFill;
			const loading = running && live === null;
			const shown = running ? Math.min(live ?? 0, 99) : null;
			const percent = loading ? 0 : shown ?? (clip.status === "success" ? 100 : 0);
			const label = running ? live === null ? "0%" : `${String(shown)}%` : clip.status === "success" ? "100%" : clip.status === "failed" ? t("inspector.failed") : "0%";
			const phase = running ? live !== null && (shown ?? 0) >= 95 ? t("inspector.finishing") : progress?.note ?? null : null;
			const hasFilm = clip.resultVideoPath !== null;
			const kinds = new Set(clip.videoKinds);
			const secondPassed = kinds.has("second");
			const upscaled = kinds.has("upscale");
			const interpolated = kinds.has("interp");
			const exists = (kind) => kinds.has(kind);
			const warnExists = (kind) => {
				updateShell({ notice: t("inspector.kindExists", { kind: kind === "second" ? t("video.kind.second") : kind === "upscale" ? t("video.kind.upscale") : t("video.kind.interp") }) });
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.generateBar,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.genActions,
						children: [
							running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.danger,
								onClick: () => {
									cancelJob();
								},
								children: t("inspector.cancel")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: StudioPanel_module_css_default.primary,
								onClick: () => {
									setClicked(true);
									generateClip(clip.id);
								},
								children: t("inspector.generate")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: secondPassed ? `${StudioPanel_module_css_default.secondary} ${StudioPanel_module_css_default.secondPassDone}` : StudioPanel_module_css_default.secondary,
								disabled: running || !hasFilm || clip.mode === "frames",
								title: clip.mode === "frames" ? t("inspector.standaloneSecondPassFrames") : secondPassed ? t("inspector.standaloneSecondPassDone") : t("inspector.standaloneSecondPassHint"),
								onClick: () => {
									if (exists("second")) {
										warnExists("second");
										return;
									}
									setClicked(true);
									generateSecondPass(clip.id);
								},
								children: t("inspector.standaloneSecondPassShort")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: interpolated ? `${StudioPanel_module_css_default.secondary} ${StudioPanel_module_css_default.secondPassDone}` : StudioPanel_module_css_default.secondary,
								disabled: running || !hasFilm,
								title: t("inspector.videoInterpolateHint"),
								onClick: () => {
									if (exists("interp")) {
										warnExists("interp");
										return;
									}
									setClicked(true);
									generateVideoInterpolate(clip.id, post.multiplier);
								},
								children: t("inspector.videoInterpolate")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: upscaled ? `${StudioPanel_module_css_default.secondary} ${StudioPanel_module_css_default.secondPassDone}` : StudioPanel_module_css_default.secondary,
								disabled: running || !hasFilm,
								title: t("inspector.videoUpscaleHint"),
								onClick: () => {
									if (exists("upscale")) {
										warnExists("upscale");
										return;
									}
									setClicked(true);
									generateVideoUpscale(clip.id, post.level);
								},
								children: t("inspector.videoUpscale")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.genProgressRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StudioPanel_module_css_default.genProgress,
							role: "progressbar",
							"aria-valuenow": loading ? 0 : percent,
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: StudioPanel_module_css_default.genProgressLoading }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: tone,
								style: { width: `${String(percent)}%` }
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
							className: StudioPanel_module_css_default.genPercent,
							children: loading ? t("inspector.loadingModel") : label
						})]
					}),
					phase === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						className: StudioPanel_module_css_default.genPhase,
						children: phase
					})
				]
			});
		}
		// src/client/columns/inspector/Inspector.tsx
		/**
		* 右栏容器：把草稿、片段与素材接起来，按模式渲染两套字段。
		*
		* 布局：整栏固定高度，中间内容滚动，「生成视频」按钮固定贴底——滚动条不会压到按钮。
		* @module dsh-dream-studio/columns/inspector/Inspector
		*/
		/** 渲染右栏。 */
		function Inspector({ t }) {
			const clip = useSelectedClip();
			const value = useCell(draft, (current) => current);
			const projectId = useCell(episode, (state) => state.projectId);
			const episodeId = useCell(episode, (state) => state.episodeId);
			(0, react.useEffect)(() => {
				loadDraft(clip);
			}, [clip?.id]);
			(0, react.useEffect)(() => () => {
				disposeDraft();
			}, []);
			(0, react.useEffect)(() => {
				if (projectId !== null) loadAssets(projectId, episodeId ?? void 0);
			}, [projectId, episodeId]);
			if (clip === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
				className: StudioPanel_module_css_default.right,
				"aria-label": t("app.subtitle"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: StudioPanel_module_css_default.inspector,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: StudioPanel_module_css_default.meta,
						children: t("inspector.empty")
					})
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
				className: StudioPanel_module_css_default.right,
				"aria-label": t("app.subtitle"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: StudioPanel_module_css_default.inspector,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.inspectorScroll,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: StudioPanel_module_css_default.inspectorHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.sectionTitle,
									children: clip.seriesKey === "" ? t("tree.clip", { index: clip.order + 1 }) : clip.seriesKey
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: StudioPanel_module_css_default.meta,
									children: clip.status
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.modeSwitch,
								role: "group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: value.mode === "frames" ? `${StudioPanel_module_css_default.modeButton} ${StudioPanel_module_css_default.modeOn}` : StudioPanel_module_css_default.modeButton,
									"aria-pressed": value.mode === "frames",
									onClick: () => {
										setMode("frames");
									},
									children: t("inspector.mode")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: value.mode === "reference" ? `${StudioPanel_module_css_default.modeButton} ${StudioPanel_module_css_default.modeOn}` : StudioPanel_module_css_default.modeButton,
									"aria-pressed": value.mode === "reference",
									onClick: () => {
										setMode("reference");
									},
									children: t("inspector.modeReference")
								})]
							}),
							value.mode === "frames" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FrameSlots, { t }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReferenceGrid, {
								t,
								clip
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KeyframeSlots, {
								t,
								clip
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Params, { t }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptEditor, { t }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.section,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: StudioPanel_module_css_default.sectionHead,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StudioPanel_module_css_default.sectionTitle,
										children: t("studio.film")
									})
								}), clip.resultVideoPath !== null && projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
									className: StudioPanel_module_css_default.clipThumb,
									src: clipResultUrl(projectId, clip.id, clipVideoVersion(clip)),
									controls: true,
									playsInline: true,
									style: {
										width: "100%",
										borderRadius: "var(--ds-radius-s)"
									}
								}, clip.resultVideoPath) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: StudioPanel_module_css_default.paneHint,
									children: t("studio.noVideo")
								})]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GenerateBar, {
						t,
						clip
					})]
				})
			});
		}
		/**
		* 全能参考模式：2 列 16:9 卡，角色与删除压在卡内底部；标题右侧「添加」。
		*
		* 序号就是 `<Picture N>`，删除后由 Host 重排位次（顺序决定模型看到的编号）。
		*/
		function ReferenceGrid({ t, clip }) {
			const projectId = useCell(episode, (state) => state.projectId);
			const images = clip.refs.filter((ref) => ref.kind === "image").slice().sort((left, right) => left.position - right.position);
			const fail = (thrown) => {
				updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
			};
			/**
			* 加一个参考位。
			*
			* 拖图进来时先填**已有的空槽**（先用「添加」留出的位置），没有空槽才追加；
			* 空槽之后的顺序都按位次重排，最后一张恒为场景图。
			* @param assetId - 拖进来的素材；不传表示只加一个空位。
			*/
			const add = (assetId) => {
				if (projectId === null) return;
				const empty = assetId === void 0 ? void 0 : images.find((ref) => ref.assetId === null);
				const next = empty === void 0 ? [...images, {
					kind: "image",
					assetId: assetId ?? null,
					assetName: "",
					role: "character",
					windowStart: null,
					windowEnd: null,
					note: null
				}] : images.map((ref) => ref.position === empty.position ? {
					...ref,
					assetId
				} : ref);
				const refs = [...clip.refs.filter((ref) => ref.kind !== "image"), ...next.map((ref, index) => ({
					...ref,
					position: index,
					role: index === next.length - 1 ? "scene" : "character"
				}))];
				updateClip(projectId, clip.id, { refs }).then((payload) => {
					applyPayload(payload);
					updateShell({ notice: t("inspector.refAdded") });
				}).catch(fail);
			};
			const drop = assetDropTarget((assetId) => {
				add(assetId);
			});
			const remove = (position) => {
				if (projectId === null) return;
				removeRef(projectId, clip.id, position).then(applyPayload).catch(fail);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: StudioPanel_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: StudioPanel_module_css_default.sectionHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: StudioPanel_module_css_default.sectionTitle,
							children: [
								t("inspector.modeReference"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: StudioPanel_module_css_default.meta,
									children: `${String(images.length)} / 10`
								})
							]
						}), images.length < 10 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: StudioPanel_module_css_default.linkish,
							"aria-label": t("inspector.addRef"),
							onClick: () => {
								add();
							},
							children: t("inspector.add")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: StudioPanel_module_css_default.refGrid,
						...drop,
						children: images.map((ref) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: StudioPanel_module_css_default.refCard,
							title: ref.assetName,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: StudioPanel_module_css_default.refThumb,
								children: [ref.assetId !== null && projectId !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: assetUrl(projectId, ref.assetId, 0),
									alt: "",
									loading: "lazy"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: StudioPanel_module_css_default.refIndex,
									children: String(ref.position + 1)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: StudioPanel_module_css_default.refOverlay,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: StudioPanel_module_css_default.refRole,
										children: (ref.role ?? "") === "scene" ? t("inspector.roleScene") : t("inspector.roleCharacter")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: StudioPanel_module_css_default.refRemove,
										"aria-label": `${t("inspector.remove")} ${String(ref.position + 1)}`,
										onClick: () => {
											remove(ref.position);
										},
										children: t("inspector.remove")
									})]
								})]
							})
						}, `${ref.kind}-${String(ref.position)}`))
					}),
					images.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: StudioPanel_module_css_default.paneHint,
						children: t("inspector.refEmpty")
					})
				]
			});
		}
		// src/client/pages/ComfyFrame.tsx
		/**
		* 时空节点：整页嵌入 ComfyUI 的网页。
		*
		* 这一页不挂素材栏和右栏，内容铺满中栏；地址取设置里第一个可用的
		* ComfyUI 服务（没有可用服务时取第一条配置）。
		*
		* 直接嵌 `http://127.0.0.1:8188` 是不行的：ComfyUI 的 origin 中间件会把带
		* `Sec-Fetch-Site: cross-site` 的跨源请求全部回 403，页面只剩空白。所以这里先向
		* 宿主要一个本地反代地址（`GET /comfy-mirror`），再嵌那个地址 —— 对浏览器来说
		* 是完整的 ComfyUI 站点，对 ComfyUI 来说是同源请求。
		* @module dsh-dream-studio/pages/ComfyFrame
		*/
		/**
		* 渲染内嵌的 ComfyUI。
		* @param props - 文案表。
		* @returns 中栏内容。
		*/
		function ComfyFrame({ t }) {
			const list = useCell(servers, (value) => value);
			const target = list.find((server) => server.available) ?? list[0] ?? null;
			const [src, setSrc] = (0, react.useState)(null);
			const [failure, setFailure] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (target === null) {
					setSrc(null);
					return;
				}
				let dropped = false;
				setSrc(null);
				setFailure(null);
				comfyMirror().then((payload) => {
					if (dropped) return;
					setSrc(payload.url.endsWith("/") ? payload.url : `${payload.url}/`);
				}).catch((thrown) => {
					if (dropped) return;
					setFailure(thrown instanceof Error ? thrown.message : String(thrown));
				});
				return () => {
					dropped = true;
				};
			}, [target?.baseUrl]);
			if (target === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("shell.tab.comfy") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: StudioPanel_module_css_default.meta,
					children: t("comfy.noServer")
				})] })
			});
			if (src === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: failure === null ? StudioPanel_module_css_default.meta : StudioPanel_module_css_default.comfyFail,
					children: failure === null ? t("comfy.loading") : `${t("comfy.failed")} · ${failure}`
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: StudioPanel_module_css_default.comfyPane,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
					className: StudioPanel_module_css_default.comfyFrame,
					src,
					title: t("shell.tab.comfy"),
					allow: "clipboard-read; clipboard-write; fullscreen"
				})
			});
		}
		// src/client/StudioPanel.tsx
		/**
		* 时空造梦主面板：一壳三页两栏的容器。
		*
		* 只做组合与初始化，具体渲染在 `shell/`、`pages/`、`columns/` 下。旧插件把四套视图
		* 开关（`agentOpen` / `view` / `centerTab` / `dialog`）和所有分支塞在一个 481 行的文件里，
		* 这里是它的反面：容器不认识任何业务字段。
		* @module dsh-dream-studio/StudioPanel
		*/
		/** 渲染主面板。 */
		function StudioPanel(props) {
			const { t, renderSlot, SessionProvider, listSessions, createSession, retainSession, pickDirectory, registerWorkspace } = props;
			const tr = t;
			const route = useCell(shell, (value) => value.route);
			const collapsed = useCell(shell, (value) => value.leftCollapsed);
			const error = useCell(shell, (value) => value.error);
			const notice = useCell(shell, (value) => value.notice);
			const tab = useCell(shell, (value) => value.tab);
			const episodeId = useCell(episode, (value) => value.episodeId);
			const projectDir = useCell(projects, (value) => value.projects?.find((entry) => entry.id === episode.get().projectId)?.dirPath ?? null);
			const projectId = useCell(episode, (value) => value.projectId);
			const episodeDir = useCell(episode, (value) => value.episodes.find((entry) => entry.id === value.episodeId)?.dirPath ?? null);
			const defaultRatio = useCell(projects, (value) => value.projects?.find((entry) => entry.id === projectId)?.defaultRatio ?? "16:9");
			/** 最近一次点在"文件"上的元素文本：DSH 打开失败的弹框里没有路径，只能靠它还原。 */
			const lastPick = (0, react.useRef)("");
			/** 上一次真的去开文件的时间，用来避免 pointerdown / click 各开一次。 */
			const openedAt = (0, react.useRef)(0);
			const rootRef = (0, react.useRef)(null);
			/** 面板内预览的文件：DSH 的右栏打开在全局面板下必然失败，本机 .md 也未必有默认程序。 */
			const [viewerPath, setViewerPath] = (0, react.useState)(null);
			/** 面板内预览：能内嵌的就内嵌，实在不行弹框里还有「用默认程序打开」。 */
			const openInViewer = (path) => {
				setViewerPath(path);
			};
			const openChip = (event) => {
				const element = event.target instanceof HTMLElement ? event.target : null;
				if (element === null || projectId === null) return;
				if (rootRef.current?.contains(element) !== true) return;
				if (element.closest("input, textarea, select, form, [contenteditable], [role=\"textbox\"]") !== null) return;
				const title = element.closest("[title]")?.getAttribute("title")?.trim() ?? "";
				const named = tab === "chat" ? fileNameOf(element) : null;
				const picked = title !== "" ? title : named ?? element.closest("button, a, [role=\"button\"]")?.textContent?.trim() ?? "";
				if (picked !== "") lastPick.current = picked;
				const path = title.startsWith("@") ? title.slice(1).replace(/^"|"$/gu, "").trim() : named;
				if (path === null || path === "") return;
				event.preventDefault();
				event.stopPropagation();
				const now = performance.now();
				if (event.type === "click" && now - openedAt.current < 600) return;
				openedAt.current = now;
				openInViewer(path);
			};
			(0, react.useEffect)(() => {
				if (projectId === null) return;
				const options = { capture: true };
				window.addEventListener("pointerdown", openChip, options);
				window.addEventListener("click", openChip, options);
				return () => {
					window.removeEventListener("pointerdown", openChip, options);
					window.removeEventListener("click", openChip, options);
				};
			});
			(0, react.useEffect)(() => {
				if (projectId === null) return;
				const closeButton = (dialog) => [...dialog.querySelectorAll("button")].find((button) => /^(关闭|取消|Close)$/iu.test(button.textContent?.trim() ?? ""));
				const handle = () => {
					const dialog = [...document.querySelectorAll("[role=\"dialog\"], dialog")].find((entry) => (entry.textContent ?? "").includes("no session surface is mounted"));
					if (dialog === void 0) return false;
					const picked = lastPick.current;
					closeButton(dialog)?.click();
					const guess = picked.replace(/^@+/u, "").replace(/^"|"$/gu, "").replace(/(?::\d+){1,2}$/u, "").trim();
					if ((FILE_EXT.test(guess) || /[\\/]/u.test(guess)) && !/\s/u.test(guess)) openInViewer(guess);
					return true;
				};
				const observer = new MutationObserver(() => {
					handle();
				});
				observer.observe(document.body, {
					childList: true,
					subtree: true,
					characterData: true
				});
				return () => {
					observer.disconnect();
				};
			}, [
				projectId,
				episodeDir,
				projectDir
			]);
			const scheme = useHostScheme();
			const [busy, setBusy] = (0, react.useState)(false);
			const [sessionId, setSessionId] = (0, react.useState)(null);
			const [reference, setReference] = (0, react.useState)(null);
			const [sessionsVersion, setSessionsVersion] = (0, react.useState)(0);
			const justCreated = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				loadProjects();
				loadSettings();
				const stop = connectEvents();
				return () => {
					stop();
					disconnectEvents();
				};
			}, []);
			(0, react.useEffect)(() => {
				loadJobs();
			}, [episodeId]);
			const sessions = (0, react.useMemo)(() => projectDir === null || typeof listSessions !== "function" ? [] : listSessions(projectDir), [
				projectDir,
				listSessions,
				projectId,
				sessionsVersion
			]);
			(0, react.useEffect)(() => {
				setSessionId((current) => {
					if (current !== null && sessions.some((row) => row.id === current)) return current;
					if (current !== null && current === justCreated.current) return current;
					return sessions.find((row) => row.active !== true)?.id ?? null;
				});
			}, [sessions]);
			(0, react.useEffect)(() => {
				if (justCreated.current === null) return;
				const row = sessions.find((entry) => entry.id === justCreated.current);
				if (row !== void 0 && row.blank === false) justCreated.current = null;
			}, [sessions]);
			const heldRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			(0, react.useEffect)(() => {
				if (sessionId === null) return;
				let timer = null;
				let stopped = false;
				const cached = heldRefs.current.get(sessionId);
				if (cached !== void 0) {
					setReference(cached);
					return () => {
						setReference((current) => current === cached ? null : current);
					};
				}
				const acquire = (attempt) => {
					if (stopped) return;
					let reference;
					try {
						reference = retainSession(sessionId);
					} catch {
						if (attempt < 8) timer = setTimeout(() => acquire(attempt + 1), 200);
						return;
					}
					heldRefs.current.set(sessionId, reference);
					reference.ready.then(() => {
						if (!stopped) setReference(reference);
					}, (thrown) => {
						if (stopped) return;
						updateShell({ error: `会话打不开：${thrown instanceof Error ? thrown.message : String(thrown)}` });
					});
				};
				acquire(0);
				return () => {
					stopped = true;
					if (timer !== null) clearTimeout(timer);
					setReference((current) => current === heldRefs.current.get(sessionId) ? null : current);
				};
			}, [sessionId]);
			(0, react.useEffect)(() => {
				const refs = heldRefs.current;
				return () => {
					for (const reference of refs.values()) reference.release();
					refs.clear();
				};
			}, []);
			const exportAll = async () => {
				if (typeof pickDirectory !== "function") {
					updateShell({ error: "当前宿主不支持选择目录" });
					return;
				}
				const dir = await pickDirectory();
				if (dir === null) return;
				await exportEpisode(dir);
			};
			const createChat = async () => {
				if (projectDir === null) {
					updateShell({ error: "这一集还没有目录，先让它在磁盘上建出来" });
					return;
				}
				const current = sessionId === null ? void 0 : sessions.find((row) => row.id === sessionId);
				const fresh = sessionId !== null && sessionId === justCreated.current;
				if (current !== void 0 && current.blank === true || fresh) {
					updateShell({ notice: "当前会话还是空的，直接在这里输入就行" });
					return;
				}
				setBusy(true);
				try {
					const created = await createSession(projectDir);
					if (created !== null) {
						justCreated.current = created;
						setSessionId(created);
						setSessionsVersion((value) => value + 1);
						for (let attempt = 0; attempt < 10; attempt += 1) {
							if (typeof listSessions !== "function") break;
							if (listSessions(projectDir).some((row) => row.id === created)) break;
							await new Promise((resolve) => setTimeout(resolve, 200));
							setSessionsVersion((value) => value + 1);
						}
					} else updateShell({ error: "新建会话失败：宿主没有返回会话 id" });
				} catch (thrown) {
					updateShell({ error: thrown instanceof Error ? thrown.message : String(thrown) });
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: StudioPanel_module_css_default.root,
				"data-studio": "",
				ref: rootRef,
				"data-scheme": scheme,
				"aria-label": tr("app.name"),
				style: { ["--studio-ratio"]: defaultRatio.replace(":", " / ") },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, {
						t: tr,
						onExport: () => {
							exportAll();
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ErrorBoundary, {
						label: tr("common.crash"),
						retry: tr("common.retry"),
						children: [
							(error !== null || notice !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: error === null ? StudioPanel_module_css_default.message : `${StudioPanel_module_css_default.message} ${StudioPanel_module_css_default.messageError}`,
								role: error === null ? "status" : "alert",
								children: [error ?? notice ?? "", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: StudioPanel_module_css_default.ghost,
									onClick: dismissMessage,
									children: tr("common.close")
								})]
							}),
							route === "board" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Board, {
								t: tr,
								...pickDirectory === void 0 ? {} : { pickDirectory },
								registerWorkspace: async (dirValue) => {
									try {
										await registerWorkspace(dirValue);
									} catch {}
								}
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tabs, { t: tr }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: tab === "comfy" ? `${StudioPanel_module_css_default.body} ${StudioPanel_module_css_default.bodyFull}` : StudioPanel_module_css_default.body,
								children: [
									tab !== "comfy" && !collapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
										className: StudioPanel_module_css_default.left,
										"aria-label": tab === "studio" ? tr("fragments.project") : tr("shell.episodes"),
										children: tab === "studio" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssetLibrary, { t: tr }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EpisodesTree, { t: tr })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
										className: StudioPanel_module_css_default.center,
										children: tab === "comfy" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComfyFrame, { t: tr }) : tab === "chat" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Conversation, {
											t: tr,
											sessions,
											sessionId,
											reference,
											busy,
											onCreate: () => {
												createChat();
											},
											onSelect: (id) => {
												setSessionId(id);
											},
											...renderSlot === void 0 ? {} : { renderSlot },
											...SessionProvider === void 0 ? {} : { SessionProvider }
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Content, { t: tr })
									}),
									tab !== "comfy" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Inspector, { t: tr })
								]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LogPanel, { t: tr }),
							viewerPath === null || projectId === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileViewer, {
								projectId,
								path: viewerPath,
								...(episodeDir ?? projectDir) === null ? {} : { base: episodeDir ?? projectDir },
								t: tr,
								onClose: () => {
									setViewerPath(null);
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusBar, { t: tr })
				]
			});
		}
		/**
		* 判断一次点击落在哪个"文件名"上。
		*
		* 对话里 `剧本.md` 这类文件名由 markdown 直接渲染成可点文本：没有 `title`、也不一定是
		* 链接元素，所以从被点元素往上找几层，挑第一个整段文本就是一个文件名的节点。
		* @param element - 事件目标。
		* @returns 文件名（可能是相对路径）；不像文件就是 null。
		*/
		/** 只认这些后缀，避免把「S01-C025.0s」这种"名字+时长"拼在一起的行当成文件。 */
		const FILE_EXT = /\.(md|markdown|json|jsonl|txt|csv|tsv|yml|yaml|png|jpe?g|webp|gif|bmp|mp4|mov|webm|mkv|safetensors|ckpt|srt|ass|vtt|wav|mp3|flac|zip|log|db|sqlite|js|mjs|cjs|ts|tsx|py|bat|cmd|ps1|sh)$/iu;
		function fileNameOf(element) {
			let node = element;
			for (let depth = 0; node !== null && depth < 5; depth += 1, node = node.parentElement) {
				const text = (node.textContent ?? "").trim();
				if (text === "" || text.length > 140) continue;
				const first = text.split(/\r?\n/u)[0]?.trim() ?? "";
				if (/\s/u.test(first)) continue;
				if (FILE_EXT.test(first)) return first;
			}
			return null;
		}
		// src/client/pages/conversation/EmbeddedChat.tsx
		/** 固定显示会话自己的对话视图。 */
		function FixedChat({ renderSlot }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: renderSlot("conversation.session", { view: "chat" }) });
		}
		/**
		* 渲染一段内嵌对话。
		* @param props - 会话运行时与 Factory 渲染器。
		* @returns 嵌入的对话。
		*/
		function EmbeddedChat(props) {
			const { sessionId, useSession, useSessions, useConversation, renderFactorySlot } = props;
			const session = useSession((value) => value);
			const shellPhase = useConversation((value) => value.activeTargets.size) > 0 || !session.blank && !session.awaitingFirstTurn || session.running ? "active" : session.promptAttempted ? "engaging" : "blank";
			const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
			const settling = shellPhase === "blank" && session.openState === "loading" && summaryBlank !== true;
			const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
			return renderFactorySlot("conversation.content", {
				variant: "embedded",
				phase: settling ? "settling" : hero ? "hero" : "active",
				hero
			}, { slots: { views: FixedChat } });
		}
		// src/client/i18n.ts
		/**
		* 时空造梦的中英文案。
		*
		* 键结构 `域.元素.状态`，域就是页面或组件名（shell / board / fragments / chat / studio /
		* inspector / settings / common）。M0 只放外壳与空态文案，随功能逐步补齐。
		* @module dsh-dream-studio/i18n
		*/
		/** i18n 命名空间。 */
		const NS = "dreamStudio";
		/** 中文词典。 */
		const zh = {
			"settings.dataRoot": "数据根",
			"settings.workflowModels": "工作流模型",
			"settings.workflowModelsHint": "这里的值会覆盖工作流模板自带的模型；留空则沿用模板原值。",
			"settings.workflowModelsSaveHint": "改完点保存才生效",
			"settings.workflowModelsSaved": "已保存工作流模型",
			"settings.minimaxKey": "MiniMax Context IR API Key",
			"settings.minimaxKeyHint": "在 platform.minimaxi.com 申请，供 skill 调用 H3 Context IR 提示词增强接口（导演台右栏不直接调用）。",
			"settings.minimaxKeyPlaceholder": "sk-xxxxxxxx",
			"settings.minimaxKeySaved": "已保存 MiniMax API key",
			"inspector.save": "保存",
			"settings.modelsOffline": "连不上 ComfyUI，下拉候选为空；仍可保存已有配置",
			"settings.loraStrength": "强度",
			"settings.addLora": "添加 LoRA",
			"settings.loras": "LoRA",
			"settings.noModels": "这个模板没有可配置的模型输入。",
			"settings.loraChainHint": "按顺序替换模板里的 LoRA；多出来的会接在链尾。",
			"settings.loraMirrorHint": "一采 / 二采共用这一份 LoRA，保存后两条链都会接上。",
			"settings.checkModels": "检查配置",
			"settings.checking": "检查中…",
			"settings.checkModelsHint": "让 ComfyUI 校验这个模板的节点与模型候选（不排队、不占卡）",
			"settings.checkOk": "配置通过：{count} 个节点全部可用",
			"settings.checkIssues": "发现 {count} 处问题",
			"settings.paths": "路径",
			"settings.serverUrl": "服务地址",
			"settings.serverName": "服务名称",
			"settings.default": "默认",
			"settings.makeDefault": "设为默认",
			"settings.test": "测试",
			"settings.noServer": "还没有服务，加一条 127.0.0.1:8188 就能出片。",
			"settings.servers": "ComfyUI 服务",
			"fragments.rename": "重命名",
			"chat.newSession": "新会话",
			"chat.sessions": "会话列表",
			"inspector.add": "添加",
			"inspector.failed": "失败",
			"inspector.addRef": "添加参考图",
			"inspector.addLora": "添加 LoRA",
			"inspector.addKeyframe": "添加关键帧",
			"inspector.anchor": "插入点",
			"inspector.loraPick": "选择 LoRA",
			"inspector.keyframeDropped": "已把图片放进这个关键帧槽",
			"inspector.roleScene": "场景",
			"inspector.roleCharacter": "人物",
			"inspector.refEmpty": "把素材拖到这里添加参考图",
			"inspector.refAdded": "已加入一张参考图",
			"app.name": "时空造梦",
			"app.subtitle": "导演台",
			"shell.backToProjects": "返回项目列表",
			"shell.board": "项目看板",
			"shell.tab.script": "时空剧本",
			"shell.tab.fragments": "时空碎片",
			"shell.tab.chat": "时空对话",
			"shell.tab.studio": "时空造梦",
			"shell.tab.comfy": "时空节点",
			"comfy.noServer": "还没有配置 ComfyUI 服务：到「设置 → 通用设置」里加一个地址（例如 http://127.0.0.1:8188）。",
			"comfy.failed": "页面没加载出来",
			"comfy.loading": "正在准备内嵌页面…",
			"fileViewer.title": "文件预览",
			"fileViewer.loading": "正在读取文件…",
			"fileViewer.failed": "读不到这个文件",
			"fileViewer.unsupported": "这个后缀不方便内嵌预览。",
			"fileViewer.openWithSystem": "用默认程序打开",
			"script.loading": "读取中…",
			"script.autoSave": "编辑后自动保存",
			"script.saving": "保存中…",
			"script.saved": "已自动保存",
			"script.saveFailed": "保存失败",
			"script.placeholder": "这一集还没有剧本文件，直接在这里写，会自动保存成 第NN集.md",
			"script.noEpisode": "还没选剧集",
			"script.noEpisodeHint": "先在左侧剧集树里选一集，这里会显示它的剧本。",
			"script.doc.script": "本集剧本",
			"script.doc.outline": "漫剧大纲",
			"script.doc.characters": "人物档案",
			"video.title": "成片历史",
			"video.count": "条",
			"video.loading": "读取中…",
			"video.empty": "这一段还没有生成过视频。",
			"video.activate": "启用",
			"video.active": "使用中",
			"video.kind.first": "1采",
			"video.kind.second": "2采",
			"video.kind.upscale": "放大",
			"video.kind.interp": "补帧",
			"shell.episodes": "剧集列表",
			"shell.createEpisode": "创建剧集",
			"shell.addClip": "新增片段",
			"shell.logs": "日志",
			"status.server": "本地 ComfyUI",
			"status.disconnected": "未连接",
			"status.connected": "已连接",
			"status.notConfigured": "未配置",
			"status.dispatch": "调度",
			"status.serial": "串行",
			"status.parallel": "并行",
			"status.queue": "队列",
			"status.filmed": "已出片 {count} 段",
			"board.newProject": "新建项目",
			"board.ratio": "画幅",
			"board.confirmDelete": "确认删除",
			"board.deleteHint": "只删除登记，磁盘上的文件保留",
			"board.edit": "编辑",
			"board.save": "保存",
			"board.cancel": "取消",
			"board.resolution": "分辨率",
			"board.empty.title": "还没有项目",
			"board.empty.hint": "新建一个项目，或从示例开始；每个项目会得到一个目录，剧集与素材都在里面。",
			"board.projectName": "项目名称",
			"board.open": "打开",
			"board.delete": "删除",
			"board.missing": "目录已不在",
			"board.clips": "{count} 个片段",
			"board.episodes": "{count} 集",
			"fragments.empty": "开始你的创作吧",
			"chat.empty": "这个项目还没有会话",
			"chat.newChat": "新对话",
			"chat.emptyHint": "这一集的目录就是会话的工作目录，新建对话后它会出现在会话列表里。",
			"chat.unsupported": "当前宿主不支持内嵌对话，请到会话面板继续。",
			"chat.preparing": "正在准备对话…",
			"studio.empty": "从左边选一个片段",
			"inspector.empty": "从左边选一个片段",
			"common.close": "关闭",
			"common.empty": "（空）",
			"common.crash": "这里渲染出错了",
			"common.retry": "重试",
			"common.loading": "加载中…",
			"settings.title": "时空造梦设置",
			"fragments.project": "项目库",
			"fragments.episode": "剧集库",
			"fragments.import": "导入",
			"fragments.emptyLibrary": "这本库还是空的，点「导入」加一张。",
			"fragments.ready": "请开始您的创作吧~",
			"fragments.drafts": "草稿 {count} 张",
			"fragments.episodeDrafts": "本集资产图 · 草稿 {count} 张",
			"fragments.noDrafts": "这个片段还没有草稿图，写个提示词生成一张。",
			"fragments.pendingRef": "待生成",
			"fragments.adopt": "入库",
			"fragments.useDraftPrompt": "点击把这条提示词放回下方输入框",
			"fragments.dropRef": "拖入参考图（最多 4 张）",
			"fragments.readyHint": "左栏是这一集的素材库，选一张就能重绘；也可以直接拖进右侧的槽位。",
			"fragments.t2i": "文生图",
			"fragments.i2i": "图生图",
			"fragments.size": "短边",
			"fragments.tile": "切块",
			"fragments.cfg": "CFG",
			"fragments.steps": "步数",
			"fragments.tileX": "横切",
			"fragments.tileY": "竖切",
			"fragments.prompt": "提示词",
			"fragments.promptHint": "写清景别、人物、场景与光线；生成后可应用为素材主图",
			"fragments.generate": "生成图片",
			"studio.generateAll": "生成全部片段",
			"studio.queued": "排队中",
			"studio.exportClips": "导出全部片段",
			"studio.exportHintEmpty": "这一集还没有成片可导出",
			"assistant.rewrite": "改写",
			"inspector.firstFrame": "首帧",
			"inspector.lastFrame": "尾帧",
			"inspector.clear": "清除",
			"inspector.continuation": "续写",
			"inspector.secondPass": "二采",
			"inspector.firstPassTiled": "一采分块",
			"inspector.secondPassTiled": "二采分块",
			"inspector.resolution": "分辨率",
			"inspector.ratio": "高宽比",
			"inspector.secondSteps": "二采步数",
			"inspector.secondScale": "二采尺寸",
			"inspector.secondDenoise": "重绘幅度",
			"inspector.standaloneSecondPassShort": "独立二采",
			"inspector.videoUpscale": "视频放大",
			"inspector.videoUpscaleHint": "读本段成片，用 RelayVSR 放大到所选档位（2K / 4K）",
			"inspector.videoInterpolate": "视频补帧",
			"inspector.kindExists": "这段已经有一个{kind}视频了，先到成片历史里删除那条记录再生成。",
			"inspector.videoInterpolateHint": "读本段成片，每秒补充所填帧数（默认 10 帧）",
			"inspector.standaloneSecondPassHint": "读这一采留下的 latent，按上面的二采尺寸 / 重绘幅度 / 二采步数重绘成高清成片（不用勾「二采」）。",
			"inspector.standaloneSecondPassFrames": "不支持首尾帧模式，推荐使用全能参考+关键帧模式。",
			"inspector.standaloneSecondPassDone": "这段已经用独立二采放大过，成片是高清版；再点会用最新参数重新放大。",
			"inspector.standaloneSecondPassNoLatent": "这段还没有一采成片，也就没有可放大的 latent。先生成一采，再独立二采。",
			"inspector.standaloneSecondPassBusy": "这段正在生成，等出片再放大。",
			"inspector.loras": "Lora 配置",
			"inspector.loraStrength": "强度",
			"inspector.remove": "删除",
			"inspector.promptZh": "中文",
			"inspector.promptEn": "英文",
			"inspector.syncOut": "同步",
			"inspector.syncOutHint": "把这一集的时长、参考图、提示词写回 series.json，之后重新扫描不会被旧值盖掉",
			"inspector.loadingModel": "加载中…",
			"inspector.finishing": "正在解码出片…",
			"inspector.generate": "生成视频",
			"inspector.cancel": "取消",
			"inspector.follow": "跟随",
			"inspector.keyframes": "关键帧",
			"inspector.noKeyframe": "该片段没有关键帧（来自 series）",
			"shell.sync": "重新扫描",
			"shell.syncing": "扫描中…",
			"shell.episode": "剧集",
			"tree.noClips": "这一集还没有片段",
			"tree.clip": "片段 {index}",
			"board.openProject": "打开项目",
			"studio.noVideo": "还没有成片",
			"studio.film": "成片",
			"inspector.mode": "首尾帧",
			"inspector.modeReference": "全能参考",
			"inspector.duration": "时长",
			"inspector.durationGrid": "{frames} 帧 · {fps}fps（H3 网格）",
			"inspector.steps": "一采步数"
		};
		/** 英文词典（键集合必须与中文一致，`check:i18n` 会校验）。 */
		const en = {
			"settings.dataRoot": "Data root",
			"settings.workflowModels": "Workflow models",
			"settings.workflowModelsHint": "Values here override the model files baked into the template; leave empty to keep them.",
			"settings.workflowModelsSaveHint": "Click save to apply",
			"settings.workflowModelsSaved": "Workflow models saved",
			"settings.minimaxKey": "MiniMax Context IR API Key",
			"settings.minimaxKeyHint": "Apply at platform.minimaxi.com. Used by the skill to call the H3 Context IR API; the inspector does not call it directly.",
			"settings.minimaxKeyPlaceholder": "sk-xxxxxxxx",
			"settings.minimaxKeySaved": "MiniMax API key saved",
			"inspector.save": "Save",
			"settings.modelsOffline": "ComfyUI unreachable: no dropdown options (saved config still applies)",
			"settings.loraStrength": "Strength",
			"settings.addLora": "Add LoRA",
			"settings.loras": "LoRA",
			"settings.noModels": "This template has no model inputs to configure.",
			"settings.loraChainHint": "Replaces the template LoRAs in order; extra ones get appended to the chain.",
			"settings.loraMirrorHint": "One LoRA shared by both passes — it is attached to both chains on save.",
			"settings.checkModels": "Check config",
			"settings.checking": "Checking…",
			"settings.checkModelsHint": "Ask ComfyUI to validate this template’s nodes and model choices (no queue, no GPU)",
			"settings.checkOk": "Config OK: {count} nodes usable",
			"settings.checkIssues": "{count} problem(s) found",
			"settings.paths": "Paths",
			"settings.serverUrl": "Server URL",
			"settings.serverName": "Server name",
			"settings.default": "default",
			"settings.makeDefault": "Make default",
			"settings.test": "Test",
			"settings.noServer": "No server yet — add 127.0.0.1:8188 to render.",
			"settings.servers": "ComfyUI servers",
			"fragments.rename": "Rename",
			"chat.newSession": "New session",
			"chat.sessions": "Sessions",
			"inspector.add": "Add",
			"inspector.failed": "Failed",
			"inspector.addRef": "Add reference",
			"inspector.addLora": "Add LoRA",
			"inspector.addKeyframe": "Add keyframe",
			"inspector.anchor": "anchor",
			"inspector.loraPick": "Pick a LoRA",
			"inspector.keyframeDropped": "Picture placed into this keyframe slot",
			"inspector.roleScene": "Scene",
			"inspector.roleCharacter": "Character",
			"inspector.refEmpty": "Drop an asset here to add a reference",
			"inspector.refAdded": "Reference added",
			"app.name": "Dream Studio",
			"app.subtitle": "Director",
			"shell.backToProjects": "All projects",
			"shell.board": "Projects",
			"shell.tab.script": "Script",
			"shell.tab.fragments": "Fragments",
			"shell.tab.chat": "Chat",
			"shell.tab.studio": "Studio",
			"shell.tab.comfy": "Nodes",
			"comfy.noServer": "No ComfyUI server configured yet. Add one under Settings → General (for example http://127.0.0.1:8188).",
			"comfy.failed": "The page did not load",
			"comfy.loading": "Preparing the embedded page…",
			"fileViewer.title": "File preview",
			"fileViewer.loading": "Reading the file…",
			"fileViewer.failed": "Could not read this file",
			"fileViewer.unsupported": "This file type cannot be previewed inline.",
			"fileViewer.openWithSystem": "Open with default app",
			"script.loading": "Loading…",
			"script.autoSave": "Saves automatically as you type",
			"script.saving": "Saving…",
			"script.saved": "Saved",
			"script.saveFailed": "Save failed",
			"script.placeholder": "No script file yet — type here and it will be saved as 第NN集.md",
			"script.noEpisode": "No episode selected",
			"script.noEpisodeHint": "Pick an episode in the left tree to see its script.",
			"script.doc.script": "Episode script",
			"script.doc.outline": "Series outline",
			"script.doc.characters": "Characters",
			"video.title": "Video history",
			"video.count": "videos",
			"video.loading": "Loading…",
			"video.empty": "No videos generated for this clip yet.",
			"video.activate": "Use this",
			"video.active": "Active",
			"video.kind.first": "1st pass",
			"video.kind.second": "2nd pass",
			"video.kind.upscale": "Upscale",
			"video.kind.interp": "Interp",
			"shell.episodes": "Episodes",
			"shell.createEpisode": "New episode",
			"shell.addClip": "Add clip",
			"shell.logs": "Logs",
			"status.server": "Local ComfyUI",
			"status.disconnected": "Offline",
			"status.connected": "Connected",
			"status.notConfigured": "Not configured",
			"status.dispatch": "Dispatch",
			"status.serial": "Serial",
			"status.parallel": "Parallel",
			"status.queue": "Queue",
			"status.filmed": "{count} filmed",
			"board.newProject": "New project",
			"board.ratio": "Aspect",
			"board.confirmDelete": "Confirm delete",
			"board.deleteHint": "Removes the entry only; files stay on disk",
			"board.edit": "Edit",
			"board.save": "Save",
			"board.cancel": "Cancel",
			"board.resolution": "Resolution",
			"board.empty.title": "No projects yet",
			"board.empty.hint": "Create a project or start from a sample. Each project owns a folder holding its episodes and materials.",
			"board.projectName": "Project name",
			"board.open": "Open",
			"board.delete": "Delete",
			"board.missing": "Folder is gone",
			"board.clips": "{count} clips",
			"board.episodes": "{count} episodes",
			"fragments.empty": "Start creating",
			"chat.empty": "This project has no session yet",
			"chat.newChat": "New chat",
			"chat.emptyHint": "The episode folder is the session cwd; a new chat lands in the session list.",
			"chat.unsupported": "This shell cannot embed a conversation; continue in the session panel.",
			"chat.preparing": "Preparing the conversation…",
			"studio.empty": "Pick a clip on the left",
			"inspector.empty": "Pick a clip on the left",
			"common.close": "Close",
			"common.empty": "(empty)",
			"common.crash": "This section failed to render",
			"common.retry": "Retry",
			"common.loading": "Loading…",
			"settings.title": "Dream Studio settings",
			"fragments.project": "Project",
			"fragments.episode": "Episode",
			"fragments.import": "Import",
			"fragments.emptyLibrary": "This library is empty — use Import.",
			"fragments.ready": "Start creating~",
			"fragments.drafts": "{count} drafts",
			"fragments.episodeDrafts": "Episode assets · {count} drafts",
			"fragments.noDrafts": "No drafts for this clip yet — write a prompt and generate one.",
			"fragments.pendingRef": "To generate",
			"fragments.adopt": "Adopt",
			"fragments.useDraftPrompt": "Click to reuse this prompt",
			"fragments.dropRef": "Drop reference (max 4)",
			"fragments.readyHint": "The left column is this episode's library. Pick one to redraw, or drag it into a slot on the right.",
			"fragments.t2i": "Text→image",
			"fragments.i2i": "Image→image",
			"fragments.size": "Short side",
			"fragments.tile": "Tile",
			"fragments.cfg": "CFG",
			"fragments.steps": "Steps",
			"fragments.tileX": "Cols",
			"fragments.tileY": "Rows",
			"fragments.prompt": "Prompt",
			"fragments.promptHint": "Shot size, subject, scene and light; apply the result as the asset picture",
			"fragments.generate": "Generate picture",
			"studio.generateAll": "Generate all",
			"studio.queued": "Queued",
			"studio.exportClips": "Export all clips",
			"studio.exportHintEmpty": "No rendered clip to export yet",
			"assistant.rewrite": "Rewrite",
			"inspector.firstFrame": "First frame",
			"inspector.lastFrame": "Last frame",
			"inspector.clear": "Clear",
			"inspector.continuation": "Continue",
			"inspector.secondPass": "Second pass",
			"inspector.firstPassTiled": "First-pass tiling",
			"inspector.secondPassTiled": "Second-pass tiling",
			"inspector.resolution": "Resolution",
			"inspector.ratio": "Aspect",
			"inspector.secondSteps": "2nd steps",
			"inspector.secondScale": "2nd-pass size",
			"inspector.secondDenoise": "Denoise",
			"inspector.standaloneSecondPassShort": "2nd pass",
			"inspector.videoUpscale": "Upscale video",
			"inspector.videoUpscaleHint": "Reads this clip and upscales it with RelayVSR to 2K / 4K",
			"inspector.videoInterpolate": "Interpolate",
			"inspector.kindExists": "This clip already has a {kind} video — delete it in the video history before generating another.",
			"inspector.videoInterpolateHint": "Reads this clip and adds the chosen number of frames per second (default 10)",
			"inspector.standaloneSecondPassHint": "Repaints the latent left by the first pass at the upscale, denoise, and step values above; no need to tick Second pass.",
			"inspector.standaloneSecondPassFrames": "Not available in first/last-frame mode; use Reference mode with keyframes instead.",
			"inspector.standaloneSecondPassDone": "This clip was already upscaled by the standalone 2nd pass; clicking again re-upscales with the current values.",
			"inspector.standaloneSecondPassNoLatent": "This clip has no first-pass render yet, so there is no latent to enlarge. Render a first pass, then run the standalone 2nd pass.",
			"inspector.standaloneSecondPassBusy": "This clip is still rendering — wait for it to finish before enlarging.",
			"inspector.loras": "LoRA",
			"inspector.loraStrength": "Weight",
			"inspector.remove": "Remove",
			"inspector.promptZh": "Chinese",
			"inspector.promptEn": "English",
			"inspector.syncOut": "Sync",
			"inspector.syncOutHint": "Write duration / refs / prompt of this episode back to series.json so a rescan will not revert them",
			"inspector.loadingModel": "Loading…",
			"inspector.finishing": "Decoding the video…",
			"inspector.generate": "Generate",
			"inspector.cancel": "Cancel",
			"inspector.follow": "Follow",
			"inspector.keyframes": "Keyframes",
			"inspector.noKeyframe": "This clip has no keyframes (from series)",
			"shell.sync": "Rescan",
			"shell.syncing": "Scanning…",
			"shell.episode": "Episode",
			"tree.noClips": "This episode has no clips yet",
			"tree.clip": "Clip {index}",
			"board.openProject": "Open project",
			"studio.noVideo": "No film yet",
			"studio.film": "Film",
			"inspector.mode": "Frames",
			"inspector.modeReference": "Reference",
			"inspector.duration": "Duration",
			"inspector.durationGrid": "{frames} frames · {fps}fps (H3 grid)",
			"inspector.steps": "Steps"
		};
		// src/client/index.ts
		/** 需要的客户端服务：只在有这些座位时才注册。 */
		/** 两个目录是不是同一个（Windows 上大小写与斜杠都不敏感）。 */
		function samePath(left, right) {
			const norm = (value) => value.replace(/\\/gu, "/").replace(/\/+$/u, "").toLowerCase();
			return norm(left) === norm(right);
		}
		const inject = [
			"slots",
			"locale",
			"sessions",
			"workspaces",
			"uiWorkspace",
			"layout"
		];
		/** 面板 id。 */
		const PANEL_ID = "dream-studio";
		/** 设置节的位置（排在出厂设置页之后）。 */
		const SETTINGS_ORDER = 40;
		/**
		* 注册入口、主面板与设置节。
		* @param ctx - 客户端根上下文。
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				listSessions: (dirPath) => {
					const sessions = ctx.sessions.list.getSnapshot();
					const workspaces = ctx.workspaces.list.getSnapshot();
					const archived = new Set(workspaces.archivedSessionIds.map((id) => String(id)));
					const listed = sessions.ids.map((id) => String(id)).filter((id) => !archived.has(id) && sessions.byId[id] !== void 0);
					const workspace = dirPath === null ? void 0 : workspaces.items.find((entry) => samePath(entry.path, dirPath));
					return (workspace === void 0 ? listed : workspace.sessionIds.map((id) => String(id)).filter((id) => listed.includes(id))).map((id) => ({
						id,
						title: sessions.byId[id]?.displayTitle ?? id,
						cwd: sessions.byId[id]?.cwd ?? workspace?.path ?? "",
						active: sessions.current !== void 0 && String(sessions.current) === id,
						blank: sessions.byId[id]?.blank === true
					}));
				},
				createSession: async (cwd) => {
					const workspace = await ctx.workspaces.create({ path: cwd });
					const workspaceId = typeof workspace === "string" ? workspace : typeof workspace?.workspaceId === "string" ? String(workspace.workspaceId) : void 0;
					const created = await ctx.sessions.create(workspaceId === void 0 ? { cwd } : { workspaceId });
					if (typeof created === "string" && created !== "") return created;
					const shaped = created;
					if (typeof shaped?.id === "string" && shaped.id !== "") return shaped.id;
					return null;
				},
				retainSession: (sessionId) => ctx.sessions.retain(sessionId, { source: "dreamStudioEmbedded" }),
				openSessionList: () => {
					ctx.get("layout")?.selectPanel?.(null);
				},
				registerWorkspace: async (dir) => {
					const created = await ctx.workspaces.create({ path: dir });
					return typeof created?.workspaceId === "string" ? created.workspaceId : null;
				},
				pickDirectory: async () => {
					const workspace = ctx.get("uiWorkspace");
					return workspace?.pickDirectory === void 0 ? null : await workspace.pickDirectory();
				}
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dream-studio dictionaries");
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.inject("main", function* () {
				yield ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_ID,
					order: -100,
					label: () => t("app.name"),
					locale: NS
				}, HallMark);
				yield ctx.slots.register({
					name: "main",
					key: PANEL_ID,
					locale: NS,
					inject: injected,
					children: { "dream-studio.embedded.chat": {
						kind: "single",
						scope: "session"
					} }
				}, StudioPanel);
				yield ctx.slots.register({
					name: "dream-studio.embedded.chat",
					locale: NS
				}, EmbeddedChat);
			}));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: PANEL_ID,
				order: SETTINGS_ORDER,
				label: () => t("settings.title"),
				locale: NS
			}, SettingsPage));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

