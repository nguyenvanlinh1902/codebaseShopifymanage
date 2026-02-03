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
 * Registration page for new team members
 */
export default function RegisterPage() {
  const history = useHistory();
  const location = useLocation();
  const {register, loading} = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [invitationToken, setInvitationToken] = useState('');

  // Check for invitation token in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const inviteEmail = params.get('email');

    if (token) {
      setInvitationToken(token);
    }
    if (inviteEmail) {
      setEmail(inviteEmail);
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

      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      const result = await register({
        email,
        password,
        name,
        invitationToken: invitationToken || undefined
      });

      if (result.success) {
        history.push('/tickets');
      } else {
        setError(result.error);
      }
    },
    [name, email, password, confirmPassword, invitationToken, register, history, validatePassword]
  );

  const isFormValid = name && email && password && confirmPassword;

  return (
    <Page narrowWidth>
      <Box paddingBlockStart="1000">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h1" alignment="center">
                Create your account
              </Text>
              <Text variant="bodyMd" tone="subdued" alignment="center">
                {invitationToken
                  ? 'Complete your registration to join the team'
                  : 'Get started with Chatty helpdesk'}
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
                  label="Full name"
                  type="text"
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                  autoFocus
                  disabled={loading}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  disabled={loading || !!invitationToken}
                  helpText={invitationToken ? 'Email is pre-filled from your invitation' : undefined}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  disabled={loading}
                  helpText="At least 8 characters with uppercase, lowercase, and number"
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  disabled={loading}
                  error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
                />
                <Button
                  variant="primary"
                  submit
                  fullWidth
                  loading={loading}
                  disabled={!isFormValid}
                >
                  Create account
                </Button>
              </FormLayout>
            </form>

            <Box borderBlockStartWidth="025" borderColor="border" paddingBlockStart="400">
              <Text variant="bodyMd" alignment="center">
                Already have an account?{' '}
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
