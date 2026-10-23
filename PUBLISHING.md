# 发布清单

## 1. 建仓库

- GitHub 仓库名：`Notoonex/dsh-project-board`
- 仓库地址：<https://github.com/Notoonex/dsh-project-board>
- 给仓库加 topic：`dsh-plugin`
- 推送本目录（不要包含 `~/.dsh` 下的运行数据）

## 2. 本地验收

```bash
npm test
node skill/scripts/lint.mjs examples/demo
```

再用一个干净的 DSH profile 安装一次，确认：

- 右侧栏出现「项目看板」；
- `~/.dsh/skills/project-board/` 被自动安装；
- 浅色 / 深色都能看清；
- 勾选能回写。

## 3. 发布到 DSH 插件市场

- 提交入口：<https://dsh-plugin.org/zh/submit>
- 官方说明：<https://www.npmjs.com/package/dsh-plugin>
- 市场会按 GitHub `dsh-plugin` topic 自动发现并人工审核。

需要在仓库里准备好：

- `README.md`（安装、配置、截图）
- `LICENSE`
- `CHANGELOG.md`
- `package.json` 的 `version` / `description` / `keywords`
- 无个人路径、无真实项目数据、无 `.bak`

## 4. 只发 Skill

如果只想发技能、不带 UI：

- 在 `dsh-skills-marketplace` 中「添加插件市场」；
- Git 地址填本仓库；
- 稀疏路径填 `skill`。

参考：<https://www.npmjs.com/package/dsh-skills-marketplace>

## 5. 版本

```bash
npm version patch   # 0.1.0 -> 0.1.1
```

然后更新 `CHANGELOG.md`，打 tag：

```bash
git tag v0.1.1
git push --tags
```

## 6. 发布前自检

- [ ] `npm test` 全绿
- [ ] `lint` 对示例项目 0 error
- [ ] 搜过个人路径、域名、服务器 IP（如 `/Users/`、内网 IP 段），无结果
- [ ] 截图是通用项目，不含真实域名/服务器 IP
- [ ] `package.json` 版本号与 CHANGELOG 一致
- [ ] 仓库有 `dsh-plugin` topic
