import {getCurrentShop} from '../helpers/auth';
import {getShopInfoByShopId} from '@functions/repositories/shopInfoRepository';
import {getShopById} from '@functions/repositories/shopRepository';

/**
 * @param ctx
 * @returns {Promise<{shop, shopInfo: *}>}
 */
export async function getUserShops(ctx) {
  try {
    const shopId = getCurrentShop(ctx);
    console.log('Get user shops', shopId);
    const [shop, shopInfo] = await Promise.all([getShopById(shopId), getShopInfoByShopId(shopId)]);

    console.log('Got shop info', shopInfo);

    ctx.body = {shop, shopInfo};
  } catch (e) {
    console.error(e);
    ctx.body = {shop: null, shopInfo: null};
  }
}
