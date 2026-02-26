# Vanta MCP Tool Catalog

This catalog documents the full tool surface exposed by this server.

## Summary

- Generated endpoint tools: 219
- Compatibility read tools: 15
- Workflow tools: 5
- Total tools (default): 239

## Envelope Contract

- Success: `{ success: true, data, message?, notes? }`
- Error: `{ success: false, error: { code, message, hint?, details? }, notes? }`

## Safety Contract

- Mutating endpoint tools include `confirm?: boolean`.
- In safe mode (`VANTA_MCP_SAFE_MODE=true`), mutation without `confirm=true` returns `confirmation_required`.
- Workflow tools require `mode: "plan" | "execute"`; execute requires `confirm=true`.

## Compatibility Read Tools

- `controls`
- `documents`
- `tests`
- `integrations`
- `frameworks`
- `vulnerabilities`
- `people`
- `vendors`
- `risks`
- `list_control_tests`
- `list_control_documents`
- `list_framework_controls`
- `list_test_entities`
- `document_resources`
- `integration_resources`

## Workflow Tools

- `workflow_control_evidence`
- `workflow_triage_failing_controls`
- `workflow_vendor_triage`
- `workflow_people_assets_vuln_triage`
- `workflow_information_request_triage`

## Example Calls

### List controls (compat)
```json
{
  "tool": "controls",
  "input": { "pageSize": 25 }
}
```

### Mutating endpoint preview (safe mode)
```json
{
  "tool": "create_custom_control",
  "input": { "body": { "name": "Encryption Policy" } }
}
```

### Mutating endpoint execute
```json
{
  "tool": "create_custom_control",
  "input": {
    "confirm": true,
    "body": { "name": "Encryption Policy" }
  }
}
```

### Workflow plan/execute
```json
{
  "tool": "workflow_vendor_triage",
  "input": { "mode": "plan" }
}
```

```json
{
  "tool": "workflow_vendor_triage",
  "input": {
    "mode": "execute",
    "confirm": true,
    "actions": [
      {
        "type": "set_vendor_status",
        "vendorId": "vendor-123",
        "payload": { "status": "approved" }
      }
    ]
  }
}
```

## Generated Endpoint Tools

| Tool | Source | Method | Path | Mutating |
|---|---|---|---|---|
| `create_custom_control` | manage | POST | `/controls` | yes |
| `list_controls` | manage | GET | `/controls` | no |
| `add_control_from_library` | manage | POST | `/controls/add-from-library` | yes |
| `list_library_controls` | manage | GET | `/controls/controls-library` | no |
| `update_control_metadata` | manage | PATCH | `/controls/{controlId}` | yes |
| `delete_control` | manage | DELETE | `/controls/{controlId}` | yes |
| `get_control` | manage | GET | `/controls/{controlId}` | no |
| `add_document_to_control` | manage | POST | `/controls/{controlId}/add-document-to-control` | yes |
| `add_test_to_control` | manage | POST | `/controls/{controlId}/add-test-to-control` | yes |
| `list_documents_for_control` | manage | GET | `/controls/{controlId}/documents` | no |
| `delete_document_forcontrol` | manage | DELETE | `/controls/{controlId}/documents/{documentId}` | yes |
| `set_owner_for_control` | manage | POST | `/controls/{controlId}/set-owner` | yes |
| `list_tests_for_control` | manage | GET | `/controls/{controlId}/tests` | no |
| `delete_test_for_control` | manage | DELETE | `/controls/{controlId}/tests/{testId}` | yes |
| `list_customer_trust_accounts` | manage | GET | `/customer-trust/accounts` | no |
| `create_customer_trust_account` | manage | POST | `/customer-trust/accounts` | yes |
| `get_customer_trust_account` | manage | GET | `/customer-trust/accounts/{accountId}` | no |
| `list_questionnaires` | manage | GET | `/customer-trust/questionnaires` | no |
| `initiate_export` | manage | POST | `/customer-trust/questionnaires/exports` | yes |
| `get_questionnaire_export` | manage | GET | `/customer-trust/questionnaires/exports/{id}` | no |
| `create_file_questionnaire` | manage | POST | `/customer-trust/questionnaires/file` | yes |
| `create_website_questionnaire` | manage | POST | `/customer-trust/questionnaires/website` | yes |
| `get_questionnaire` | manage | GET | `/customer-trust/questionnaires/{questionnaireId}` | no |
| `delete_questionnaire` | manage | DELETE | `/customer-trust/questionnaires/{questionnaireId}` | yes |
| `update_questionnaire` | manage | PATCH | `/customer-trust/questionnaires/{questionnaireId}` | yes |
| `complete_questionnaire` | manage | POST | `/customer-trust/questionnaires/{questionnaireId}/complete` | yes |
| `list_discovered_vendors` | manage | GET | `/discovered-vendors` | no |
| `list_discovered_vendor_accounts` | manage | GET | `/discovered-vendors/{discoveredVendorId}/accounts` | no |
| `add_discovered_vendor_to_managed` | manage | POST | `/discovered-vendors/{discoveredVendorId}/add-to-managed` | yes |
| `create_document` | manage | POST | `/documents` | yes |
| `list_documents` | manage | GET | `/documents` | no |
| `delete_document` | manage | DELETE | `/documents/{documentId}` | yes |
| `get_document` | manage | GET | `/documents/{documentId}` | no |
| `list_controls_for_document` | manage | GET | `/documents/{documentId}/controls` | no |
| `list_links_for_document` | manage | GET | `/documents/{documentId}/links` | no |
| `create_link_for_document` | manage | POST | `/documents/{documentId}/links` | yes |
| `delete_link_for_document` | manage | DELETE | `/documents/{documentId}/links/{linkId}` | yes |
| `set_owner_for_document` | manage | POST | `/documents/{documentId}/set-owner` | yes |
| `submit_document_collection` | manage | POST | `/documents/{documentId}/submit` | yes |
| `upload_file_for_document` | manage | POST | `/documents/{documentId}/uploads` | yes |
| `list_files_for_document` | manage | GET | `/documents/{documentId}/uploads` | no |
| `delete_file_for_document` | manage | DELETE | `/documents/{documentId}/uploads/{uploadedFileId}` | yes |
| `get_uploadedfile_media` | manage | GET | `/documents/{documentId}/uploads/{uploadedFileId}/media` | no |
| `list_frameworks` | manage | GET | `/frameworks` | no |
| `get_framework` | manage | GET | `/frameworks/{frameworkId}` | no |
| `list_controls_for_framework` | manage | GET | `/frameworks/{frameworkId}/controls` | no |
| `list_person_groups` | manage | GET | `/groups` | no |
| `get_group` | manage | GET | `/groups/{groupId}` | no |
| `add_people_to_group` | manage | POST | `/groups/{groupId}/add-people` | yes |
| `get_group_members` | manage | GET | `/groups/{groupId}/people` | no |
| `add_person_to_group` | manage | POST | `/groups/{groupId}/people` | yes |
| `remove_person_from_group` | manage | DELETE | `/groups/{groupId}/people/{personId}` | yes |
| `remove_people_from_group` | manage | POST | `/groups/{groupId}/remove-people` | yes |
| `list_connected_integrations` | manage | GET | `/integrations` | no |
| `get_connected_integration` | manage | GET | `/integrations/{integrationId}` | no |
| `list_resource_kind_summaries` | manage | GET | `/integrations/{integrationId}/resource-kinds` | no |
| `get_resource_kind_details` | manage | GET | `/integrations/{integrationId}/resource-kinds/{resourceKind}` | no |
| `update_resources` | manage | PATCH | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources` | yes |
| `list_resources` | manage | GET | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources` | no |
| `update_resource` | manage | PATCH | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources/{resourceId}` | yes |
| `get_resource` | manage | GET | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources/{resourceId}` | no |
| `list_monitored_computers` | manage | GET | `/monitored-computers` | no |
| `get_monitored_computer` | manage | GET | `/monitored-computers/{computerId}` | no |
| `list_people` | manage | GET | `/people` | no |
| `mark_as_not_people` | manage | POST | `/people/mark-as-not-people` | yes |
| `mark_as_people` | manage | POST | `/people/mark-as-people` | yes |
| `offboard_people` | manage | POST | `/people/offboard` | yes |
| `get_person` | manage | GET | `/people/{personId}` | no |
| `update_person` | manage | PATCH | `/people/{personId}` | yes |
| `clear_leave_for_person` | manage | POST | `/people/{personId}/clear-leave` | yes |
| `set_leave_for_person` | manage | POST | `/people/{personId}/set-leave` | yes |
| `list_policies` | manage | GET | `/policies` | no |
| `get_policy` | manage | GET | `/policies/{policyId}` | no |
| `list_risk_scenario` | manage | GET | `/risk-scenarios` | no |
| `create_risk_scenario` | manage | POST | `/risk-scenarios` | yes |
| `get_risk_scenario` | manage | GET | `/risk-scenarios/{riskScenarioId}` | no |
| `update_risk_scenario` | manage | PATCH | `/risk-scenarios/{riskScenarioId}` | yes |
| `cancel_risk_scenario_approval_request` | manage | POST | `/risk-scenarios/{riskScenarioId}/cancel-approval-request` | yes |
| `submit_risk_for_approval` | manage | POST | `/risk-scenarios/{riskScenarioId}/submit-for-approval` | yes |
| `list_tests` | manage | GET | `/tests` | no |
| `get_test` | manage | GET | `/tests/{testId}` | no |
| `get_test_entities` | manage | GET | `/tests/{testId}/entities` | no |
| `deactivate_test_entity` | manage | POST | `/tests/{testId}/entities/{entityId}/deactivate` | yes |
| `reactivate_test_entity` | manage | POST | `/tests/{testId}/entities/{entityId}/reactivate` | yes |
| `get_trust_center` | manage | GET | `/trust-centers/{slugId}` | no |
| `update_trust_center` | manage | PATCH | `/trust-centers/{slugId}` | yes |
| `list_trust_center_access_requests` | manage | GET | `/trust-centers/{slugId}/access-requests` | no |
| `get_trust_center_access_request` | manage | GET | `/trust-centers/{slugId}/access-requests/{accessRequestId}` | no |
| `approve_trust_center_access_request` | manage | POST | `/trust-centers/{slugId}/access-requests/{accessRequestId}/approve` | yes |
| `deny_trust_center_access_request` | manage | POST | `/trust-centers/{slugId}/access-requests/{accessRequestId}/deny` | yes |
| `list_trust_center_activity_events` | manage | GET | `/trust-centers/{slugId}/activity` | no |
| `get_trust_center_control_categories` | manage | GET | `/trust-centers/{slugId}/control-categories` | no |
| `add_trust_center_control_category` | manage | POST | `/trust-centers/{slugId}/control-categories` | yes |
| `get_trust_center_control_category` | manage | GET | `/trust-centers/{slugId}/control-categories/{categoryId}` | no |
| `update_trust_center_control_category` | manage | PATCH | `/trust-centers/{slugId}/control-categories/{categoryId}` | yes |
| `delete_trust_center_control_category` | manage | DELETE | `/trust-centers/{slugId}/control-categories/{categoryId}` | yes |
| `list_trust_center_controls` | manage | GET | `/trust-centers/{slugId}/controls` | no |
| `add_control_to_trust_center` | manage | POST | `/trust-centers/{slugId}/controls` | yes |
| `get_trust_center_control` | manage | GET | `/trust-centers/{slugId}/controls/{controlId}` | no |
| `delete_trust_center_control` | manage | DELETE | `/trust-centers/{slugId}/controls/{controlId}` | yes |
| `list_trust_center_faqs` | manage | GET | `/trust-centers/{slugId}/faqs` | no |
| `create_trust_center_faq` | manage | POST | `/trust-centers/{slugId}/faqs` | yes |
| `get_trust_center_faq` | manage | GET | `/trust-centers/{slugId}/faqs/{faqId}` | no |
| `update_trust_center_faq` | manage | PATCH | `/trust-centers/{slugId}/faqs/{faqId}` | yes |
| `delete_trust_center_faq` | manage | DELETE | `/trust-centers/{slugId}/faqs/{faqId}` | yes |
| `list_trust_center_historical_access_requests` | manage | GET | `/trust-centers/{slugId}/historical-access-requests` | no |
| `list_trust_center_resources` | manage | GET | `/trust-centers/{slugId}/resources` | no |
| `create_trust_center_resource` | manage | POST | `/trust-centers/{slugId}/resources` | yes |
| `get_trust_center_resource` | manage | GET | `/trust-centers/{slugId}/resources/{resourceId}` | no |
| `update_trust_center_resource` | manage | PATCH | `/trust-centers/{slugId}/resources/{resourceId}` | yes |
| `delete_trust_center_resource` | manage | DELETE | `/trust-centers/{slugId}/resources/{resourceId}` | yes |
| `get_trust_center_resource_media` | manage | GET | `/trust-centers/{slugId}/resources/{resourceId}/media` | no |
| `list_trust_center_subprocessors` | manage | GET | `/trust-centers/{slugId}/subprocessors` | no |
| `create_trust_center_subprocessor` | manage | POST | `/trust-centers/{slugId}/subprocessors` | yes |
| `get_trust_center_subprocessor` | manage | GET | `/trust-centers/{slugId}/subprocessors/{subprocessorId}` | no |
| `update_trust_center_subprocessor` | manage | PATCH | `/trust-centers/{slugId}/subprocessors/{subprocessorId}` | yes |
| `delete_trust_center_subprocessor` | manage | DELETE | `/trust-centers/{slugId}/subprocessors/{subprocessorId}` | yes |
| `create_trust_center_subscriber_group` | manage | POST | `/trust-centers/{slugId}/subscriber-groups` | yes |
| `list_trust_center_subscriber_groups` | manage | GET | `/trust-centers/{slugId}/subscriber-groups` | no |
| `update_trust_center_subscriber_group` | manage | PATCH | `/trust-centers/{slugId}/subscriber-groups/{subscriberGroupId}` | yes |
| `delete_trust_center_subscriber_group` | manage | DELETE | `/trust-centers/{slugId}/subscriber-groups/{subscriberGroupId}` | yes |
| `get_trust_center_subscriber_group` | manage | GET | `/trust-centers/{slugId}/subscriber-groups/{subscriberGroupId}` | no |
| `list_trust_center_subscribers` | manage | GET | `/trust-centers/{slugId}/subscribers` | no |
| `create_trust_center_subscriber` | manage | POST | `/trust-centers/{slugId}/subscribers` | yes |
| `get_trust_center_subscriber` | manage | GET | `/trust-centers/{slugId}/subscribers/{subscriberId}` | no |
| `delete_trust_center_subscriber` | manage | DELETE | `/trust-centers/{slugId}/subscribers/{subscriberId}` | yes |
| `upsert_groups_for_trust_center_subscriber` | manage | PUT | `/trust-centers/{slugId}/subscribers/{subscriberId}/groups` | yes |
| `list_trust_center_updates` | manage | GET | `/trust-centers/{slugId}/updates` | no |
| `create_trust_center_update` | manage | POST | `/trust-centers/{slugId}/updates` | yes |
| `get_trust_center_update` | manage | GET | `/trust-centers/{slugId}/updates/{updateId}` | no |
| `update_trust_center_update` | manage | PATCH | `/trust-centers/{slugId}/updates/{updateId}` | yes |
| `delete_trust_center_update` | manage | DELETE | `/trust-centers/{slugId}/updates/{updateId}` | yes |
| `send_notifications_to_all_subscribers` | manage | POST | `/trust-centers/{slugId}/updates/{updateId}/notify-all-subscribers` | yes |
| `send_trust_center_update_notifications` | manage | POST | `/trust-centers/{slugId}/updates/{updateId}/notify-specific-subscribers` | yes |
| `list_trust_center_viewers` | manage | GET | `/trust-centers/{slugId}/viewers` | no |
| `add_trust_center_viewer` | manage | POST | `/trust-centers/{slugId}/viewers` | yes |
| `get_trust_center_viewer` | manage | GET | `/trust-centers/{slugId}/viewers/{viewerId}` | no |
| `remove_trust_center_viewer` | manage | DELETE | `/trust-centers/{slugId}/viewers/{viewerId}` | yes |
| `list_vendor_risk_attributes` | manage | GET | `/vendor-risk-attributes` | no |
| `create_vendor` | manage | POST | `/vendors` | yes |
| `list_vendors` | manage | GET | `/vendors` | no |
| `get_vendor` | manage | GET | `/vendors/{vendorId}` | no |
| `delete_by_id` | manage | DELETE | `/vendors/{vendorId}` | yes |
| `update_vendor` | manage | PATCH | `/vendors/{vendorId}` | yes |
| `list_vendor_documents` | manage | GET | `/vendors/{vendorId}/documents` | no |
| `upload_document_to_vendor` | manage | POST | `/vendors/{vendorId}/documents` | yes |
| `list_vendor_findings` | manage | GET | `/vendors/{vendorId}/findings` | no |
| `create_vendor_finding` | manage | POST | `/vendors/{vendorId}/findings` | yes |
| `update_vendor_finding` | manage | PATCH | `/vendors/{vendorId}/findings/{findingId}` | yes |
| `delete_finding_by_id` | manage | DELETE | `/vendors/{vendorId}/findings/{findingId}` | yes |
| `get_security_reviews_by_vendor_id` | manage | GET | `/vendors/{vendorId}/security-reviews` | no |
| `get_security_reviews_by_id` | manage | GET | `/vendors/{vendorId}/security-reviews/{securityReviewId}` | no |
| `upload_document_for_security_review` | manage | POST | `/vendors/{vendorId}/security-reviews/{securityReviewId}/documents` | yes |
| `get_security_review_documents` | manage | GET | `/vendors/{vendorId}/security-reviews/{securityReviewId}/documents` | no |
| `delete_security_review_document_by_id` | manage | DELETE | `/vendors/{vendorId}/security-reviews/{securityReviewId}/documents/{documentId}` | yes |
| `set_status_for_vendor` | manage | POST | `/vendors/{vendorId}/set-status` | yes |
| `list_vulnerabilities` | manage | GET | `/vulnerabilities` | no |
| `deactivate_vulnerabilities` | manage | POST | `/vulnerabilities/deactivate` | yes |
| `reactivate_vulnerabilities` | manage | POST | `/vulnerabilities/reactivate` | yes |
| `get_vulnerability` | manage | GET | `/vulnerabilities/{vulnerabilityId}` | no |
| `list_vulnerability_remediations` | manage | GET | `/vulnerability-remediations` | no |
| `acknowledge_sla_miss_vulnerability_remediations` | manage | POST | `/vulnerability-remediations/acknowledge-sla-miss` | yes |
| `list_vulnerable_assets` | manage | GET | `/vulnerable-assets` | no |
| `get_vulnerable_asset` | manage | GET | `/vulnerable-assets/{vulnerableAssetId}` | no |
| `create_auditor` | audit | POST | `/auditors` | yes |
| `list_audits` | audit | GET | `/audits` | no |
| `get_audit` | audit | GET | `/audits/{auditId}` | no |
| `list_audit_comments` | audit | GET | `/audits/{auditId}/comments` | no |
| `list_audit_controls` | audit | GET | `/audits/{auditId}/controls` | no |
| `audit_create_custom_control` | audit | POST | `/audits/{auditId}/controls/custom-controls` | yes |
| `list_audit_evidence` | audit | GET | `/audits/{auditId}/evidence` | no |
| `create_custom_evidence_request` | audit | POST | `/audits/{auditId}/evidence/custom-evidence-requests` | yes |
| `update_audit_evidence` | audit | PATCH | `/audits/{auditId}/evidence/{auditEvidenceId}` | yes |
| `create_comment_for_audit_evidence` | audit | POST | `/audits/{auditId}/evidence/{auditEvidenceId}/comments` | yes |
| `list_audit_evidence_urls` | audit | GET | `/audits/{auditId}/evidence/{auditEvidenceId}/urls` | no |
| `get_framework_codes` | audit | GET | `/audits/{auditId}/framework-codes` | no |
| `list_information_requests` | audit | GET | `/audits/{auditId}/information-requests` | no |
| `create_information_request` | audit | POST | `/audits/{auditId}/information-requests` | yes |
| `update_information_request` | audit | PATCH | `/audits/{auditId}/information-requests/{requestId}` | yes |
| `delete_information_request` | audit | DELETE | `/audits/{auditId}/information-requests/{requestId}` | yes |
| `accept_information_request_evidence` | audit | POST | `/audits/{auditId}/information-requests/{requestId}/accept-evidence` | yes |
| `list_information_request_activity` | audit | GET | `/audits/{auditId}/information-requests/{requestId}/activity` | no |
| `list_comments_for_information_request` | audit | GET | `/audits/{auditId}/information-requests/{requestId}/comments` | no |
| `create_comment_for_information_request` | audit | POST | `/audits/{auditId}/information-requests/{requestId}/comments` | yes |
| `update_comment_for_information_request` | audit | PATCH | `/audits/{auditId}/information-requests/{requestId}/comments/{commentId}` | yes |
| `delete_comment_for_information_request` | audit | DELETE | `/audits/{auditId}/information-requests/{requestId}/comments/{commentId}` | yes |
| `list_information_request_evidence` | audit | GET | `/audits/{auditId}/information-requests/{requestId}/evidence` | no |
| `flag_information_request_evidence` | audit | POST | `/audits/{auditId}/information-requests/{requestId}/flag-evidence` | yes |
| `list_monitored_computers_in_audit_scope` | audit | GET | `/audits/{auditId}/monitored-computers` | no |
| `list_people_in_audit_scope` | audit | GET | `/audits/{auditId}/people` | no |
| `share_information_request_list` | audit | POST | `/audits/{auditId}/share-information-request-list` | yes |
| `list_vendors_in_audit_scope` | audit | GET | `/audits/{auditId}/vendors` | no |
| `audit_list_vulnerabilities` | audit | GET | `/audits/{auditId}/vulnerabilities` | no |
| `list_vulnerability_remediations_in_audit_scope` | audit | GET | `/audits/{auditId}/vulnerability-remediations` | no |
| `get_vulnerable_assets` | audit | GET | `/audits/{auditId}/vulnerable-assets` | no |
| `connector_get_api_endpoint_vulnerability_connectors` | connectors | GET | `/v1/resources/api_endpoint_vulnerability_connectors` | no |
| `connector_put_api_endpoint_vulnerability_connectors` | connectors | PUT | `/v1/resources/api_endpoint_vulnerability_connectors` | yes |
| `connector_get_background_check_connector` | connectors | GET | `/v1/resources/background_check_connector` | no |
| `connector_put_background_check_connector` | connectors | PUT | `/v1/resources/background_check_connector` | yes |
| `connector_get_custom_resource` | connectors | GET | `/v1/resources/custom_resource` | no |
| `connector_put_custom_resource` | connectors | PUT | `/v1/resources/custom_resource` | yes |
| `connector_get_macos_user_computer` | connectors | GET | `/v1/resources/macos_user_computer` | no |
| `connector_put_macos_user_computer` | connectors | PUT | `/v1/resources/macos_user_computer` | yes |
| `connector_get_package_vulnerability_connectors` | connectors | GET | `/v1/resources/package_vulnerability_connectors` | no |
| `connector_put_package_vulnerability_connectors` | connectors | PUT | `/v1/resources/package_vulnerability_connectors` | yes |
| `connector_get_secret` | connectors | GET | `/v1/resources/secret` | no |
| `connector_put_secret` | connectors | PUT | `/v1/resources/secret` | yes |
| `connector_get_security_task` | connectors | GET | `/v1/resources/security_task` | no |
| `connector_put_security_task` | connectors | PUT | `/v1/resources/security_task` | yes |
| `connector_get_static_analysis_code_vulnerability_connectors` | connectors | GET | `/v1/resources/static_analysis_code_vulnerability_connectors` | no |
| `connector_put_static_analysis_code_vulnerability_connectors` | connectors | PUT | `/v1/resources/static_analysis_code_vulnerability_connectors` | yes |
| `connector_get_user_account` | connectors | GET | `/v1/resources/user_account` | no |
| `connector_put_user_account` | connectors | PUT | `/v1/resources/user_account` | yes |
| `connector_get_user_security_training_status` | connectors | GET | `/v1/resources/user_security_training_status` | no |
| `connector_put_user_security_training_status` | connectors | PUT | `/v1/resources/user_security_training_status` | yes |
| `connector_get_vulnerable_component` | connectors | GET | `/v1/resources/vulnerable_component` | no |
| `connector_put_vulnerable_component` | connectors | PUT | `/v1/resources/vulnerable_component` | yes |
| `connector_get_windows_user_computer` | connectors | GET | `/v1/resources/windows_user_computer` | no |
| `connector_put_windows_user_computer` | connectors | PUT | `/v1/resources/windows_user_computer` | yes |