import type { DeployStepInput } from "@levibostian/decaf-sdk";
import { runDeployScript } from "@levibostian/decaf-sdk/testing";
import { mockBin } from "@levibostian/mock-a-bin";
import { assertSnapshot } from "@std/testing/snapshot";

function makeInput(extra: Partial<DeployStepInput> = {}): DeployStepInput {
  return {
    gitCurrentBranch: "main",
    nextVersionName: "v1.0.0",
    testMode: true,
    ...extra,
  } as unknown as DeployStepInput;
}

// ---------------------------------------------------------------------------
// commit-and-push log snapshots
// ---------------------------------------------------------------------------

Deno.test("logs: commit-and-push in test mode with --add", async (t) => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git $*"; exit 0');
  try {
    const { stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push --add dist --add index.html",
      makeInput({ testMode: true, gitCurrentBranch: "main", nextVersionName: "v1.0.0" }),
    );
    await assertSnapshot(t, stdout.join("\n"));
  } finally {
    gitCleanup();
  }
});

Deno.test("logs: commit-and-push NOT in test mode calls git push", async (t) => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git $*"; exit 0');
  try {
    const { stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push --add dist",
      makeInput({ testMode: false, gitCurrentBranch: "main", nextVersionName: "v1.0.0" }),
    );
    await assertSnapshot(t, stdout.join("\n"));
  } finally {
    gitCleanup();
  }
});

Deno.test("logs: commit-and-push with --release-branch shows release branch in hash line", async (t) => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git $*"; exit 0');
  try {
    const { stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push --release-branch latest",
      makeInput({ testMode: true, gitCurrentBranch: "main", nextVersionName: "v1.0.0" }),
    );
    await assertSnapshot(t, stdout.join("\n"));
  } finally {
    gitCleanup();
  }
});

Deno.test("logs: commit-and-push without --release-branch shows gitCurrentBranch in hash line", async (t) => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git $*"; exit 0');
  try {
    const { stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push",
      makeInput({ testMode: true, gitCurrentBranch: "feature/my-feature", nextVersionName: "v2.0.0" }),
    );
    await assertSnapshot(t, stdout.join("\n"));
  } finally {
    gitCleanup();
  }
});
