import {getCurrentShop, getCurrentShopData} from '../helpers/auth';
import {getShopInfoByShopId} from '@functions/repositories/shopInfoRepository';
import {getShopById} from '@functions/repositories/shopRepository';
import {initShopify} from '@functions/services/shopifyService';

/**
 * @param ctx
 * @returns {Promise<{shop, shopInfo: *}>}
 */
export async function getUserShops(ctx) {
  try {
    const shopId = getCurrentShop(ctx);
    const shopData = getCurrentShopData(ctx);
    const [shop, shopInfo] = await Promise.all([getShopById(shopId), getShopInfoByShopId(shopId)]);
    const shopify = initShopify(shopData);

    const shopDataApi = await shopify.shop.get();
    console.log('Shop api from shopify', shopDataApi);

    ctx.body = {shop, shopInfo};
  } catch (e) {
    console.error(e);
    ctx.body = {shop: null, shopInfo: null};
  }
}
