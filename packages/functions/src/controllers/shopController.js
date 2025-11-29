import {getCurrentShop} from '../helpers/auth';
import {getShopInfoByShopId} from '@functions/repositories/shopInfoRepository';
import {getShopById} from '@functions/repositories/shopRepository';
import {logger} from 'firebase-functions/v2';

/**
 * @param ctx
 * @returns {Promise<{shop, shopInfo: *}>}
 */
export async function getUserShops(ctx) {
  try {
    const shopId = getCurrentShop(ctx);
    const [shop, shopInfo] = await Promise.all([getShopById(shopId), getShopInfoByShopId(shopId)]);

    ctx.body = {shop, shopInfo};
  } catch (e) {
    logger.error(e);
    ctx.body = {shop: null, shopInfo: null};
  }
}
