import React, {useState} from 'react';
import {Card, FormLayout, TextField, Button, Banner, Text, InlineStack} from '@shopify/polaris';
import {ViewIcon, HideIcon} from '@shopify/polaris-icons';
import {useAuth} from '../context/AuthContext';

export default function Login() {
  const {login} = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      handleSubmit();
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
      <div style={{width: '100%', maxWidth: '420px', padding: '20px'}}>
        <div style={{textAlign: 'center', marginBottom: '24px'}}>
          <Text variant="headingXl" as="h1">
            Tool Tracking Order
          </Text>
          <div style={{marginTop: '8px'}}>
            <Text variant="bodySm" as="p" tone="subdued">
              Sign in to continue
            </Text>
          </div>
        </div>

        {error && (
          <div style={{marginBottom: '16px'}}>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </div>
        )}

        <Card>
          <div onKeyDown={handleKeyDown}>
            <FormLayout>
              <TextField
                label="Username"
                value={username}
                onChange={setUsername}
                autoComplete="username"
                autoFocus
              />
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                suffix={
                  <InlineStack>
                    <Button
                      icon={showPassword ? HideIcon : ViewIcon}
                      variant="plain"
                      onClick={() => setShowPassword(!showPassword)}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    />
                  </InlineStack>
                }
              />
              <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>
                Sign in
              </Button>
            </FormLayout>
          </div>
        </Card>
      </div>
    </div>
  );
}
