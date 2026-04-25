import type { DeployStepInput } from "@levibostian/decaf-sdk";
import { runDeployScript } from "@levibostian/decaf-sdk/testing";
import { mockBin } from "@levibostian/mock-a-bin";
import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderStringTemplate } from "./script.ts";

function stdoutText(lines: string[]): string {
  return lines.join("\n");
}

async function mockGit() {
  return await mockBin("git", "bash", 'echo "git $*"; exit 0');
}

function makeInput(extra: Partial<DeployStepInput> = {}): DeployStepInput {
  return {
    gitCurrentBranch: "main",
    nextVersionName: "v1.0.0",
    testMode: true,
    ...extra,
  } as unknown as DeployStepInput;
}

// ---------------------------------------------------------------------------
// No command provided
// ---------------------------------------------------------------------------

Deno.test("no command provided exits with code 1 and prints help", async () => {
  const { code, stdout } = await runDeployScript(
    "deno run --allow-all script.ts",
    makeInput(),
  );

  assertEquals(code, 1);
  assertStringIncludes(stdoutText(stdout), "Error: no command provided.");
  assertStringIncludes(stdoutText(stdout), "merge-into-release-branch");
  assertStringIncludes(stdoutText(stdout), "commit-and-push");
});

Deno.test("unknown command exits with code 1", async () => {
  const { code, stdout } = await runDeployScript(
    "deno run --allow-all script.ts foobar",
    makeInput(),
  );

  assertEquals(code, 1);
  assertStringIncludes(stdoutText(stdout), "Unknown command: foobar");
});

Deno.test("--help prints usage and exits 0", async () => {
  const { code, stdout } = await runDeployScript(
    "deno run --allow-all script.ts --help",
    makeInput(),
  );

  assertEquals(code, 0);
  assertStringIncludes(stdoutText(stdout), "merge-into-release-branch");
  assertStringIncludes(stdoutText(stdout), "commit-and-push");
  assertStringIncludes(stdoutText(stdout), "--release-branch");
  assertStringIncludes(stdoutText(stdout), "--merge-options");
  assertStringIncludes(stdoutText(stdout), "--add");
  assertStringIncludes(stdoutText(stdout), "--commit-message");
});

// ---------------------------------------------------------------------------
// merge-into-release-branch command
// ---------------------------------------------------------------------------

Deno.test("merge-into-release-branch requires --release-branch", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts merge-into-release-branch",
      makeInput(),
    );

    assertEquals(code, 1);
    assertStringIncludes(stdoutText(stdout), "--release-branch is required");
  } finally {
    gitCleanup();
  }
});

Deno.test("merge-into-release-branch checks out release branch and merges current branch", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts merge-into-release-branch --release-branch latest",
      makeInput({ gitCurrentBranch: "main" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "git checkout latest");
    assertStringIncludes(stdoutText(stdout), "git merge main");
  } finally {
    gitCleanup();
  }
});

Deno.test("merge-into-release-branch with --merge-options passes them to git merge", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      `deno run --allow-all script.ts merge-into-release-branch --release-branch latest '--merge-options=--ff --no-edit'`,
      makeInput({ gitCurrentBranch: "main" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "git merge --ff --no-edit main");
  } finally {
    gitCleanup();
  }
});

Deno.test("merge-into-release-branch without --merge-options runs git merge with no extra flags", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts merge-into-release-branch --release-branch latest",
      makeInput({ gitCurrentBranch: "develop" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "git merge develop");
    // No extra flags before branch name
    assertEquals(stdoutText(stdout).includes("git merge --"), false);
  } finally {
    gitCleanup();
  }
});

// ---------------------------------------------------------------------------
// commit-and-push command
// ---------------------------------------------------------------------------

Deno.test("commit-and-push in test mode skips git push", async () => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git-was-called: $*"; exit 0');
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push --add dist",
      makeInput({ testMode: true }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "Running in test mode, skipping command: git push");
    assertEquals(stdoutText(stdout).includes("git-was-called: push"), false);
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push NOT in test mode DOES call git push", async () => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git-was-called: $*"; exit 0');
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push --add dist",
      makeInput({ testMode: false }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "git-was-called: push");
    assertEquals(stdoutText(stdout).includes("skipping command: git push"), false);
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push with --add stages each path", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push --add dist --add index.html --add foo.txt",
      makeInput(),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "git add -f dist");
    assertStringIncludes(stdoutText(stdout), "git add -f index.html");
    assertStringIncludes(stdoutText(stdout), "git add -f foo.txt");
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push with no --add skips git add entirely", async () => {
  const gitCleanup = await mockBin("git", "bash", 'echo "git-was-called: $*"; exit 0');
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push",
      makeInput(),
    );

    assertEquals(code, 0);
    assertEquals(stdoutText(stdout).includes("git-was-called: add"), false);
    // commit still runs
    assertStringIncludes(stdoutText(stdout), "git-was-called: commit");
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push uses default commit message with nextVersionName interpolated", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      "deno run --allow-all script.ts commit-and-push",
      makeInput({ nextVersionName: "v5.0.0" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "chore: release v5.0.0");
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push with --commit-message uses custom template", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      `deno run --allow-all script.ts commit-and-push --commit-message "build: compiled {{ nextVersionName }}"`,
      makeInput({ nextVersionName: "v2.0.0" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "build: compiled v2.0.0");
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push --commit-message supports releaseBranch variable", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      `deno run --allow-all script.ts commit-and-push --release-branch stable --commit-message "deploy {{ nextVersionName }} to {{ releaseBranch }}"`,
      makeInput({ nextVersionName: "v1.0.0" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "deploy v1.0.0 to stable");
  } finally {
    gitCleanup();
  }
});

Deno.test("commit-and-push --commit-message supports gitCurrentBranch variable", async () => {
  const gitCleanup = await mockGit();
  try {
    const { code, stdout } = await runDeployScript(
      `deno run --allow-all script.ts commit-and-push --commit-message "merge from {{ gitCurrentBranch }}"`,
      makeInput({ gitCurrentBranch: "feature/xyz" }),
    );

    assertEquals(code, 0);
    assertStringIncludes(stdoutText(stdout), "merge from feature/xyz");
  } finally {
    gitCleanup();
  }
});

// ---------------------------------------------------------------------------
// renderStringTemplate unit tests
// ---------------------------------------------------------------------------

Deno.test("renderStringTemplate replaces {{ nextVersionName }}", async () => {
  const result = await renderStringTemplate("chore: release {{ nextVersionName }}", { nextVersionName: "v2.0.0" });
  assertEquals(result, "chore: release v2.0.0");
});

Deno.test("renderStringTemplate replaces multiple variables", async () => {
  const result = await renderStringTemplate(
    "release {{ nextVersionName }} on {{ releaseBranch }} from {{ gitCurrentBranch }}",
    { nextVersionName: "v1.5.0", releaseBranch: "stable", gitCurrentBranch: "main" },
  );
  assertEquals(result, "release v1.5.0 on stable from main");
});

Deno.test("renderStringTemplate leaves unknown variables as empty string", async () => {
  const result = await renderStringTemplate("hello {{ unknown }}", {});
  assertEquals(result, "hello ");
});

Deno.test("renderStringTemplate throws a descriptive error on invalid template syntax", async () => {
  let threw = false;
  try {
    await renderStringTemplate("{{ if }}", {});
  } catch (e) {
    threw = true;
    assertEquals(
      (e as Error).message,
      "Failed to render the string template. The template given is:\n{{ if }}\n\nThere is likely a syntax error in the template.\nOriginal error: SyntaxError: Unexpected token 'if'",
    );
  }
  assertEquals(threw, true);
});
