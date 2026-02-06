const SENSITIVE_FIELDS = [
  'accessToken',
  'apiSecret',
  'refreshToken',
  'credentials',
  'tokenExpiresAt'
];

function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

function stripSensitive(data) {
  if (!data) return data;
  const clean = {...data};
  for (const field of SENSITIVE_FIELDS) {
    delete clean[field];
  }
  return clean;
}

function getWriteType(change) {
  const before = change.before?.exists;
  const after = change.after?.exists;
  if (!before && after) return 'CREATE';
  if (before && !after) return 'DELETE';
  return 'UPDATE';
}

export const generateDefaultRow = ({event, collectionId}) => {
  const change = event.data;
  const writeType = getWriteType(change);
  const currentData = change.after?.data() || {};
  const beforeData = change.before?.data() || {};
  const documentId = event.params.docId;

  return {
    timestamp: event.time || new Date().toISOString(),
    event_id: event.id || '',
    document_name: `${collectionId}/${documentId}`,
    operation: writeType,
    data: isEmpty(currentData) ? null : JSON.stringify(stripSensitive(currentData)),
    old_data: isEmpty(beforeData) ? null : JSON.stringify(stripSensitive(beforeData)),
    document_id: documentId
  };
};

export {getWriteType};
