import XLSX from 'xlsx';

/**
 * Excel Parser Helper
 * Parses Excel files for tracking number import
 */

/**
 * Parse Excel buffer to array of tracking records
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Array} Array of tracking records
 */
export function parseTrackingExcel(buffer) {
  try {
    // Read workbook from buffer
    const workbook = XLSX.read(buffer, {type: 'buffer'});

    // Get first worksheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON (header row becomes keys)
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Convert dates and numbers to strings
      defval: '' // Default value for empty cells
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
}

/**
 * Validate tracking record
 * @param {Object} record - Single tracking record
 * @returns {Array} Array of error messages (empty if valid)
 */
export function validateTrackingRecord(record) {
  const errors = [];

  // Check for Order Number (various possible column names)
  const orderNumber = record['Order Number'] ||
    record['Order'] ||
    record['order_number'] ||
    record['OrderNumber'] ||
    record['Order #'];

  if (!orderNumber || !orderNumber.toString().trim()) {
    errors.push('Order Number is required');
  }

  // Check for Tracking Number (various possible column names)
  const trackingNumber = record['Tracking Number'] ||
    record['Tracking'] ||
    record['tracking_number'] ||
    record['TrackingNumber'] ||
    record['Tracking #'];

  if (!trackingNumber || !trackingNumber.toString().trim()) {
    errors.push('Tracking Number is required');
  }

  return errors;
}

/**
 * Map Excel record to standardized tracking format
 * @param {Object} record - Excel row data
 * @returns {Object} Standardized tracking data
 */
export function mapToTrackingData(record) {
  // Normalize order number
  const orderNumber = (
    record['Order Number'] ||
    record['Order'] ||
    record['order_number'] ||
    record['OrderNumber'] ||
    record['Order #'] ||
    ''
  ).toString().trim();

  // Normalize tracking number
  const trackingNumber = (
    record['Tracking Number'] ||
    record['Tracking'] ||
    record['tracking_number'] ||
    record['TrackingNumber'] ||
    record['Tracking #'] ||
    ''
  ).toString().trim();

  // Normalize carrier/company (optional)
  const trackingCompany = (
    record['Carrier'] ||
    record['Shipping Carrier'] ||
    record['Company'] ||
    record['tracking_company'] ||
    record['TrackingCompany'] ||
    ''
  ).toString().trim();

  // Normalize tracking URL (optional)
  const trackingUrl = (
    record['Tracking URL'] ||
    record['URL'] ||
    record['tracking_url'] ||
    record['TrackingURL'] ||
    ''
  ).toString().trim();

  return {
    orderNumber,
    trackingNumber,
    trackingCompany: trackingCompany || 'Other',
    trackingUrl: trackingUrl || null
  };
}

/**
 * Generate tracking import template (Excel format)
 */
export function generateTrackingTemplate() {
  const templateData = [
    {
      'Order Number': '#1001',
      'Tracking Number': 'TN123456789',
      'Carrier': 'USPS',
      'Tracking URL': 'https://tools.usps.com/go/TrackConfirmAction?tLabels=TN123456789'
    },
    {
      'Order Number': '#1002',
      'Tracking Number': 'TN987654321',
      'Carrier': 'FedEx',
      'Tracking URL': 'https://www.fedex.com/fedextrack/?trknbr=TN987654321'
    }
  ];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  worksheet['!cols'] = [
    {wch: 15}, // Order Number
    {wch: 20}, // Tracking Number
    {wch: 15}, // Carrier
    {wch: 50}  // Tracking URL
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tracking Template');

  // Generate buffer
  return XLSX.write(workbook, {type: 'buffer', bookType: 'xlsx'});
}
