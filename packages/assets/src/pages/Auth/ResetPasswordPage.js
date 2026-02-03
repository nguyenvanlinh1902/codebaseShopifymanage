import React, {useState, useCallback, useEffect} from 'react';
import {useHistory, useLocation, Link as RouterLink} from 'react-router-dom';
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
 * Reset password page (accessed via email link)
 */
export default function ResetPasswordPage() {
  const history = useHistory();
  const location = useLocation();
  const {resetPassword} = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState('');

  // Extract reset code from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('oobCode');
    if (code) {
      setOobCode(code);
    } else {
      setError('Invalid or missing reset code. Please request a new password reset link.');
    }
  }, [location.search]);

  const validatePassword = useCallback(pwd => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  }, []);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');

      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);
      const result = await resetPassword(oobCode, password);
      setLoading(false);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    },
    [password, confirmPassword, oobCode, resetPassword, validatePassword]
  );

  if (success) {
    return (
      <Page narrowWidth>
        <Box paddingBlockStart="1000">
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingLg" as="h1" alignment="center">
                  Password reset successful
                </Text>
                <Text variant="bodyMd" tone="subdued" alignment="center">
                  Your password has been changed. You can now sign in with your new password.
                </Text>
              </BlockStack>

              <Banner tone="success">Your password has been reset successfully.</Banner>

              <RouterLink to="/login">
                <Button variant="primary" fullWidth>
                  Sign in
                </Button>
              </RouterLink>
            </BlockStack>
          </Card>
        </Box>
      </Page>
    );
  }

  if (!oobCode) {
    return (
      <Page narrowWidth>
        <Box paddingBlockStart="1000">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h1" alignment="center">
                Invalid reset link
              </Text>

              <Banner tone="critical">{error}</Banner>

              <RouterLink to="/forgot-password">
                <Button variant="primary" fullWidth>
                  Request new reset link
                </Button>
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
                Set new password
              </Text>
              <Text variant="bodyMd" tone="subdued" alignment="center">
                Enter your new password below
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
                  label="New password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  autoFocus
                  disabled={loading}
                  helpText="At least 8 characters with uppercase, lowercase, and number"
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  disabled={loading}
                  error={
                    confirmPassword && password !== confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                />
                <Button
                  variant="primary"
                  submit
                  fullWidth
                  loading={loading}
                  disabled={!password || !confirmPassword}
                >
                  Reset password
                </Button>
              </FormLayout>
            </form>
          </BlockStack>
        </Card>
      </Box>
    </Page>
  );
}
