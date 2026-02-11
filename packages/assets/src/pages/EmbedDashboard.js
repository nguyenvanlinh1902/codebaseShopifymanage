import React, {useState, useEffect, useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {Page, BlockStack, Banner} from '@shopify/polaris';
import {ArrowRightIcon, ImportIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import LoadingSkeleton from './embed-dashboard/LoadingSkeleton';
import StoreHeader from './embed-dashboard/StoreHeader';
import StatsGrid from './embed-dashboard/StatsGrid';
import ActiveSyncCard from './embed-dashboard/ActiveSyncCard';
import QuickStartCard from './embed-dashboard/QuickStartCard';

export default function EmbedDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [productStats, setProductStats] = useState(null);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [error, setError] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  // QuickStart state
  const [quickStartOpen, setQuickStartOpen] = useState(true);
  const [quickStartDismissed, setQuickStartDismissed] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Single API call instead of 5 parallel calls - reduces network overhead
      const response = await api('/api/embed/dashboard');
      const result = await response.json();

      if (result.success && result.data) {
        const {
          store: storeData,
          productStats,
          syncConfigs: configs,
          sheets: sheetsData,
          googleStatus
        } = result.data;
        setStore(storeData);
        setProductStats(productStats);
        setSyncConfigs(configs || []);
        setSheets(sheetsData || []);
        setGoogleConnected(googleStatus?.connected || false);
      } else {
        setError(result.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps is safe here - function is stable

  // Mount only - fetch once
  useEffect(() => {
    fetchData();
  }, []); // Remove fetchData dependency to prevent re-runs

  const activeSync = syncConfigs.find(c => c.status === 'active');
  const totalSynced = syncConfigs.reduce((sum, c) => sum + (c.totalOrdersSynced || 0), 0);

  // QuickStart tasks
  const tasks = [
    {
      id: 'google',
      label: 'Connect Google Account',
      description:
        'Link your Google account to enable syncing orders to Google Sheets. Only Sheets access is requested.',
      completed: googleConnected || sheets.length > 0,
      buttons: [
        {
          text: googleConnected ? 'Connected' : 'Go to Settings',
          onClick: () => navigate('/settings'),
          variant: 'primary',
          icon: ArrowRightIcon
        }
      ]
    },
    {
      id: 'sync',
      label: 'Setup Order Sync',
      description:
        'Select a Google Sheet and tab, then configure automatic or manual order syncing.',
      completed: !!activeSync,
      buttons: [
        {
          text: 'Go to Orders',
          onClick: () => navigate('/orders'),
          variant: 'primary',
          icon: ArrowRightIcon
        }
      ]
    },
    {
      id: 'products',
      label: 'Import Your First Products',
      description: 'Upload a CSV file to bulk import products into your Shopify store.',
      completed: (productStats?.actualProductCount || 0) > 0,
      buttons: [
        {
          text: 'Go to Products',
          onClick: () => navigate('/products'),
          variant: 'primary',
          icon: ImportIcon
        }
      ]
    }
  ];

  const completedCount = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const percentCompleted = Math.round((completedCount / totalTasks) * 100);

  // Auto-select first incomplete task
  useEffect(() => {
    if (!loading && selectedTask === null) {
      const firstIncomplete = tasks.find(t => !t.completed);
      setSelectedTask(firstIncomplete ? firstIncomplete.id : tasks[0].id);
    }
  }, [loading]);

  // Auto-dismiss QuickStart when all tasks are completed
  useEffect(() => {
    if (completedCount === totalTasks && !loading) {
      setQuickStartDismissed(true);
    }
  }, [completedCount, totalTasks, loading]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <Page title="Dashboard">
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <StoreHeader store={store} />

        <StatsGrid
          productStats={productStats}
          totalSynced={totalSynced}
          activeSync={activeSync}
          sheets={sheets}
        />

        <ActiveSyncCard activeSync={activeSync} onManageClick={() => navigate('/orders')} />

        <QuickStartCard
          quickStartDismissed={quickStartDismissed}
          quickStartOpen={quickStartOpen}
          setQuickStartOpen={setQuickStartOpen}
          completedCount={completedCount}
          totalTasks={totalTasks}
          percentCompleted={percentCompleted}
          tasks={tasks}
          selectedTask={selectedTask}
          setSelectedTask={setSelectedTask}
        />
      </BlockStack>
    </Page>
  );
}
