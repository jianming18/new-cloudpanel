# CNB 云原生构建说明

本仓库通过根目录的 [`.cnb.yml`](../.cnb.yml) 接入 [CNB 云原生构建](https://docs.cnb.cool/zh/build/intro.md)，
在代码推送、PR、打 Tag 时自动构建前后端 Docker 镜像，并发布到 **CNB Docker 制品库**。

它与 [GitHub Actions 工作流](../.github/workflows/docker-publish.yml) 相互独立：
GitHub Actions 发布到 `ghcr.io`，CNB 流水线发布到 `docker.cnb.cool`，两者不会互相覆盖。

## 触发规则

| 事件 | 分支 / Tag | 构建 | 推送制品 | 镜像 Tag |
|---|---|---|---|---|
| `push` | `main` | 是 | 是 | `latest`、`<8 位短 sha>` |
| `pull_request` | `main` | 是 | 否 | 仅本地构建，校验 Dockerfile 可构建 |
| `tag_push` | 任意 Tag | 是 | 是 | `<版本号>`、`latest` |

版本号规则：Tag 构建取 `CNB_BRANCH`（即 Tag 名）去掉开头的 `v`，例如 `v1.2.3` → `1.2.3`；
其余构建取 `CNB_COMMIT_SHORT`（提交 SHA 前 8 位）。

> PR 事件下 `CNB_TOKEN` 权限受限，因此流水线通过 `PUSH=false` 跳过登录与推送，只做构建校验。

## 产物

流水线构建两个镜像，分别对应 `docker-compose.yml` 中的 `api` 与 `web` 服务：

| 服务 | 构建文件 | 镜像地址 |
|---|---|---|
| 后端 API | [`Dockerfile`](../Dockerfile) | `docker.cnb.cool/<组织>/<仓库>` |
| 前端面板 | [`Dockerfile.frontend`](../Dockerfile.frontend) | `docker.cnb.cool/<组织>/<仓库>/web` |

地址由内置变量 `CNB_DOCKER_REGISTRY` 与 `CNB_REPO_SLUG_LOWERCASE` 拼出，
对应 CNB 制品库的「同名制品」和「非同名制品」两种路径规则，无需在配置里写死仓库名。

推送后可直接拉取使用：

```bash
docker pull docker.cnb.cool/<组织>/<仓库>:latest
docker pull docker.cnb.cool/<组织>/<仓库>/web:latest
```

如需让 `docker-compose.yml` 改用 CNB 镜像，把其中的 `ghcr.io/jianming18/new-cloudpanel`
替换为上面的地址即可（`IMAGE_TAG` 环境变量同样适用）。

## 流水线结构

```text
.build-pipeline (YAML 锚点，被三个事件复用)
├── services: docker            声明 Docker-in-Docker，脚本里可直接用 docker 命令
├── env.PUSH                    "true" 推送；PR 流水线覆盖为 "false"
└── stages
    ├── 登录 CNB Docker 制品库   PUSH=true 时用 CNB_TOKEN 免密登录
    ├── 构建并推送后端镜像       docker build -f Dockerfile + docker push
    └── 构建并推送前端镜像       docker build -f Dockerfile.frontend + docker push
```

关键点：

- **免密登录**：`CNB_TOKEN` 是流水线运行期临时令牌，构建结束自动销毁；
  `CNB_TOKEN_USER_NAME` 固定为 `cnb`。令牌在日志中会自动打码，无需配置密钥仓库。
- **共用一份 stages**：用 YAML 锚点 `&build-pipeline` / 别名 `*build-pipeline` 复用配置，
  PR 流水线通过覆盖 `env.PUSH` 关掉推送，避免三份重复配置。
- **Tag 事件写在 `$` 下**：`tag_push` 与分支无关，按 CNB 约定挂在兜底分支 `$`，匹配所有 Tag。
- **架构**：默认使用构建节点架构（`linux/amd64`），未启用 QEMU 多架构构建。
- **离线依赖**：后端镜像直接使用仓库内提交的 `wheels/` 目录做离线安装，
  构建过程不依赖 PyPI；前端由 `Dockerfile.frontend` 内的 `pnpm fetch` 拉取依赖。

## 前置条件

1. 仓库已开启云原生构建的**自动触发**（`设置 → 云原生构建 → 允许自动触发`）。
   Fork 仓库默认不自动触发 Git 事件，需要单独开启。
2. 触发者具备制品库写权限（ push / tag_push 属于可信事件，`CNB_TOKEN` 默认带
   `registry-package:rw`）。
3. 仓库的 Docker 制品库已启用（首次 `docker push` 会自动创建同名制品）。

无需在仓库里保存任何账号密码，也无需创建密钥仓库。

## 构建状态徽章

CNB 会自动上报 `push` 事件的构建状态，可在 README 顶部加入（把 `group/repo` 换成实际路径）：

```markdown
[![CNB 构建状态](https://cnb.cool/group/repo/-/badge/git/latest/ci/status/push)](https://cnb.cool/group/repo)
```

`latest` 可取默认分支最新一次构建，追加 `?branch=main` 可指定分支，换成 8 位 SHA 可固定某次提交。

## 本地验证

在提交 `.cnb.yml` 前，可在本地先验证两个 Dockerfile 能正常构建：

```bash
# 后端（使用仓库内已提交的 wheelhouse，离线安装）
docker build -f Dockerfile --build-arg VERSION=local -t cloudpanel-api:local .

# 前端（pnpm 依赖需要联网）
docker build -f Dockerfile.frontend --build-arg VERSION=local -t cloudpanel-web:local .
```

也可在 CNB 仓库页面用「流水线可视化」预览触发逻辑，或用云原生开发环境在线调试配置语法。

## 维护依赖

后端镜像通过 `Dockerfile` 里的 `pip install --no-index --find-links=/wheels` 完全离线安装，
因此**修改 `requirements.txt` 后必须重新生成 `wheels/`**，否则 CNB 构建会因缺少 wheel 失败：

```bash
pip download -r requirements.txt --only-binary=:all: -d wheels/
```

请用 Python 3.11 执行（`Dockerfile` 基础镜像为 `python:3.11-slim`），保证环境标记解析正确。
GitHub Actions 的 `build-api` 任务会在每次构建时自动重新生成 wheelhouse，可作为对照。

前端依赖由 `frontend/pnpm-lock.yaml` 锁定，`Dockerfile.frontend` 使用
`pnpm fetch` + `pnpm install --frozen-lockfile --offline`，修改依赖后记得同步锁文件。

## 与 GitHub Actions 的差异

| 项目 | CNB 云原生构建 | GitHub Actions |
|---|---|---|
| 配置位置 | `.cnb.yml` | `.github/workflows/docker-publish.yml` |
| 制品库 | `docker.cnb.cool/...`（CNB Docker 制品库） | `ghcr.io/...` |
| 认证 | 内置 `CNB_TOKEN` 免密 | `GITHUB_TOKEN` + `docker/login-action` |
| 后端依赖 | 直接用仓库内提交的 `wheels/` | CI 中 `pip download` 重新生成 |
| 多架构 | 单架构（默认 amd64） | Tag 构建用 QEMU + buildx 产出 amd64/arm64 |
| PR 行为 | 仅构建校验，不推送 | 仅构建（`push: false`），不推送 |

两套流水线各自独立运行，可只保留其中一套，也可同时保留做双 registry 发布。

## 常见问题

**Q：推送后 `latest` 没更新？**
确认推送的是 `main` 分支或 Tag；其他分支未配置流水线。也检查仓库是否开启了「允许自动触发」。

**Q：PR 构建成功但没有制品？**
这是预期行为，PR 事件只校验构建。合并到 `main` 后由 `push` 事件发布。

**Q：`docker push` 报权限错误？**
检查触发者是否有制品库写权限；Fork 仓库的 `CNB_TOKEN` 仅限当前仓库，
跨仓场景需在组织设置中放开对应权限。

**Q：想增加其他分支？**
在 `main:` 同级追加分支配置即可，例如：

```yaml
dev:
  push:
    - <<: *build-pipeline
      name: dev 构建
```

## 参考文档

- [配置文件 `.cnb.yml`](https://docs.cnb.cool/zh/build/configuration.md)
- [语法手册](https://docs.cnb.cool/zh/build/grammar.md)
- [触发规则](https://docs.cnb.cool/zh/build/trigger-rule.md)
- [默认环境变量](https://docs.cnb.cool/zh/build/build-in-env.md)
- [Docker 制品库](https://docs.cnb.cool/zh/artifact/docker.md)
- [精简配置（YAML 锚点）](https://docs.cnb.cool/zh/build/simplify-configuration.md)
- [构建状态徽章](https://docs.cnb.cool/zh/develops/badge.md)
