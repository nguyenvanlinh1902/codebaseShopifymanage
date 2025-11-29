/* eslint-disable */
// const serviceAccount = require('../../../../serviceAccount.development.json');
const serviceAccount = require('../../serviceAccount.development.json');

const admin = require('firebase-admin');
admin.initializeApp({credential: admin.credential.cert(serviceAccount)});

const Shopify = require('shopify-api-node');
const fs = require('fs');
const {formatDateFields} = require('@avada/firestore-utils');
const {prepareShopData} = require('@avada/core');
const {logger} = require('firebase-functions/v2');
const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;
const db = admin.firestore();
// const db = new Firestore({
//   keyFilename: '../../serviceAccount.development.json',
//   projectId: 'avada-joy-staging'
// });

const shopRef = db.collection('shops');

(async () => {
  // BV9jwpQKPpsu3VrT1pAE 1
  try {
    const shopId = 'DGmlZG6trNcllnVSkOQ6';
    const doc = await shopRef.doc(shopId).get();
    // const shop = doc.data();
    const shop = formatDateFields(doc.data());
    const shopData = prepareShopData(doc.id, shop, 'avada-apps-access-token');

    logger.info(`Initializing Shopify client for shop: ${shopData.shopifyDomain}`);
    const shopify = new Shopify({
      accessToken: shopData.accessToken,
      shopName: shopData.shopifyDomain,
      apiVersion: '2025-04',
      autoLimit: true
    });

    const data = await shopify.accessScope.list();
    logger.info(data);

    const customers = await shopify.customer.list();
    logger.info(customers);
  } catch (e) {
    logger.error(e);
  }
})();

function writeLog(name, ...string) {
  logger.info(string.join(' '));
  fs.appendFileSync(`./log/${name}.log`, string.join(',') + '\n');
}

function getDayDiff(date1, date2) {
  const diffTime = date2 - date1;

  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
