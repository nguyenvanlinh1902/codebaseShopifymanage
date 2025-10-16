import * as functions from 'firebase-functions';
import apiHandler from './handlers/api';
import apiSaHandler from './handlers/apiSa';
import authHandler from './handlers/auth';
import authSaHandler from './handlers/authSa';
import embedAppHandler from './handlers/embed';

export const embedApp = functions
  .runWith({memory: '256MB'})
  .region('us-central1', 'us-east1', 'europe-west2', 'asia-northeast1')
  .https.onRequest(embedAppHandler.callback());

export const api = functions.https.onRequest(apiHandler.callback());
export const apiSa = functions.https.onRequest(apiSaHandler.callback());

export const auth = functions.https.onRequest(authHandler.callback());
export const authSa = functions.https.onRequest(authSaHandler.callback());
