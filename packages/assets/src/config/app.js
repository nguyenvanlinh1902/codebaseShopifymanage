import appRoute from '../const/app';
import {initAppBridge as initBridge} from '../helpers/appBridge';

export const isEmbeddedApp = window.location.pathname.startsWith(appRoute.embed);
export const routePrefix = isEmbeddedApp ? appRoute.embed : appRoute.standalone;
export const prependRoute = url => routePrefix + url;
export const removeRoute = url => (isEmbeddedApp ? url.replace(routePrefix, '') : url);
export const initAppBridge = initBridge;
