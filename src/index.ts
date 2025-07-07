import express, { Router, RequestHandler } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs/promises";
import {
  getBranches,
  createBranch,
  getHistory,
  getFileContent,
  createRelease,
  createRepo,
  updateFile,
  revertToVersion,
  uploadReleaseAsset,
  getReleases,
  syncFile,
  getBranchHeadSha,
  getCommitDiff,
  forkRepo,
  createPullRequest,
} from "./git-handler";
// @ts-ignore
import { write } from "../../../src/character-card-parser.js";
import { Octokit } from "@octokit/rest";

/**
 * =================================================================
 * 全局变量与环境配置
 * =================================================================
 * @description
 * 此部分代码负责初始化插件运行所需的环境变量和全局状态。
 * `loggedInUser` 用于在内存中存储当前通过OAuth登录的用户信息，
 * 包括GitHub返回的访问令牌(accessToken)。
 * `dotenv` 用于从`.env`文件中加载敏感信息，如GitHub OAuth应用的
 * Client ID 和 Client Secret，避免将其硬编码在代码中。
 */
let loggedInUser: any = null;
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const SESSION_FILE_PATH = path.resolve(__dirname, "../.qiros-session.json");

/**
 * =================================================================
 * 会话管理辅助函数 (Session Management Helpers)
 * =================================================================
 */
async function saveSessionToFile(sessionData: any) {
  try {
    await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(sessionData, null, 2));
    console.log("Qiros session saved successfully.");
  } catch (error) {
    console.error("Failed to save Qiros session:", error);
  }
}

async function loadSessionFromFile() {
  try {
    const data = await fs.readFile(SESSION_FILE_PATH, "utf-8");
    loggedInUser = JSON.parse(data);
    console.log(
      "Qiros session loaded successfully for user:",
      loggedInUser.login
    );
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.log("No Qiros session file found. User needs to log in.");
    } else {
      console.error("Failed to load Qiros session:", error);
    }
  }
}

async function clearSessionFile() {
  try {
    await fs.unlink(SESSION_FILE_PATH);
    console.log("Qiros session file deleted successfully.");
  } catch (error: any) {
    if (error.code === "ENOENT") {
    } else {
      console.error("Failed to delete Qiros session file:", error);
    }
  }
}

/**
 * =================================================================
 * 插件初始化函数 (init)
 * =================================================================
 * @description
 * 此函数是SillyTavern插件系统的入口点，在服务器启动时被调用。
 * 它负责设置Express路由、中间件以及定义所有的API端点。
 *
 * @param {Router} router - SillyTavern传入的Express路由器实例。
 */
async function init(router: Router) {
  await loadSessionFromFile();
  /**
   * ---------------------------------------------------------------
   * 中间件配置
   * ---------------------------------------------------------------
   * @description
   * - `express.json`: 用于解析JSON格式的请求体，并设置了10mb的上限以支持较大的角色数据。
   * - `cors`: 配置跨域资源共享，允许来自SillyTavern前端(通常是127.0.0.1或localhost的8000端口)的请求。
   * - `ensureAuthenticated`: 自定义中间件，用于保护需要用户登录才能访问的API端点。
   */
  router.use(express.json({ limit: "10mb" }));
  router.use(
    cors({
      origin: ["http://127.0.0.1:8000", "http://localhost:8000"],
      credentials: true,
    })
  );

  const ensureAuthenticated: RequestHandler = (req, res, next) => {
    if (!loggedInUser || !loggedInUser.accessToken) {
      res.status(401).send({ message: "用户未认证。" });
      return;
    }
    next();
  };

  /**
   * =================================================================
   * API端点：用户认证 (Authentication)
   * =================================================================
   */

  /**
   * @api {get} /github_login
   * @description 重定向用户到 GitHub OAuth 登录页面以获取授权。
   */
  router.get("/github_login", (req, res) => {
    const redirect_uri = `http://localhost:8000/api/plugins/qiros-server/github_callback`;
    const scope = "read:user repo";
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirect_uri}&scope=${scope}`
    );
  });

  /**
   * @api {get} /github_callback
   * @description GitHub在用户授权后会回调此端点。后端使用收到的`code`向GitHub交换访问令牌(access_token)，
   *              获取成功后，用该令牌获取用户信息，并将其保存在全局变量`loggedInUser`中，最后重定向回主页。
   */
  router.get("/github_callback", (async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send("错误：未收到来自GitHub的授权码。");
    }
    try {
      const { data } = await new Octokit({
        baseUrl: "https://github.com",
      }).request("POST /login/oauth/access_token", {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        headers: {
          accept: "application/json",
        },
      });
      const { access_token } = data;

      if (!access_token) {
        return res.status(500).send("错误：获取访问令牌失败。");
      }

      const userOctokit = new Octokit({ auth: access_token });
      const { data: userData } = await userOctokit.users.getAuthenticated();

      loggedInUser = {
        ...userData,
        accessToken: access_token,
      };
      console.log("用户已登录:", loggedInUser.login);
      await saveSessionToFile(loggedInUser);
      res.redirect("http://127.0.0.1:8000");
    } catch (error) {
      console.error("GitHub回调过程中出错:", error);
      res.status(500).send("认证过程中发生错误。");
    }
  }) as RequestHandler);

  /**
   * @api {get} /user
   * @description 获取当前登录的用户信息。如果用户未登录，返回null。
   */
  router.get("/user", (req, res) => {
    res.json(loggedInUser);
  });

  /**
   * @api {post} /logout
   * @description 清除服务器上存储的用户登录信息，实现登出功能。
   */
  router.post("/logout", (async (req, res) => {
    loggedInUser = null;
    await clearSessionFile();
    res.status(200).send({ message: "登出成功。" });
  }) as RequestHandler);

  /**
   * =================================================================
   * API端点：仓库管理 (Repository Management)
   * =================================================================
   */

  /**
   * @api {post} /create_repo
   * @description 为当前登录的用户创建一个新的私有GitHub仓库。
   * @param {string} repoName - 新仓库的名称。
   * @param {string} characterId - 角色ID，用于写入仓库描述。
   */
  router.post("/create_repo", ensureAuthenticated, (async (req, res) => {
    const { repoName, characterId } = req.body;
    if (!repoName || !characterId) {
      return res
        .status(400)
        .send({ message: "仓库名称(repoName)和角色ID(characterId)是必需的。" });
    }
    try {
      const repoData = await createRepo(loggedInUser.accessToken, repoName);
      res.status(200).send({
        repoUrl: repoData.clone_url,
        message: "仓库创建成功！",
      });
    } catch (error: any) {
      console.error(`创建仓库 ${repoName} 失败:`, error);
      res.status(500).send({
        message: "创建仓库失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  /**
   * @api {post} /fork
   * @description 为当前用户创建一个上游仓库的复刻(Fork)。
   */
  router.post("/fork", ensureAuthenticated, (async (req, res) => {
    const { upstreamRepoUrl } = req.body;
    if (!upstreamRepoUrl) {
      return res
        .status(400)
        .send({ message: "上游仓库地址(upstreamRepoUrl)是必需的。" });
    }
    try {
      const forkData = await forkRepo(
        loggedInUser.accessToken,
        upstreamRepoUrl
      );
      res.status(202).send({
        message: "复刻请求已接受，正在后台处理。",
        details: forkData,
      });
    } catch (error: any) {
      console.error(`复刻仓库 ${upstreamRepoUrl} 失败:`, error);
      res.status(500).send({
        message: "复刻仓库失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  /**
   * =================================================================
   * API端点：核心Git操作 (Core Git Operations)
   * =================================================================
   */

  /**
   * @api {post} /sync
   * @description "推送(Push)"功能的核心。它只将本地的角色数据(`character.json`)推送到GitHub仓库。
   */
  router.post("/sync", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, branch, commitMessage, characterData } = req.body;

    if (!repoUrl || !branch || !commitMessage || !characterData) {
      return res.status(400).send({
        message:
          "仓库地址(repoUrl), 分支(branch), 提交信息(commitMessage), 和角色数据(characterData)是必需的。",
      });
    }

    try {
      const jsonContent = JSON.stringify(characterData, null, 2);
      const syncResult = await syncFile(
        loggedInUser.accessToken,
        repoUrl,
        branch,
        "character.json",
        jsonContent,
        commitMessage
      );

      res.status(200).send({
        message: "同步成功！已将 character.json 推送到仓库。",
        commitSha: syncResult.commit.sha,
      });
    } catch (error: any) {
      console.error(`为仓库 ${repoUrl} 同步 character.json 失败:`, error);
      res
        .status(500)
        .send({ message: "同步文件失败。", details: error.message });
    }
  }) as RequestHandler);

  /**
   * @api {get} /download_card
   * @description "拉取(Pull)"功能的核心。它从GitHub仓库下载最新的`character.json`，
   *              然后通过SillyTavern的内部API导出当前角色卡，将新的JSON数据注入后，
   *              再通过导入API实现对本地角色的无缝更新。
   */
  router.get("/download_card", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, branch, characterAvatar } = req.query;

    if (!repoUrl || !branch || !characterAvatar) {
      return res.status(400).send({
        message:
          "仓库地址(repoUrl), 分支(branch), 和角色头像(characterAvatar)是必需的。",
      });
    }

    try {
      // 1. 从GitHub拉取目标character.json
      const jsonFileData = await getFileContent(
        loggedInUser.accessToken,
        repoUrl as string,
        branch as string,
        "character.json"
      );
      if (!jsonFileData || !jsonFileData.content) {
        throw new Error("在仓库中未找到 character.json。");
      }
      const characterJsonContent = Buffer.from(
        jsonFileData.content,
        "base64"
      ).toString("utf-8");

      // 2. 从SillyTavern导出当前角色卡PNG的Buffer
      const exportResponse = await fetch(
        "http://127.0.0.1:8000/api/characters/export",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": req.headers["x-csrf-token"] as string,
            Cookie: req.headers.cookie as string,
          },
          body: JSON.stringify({
            format: "png",
            avatar_url: characterAvatar as string,
          }),
        }
      );
      if (!exportResponse.ok) {
        throw new Error(
          `从SillyTavern导出角色卡失败: ${exportResponse.status}`
        );
      }
      const cardPngBuffer = await exportResponse.buffer();

      // 3. 将新的JSON注入到导出的PNG Buffer中
      const newCardBuffer = write(cardPngBuffer, characterJsonContent);

      // 4. 将合成后的新卡片导入SillyTavern
      const formData = new FormData();
      formData.append("avatar", newCardBuffer, characterAvatar as string);
      formData.append("file_type", "png");
      formData.append("preserved_name", characterAvatar as string);

      const importResponse = await fetch(
        "http://127.0.0.1:8000/api/characters/import",
        {
          method: "POST",
          body: formData,
          headers: {
            ...formData.getHeaders(),
            "X-CSRF-Token": req.headers["x-csrf-token"] as string,
            Cookie: req.headers.cookie as string,
          },
        }
      );
      if (!importResponse.ok) {
        const errorText = await importResponse.text();
        throw new Error(
          `SillyTavern导入失败: ${importResponse.status} - ${errorText}`
        );
      }
      const result = await importResponse.json();
      res.status(200).send({
        message: "角色卡JSON数据已注入并成功更新！",
        data: result,
      });
    } catch (error: any) {
      console.error(`处理下载/注入流程失败:`, error);
      res.status(500).send({
        message: "角色卡更新失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  /**
   * =================================================================
   * API端点：分支与历史 (Branch & History)
   * =================================================================
   */

  router.get("/branches", ensureAuthenticated, (async (req, res) => {
    const { repoUrl } = req.query;
    if (!repoUrl) {
      return res.status(400).send({ message: "仓库地址(repoUrl)是必需的。" });
    }
    try {
      const branchData = await getBranches(
        loggedInUser.accessToken,
        repoUrl as string
      );
      res.status(200).send(branchData);
    } catch (error: any) {
      console.error(`为仓库 ${repoUrl} 获取分支失败:`, error);
      res
        .status(500)
        .send({ message: "获取分支失败。", details: error.message });
    }
  }) as RequestHandler);

  router.post("/create_branch", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, newBranchName, baseBranchName, readmeContent } = req.body;
    if (!repoUrl || !newBranchName) {
      return res.status(400).send({
        message: "仓库地址(repoUrl)和新分支名(newBranchName)是必需的。",
      });
    }
    try {
      const result = await createBranch(
        loggedInUser.accessToken,
        repoUrl,
        newBranchName,
        baseBranchName,
        readmeContent
      );
      res.status(200).send({
        message: `分支 '${newBranchName}' 创建成功。`,
        details: result,
      });
    } catch (error: any) {
      console.error(`创建分支 '${newBranchName}' 失败:`, error);
      res
        .status(500)
        .send({ message: "创建分支失败。", details: error.message });
    }
  }) as RequestHandler);

  router.get("/history", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, branch, file } = req.query;
    if (!repoUrl || !branch) {
      return res
        .status(400)
        .send({ message: "仓库地址(repoUrl)和分支(branch)是必需的。" });
    }
    try {
      const historyData = await getHistory(
        loggedInUser.accessToken,
        repoUrl as string,
        branch as string,
        file as string | undefined
      );
      res.status(200).send(historyData);
    } catch (error: any) {
      console.error(`为仓库 ${repoUrl} 获取历史记录失败:`, error);
      res
        .status(500)
        .send({ message: "获取历史记录失败。", details: error.message });
    }
  }) as RequestHandler);

  /**
   * =================================================================
   * API端点：版本与差异比对 (Version & Diff)
   * =================================================================
   */

  router.get("/check_updates", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, branch } = req.query;
    if (!repoUrl || !branch) {
      return res
        .status(400)
        .send({ message: "仓库地址(repoUrl)和分支(branch)是必需的。" });
    }
    try {
      const headSha = await getBranchHeadSha(
        loggedInUser.accessToken,
        repoUrl as string,
        branch as string
      );
      res.status(200).send({ remoteSha: headSha });
    } catch (error: any) {
      console.error(`为仓库 ${repoUrl} 检查更新失败:`, error);
      res.status(500).send({
        message: "检查更新失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  router.get("/commit_diff", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, sha, file } = req.query;
    if (!repoUrl || !sha || !file) {
      return res.status(400).send({
        message: "仓库地址(repoUrl), 提交哈希(sha), 和文件名(file)是必需的。",
      });
    }
    try {
      const patch = await getCommitDiff(
        loggedInUser.accessToken,
        repoUrl as string,
        sha as string,
        file as string
      );
      res.status(200).send({ patch });
    } catch (error: any) {
      console.error(`获取提交 ${sha} 的差异失败:`, error);
      res.status(500).send({
        message: "获取提交差异失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  /**
   * @api {post} /revert_version
   * @description "回滚(Revert)"功能。采用与“拉取”相同的无痕更新逻辑，
   *              获取指定历史版本的`character.json`，并将其注入到当前角色卡中。
   */
  router.post("/revert_version", ensureAuthenticated, (async (req, res) => {
    const { repoUrl, targetCommitSha, characterAvatar } = req.body;

    if (!repoUrl || !targetCommitSha || !characterAvatar) {
      return res.status(400).send({
        message:
          "仓库地址(repoUrl), 目标提交(targetCommitSha), 和角色头像(characterAvatar)是必需的。",
      });
    }

    try {
      // 1. 从GitHub拉取目标commit的character.json
      const jsonFileData = await getFileContent(
        loggedInUser.accessToken,
        repoUrl as string,
        targetCommitSha as string,
        "character.json"
      );
      if (!jsonFileData || !jsonFileData.content) {
        throw new Error(`在提交 ${targetCommitSha} 中未找到 character.json。`);
      }
      const characterJsonContent = Buffer.from(
        jsonFileData.content,
        "base64"
      ).toString("utf-8");

      // 2. 从SillyTavern导出当前角色卡PNG的Buffer
      const exportResponse = await fetch(
        "http://127.0.0.1:8000/api/characters/export",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": req.headers["x-csrf-token"] as string,
            Cookie: req.headers.cookie as string,
          },
          body: JSON.stringify({
            format: "png",
            avatar_url: characterAvatar as string,
          }),
        }
      );
      if (!exportResponse.ok) {
        throw new Error(
          `从SillyTavern导出角色卡失败: ${exportResponse.status}`
        );
      }
      const cardPngBuffer = await exportResponse.buffer();

      // 3. 将历史JSON注入到导出的PNG Buffer中
      const newCardBuffer = write(cardPngBuffer, characterJsonContent);

      // 4. 将合成后的新卡片导入SillyTavern
      const formData = new FormData();
      formData.append("avatar", newCardBuffer, characterAvatar as string);
      formData.append("file_type", "png");
      formData.append("preserved_name", characterAvatar as string);

      const importResponse = await fetch(
        "http://127.0.0.1:8000/api/characters/import",
        {
          method: "POST",
          body: formData,
          headers: {
            ...formData.getHeaders(),
            "X-CSRF-Token": req.headers["x-csrf-token"] as string,
            Cookie: req.headers.cookie as string,
          },
        }
      );
      if (!importResponse.ok) {
        const errorText = await importResponse.text();
        throw new Error(
          `SillyTavern导入失败: ${importResponse.status} - ${errorText}`
        );
      }
      const result = await importResponse.json();
      res.status(200).send({
        message: `角色卡已成功回滚到版本 ${(
          targetCommitSha as string
        ).substring(0, 7)} 并更新！`,
        data: result,
      });
    } catch (error: any) {
      console.error(`从版本 ${targetCommitSha} 回滚失败:`, error);
      res.status(500).send({
        message: "角色卡回滚失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  /**
   * =================================================================
   * API端点：发布管理 (Release Management)
   * =================================================================
   */

  router.post("/create_release", ensureAuthenticated, (async (req, res) => {
    const {
      repoUrl,
      version,
      title,
      notes,
      targetBranch,
      characterData,
      characterAvatar,
    } = req.body;

    if (
      !repoUrl ||
      !version ||
      !title ||
      !notes ||
      !targetBranch ||
      !characterData ||
      !characterAvatar
    ) {
      return res.status(400).send({
        message: "创建发行版所需的所有参数（包括角色数据和头像）都是必需的。",
      });
    }

    try {
      // 1. 在GitHub上创建Release条目
      const releaseData = await createRelease(
        loggedInUser.accessToken,
        repoUrl,
        version,
        title,
        notes,
        targetBranch
      );
      const releaseId = releaseData.id;

      // 2. 准备character.json内容并作为附件上传
      const jsonContent = JSON.stringify(characterData, null, 2);
      await uploadReleaseAsset(
        loggedInUser.accessToken,
        repoUrl,
        releaseId,
        "character.json",
        Buffer.from(jsonContent).toString("base64"), // uploadReleaseAsset期望base64
        "application/json"
      );

      // 3. 从SillyTavern导出当前最新的card.png
      const exportResponse = await fetch(
        "http://127.0.0.1:8000/api/characters/export",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": req.headers["x-csrf-token"] as string,
            Cookie: req.headers.cookie as string,
          },
          body: JSON.stringify({
            format: "png",
            avatar_url: characterAvatar,
          }),
        }
      );
      if (!exportResponse.ok) {
        throw new Error(
          `从SillyTavern导出角色卡以附加到发行版时失败: ${exportResponse.status}`
        );
      }
      const cardPngBuffer = await exportResponse.buffer();

      // 4. 将导出的PNG作为附件上传
      await uploadReleaseAsset(
        loggedInUser.accessToken,
        repoUrl,
        releaseId,
        "card.png",
        cardPngBuffer.toString("base64"), // uploadReleaseAsset期望base64
        "image/png"
      );

      res.status(200).send({
        message: `发行版 ${version} 创建成功并已附加资源。`,
        details: releaseData,
      });
    } catch (error: any) {
      console.error(`为仓库 ${repoUrl} 创建发行版失败:`, error);
      res.status(500).send({
        message: "创建发行版失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);

  router.post("/pull-request", ensureAuthenticated, (async (req, res) => {
    const { upstreamRepoUrl, headBranch, baseBranch, title, body } = req.body;
    if (!upstreamRepoUrl || !headBranch || !baseBranch || !title) {
      return res.status(400).send({
        message:
          "上游仓库(upstreamRepoUrl), 源分支(headBranch), 目标分支(baseBranch), 和标题(title)是必需的。",
      });
    }
    try {
      const prData = await createPullRequest(
        loggedInUser.accessToken,
        upstreamRepoUrl,
        headBranch,
        baseBranch,
        title,
        body || ""
      );
      res.status(201).send({
        message: "拉取请求创建成功！",
        details: prData,
      });
    } catch (error: any) {
      console.error(`为仓库 ${upstreamRepoUrl} 创建PR失败:`, error);
      res.status(500).send({
        message: "创建拉取请求失败。",
        details: error.message,
      });
    }
  }) as RequestHandler);
}

/**
 * =================================================================
 * 插件退出函数 (exit)
 * =================================================================
 * @description
 * 在插件被卸载或SillyTavern关闭时调用，用于清理资源。
 * 这里我们将清空已登录的用户信息。
 */
async function exit() {
  loggedInUser = null;
  console.log("Qiros Server 插件已卸载！");
}

/**
 * =================================================================
 * 插件信息导出
 * =================================================================
 * @description
 * `info` 对象包含了插件的元数据，SillyTavern会读取这些信息
 * 来在插件列表中展示。
 * `init` 和 `exit` 函数是插件生命周期的核心，必须导出。
 */
export const info = {
  id: "qiros-server",
  name: "Qiros Server",
  description: "Qiros扩展的服务器端组件，处理所有Git和GitHub相关的操作。",
};

export { init, exit };
