import React, {useState, useCallback} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
  Banner,
  Box
} from '@shopify/polaris';
import {useAuth} from '@assets/contexts/authContext';

/**
 * Forgot password page
 */
export default function ForgotPasswordPage() {
  const {forgotPassword} = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setSuccess(false);

      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }

      setLoading(true);
      const result = await forgotPassword(email);
      setLoading(false);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    },
    [email, forgotPassword]
  );

  if (success) {
    return (
      <Page narrowWidth>
        <Box paddingBlockStart="1000">
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingLg" as="h1" alignment="center">
                  Check your email
                </Text>
                <Text variant="bodyMd" tone="subdued" alignment="center">
                  If an account exists for {email}, you will receive a password reset link shortly.
                </Text>
              </BlockStack>

              <Banner tone="success">
                Password reset email sent. Please check your inbox and spam folder.
              </Banner>

              <RouterLink to="/login">
                <Button fullWidth>Return to sign in</Button>
              </RouterLink>
            </BlockStack>
          </Card>
        </Box>
      </Page>
    );
  }

  return (
    <Page narrowWidth>
      <Box paddingBlockStart="1000">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h1" alignment="center">
                Reset your password
              </Text>
              <Text variant="bodyMd" tone="subdued" alignment="center">
                Enter your email address and we'll send you a link to reset your password
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
                <Button
                  variant="primary"
                  submit
                  fullWidth
                  loading={loading}
                  disabled={!email}
                >
                  Send reset link
                </Button>
              </FormLayout>
            </form>

            <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="400">
              <Text variant="bodyMd" alignment="center">
                Remember your password?{' '}
                <RouterLink to="/login">
                  <Button variant="plain">Sign in</Button>
                </RouterLink>
              </Text>
            </Box>
          </BlockStack>
        </Card>
      </Box>
    </Page>
  );
}
