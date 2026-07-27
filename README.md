# decaf-script-git

A script specifically designed for the [decaf](https://github.com/levibostian/decaf) deployment automation tool. This script helps you perform Git operations as part of your continuous deployment workflows.

## What does this script do?

This script provides two commands to automate a common release-branch deployment pattern:

1. **Merge your working branch into a dedicated release branch** (where built/compiled artifacts live)
2. **Stage, commit, and push** the compiled files on that release branch

# Getting Started

Run using decaf's `shebang` command in your deployment workflow.

**GitHub Actions Example**

```yaml
- uses: levibostian/decaf
  with:
    deploy: |
      decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> merge-into-release-branch --release-branch latest
      # ... run your build steps here ...
      decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> commit-and-push --add dist
    # Other decaf arguments...
```

Replace `<version-here>` with a [release](https://github.com/levibostian/decaf-script-git/releases). Latest: ![GitHub Release](https://img.shields.io/github/v/release/levibostian/decaf-script-git)

**Command Line Example**

```bash
decaf \
  --deploy "decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> merge-into-release-branch --release-branch latest && decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> commit-and-push --add dist"
```

### Set the git commit author 

Most if not all of the commands in this script will create new git commits. If you want to set the author of those commits, see [the `git_config` option to pass into decaf](https://github.com/levibostian/decaf#options). 

---

## Commands

| Command | Aliases | Description |
|---|---|---|
| [`merge-into-release-branch`](#merge-into-release-branch) | `merge`, `update-release-branch` | Checkout the release branch and merge the current branch into it |
| [`commit-and-push`](#commit-and-push) | `commit` | Stage files, commit, and push to the current branch |

---

### merge-into-release-branch

**Aliases:** `merge`, `update-release-branch`

Checks out the release branch and merges the current branch into it. Run this before your build steps so that the release branch is up to date before you compile and commit artifacts.

**Options:**

| Flag | Required | Description |
|---|---|---|
| `--release-branch <branch>` | Yes | Branch to checkout and merge into |
| `--merge-options <options>` | No | Options string passed directly to `git merge`. Use `=` syntax for values containing spaces: `--merge-options="--ff --no-edit"` |

**Examples:**

```bash
# Basic usage
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> merge-into-release-branch --release-branch latest

# With merge strategy flags
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> merge-into-release-branch --release-branch latest --merge-options="--ff --no-edit"

# Using an alias
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> merge --release-branch stable
```

---

### commit-and-push

**Aliases:** `commit`

Stages files, commits them, and pushes. Run this after your build steps to commit and push the compiled artifacts back to your repo.

**Options:**

| Flag | Required | Description |
|---|---|---|
| `--add <path>` | No | Path to `git add -f`. Repeatable. If omitted, no `git add` is run. |
| `--commit-message <template>` | No | Commit message template. Default: `chore: release {{ nextVersionName }}`. Supports template variables (see below). |
| `--release-branch <branch>` | No | Only needed if you use `{{ releaseBranch }}` in your commit message template. |

**Commit message template variables:**

Any field from the decaf `DeployStepInput` object is available, plus `releaseBranch`. Common ones:

| Variable | Example value |
|---|---|
| `{{ nextVersionName }}` | `v1.2.3` |
| `{{ gitCurrentBranch }}` | `main` |
| `{{ releaseBranch }}` | `latest` |

**Examples:**

```bash
# Stage dist/ and commit with default message
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> commit-and-push --add dist

# Stage multiple paths
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> commit-and-push --add dist --add index.html

# Custom commit message
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> commit-and-push --add dist --commit-message "build: release {{ nextVersionName }}"

# Include release branch in commit message
decaf shebang git@github.com:levibostian/decaf-script-git.git/shebang.sh@<version-here> commit-and-push --add dist --release-branch latest --commit-message "deploy {{ nextVersionName }} to {{ releaseBranch }}"
```
