# Qiros Server - Backend for SillyTavern Git-based Collaboration Plugin

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_v3-red.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/MAX-TAB/qiros-server)

[中文版](README.md)

This is a plugin designed for [SillyTavern](https://github.com/SillyTavern/SillyTavern), providing a powerful backend service to handle all Git and GitHub related operations. It is a core dependency for the [Qiros Frontend Plugin](https://github.com/MAX-TAB/st-extension-qiros).

With this plugin, you can transform the creation and maintenance of character cards from isolated, individual work into a version-controlled, traceable, and collaborative structured project.

## Core Architecture

This plugin adopts the principle of **separating data from its carrier**, providing a stable, efficient, and collaborative solution for managing character cards:

- **Data (`character.json`)**: The core definition of a character, including description, personality, dialogue examples, and all other textual information. This is the **protagonist** of collaboration and version control, which will be synchronized via Git in the cloud.
- **Carrier (`card.png`)**: The character's image. It serves as a local "container" for the data. The image itself is **not** uploaded or modified. All cloud data updates are "seamlessly" injected into your local image.

## Key Features

- **GitHub OAuth Authentication**: Secure and reliable user authentication flow.
- **Repository Management**: Create or link remote GitHub repositories from within the plugin.
- **Versioned Text Data**: Implements push, pull, version history viewing, diff comparison, and version rollback exclusively for the core `character.json` file.
- **Seamless Local Updates**:
  - **Pull/Revert**: After fetching a specific version of `character.json` from the cloud, the plugin automatically injects it into your local `card.png` file, enabling seamless updates to existing characters without manual image replacement.
  - **Push**: Pushes only your local `character.json` data to the repository, without involving the image file at all.
- **Branch & Release Management**: Supports creating and listing branches, as well as one-click creation of GitHub Releases with `character.json` as an attachment.
- **Collaboration Workflow**: Supports forking repositories and creating pull requests.

## Installation Guide

**Step 1: Enable SillyTavern Server Plugins**

1.  Open SillyTavern's configuration file, `config.yaml`.
2.  Find and change the following two items to `true`:
    ```yaml
    enableServerPlugins: true
    enableServerPluginsAutoUpdate: true
    ```

**Step 2: Install the Qiros Server Backend**

- **Via `git clone` (Recommended):**

  1.  Open a terminal or command prompt.
  2.  Navigate to your SillyTavern's `plugins` directory: `cd path/to/SillyTavern/plugins`
  3.  Run the clone command: `git clone https://github.com/MAX-TAB/qiros-server.git`

- **Manual Install:**
  1.  On the [qiros-server GitHub page](https://github.com/MAX-TAB/qiros-server), click `Code` -> `Download ZIP`.
  2.  Move the extracted folder to your `SillyTavern\plugins` directory.

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
