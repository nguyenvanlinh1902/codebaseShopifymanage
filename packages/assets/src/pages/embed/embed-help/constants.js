import {ProductIcon, OrderIcon, NoteIcon} from '@shopify/polaris-icons';

export const STEPS = [
  {
    title: 'Import Products',
    description: 'Upload a CSV file to bulk import products into your Shopify store.',
    icon: ProductIcon,
    bg: 'bg-fill-info-secondary'
  },
  {
    title: 'Connect Google Sheets',
    description: 'Link your Google account to enable order syncing to spreadsheets.',
    icon: NoteIcon,
    bg: 'bg-fill-caution-secondary'
  },
  {
    title: 'Sync Orders',
    description: 'Select a sheet and start syncing orders automatically or on-demand.',
    icon: OrderIcon,
    bg: 'bg-fill-success-secondary'
  }
];

export const FAQ_ITEMS = [
  {
    question: 'How do I import products from a CSV file?',
    answer:
      'Navigate to the Products page, then click "Upload & Import" tab. Drag and drop your CSV file or click to browse. The app supports standard Shopify CSV format. You can download a template from the import page.'
  },
  {
    question: 'How do I sync orders to Google Sheets?',
    answer:
      'First, connect your Google account from the Orders page. Then select a Google Sheet and tab to sync orders to. Click "Sync Now" to start a manual sync, or configure automatic sync from Settings.'
  },
  {
    question: 'How do I connect my Google account?',
    answer:
      'Go to the Orders page and click "Connect Google Account". You will be redirected to Google to authorize access. The app only requests access to Google Sheets — no other Google data is accessed.'
  },
  {
    question: 'What data does this app collect?',
    answer:
      'The app collects store information, product data (during import), order data (during sync), and Google Sheets metadata. We do not sell or share your data with third parties. See our Privacy Policy for full details.'
  },
  {
    question: 'How do I uninstall the app?',
    answer:
      'Go to your Shopify Admin > Settings > Apps and sales channels > ToolTrackingOrder > Remove app. All your data will be deleted within 48 hours of uninstallation as required by Shopify.'
  },
  {
    question: 'Why are my orders not syncing?',
    answer:
      'Check that: 1) Your Google account is connected, 2) A sync configuration is set up with a valid sheet and tab, 3) The sheet has not been deleted or renamed. Try disconnecting and reconnecting your Google account if issues persist.'
  }
];
