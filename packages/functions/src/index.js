import {onRequest} from 'firebase-functions/v2/https';
import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import apiHandler from './handlers/api';
import apiSaHandler from './handlers/apiSa';
import authHandler from './handlers/auth';
import authSaHandler from './handlers/authSa';
import embedAppHandler from './handlers/embed';
import webhookHandler from './handlers/webhook';
import clientApiHandler from './handlers/clientApi';
import subscribeBackgroundHandler from './handlers/subscribeBackgroundHandler';

export const embedApp = onRequest(
  {memory: '256MiB', region: ['us-central1', 'us-east1', 'europe-west2', 'asia-northeast1']},
  embedAppHandler.callback()
);

export const api = onRequest(apiHandler.callback());
export const apiSa = onRequest(apiSaHandler.callback());

export const auth = onRequest(authHandler.callback());
export const authSa = onRequest(authSaHandler.callback());

export const webhook = onRequest(webhookHandler.callback());
export const clientApi = onRequest(clientApiHandler.callback());

export const backgroundHandling = onMessagePublished(
  'backgroundHandling',
  subscribeBackgroundHandler
);
