# OpenTeams — Social collaboration feature review

## Sources reviewed

- Microsoft Teams channels overview: https://learn.microsoft.com/en-us/microsoftteams/teams-channels-overview
- Microsoft Teams collaboration: https://www.microsoft.com/en-us/microsoft-teams/collaboration
- Discord Forum Channels FAQ: https://support.discord.com/hc/en-us/articles/6208479917079
- Discord Community Onboarding: https://support.discord.com/hc/en-us/articles/360047132851-Enabling-Your-Community-Server
- Google Workspace: https://workspace.google.com/
- Google Chat: https://workspace.google.com/products/chat/
- Google Meet feature comparison: https://knowledge.workspace.google.com/admin/meet/compare-meet-features-across-google-workspace-editions

## Features to prioritize in OpenTeams

1. Structured workspaces, public/private channels, threads, forum-style discussions, channel topics, member counts, pins, mentions, and read indicators.
2. Direct messages and group messages with idempotency, E2EE verification, presence, typing indicators, message edit/delete, reactions, replies, and secure view-once attachments.
3. Meetings with device preview, incoming-call notifications, screen/file sharing, call activity, and reconnect/backfill behavior.
4. Productivity integration: agenda/calendar, personal notes, work plans/tasks, decisions, action items, reminders, and a dashboard with quick actions.
5. Enterprise governance: role/channel permissions, onboarding choices, invite role controls, moderation, audit logs, retention policies, privacy defaults, and health monitoring.
6. Search across only accessible channels/messages/users, with tenant isolation and no indexing of plaintext E2EE payloads on the server.
7. File collaboration with encrypted uploads, previews, expiry, malware scanning boundary, access revocation, and bucket privacy.

## OpenTeams security adaptations

OpenTeams should not copy consumer-social defaults blindly. Personal Agenda and Notes remain private by default and require explicit sharing. Search and analytics must respect tenant and channel authorization. Presence, typing, and activity feed should disclose only the minimum metadata. E2EE private keys remain client-side, while server-side records store ciphertext/envelopes and auditable metadata only.

## Current gaps identified from the master task list

The highest-priority gaps are the real Dashboard widgets (presence, action items, decisions, calls/activity/quick actions), global search, DM with frontend E2EE verification, call preview/notifications, invite settings, reconnect/backfill, notifications/onboarding/admin health, and full Playwright/responsive verification. Message edit/delete and typing indicators are already implemented according to the project progress log.
