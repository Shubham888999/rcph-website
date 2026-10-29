import { useRef, useState } from 'react';
import AdminDialog from '../shared/AdminDialog';
import { replaceVisitFile } from '../shared/adminService';
import { safeAdminError } from '../shared/adminErrors';
import { validateVisitFile } from './visitModel';
import { formatVisitFileSize, VISIT_FILE_ACCEPT } from './visitUploadModel';

export default function VisitFileReplaceDialog({ item, folder, initialFile = null, onClose, reload, onNotice, onReplaced }) {
  const [file, setFile] = useState(initialFile);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const running = useRef(false);
  async function replace() {
    if (running.current || !file) return;
    const validation = validateVisitFile(file, folder);
    if (validation) { setError(validation); return; }
    if (file.type && item.mimeType && file.type !== item.mimeType) { setError('Choose a replacement of the same file type.'); return; }
    running.current = true; setBusy(true); setError('');
    try {
      const result = await replaceVisitFile(file, item, setStage);
      onNotice?.({ type: 'success', message: result.unchanged ? 'This file already has the selected name and contents. Both have been verified.' : 'Filename and contents updated in Drive and on the website.' });
      onReplaced?.(); onClose();
      await reload().catch(() => onNotice?.({ type: 'error', message: 'The replacement was saved. Refresh Club Visits to load the updated file list.' }));
    } catch (failure) {
      setError(safeAdminError(failure, 'The replacement could not be confirmed. Retry with the same file.'));
    } finally { running.current = false; setBusy(false); setStage(''); }
  }
  return <AdminDialog title={`Replace ${item.fileName}?`} busy={busy} onClose={onClose}>
    <p>The selected file's name and contents will replace this Drive file. Its link, folder and main-presentation selection stay the same. The previous contents are backed up in Drive.</p>
    <label htmlFor="visit-replacement-file">Choose replacement file of the same type</label>
    <input id="visit-replacement-file" type="file" accept={item.mimeType || VISIT_FILE_ACCEPT} disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); setError(''); }} />
    {file ? <p>{file.name} · {formatVisitFileSize(file.size)}</p> : null}
    {busy ? <p role="status">{stage}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <div className="admin-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" disabled={!file || busy} onClick={replace}>{busy ? 'Replacing…' : error ? 'Retry replacement' : 'Replace file'}</button></div>
  </AdminDialog>;
}
