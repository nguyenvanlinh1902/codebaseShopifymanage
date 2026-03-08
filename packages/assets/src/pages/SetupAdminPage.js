import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack
} from '@shopify/polaris';
import {PersonIcon} from '@shopify/polaris-icons';

export default function SetupAdminPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({username: 'admin', password: '', displayName: 'Admin'});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = field => val => setForm(f => ({...f, [field]: val}));

  const handleSubmit = async () => {
    setError('');
    if (!form.username || !form.password || !form.displayName) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Setup failed');
        return;
      }
      setSuccess('Admin account created! Redirecting to login...');
      setTimeout(() => navigate('/'), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f6f6f7'
      }}
    >
      <div style={{width: '100%', maxWidth: 420}}>
        <Page>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="center">
                <Text variant="headingLg" as="h1">
                  Initial Setup
                </Text>
              </InlineStack>
              <Text variant="bodyMd" tone="subdued" alignment="center">
                Create the first admin account. This page will be disabled afterwards.
              </Text>

              {error && (
                <Banner tone="critical" onDismiss={() => setError('')}>
                  {error}
                </Banner>
              )}
              {success && <Banner tone="success">{success}</Banner>}

              <FormLayout>
                <TextField
                  label="Username"
                  value={form.username}
                  onChange={set('username')}
                  autoComplete="off"
                  autoFocus
                />
                <TextField
                  label="Display Name"
                  value={form.displayName}
                  onChange={set('displayName')}
                  autoComplete="off"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                />
                <Button
                  variant="primary"
                  icon={PersonIcon}
                  onClick={handleSubmit}
                  loading={loading}
                  fullWidth
                >
                  Create Admin Account
                </Button>
                <Button variant="plain" onClick={() => navigate('/')} fullWidth>
                  Back to Login
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Page>
      </div>
    </div>
  );
}
