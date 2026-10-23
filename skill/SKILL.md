---
name: project-board
description: "Manage a project's single record system: one progress board (node registry + tasks) and one decision ledger per project. Use when adding or updating todos, recording or superseding decisions, checking project status, initializing a new project's structure, or migrating a legacy board. Enforces node-based filing, stable IDs, strict file pairing, and derived summaries."
---

# project-board

每个项目只有两份权威记录：**进度看板**（结构 + 任务）和**决策台账**（决策）。
所有 agent 都按本流程读写；不允许另开清单、另存草稿。

## 先判断模式

读 `<Project> 进度看板.md` 的 frontmatter：

| frontmatter | 模式 | 下一步 |
|---|---|---|
| 没有 `schema:` | **init** | 读 `references/init.md`，走「探测 → 提议 → 人确认 → 写盘」 |
| `schema: project-board/1` | **operate** | 读 `references/operate.md` |

再按 `archetype` 读且只读一个域包：

| archetype | 域包 |
|---|---|
| `web-app` / `landing` / `content` | `references/packs/web.md` |
| `business` / `internal-tool` | `references/packs/business.md` |
| `life` / `research` | `references/packs/life.md` |

字段与格式定义见 `references/schema.md`。

## 文件（固定配对）

| 文件 | 作用 |
|---|---|
| `<Project> 进度看板.md` | frontmatter 节点注册表 + `## 节点` + 任务复选框 |
| `<Project> 决策台账.md` | 只有决策，扁平按 ID 排序，无章节骨架 |

> **路径约定**
> - `DSH_PROJECTS_DIR`：项目根目录，默认 `~/Documents/Projects`
> - `DSH_SKILL_DIR`：本 skill 安装目录，默认 `~/.dsh/skills/project-board`
> - 下面的命令按这两个变量书写；环境不同时先设好再执行。

- 目录：`$DSH_PROJECTS_DIR/<目录>/`
- 后缀固定为 ` 进度看板.md` / ` 决策台账.md`，每个目录**各恰好一个**。
- 两份文件 stem 必须一致，且 frontmatter 的 `project:` 必须等于 stem。
- 可选：`踩坑.md`（只放教训）、`README.md`（定位/背景）。
- 禁止：`16-*.md`、`41-*.md`、`00-*.md` 之类的并行清单；禁止把可勾选任务放进表格。

## 不变式（不可协商）

1. 一个项目 = 一份看板 + 一份台账；不新建第三份记录。
2. 节点 = 持久的、可独立验收的产品面/领域，不是任务、不是阶段。
3. 节点注册表只在看板 frontmatter 出现一次；台账不复制章节骨架。
4. 一条任务只属于一个节点；一条决策只属于一个主节点（跨节点写「影响」）。
5. 编号稳定、不复用；决策编号 `D-<节点>-<序号>`，节点内自增；旧编号冻结不重排。
6. 能派生的状态不手写（进度、未完成、待拍板、停滞）。
7. 结构变更（新增/合并/改名节点）必须先写一条结构决策，再动结构。

## 写入纪律

- **先定位节点，再写内容。** 落不下 → 先提议新节点，不允许在顶层追加。
- 一条任务 = 一个能判断完成的结果；必须有验收口径。
- 完成即改 `- [x] ~~...~~`，保留不删；证据（commit / 链接）写在同一行。
- 决策只追加；被推翻时改 `状态: 已被取代` 并写 `取代者:`，不删除。
- 记录当场写，不攒到回合结束。
- 待你拍板的任务保留 `[[主题]]` 前缀；对应决策在台账里用 `状态: 待拍板`。

## 校验

改完后必须跑：

```bash
node "${DSH_SKILL_DIR:-$HOME/.dsh/skills/project-board}/scripts/lint.mjs" "${DSH_PROJECTS_DIR:-$HOME/Documents/Projects}/<目录>"
```

有 error 就修完再交付；warning 至少读一遍。

## PWF 桥接

`task_plan.md` / `.planning/` 只是临时草稿。里程碑或阻塞一旦确定，立刻落进看板或台账；侧栏（如安装了 project-board 插件）只读这两份文件。
