import React, {useState, useCallback} from 'react';
import {useHistory, Link as RouterLink} from 'react-router-dom';
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Box
} from '@shopify/polaris';
import {useAuth} from '@assets/contexts/authContext';

/**
 * Login page for team members
 */
export default function LoginPage() {
  const history = useHistory();
  const {login, loading} = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');

      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      if (!password) {
        setError('Please enter your password');
        return;
      }

      const result = await login(email, password);
      if (result.success) {
        history.push('/tickets');
      } else {
        setError(result.error);
      }
    },
    [email, password, login, history]
  );

  return (
    <Page narrowWidth>
      <Box paddingBlockStart="1000">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h1" alignment="center">
                Sign in to Chatty
              </Text>
              <Text variant="bodyMd" tone="subdued" alignment="center">
                Enter your email and password to continue
              </Text>
            </BlockStack>

            {error && (
              <Banner tone="critical" onDismiss={() => setError('')}>
                {error}
              </Banner>
            )}

            <form onSubmit={handleSubmit}>
              <FormLayout>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <Button
                  variant="primary"
                  submit
                  fullWidth
                  loading={loading}
                  disabled={!email || !password}
                >
                  Sign in
                </Button>
              </FormLayout>
            </form>

            <InlineStack align="center">
              <RouterLink to="/forgot-password">
                <Button variant="plain">Forgot password?</Button>
              </RouterLink>
            </InlineStack>

            <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="400">
              <Text variant="bodyMd" alignment="center">
                Don't have an account?{' '}
                <RouterLink to="/register">
                  <Button variant="plain">Create one</Button>
                </RouterLink>
              </Text>
            </Box>
          </BlockStack>
        </Card>
      </Box>
    </Page>
  );
}
