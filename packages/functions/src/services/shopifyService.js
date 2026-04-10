import Shopify from 'shopify-api-node';
import shopifyConfig from '../config/shopify.js';
import { toGid, fromGid, buildMetafieldsFromProduct, buildVariant, buildOptionKey, gqlVariantToRest, normalizeShopDomain } from './shopify-helpers.js';
import * as orderSvc from './shopify-order-service.js';
import * as productSvc from './shopify-product-service.js';
import * as shopSvc from './shopify-shop-service.js';

/**
 * Shopify Service — thin wrapper delegating to focused service modules.
 * Preserves all existing method signatures for backward compatibility.
 */
export class ShopifyService {
  constructor(shopConfig) {
    if (shopConfig) {
      this.shopify = new Shopify({
        shopName: shopConfig.shopDomain,
        accessToken: shopConfig.accessToken,
        apiVersion: shopConfig.apiVersion || shopifyConfig.apiVersion || '2026-01',
        autoLimit: { calls: 2, interval: 1000, bucketSize: 35 },
        timeout: 180000
      });
      this.shopDomain = shopConfig.shopDomain;
    }
  }

  // ── Static helpers ──────────────────────────────────────────────────────────

  static toGid(type, id) { return toGid(type, id); }
  static fromGid(gid) { return fromGid(gid); }
  static buildMetafieldsFromProduct(productData) { return buildMetafieldsFromProduct(productData); }
  static buildVariant(variantData) { return buildVariant(variantData); }
  static buildOptionKey(option1, option2, option3) { return buildOptionKey(option1, option2, option3); }
  static _gqlVariantToRest(node) { return gqlVariantToRest(node); }
  static normalizeShopDomain(input) { return normalizeShopDomain(input); }

  // ── Order methods ───────────────────────────────────────────────────────────

  getOrders(params) { return orderSvc.getOrders(this.shopify, params); }
  getOrder(orderId) { return orderSvc.getOrder(this.shopify, orderId); }
  getOrderByNumber(orderNumber) { return orderSvc.getOrderByNumber(this.shopify, orderNumber); }
  addOrderTracking(orderId, trackingInfo, mode) { return orderSvc.addOrderTracking(this.shopify, orderId, trackingInfo, mode); }
  updateFulfillmentTracking(orderId, fulfillmentId, trackingInfo) { return orderSvc.updateFulfillmentTracking(this.shopify, orderId, fulfillmentId, trackingInfo); }
  createFulfillment(orderId, trackingInfo) { return orderSvc.createFulfillment(this.shopify, orderId, trackingInfo); }
  getOrdersWithFulfillments(opts) { return orderSvc.getOrdersWithFulfillments(this.shopify, opts); }

  // ── Product methods ─────────────────────────────────────────────────────────

  createProduct(productData) { return productSvc.createProduct(this.shopify, productData); }
  _bulkCreateVariantsGraphQL(productId, restVariants, optionNames) { return productSvc.bulkCreateVariantsGraphQL(this.shopify, productId, restVariants, optionNames); }
  _linkVariantImages(productId, productData, createdVariants) { return productSvc.linkVariantImages(this.shopify, productId, productData, createdVariants); }
  _getProductGraphQL(productId) { return productSvc.getProductGraphQL(this.shopify, productId); }
  upsertProduct(productData) { return productSvc.upsertProduct(this.shopify, productData); }
  updateProduct(productId, productData) { return productSvc.updateProduct(this.shopify, productId, productData); }
  getProductBySku(sku) { return productSvc.getProductBySku(this.shopify, sku); }
  getProductByHandle(handle) { return productSvc.getProductByHandle(this.shopify, handle); }
  getLineItemsProductInfo(variantIds, shopDomain) { return productSvc.getLineItemsProductInfo(this.shopify, variantIds, shopDomain); }

  // ── Shop methods ────────────────────────────────────────────────────────────

  getShopInfo() { return shopSvc.getShopInfo(this.shopify); }
  verifyCredentials() { return shopSvc.verifyCredentials(this.shopify); }
  getThemes() { return shopSvc.getThemes(this.shopify); }
  createTheme(name, src, role) { return shopSvc.createTheme(this.shopify, name, src, role); }
  deleteTheme(themeId) { return shopSvc.deleteTheme(this.shopify, themeId); }
  publishTheme(themeId) { return shopSvc.publishTheme(this.shopify, themeId); }
  getMetafieldDefinitions(ownerType) { return shopSvc.getMetafieldDefinitions(this.shopify, ownerType); }
  createMetafieldDefinition(definition) { return shopSvc.createMetafieldDefinition(this.shopify, definition); }
  getShopPolicies() { return shopSvc.getShopPolicies(this.shopify); }
  updateShopPolicy(type, body) { return shopSvc.updateShopPolicy(this.shopify, type, body); }
  getPrivacySettings() { return shopSvc.getPrivacySettings(this.shopify); }
}
