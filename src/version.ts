import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface McpBuildInfo {
  version: string;
  releaseTag: string | null;
  commitSha: string | null;
}

const buildInfoPath = fileURLToPath(
  new URL("./build-info.json", import.meta.url),
);
const packageDirectory = path.resolve(path.dirname(buildInfoPath), "..");

interface InstalledPackageLock {
  packages?: Record<string, { resolved?: string }>;
}

interface PackageManifest {
  name?: string;
  repository?: string | { url?: string };
}

const isReleaseTag = (value: string): boolean => /^v\d+\.\d+\.\d+$/.test(value);

const resolveInstalledGitIdentity = (): Omit<McpBuildInfo, "version"> | null => {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
    ) as PackageManifest;
    if (!manifest.name) {
      return null;
    }

    const lockfile = JSON.parse(
      fs.readFileSync(
        path.resolve(packageDirectory, "..", "..", "package-lock.json"),
        "utf8",
      ),
    ) as InstalledPackageLock;
    const resolved = lockfile.packages?.[`node_modules/${manifest.name}`]?.resolved;
    const commitSha = resolved?.match(/#([a-f0-9]{40})$/i)?.[1] ?? null;
    const repositoryUrl =
      typeof manifest.repository === "string"
        ? manifest.repository
        : manifest.repository?.url;
    if (!commitSha || !repositoryUrl) {
      return null;
    }

    const remoteTags = execFileSync(
      "git",
      ["ls-remote", "--tags", repositoryUrl.replace(/^git\+/, "")],
      {
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const releaseTag = remoteTags
      .split(/\r?\n/)
      .map(line => line.split("\t"))
      .find(
        ([sha, ref]) =>
          sha === commitSha &&
          /^refs\/tags\/v\d+\.\d+\.\d+(?:\^\{\})?$/.test(ref),
      )?.[1]
      .replace("refs/tags/", "")
      .replace("^{}", "");

    return {
      releaseTag:
        releaseTag && isReleaseTag(releaseTag) ? releaseTag : null,
      commitSha,
    };
  } catch {
    return null;
  }
};

const readBuildInfo = (): McpBuildInfo => {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(buildInfoPath, "utf8"),
    ) as Partial<McpBuildInfo>;
    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
      throw new Error("build metadata has no version");
    }
    const buildInfo = {
      version: parsed.version,
      releaseTag:
        typeof parsed.releaseTag === "string" ? parsed.releaseTag : null,
      commitSha: typeof parsed.commitSha === "string" ? parsed.commitSha : null,
    };
    if (buildInfo.releaseTag !== null || buildInfo.commitSha !== null) {
      return buildInfo;
    }

    const installedIdentity = resolveInstalledGitIdentity();
    if (!installedIdentity) {
      return buildInfo;
    }
    return {
      version: installedIdentity.releaseTag?.replace(/^v/, "") ?? buildInfo.version,
      ...installedIdentity,
    };
  } catch {
    return {
      version: "unknown",
      releaseTag: null,
      commitSha: null,
    };
  }
};

export const MCP_NAME = "vanta-mcp-full";
export const MCP_BUILD_INFO = readBuildInfo();
export const MCP_VERSION = MCP_BUILD_INFO.version;
