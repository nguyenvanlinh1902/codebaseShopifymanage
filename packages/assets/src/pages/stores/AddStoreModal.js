import React from 'react';
import {Modal, FormLayout, Banner, TextField, Button} from '@shopify/polaris';

/**
 * Modal for adding a new Shopify store
 */
export default function AddStoreModal({
  active,
  onClose,
  formData,
  onFormChange,
  verified,
  verifiedInfo,
  verifying,
  submitting,
  onVerify,
  onSubmit
}) {
  return (
    <Modal
      open={active}
      onClose={onClose}
      title="Add Shopify Store"
      primaryAction={{
        content: 'Add Store',
        onAction: onSubmit,
        loading: submitting
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose
        }
      ]}
    >
      <Modal.Section>
        <FormLayout>
          {!verified && (
            <Banner tone="info">
              <p>
                <strong>How to get credentials:</strong>
              </p>
              <p>
                1. Go to Shopify Admin → Settings → Apps and sales channels
                <br />
                2. Click &quot;Develop apps&quot; → &quot;Create an app&quot;
                <br />
                3. Configure scopes → Install app → Reveal token once
                <br />
                4. Copy your shop domain and Admin API access token
              </p>
            </Banner>
          )}

          {verified && verifiedInfo && (
            <Banner tone="success">
              <p>
                <strong>✓ Verified:</strong> {verifiedInfo.shopName}
                <br />
                Domain: {verifiedInfo.myshopifyDomain}
                <br />
                Email: {verifiedInfo.email}
              </p>
            </Banner>
          )}

          <TextField
            label="Shop Domain"
            value={formData.shopDomain}
            onChange={value => {
              onFormChange({...formData, shopDomain: value});
            }}
            placeholder="mystore or mystore.myshopify.com"
            helpText="Enter any format: 'mystore', 'mystore.myshopify.com', or full URL - we'll normalize it"
            required
            autoComplete="off"
          />

          <TextField
            label="Access Token"
            value={formData.accessToken}
            onChange={value => {
              onFormChange({...formData, accessToken: value});
            }}
            placeholder="shpat_..."
            helpText="Your Shopify Admin API access token from Custom App"
            type="password"
            required
            autoComplete="off"
            connectedRight={
              <Button
                onClick={onVerify}
                loading={verifying}
                disabled={!formData.accessToken || !formData.shopDomain}
              >
                {verified ? 'Re-verify' : 'Verify Store'}
              </Button>
            }
          />

          <TextField
            label="API Secret Key"
            value={formData.apiSecret}
            onChange={value => onFormChange({...formData, apiSecret: value})}
            placeholder="Your Shopify app API secret key"
            helpText="Found in your Shopify app settings. Required for webhook verification."
            type="password"
            autoComplete="off"
          />

          <TextField
            label="Store Name"
            value={formData.name}
            onChange={value => onFormChange({...formData, name: value})}
            placeholder="My Store"
            helpText="A friendly name for your store (auto-filled from verification)"
          />

          <TextField
            label="Niche"
            value={formData.niche}
            onChange={value => onFormChange({...formData, niche: value})}
            placeholder="Electronics, Fashion, etc."
            helpText="Product niche or category (optional)"
          />
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
