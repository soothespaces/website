# 0004 — Do Not Depend on mguide.app's Waitz Proxy

Date: 2026-09-22

## Status

Accepted

## Context

Real-time occupancy (via Waitz) is core to the "not-only-you" filtering flow. While
investigating mguide.app's data sources (see
[Data Sources § 7](../technical/data-sources.md#7-mguideapp-live-api-confirmed-via-reverse-engineered-bundle)),
we found that `api.mguide.app/api/waitz` already proxies Waitz occupancy data and is
callable without any apparent auth. It would be technically easy to call this endpoint
directly instead of applying for our own Waitz API access.

## Decision

Do not depend on mguide.app's `/api/waitz` proxy as a runtime dependency of this app.
Apply for our own Waitz API access instead (directly, or via whatever institutional
UM channel already has one — worth asking Waitz or UM IT/facilities). As a stopgap,
it's reasonable to ask mguide's developer directly whether they're open to sharing
access or pointing us to how they got set up — that's a materially different situation
from silently routing production traffic through their server.

## Consequences

- Slower to get real-time occupancy working (an application/approval process vs. an
  immediately-callable URL), but not dependent on undocumented infrastructure that
  isn't ours, has no SLA, and could disappear or start blocking us without warning.
- Avoids depending on a two-hops-removed relationship to Waitz's actual terms of
  service, which govern mguide's use of Waitz, not ours.
- Keeps mguide.app's `/api/waitz` response shape (`{ data: [{ id, name, busyness,
  trend, subLocs }] }`, bucketed at 50/80) as a useful reference for our own response
  shape even though we won't call their endpoint — see
  [Integrations § Waitz](../technical/integrations.md#waitz-iot-occupancy-api).
