import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const serverEntrypoint = path.join(repositoryRoot, "build", "index.js");

const stringifyEnv = (
  envOverrides: Record<string, string | undefined>,
): Record<string, string> => {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && envOverrides[key] !== undefined) {
      merged[key] = value;
      continue;
    }
    if (
      typeof value === "string" &&
      !Object.prototype.hasOwnProperty.call(envOverrides, key)
    ) {
      merged[key] = value;
    }
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
};

export interface McpHarnessOptions {
  envOverrides?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export class McpStdioHarness {
  private readonly timeoutMs: number;
  private readonly envOverrides: Record<string, string | undefined>;
  private client: Client | null = null;

  public constructor(options: McpHarnessOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.envOverrides = options.envOverrides ?? {};
  }

  public async start(): Promise<void> {
    if (!fs.existsSync(serverEntrypoint)) {
      throw new Error(
        `Server entrypoint not found at ${serverEntrypoint}. Run "npm run build" first.`,
      );
    }

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntrypoint],
      cwd: repositoryRoot,
      env: stringifyEnv(this.envOverrides),
      stderr: "inherit",
    });

    const client = new Client(
      {
        name: "vanta-mcp-integration-harness",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      },
    );

    await this.withTimeout(client.connect(transport), "client.connect");
    this.client = client;
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.close();
    this.client = null;
  }

  public async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    assert.ok(this.client, "Harness is not started.");
    return this.withTimeout(
      this.client.callTool({ name, arguments: args }),
      `callTool:${name}`,
    ) as Promise<CallToolResult>;
  }

  public async listTools(): Promise<string[]> {
    assert.ok(this.client, "Harness is not started.");
    const result = await this.withTimeout(this.client.listTools(), "listTools");
    return result.tools.map(tool => tool.name);
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(`${label} timed out after ${this.timeoutMs.toString()}ms.`),
        );
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
