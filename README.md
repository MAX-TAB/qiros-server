# Qiros Server - SillyTavern Git 协作插件后端

[![许可证: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![版本](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/MAX-TAB/qiros-server)

[English Version](README_en.md)

这是一个为 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 设计的插件，它提供了强大的后端服务，用于处理所有与 Git 和 GitHub 相关的操作。它是 [Qiros 前端插件](https://github.com/MAX-TAB/st-extension-qiros) 的核心依赖。

通过本插件，您可以将角色卡的创作与维护，从孤立的个人工作，转变为一个可版本化、可追溯、可协同的结构化工程。

## 主要功能

- **GitHub OAuth 认证**: 安全可靠的用户身份验证流程。
- **仓库管理**: 在插件内创建或关联远程 GitHub 仓库。
- **核心 Git 操作**: 实现对角色卡 (`character.json`) 和角色图片 (`card.png`) 的推送 (Push)、拉取 (Pull)、版本历史查看、差异比对和版本回滚。
- **原子化提交**: 将 `character.json` 和 `card.png` 的更新合并到一次提交中，保持版本历史的清晰和原子性。
- **分支与发布管理**: 支持分支的创建、查看，以及一键创建包含角色附件的 GitHub Release。
- **协作流程**: 支持仓库的复刻 (Fork) 和拉取请求 (Pull Request) 的创建。

## 安装教程

安装过程比较复杂，大约需要十分钟。

**第一步：启用 SillyTavern 服务器插件**

1.  打开 SillyTavern 的配置文件 `config.yaml`。
2.  找到并修改以下两项为 `true`：
    ```yaml
    enableServerPlugins: true
    enableServerPluginsAutoUpdate: true
    ```

**第二步：安装 Qiros 服务器后端**

我们强烈推荐使用 `git clone` 的方式进行安装，这能让插件在未来自动更新。

- **方法一 (推荐，需要 Git):**

  1.  打开终端或命令行。
  2.  进入 SillyTavern 的 `plugins` 目录，例如: `cd path/to/SillyTavern/plugins`
  3.  运行克隆命令:
      ```bash
      git clone https://github.com/MAX-TAB/qiros-server.git
      ```

- **方法二 (手动安装):**
  1.  在 [qiros-server 的 GitHub 页面](https://github.com/MAX-TAB/qiros-server) 点击 `Code` -> `Download ZIP`。
  2.  将解压后的文件夹移动到 `SillyTavern\plugins` 目录下。

安装完成后，请继续执行后续的部署脚本步骤：

- **Windows 用户**: 运行 `SillyTavern\plugins\qiros-server\一键部署脚本.bat`。
- **手机或其他系统用户**: 运行 `SillyTavern\plugins\qiros-server\一键部署脚本.sh`。

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

```
GITHUB_CLIENT_ID=你刚记下的Client ID
GITHUB_CLIENT_SECRET=你刚记下的Client secret
```

至此，后端配置完成。

**第五步：安装前端插件**

1.  打开 SillyTavern。
2.  在插件安装界面中，输入以下 URL 进行安装：
    `https://github.com/MAX-TAB/st-extension-qiros`
3.  正常完成安装即可。
