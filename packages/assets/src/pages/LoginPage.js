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
import {LockIcon} from '@shopify/polaris-icons';
import {useAuth} from '../context/AuthContext';

export default function LoginPage() {
  const {login} = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed');
        return;
      }
      login(
        {
          id: data.data.id,
          username: data.data.username,
          displayName: data.data.displayName,
          role: data.data.role,
          assignedStores: data.data.assignedStores || [],
          allowedFeatures: data.data.allowedFeatures ?? null
        },
        data.data.token,
        data.data.refreshToken
      );
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') handleSubmit();
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
                  Admin Portal
                </Text>
              </InlineStack>

              {error && (
                <Banner tone="critical" onDismiss={() => setError('')}>
                  {error}
                </Banner>
              )}

              <FormLayout>
                <TextField
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  onKeyDown={handleKeyDown}
                  autoComplete="username"
                  autoFocus
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
                <Button
                  variant="primary"
                  icon={LockIcon}
                  onClick={handleSubmit}
                  loading={loading}
                  fullWidth
                >
                  Login
                </Button>
                <Button variant="plain" onClick={() => navigate('/setup-admin')} fullWidth>
                  First time? Setup admin account
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Page>
      </div>
    </div>
  );
}
