import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  version: string;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const runGit = (args: string[]): string | null => {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const isReleaseTag = (value: string): boolean => /^v\d+\.\d+\.\d+$/.test(value);

const resolveReleaseTag = (): string | null => {
  const configuredTag = process.env.VANTA_MCP_RELEASE_TAG?.trim();
  if (configuredTag) {
    return configuredTag;
  }

  const exactTags = runGit(["tag", "--points-at", "HEAD"]);
  return (
    exactTags
      ?.split(/\r?\n/)
      .map(tag => tag.trim())
      .find(isReleaseTag) ?? null
  );
};

const main = (): void => {
  const packageManifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as PackageManifest;
  const releaseTag = resolveReleaseTag();
  const commitSha =
    process.env.VANTA_MCP_RELEASE_COMMIT?.trim() ??
    runGit(["rev-parse", "HEAD"]);
  const version = releaseTag?.replace(/^v/, "") ?? packageManifest.version;
  const buildInfo = {
    version,
    releaseTag,
    commitSha,
  };

  fs.writeFileSync(
    path.join(repositoryRoot, "build", "build-info.json"),
    `${JSON.stringify(buildInfo, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `Generated build metadata for ${releaseTag ?? `package ${version}`}\n`,
  );
};

main();
