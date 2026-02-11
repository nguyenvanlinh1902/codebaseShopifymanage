import React, {useState} from 'react';
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

const HARDCODED_PASSWORD = 'sheetbridge@2024';

export default function LoginPage() {
  const {login} = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (password === HARDCODED_PASSWORD) {
      login();
    } else {
      setError('Incorrect password');
    }

    setLoading(false);
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
                  SheetBridge Admin
                </Text>
              </InlineStack>

              {error && (
                <Banner tone="critical" onDismiss={() => setError('')}>
                  {error}
                </Banner>
              )}

              <FormLayout>
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                  autoFocus
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
              </FormLayout>
            </BlockStack>
          </Card>
        </Page>
      </div>
    </div>
  );
}
