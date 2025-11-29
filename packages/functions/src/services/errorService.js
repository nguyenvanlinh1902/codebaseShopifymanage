import {getCurrentShopData} from '@functions/helpers/auth';
import {logger} from 'firebase-functions/v2';

/**
 * @param {*} err
 * @param {*} ctx
 * @return {Promise<void>}
 */
export function handleError(err, ctx) {
  const user = getCurrentShopData(ctx);
  if (user) {
    logger.error('handle error ===', user.shopID, '===', user.shop?.shopifyDomain, '===', err);
  } else {
    logger.error('Unauthenticated', err);
  }
}
