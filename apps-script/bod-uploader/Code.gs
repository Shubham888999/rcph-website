const BOD_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const BOD_MAX_BYTES = 15 * 1024 * 1024;

function doPost(e) {
  try {
    const config = getBodConfig_();
    const payload = parseJsonBody_(e);

    if (payload.action !== 'uploadBodFile') {
      return jsonResponse_({
        ok: false,
        error: 'invalid-action'
      });
    }

    const ticket = requiredString_(
      payload.ticket,
      'ticket',
      100
    );

    const uploadGroupId = requiredString_(
      payload.uploadGroupId,
      'uploadGroupId',
      100
    );

    const fileName = sanitizeFileName_(
      requiredString_(
        payload.fileName,
        'fileName',
        180
      )
    );

    const mimeType = requiredString_(
      payload.mimeType,
      'mimeType',
      120
    ).toLowerCase();

    const declaredSizeBytes = positiveInteger_(
      payload.sizeBytes,
      'sizeBytes'
    );

    const base64 = requiredString_(
      payload.base64 || payload.fileData,
      'base64'
    );

    if (!BOD_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error('Unsupported file type.');
    }

    if (declaredSizeBytes > BOD_MAX_BYTES) {
      throw new Error('File exceeds the 15 MB limit.');
    }

    const cleanBase64 = stripDataUrlPrefix_(base64);
    const bytes = Utilities.base64Decode(cleanBase64);

    if (bytes.length !== declaredSizeBytes) {
      throw new Error(
        'Uploaded file size does not match the approved size.'
      );
    }

    const approval = validateTicket_({
      validationUrl: config.validationUrl,
      sharedSecret: config.sharedSecret,
      payload: {
        ticket,
        uploadType: 'bod',
        fileName,
        mimeType,
        sizeBytes: declaredSizeBytes,
        uploadGroupId
      }
    });

    if (!approval.ok || approval.uploadType !== 'bod') {
      throw new Error('Upload authorization was rejected.');
    }

    if (
      approval.safeFileName !== fileName ||
      approval.uploadGroupId !== uploadGroupId
    ) {
      throw new Error(
        'Approved upload metadata does not match.'
      );
    }

    const rootFolder = DriveApp.getFolderById(
      config.rootFolderId
    );

    const eventFolderName = buildBodFolderName_({
      eventDate: approval.eventDate,
      eventName: approval.eventName,
      uploadGroupId: approval.uploadGroupId
    });

    const eventFolder = getOrCreateChildFolder_(
      rootFolder,
      eventFolderName
    );

    const blob = Utilities.newBlob(
      bytes,
      mimeType,
      approval.safeFileName
    );

    const file = eventFolder.createFile(blob);

    return jsonResponse_({
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      folderId: eventFolder.getId(),
      folderName: eventFolder.getName(),
      folderUrl: eventFolder.getUrl(),
      uploadGroupId: approval.uploadGroupId
    });

  } catch (err) {
    console.error(
      'BOD upload failed:',
      safeErrorMessage_(err)
    );

    return jsonResponse_({
      ok: false,
      error: 'upload-failed',
      message: safePublicError_(err)
    });
  }
}

function getBodConfig_() {
  const properties =
    PropertiesService.getScriptProperties();

  const rootFolderId =
    properties.getProperty('BOD_ROOT_FOLDER_ID');

  const validationUrl =
    properties.getProperty('TICKET_VALIDATION_URL');

  const sharedSecret =
    properties.getProperty('BACKEND_SHARED_SECRET');

  if (
    !rootFolderId ||
    !validationUrl ||
    !sharedSecret
  ) {
    throw new Error(
      'BOD upload service is not configured.'
    );
  }

  return {
    rootFolderId,
    validationUrl,
    sharedSecret
  };
}

function validateTicket_(options) {
  const response = UrlFetchApp.fetch(
    options.validationUrl,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-rcph-drive-secret':
          options.sharedSecret
      },
      payload: JSON.stringify(
        options.payload
      ),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();

  let body = {};

  try {
    body = JSON.parse(
      response.getContentText() || '{}'
    );
  } catch (err) {
    throw new Error(
      'Upload authorization returned an invalid response.'
    );
  }

  if (
    status < 200 ||
    status >= 300 ||
    body.ok !== true
  ) {
    if (status === 409) {
      throw new Error(
        'This upload authorization was already used.'
      );
    }

    if (status === 410) {
      throw new Error(
        'This upload authorization has expired.'
      );
    }

    throw new Error(
      'Upload authorization was rejected.'
    );
  }

  return body;
}

function buildBodFolderName_(data) {
  const eventDate = sanitizeFolderPart_(
    data.eventDate || 'undated',
    30
  );

  const eventName = sanitizeFolderPart_(
    data.eventName || 'event',
    100
  );

  const uploadGroupId = sanitizeFolderPart_(
    data.uploadGroupId,
    100
  );

  return (
    `${eventDate}_${eventName}_${uploadGroupId}`
  ).slice(0, 220);
}

function getOrCreateChildFolder_(
  parent,
  name
) {
  const folders =
    parent.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(name);
}

function parseJsonBody_(e) {
  if (
    !e ||
    !e.postData ||
    !e.postData.contents
  ) {
    throw new Error(
      'Missing request body.'
    );
  }

  try {
    return JSON.parse(
      e.postData.contents
    );
  } catch (err) {
    throw new Error(
      'Invalid JSON request.'
    );
  }
}

function stripDataUrlPrefix_(value) {
  const text = String(value || '');
  const commaIndex = text.indexOf(',');

  if (
    text.startsWith('data:') &&
    commaIndex >= 0
  ) {
    return text.slice(
      commaIndex + 1
    );
  }

  return text;
}

function positiveInteger_(
  value,
  fieldName
) {
  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number <= 0
  ) {
    throw new Error(
      `Invalid ${fieldName}.`
    );
  }

  return number;
}

function requiredString_(
  value,
  fieldName,
  maxLength
) {
  const text =
    String(value || '').trim();

  if (!text) {
    throw new Error(
      `Missing ${fieldName}.`
    );
  }

  if (
    maxLength &&
    text.length > maxLength
  ) {
    throw new Error(
      `${fieldName} is too long.`
    );
  }

  return text;
}

function sanitizeFileName_(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(
      /[\\/:*?"<>|\u0000-\u001F]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .trim()
    .slice(0, 180);

  if (!cleaned) {
    throw new Error(
      'Invalid file name.'
    );
  }

  return cleaned;
}

function sanitizeFolderPart_(
  value,
  maxLength
) {
  return (
    String(value || '')
      .trim()
      .replace(
        /[\\/:*?"<>|#%{}~&\u0000-\u001F]/g,
        '-'
      )
      .replace(/\s+/g, ' ')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength) ||
    'untitled'
  );
}

function safeErrorMessage_(err) {
  return err && err.message
    ? String(err.message).slice(
        0,
        500
      )
    : 'Unknown upload error';
}

function safePublicError_(err) {
  const message =
    safeErrorMessage_(err);

  const allowedMessages = [
    'Unsupported file type.',
    'File exceeds the 15 MB limit.',
    'Uploaded file size does not match the approved size.',
    'This upload authorization was already used.',
    'This upload authorization has expired.',
    'Upload authorization was rejected.',
    'Approved upload metadata does not match.'
  ];

  return allowedMessages.includes(
    message
  )
    ? message
    : 'The file could not be uploaded.';
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(payload)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}