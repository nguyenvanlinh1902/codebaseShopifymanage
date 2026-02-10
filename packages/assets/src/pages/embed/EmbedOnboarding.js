import React, {useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  ProgressBar,
  Banner,
  Box,
  Icon,
  InlineGrid,
  Divider
} from '@shopify/polaris';
import {
  ProductIcon,
  OrderIcon,
  NoteIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@shopify/polaris-icons';
import {useNavigate} from 'react-router-dom';
import {api} from '../../helpers/api';
import {useGoogleAuth} from '../../hooks/useGoogleAuth';

const STEPS = [
  {key: 'welcome', title: 'Welcome', icon: CheckCircleIcon},
  {key: 'google', title: 'Google Account', icon: NoteIcon},
  {key: 'configure', title: 'Configure', icon: OrderIcon},
  {key: 'done', title: 'All Done', icon: CheckCircleIcon}
];

function StepIndicator({steps, currentStep}) {
  return (
    <InlineStack gap="200" align="center" blockAlign="center" wrap={false}>
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <InlineStack key={step.key} gap="200" blockAlign="center" wrap={false}>
            <Box
              background={isDone ? 'bg-fill-success' : isActive ? 'bg-fill-info' : 'bg-surface-secondary'}
              borderRadius="full"
              padding="100"
              minWidth="28px"
              minHeight="28px"
            >
              <InlineStack align="center" blockAlign="center">
                {isDone ? (
                  <Icon source={CheckCircleIcon} tone="text-inverse" />
                ) : (
                  <Text
                    variant="bodySm"
                    fontWeight="bold"
                    tone={isActive ? 'text-inverse' : 'subdued'}
                    alignment="center"
                  >
                    {i + 1}
                  </Text>
                )}
              </InlineStack>
            </Box>
            <Text
              variant="bodySm"
              fontWeight={isActive ? 'bold' : 'regular'}
              tone={isDone || isActive ? undefined : 'subdued'}
            >
              {step.title}
            </Text>
            {i < steps.length - 1 && (
              <Box paddingInlineStart="100" paddingInlineEnd="100">
                <Divider />
              </Box>
            )}
          </InlineStack>
        );
      })}
    </InlineStack>
  );
}

StepIndicator.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired
    })
  ).isRequired,
  currentStep: PropTypes.number.isRequired
};

function FeatureCard({icon, bg, title, description}) {
  return (
    <Card>
      <BlockStack gap="300">
        <Box background={bg} borderRadius="300" padding="200" maxWidth="fit-content">
          <Icon source={icon} />
        </Box>
        <Text variant="headingSm" as="h3" fontWeight="semibold">{title}</Text>
        <Text variant="bodySm" tone="subdued">{description}</Text>
      </BlockStack>
    </Card>
  );
}

FeatureCard.propTypes = {
  icon: PropTypes.func.isRequired,
  bg: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired
};

export default function EmbedOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const {authenticated: googleConnected, startAuth, checkAuth} = useGoogleAuth();

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleFinish = useCallback(async () => {
    try {
      await api('/api/embed/store/settings', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({onboardingCompleted: true})
      });
      navigate('/');
    } catch {
      navigate('/');
    }
  }, [navigate]);

  const handleConnectGoogle = useCallback(async () => {
    try {
      setError(null);
      await startAuth();
    } catch (err) {
      // user cancelled or auth failed — already handled by useGoogleAuth
    }
    await checkAuth();
  }, [startAuth, checkAuth]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h2">Welcome to ToolTrackingOrder!</Text>
              <Text tone="subdued">
                Powerful tools to manage your Shopify store. Let's get you set up in a few quick steps.
              </Text>
            </BlockStack>
            <InlineGrid columns={3} gap="400">
              <FeatureCard
                icon={ProductIcon}
                bg="bg-fill-info-secondary"
                title="Product Import"
                description="Bulk import products from CSV files directly to your store."
              />
              <FeatureCard
                icon={OrderIcon}
                bg="bg-fill-success-secondary"
                title="Order Sync"
                description="Automatically export orders to Google Sheets for tracking."
              />
              <FeatureCard
                icon={NoteIcon}
                bg="bg-fill-caution-secondary"
                title="Tracking Updates"
                description="Update fulfillment tracking info from your spreadsheets."
              />
            </InlineGrid>
          </BlockStack>
        );

      case 1:
        return (
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h2">Connect Google Account</Text>
              <Text tone="subdued">
                To sync orders to Google Sheets, connect your Google account. We only request access to Google Sheets.
              </Text>
            </BlockStack>
            {googleConnected ? (
              <Banner tone="success">Google account connected successfully!</Banner>
            ) : (
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="300" blockAlign="center">
                    <Box background="bg-fill-caution-secondary" borderRadius="300" padding="200">
                      <Icon source={NoteIcon} />
                    </Box>
                    <BlockStack gap="050">
                      <Text variant="headingSm" as="h3" fontWeight="semibold">Google Sheets Access</Text>
                      <Text variant="bodySm" tone="subdued">Only Sheets access is requested. No other data is accessed.</Text>
                    </BlockStack>
                  </InlineStack>
                  <Button variant="primary" onClick={handleConnectGoogle}>
                    Connect Google Account
                  </Button>
                </BlockStack>
              </Card>
            )}
            <Text variant="bodySm" tone="subdued">
              You can also skip this step and connect later from the Orders page.
            </Text>
          </BlockStack>
        );

      case 2:
        return (
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h2">Configure Your First Sync</Text>
              <Text tone="subdued">
                Follow these steps to start syncing orders to Google Sheets.
              </Text>
            </BlockStack>
            <Card>
              <BlockStack gap="300">
                {[
                  'Go to the Orders & Sheets page',
                  'Select a Google Sheet from the dropdown',
                  'Choose a tab within the sheet',
                  'Click Setup Sync to create the configuration',
                  'Click Sync Now to start your first sync'
                ].map((step, i) => (
                  <InlineStack key={i} gap="300" blockAlign="start" wrap={false}>
                    <Box
                      background="bg-fill-info-secondary"
                      borderRadius="full"
                      padding="100"
                      minWidth="24px"
                      minHeight="24px"
                    >
                      <InlineStack align="center">
                        <Text variant="bodySm" fontWeight="bold" alignment="center">{i + 1}</Text>
                      </InlineStack>
                    </Box>
                    <Text variant="bodyMd">{step}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
            <Banner tone="info">
              You can also import products from CSV on the Products page.
            </Banner>
          </BlockStack>
        );

      case 3:
        return (
          <BlockStack gap="500">
            <Box paddingBlockStart="400">
              <BlockStack gap="300" inlineAlign="center">
                <Box background="bg-fill-success-secondary" borderRadius="full" padding="400">
                  <Icon source={CheckCircleIcon} tone="success" />
                </Box>
                <Text variant="headingLg" as="h2" alignment="center">You're all set!</Text>
                <Text tone="subdued" alignment="center">
                  Your ToolTrackingOrder app is ready to use. Head to the Dashboard to get started.
                </Text>
                <Box paddingBlockStart="200">
                  <InlineStack align="center">
                    <Button variant="primary" size="large" onClick={handleFinish} icon={ArrowRightIcon}>
                      Go to Dashboard
                    </Button>
                  </InlineStack>
                </Box>
              </BlockStack>
            </Box>
          </BlockStack>
        );

      default:
        return null;
    }
  };

  return (
    <Page title="Setup Wizard">
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
        )}

        {/* Progress Header */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingSm" as="h3" fontWeight="semibold">
                Step {currentStep + 1} of {STEPS.length}
              </Text>
              <Text variant="bodySm" tone="subdued">{Math.round(progress)}% complete</Text>
            </InlineStack>
            <ProgressBar progress={progress} size="small" tone="primary" />
            <StepIndicator steps={STEPS} currentStep={currentStep} />
          </BlockStack>
        </Card>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        {currentStep < STEPS.length - 1 && (
          <InlineStack align="space-between">
            <Button onClick={handleBack} disabled={currentStep === 0}>Back</Button>
            <InlineStack gap="200">
              <Button onClick={handleFinish} variant="plain">Skip Setup</Button>
              <Button variant="primary" onClick={handleNext}>
                {currentStep === 0 ? 'Get Started' : 'Next'}
              </Button>
            </InlineStack>
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  );
}
