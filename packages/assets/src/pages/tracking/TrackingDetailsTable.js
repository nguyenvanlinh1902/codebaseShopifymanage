import React from 'react';
import {Text} from '@shopify/polaris';

/**
 * Tracking Details Table Component
 * Displays tracking details for each order in an import job
 */
export default function TrackingDetailsTable({trackingDetails}) {
  if (!trackingDetails || trackingDetails.length === 0) return null;

  return (
    <div style={{marginBottom: '16px'}}>
      <Text variant="bodyMd" as="p" fontWeight="semibold">
        Order Tracking Details:
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
              <th
                style={{
                  padding: '8px',
                  textAlign: 'left',
                  borderBottom: '1px solid #e1e3e5'
                }}
              >
                Order #
              </th>
              <th
                style={{
                  padding: '8px',
                  textAlign: 'left',
                  borderBottom: '1px solid #e1e3e5'
                }}
              >
                Tracking Number
              </th>
              <th
                style={{
                  padding: '8px',
                  textAlign: 'left',
                  borderBottom: '1px solid #e1e3e5'
                }}
              >
                Carrier
              </th>
              <th
                style={{
                  padding: '8px',
                  textAlign: 'center',
                  borderBottom: '1px solid #e1e3e5',
                  minWidth: '100px'
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: '8px',
                  textAlign: 'left',
                  borderBottom: '1px solid #e1e3e5'
                }}
              >
                Error Details
              </th>
            </tr>
          </thead>
          <tbody>
            {trackingDetails.map((detail, idx) => (
              <tr
                key={idx}
                style={{
                  background: idx % 2 === 0 ? '#fff' : '#fafbfb',
                  borderBottom: '1px solid #e1e3e5'
                }}
              >
                <td style={{padding: '8px'}}>
                  <strong>{detail.orderNumber}</strong>
                </td>
                <td style={{padding: '8px', fontFamily: 'monospace'}}>{detail.trackingNumber}</td>
                <td style={{padding: '8px'}}>{detail.carrier || '-'}</td>
                <td style={{padding: '8px', textAlign: 'center'}}>
                  {detail.success ? (
                    <span style={{color: '#008060', fontWeight: 'bold'}}>Success</span>
                  ) : (
                    <span style={{color: '#d72c0d', fontWeight: 'bold'}}>Failed</span>
                  )}
                </td>
                <td style={{padding: '8px'}}>
                  {!detail.success && detail.error ? (
                    <Text variant="bodySm" as="p" tone="critical">
                      {detail.error}
                    </Text>
                  ) : detail.success ? (
                    <Text variant="bodySm" as="p" tone="success">
                      Tracking updated successfully
                    </Text>
                  ) : (
                    '-'
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
