import React from 'react';
import {Text} from '@shopify/polaris';

/**
 * Preview Data Table Component
 * Displays preview data from Google Sheet or Excel with validation status
 */
export default function PreviewDataTable({previewData}) {
  if (!previewData) return null;

  return (
    <div style={{marginTop: '16px'}}>
      <Text variant="headingSm" as="h3">
        Preview ({previewData.validCount} valid, {previewData.invalidCount} invalid of{' '}
        {previewData.totalRows} rows)
      </Text>
      <div
        style={{
          marginTop: '8px',
          maxHeight: '300px',
          overflow: 'auto',
          border: '1px solid #e1e3e5',
          borderRadius: '4px'
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}
        >
          <thead style={{background: '#f6f6f7', position: 'sticky', top: 0}}>
            <tr>
              <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                Row
              </th>
              <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                Order #
              </th>
              <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                Tracking Number
              </th>
              <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                Carrier
              </th>
              <th
                style={{padding: '8px', textAlign: 'center', borderBottom: '1px solid #e1e3e5'}}
              >
                Valid
              </th>
            </tr>
          </thead>
          <tbody>
            {previewData.records.map((record, idx) => (
              <tr
                key={idx}
                style={{
                  background: !record.valid ? '#fff4f4' : idx % 2 === 0 ? '#fff' : '#fafbfb',
                  borderBottom: '1px solid #e1e3e5'
                }}
              >
                <td style={{padding: '8px'}}>{record.row}</td>
                <td style={{padding: '8px', fontWeight: 'bold'}}>
                  {record.data.orderNumber || record.data['Order Number'] || '-'}
                </td>
                <td style={{padding: '8px', fontFamily: 'monospace'}}>
                  {record.data.trackingNumber || record.data['Tracking Number'] || '-'}
                </td>
                <td style={{padding: '8px'}}>
                  {record.data.trackingCompany || record.data['Carrier'] || '-'}
                </td>
                <td style={{padding: '8px', textAlign: 'center'}}>
                  {record.valid ? (
                    <span style={{color: '#008060'}}>✅</span>
                  ) : (
                    <span
                      title={record.errors.join(', ')}
                      style={{color: '#d72c0d', cursor: 'help'}}
                    >
                      ❌
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
