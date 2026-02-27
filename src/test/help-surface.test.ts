import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildHelpCatalog } from "../help/catalog.js";
import {
  buildHelpResourceMarkdown,
  buildHelpToolMarkdown,
} from "../help/content.js";
import { registerHelpPrompts } from "../help/prompts.js";
import { registerHelpResources } from "../help/resources.js";
import { registerHelpSurface } from "../help/register-help.js";
import { helpPromptNames, helpResourceIds } from "../help/types.js";
import { parseToolEnvelope } from "./helpers.js";

type PromptHandler = (args: Record<string, string>) => {
  messages: {
    role: "user" | "assistant";
    content: { type: "text"; text: string };
  }[];
};
type ResourceHandler = (uri: URL) => Promise<{
  contents: { uri: string; mimeType?: string; text?: string }[];
}>;
type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}>;

class FakeServer {
  public promptHandlers = new Map<string, PromptHandler>();

  public resourceHandlers = new Map<string, ResourceHandler>();

  public toolHandlers = new Map<string, ToolHandler>();

  public prompt(name: string, ...args: unknown[]): void {
    const callback = args[args.length - 1] as PromptHandler;
    this.promptHandlers.set(name, callback);
  }

  public resource(name: string, ...args: unknown[]): void {
    void name;
    const uri = String(args[0]);
    const callback = args[args.length - 1] as ResourceHandler;
    this.resourceHandlers.set(uri, callback);
  }

  public tool(name: string, ...args: unknown[]): void {
    const callback = args[args.length - 1] as ToolHandler;
    this.toolHandlers.set(name, callback);
  }
}

test("help catalog includes generated, compatibility, and workflow families", () => {
  // Arrange
  const catalog = buildHelpCatalog();

  // Initial Assert
  assert.ok(catalog.summary.total > 0);

  // Act
  const hasGenerated = catalog.entries.some(
    entry => entry.category === "generated_endpoint",
  );
  const hasCompat = catalog.entries.some(
    entry => entry.category === "compat_read",
  );
  const hasWorkflow = catalog.entries.some(
    entry => entry.category === "workflow",
  );

  // Assert
  assert.equal(catalog.summary.byCategory.compat_read, 15);
  assert.equal(catalog.summary.byCategory.workflow, 5);
  assert.equal(hasGenerated, true);
  assert.equal(hasCompat, true);
  assert.equal(hasWorkflow, true);
});

test("help resources register all fixed URIs and return markdown", async () => {
  // Arrange
  const server = new FakeServer();

  // Initial Assert
  assert.equal(server.resourceHandlers.size, 0);

  // Act
  const registered = registerHelpResources(server as unknown as McpServer);
  const helpHandler = server.resourceHandlers.get(
    "resource://vanta-manage/help",
  );
  assert.ok(helpHandler);
  const helpResult = await helpHandler(new URL("resource://vanta-manage/help"));

  // Assert
  assert.equal(registered, helpResourceIds.length);
  assert.equal(server.resourceHandlers.size, helpResourceIds.length);
  assert.match(helpResult.contents[0].text ?? "", /Vanta Manage MCP Help/);
});

test("help prompts register expected playbooks and include execution guidance", () => {
  // Arrange
  const server = new FakeServer();

  // Initial Assert
  assert.equal(server.promptHandlers.size, 0);

  // Act
  const registered = registerHelpPrompts(server as unknown as McpServer);
  const handler = server.promptHandlers.get("playbook_control_evidence");
  assert.ok(handler);
  const result = handler({
    objective: "Attach SOC evidence",
    controlId: "control-1",
  });
  const text = result.messages[0].content.text;

  // Assert
  assert.equal(registered, helpPromptNames.length);
  assert.equal(server.promptHandlers.size, helpPromptNames.length);
  assert.match(text, /workflow_control_evidence/);
  assert.match(text, /confirm=true/);
});

test("help surface registers resources prompts and fallback help tool", async () => {
  // Arrange
  const server = new FakeServer();

  // Initial Assert
  assert.equal(server.toolHandlers.size, 0);

  // Act
  const counts = registerHelpSurface(server as unknown as McpServer);
  const helpTool = server.toolHandlers.get("help");
  assert.ok(helpTool);
  const toolResult = await helpTool({});
  const envelope = parseToolEnvelope(toolResult);

  // Assert
  assert.equal(counts.resources, helpResourceIds.length);
  assert.equal(counts.prompts, helpPromptNames.length);
  assert.equal(counts.fallbackHelpTool, 1);
  assert.equal(envelope.success, true);
});

test("help markdown builders include required sections", () => {
  // Arrange
  const context = {
    catalog: buildHelpCatalog(),
    safeModeEnabled: true,
    writeEnabled: true,
    hasEnabledToolFilter: false,
    enabledToolNames: [],
  };

  // Initial Assert
  assert.ok(context.catalog.summary.total > 0);

  // Act
  const resourceText = buildHelpResourceMarkdown(
    "resource://vanta-manage/safety",
    context,
  );
  const recipesText = buildHelpResourceMarkdown(
    "resource://vanta-manage/recipes",
    context,
  );
  const toolText = buildHelpToolMarkdown(context);

  // Assert
  assert.match(resourceText, /Mutation Rules/);
  assert.match(resourceText, /confirmation_required/);
  assert.match(recipesText, /Triaging Vulnerabilities/);
  assert.match(recipesText, /Employee Offboarding Tracker/);
  assert.match(toolText, /Vanta MCP Help Index/);
});
