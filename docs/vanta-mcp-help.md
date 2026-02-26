# Vanta MCP Help

Canonical reference generated from runtime metadata.

## Summary

- Total tools: 239
- Enabled tools: 239
- Generated endpoint tools: 219
- Compatibility read tools: 15
- Workflow tools: 5
- Mutating tools: 117
- Generated manage tools: 164
- Generated audit tools: 31
- Generated connector tools: 24

## Runtime Safety

- `VANTA_MCP_SAFE_MODE`: true
- `VANTA_MCP_ENABLE_WRITE`: true
- `VANTA_MCP_ENABLED_TOOLS`: (all tools enabled)

## Resources

- `resource://vanta-manage/help` - Core onboarding for auth, envelopes, safe writes, and discovery.
- `resource://vanta-manage/cheatsheet` - Fast path from objective to tools and minimal call shapes.
- `resource://vanta-manage/recipes` - Task recipes for vulnerability, people, vendor, and policy-evidence workflows.
- `resource://vanta-manage/tool-catalog` - Live catalog of generated endpoint tools plus compat/workflow tools.
- `resource://vanta-manage/workflow-playbooks` - Plan-first/execute-confirmed playbooks for high-value workflows.
- `resource://vanta-manage/safety` - Mutation safety model, write flags, and confirmation behavior.
- `resource://vanta-manage/troubleshooting` - Common errors and deterministic resolution steps.

## Prompts

- `playbook_tool_selector` - Route a task to compat, generated endpoint, and workflow tools.
- `playbook_control_evidence` - Control evidence flow using plan-first then execute-confirmed steps.
- `playbook_failing_controls_triage` - Triage failing controls/tests/documents with deterministic readback.
- `playbook_vendor_triage` - Vendor lifecycle and findings/security-review evidence updates.
- `playbook_people_assets_vuln_triage` - Correlate people/assets/vulnerabilities and apply allowed updates.
- `playbook_information_request_triage` - Audit information request comments/evidence/status triage.
- `playbook_vulnerability_due_soon_triage` - Prioritize vulnerabilities due soon and enrich with scanner context.
- `playbook_employee_onboarding_verification` - Verify onboarding task status and identify blockers per employee.
- `playbook_employee_offboarding_tracker` - Track offboarding completion tasks and unresolved risk.
- `playbook_vendor_risk_assessment` - Assist vendor risk review using findings, docs, and status updates.
- `playbook_policy_document_evidence_linkage` - Cross-reference policy evidence and document evidence with readback verification.

## Workflow Tool Patterns

### workflow_control_evidence

1. Read current controls and optional target control (`controls`, `get_control`).
2. Run `workflow_control_evidence` with `mode=plan`.
3. Execute with `mode=execute` and `confirm=true` when actions are approved.
4. Verify by reading control/doc mappings (`list_control_documents`, `document_resources`).

### workflow_triage_failing_controls

1. Read failing tests/entities (`tests`, `list_test_entities`, `list_control_tests`).
2. Run `workflow_triage_failing_controls` with `mode=plan`.
3. Execute approved actions with `mode=execute`, `confirm=true`.
4. Read back updated controls/tests/entities.

### workflow_vendor_triage

1. Read vendors/findings/reviews (`vendors`, `list_vendor_findings`, `list_vendor_documents`).
2. Run `workflow_vendor_triage` with `mode=plan`.
3. Execute with explicit actions and `confirm=true`.
4. Validate vendor status/findings and review document linkage.

### workflow_people_assets_vuln_triage

1. Read people/assets/vulnerabilities (`people`, `list_vulnerable_assets`, `vulnerabilities`).
2. Run `workflow_people_assets_vuln_triage` with `mode=plan`.
3. Execute approved lifecycle actions with `confirm=true`.
4. Re-read vulnerability and remediation state.

### workflow_information_request_triage

1. Read open audit information requests and evidence.
2. Run `workflow_information_request_triage` with `mode=plan`.
3. Execute comments/flag/accept actions with `confirm=true`.
4. Verify status and activity transitions through read endpoints.


## Generated Endpoint Tools

| Tool | Source | Method | Path | Mutating | Enabled |
|---|---|---|---|---|---|
| `accept_information_request_evidence` | audit | POST | `/audits/{auditId}/information-requests/{requestId}/accept-evidence` | yes | yes |
| `acknowledge_sla_miss_vulnerability_remediations` | manage | POST | `/vulnerability-remediations/acknowledge-sla-miss` | yes | yes |
| `add_control_from_library` | manage | POST | `/controls/add-from-library` | yes | yes |
| `add_control_to_trust_center` | manage | POST | `/trust-centers/{slugId}/controls` | yes | yes |
| `add_discovered_vendor_to_managed` | manage | POST | `/discovered-vendors/{discoveredVendorId}/add-to-managed` | yes | yes |
| `add_document_to_control` | manage | POST | `/controls/{controlId}/add-document-to-control` | yes | yes |
| `add_people_to_group` | manage | POST | `/groups/{groupId}/add-people` | yes | yes |
| `add_person_to_group` | manage | POST | `/groups/{groupId}/people` | yes | yes |
| `add_test_to_control` | manage | POST | `/controls/{controlId}/add-test-to-control` | yes | yes |
| `add_trust_center_control_category` | manage | POST | `/trust-centers/{slugId}/control-categories` | yes | yes |
| `add_trust_center_viewer` | manage | POST | `/trust-centers/{slugId}/viewers` | yes | yes |
| `approve_trust_center_access_request` | manage | POST | `/trust-centers/{slugId}/access-requests/{accessRequestId}/approve` | yes | yes |
| `audit_create_custom_control` | audit | POST | `/audits/{auditId}/controls/custom-controls` | yes | yes |
| `audit_list_vulnerabilities` | audit | GET | `/audits/{auditId}/vulnerabilities` | no | yes |
| `cancel_risk_scenario_approval_request` | manage | POST | `/risk-scenarios/{riskScenarioId}/cancel-approval-request` | yes | yes |
| `clear_leave_for_person` | manage | POST | `/people/{personId}/clear-leave` | yes | yes |
| `complete_questionnaire` | manage | POST | `/customer-trust/questionnaires/{questionnaireId}/complete` | yes | yes |
| `connector_get_api_endpoint_vulnerability_connectors` | connectors | GET | `/v1/resources/api_endpoint_vulnerability_connectors` | no | yes |
| `connector_get_background_check_connector` | connectors | GET | `/v1/resources/background_check_connector` | no | yes |
| `connector_get_custom_resource` | connectors | GET | `/v1/resources/custom_resource` | no | yes |
| `connector_get_macos_user_computer` | connectors | GET | `/v1/resources/macos_user_computer` | no | yes |
| `connector_get_package_vulnerability_connectors` | connectors | GET | `/v1/resources/package_vulnerability_connectors` | no | yes |
| `connector_get_secret` | connectors | GET | `/v1/resources/secret` | no | yes |
| `connector_get_security_task` | connectors | GET | `/v1/resources/security_task` | no | yes |
| `connector_get_static_analysis_code_vulnerability_connectors` | connectors | GET | `/v1/resources/static_analysis_code_vulnerability_connectors` | no | yes |
| `connector_get_user_account` | connectors | GET | `/v1/resources/user_account` | no | yes |
| `connector_get_user_security_training_status` | connectors | GET | `/v1/resources/user_security_training_status` | no | yes |
| `connector_get_vulnerable_component` | connectors | GET | `/v1/resources/vulnerable_component` | no | yes |
| `connector_get_windows_user_computer` | connectors | GET | `/v1/resources/windows_user_computer` | no | yes |
| `connector_put_api_endpoint_vulnerability_connectors` | connectors | PUT | `/v1/resources/api_endpoint_vulnerability_connectors` | yes | yes |
| `connector_put_background_check_connector` | connectors | PUT | `/v1/resources/background_check_connector` | yes | yes |
| `connector_put_custom_resource` | connectors | PUT | `/v1/resources/custom_resource` | yes | yes |
| `connector_put_macos_user_computer` | connectors | PUT | `/v1/resources/macos_user_computer` | yes | yes |
| `connector_put_package_vulnerability_connectors` | connectors | PUT | `/v1/resources/package_vulnerability_connectors` | yes | yes |
| `connector_put_secret` | connectors | PUT | `/v1/resources/secret` | yes | yes |
| `connector_put_security_task` | connectors | PUT | `/v1/resources/security_task` | yes | yes |
| `connector_put_static_analysis_code_vulnerability_connectors` | connectors | PUT | `/v1/resources/static_analysis_code_vulnerability_connectors` | yes | yes |
| `connector_put_user_account` | connectors | PUT | `/v1/resources/user_account` | yes | yes |
| `connector_put_user_security_training_status` | connectors | PUT | `/v1/resources/user_security_training_status` | yes | yes |
| `connector_put_vulnerable_component` | connectors | PUT | `/v1/resources/vulnerable_component` | yes | yes |
| `connector_put_windows_user_computer` | connectors | PUT | `/v1/resources/windows_user_computer` | yes | yes |
| `create_auditor` | audit | POST | `/auditors` | yes | yes |
| `create_comment_for_audit_evidence` | audit | POST | `/audits/{auditId}/evidence/{auditEvidenceId}/comments` | yes | yes |
| `create_comment_for_information_request` | audit | POST | `/audits/{auditId}/information-requests/{requestId}/comments` | yes | yes |
| `create_custom_control` | manage | POST | `/controls` | yes | yes |
| `create_custom_evidence_request` | audit | POST | `/audits/{auditId}/evidence/custom-evidence-requests` | yes | yes |
| `create_customer_trust_account` | manage | POST | `/customer-trust/accounts` | yes | yes |
| `create_document` | manage | POST | `/documents` | yes | yes |
| `create_file_questionnaire` | manage | POST | `/customer-trust/questionnaires/file` | yes | yes |
| `create_information_request` | audit | POST | `/audits/{auditId}/information-requests` | yes | yes |
| `create_link_for_document` | manage | POST | `/documents/{documentId}/links` | yes | yes |
| `create_risk_scenario` | manage | POST | `/risk-scenarios` | yes | yes |
| `create_trust_center_faq` | manage | POST | `/trust-centers/{slugId}/faqs` | yes | yes |
| `create_trust_center_resource` | manage | POST | `/trust-centers/{slugId}/resources` | yes | yes |
| `create_trust_center_subprocessor` | manage | POST | `/trust-centers/{slugId}/subprocessors` | yes | yes |
| `create_trust_center_subscriber` | manage | POST | `/trust-centers/{slugId}/subscribers` | yes | yes |
| `create_trust_center_subscriber_group` | manage | POST | `/trust-centers/{slugId}/subscriber-groups` | yes | yes |
| `create_trust_center_update` | manage | POST | `/trust-centers/{slugId}/updates` | yes | yes |
| `create_vendor` | manage | POST | `/vendors` | yes | yes |
| `create_vendor_finding` | manage | POST | `/vendors/{vendorId}/findings` | yes | yes |
| `create_website_questionnaire` | manage | POST | `/customer-trust/questionnaires/website` | yes | yes |
| `deactivate_test_entity` | manage | POST | `/tests/{testId}/entities/{entityId}/deactivate` | yes | yes |
| `deactivate_vulnerabilities` | manage | POST | `/vulnerabilities/deactivate` | yes | yes |
| `delete_by_id` | manage | DELETE | `/vendors/{vendorId}` | yes | yes |
| `delete_comment_for_information_request` | audit | DELETE | `/audits/{auditId}/information-requests/{requestId}/comments/{commentId}` | yes | yes |
| `delete_control` | manage | DELETE | `/controls/{controlId}` | yes | yes |
| `delete_document` | manage | DELETE | `/documents/{documentId}` | yes | yes |
| `delete_document_forcontrol` | manage | DELETE | `/controls/{controlId}/documents/{documentId}` | yes | yes |
| `delete_file_for_document` | manage | DELETE | `/documents/{documentId}/uploads/{uploadedFileId}` | yes | yes |
| `delete_finding_by_id` | manage | DELETE | `/vendors/{vendorId}/findings/{findingId}` | yes | yes |
| `delete_information_request` | audit | DELETE | `/audits/{auditId}/information-requests/{requestId}` | yes | yes |
| `delete_link_for_document` | manage | DELETE | `/documents/{documentId}/links/{linkId}` | yes | yes |
| `delete_questionnaire` | manage | DELETE | `/customer-trust/questionnaires/{questionnaireId}` | yes | yes |
| `delete_security_review_document_by_id` | manage | DELETE | `/vendors/{vendorId}/security-reviews/{securityReviewId}/documents/{documentId}` | yes | yes |
| `delete_test_for_control` | manage | DELETE | `/controls/{controlId}/tests/{testId}` | yes | yes |
| `delete_trust_center_control` | manage | DELETE | `/trust-centers/{slugId}/controls/{controlId}` | yes | yes |
| `delete_trust_center_control_category` | manage | DELETE | `/trust-centers/{slugId}/control-categories/{categoryId}` | yes | yes |
| `delete_trust_center_faq` | manage | DELETE | `/trust-centers/{slugId}/faqs/{faqId}` | yes | yes |
| `delete_trust_center_resource` | manage | DELETE | `/trust-centers/{slugId}/resources/{resourceId}` | yes | yes |
| `delete_trust_center_subprocessor` | manage | DELETE | `/trust-centers/{slugId}/subprocessors/{subprocessorId}` | yes | yes |
| `delete_trust_center_subscriber` | manage | DELETE | `/trust-centers/{slugId}/subscribers/{subscriberId}` | yes | yes |
| `delete_trust_center_subscriber_group` | manage | DELETE | `/trust-centers/{slugId}/subscriber-groups/{subscriberGroupId}` | yes | yes |
| `delete_trust_center_update` | manage | DELETE | `/trust-centers/{slugId}/updates/{updateId}` | yes | yes |
| `deny_trust_center_access_request` | manage | POST | `/trust-centers/{slugId}/access-requests/{accessRequestId}/deny` | yes | yes |
| `flag_information_request_evidence` | audit | POST | `/audits/{auditId}/information-requests/{requestId}/flag-evidence` | yes | yes |
| `get_audit` | audit | GET | `/audits/{auditId}` | no | yes |
| `get_connected_integration` | manage | GET | `/integrations/{integrationId}` | no | yes |
| `get_control` | manage | GET | `/controls/{controlId}` | no | yes |
| `get_customer_trust_account` | manage | GET | `/customer-trust/accounts/{accountId}` | no | yes |
| `get_document` | manage | GET | `/documents/{documentId}` | no | yes |
| `get_framework` | manage | GET | `/frameworks/{frameworkId}` | no | yes |
| `get_framework_codes` | audit | GET | `/audits/{auditId}/framework-codes` | no | yes |
| `get_group` | manage | GET | `/groups/{groupId}` | no | yes |
| `get_group_members` | manage | GET | `/groups/{groupId}/people` | no | yes |
| `get_monitored_computer` | manage | GET | `/monitored-computers/{computerId}` | no | yes |
| `get_person` | manage | GET | `/people/{personId}` | no | yes |
| `get_policy` | manage | GET | `/policies/{policyId}` | no | yes |
| `get_questionnaire` | manage | GET | `/customer-trust/questionnaires/{questionnaireId}` | no | yes |
| `get_questionnaire_export` | manage | GET | `/customer-trust/questionnaires/exports/{id}` | no | yes |
| `get_resource` | manage | GET | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources/{resourceId}` | no | yes |
| `get_resource_kind_details` | manage | GET | `/integrations/{integrationId}/resource-kinds/{resourceKind}` | no | yes |
| `get_risk_scenario` | manage | GET | `/risk-scenarios/{riskScenarioId}` | no | yes |
| `get_security_review_documents` | manage | GET | `/vendors/{vendorId}/security-reviews/{securityReviewId}/documents` | no | yes |
| `get_security_reviews_by_id` | manage | GET | `/vendors/{vendorId}/security-reviews/{securityReviewId}` | no | yes |
| `get_security_reviews_by_vendor_id` | manage | GET | `/vendors/{vendorId}/security-reviews` | no | yes |
| `get_test` | manage | GET | `/tests/{testId}` | no | yes |
| `get_test_entities` | manage | GET | `/tests/{testId}/entities` | no | yes |
| `get_trust_center` | manage | GET | `/trust-centers/{slugId}` | no | yes |
| `get_trust_center_access_request` | manage | GET | `/trust-centers/{slugId}/access-requests/{accessRequestId}` | no | yes |
| `get_trust_center_control` | manage | GET | `/trust-centers/{slugId}/controls/{controlId}` | no | yes |
| `get_trust_center_control_categories` | manage | GET | `/trust-centers/{slugId}/control-categories` | no | yes |
| `get_trust_center_control_category` | manage | GET | `/trust-centers/{slugId}/control-categories/{categoryId}` | no | yes |
| `get_trust_center_faq` | manage | GET | `/trust-centers/{slugId}/faqs/{faqId}` | no | yes |
| `get_trust_center_resource` | manage | GET | `/trust-centers/{slugId}/resources/{resourceId}` | no | yes |
| `get_trust_center_resource_media` | manage | GET | `/trust-centers/{slugId}/resources/{resourceId}/media` | no | yes |
| `get_trust_center_subprocessor` | manage | GET | `/trust-centers/{slugId}/subprocessors/{subprocessorId}` | no | yes |
| `get_trust_center_subscriber` | manage | GET | `/trust-centers/{slugId}/subscribers/{subscriberId}` | no | yes |
| `get_trust_center_subscriber_group` | manage | GET | `/trust-centers/{slugId}/subscriber-groups/{subscriberGroupId}` | no | yes |
| `get_trust_center_update` | manage | GET | `/trust-centers/{slugId}/updates/{updateId}` | no | yes |
| `get_trust_center_viewer` | manage | GET | `/trust-centers/{slugId}/viewers/{viewerId}` | no | yes |
| `get_uploadedfile_media` | manage | GET | `/documents/{documentId}/uploads/{uploadedFileId}/media` | no | yes |
| `get_vendor` | manage | GET | `/vendors/{vendorId}` | no | yes |
| `get_vulnerability` | manage | GET | `/vulnerabilities/{vulnerabilityId}` | no | yes |
| `get_vulnerable_asset` | manage | GET | `/vulnerable-assets/{vulnerableAssetId}` | no | yes |
| `get_vulnerable_assets` | audit | GET | `/audits/{auditId}/vulnerable-assets` | no | yes |
| `initiate_export` | manage | POST | `/customer-trust/questionnaires/exports` | yes | yes |
| `list_audit_comments` | audit | GET | `/audits/{auditId}/comments` | no | yes |
| `list_audit_controls` | audit | GET | `/audits/{auditId}/controls` | no | yes |
| `list_audit_evidence` | audit | GET | `/audits/{auditId}/evidence` | no | yes |
| `list_audit_evidence_urls` | audit | GET | `/audits/{auditId}/evidence/{auditEvidenceId}/urls` | no | yes |
| `list_audits` | audit | GET | `/audits` | no | yes |
| `list_comments_for_information_request` | audit | GET | `/audits/{auditId}/information-requests/{requestId}/comments` | no | yes |
| `list_connected_integrations` | manage | GET | `/integrations` | no | yes |
| `list_controls` | manage | GET | `/controls` | no | yes |
| `list_controls_for_document` | manage | GET | `/documents/{documentId}/controls` | no | yes |
| `list_controls_for_framework` | manage | GET | `/frameworks/{frameworkId}/controls` | no | yes |
| `list_customer_trust_accounts` | manage | GET | `/customer-trust/accounts` | no | yes |
| `list_discovered_vendor_accounts` | manage | GET | `/discovered-vendors/{discoveredVendorId}/accounts` | no | yes |
| `list_discovered_vendors` | manage | GET | `/discovered-vendors` | no | yes |
| `list_documents` | manage | GET | `/documents` | no | yes |
| `list_documents_for_control` | manage | GET | `/controls/{controlId}/documents` | no | yes |
| `list_files_for_document` | manage | GET | `/documents/{documentId}/uploads` | no | yes |
| `list_frameworks` | manage | GET | `/frameworks` | no | yes |
| `list_information_request_activity` | audit | GET | `/audits/{auditId}/information-requests/{requestId}/activity` | no | yes |
| `list_information_request_evidence` | audit | GET | `/audits/{auditId}/information-requests/{requestId}/evidence` | no | yes |
| `list_information_requests` | audit | GET | `/audits/{auditId}/information-requests` | no | yes |
| `list_library_controls` | manage | GET | `/controls/controls-library` | no | yes |
| `list_links_for_document` | manage | GET | `/documents/{documentId}/links` | no | yes |
| `list_monitored_computers` | manage | GET | `/monitored-computers` | no | yes |
| `list_monitored_computers_in_audit_scope` | audit | GET | `/audits/{auditId}/monitored-computers` | no | yes |
| `list_people` | manage | GET | `/people` | no | yes |
| `list_people_in_audit_scope` | audit | GET | `/audits/{auditId}/people` | no | yes |
| `list_person_groups` | manage | GET | `/groups` | no | yes |
| `list_policies` | manage | GET | `/policies` | no | yes |
| `list_questionnaires` | manage | GET | `/customer-trust/questionnaires` | no | yes |
| `list_resource_kind_summaries` | manage | GET | `/integrations/{integrationId}/resource-kinds` | no | yes |
| `list_resources` | manage | GET | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources` | no | yes |
| `list_risk_scenario` | manage | GET | `/risk-scenarios` | no | yes |
| `list_tests` | manage | GET | `/tests` | no | yes |
| `list_tests_for_control` | manage | GET | `/controls/{controlId}/tests` | no | yes |
| `list_trust_center_access_requests` | manage | GET | `/trust-centers/{slugId}/access-requests` | no | yes |
| `list_trust_center_activity_events` | manage | GET | `/trust-centers/{slugId}/activity` | no | yes |
| `list_trust_center_controls` | manage | GET | `/trust-centers/{slugId}/controls` | no | yes |
| `list_trust_center_faqs` | manage | GET | `/trust-centers/{slugId}/faqs` | no | yes |
| `list_trust_center_historical_access_requests` | manage | GET | `/trust-centers/{slugId}/historical-access-requests` | no | yes |
| `list_trust_center_resources` | manage | GET | `/trust-centers/{slugId}/resources` | no | yes |
| `list_trust_center_subprocessors` | manage | GET | `/trust-centers/{slugId}/subprocessors` | no | yes |
| `list_trust_center_subscriber_groups` | manage | GET | `/trust-centers/{slugId}/subscriber-groups` | no | yes |
| `list_trust_center_subscribers` | manage | GET | `/trust-centers/{slugId}/subscribers` | no | yes |
| `list_trust_center_updates` | manage | GET | `/trust-centers/{slugId}/updates` | no | yes |
| `list_trust_center_viewers` | manage | GET | `/trust-centers/{slugId}/viewers` | no | yes |
| `list_vendor_documents` | manage | GET | `/vendors/{vendorId}/documents` | no | yes |
| `list_vendor_findings` | manage | GET | `/vendors/{vendorId}/findings` | no | yes |
| `list_vendor_risk_attributes` | manage | GET | `/vendor-risk-attributes` | no | yes |
| `list_vendors` | manage | GET | `/vendors` | no | yes |
| `list_vendors_in_audit_scope` | audit | GET | `/audits/{auditId}/vendors` | no | yes |
| `list_vulnerabilities` | manage | GET | `/vulnerabilities` | no | yes |
| `list_vulnerability_remediations` | manage | GET | `/vulnerability-remediations` | no | yes |
| `list_vulnerability_remediations_in_audit_scope` | audit | GET | `/audits/{auditId}/vulnerability-remediations` | no | yes |
| `list_vulnerable_assets` | manage | GET | `/vulnerable-assets` | no | yes |
| `mark_as_not_people` | manage | POST | `/people/mark-as-not-people` | yes | yes |
| `mark_as_people` | manage | POST | `/people/mark-as-people` | yes | yes |
| `offboard_people` | manage | POST | `/people/offboard` | yes | yes |
| `reactivate_test_entity` | manage | POST | `/tests/{testId}/entities/{entityId}/reactivate` | yes | yes |
| `reactivate_vulnerabilities` | manage | POST | `/vulnerabilities/reactivate` | yes | yes |
| `remove_people_from_group` | manage | POST | `/groups/{groupId}/remove-people` | yes | yes |
| `remove_person_from_group` | manage | DELETE | `/groups/{groupId}/people/{personId}` | yes | yes |
| `remove_trust_center_viewer` | manage | DELETE | `/trust-centers/{slugId}/viewers/{viewerId}` | yes | yes |
| `send_notifications_to_all_subscribers` | manage | POST | `/trust-centers/{slugId}/updates/{updateId}/notify-all-subscribers` | yes | yes |
| `send_trust_center_update_notifications` | manage | POST | `/trust-centers/{slugId}/updates/{updateId}/notify-specific-subscribers` | yes | yes |
| `set_leave_for_person` | manage | POST | `/people/{personId}/set-leave` | yes | yes |
| `set_owner_for_control` | manage | POST | `/controls/{controlId}/set-owner` | yes | yes |
| `set_owner_for_document` | manage | POST | `/documents/{documentId}/set-owner` | yes | yes |
| `set_status_for_vendor` | manage | POST | `/vendors/{vendorId}/set-status` | yes | yes |
| `share_information_request_list` | audit | POST | `/audits/{auditId}/share-information-request-list` | yes | yes |
| `submit_document_collection` | manage | POST | `/documents/{documentId}/submit` | yes | yes |
| `submit_risk_for_approval` | manage | POST | `/risk-scenarios/{riskScenarioId}/submit-for-approval` | yes | yes |
| `update_audit_evidence` | audit | PATCH | `/audits/{auditId}/evidence/{auditEvidenceId}` | yes | yes |
| `update_comment_for_information_request` | audit | PATCH | `/audits/{auditId}/information-requests/{requestId}/comments/{commentId}` | yes | yes |
| `update_control_metadata` | manage | PATCH | `/controls/{controlId}` | yes | yes |
| `update_information_request` | audit | PATCH | `/audits/{auditId}/information-requests/{requestId}` | yes | yes |
| `update_person` | manage | PATCH | `/people/{personId}` | yes | yes |
| `update_questionnaire` | manage | PATCH | `/customer-trust/questionnaires/{questionnaireId}` | yes | yes |
| `update_resource` | manage | PATCH | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources/{resourceId}` | yes | yes |
| `update_resources` | manage | PATCH | `/integrations/{integrationId}/resource-kinds/{resourceKind}/resources` | yes | yes |
| `update_risk_scenario` | manage | PATCH | `/risk-scenarios/{riskScenarioId}` | yes | yes |
| `update_trust_center` | manage | PATCH | `/trust-centers/{slugId}` | yes | yes |
| `update_trust_center_control_category` | manage | PATCH | `/trust-centers/{slugId}/control-categories/{categoryId}` | yes | yes |
| `update_trust_center_faq` | manage | PATCH | `/trust-centers/{slugId}/faqs/{faqId}` | yes | yes |
| `update_trust_center_resource` | manage | PATCH | `/trust-centers/{slugId}/resources/{resourceId}` | yes | yes |
| `update_trust_center_subprocessor` | manage | PATCH | `/trust-centers/{slugId}/subprocessors/{subprocessorId}` | yes | yes |
| `update_trust_center_subscriber_group` | manage | PATCH | `/trust-centers/{slugId}/subscriber-groups/{subscriberGroupId}` | yes | yes |
| `update_trust_center_update` | manage | PATCH | `/trust-centers/{slugId}/updates/{updateId}` | yes | yes |
| `update_vendor` | manage | PATCH | `/vendors/{vendorId}` | yes | yes |
| `update_vendor_finding` | manage | PATCH | `/vendors/{vendorId}/findings/{findingId}` | yes | yes |
| `upload_document_for_security_review` | manage | POST | `/vendors/{vendorId}/security-reviews/{securityReviewId}/documents` | yes | yes |
| `upload_document_to_vendor` | manage | POST | `/vendors/{vendorId}/documents` | yes | yes |
| `upload_file_for_document` | manage | POST | `/documents/{documentId}/uploads` | yes | yes |
| `upsert_groups_for_trust_center_subscriber` | manage | PUT | `/trust-centers/{slugId}/subscribers/{subscriberId}/groups` | yes | yes |

## Compatibility Read Tools

| Tool | Mapping Intent | Enabled |
|---|---|---|
| `controls` | GetControl/ListControls | yes |
| `document_resources` | ListControlsForDocument/ListLinksForDocument/ListFilesForDocument | yes |
| `documents` | GetDocument/ListDocuments | yes |
| `frameworks` | GetFramework/ListFrameworks | yes |
| `integration_resources` | ListResourceKindSummaries/GetResourceKindDetails/ListResources/GetResource | yes |
| `integrations` | GetConnectedIntegration/ListConnectedIntegrations | yes |
| `list_control_documents` | ListDocumentsForControl | yes |
| `list_control_tests` | ListTestsForControl | yes |
| `list_framework_controls` | ListControlsForFramework | yes |
| `list_test_entities` | GetTestEntities | yes |
| `people` | GetPerson/ListPeople | yes |
| `risks` | GetRiskScenario/ListRiskScenario | yes |
| `tests` | GetTest/ListTests | yes |
| `vendors` | GetVendor/ListVendors | yes |
| `vulnerabilities` | GetVulnerability/ListVulnerabilities | yes |

## Workflow Tools

| Tool | Mode | Enabled |
|---|---|---|
| `workflow_control_evidence` | plan_execute_confirmed | yes |
| `workflow_information_request_triage` | plan_execute_confirmed | yes |
| `workflow_people_assets_vuln_triage` | plan_execute_confirmed | yes |
| `workflow_triage_failing_controls` | plan_execute_confirmed | yes |
| `workflow_vendor_triage` | plan_execute_confirmed | yes |