import React, {useState, useCallback, useRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Frame, Navigation, TopBar, Icon, Text, Badge, Divider, Link, Scrollable} from '@shopify/polaris';
import {useLocation} from 'react-router-dom';
import {
  HomeIcon,
  StoreIcon,
  NoteIcon,
  ProductIcon,
  OrderIcon,
  DeliveryIcon,
  ChartVerticalFilledIcon,
  ThemeIcon,
  SettingsIcon,
  ExitIcon,
  PersonIcon,
  CodeIcon,
  CashDollarIcon,
  TargetIcon,
  NotificationIcon
} from '@shopify/polaris-icons';
import {useAuth} from '../context/AuthContext';
import {useStoreAlerts} from '../components/header-alerts-banner';

StandaloneLayout.propTypes = {
  children: PropTypes.node.isRequired
};

const NAV_FEATURE_MAP = {
  '/stores': 'stores',
  '/sheets': 'sheets',
  '/products': 'products',
  '/orders': 'orders',
  '/tracking': 'tracking',
  '/analytics': 'analytics',
  '/balance': 'analytics',
  '/campaign-ads': 'analytics',
  '/themes': 'themes',
  '/setup': 'setup'
};

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Notification bell dropdown — renders as fixed overlay on top bar.
 */
function NotificationBell({storeAlerts, totalAlerts, totalEvents}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const badgeCount = totalAlerts + totalEvents;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allCritical = [];
  const allRegular = [];
  for (const store of storeAlerts) {
    for (const alert of store.alerts) {
      allCritical.push({store: store.name, ...alert});
    }
    for (const evt of store.events) {
      if (evt.critical) {
        allCritical.push({store: store.name, ...evt});
      } else {
        allRegular.push({store: store.name, ...evt});
      }
    }
  }

  const row = {display: 'flex', justifyContent: 'space-between', alignItems: 'center'};

  return (
    <div ref={ref} style={{position: 'fixed', top: 8, right: 120, zIndex: 520}}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center'
        }}
        aria-label={`${badgeCount} notifications`}
      >
        <Icon source={NotificationIcon} tone="subdued" />
        {badgeCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: '#303030',
              color: '#fff',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px'
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 420,
            background: 'var(--p-color-bg-surface, #fff)',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            border: '1px solid var(--p-color-border-secondary, #E1E3E5)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{padding: '14px 16px', ...row}}>
            <Text variant="headingMd">Notifications</Text>
            {badgeCount > 0 && <Badge tone="info">{badgeCount}</Badge>}
          </div>
          <Divider />

          {/* Content */}
          <Scrollable style={{maxHeight: 480}}>
            {allCritical.length === 0 && allRegular.length === 0 ? (
              <div style={{padding: 32, textAlign: 'center'}}>
                <Text tone="subdued">No notifications</Text>
              </div>
            ) : (
              <>
                {/* Critical alerts */}
                {allCritical.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '10px 16px',
                        background: 'var(--p-color-bg-surface-critical-subdued, #FFF4F4)',
                        ...row
                      }}
                    >
                      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <Badge tone="critical" size="small">Critical</Badge>
                        <Text variant="headingSm">Alerts</Text>
                      </div>
                      <Badge tone="critical">{allCritical.length}</Badge>
                    </div>
                    {allCritical.map((item, i) => (
                      <div
                        key={`c-${i}`}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--p-color-border-secondary, #E1E3E5)'
                        }}
                      >
                        <div style={row}>
                          <Text variant="bodySm" fontWeight="semibold">{item.store}</Text>
                          {item.date && (
                            <Text variant="bodySm" tone="subdued">{fmtDate(item.date)}</Text>
                          )}
                        </div>
                        <div style={{marginTop: 4}}>
                          <Text variant="bodySm">{stripHtml(item.message)}</Text>
                        </div>
                        {item.action && (
                          <div style={{marginTop: 4}}>
                            <Link url={item.action.url} external>
                              {item.action.title}
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Regular events */}
                {allRegular.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '10px 16px',
                        background: 'var(--p-color-bg-surface-secondary, #F6F6F7)',
                        ...row
                      }}
                    >
                      <Text variant="headingSm">Recent Events</Text>
                      <Badge>{allRegular.length}</Badge>
                    </div>
                    {allRegular.map((item, i) => (
                      <div
                        key={`r-${i}`}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--p-color-border-secondary, #E1E3E5)'
                        }}
                      >
                        <div style={row}>
                          <Text variant="bodySm" fontWeight="semibold">{item.store}</Text>
                          {item.date && (
                            <Text variant="bodySm" tone="subdued">{fmtDate(item.date)}</Text>
                          )}
                        </div>
                        <div style={{marginTop: 4}}>
                          <Text variant="bodySm">{stripHtml(item.message)}</Text>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </Scrollable>
        </div>
      )}
    </div>
  );
}

export default function StandaloneLayout({children}) {
  const location = useLocation();
  const {logout, user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const {storeAlerts, totalAlerts, totalEvents} = useStoreAlerts();
  const [userMenuActive, setUserMenuActive] = useState(false);

  const toggleUserMenu = useCallback(() => setUserMenuActive(v => !v), []);

  const allNavItems = [
    {label: 'Dashboard', icon: HomeIcon, url: '/', exactMatch: true},
    {label: 'Stores', icon: StoreIcon, url: '/stores'},
    {label: 'Google Sheets (Beta)', icon: NoteIcon, url: '/sheets'},
    {label: 'Products', icon: ProductIcon, url: '/products'},
    {label: 'Orders', icon: OrderIcon, url: '/orders'},
    {label: 'Tracking', icon: DeliveryIcon, url: '/tracking'},
    {label: 'Analytics', icon: ChartVerticalFilledIcon, url: '/analytics'},
    {label: 'Balance', icon: CashDollarIcon, url: '/balance'},
    {label: 'Campaign Ads', icon: TargetIcon, url: '/campaign-ads'},
    {label: 'Themes', icon: ThemeIcon, url: '/themes'},
    {label: 'Setup Store', icon: SettingsIcon, url: '/setup'}
  ];

  const filterNavItems = items => {
    if (isAdmin) return items;
    const allowed = user?.allowedFeatures;
    if (allowed === null || allowed === undefined) return items;
    return items.filter(item => {
      const feature = NAV_FEATURE_MAP[item.url];
      if (!feature) return true;
      return allowed.includes(feature);
    });
  };

  const mainNavItems = [
    ...filterNavItems(allNavItems),
    ...(isAdmin ? [{label: 'Users', icon: PersonIcon, url: '/users'}] : [])
  ];

  const devNavItems = isAdmin
    ? [{label: 'Webhook Checker', icon: CodeIcon, url: '/dev/webhooks'}]
    : [];

  const userMenuMarkup = (
    <TopBar.UserMenu
      actions={[{items: [{content: 'Logout', onAction: logout, icon: ExitIcon}]}]}
      name={user?.displayName || user?.username || ''}
      initials={(user?.displayName || user?.username || '?')[0].toUpperCase()}
      open={userMenuActive}
      onToggle={toggleUserMenu}
    />
  );

  const topBarMarkup = (
    <TopBar showNavigationToggle userMenu={userMenuMarkup} />
  );

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section items={mainNavItems} />
      {devNavItems.length > 0 && (
        <Navigation.Section title="Dev Tools" separator items={devNavItems} />
      )}
    </Navigation>
  );

  return (
    <Frame topBar={topBarMarkup} navigation={navigationMarkup}>
      <NotificationBell
        storeAlerts={storeAlerts}
        totalAlerts={totalAlerts}
        totalEvents={totalEvents}
      />
      {children}
    </Frame>
  );
}
