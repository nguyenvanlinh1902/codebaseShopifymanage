import React from 'react';
import FileUploadSection from './FileUploadSection';
import StoreSelectionSection from './StoreSelectionSection';
import QueueStatusSection from './QueueStatusSection';
import StoreImportStatusSection from './StoreImportStatusSection';

/**
 * UploadTab Component
 * Contains all upload-related sections
 */
export default function UploadTab({
  stores,
  files,
  selectedStores,
  uploading,
  queueStats,
  processingQueue,
  storeImportStatus,
  onDrop,
  onFileRemove,
  onStoresChange,
  onUpload,
  onProcessQueue
}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      <FileUploadSection
        files={files}
        uploading={uploading}
        onDrop={onDrop}
        onFileRemove={onFileRemove}
      />

      <StoreSelectionSection
        stores={stores}
        selectedStores={selectedStores}
        files={files}
        uploading={uploading}
        onStoresChange={onStoresChange}
        onUpload={onUpload}
      />

      <QueueStatusSection
        queueStats={queueStats}
        processingQueue={processingQueue}
        onProcessQueue={onProcessQueue}
      />

      <StoreImportStatusSection storeImportStatus={storeImportStatus} />
    </div>
  );
}
