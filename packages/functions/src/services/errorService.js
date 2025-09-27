import {getCurrentShop} from '@functions/helpers/auth';

/**
 * @param {*} err
 * @param {*} ctx
 * @return {Promise<void>}
 */
export function handleError(err, ctx) {
  console.error('Handle error here koa', err);
}
