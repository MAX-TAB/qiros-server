/*
 * Qiros Server - A backend plugin for SillyTavern to handle Git and GitHub collaboration.
 * Copyright (C) 2025  MAX-TAB
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Octokit } from "@octokit/rest";

/**
 * =================================================================
 * 仓库URL解析器 (parseRepoUrl)
 * =================================================================
 * @description
 * 这是一个内部辅助函数，负责将一个完整的GitHub仓库URL
 * (例如 "https://github.com/user/repo" 或 "https://github.com/user/repo.git")
 * 解析成Octokit库需要的`owner`和`repo`两个部分。
 * 它能兼容带或不带`.git`后缀的URL。
 *
 * @param {string} repoUrl - 需要解析的完整GitHub仓库URL。
 * @returns {{owner: string, repo: string}} - 包含所有者和仓库名的对象。
 * @throws 如果URL格式不正确，则会抛出错误。
 */
function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  try {
    const url = new URL(repoUrl);
    // 使用单个正则表达式替换掉路径开头可能存在的 "/" 和结尾的 ".git"
    // 这使得函数对 "https://github.com/user/repo" 和 "https://github.com/user/repo.git" 两种格式都能正确解析
    const pathname = url.pathname.replace(/^\/|\.git$/g, "");
    const parts = pathname.split("/");
    if (parts.length < 2) {
      throw new Error("无效的仓库URL路径：无法解析出所有者和仓库名。");
    }
    return { owner: parts[0], repo: parts[1] };
  } catch (e) {
    throw new Error(`无效的GitHub仓库URL格式: ${repoUrl}`);
  }
}

/**
 * =================================================================
 * 创建仓库 (createRepo)
 * =================================================================
 * @description
 * 调用GitHub API，为当前通过验证的用户创建一个新的私有仓库。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoName - 新仓库的名称。
 * @returns {Promise<object>} - 返回由GitHub API创建的仓库对象的详细数据。
 */
export async function createRepo(token: string, repoName: string) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { data: repoData } = await octokit.repos.createForAuthenticatedUser({
    name: repoName,
    private: true,
    description: `SillyTavern Qiros扩展的角色仓库`,
  });
  return repoData;
}

/**
 * =================================================================
 * 获取分支列表 (getBranches)
 * =================================================================
 * @description
 * 获取指定仓库的所有分支列表。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @returns {Promise<object>} - 返回一个包含分支数组的对象，格式为 { branches: [...] }。
 */
export async function getBranches(token: string, repoUrl: string) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);
  const { data: remoteBranches } = await octokit.repos.listBranches({
    owner,
    repo,
  });
  return {
    branches: remoteBranches.map((branch) => ({
      name: branch.name,
      current: false,
    })),
  };
}

/**
 * =================================================================
 * 创建新分支 (createBranch)
 * =================================================================
 * @description
 * 在指定仓库中，基于一个现有的分支（通常是主分支）创建一个新的分支。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} newBranchName - 要创建的新分支的名称。
 * @param {string} baseBranchName - 作为创建基础的分支的名称。
 * @returns {Promise<object>} - 返回新创建的分支引用的详细数据。
 */
export async function createBranch(
  token: string,
  repoUrl: string,
  newBranchName: string,
  baseBranchName: string | null,
  readmeContent?: string
) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);

  // 如果提供了基础分支，直接使用
  if (baseBranchName) {
    const { data: baseBranchData } = await octokit.repos.getBranch({
      owner,
      repo,
      branch: baseBranchName,
    });
    const fromCommitSha = baseBranchData.commit.sha;

    const { data } = await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: fromCommitSha,
    });
    return data;
  }

  // 如果没有提供基础分支，判断仓库是否为空
  try {
    // 尝试获取仓库的默认分支。如果仓库为空，这里会成功，但 default_branch 可能指向一个尚不存在的 ref
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // 尝试获取默认分支的 commit SHA。如果分支不存在（即仓库为空），这里会抛出 404 错误
    const { data: baseBranchData } = await octokit.repos.getBranch({
      owner,
      repo,
      branch: defaultBranch,
    });
    const fromCommitSha = baseBranchData.commit.sha;

    // 如果成功获取，说明仓库不为空，基于默认分支创建新分支
    const { data } = await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: fromCommitSha,
    });
    return data;
  } catch (error: any) {
    // 如果捕获到错误（特别是 404），说明仓库是空的，需要初始化
    if (error.status === 404) {
      const finalReadmeContent =
        readmeContent ||
        "# Qiros角色卡仓库\n\n此仓库由SillyTavern的Qiros扩展创建和管理。";

      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: "README.md",
        message: "Initial commit",
        content: Buffer.from(finalReadmeContent).toString("base64"),
        branch: newBranchName,
      });
      return { success: true, branch: newBranchName, object: data.commit };
    }
    // 其他错误则向上抛出
    throw error;
  }
}

/**
 * =================================================================
 * 获取分支最新提交 (getBranchHeadSha)
 * =================================================================
 * @description
 * 获取指定分支的头部提交（最新提交）的SHA哈希值。
 * 这是实现“检查更新”功能的基础。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} branch - 要查询的分支名称。
 * @returns {Promise<string>} - 返回最新提交的SHA哈希值字符串。
 */
export async function getBranchHeadSha(
  token: string,
  repoUrl: string,
  branch: string
): Promise<string> {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);

  const { data: branchData } = await octokit.repos.getBranch({
    owner,
    repo,
    branch,
  });

  return branchData.commit.sha;
}

/**
 * =================================================================
 * 获取提交的差异 (getCommitDiff)
 * =================================================================
 * @description
 * 获取某个特定文件在某次特定提交中的变更内容（即 "patch" 或 "diff"）。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} commitSha - 要查询的提交的SHA哈希值。
 * @param {string} filePath - 要获取差异的文件的路径 (例如 "character.json")。
 * @returns {Promise<string | null>} - 返回文件的patch字符串；如果文件在该提交中无变化，则返回提示信息。
 */
export async function getCommitDiff(
  token: string,
  repoUrl: string,
  commitSha: string,
  filePath: string
): Promise<string | null> {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);

  const { data: commitData } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: commitSha,
  });

  const file = commitData.files?.find((f) => f.filename === filePath);

  return file?.patch ?? "此提交中该文件无文本变更。";
}

/**
 * =================================================================
 * 获取发行版列表 (getReleases)
 * =================================================================
 * @description
 * 获取指定仓库的所有发行版 (Release) 列表。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @returns {Promise<object[]>} - 返回一个包含所有发行版对象的数组。
 */
export async function getReleases(token: string, repoUrl: string) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);
  const { data: releases } = await octokit.repos.listReleases({
    owner,
    repo,
  });
  return releases;
}

/**
 * =================================================================
 * 同步文件 (syncFile)
 * =================================================================
 * @description
 * 这是一个核心的、通用的文件同步函数。它可以智能地处理文件的创建和更新。
 * 它首先尝试获取文件的当前SHA，如果文件存在，则在更新时提供此SHA以避免冲突；
 * 如果文件不存在（捕获404错误），则直接创建新文件。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} branch - 要提交到的分支。
 * @param {string} filePath - 要创建/更新的文件路径。
 * @param {string | Buffer} newContent - 文件的新内容（可以是字符串或Buffer）。
 * @param {string} commitMessage - 本次提交的信息。
 * @returns {Promise<object>} - 返回文件创建/更新操作的结果对象。
 */
export async function syncFile(
  token: string,
  repoUrl: string,
  branch: string,
  filePath: string,
  newContent: string | Buffer,
  commitMessage: string
) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);

  let fileSha: string | undefined;
  try {
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if ("sha" in existingFile) {
      fileSha = existingFile.sha;
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }
  }

  const { data: updateResult } = await octokit.repos.createOrUpdateFileContents(
    {
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.isBuffer(newContent)
        ? newContent.toString("base64")
        : Buffer.from(newContent, "utf-8").toString("base64"),
      branch: branch,
      sha: fileSha,
    }
  );

  return updateResult;
}

/**
 * =================================================================
 * 提交多个文件 (commitMultipleFiles)
 * =================================================================
 * @description
 * 使用底层的Git Data API，将多个文件的更改合并到一个原子提交中。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} branch - 要提交到的分支。
 * @param {Array<{path: string, content: string | Buffer}>} files - 文件对象数组。
 * @param {string} commitMessage - 本次提交的信息。
 * @returns {Promise<object>} - 返回新创建的提交对象。
 */
export async function commitMultipleFiles(
  token: string,
  repoUrl: string,
  branch: string,
  files: Array<{ path: string; content: string | Buffer }>,
  commitMessage: string
) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);

  // 1. 获取当前分支的最新 commit 和其 tree
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = latestCommit.tree.sha;

  // 2. 为每个文件创建 blobs
  const blobPromises = files.map(async (file) => {
    const content = Buffer.isBuffer(file.content)
      ? file.content.toString("base64")
      : file.content;
    const encoding = Buffer.isBuffer(file.content) ? "base64" : "utf-8";

    const blob = await octokit.git.createBlob({
      owner,
      repo,
      content,
      encoding,
    });
    return {
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blob.data.sha,
    };
  });

  const treeItems = await Promise.all(blobPromises);

  // 3. 基于最新提交的 tree 创建一个新的 tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // 4. 创建一个新的 commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  // 5. 更新分支引用以指向新 commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return newCommit;
}

/**
 * =================================================================
 * 获取提交历史 (getHistory)
 * =================================================================
 * @description
 * 获取指定分支上某个特定文件（如果提供）或整个仓库的提交历史记录。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} branch - 要查询的分支。
 * @param {string} [fileName] - (可选) 要筛选历史记录的特定文件的路径。
 * @returns {Promise<object>} - 返回一个包含格式化后提交历史数组的对象 { history: [...] }。
 */
export async function getHistory(
  token: string,
  repoUrl: string,
  branch: string,
  fileName?: string
) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(repoUrl);

  const { data: commits } = await octokit.repos.listCommits({
    owner,
    repo,
    sha: branch,
    path: fileName,
    per_page: 100,
  });

  return {
    history: commits.map((commit) => ({
      hash: commit.sha,
      author: commit.commit.author?.name || "N/A",
      date: commit.commit.author?.date || "N/A",
      message: commit.commit.message,
    })),
  };
}

/**
 * =================================================================
 * 获取文件内容 (getFileContent)
 * =================================================================
 * @description
 * 从仓库的指定分支或提交中，获取特定文件的内容。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} hash - 分支名或提交SHA哈希值。
 * @param {string} fileName - 要获取内容的文件路径。
 * @returns {Promise<{content: string, sha: string} | null>} - 返回包含文件Base64内容和SHA的对象，如果未找到则返回null。
 */
export async function getFileContent(
  token: string,
  repoUrl: string,
  hash: string,
  fileName: string
): Promise<{ content: string; sha: string } | null> {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parseRepoUrl(repoUrl);
  try {
    // --- 日志点 1: 函数入口 ---
    console.log(`[Qiros-Debug-Handler] ==> getFileContent: 开始获取文件。`);
    console.log(`[Qiros-Debug-Handler]     - Owner: ${owner}, Repo: ${repo}`);
    console.log(`[Qiros-Debug-Handler]     - Ref/Branch/SHA: ${hash}`);
    console.log(`[Qiros-Debug-Handler]     - 文件名: ${fileName}`);

    const { data, headers } = await octokit.repos.getContent({
      owner,
      repo,
      path: fileName,
      ref: hash,
      // --- 关键修改：添加此headers来尝试绕过缓存 ---
      headers: {
        "If-None-Match": "",
      },
    });

    // --- 日志点 2: API响应头 ---
    console.log(`[Qiros-Debug-Handler] <== GitHub API 响应头 (部分):`, {
      status: headers.status,
      "x-ratelimit-remaining": headers["x-ratelimit-remaining"],
      "x-github-request-id": headers["x-github-request-id"],
      etag: headers.etag,
    });

    // 类型守卫，确保 data 是单个文件对象而不是数组
    if (Array.isArray(data)) {
      // --- 日志点 3: 路径返回的是目录 ---
      console.error(
        `[Qiros-Debug-Handler] !!! 错误：路径 '${fileName}' 返回了一个目录，而不是预期的单个文件。`
      );
      return null;
    }

    // --- 日志点 4: 检查返回的数据结构 ---
    console.log(
      `[Qiros-Debug-Handler] GitHub返回的数据类型: ${data.type}, 大小: ${data.size} bytes`
    );

    if ("content" in data && data.content) {
      // --- 日志点 5A: 文件内容直接包含在响应中 ---
      console.log(
        `[Qiros-Debug-Handler]     - 找到了 'content' 字段，文件内容被直接返回。`
      );
      return {
        content: data.content,
        sha: data.sha,
      };
    }

    if ("download_url" in data && data.download_url) {
      // --- 日志点 5B: 文件内容需要通过 download_url 获取 (大文件) ---
      console.log(
        `[Qiros-Debug-Handler]     - 文件过大，从 download_url 下载: ${data.download_url}`
      );
      const response = await fetch(data.download_url);
      if (!response.ok) {
        throw new Error(`无法从 download_url 下载文件: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      // 将下载的原始数据转换为 Base64，以匹配其他逻辑的期望
      const content = Buffer.from(buffer).toString("base64");
      console.log(`[Qiros-Debug-Handler]     - 从 download_url 下载成功。`);
      return {
        content,
        sha: data.sha,
      };
    }

    // --- 日志点 6: 未知的文件结构 ---
    console.warn(
      `[Qiros-Debug-Handler] !!! 警告：收到了文件元数据，但其中既不包含 'content' 也不包含 'download_url'。`
    );
    return null;
  } catch (error: any) {
    // --- 日志点 7: 捕获到错误 ---
    console.error(
      `[Qiros-Debug-Handler] !!! getFileContent 捕获到严重错误:`,
      error
    );
    if (error.status === 404) {
      console.error(
        `[Qiros-Debug-Handler]     - 错误状态为 404 (Not Found)。确认文件 '${fileName}' 是否存在于分支 '${hash}' 中。`
      );
      return null;
    }
    // 重新抛出其他所有错误
    throw error;
  }
}

/**
 * =================================================================
 * 更新文件 (updateFile)
 * =================================================================
 * @description
 * 这是一个更底层的函数，用于创建或更新单个文件。
 * 与`syncFile`不同，它不自动获取SHA，需要调用者在更新时提供。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} branch - 要提交到的分支。
 * @param {string} filePath - 要创建/更新的文件路径。
 * @param {string} newContent - 文件的新内容。
 * @param {string} commitMessage - 本次提交的信息。
 * @param {string} [fileSha] - (可选) 如果是更新操作，需要提供文件的当前SHA以避免冲突。
 */
export async function updateFile(
  token: string,
  repoUrl: string,
  branch: string,
  filePath: string,
  newContent: string,
  commitMessage: string,
  fileSha?: string
) {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parseRepoUrl(repoUrl);

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: commitMessage,
    content: Buffer.from(newContent, "utf-8").toString("base64"),
    branch: branch,
    sha: fileSha,
  });
}

/**
 * =================================================================
 * 创建发行版 (createRelease)
 * =================================================================
 * @description
 * 在GitHub上创建一个新的、空的Release（发行版）条目。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} version - 发行版的版本号标签 (例如 "v1.0.0")。
 * @param {string} title - 发行版的标题。
 * @param {string} notes - 发行版的说明文字。
 * @param {string} targetBranch - 该发行版标签指向的目标分支。
 * @returns {Promise<object>} - 返回新创建的发行版的详细数据。
 */
export async function createRelease(
  token: string,
  repoUrl: string,
  version: string,
  title: string,
  notes: string,
  targetBranch: string
) {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parseRepoUrl(repoUrl);

  const release = await octokit.repos.createRelease({
    owner,
    repo,
    tag_name: version,
    target_commitish: targetBranch,
    name: title,
    body: notes,
    draft: false,
    prerelease: false,
  });

  return release.data;
}

/**
 * =================================================================
 * 回滚版本 (revertToVersion)
 * =================================================================
 * @description
 * 将 `character.json` 文件回滚到某个历史提交的状态。
 * 它的实现方式是：获取目标历史提交的文件内容，然后创建一个新的提交，
 * 将内容覆盖到当前分支的最新版本上。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {string} branch - 要应用回滚的分支。
 * @param {string} targetCommitSha - 要回滚到的目标提交的SHA哈希值。
 */
export async function revertToVersion(
  token: string,
  repoUrl: string,
  branch: string,
  targetCommitSha: string
): Promise<{ characterJsonContent: string; cardPngContent: string | null }> {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parseRepoUrl(repoUrl);

  // 1. 获取目标提交中两个文件的内容
  const jsonFileData = await getFileContent(
    token,
    repoUrl,
    targetCommitSha,
    "character.json"
  );
  if (!jsonFileData) {
    throw new Error(
      `无法在提交 ${targetCommitSha} 中获取 character.json 的内容`
    );
  }
  const characterJsonContent = Buffer.from(
    jsonFileData.content,
    "base64"
  ).toString("utf-8");

  const pngFileData = await getFileContent(
    token,
    repoUrl,
    targetCommitSha,
    "card.png"
  );
  const cardPngContent = pngFileData ? pngFileData.content : null; // Base64

  // 2. 获取当前分支的最新提交和其 tree
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = latestCommit.tree.sha;

  // 3. 为要更新的文件创建 blobs
  const blobs = [];
  const jsonBlob = await octokit.git.createBlob({
    owner,
    repo,
    content: characterJsonContent,
    encoding: "utf-8",
  });
  blobs.push({
    path: "character.json",
    mode: "100644" as const,
    type: "blob" as const,
    sha: jsonBlob.data.sha,
  });

  if (cardPngContent) {
    const pngBlob = await octokit.git.createBlob({
      owner,
      repo,
      content: cardPngContent,
      encoding: "base64",
    });
    blobs.push({
      path: "card.png",
      mode: "100644" as const,
      type: "blob" as const,
      sha: pngBlob.data.sha,
    });
  }

  // 4. 基于最新提交的 tree 创建一个新的 tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: blobs,
  });

  // 5. 创建一个新的 commit
  const commitMessage = `回滚到版本 ${targetCommitSha.substring(0, 7)}`;
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  // 6. 更新分支引用以指向新 commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  // 7. 返回文件内容给前端
  return {
    characterJsonContent,
    cardPngContent,
  };
}

/**
 * =================================================================
 * 上传发行版附件 (uploadReleaseAsset)
 * =================================================================
 * @description
 * 将一个文件作为附件上传到指定的、已存在的发行版中。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} repoUrl - 目标仓库的URL。
 * @param {number} releaseId - 目标发行版的ID。
 * @param {string} assetName - 附件的文件名 (例如 'character-v1.png')。
 * @param {string} assetData - 附件内容的Base64编码字符串。
 * @param {string} assetContentType - 附件的MIME类型 (例如 'image/png')。
 * @returns {Promise<object>} - 返回上传成功的附件的详细数据。
 */
export async function uploadReleaseAsset(
  token: string,
  repoUrl: string,
  releaseId: number,
  assetName: string,
  assetData: string,
  assetContentType: string
) {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parseRepoUrl(repoUrl);

  const rawData = Buffer.from(assetData, "base64");

  const { data } = await octokit.rest.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: releaseId,
    name: assetName,
    data: rawData as any,
    headers: {
      "content-type": assetContentType,
      "content-length": rawData.length,
    },
  });
  return data;
}

/**
 * =================================================================
 * 复刻仓库 (forkRepo)
 * =================================================================
 * @description
 * 为当前认证的用户创建一个指定仓库的复刻(fork)。
 * GitHub的fork操作是异步的，API会立即返回，但实际的复刻过程可能需要一些时间。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} upstreamRepoUrl - 要复刻的上游仓库的URL。
 * @returns {Promise<object>} - 返回新创建的复刻仓库的详细数据。
 */
export async function forkRepo(token: string, upstreamRepoUrl: string) {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parseRepoUrl(upstreamRepoUrl);

  const { data: forkData } = await octokit.repos.createFork({
    owner,
    repo,
  });

  return forkData;
}

/**
 * =================================================================
 * 创建拉取请求 (createPullRequest)
 * =================================================================
 * @description
 * 在一个仓库中创建一个新的拉取请求 (Pull Request)。
 * 通常用于将fork中的分支合并回上游仓库。
 *
 * @param {string} token - 用户的GitHub OAuth访问令牌。
 * @param {string} upstreamRepoUrl - 目标上游仓库的URL (PR要合并到的地方)。
 * @param {string} headBranch - 源分支，格式为 "username:branchname"。
 * @param {string} baseBranch - 目标分支，即要将代码合并进去的分支名 (例如 "main")。
 * @param {string} title - PR的标题。
 * @param {string} body - PR的描述内容。
 * @returns {Promise<object>} - 返回新创建的PR的详细数据。
 */
export async function createPullRequest(
  token: string,
  upstreamRepoUrl: string,
  headBranch: string,
  baseBranch: string,
  title: string,
  body: string
) {
  const octokit = new Octokit({ auth: token, request: { timeout: 60000 } });
  const { owner, repo } = parseRepoUrl(upstreamRepoUrl);

  const { data: prData } = await octokit.pulls.create({
    owner,
    repo,
    title,
    head: headBranch,
    base: baseBranch,
    body,
    maintainer_can_modify: true, // 允许上游仓库维护者修改此PR
  });

  return prData;
}
