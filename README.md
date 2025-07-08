# Qiros Server - SillyTavern Git 协作插件后端

[![许可证: AGPL-3.0](https://img.shields.io/badge/License-AGPL_v3-red.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![版本](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/MAX-TAB/qiros-server)

[English Version](README_en.md)

这是一个为 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 设计的插件，它提供了强大的后端服务，用于处理所有与 Git 和 GitHub 相关的操作。它是 [Qiros 前端插件](https://github.com/MAX-TAB/st-extension-qiros) 的核心依赖。

通过本插件，您可以将角色卡的创作与维护，从孤立的个人工作，转变为一个可版本化、可追溯、可协同的结构化工程。

## 核心架构

本插件采用**数据与载体分离**的原则，为您提供稳定、高效、可协作的角色卡管理方案：

- **数据 (`character.json`)**: 角色的核心定义，包括描述、性格、对话示例等所有文本信息。这部分是协作和版本控制的**主角**，将通过 Git 在云端同步。
- **载体 (`card.png`)**: 角色图片。它在本地作为数据的“容器”，其图像本身**不会**被上传或修改。所有云端的数据更新都将以“无痕”的方式注入到您本地的图片中。

## 主要功能

- **GitHub OAuth 认证**: 安全可靠的用户身份验证流程。
- **仓库管理**: 在插件内创建或关联远程 GitHub 仓库。
- **版本化文本数据**: 只对核心的 `character.json` 文件进行推送 (Push)、拉取 (Pull)、版本历史查看、差异比对和版本回滚。
- **无痕本地更新**:
  - **拉取/回滚**: 从云端获取指定版本的 `character.json` 后，插件会自动将其注入您本地的 `card.png` 文件中，实现对现有角色的无缝更新，而无需手动替换图片。
  - **推送**: 只将您本地的 `character.json` 数据推送到仓库，完全不涉及图片文件。
- **分支与发布管理**: 支持分支的创建、查看，以及一键创建包含 `character.json` 附件的 GitHub Release。
- **协作流程**: 支持仓库的复刻 (Fork) 和拉取请求 (Pull Request) 的创建。

## 安装教程

**第一步：启用 SillyTavern 服务器插件**

1.  打开 SillyTavern 的配置文件 `config.yaml`。
2.  找到并修改以下两项为 `true`：
    ```yaml
    enableServerPlugins: true
    enableServerPluginsAutoUpdate: true
    ```

**第二步：安装 Qiros 服务器后端**

- **使用 `git clone` (推荐):**

  1.  打开终端或命令行。
  2.  进入 SillyTavern 的 `plugins` 目录: `cd path/to/SillyTavern/plugins`
  3.  运行克隆命令: `git clone https://github.com/MAX-TAB/qiros-server.git`

- **手动安装:**
  1.  在 [qiros-server 的 GitHub 页面](https://github.com/MAX-TAB/qiros-server) 点击 `Code` -> `Download ZIP`。
  2.  将解压后的文件夹移动到 `SillyTavern\plugins` 目录下。

**第三步：获取 GitHub OAuth 密钥**

1.  确保你有一个 GitHub 账户。
2.  访问 https://github.com/settings/developers 并点击 **New OAuth App**。
3.  填写以下信息：
    - **Application name**: 任意填写
    - **Homepage URL**: `http://localhost:8000`
    - **Application description**: 任意填写或留空
    - **Authorization callback URL**: `http://localhost:8000/api/plugins/qiros-server/github_callback`
    - **Enable Device Flow**: 随意勾选或不勾选
4.  点击 **Register application**。

**第四步：配置环境变量**

1.  在刚刚创建的 OAuth Application 页面中，点击 **Generate a new client secret**。
2.  复制并记下 **Client ID** 和新生成的 **Client secret**。
3.  在 `SillyTavern\plugins\qiros-server` 文件夹内，新建一个名为 `.env` 的文件。
4.  在 `.env` 文件中填入以下内容，并替换成你自己的 ID 和 Secret：

```env
GITHUB_CLIENT_ID=你刚记下的Client ID
GITHUB_CLIENT_SECRET=你刚记下的Client secret
```

至此，后端配置完成。

**第五步：安装前端插件**

1.  打开 SillyTavern。
2.  在插件安装界面中，输入以下 URL 进行安装：
    `https://github.com/MAX-TAB/st-extension-qiros`
3.  正常完成安装即可。
