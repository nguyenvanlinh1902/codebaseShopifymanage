import React from 'react';
import {Modal, Text, Badge} from '@shopify/polaris';
import TrackingDetailsTable from './TrackingDetailsTable';

/**
 * Import Details Modal Component
 * Shows detailed information about a specific import job
 */
export default function ImportDetailsModal({isOpen, onClose, selectedImport}) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Import Details"
      primaryAction={{
        content: 'Close',
        onAction: onClose
      }}
    >
      <Modal.Section>
        {selectedImport && (
          <div>
            <div style={{marginBottom: '16px'}}>
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                Source:
              </Text>
              <Text variant="bodyMd" as="p">
                {selectedImport.fileName}
              </Text>
            </div>

            <div style={{marginBottom: '16px'}}>
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                Store:
              </Text>
              <Text variant="bodyMd" as="p">
                {selectedImport.storeName} ({selectedImport.shopDomain})
              </Text>
            </div>

            <div style={{marginBottom: '16px'}}>
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                Status:
              </Text>
              <Badge
                tone={
                  selectedImport.status === 'completed'
                    ? 'success'
                    : selectedImport.status === 'failed'
                    ? 'critical'
                    : 'info'
                }
              >
                {selectedImport.status}
              </Badge>
            </div>

            <div style={{marginBottom: '16px'}}>
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                Records:
              </Text>
              <ul style={{marginLeft: '20px'}}>
                <li>Total: {selectedImport.totalRecords}</li>
                <li>Processed: {selectedImport.processedRecords || 0}</li>
                <li>Success: {selectedImport.successCount || 0}</li>
                <li>Failed: {selectedImport.failedCount || 0}</li>
              </ul>
            </div>

            <TrackingDetailsTable trackingDetails={selectedImport.trackingDetails} />

            {selectedImport.invalidRecords && selectedImport.invalidRecords.length > 0 && (
              <div style={{marginBottom: '16px'}}>
                <Text variant="bodyMd" as="p" fontWeight="semibold" tone="critical">
                  Invalid Records ({selectedImport.invalidRecords.length}):
                </Text>
                <div
                  style={{
                    marginTop: '8px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    background: '#f6f6f7',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  {selectedImport.invalidRecords.map((invalid, idx) => (
                    <div key={idx} style={{marginBottom: '8px'}}>
                      <Text variant="bodySm" as="p">
                        <strong>Row {invalid.row}:</strong> {invalid.errors.join(', ')}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{marginBottom: '16px'}}>
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                Created:
              </Text>
              <Text variant="bodyMd" as="p">
                {new Date(selectedImport.createdAt).toLocaleString()}
              </Text>
            </div>

            {selectedImport.completedAt && (
              <div>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Completed:
                </Text>
                <Text variant="bodyMd" as="p">
                  {new Date(selectedImport.completedAt).toLocaleString()}
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal.Section>
    </Modal>
  );
}
