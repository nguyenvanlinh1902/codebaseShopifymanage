import React from 'react';
import PropTypes from 'prop-types';
import {InlineGrid} from '@shopify/polaris';
import {ProductIcon, OrderIcon, NoteIcon} from '@shopify/polaris-icons';
import StatCard from './StatCard';

export default function StatsGrid({productStats, totalSynced, activeSync, sheets}) {
  return (
    <InlineGrid columns={3} gap="400">
      <StatCard
        title="Products Imported"
        value={productStats ? (productStats.actualProductCount || 0).toLocaleString() : '0'}
        icon={ProductIcon}
        iconBg="bg-fill-info-secondary"
        status={
          productStats?.pending > 0
            ? `${productStats.pending} pending`
            : productStats?.failed > 0
            ? `${productStats.failed} failed`
            : null
        }
        statusTone={productStats?.failed > 0 ? 'critical' : 'attention'}
      />
      <StatCard
        title="Orders Synced"
        value={totalSynced.toLocaleString()}
        icon={OrderIcon}
        iconBg="bg-fill-success-secondary"
        status={activeSync ? 'Sync Active' : 'Not configured'}
        statusTone={activeSync ? 'success' : 'new'}
      />
      <StatCard
        title="Google Sheets"
        value={String(sheets.length)}
        icon={NoteIcon}
        iconBg="bg-fill-caution-secondary"
        status={sheets.length > 0 ? 'Connected' : 'Not connected'}
        statusTone={sheets.length > 0 ? 'success' : 'new'}
      />
    </InlineGrid>
  );
}

StatsGrid.propTypes = {
  productStats: PropTypes.shape({
    actualProductCount: PropTypes.number,
    pending: PropTypes.number,
    failed: PropTypes.number
  }),
  totalSynced: PropTypes.number.isRequired,
  activeSync: PropTypes.object,
  sheets: PropTypes.array.isRequired
};
