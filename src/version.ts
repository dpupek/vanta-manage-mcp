import fs from "node:fs";
import { fileURLToPath } from "node:url";

export interface McpBuildInfo {
  version: string;
  releaseTag: string | null;
  commitSha: string | null;
}

const buildInfoPath = fileURLToPath(
  new URL("./build-info.json", import.meta.url),
);

const readBuildInfo = (): McpBuildInfo => {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(buildInfoPath, "utf8"),
    ) as Partial<McpBuildInfo>;
    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
      throw new Error("build metadata has no version");
    }
    return {
      version: parsed.version,
      releaseTag:
        typeof parsed.releaseTag === "string" ? parsed.releaseTag : null,
      commitSha: typeof parsed.commitSha === "string" ? parsed.commitSha : null,
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
