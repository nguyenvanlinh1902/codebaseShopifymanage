import App from 'koa';
import createErrorHandler from '../middleware/errorHandler';
import * as errorService from '../services/errorService';
import appConfig from '../config/app';
import render from 'koa-ejs';
import path from 'path';
import fetch from 'node-fetch';

console.log('NODE_ENV', process.env.NODE_ENV);

if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Initialize all demand configuration for an application
const app = new App();
app.proxy = true;
render(app, {
  cache: true,
  debug: false,
  layout: false,
  root: path.resolve(__dirname, '../../views'),
  viewExt: 'html'
});
app.use(createErrorHandler());

app.use(async ctx => {
  const shop = ctx.query.shop;
  ctx.set('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`);
  if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const embedData = await fetch(`https://${appConfig.baseUrl}/embed-template.html`, {
    headers: {
      'Cache-Control': 'max-age=300' // Cache for 1 hour
    },
    cf: {
      // Cache on Cloudflare if you're using it
      cacheTtl: 300,
      cacheEverything: true
    }
  });
  // Forward cache headers from the response
  const cacheControl = embedData.headers.get('cache-control');
  if (cacheControl) {
    ctx.set('Cache-Control', cacheControl);
  }

  const embedHtml = await embedData.text();

  return (ctx.body = embedHtml);
});
// Handling all errors
app.on('error', errorService.handleError);

export default app;
