/* eslint-disable react/prop-types */
import React, {useState} from 'react';
import {BlockStack, InlineStack, Button} from '@shopify/polaris';
import {DragHandleIcon, XSmallIcon, PlusIcon, DeleteIcon} from '@shopify/polaris-icons';

function reorder(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function ProductOptionEditor({options, onChange}) {
  const [addVal, setAddVal] = useState({});
  const [addingFor, setAddingFor] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [dragOptIdx, setDragOptIdx] = useState(null);
  const [overOptIdx, setOverOptIdx] = useState(null);
  const [dragVal, setDragVal] = useState(null); // {optIdx, valIdx}
  const [overVal, setOverVal] = useState(null);

  const updateOption = (i, patch) => {
    onChange(options.map((o, idx) => (idx === i ? {...o, ...patch} : o)));
  };

  const handleAddValue = i => {
    const val = (addVal[i] || '').trim();
    if (!val || options[i].values.includes(val)) {
      setAddVal(p => ({...p, [i]: ''}));
      return;
    }
    updateOption(i, {values: [...options[i].values, val]});
    setAddVal(p => ({...p, [i]: ''}));
  };

  const handleRemoveValue = (i, vi) => {
    updateOption(i, {values: options[i].values.filter((_, j) => j !== vi)});
  };

  const handleRemoveOption = i => {
    onChange(options.filter((_, idx) => idx !== i));
  };

  const handleAddOption = () => {
    onChange([...options, {name: '', values: []}]);
    setEditingName(options.length);
  };

  // Option reorder
  const handleOptDragStart = (i, e) => {
    setDragOptIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `opt:${i}`);
  };
  const handleOptDragOver = (i, e) => {
    e.preventDefault();
    if (dragOptIdx !== null && dragOptIdx !== i) setOverOptIdx(i);
  };
  const handleOptDrop = (i, e) => {
    e.preventDefault();
    if (dragOptIdx !== null && dragOptIdx !== i) onChange(reorder(options, dragOptIdx, i));
    setDragOptIdx(null);
    setOverOptIdx(null);
  };
  const handleOptDragEnd = () => {
    setDragOptIdx(null);
    setOverOptIdx(null);
  };

  // Value reorder (within same option)
  const handleValDragStart = (optIdx, valIdx, e) => {
    setDragVal({optIdx, valIdx});
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `val:${optIdx}:${valIdx}`);
    e.stopPropagation();
  };
  const handleValDragOver = (optIdx, valIdx, e) => {
    if (dragVal && dragVal.optIdx === optIdx) {
      e.preventDefault();
      e.stopPropagation();
      setOverVal({optIdx, valIdx});
    }
  };
  const handleValDrop = (optIdx, valIdx, e) => {
    if (dragVal && dragVal.optIdx === optIdx && dragVal.valIdx !== valIdx) {
      e.preventDefault();
      e.stopPropagation();
      const newValues = reorder(options[optIdx].values, dragVal.valIdx, valIdx);
      updateOption(optIdx, {values: newValues});
    }
    setDragVal(null);
    setOverVal(null);
  };

  return (
    <BlockStack gap="200">
      {options.map((opt, i) => {
        const isDragging = dragOptIdx === i;
        const isOver = overOptIdx === i && dragOptIdx !== null && dragOptIdx !== i;
        return (
          <div
            key={i}
            className={`po-card ${isDragging ? 'po-dragging' : ''} ${isOver ? 'po-drop-target' : ''}`}
            onDragOver={e => handleOptDragOver(i, e)}
            onDrop={e => handleOptDrop(i, e)}
          >
            <div
              className="po-handle"
              draggable
              onDragStart={e => handleOptDragStart(i, e)}
              onDragEnd={handleOptDragEnd}
              aria-label="Drag to reorder option"
            >
              <DragHandleIcon />
            </div>
            <div className="po-body">
              <InlineStack align="space-between" blockAlign="center">
                {editingName === i || !opt.name ? (
                  <input
                    className="po-name-input"
                    value={opt.name}
                    autoFocus
                    placeholder="Option name (e.g. Size, Color)"
                    onChange={e => updateOption(i, {name: e.target.value})}
                    onBlur={() => setEditingName(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); setEditingName(null); }
                    }}
                  />
                ) : (
                  <button type="button" className="po-name" onClick={() => setEditingName(i)}>
                    {opt.name}
                  </button>
                )}
              </InlineStack>
              <div className="po-chips">
                {opt.values.map((val, vi) => {
                  const chipDragging = dragVal && dragVal.optIdx === i && dragVal.valIdx === vi;
                  const chipOver = overVal && overVal.optIdx === i && overVal.valIdx === vi && !chipDragging;
                  return (
                    <span
                      key={vi}
                      className={`po-chip ${chipDragging ? 'po-chip-dragging' : ''} ${chipOver ? 'po-chip-over' : ''}`}
                      draggable
                      onDragStart={e => handleValDragStart(i, vi, e)}
                      onDragOver={e => handleValDragOver(i, vi, e)}
                      onDrop={e => handleValDrop(i, vi, e)}
                      onDragEnd={() => { setDragVal(null); setOverVal(null); }}
                    >
                      <span>{val}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        .po-card {
          display: flex;
          gap: 10px;
          border: 1px solid var(--p-color-border);
          border-radius: 12px;
          background: var(--p-color-bg-surface);
          padding: 14px 14px 14px 6px;
          transition: border-color .15s, box-shadow .15s, opacity .15s;
        }
        .po-card:hover .po-chip-x { opacity: 1; }
        .po-dragging { opacity: 0.4; }
        .po-drop-target {
          border-color: var(--p-color-border-focus, #008060);
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
        }
        .po-handle {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          color: var(--p-color-icon-subdued);
          width: 20px;
          padding-top: 4px;
          cursor: grab;
          opacity: 0.6;
          transition: opacity .15s;
        }
        .po-card:hover .po-handle { opacity: 1; }
        .po-handle:active { cursor: grabbing; }
        .po-handle svg { width: 16px; height: 16px; }
        .po-body { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .po-name {
          all: unset;
          font-weight: 600;
          font-size: 13px;
          color: var(--p-color-text);
          cursor: text;
          padding: 0;
        }
        .po-name-input {
          all: unset;
          font-weight: 600;
          font-size: 13px;
          border-bottom: 1px solid var(--p-color-border);
          padding: 2px 0;
          flex: 1;
        }
        .po-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }
        .po-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          background: var(--p-color-bg-fill-tertiary, #e3e5e7);
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.3;
          color: var(--p-color-text);
          cursor: grab;
          user-select: none;
          transition: box-shadow .12s, background .12s;
        }
        .po-chip:hover { background: #d7d9dc; }
        .po-chip:active { cursor: grabbing; }
        .po-chip-dragging { opacity: 0.4; }
        .po-chip-over {
          background: #d1ebe3;
          box-shadow: inset 0 0 0 1px #008060;
        }
        .po-chip-x {
          all: unset;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          margin-left: 2px;
          border-radius: 3px;
          cursor: pointer;
          color: var(--p-color-icon-subdued);
          opacity: 0;
          transition: opacity .15s, background .15s;
        }
        .po-chip:hover .po-chip-x { opacity: 1; }
        .po-chip-x:hover { background: rgba(0,0,0,0.1); color: var(--p-color-icon); }
        .po-chip-x svg { width: 12px; height: 12px; }
        .po-chip-add {
          all: unset;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          cursor: pointer;
          color: var(--p-color-icon-subdued);
          transition: background .15s, color .15s;
        }
        .po-chip-add:hover { background: var(--p-color-bg-surface-hover); color: var(--p-color-icon); }
        .po-chip-add svg { width: 14px; height: 14px; }
        .po-chip-input {
          all: unset;
          min-width: 100px;
          padding: 3px 8px;
          background: var(--p-color-bg-surface);
          border: 1px solid var(--p-color-border-focus, #008060);
          border-radius: 6px;
          font-size: 13px;
          color: var(--p-color-text);
        }
        .po-chip-input::placeholder { color: var(--p-color-text-subdued); }
        .po-delete-wrap { opacity: 0; transition: opacity .15s; }
        .po-card:hover .po-delete-wrap { opacity: 1; }
      `}</style>
    </BlockStack>
  );
}
