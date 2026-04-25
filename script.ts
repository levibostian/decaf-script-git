import { DeployStepInput, getDeployStepInput } from "@levibostian/decaf-sdk";
import $ from "@david/dax";
import vento from "ventojs";
import { parseArgs } from "@std/cli/parse-args";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MergeIntoReleaseBranchOptions {
  releaseBranch: string;
  currentBranch: string;
  mergeOptions: string;
}

export interface CommitAndPushOptions {
  // these are args that are not part of DeployStepInput
  addPaths: string[];
  commitMessage: string;
  releaseBranch: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_COMMIT_MESSAGE = "chore: release {{ nextVersionName }}";

// ---------------------------------------------------------------------------
// Template rendering (VentoJS)
// ---------------------------------------------------------------------------

export async function renderStringTemplate(
  templateString: string,
  data: Record<string, unknown>,
): Promise<string> {
  try {
    const engine = vento();
    const result = await engine.runString(templateString, data);
    return result.content;
  } catch (error) {
    throw new Error(
      `Failed to render the string template. The template given is:\n${templateString}\n\nThere is likely a syntax error in the template.\nOriginal error: ${error}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const mergeIntoReleaseBranch = async (options: MergeIntoReleaseBranchOptions): Promise<void> => {
  const { releaseBranch, currentBranch, mergeOptions: mergeOptionsString } = options;

  // dax requires you send an array for arguments and it will escape them for you. 
  const mergeOptions: string[] = mergeOptionsString.trim() !== ""
    ? [...mergeOptionsString.trim().split(/\s+/)]
    : [];

  await $`git checkout ${releaseBranch}`.printCommand();
  await $`git merge ${mergeOptions} ${currentBranch}`.printCommand();

  const commitHash = await $`git rev-parse HEAD`.text();
  const branchName = await $`git rev-parse --abbrev-ref HEAD`.text();
  console.log(`latest commit on branch ${branchName}: ${commitHash}`);
};

export const commitAndPush = async (options: CommitAndPushOptions, input: DeployStepInput): Promise<void> => {
  const { addPaths, commitMessage, releaseBranch } = options;

  const commitMsg = await renderStringTemplate(commitMessage, { ...input, releaseBranch });

  for (const path of addPaths) {
    // using 'git add -f' to force add files that might be in .gitignore (e.g. dist/)
    // which is likely for someone using a release branch. 
    await $`git add -f ${path}`.printCommand();
  }
  // the '|| true' is to prevent this command from erroring out if there are no changes to commit.
  // this can happen if git add doesn't actually add any files. if you're re-running a failed decaf deploy, this is likely. 
  await $`git commit -m ${commitMsg} || true`.printCommand();

  // show the commit hash in the logs. it's helpful for users to see this for their own debugging if they need to look up the commit later. 
  const commitHash = await $`git rev-parse HEAD`.text();
  const branchName = await $`git rev-parse --abbrev-ref HEAD`.text();
  console.log(`latest commit on branch ${branchName}: ${commitHash}`);

  if (input.testMode) {
    console.log("Running in test mode, skipping command: git push");
  } else {
    await $`git push`.printCommand();
  }
};

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function showHelp() {
  console.log(`
Usage:
  script.ts <command> [options]

Commands:
  merge-into-release-branch   Checkout the release branch and merge the current branch into it
    Aliases: mirb, update-release-branch

  commit-and-push             Stage files, commit, and push
    Aliases: cap, c

Options for merge-into-release-branch:
  --release-branch <branch>   (required) Branch to checkout and merge into
  --merge-options <options>   Options string passed to git merge, use = syntax for values with spaces (e.g. --merge-options="--ff --no-edit")

Options for commit-and-push:
  --add <path>                Path to git add -f (can be repeated; if omitted, no git add is run)
  --commit-message <template> Commit message template (default: "${DEFAULT_COMMIT_MESSAGE}")
                              Supports {{ nextVersionName }}, {{ currentBranch }}, {{ releaseBranch }}

Examples:
  script.ts merge-into-release-branch --release-branch latest --merge-options="--ff --no-edit"
  script.ts commit-and-push --add dist --add index.html --commit-message "chore: release {{ nextVersionName }}"
`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["release-branch", "commit-message", "merge-options"],
    collect: ["add"],
    default: {
      "commit-message": DEFAULT_COMMIT_MESSAGE,
      "merge-options": "",
      "add": [] as string[],
    },
    alias: { h: "help" },
    boolean: ["help"],
  });

  if (args.help) {
    showHelp();
    Deno.exit(0);
  }

  if (args._.length === 0) {
    console.error("Error: no command provided.");
    showHelp();
    Deno.exit(1);
  }

  const command = String(args._[0]);

  switch (command) {
    case "merge-into-release-branch":
    case "merge":
    case "update-release-branch": {
      const releaseBranch = args["release-branch"];
      if (!releaseBranch) {
        console.error("Error: --release-branch is required for this command.");
        Deno.exit(1);
      }
      const input = getDeployStepInput();
      await mergeIntoReleaseBranch({
        releaseBranch,
        currentBranch: input.gitCurrentBranch,
        mergeOptions: args["merge-options"] as string,
      });
      break;
    }
    case "commit-and-push":
    case "commit": {
      const input = getDeployStepInput();
      await commitAndPush({
        addPaths: args["add"] as string[],
        commitMessage: args["commit-message"] as string,
        releaseBranch: args["release-branch"] ?? "",
      }, input);
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      showHelp();
      Deno.exit(1);
    }
  }
}
