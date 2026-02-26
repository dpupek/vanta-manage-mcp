import { ApiSource } from "../generated/operations.generated.js";

export const helpResourceIds = [
  "resource://vanta-manage/help",
  "resource://vanta-manage/cheatsheet",
  "resource://vanta-manage/tool-catalog",
  "resource://vanta-manage/workflow-playbooks",
  "resource://vanta-manage/safety",
  "resource://vanta-manage/troubleshooting",
] as const;

export type HelpResourceId = (typeof helpResourceIds)[number];

export const helpPromptNames = [
  "playbook_tool_selector",
  "playbook_control_evidence",
  "playbook_failing_controls_triage",
  "playbook_vendor_triage",
  "playbook_people_assets_vuln_triage",
  "playbook_information_request_triage",
] as const;

export type HelpPromptName = (typeof helpPromptNames)[number];

export type HelpCatalogCategory =
  | "generated_endpoint"
  | "compat_read"
  | "workflow";

export type HelpCatalogSource = ApiSource | "compat" | "workflow";

export interface HelpCatalogEntry {
  name: string;
  description: string;
  category: HelpCatalogCategory;
  source: HelpCatalogSource;
  method?: string;
  path?: string;
  operationId?: string;
  mappingIntent?: string;
  mode?: string;
  isMutation: boolean;
  enabled: boolean;
}

export interface HelpCatalogSummary {
  total: number;
  enabled: number;
  byCategory: {
    generated_endpoint: number;
    compat_read: number;
    workflow: number;
  };
  generatedBySource: Record<ApiSource, number>;
  mutating: number;
}

export interface HelpCatalog {
  entries: HelpCatalogEntry[];
  summary: HelpCatalogSummary;
}

export interface ToolSelectorPromptArgs {
  goal: string;
  scope?: string;
  constraints?: string;
}

export interface ControlEvidencePromptArgs {
  objective: string;
  controlId?: string;
  documentId?: string;
}

export interface FailingControlsPromptArgs {
  objective: string;
  controlId?: string;
}

export interface VendorTriagePromptArgs {
  objective: string;
  vendorId?: string;
}

export interface PeopleAssetsVulnPromptArgs {
  objective: string;
  vulnerabilityId?: string;
}

export interface InformationRequestPromptArgs {
  objective: string;
  auditId: string;
}
