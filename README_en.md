# Qiros Server - Backend for SillyTavern Git-based Collaboration Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/MAX-TAB/qiros-server)

[中文版](README.md)

This is a plugin designed for [SillyTavern](https://github.com/SillyTavern/SillyTavern), providing a powerful backend service to handle all Git and GitHub related operations. It is a core dependency for the [Qiros Frontend Plugin](https://github.com/MAX-TAB/st-extension-qiros).

With this plugin, you can transform the creation and maintenance of character cards from isolated, individual work into a version-controlled, traceable, and collaborative structured project.

## Key Features

- **GitHub OAuth Authentication**: Secure and reliable user authentication flow.
- **Repository Management**: Create or link remote GitHub repositories from within the plugin.
- **Core Git Operations**: Implements push, pull, version history viewing, diff comparison, and version rollback for character cards (`character.json`) and their images (`card.png`).
- **Atomic Commits**: Merges updates to `character.json` and `card.png` into a single commit, maintaining a clean and atomic version history.
- **Branch & Release Management**: Supports creating and listing branches, as well as one-click creation of GitHub Releases with character assets attached.
- **Collaboration Workflow**: Supports forking repositories and creating pull requests.

## Installation Guide

The installation process is somewhat complex and takes about ten minutes.

**Step 1: Enable SillyTavern Server Plugins**

1.  Open SillyTavern's configuration file, `config.yaml`.
2.  Find and change the following two items to `true`:
    ```yaml
    enableServerPlugins: true
    enableServerPluginsAutoUpdate: true
    ```

**Step 2: Install the Qiros Server Backend**

We highly recommend installing via `git clone` to enable the auto-update feature for the plugin.

- **Method 1 (Recommended, requires Git):**

  1.  Open a terminal or command prompt.
  2.  Navigate to your SillyTavern's `plugins` directory, e.g., `cd path/to/SillyTavern/plugins`
  3.  Run the clone command:
      ```bash
      git clone https://github.com/MAX-TAB/qiros-server.git
      ```

- **Method 2 (Manual Install):**
  1.  On the [qiros-server GitHub page](https://github.com/MAX-TAB/qiros-server), click `Code` -> `Download ZIP`.
  2.  Move the extracted folder to your `SillyTavern\plugins` directory.

After installation, proceed with the deployment script:

- **For Windows users**: Run `SillyTavern\plugins\qiros-server\一键部署脚本.bat`.
- **For mobile or other OS users**: Run `SillyTavern\plugins\qiros-server\一键部署脚本.sh`.

**Step 3: Obtain GitHub OAuth Credentials**

1.  Make sure you have a GitHub account.
2.  Go to https://github.com/settings/developers and click **New OAuth App**.
3.  Fill in the following information:
    - **Application name**: Anything you like
    - **Homepage URL**: `http://localhost:8000`
    - **Application description**: Anything you like or leave blank
    - **Authorization callback URL**: `http://localhost:8000/api/plugins/qiros-server/github_callback`
    - **Enable Device Flow**: Check or uncheck as you wish
4.  Click **Register application**.

**Step 4: Configure Environment Variables**

1.  On the page of the OAuth Application you just created, click **Generate a new client secret**.
2.  Copy and save the **Client ID** and the newly generated **Client secret**.
3.  Inside the `SillyTavern\plugins\qiros-server` folder, create a new file named `.env`.
4.  Enter the following content into the `.env` file, replacing the placeholders with your own ID and Secret:

```env
GITHUB_CLIENT_ID=Your_Client_ID_here
GITHUB_CLIENT_SECRET=Your_Client_Secret_here
```

The backend configuration is now complete.

**Step 5: Install the Frontend Plugin**

1.  Open SillyTavern.
2.  In the plugin installation menu, enter the following URL to install:
    `https://github.com/MAX-TAB/st-extension-qiros`
3.  Complete the installation as usual.
