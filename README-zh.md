# claude-code-harness-kit

`claude-code-harness-kit` 是一个轻量级 CLI 加脚手架工具，用于让任何代码仓库更易于以 harness 风格的 Claude Code 工作流运行。

它不试图成为一个新的 agent 平台。v1 版本有意保持精简，仅帮助解决五件事：

1. 状态恢复
2. 项目记忆
3. 决策日志
4. 任务契约
5. 最小化的验证入口

## 它解决了什么问题

长时间的 Claude Code 任务在上下文仅存于聊天记录时容易中断。新会话会丢失当前目标，任务范围在执行中途发生偏移，反复失败会触发更多猜测，重要决策也会随之消失。

这个工具包将工作流中的持久性部分移入代码仓库文件中，使新会话在编写代码之前能够从仓库本身恢复上下文。

## 为什么适合长任务和多会话协作

harness 文件使仓库对人类和 Claude Code 都可读：

- `docs/harness-state.json` 存储当前目标、状态、阻塞项、契约及最近的验证结果。
- `docs/project-memory.md` 存储持久性偏好和反复出现的陷阱。
- `docs/decisions.md` 存储明确的权衡与决策。
- `docs/contracts/` 存储包含验收条件和验证备注的任务契约。
- `CLAUDE.md` 是活跃的指令来源。对于已有自定义 `CLAUDE.md` 的仓库，工具会在其中添加一个小型激活桥接块，并将详细的 harness 规则写入 `CLAUDE.harness.md`。

这意味着新会话可以从仓库上下文开始，而不必尝试从旧消息中重建意图。

生成的 `CLAUDE.md` 模板还会告诉 Claude Code：在重新读取 harness 文件之前忽略过时的会话上下文，并在每次有意义的任务结束时更新 harness 状态以及任何持久性决策或记忆记录。

## 非目标

v1 版本有意不包括：

- 多 agent 编排
- 后台守护进程
- Web UI
- 数据库
- 云服务
- 自动文件监听
- 插件或 MCP 生态系统
- 新的聊天界面

## 安装与运行

本仓库已具备 npm 支持。如果你直接使用源码仓库，请使用下方的本地开发路径。包发布后，npm 安装路径即可使用。

发布的包（发布后）：

```bash
npx claude-code-harness-kit init
```

从本仓库进行本地开发：

```bash
npm install
npm run build
node dist/src/cli.js --help
```

或者链接本地检出版本：

```bash
npm link
claude-code-harness-kit --help
```

## CLI 命令

```bash
claude-code-harness-kit init [path] [--force]
claude-code-harness-kit check-state [path]
claude-code-harness-kit validate-harness [path]
```

### `init`

在当前目录或指定目标路径下生成最小化的 harness 文件。

默认创建的文件：

- `CLAUDE.md`
- `docs/harness-config.json`
- `docs/harness-state.json`
- `docs/project-memory.md`
- `docs/decisions.md`
- `docs/contracts/README.md`
- `docs/contracts/example-contract.md`

当目标仓库已有自己的 `CLAUDE.md` 时，`init` 还会写入：

- `CLAUDE.harness.md`

安全行为：

- 默认不覆盖已有文件。
- 重复运行 `init` 是安全的，大多数情况下结果为 `unchanged` 或 `skipped`。
- 如果目标仓库已有 `CLAUDE.md`，此工具会保留已有内容，并向该文件追加一个基于标记的激活桥接块。
- 在同样的情况下，详细的 harness 规则会写入 `CLAUDE.harness.md`。
- 重复运行 `init` 不会重复添加桥接块。
- 仅在你明确希望 harness 管理的文件被覆盖时，才使用 `--force`。

### `check-state`

读取 harness 配置和状态，然后打印简洁摘要：

- 当前目标
- 当前状态
- 当前契约
- 阻塞项
- 最近的验证结果
- 下一步建议

如果文件缺失或无效，会打印清晰的错误信息及恢复提示。

### `validate-harness`

检查关键 harness 文件是否存在、必要的 JSON 是否有效、必填字段是否存在，以及 harness 是否已在 `CLAUDE.md` 中激活。

它不止于标记检测。验证器还会检查 claude-harness-kit 桥接块和 harness 块是否仍包含非空的、可识别的激活/工作流内容。

这意味着 `validate-harness` 在以下情况下会失败：

- 存在一个普通的 `CLAUDE.md` 但没有 claude-harness-kit 块
- `CLAUDE.harness.md` 存在但 `CLAUDE.md` 未桥接或合并它
- 桥接存在但 harness 补充文件缺失或格式错误
- 桥接或 harness 标记仍然存在，但其实际指令已被手动编辑掉，只剩空壳

## 初始化空仓库

安装后最快的首次使用路径：

```bash
claude-code-harness-kit init
claude-code-harness-kit check-state
claude-code-harness-kit validate-harness
```

在目标仓库内部：

```bash
claude-code-harness-kit init
```

或从其他位置：

```bash
claude-code-harness-kit init /path/to/repo
```

## 初始化已有仓库

在已有仓库中运行相同的 `init` 命令。

如果仓库已有自己的 `CLAUDE.md`，工具会：

1. 保留已有内容
2. 向 `CLAUDE.md` 追加一个明确标记的 claude-harness-kit 激活桥接块
3. 将详细的 harness 工作流写入 `CLAUDE.harness.md`

这样可以保持仓库安全且可读，同时让 harness 成为活跃的指令来源，而不是被忽略的附属文件。

## 什么算作"harness 已激活"

只有当 `CLAUDE.md` 明确包含 claude-harness-kit 指令时，harness 才被视为已激活。

有两种有效状态：

1. `CLAUDE.md` 包含完整的 claude-harness-kit harness 块。
2. `CLAUDE.md` 包含 claude-harness-kit 桥接块，且该桥接指向一个有效的 `CLAUDE.harness.md`。

仅有一个无关的 `CLAUDE.md` 文件是不够的。仅有 `CLAUDE.harness.md` 也是不够的。

## 初始化后该告诉 Claude Code 什么

这些提示词有意保持简洁。harness 文件承载了持久性的详细信息。

最小化示例：

- `恢复状态并继续。`
- `先更新契约，然后实现。`
- `暂不修改代码；告诉我当前的阻塞项。`
- `将这个决策写入项目记忆。`
- `忽略旧的会话上下文，从 harness 文件恢复状态，然后继续。`
- `通过更新 harness-state 来收尾，然后报告验证情况和下一步。`

## 推荐的 Claude Code 工作流

1. 从 harness 文件恢复状态开始。
2. 如果范围或验收条件发生变化，更新契约。
3. 仅实现已限定范围的任务。
4. 运行最小化的有意义验证命令。
5. 会话结束前，更新状态以及任何持久性决策或记忆记录。

## 自定义验证命令

初始化后编辑 `docs/harness-config.json`：

```json
{
  "commands": {
    "verifyQuick": "npm test",
    "verifyFull": "npm run verify",
    "docsGenerate": ""
  }
}
```

`check-state` 和 `CLAUDE.md` 规则假定这些命令描述了仓库的最小化和更完整的验证步骤。

## 路径配置与恢复

固定入口点为 `docs/harness-config.json`。

`CLAUDE.md` 指令有意告知 Claude Code 先读取该配置，然后遵循：

- `paths.stateFile`
- `paths.memoryFile`
- `paths.decisionsFile`
- `paths.contractsDir`

因此，如果你之后移动了状态或记忆文件，只需更新 `docs/harness-config.json`，harness 指令依然有效。如果契约文件移动，也应更新状态文件中的活跃契约路径。

## 如果初始化未激活 harness

运行：

```bash
claude-code-harness-kit validate-harness
```

如果激活验证失败：

1. 重新运行 `claude-code-harness-kit init`
2. 检查 `CLAUDE.md` 是否包含 claude-harness-kit 块或桥接标记
3. 如果仓库使用桥接，检查 `CLAUDE.harness.md` 是否存在且仍包含 harness 管理的块

## 在其他项目中使用

在该包发布之前，最简单的方式是：

1. 克隆本仓库
2. 运行 `npm install && npm run build`
3. 使用 `node /path/to/claude-code-harness-kit/dist/src/cli.js init /path/to/target-repo`

或使用 `npm link` 全局链接。

## 可选的本地 Claude Code 技能

本仓库还在 [`extras/claude-skills/`](extras/claude-skills/README.md) 下包含两个可选的本地 Claude Code 技能：

- `claude-harness-workflow`
- `claude-harness-wrap-up`

这些是为经常使用 Claude Code 且希望使用更短启动/结束提示词的用户提供的便捷快捷方式。它们不是 npm 包契约的一部分，主要产品仍然是：

- CLI
- 生成的仓库文件
- `CLAUDE.md` 工作流

将它们手动安装到你的个人 Claude Code 设置中：

```bash
mkdir -p ~/.claude/skills
cp -R extras/claude-skills/claude-harness-workflow ~/.claude/skills/
cp -R extras/claude-skills/claude-harness-wrap-up ~/.claude/skills/
```

然后启动新的 Claude Code 会话。使用 `/claude-harness-workflow` 和 `/claude-harness-wrap-up` 调用。

## v1 版本的假设

- 默认布局使用 `docs/` 目录，因为它在普通仓库中保持可读性。
- JSON 有意保持精简和明确，而不是引入 DSL。
- 验证命令由仓库所有者配置；工具包不会猜测它们。

## 开发

```bash
npm run build
npm run typecheck
npm test
npm run verify
```

`npm run verify` 目前运行：

1. TypeScript 类型检查
2. 构建
3. Node 内置测试

## 当前限制

- `check-state` 汇总活跃的契约路径和标题，但尚不解析验收条件。
- `validate-harness` 仅验证最小化的 v1 文件集。
- CLI 不会为你编辑状态或契约；它负责搭建和验证工作流。
