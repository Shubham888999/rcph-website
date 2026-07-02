import { useState } from "react";
import {
  formatTreasuryUploadSize,
  getDriveThumbnailUrl,
  isTreasuryImageAttachment,
  treasuryAttachmentFromRecord,
} from "./treasuryUploadModel";

function TreasuryThumbnail({ attachment }) {
  const [failed, setFailed] = useState(false);
  const thumbnailUrl = getDriveThumbnailUrl(attachment.fileUrl);
  if (failed || !thumbnailUrl || !isTreasuryImageAttachment(attachment)) return null;
  return <img src={thumbnailUrl} alt={`Preview of ${attachment.fileName}`} loading="lazy" onError={() => setFailed(true)} />;
}

export default function TreasuryAttachments({ record }) {
  const attachment = treasuryAttachmentFromRecord(record);
  if (!attachment) return <p className="treasury-attachments__empty">No supporting files attached.</p>;
  return (
    <section className="treasury-attachments" aria-labelledby={`treasury-files-${record.id}`}>
      <div className="treasury-attachments__heading">
        <h3 id={`treasury-files-${record.id}`}>Supporting files</h3>
        {attachment.folderUrl ? <a href={attachment.folderUrl} target="_blank" rel="noopener noreferrer">Open Drive folder</a> : null}
      </div>
      <ul>
        <li>
          <TreasuryThumbnail attachment={attachment} />
          <div className="treasury-attachments__meta">
            <strong>{attachment.fileName}</strong>
            <span>{attachment.mimeType || "Drive attachment"}{attachment.sizeBytes ? ` · ${formatTreasuryUploadSize(attachment.sizeBytes)}` : ""}</span>
          </div>
          <a className="treasury-attachments__open" href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">Open file</a>
        </li>
      </ul>
    </section>
  );
}
