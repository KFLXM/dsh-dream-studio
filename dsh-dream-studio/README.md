# 时空造梦（DSH 插件）

这是可以直接被 DeepSeek Harness 安装的插件目录，不是源码仓库。

## 安装

- DSH 桌面端：**插件 → 添加插件 → 选择本目录**（或把本目录路径交给 `plugin_manager` 的 `install_bundle`）。
- 安装器会把本目录登记进 profile 的 bundle 列表，**不要**手工改 profile 的 `package.json` / `cordis.yml`。

## 附带内容

装好本包后，除了导演台页签，还会多出：

- **Agent 预设「造梦助手」**：设置 → Agent 预设里可选，新会话选中后进入「漫剧编剧 + 剧本医生」人设
  （写剧本前建账本、交付前自评 + 冷读）。不想用可以忽略，不影响导演台功能。
- **技能 story-doctor**：随包放在 `skills/story-doctor`，但 DSH 只扫描用户技能目录，
  需要复制一次（改完 watch 会自动刷新）：

```
robocopy skills\story-doctor %USERPROFILE%\.dsh\skills\story-doctor /MIR
```

`dream-studio-h3`、`manju-lens`、`office` 等技能**不随包**，需要各自另行安装。

## 从旧的两包安装升级

旧的安装方式把 `dsh-dream-studio-host` 和 `dsh-dream-studio-ui` 两个包分别链进 profile。
本包把两边合成了一个 bundle，装之前请在「插件」里移除这两个旧包（否则会挂两份面板），再添加本目录。

## 结构

```
package.json        清单（dsh.bundle.patch + dsh.client）
cordis.patch.yml    两段 insert：导演台本体 + 随包的「造梦助手」agent 预设
lib/index.js        宿主半边（工作区 shared 已内联）
lib/client.js       浏览器半边（__ModuleLoader__ factory，id = 包名）
lib/*.sql           内置 SQLite 建表脚本
resources/workflows 内置 ComfyUI 工作流模板
resources/ffmpeg    可选，ffmpeg/ffprobe
skills/story-doctor 随包技能（需复制进用户技能目录才生效，见下）
locale/*.json       插件列表里的标题与描述
```
