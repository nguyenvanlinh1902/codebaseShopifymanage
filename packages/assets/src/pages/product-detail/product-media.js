/* eslint-disable react/prop-types */
import React, {useCallback, useRef, useState} from 'react';
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DropZone,
  InlineStack,
  ProgressBar,
  Text,
  TextField
} from '@shopify/polaris';
import {DeleteIcon, ArrowUpIcon, ArrowDownIcon, EditIcon, PlusIcon} from '@shopify/polaris-icons';
import {uploadFile} from './product-media-uploader';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function genId() {
  return `_new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function ProductMedia({formData, onChange, storeId}) {
  const media = formData.media || [];
  const [uploads, setUploads] = useState({});
  const [editingAlt, setEditingAlt] = useState(null);
  const [altDraft, setAltDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const fileInputRef = useRef(null);

  const setUpload = (id, patch) => setUploads(prev => ({...prev, [id]: {...prev[id], ...patch}}));

  const mediaRef = useRef(media);
  mediaRef.current = media;

  const doUpload = useCallback(
    async (fileId, file) => {
      setUpload(fileId, {progress: 5, error: null});
      try {
        const cdnUrl = await uploadFile(file, storeId, pct => setUpload(fileId, {progress: pct}));
        const list = [...mediaRef.current];
        const idx = list.findIndex(m => m._fileId === fileId);
        if (idx !== -1)
          list[idx] = {...list[idx], url: cdnUrl, _pending: false, _fileId: undefined};
        onChange('media', list);
        setUploads(prev => {
          const n = {...prev};
          delete n[fileId];
          return n;
        });
      } catch (err) {
        setUpload(fileId, {progress: 0, error: err.message || 'Upload failed'});
      }
    },
    [storeId, onChange]
  );

  const acceptFiles = useCallback(
    accepted => {
      if (!accepted.length) return;
      const newItems = [];
      const toUpload = [];
      accepted.forEach(file => {
        const fileId = genId();
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          url: previewUrl,
          alt: '',
          mediaContentType: 'IMAGE',
          _pending: true,
          _fileId: fileId
        });
        toUpload.push({fileId, file, previewUrl});
      });
      setUploads(prev => {
        const n = {...prev};
        toUpload.forEach(({fileId, previewUrl, file}) => {
          n[fileId] = {progress: 0, error: null, previewUrl, file};
        });
        return n;
      });
      onChange('media', [...media, ...newItems]);
      toUpload.forEach(({fileId, file}) => doUpload(fileId, file));
    },
    [media, onChange, doUpload]
  );

  const handleDrop = useCallback((_d, accepted) => acceptFiles(accepted), [acceptFiles]);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileInput = e => {
    const files = Array.from(e.target.files || []).filter(f => ACCEPTED_TYPES.includes(f.type));
    acceptFiles(files);
    e.target.value = '';
  };

  const handleRemove = useCallback(
    index => {
      const item = media[index];
      if (item?._fileId) {
        setUploads(prev => {
          const n = {...prev};
          delete n[item._fileId];
          return n;
        });
      }
      const list = [...media];
      list.splice(index, 1);
      onChange('media', list);
    },
    [media, onChange]
  );

  const handleMove = useCallback(
    (index, dir) => {
      const target = index + dir;
      if (target < 0 || target >= media.length) return;
      const list = [...media];
      [list[index], list[target]] = [list[target], list[index]];
      onChange('media', list);
    },
    [media, onChange]
  );

  const openAltEdit = useCallback(
    index => {
      setEditingAlt(index);
      setAltDraft(media[index]?.alt || '');
    },
    [media]
  );

  const saveAlt = useCallback(() => {
    if (editingAlt === null) return;
    const list = [...media];
    list[editingAlt] = {...list[editingAlt], alt: altDraft};
    onChange('media', list);
    setEditingAlt(null);
  }, [editingAlt, altDraft, media, onChange]);

  const tile = (img, i) => {
    const upState = img._fileId ? uploads[img._fileId] : null;
    const isUploading = !!upState && !upState.error;
    const hasError = upState?.error;
    const isFeatured = i === 0;
    return (
      <div
        key={img._fileId || img.id || i}
        className="pm-tile"
        style={{
          gridColumn: isFeatured ? 'span 2' : 'span 1',
          gridRow: isFeatured ? 'span 2' : 'span 1'
        }}
      >
        {img.url ? (
          <img className="pm-tile-img" src={img.url} alt={img.alt || ''} />
        ) : (
          <div className="pm-tile-img pm-tile-placeholder" />
        )}
        {isFeatured && <span className="pm-featured">Featured</span>}
        {isUploading && (
          <div className="pm-progress">
            <ProgressBar progress={upState.progress} size="small" />
          </div>
        )}
        {hasError && (
          <div className="pm-error">
            <Text variant="bodySm" tone="critical" as="span">Failed</Text>
            <Button size="slim" onClick={() => doUpload(img._fileId, uploads[img._fileId]?.file)}>
              Retry
            </Button>
          </div>
        )}
        {!isUploading && !hasError && (
          <div className="pm-actions">
            <InlineStack gap="100">
              <Button icon={EditIcon} size="slim" accessibilityLabel="Edit alt text" onClick={() => openAltEdit(i)} />
              <Button icon={ArrowUpIcon} size="slim" accessibilityLabel="Move up" disabled={i === 0} onClick={() => handleMove(i, -1)} />
              <Button icon={ArrowDownIcon} size="slim" accessibilityLabel="Move down" disabled={i === media.length - 1} onClick={() => handleMove(i, 1)} />
              <Button icon={DeleteIcon} size="slim" tone="critical" accessibilityLabel="Remove" onClick={() => handleRemove(i)} />
            </InlineStack>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">Media</Text>
          {media.length > 0 && (
            <Button variant="plain" onClick={handlePickFile}>Add</Button>
          )}
        </InlineStack>

        {editingAlt !== null && (
          <Banner onDismiss={() => setEditingAlt(null)}>
            <BlockStack gap="200">
              <Text variant="bodyMd">Edit alt text for image {editingAlt + 1}</Text>
              <TextField label="Alt text" value={altDraft} onChange={setAltDraft} autoComplete="off" multiline={2} />
              <InlineStack gap="200">
                <Button onClick={saveAlt} variant="primary" size="slim">Save</Button>
                <Button onClick={() => setEditingAlt(null)} size="slim">Cancel</Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          style={{display: 'none'}}
          onChange={handleFileInput}
        />

        {media.length === 0 ? (
          <DropZone accept={ACCEPTED_TYPES.join(',')} type="image" allowMultiple onDrop={handleDrop}>
            <DropZone.FileUpload actionTitle="Add files" actionHint="or drop files to upload" />
          </DropZone>
        ) : (() => {
          const MAX = 7; // 1 featured (2x2) + up to 6 small tiles visible before overflow
          const visible = media.slice(0, MAX);
          const overflow = media.length - MAX;
          const overflowImg = overflow > 0 ? media[MAX] : null;
          return (
            <div className="pm-grid">
              {visible.map((img, i) => tile(img, i))}
              {overflow > 0 && (
                <button
                  type="button"
                  className="pm-overflow-tile"
                  onClick={() => setShowAll(true)}
                  aria-label={`Show ${overflow} more`}
                >
                  {overflowImg?.url && (
                    <img className="pm-tile-img pm-overflow-bg" src={overflowImg.url} alt="" />
                  )}
                  <span className="pm-overflow-label">+{overflow}</span>
                </button>
              )}
              <button type="button" className="pm-add-tile" onClick={handlePickFile} aria-label="Add media">
                <PlusIcon />
              </button>
            </div>
          );
        })()}

        {showAll && (
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingSm" as="h3">All media ({media.length})</Text>
              <Button variant="plain" onClick={() => setShowAll(false)}>Collapse</Button>
            </InlineStack>
            <div className="pm-grid pm-grid-all">
              {media.map((img, i) => tile(img, i))}
              <button type="button" className="pm-add-tile" onClick={handlePickFile} aria-label="Add media">
                <PlusIcon />
              </button>
            </div>
          </BlockStack>
        )}
      </BlockStack>

      <style>{`
        .pm-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          max-width: 520px;
        }
        .pm-tile {
          position: relative;
          aspect-ratio: 1 / 1;
          border: 1px solid var(--p-color-border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--p-color-bg-surface-secondary);
        }
        .pm-tile-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pm-tile-placeholder {
          background: var(--p-color-bg-surface-secondary);
        }
        .pm-featured {
          position: absolute;
          top: 6px;
          left: 6px;
          background: #008060;
          color: #fff;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          line-height: 1.2;
        }
        .pm-actions {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 6px;
          background: rgba(255,255,255,0.92);
          opacity: 0;
          transition: opacity .15s ease;
          display: flex;
          justify-content: center;
        }
        .pm-tile:hover .pm-actions { opacity: 1; }
        .pm-progress {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: 8px;
        }
        .pm-error {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: rgba(255,255,255,0.9);
        }
        .pm-add-tile {
          aspect-ratio: 1 / 1;
          border: 1.5px dashed var(--p-color-border);
          border-radius: 8px;
          background: transparent;
          color: var(--p-color-icon-subdued);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pm-add-tile:hover {
          border-color: var(--p-color-border-hover);
          background: var(--p-color-bg-surface-hover);
        }
        .pm-add-tile svg { width: 24px; height: 24px; }
        .pm-overflow-tile {
          aspect-ratio: 1 / 1;
          position: relative;
          border: 1px solid var(--p-color-border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--p-color-bg-surface-secondary);
          cursor: pointer;
          padding: 0;
        }
        .pm-overflow-bg { filter: blur(3px) brightness(0.8); }
        .pm-overflow-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 600;
          font-size: 18px;
          background: rgba(0,0,0,0.35);
        }
        .pm-grid-all { margin-top: 4px; }
      `}</style>
    </Card>
  );
}
