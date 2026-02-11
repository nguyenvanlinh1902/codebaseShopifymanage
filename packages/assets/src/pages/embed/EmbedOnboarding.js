import React, {useState, useCallback} from 'react';
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  ProgressBar,
  Banner
} from '@shopify/polaris';
import {ProductIcon, OrderIcon, NoteIcon, CheckCircleIcon} from '@shopify/polaris-icons';
import {useNavigate} from 'react-router-dom';
import {api} from '../../helpers/api';
import {useGoogleAuth} from '../../hooks/useGoogleAuth';
import {StepIndicator, WelcomeStep, GoogleStep, ConfigureStep, DoneStep} from './embed-onboarding';

const STEPS = [
  {key: 'welcome', title: 'Welcome', icon: CheckCircleIcon},
  {key: 'google', title: 'Google Account', icon: NoteIcon},
  {key: 'configure', title: 'Configure', icon: OrderIcon},
  {key: 'done', title: 'All Done', icon: CheckCircleIcon}
];

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
        return <WelcomeStep />;
      case 1:
        return (
          <GoogleStep googleConnected={googleConnected} onConnectGoogle={handleConnectGoogle} />
        );
      case 2:
        return <ConfigureStep />;
      case 3:
        return <DoneStep onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <Page title="Setup Wizard">
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {/* Progress Header */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingSm" as="h3" fontWeight="semibold">
                Step {currentStep + 1} of {STEPS.length}
              </Text>
              <Text variant="bodySm" tone="subdued">
                {Math.round(progress)}% complete
              </Text>
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
            <Button onClick={handleBack} disabled={currentStep === 0}>
              Back
            </Button>
            <InlineStack gap="200">
              <Button onClick={handleFinish} variant="plain">
                Skip Setup
              </Button>
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
