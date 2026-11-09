# Stakeholder summary

The first delivery makes Vanta attachments usable as files: an analyst selects the correct artifact, downloads it, and receives a location and SHA-256 receipt. This reduces browser workarounds and makes failures visible before corrupted content enters an evidence review.

The receipt answers two different questions: did the MCP retrieve these bytes intact, and do those bytes match the original source? A Vanta-generated JPEG may download correctly while differing from an uploaded PNG. Approved policy content also needs its own supported retrieval route; a policy artifact is not automatically an evidence document.

After download integrity, the plan refreshes the public API and improves selected-vendor risk review, risk/issue mapping, document evaluation/framework administration, and personnel requirements. Existing confirmations and independent readbacks remain in place. Current discovery identifies 50 new Manage endpoints and 44 existing operations with structural contract changes across Manage/Audit; scope will be rechecked before implementation.

## Review demonstration

1. Retrieve a PDF, XLSX, and image through the installed MCP and open each locally. Compare receipt hashes against fixture hashes.
2. Show a deliberately different image representation and an unknown original hash without claiming original identity.
3. Request approved policy content and demonstrate either the documented route or an explicit, version-aware fallback.
4. Review one vendor's alerts and findings with complete/partial inventory indicators; propose a confirmed action and show readback.
5. Show installed runtime version/SHA and the live-acceptance matrix, including permission-limited surfaces.

The [iteration plan](download-integrity-and-api-refresh-plan.md) provides task-level acceptance. This document records intended behavior; it does not claim delivery or live validation.
