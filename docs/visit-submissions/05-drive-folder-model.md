# Drive Folder Model

The intended hierarchy is:

```text
RCPH Visit Submissions/
  <RIY identifier>/
    Club Assembly/
      President/
      Secretary/
      ...
    DZR Visit/
      President/
      Secretary/
      ...
    DRR Visit/
      President/
      Secretary/
      ...
```

The browser never chooses a Drive folder. The trusted upload path receives canonical visit and position metadata from the backend ticket validator.

## Authoritative Folder Reference

The authoritative persisted folder reference is:

```text
visitSubmissionPositions/{visitType}_{positionKey}.driveFolderId
```

The field is stored by the backend during finalization from the trusted Firebase HTTP upload completion record. Ordinary read APIs do not return `driveFolderId`; manager moderation may expose it for operational review.

## Idempotency

The Firebase Drive helper creates or reuses the folder for the canonical visit/position. Once `driveFolderId` exists, future uploads for the same visit/position must use the same folder. If trusted completion reports a different folder ID, finalization rejects it with `failed-precondition`.

The browser cannot choose, override, or repair folder IDs.

## External Cleanup

Withdrawal, manager removal, replacement, and clean-slate Firestore reset do not delete Drive files. Drive archival or deletion remains a separate explicit operation.
