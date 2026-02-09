import appRoute from '../const/app';

export const isEmbeddedApp = window.location.pathname.startsWith(appRoute.embed);
export const routePrefix = isEmbeddedApp ? appRoute.embed : appRoute.standalone;
export const prependRoute = url => routePrefix + url;
export const removeRoute = url => (isEmbeddedApp ? url.replace(routePrefix, '') : url);
