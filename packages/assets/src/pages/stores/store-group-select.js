import React from 'react';
import {Select} from '@shopify/polaris';

export default function StoreGroupSelect({groups, value, onChange}) {
  const options = [
    {label: 'No group', value: ''},
    ...groups.map(g => ({label: g.name, value: g.id}))
  ];
  return <Select label="Group" options={options} value={value || ''} onChange={onChange} />;
}
