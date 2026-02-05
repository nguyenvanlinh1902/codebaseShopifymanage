import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  TextField,
  FormLayout,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Text
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Google Sheets Management Page
 */
export default function Sheets() {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: window.location.origin + '/oauth/callback',
    spreadsheetId: '',
    name: ''
  });
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [step, setStep] = useState(1); // 1: credentials, 2: authorize, 3: connect
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSheets();
  }, []);

  const fetchSheets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sheets?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setSheets(result.data);
      }
    } catch (err) {
      console.error('Error fetching sheets:', err);
      setError('Failed to fetch sheets');
    } finally {
      setLoading(false);
    }
  };

  const handleModalOpen = useCallback(() => {
    setModalActive(true);
    setStep(1);
    setAuthUrl('');
    setAuthCode('');
    setError(null);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalActive(false);
    setFormData({
      clientId: '',
      clientSecret: '',
      redirectUri: window.location.origin + '/oauth/callback',
      spreadsheetId: '',
      name: ''
    });
    setStep(1);
    setAuthUrl('');
    setAuthCode('');
    setError(null);
  }, []);

  const handleGetAuthUrl = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/sheets/auth-url', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          redirectUri: formData.redirectUri
        })
      });

      const result = await response.json();

      if (result.success) {
        setAuthUrl(result.data.authUrl);
        setStep(2);
      } else {
        setError(result.error || 'Failed to generate auth URL');
      }
    } catch (err) {
      console.error('Error getting auth URL:', err);
      setError('Failed to generate auth URL');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnect = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/sheets/connect', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          code: authCode,
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          redirectUri: formData.redirectUri,
          spreadsheetId: formData.spreadsheetId,
          name: formData.name
        })
      });

      const result = await response.json();

      if (result.success) {
        await fetchSheets();
        handleModalClose();
      } else {
        setError(result.error || 'Failed to connect sheet');
      }
    } catch (err) {
      console.error('Error connecting sheet:', err);
      setError('Failed to connect sheet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sheetId) => {
    if (!confirm('Are you sure you want to disconnect this sheet?')) return;

    try {
      const response = await fetch(`/api/sheets/${sheetId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await fetchSheets();
      } else {
        alert(result.error || 'Failed to delete sheet');
      }
    } catch (err) {
      console.error('Error deleting sheet:', err);
      alert('Failed to delete sheet');
    }
  };

  const rows = sheets.map(sheet => [
    sheet.name,
    sheet.spreadsheetId,
    sheet.sheets?.length || 0,
    <Button size="slim" tone="critical" onClick={() => handleDelete(sheet.id)}>
      Disconnect
    </Button>
  ]);

  return (
    <Page
      title="Google Sheets"
      subtitle="Manage your connected Google Sheets"
      primaryAction={{
        content: 'Connect Sheet',
        onAction: handleModalOpen
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : sheets.length === 0 ? (
              <EmptyState
                heading="No sheets connected"
                action={{content: 'Connect Sheet', onAction: handleModalOpen}}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Connect your first Google Sheet to start syncing data.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'text']}
                headings={['Name', 'Spreadsheet ID', 'Sheets', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalActive}
        onClose={handleModalClose}
        title="Connect Google Sheet"
        primaryAction={
          step === 1
            ? {
                content: 'Next',
                onAction: handleGetAuthUrl,
                loading: submitting
              }
            : step === 2
            ? {
                content: 'Next',
                onAction: () => setStep(3)
              }
            : {
                content: 'Connect',
                onAction: handleConnect,
                loading: submitting
              }
        }
        secondaryActions={[
          {
            content: step === 1 ? 'Cancel' : 'Back',
            onAction: step === 1 ? handleModalClose : () => setStep(step - 1)
          }
        ]}
      >
        <Modal.Section>
          {step === 1 && (
            <FormLayout>
              <Text variant="bodyMd" as="p">
                Step 1: Enter your Google OAuth credentials
              </Text>
              <TextField
                label="Client ID"
                value={formData.clientId}
                onChange={value => setFormData({...formData, clientId: value})}
                placeholder="xxxxx.apps.googleusercontent.com"
                required
              />
              <TextField
                label="Client Secret"
                value={formData.clientSecret}
                onChange={value => setFormData({...formData, clientSecret: value})}
                type="password"
                required
              />
              <TextField
                label="Redirect URI"
                value={formData.redirectUri}
                onChange={value => setFormData({...formData, redirectUri: value})}
                helpText="This must match your OAuth redirect URI in Google Console"
              />
            </FormLayout>
          )}

          {step === 2 && (
            <div>
              <Text variant="bodyMd" as="p">
                Step 2: Authorize Google Sheets access
              </Text>
              <div style={{marginTop: '16px', marginBottom: '16px'}}>
                <Button url={authUrl} external>
                  Open Authorization Page
                </Button>
              </div>
              <Text variant="bodySm" as="p" tone="subdued">
                Click the button above to authorize access. After authorizing, copy the code from
                the URL and proceed to the next step.
              </Text>
            </div>
          )}

          {step === 3 && (
            <FormLayout>
              <Text variant="bodyMd" as="p">
                Step 3: Complete connection
              </Text>
              <TextField
                label="Authorization Code"
                value={authCode}
                onChange={setAuthCode}
                placeholder="Paste the code from the redirect URL"
                required
              />
              <TextField
                label="Spreadsheet ID"
                value={formData.spreadsheetId}
                onChange={value => setFormData({...formData, spreadsheetId: value})}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                helpText="Found in the Google Sheets URL"
                required
              />
              <TextField
                label="Name (optional)"
                value={formData.name}
                onChange={value => setFormData({...formData, name: value})}
                placeholder="My Products Sheet"
              />
            </FormLayout>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
