const MAX_VISIT_LINKS = 100;
const LINK_ID = /^link-[a-f0-9]{16}$/;
const CATEGORY = /^(?:inward|outward|inward-register|outward-register|custom-[a-f0-9]{8})$/;

// Only recognized Google URLs get an iframe. Other HTTPS links open separately.
// Preview URLs are always derived here; a caller cannot supply an iframe source.
function visitLinkTarget(value) {
  if (typeof value !== 'string' || value.length > 2000 || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const target = { url: url.href, previewUrl: '', provider: 'web', mimeType: '' };
  if (url.hostname === 'docs.google.com') {
    const match = /^\/(spreadsheets|document|presentation)\/d\/(e\/)?([A-Za-z0-9_-]{5,220})(?:\/|$)/.exec(url.pathname);
    if (match) {
      const [, kind, published, id] = match;
      const types = { spreadsheets: 'spreadsheet', document: 'document', presentation: 'presentation' };
      target.provider = `google-${types[kind]}`;
      target.mimeType = `application/vnd.google-apps.${types[kind]}`;
      const base = `https://docs.google.com/${kind}/d/${published || ''}${id}`;
      target.previewUrl = `${base}/${kind === 'presentation' ? 'embed' : published ? (kind === 'spreadsheets' ? 'pubhtml' : 'pub') : 'preview'}`;
      if (kind === 'spreadsheets') {
        const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.slice(1)).get('gid');
        if (/^\d{1,20}$/.test(gid || '')) target.previewUrl += `?gid=${gid}`;
      }
    }
  } else if (url.hostname === 'drive.google.com') {
    const id = /^\/file\/d\/([A-Za-z0-9_-]{5,220})(?:\/|$)/.exec(url.pathname)?.[1]
      || (url.pathname === '/open' && url.searchParams.get('id'));
    if (/^[A-Za-z0-9_-]{5,220}$/.test(id || '')) {
      target.provider = 'google-drive';
      target.previewUrl = `https://drive.google.com/file/d/${id}/preview`;
    }
  }
  const resourceKey = url.searchParams.get('resourcekey');
  if (target.previewUrl && /^[A-Za-z0-9_-]{1,200}$/.test(resourceKey || '')) {
    target.previewUrl += `${target.previewUrl.includes('?') ? '&' : '?'}resourcekey=${resourceKey}`;
  }
  return target;
}

function normalizeVisitLink(value) {
  if (!value || typeof value.linkId !== 'string' || !LINK_ID.test(value.linkId) || typeof value.title !== 'string') return null;
  const title = value.title.trim();
  const target = visitLinkTarget(value.url);
  const documentCategory = value.documentCategory || '';
  if (!title || title.length > 160 || !target || typeof documentCategory !== 'string' || (documentCategory && !CATEGORY.test(documentCategory))) return null;
  return { linkId: value.linkId, title, documentCategory, ...target };
}

function listVisitLinks(folder) {
  const seen = new Set();
  return (Array.isArray(folder?.documentLinks) ? folder.documentLinks : []).slice(0, MAX_VISIT_LINKS).flatMap(raw => {
    const link = normalizeVisitLink(raw);
    if (!link || seen.has(link.linkId)) return [];
    seen.add(link.linkId);
    return [link];
  });
}

function visitLinkDocument(link) {
  return {
    submissionId: link.linkId, linkId: link.linkId, sourceType: 'link',
    title: link.title, fileName: link.title, documentCategory: link.documentCategory,
    mimeType: link.mimeType, fileSize: 0, uploadedAt: '', uploadedByName: '', status: 'active',
    canOpen: true, openUrl: link.url, canPreview: Boolean(link.previewUrl), previewUrl: link.previewUrl,
  };
}

export { MAX_VISIT_LINKS, LINK_ID, visitLinkTarget, normalizeVisitLink, listVisitLinks, visitLinkDocument };
