/* eslint-disable react/prop-types */
import React from 'react';
import {Card, InlineStack, Text, Tooltip, Icon} from '@shopify/polaris';
import {InfoIcon} from '@shopify/polaris-icons';

export default function ProductShipping({formData, onChange}) {
  const v = formData.variants?.[0] || {};
  const isPhysical = v.requiresShipping !== false;

  const togglePhysical = e => {
    const physical = e.target.checked;
    const variants = [...(formData.variants || [{}])];
    variants[0] = {...variants[0], requiresShipping: physical};
    onChange('variants', variants);
  };

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h2" variant="headingMd">Shipping</Text>
        <InlineStack gap="200" blockAlign="center">
          <Text as="span" variant="bodyMd">Physical product</Text>
          <Tooltip content="Turn off for digital products, services, or gift cards that don't require shipping.">
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
          <label className="pp-switch">
            <input
              type="checkbox"
              checked={isPhysical}
              onChange={togglePhysical}
              aria-label="Physical product"
            />
            <span className="pp-switch-track" />
          </label>
        </InlineStack>
      </InlineStack>
      <style>{`
        .pp-switch { position: relative; display: inline-block; width: 34px; height: 20px; flex-shrink: 0; }
        .pp-switch input { opacity: 0; width: 0; height: 0; }
        .pp-switch-track {
          position: absolute; cursor: pointer; inset: 0;
          background: #d2d5d8; border-radius: 999px;
          transition: background 150ms ease;
        }
        .pp-switch-track::before {
          content: ""; position: absolute; height: 16px; width: 16px;
          left: 2px; top: 2px; background: #fff; border-radius: 50%;
          transition: transform 150ms ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }
        .pp-switch input:checked + .pp-switch-track { background: #303030; }
        .pp-switch input:checked + .pp-switch-track::before { transform: translateX(14px); }
      `}</style>
    </Card>
  );
}
