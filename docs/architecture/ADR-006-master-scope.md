# ADR-006: Organization-Branch Master Visibility
Status: Accepted

Field users need territory masters and the product catalog from their ancestor division. They do not need sibling territories or unrelated divisions.

A dedicated has_master_access function therefore allows MASTER_VIEW when the target organization unit is either an ancestor or a descendant of the user's assigned scope. This rule is used only by master-data RLS and does not broaden general RBAC authorization.

Master writes remain protected by normal directional MASTER_MANAGE authorization and server-only provider credentials.
