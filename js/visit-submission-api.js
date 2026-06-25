'use strict';

(function initVisitSubmissionApi(global) {
  const CALLABLE_NAMES = Object.freeze({
    initializeStructure: 'initializeVisitSubmissionStructure',
    getDashboard: 'getVisitSubmissionDashboard',
    getFolders: 'getVisitSubmissionFolders',
    getFolder: 'getVisitSubmissionFolder',
    updateVisitConfig: 'updateVisitSubmissionConfig',
    updateFolderConfig: 'updateVisitSubmissionFolder',
    createUploadSession: 'createVisitSubmissionUploadSession',
    finalizeUpload: 'finalizeVisitSubmissionUpload',
    cancelUploadSession: 'cancelVisitSubmissionUploadSession',
    withdrawSubmission: 'withdrawVisitSubmission',
    removeSubmission: 'removeVisitSubmission',
    replaceSubmission: 'replaceVisitSubmission',
    getModerationData: 'getVisitSubmissionModerationData',
    reconcileFolder: 'reconcileVisitSubmissionFolderCount',
    cleanupExpiredSessions: 'cleanupExpiredVisitUploadSessions',
  });

  const SAFE_ERROR_MESSAGES = Object.freeze({
    unauthenticated: 'Sign in again to continue.',
    'permission-denied': 'You do not have access to this Visit Submission action.',
    'failed-precondition': 'This action is not available right now.',
    'invalid-argument': 'Check the highlighted fields and try again.',
    'not-found': 'The requested Visit Submission record could not be found.',
    'resource-exhausted': 'The folder has reached its current limit.',
    'already-exists': 'This upload step has already been completed.',
    internal: 'Something went wrong. Please try again.',
  });

  let callableCache = null;

  function getFunctionsClient() {
    if (!global.firebase || !global.firebase.functions) {
      throw new Error('Firebase Functions SDK is not loaded.');
    }
    return global.firebase.functions();
  }

  function getCallables() {
    if (callableCache) return callableCache;
    const functionsClient = getFunctionsClient();
    callableCache = Object.keys(CALLABLE_NAMES).reduce((acc, key) => {
      acc[key] = functionsClient.httpsCallable(CALLABLE_NAMES[key]);
      return acc;
    }, {});
    return callableCache;
  }

  function normalizeError(error) {
    const rawCode = String(error?.code || error?.customData?.code || 'unknown').replace(/^functions\//, '');
    const code = rawCode || 'unknown';
    const details = error?.details || error?.customData?.details || {};
    const backendMessage = String(error?.message || '').trim();
    const message = backendMessage && !/stack|trace|firestore|internal/i.test(backendMessage)
      ? backendMessage
      : (SAFE_ERROR_MESSAGES[code] || SAFE_ERROR_MESSAGES.internal);
    return { code, message, details };
  }

  async function call(name, payload) {
    const callable = getCallables()[name];
    if (!callable) throw new Error(`Unknown Visit Submission callable: ${name}`);
    try {
      const result = await callable(payload || {});
      return result?.data || {};
    } catch (error) {
      throw normalizeError(error);
    }
  }

  const api = {
    callableNames: CALLABLE_NAMES,
    normalizeError,
    initializeStructure: () => call('initializeStructure'),
    getDashboard: () => call('getDashboard'),
    getFolders: (visitType) => call('getFolders', { visitType }),
    getFolder: (visitType, positionKey) => call('getFolder', { visitType, positionKey }),
    updateVisitConfig: (payload) => call('updateVisitConfig', payload),
    updateFolderConfig: (payload) => call('updateFolderConfig', payload),
    createUploadSession: (payload) => call('createUploadSession', payload),
    finalizeUpload: (payload) => call('finalizeUpload', payload),
    cancelUploadSession: (payload) => call('cancelUploadSession', payload),
    withdrawSubmission: (payload) => call('withdrawSubmission', payload),
    removeSubmission: (payload) => call('removeSubmission', payload),
    replaceSubmission: (payload) => call('replaceSubmission', payload),
    getModerationData: (payload) => call('getModerationData', payload),
    reconcileFolder: (payload) => call('reconcileFolder', payload),
    cleanupExpiredSessions: (payload) => call('cleanupExpiredSessions', payload),
  };

  global.RcphVisitApi = Object.freeze(api);
})(window);
