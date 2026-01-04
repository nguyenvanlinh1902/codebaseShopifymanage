import App from 'koa';
import * as errorService from '../services/errorService';
import router from '../routes/clientApi';
import cors from 'koa2-cors';

// Initialize all demand configuration for an application
const clientApi = new App();
clientApi.proxy = true;

clientApi.use(cors());
// Register all routes for the application
clientApi.use(router.allowedMethods());
clientApi.use(router.routes());

// Handling all errors
clientApi.on('error', errorService.handleError);

export default clientApi;
