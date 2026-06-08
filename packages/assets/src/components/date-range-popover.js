/* eslint-disable react/prop-types */
import React, {useState} from 'react';
import {Popover, Button, BlockStack, InlineStack, Text, DatePicker} from '@shopify/polaris';
import {CalendarIcon} from '@shopify/polaris-icons';

// Local-safe conversion between Date and "YYYY-MM-DD" (avoids UTC off-by-one).
const pad = n => String(n).padStart(2, '0');
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYMD = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Compact date-range filter: a button that opens a visual range calendar.
 * Keeps a string interface ("YYYY-MM-DD") for from/to so callers stay simple.
 */
export default function DateRangePopover({label, from, to, onFromChange, onToChange}) {
  const [open, setOpen] = useState(false);

  const anchor = from ? fromYMD(from) : new Date();
  const [{month, year}, setMonthYear] = useState({
    month: anchor.getMonth(),
    year: anchor.getFullYear()
  });

  const hasRange = from || to;
  const buttonLabel = hasRange ? `${from || '…'} → ${to || '…'}` : label;

  const selected = from || to ? {start: fromYMD(from || to), end: fromYMD(to || from)} : undefined;

  const handleChange = ({start, end}) => {
    onFromChange(toYMD(start));
    onToChange(toYMD(end));
  };

  const clear = () => {
    onFromChange('');
    onToChange('');
  };

  return (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      activator={
        <Button onClick={() => setOpen(v => !v)} disclosure icon={CalendarIcon}>
          {buttonLabel}
        </Button>
      }
    >
      <div style={{padding: '12px 16px'}}>
        <BlockStack gap="200">
          <Text variant="bodySm" fontWeight="semibold">
            {label}
          </Text>
          <DatePicker
            month={month}
            year={year}
            onChange={handleChange}
            onMonthChange={(m, y) => setMonthYear({month: m, year: y})}
            selected={selected}
            allowRange
            multiMonth
          />
          {hasRange && (
            <InlineStack align="end">
              <Button variant="plain" onClick={clear}>
                Clear
              </Button>
            </InlineStack>
          )}
        </BlockStack>
      </div>
    </Popover>
  );
}
