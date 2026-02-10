import {getFirestore} from 'firebase-admin/firestore';

const getDb = () => getFirestore();

// Collections that may contain customer PII
const CUSTOMER_COLLECTIONS = [
  'shopify_customer_events'
];

// All collections associated with a shop
const SHOP_COLLECTIONS = [
  'shopify_stores',
  'shopify_product_events',
  'shopify_fulfillment_events',
  'shopify_customer_events',
  'shopify_inventory_events',
  'shopify_theme_events',
  'webhook_events',
  'products',
  'google_auth',
  'google_sheets',
  'order_sync_configs',
  'order_sync_queue',
  'product_queue',
  'import_history',
  'tracking_history'
];

/**
 * Handle customers/data_request webhook.
 * Shopify sends this when a customer requests their data.
 * Must respond 200 immediately, then process within 30 days.
 */
export async function handleCustomerDataRequest(req, res) {
  try {
    const {shop_domain, customer, orders_requested} = req.body;

    console.log(`[GDPR] Customer data request from ${shop_domain} for customer ${customer?.id}`);

    // Log the request for audit
    await getDb().collection('gdpr_requests').add({
      type: 'customers/data_request',
      shopDomain: shop_domain,
      customerId: customer?.id,
      customerEmail: customer?.email,
      ordersRequested: orders_requested || [],
      status: 'received',
      receivedAt: new Date().toISOString(),
      completedAt: null
    });

    // Respond immediately - data compilation happens async
    res.status(200).json({success: true});
  } catch (error) {
    console.error('[GDPR] Customer data request error:', error);
    // Must still return 200 to Shopify
    res.status(200).json({success: true});
  }
}

/**
 * Handle customers/redact webhook.
 * Shopify sends this when a customer requests data deletion.
 * Must respond 200 immediately, then delete within 30 days.
 */
export async function handleCustomerRedact(req, res) {
  try {
    const {shop_domain, customer, orders_to_redact} = req.body;

    console.log(`[GDPR] Customer redact request from ${shop_domain} for customer ${customer?.id}`);

    // Log the request for audit
    const db = getDb();
    const requestRef = await db.collection('gdpr_requests').add({
      type: 'customers/redact',
      shopDomain: shop_domain,
      customerId: customer?.id,
      ordersToRedact: orders_to_redact || [],
      status: 'processing',
      receivedAt: new Date().toISOString(),
      completedAt: null
    });

    // Delete customer data from all relevant collections
    const batch = db.batch();
    let deletedCount = 0;

    for (const collection of CUSTOMER_COLLECTIONS) {
      const snapshots = await db
        .collection(collection)
        .where('shopDomain', '==', shop_domain)
        .where('customerId', '==', String(customer?.id))
        .get();

      snapshots.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Also try email-based lookup
      if (customer?.email) {
        const emailSnapshots = await db
          .collection(collection)
          .where('shopDomain', '==', shop_domain)
          .where('email', '==', customer.email)
          .get();

        emailSnapshots.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
    }

    // Mark request as completed
    await requestRef.update({
      status: 'completed',
      deletedCount,
      completedAt: new Date().toISOString()
    });

    console.log(`[GDPR] Customer redact completed: ${deletedCount} records deleted`);
    res.status(200).json({success: true});
  } catch (error) {
    console.error('[GDPR] Customer redact error:', error);
    res.status(200).json({success: true});
  }
}

/**
 * Handle shop/redact webhook.
 * Shopify sends this 48 hours after app uninstall.
 * Must delete ALL data for this shop within 30 days.
 */
export async function handleShopRedact(req, res) {
  try {
    const {shop_domain, shop_id} = req.body;

    console.log(`[GDPR] Shop redact request for ${shop_domain} (ID: ${shop_id})`);

    // Log the request
    const db = getDb();
    const requestRef = await db.collection('gdpr_requests').add({
      type: 'shop/redact',
      shopDomain: shop_domain,
      shopId: shop_id,
      status: 'processing',
      receivedAt: new Date().toISOString(),
      completedAt: null
    });

    // Normalize shop domain (remove .myshopify.com if present)
    const normalizedDomain = shop_domain.replace('.myshopify.com', '');
    let totalDeleted = 0;

    for (const collection of SHOP_COLLECTIONS) {
      try {
        // Try both domain formats
        const queries = [
          db.collection(collection).where('shopDomain', '==', shop_domain),
          db.collection(collection).where('shopDomain', '==', normalizedDomain),
          db.collection(collection).where('shop_domain', '==', shop_domain)
        ];

        for (const query of queries) {
          const snapshot = await query.get();
          if (!snapshot.empty) {
            const batchDeletes = [];
            let currentBatch = db.batch();
            let count = 0;

            snapshot.forEach(doc => {
              currentBatch.delete(doc.ref);
              count++;
              totalDeleted++;

              // Firestore batch limit is 500
              if (count % 500 === 0) {
                batchDeletes.push(currentBatch.commit());
                currentBatch = db.batch();
              }
            });

            if (count % 500 !== 0) {
              batchDeletes.push(currentBatch.commit());
            }

            await Promise.all(batchDeletes);
          }
        }
      } catch (err) {
        console.error(`[GDPR] Error deleting from ${collection}:`, err.message);
      }
    }

    // Mark request as completed
    await requestRef.update({
      status: 'completed',
      totalDeleted,
      completedAt: new Date().toISOString()
    });

    console.log(`[GDPR] Shop redact completed for ${shop_domain}: ${totalDeleted} records deleted`);
    res.status(200).json({success: true});
  } catch (error) {
    console.error('[GDPR] Shop redact error:', error);
    res.status(200).json({success: true});
  }
}
