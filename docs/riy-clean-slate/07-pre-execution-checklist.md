# Pre-Execution Checklist

This checklist must be completed before any destructive executor is implemented or run.

## Generated Checklist Statuses

The manifest builder emits checklist statuses:

- `pass`
- `warning`
- `pending`
- `blocked`

Because this phase records no manual approvals, final executor readiness remains `false`.

## Required Checks

- correct project is `rcph-admin`
- preserved Auth identity is verified
- preserved Firestore identity is verified
- source preview contains zero blockers
- every review collection has a policy
- every lock has a policy
- Drive deletion is disabled
- backup evidence is supplied
- backup counts are reconciled
- every risky identity is explicitly approved
- Firestore removal counts are reconciled
- Auth removal counts are reconciled
- rebuild plan is validated
- execution manifest is manually approved
- rollback limitations are acknowledged

## Manual Approval Requirements

Before execution design:

- approve or reject every risky identity removal
- explicitly approve the second Shubham account removal if intended
- approve Visit Submission empty-collection policy
- approve lock reset policy
- approve Drive preservation policy
- verify backup evidence and location
- acknowledge there is no undo without a verified backup

## Distinction Between Phases

Preview:

- reads Firebase/Firestore/Auth only when explicitly run
- produces read-only current-state reports

Manifest:

- does not connect to Firebase
- reads local preview reports
- validates backup evidence
- creates a deterministic draft execution specification

Approval:

- a later phase where Shubham reviews identities, policies, and backup evidence
- records explicit approvals

Execution:

- not implemented
- would be destructive
- must be built only after approval

## Stop Conditions

Do not proceed if:

- backup evidence is missing or invalid
- project ID is not exactly `rcph-admin`
- preserved account cannot be verified
- source preview has blockers
- risky identities are pending approval
- unknown locks or collections are unresolved
- Drive archive/cleanup policy is not accepted
- rollback limitations are not acknowledged
