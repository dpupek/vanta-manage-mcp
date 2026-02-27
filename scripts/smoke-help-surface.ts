import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expectedResourceUris = [
  "resource://vanta-manage/help",
  "resource://vanta-manage/cheatsheet",
  "resource://vanta-manage/recipes",
  "resource://vanta-manage/tool-catalog",
  "resource://vanta-manage/workflow-playbooks",
  "resource://vanta-manage/safety",
  "resource://vanta-manage/troubleshooting",
] as const;

const expectedPromptNames = [
  "playbook_tool_selector",
  "playbook_control_evidence",
  "playbook_failing_controls_triage",
  "playbook_vendor_triage",
  "playbook_people_assets_vuln_triage",
  "playbook_information_request_triage",
  "playbook_vulnerability_due_soon_triage",
  "playbook_employee_onboarding_verification",
  "playbook_employee_offboarding_tracker",
  "playbook_vendor_risk_assessment",
  "playbook_policy_document_evidence_linkage",
] as const;

const samplePromptArgs: Record<string, Record<string, string>> = {
  playbook_tool_selector: {
    goal: "triage failing controls and attach evidence",
    scope: "audit + controls",
    constraints: "safe mode enabled",
  },
  playbook_control_evidence: {
    objective: "link evidence to control",
    controlId: "control-1",
    documentId: "document-1",
  },
  playbook_failing_controls_triage: {
    objective: "triage failing controls",
    controlId: "control-1",
  },
  playbook_vendor_triage: {
    objective: "review vendor findings",
    vendorId: "vendor-1",
  },
  playbook_people_assets_vuln_triage: {
    objective: "triage vulnerabilities",
    vulnerabilityId: "vuln-1",
  },
  playbook_information_request_triage: {
    objective: "triage open info requests",
    auditId: "audit-1",
  },
  playbook_vulnerability_due_soon_triage: {
    objective: "triage due-soon vulnerabilities",
    dueWindowDays: "14",
    integrationHint: "Microsoft Defender",
  },
  playbook_employee_onboarding_verification: {
    objective: "verify onboarding status",
    personId: "person-1",
  },
  playbook_employee_offboarding_tracker: {
    objective: "track offboarding actions",
    personId: "person-2",
  },
  playbook_vendor_risk_assessment: {
    objective: "assist vendor risk review",
    vendorId: "vendor-1",
  },
  playbook_policy_document_evidence_linkage: {
    objective: "link policy evidence to document evidence",
    policyId: "policy-1",
    documentId: "document-1",
  },
};

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const serverEntrypoint = path.join(repositoryRoot, "build", "index.js");

const parseToolAllowlist = (): Set<string> => {
  const raw = process.env.VANTA_MCP_ENABLED_TOOLS;
  if (!raw) {
    return new Set<string>();
  }
  return new Set(
    raw
      .split(",")
      .map(item => item.trim().toLowerCase())
      .filter(item => item.length > 0),
  );
};

const hasCredentialsConfigured = (): boolean => {
  const envFile = process.env.VANTA_ENV_FILE;
  if (envFile && envFile.trim().length > 0) {
    const fullPath = path.resolve(envFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(
        `VANTA_ENV_FILE was set but file does not exist: ${fullPath}`,
      );
    }
    return true;
  }

  return Boolean(
    process.env.VANTA_CLIENT_ID && process.env.VANTA_CLIENT_SECRET,
  );
};

const toSpawnEnvironment = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  return env;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    handle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs.toString()}ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (handle !== undefined) {
      clearTimeout(handle);
    }
  }
};

const expectTextContent = (
  text: string | undefined,
  context: string,
): string => {
  if (typeof text !== "string") {
    throw new Error(`${context} missing text content.`);
  }
  assert.ok(text.length > 20, `${context} returned unexpectedly short text.`);
  return text;
};

const main = async (): Promise<void> => {
  if (!fs.existsSync(serverEntrypoint)) {
    throw new Error(
      `Server entrypoint not found at ${serverEntrypoint}. Run "npm run build" first.`,
    );
  }

  if (!hasCredentialsConfigured()) {
    console.log(
      "SKIP: smoke-help-surface requires Vanta credentials (VANTA_ENV_FILE or VANTA_CLIENT_ID/VANTA_CLIENT_SECRET).",
    );
    return;
  }

  const timeoutMs = Number(process.env.VANTA_MCP_SMOKE_TIMEOUT_MS ?? "30000");
  const toolAllowlist = parseToolAllowlist();
  const helpToolExpected =
    toolAllowlist.size === 0 || toolAllowlist.has("help");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntrypoint],
    cwd: repositoryRoot,
    env: toSpawnEnvironment(),
    stderr: "inherit",
  });

  const client = new Client(
    {
      name: "vanta-manage-smoke-help-surface",
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

  try {
    await withTimeout(
      client.connect(transport),
      timeoutMs,
      "MCP client connect",
    );

    const resources = await withTimeout(
      client.listResources(),
      timeoutMs,
      "listResources",
    );
    const resourceUris = new Set(
      resources.resources.map(resource => resource.uri),
    );
    for (const expectedUri of expectedResourceUris) {
      assert.ok(
        resourceUris.has(expectedUri),
        `Missing resource URI: ${expectedUri}`,
      );
    }

    for (const expectedUri of expectedResourceUris) {
      const readResult = await withTimeout(
        client.readResource({ uri: expectedUri }),
        timeoutMs,
        `readResource ${expectedUri}`,
      );
      assert.ok(
        readResult.contents.length > 0,
        `No contents returned for ${expectedUri}`,
      );
      const firstContent = readResult.contents[0] as { text?: string };
      const text = expectTextContent(firstContent.text, expectedUri);
      assert.ok(
        text.includes("#"),
        `${expectedUri} should be markdown and include heading text.`,
      );
    }

    const prompts = await withTimeout(
      client.listPrompts(),
      timeoutMs,
      "listPrompts",
    );
    const promptNames = new Set(prompts.prompts.map(prompt => prompt.name));
    for (const promptName of expectedPromptNames) {
      assert.ok(promptNames.has(promptName), `Missing prompt: ${promptName}`);
    }

    for (const promptName of expectedPromptNames) {
      const promptResult = await withTimeout(
        client.getPrompt({
          name: promptName,
          arguments: samplePromptArgs[promptName],
        }),
        timeoutMs,
        `getPrompt ${promptName}`,
      );
      assert.ok(
        promptResult.messages.length > 0,
        `Prompt has no messages: ${promptName}`,
      );
      const first = promptResult.messages[0];
      assert.equal(first.content.type, "text");
      const text = expectTextContent(first.content.text, promptName);
      assert.ok(
        text.includes("confirm=true"),
        `Prompt should remind about confirm=true: ${promptName}`,
      );
    }

    if (helpToolExpected) {
      const toolResult = (await withTimeout(
        client.callTool({
          name: "help",
          arguments: {},
        }),
        timeoutMs,
        "callTool help",
      )) as {
        content?: { type: string; text?: string }[];
      };
      assert.ok(
        Array.isArray(toolResult.content),
        "help tool returned non-array content.",
      );
      assert.ok(
        toolResult.content.length > 0,
        "help tool returned empty content.",
      );
      const first = toolResult.content[0];
      assert.equal(first.type, "text");
      const envelopeText = expectTextContent(first.text, "help tool");
      const envelope = JSON.parse(envelopeText) as {
        success?: boolean;
        data?: { markdown?: string };
      };
      assert.equal(
        envelope.success,
        true,
        "help tool should return success envelope.",
      );
      assert.equal(
        typeof envelope.data?.markdown,
        "string",
        "help tool envelope missing markdown.",
      );
      assert.ok(
        String(envelope.data?.markdown).includes(
          "resource://vanta-manage/help",
        ),
        "help tool markdown should point to resource help index.",
      );
    } else {
      console.log(
        "NOTE: help tool check skipped because VANTA_MCP_ENABLED_TOOLS excludes help.",
      );
    }

    console.log("PASS: MCP help surface smoke check succeeded.");
  } finally {
    await client.close();
  }
};

main().catch(error => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`FAIL: smoke-help-surface: ${message}`);
  process.exit(1);
});
