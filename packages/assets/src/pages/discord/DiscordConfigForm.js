import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Card, FormLayout, TextField, Button, InlineStack, Banner, BlockStack, Text} from '@shopify/polaris';

/**
 * Discord bot configuration form with save/test actions
 */
export default function DiscordConfigForm({config, onSave, onTest, loading}) {
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // Sync channelId when config loads
  useEffect(() => {
    if (config?.channelId) setChannelId(config.channelId);
  }, [config?.channelId]);

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setTestResult(null);
      await onSave({botToken: botToken || undefined, channelId});
      setTestResult({success: true, message: 'Configuration saved successfully'});
      setBotToken(''); // Clear token field after save
    } catch (err) {
      setTestResult({success: false, message: err.message});
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);
      const result = await onTest();
      setTestResult({success: true, message: `Connected to #${result.channelName}. Test message sent!`});
    } catch (err) {
      setTestResult({success: false, message: err.message});
    } finally {
      setTestLoading(false);
    }
  };

  const canSave = channelId && (botToken || config?.hasToken);
  const canTest = config?.hasToken && config?.channelId;

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Discord Bot Configuration</Text>
        <Text as="p" tone="subdued" variant="bodySm">
          Create a Discord bot, add it to your server, and paste the token and channel ID below.
        </Text>

        <FormLayout>
          <TextField
            label="Bot Token"
            type="password"
            value={botToken}
            onChange={setBotToken}
            placeholder={config?.hasToken ? '••••••••••• (already saved)' : 'Paste your Discord bot token'}
            autoComplete="off"
            helpText={config?.hasToken ? 'Token is saved. Leave empty to keep current token.' : 'Required for first-time setup.'}
          />
          <TextField
            label="Channel ID"
            value={channelId}
            onChange={setChannelId}
            placeholder="Right-click channel → Copy Channel ID"
            autoComplete="off"
            helpText="The Discord channel where email notifications will be sent."
          />
        </FormLayout>

        <InlineStack gap="200">
          <Button onClick={handleSave} loading={saveLoading} variant="primary" disabled={!canSave || loading}>
            Save Config
          </Button>
          <Button onClick={handleTest} loading={testLoading} disabled={!canTest || loading}>
            Test Connection
          </Button>
        </InlineStack>

        {testResult && (
          <Banner tone={testResult.success ? 'success' : 'critical'} onDismiss={() => setTestResult(null)}>
            {testResult.message}
          </Banner>
        )}
      </BlockStack>
    </Card>
  );
}

DiscordConfigForm.propTypes = {
  config: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  loading: PropTypes.bool
};
