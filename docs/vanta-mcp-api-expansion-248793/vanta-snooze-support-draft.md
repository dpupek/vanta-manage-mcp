# Draft: independent framework snooze end-date readback

**Status:** Draft; not sent.

**Subject:** Public API readback for a framework's snooze end date

Hello Vanta Support,

We are integrating the public Manage API's framework snooze operation. The snooze response includes `snoozedUntilDate`, while the documented `GET /v1/frameworks/{frameworkId}` response exposes lifecycle status but does not document that date.

Is there a supported public API endpoint or query option that independently returns the current snooze end date after a write? If so, please provide the route, required scopes, feature prerequisites, response field, and any expected consistency delay.

If no such read path exists, could `snoozedUntilDate` be exposed on the framework detail response? Independent readback would let clients verify both the snoozed status and the scheduled reactivation date without treating the write response as evidence of persistence.

Thank you,

Dan Pupek

Chief Systems Architect, Certified Scrum Master

Nexport Solutions, a division of Darwin Global, LLC
