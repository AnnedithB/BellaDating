import SignInModal from 'components/SignInModal';
import { API_BASE_URL, getAuthToken, removeAuthToken } from 'config/api';
import { currencyFormat } from 'lib/utils';
// import { billingApi, plansApi, subscriptionsApi } from 'services/api';
import { Invoice, PaymentMethod, SubscriptionPlan, UserSubscription } from 'types/billing';

import { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import { Icon } from '@iconify/react';

import dayjs from 'dayjs';

// Hardcoded demo data - matching mobile app pricing
const DEMO_PLANS: SubscriptionPlan[] = [
  {
    id: 'premium_monthly',
    name: 'premium',
    displayName: 'Monthly Plan',
    description: 'Unlock all premium features',
    monthlyPrice: 19.99, // Web price
    yearlyPrice: 99.99, // 6 months price (web)
    yearlyDiscount: 17,
    features: [
      'Unlimited matches',
      'See who likes you',
      'Advanced filters',
      'Priority in queue',
      'Read receipts',
      'No ads',
      'Profile visibility boost',
    ],
    limits: { matches_per_day: -1, messages_per_day: -1 },
    isActive: true,
  },
  {
    id: 'premium_6months',
    name: 'premium',
    displayName: '6 Months Plan',
    description: 'Unlock all premium features',
    monthlyPrice: 19.99,
    yearlyPrice: 99.99, // 6 months price
    yearlyDiscount: 17,
    features: [
      'Unlimited matches',
      'See who likes you',
      'Advanced filters',
      'Priority in queue',
      'Read receipts',
      'No ads',
      'Profile visibility boost',
    ],
    limits: { matches_per_day: -1, messages_per_day: -1 },
    isActive: true,
  },
];

const DEMO_SUBSCRIPTION: UserSubscription = {
  id: 'sub_1',
  userId: 'user_1',
  planId: 'premium_monthly',
  plan: DEMO_PLANS[0],
  status: 'ACTIVE',
  billingCycle: 'MONTHLY',
  currentPrice: 19.99,
  currency: 'USD',
  startedAt: '2024-01-01T00:00:00Z',
  currentPeriodStart: '2024-12-01T00:00:00Z',
  currentPeriodEnd: '2025-01-01T00:00:00Z',
  isTrialActive: false,
  autoRenew: true,
};

const DEMO_INVOICES: Invoice[] = [
  {
    id: 'inv_1',
    subscriptionId: 'sub_1',
    userId: 'user_1',
    invoiceNumber: 'INV-2024-012',
    status: 'PAID',
    subtotal: 19.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 19.99,
    currency: 'USD',
    periodStart: '2024-12-01T00:00:00Z',
    periodEnd: '2025-01-01T00:00:00Z',
    dueDate: '2024-12-01T00:00:00Z',
    paidAt: '2024-12-01T00:00:00Z',
    lineItems: [{ description: 'Premium Plan - Monthly', amount: 19.99, quantity: 1 }],
  },
  {
    id: 'inv_2',
    subscriptionId: 'sub_1',
    userId: 'user_1',
    invoiceNumber: 'INV-2024-011',
    status: 'PAID',
    subtotal: 19.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 19.99,
    currency: 'USD',
    periodStart: '2024-11-01T00:00:00Z',
    periodEnd: '2024-12-01T00:00:00Z',
    dueDate: '2024-11-01T00:00:00Z',
    paidAt: '2024-11-01T00:00:00Z',
    lineItems: [{ description: 'Premium Plan - Monthly', amount: 19.99, quantity: 1 }],
  },
  {
    id: 'inv_3',
    subscriptionId: 'sub_1',
    userId: 'user_1',
    invoiceNumber: 'INV-2024-010',
    status: 'PAID',
    subtotal: 19.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 19.99,
    currency: 'USD',
    periodStart: '2024-10-01T00:00:00Z',
    periodEnd: '2024-11-01T00:00:00Z',
    dueDate: '2024-10-01T00:00:00Z',
    paidAt: '2024-10-01T00:00:00Z',
    lineItems: [{ description: 'Premium Plan - Monthly', amount: 19.99, quantity: 1 }],
  },
  {
    id: 'inv_4',
    subscriptionId: 'sub_1',
    userId: 'user_1',
    invoiceNumber: 'INV-2024-009',
    status: 'PAID',
    subtotal: 19.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 19.99,
    currency: 'USD',
    periodStart: '2024-09-01T00:00:00Z',
    periodEnd: '2024-10-01T00:00:00Z',
    dueDate: '2024-09-01T00:00:00Z',
    paidAt: '2024-09-01T00:00:00Z',
    lineItems: [{ description: 'Premium Plan - Monthly', amount: 19.99, quantity: 1 }],
  },
  {
    id: 'inv_5',
    subscriptionId: 'sub_1',
    userId: 'user_1',
    invoiceNumber: 'INV-2024-008',
    status: 'PAID',
    subtotal: 19.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 19.99,
    currency: 'USD',
    periodStart: '2024-08-01T00:00:00Z',
    periodEnd: '2024-09-01T00:00:00Z',
    dueDate: '2024-08-01T00:00:00Z',
    paidAt: '2024-08-01T00:00:00Z',
    lineItems: [{ description: 'Premium Plan - Monthly', amount: 19.99, quantity: 1 }],
  },
];

const DEMO_PAYMENT_METHOD: PaymentMethod = {
  id: 'pm_1',
  userId: 'user_1',
  type: 'card',
  cardBrand: 'visa',
  cardLast4: '4242',
  cardExpMonth: 12,
  cardExpYear: 2025,
  isDefault: true,
  isActive: true,
  billingDetails: {
    name: 'John Doe',
    email: 'john@example.com',
    address: '123 Main St',
    city: 'New York',
    country: 'US',
    zipCode: '10001',
  },
};

const Billing = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingFilter, setBillingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Using hardcoded data for demo (show data even when not authenticated for demo purposes)
  const monthlyPlan = DEMO_PLANS[0];
  const sixMonthPlan = DEMO_PLANS[1];
  const subscription = isAuthenticated ? DEMO_SUBSCRIPTION : null;
  const invoices = DEMO_INVOICES; // Show invoices even when not authenticated for demo
  const paymentMethod = isAuthenticated ? DEMO_PAYMENT_METHOD : null;

  useEffect(() => {
    // Check if user is already authenticated
    const token = getAuthToken();
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSignIn = () => {
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    removeAuthToken();
    setIsAuthenticated(false);
  };

  const handleStripeCheckout = async (planId: string, billingCycle: 'MONTHLY' | 'SIXMONTH') => {
    if (!isAuthenticated) {
      setShowSignInModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Authentication Required: Please sign in to continue.');
        setShowSignInModal(true);
        return;
      }

      // Create Stripe checkout session
      const response = await fetch(`${API_BASE_URL}/api/subscriptions/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: planId === 'premium_monthly' ? 'premium_plan_001' : 'premium_plan_001', // Use actual plan ID from backend
          billingCycle: billingCycle,
          successUrl: `${window.location.origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/?canceled=true`,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to create checkout session' }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.data.url;
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      alert(
        `Payment Error: ${error instanceof Error ? error.message : 'Failed to start payment process. Please try again.'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'PAID':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
      case 'CANCELED':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      billingFilter === 'all' ||
      (billingFilter === 'active' && invoice.status === 'PAID') ||
      (billingFilter === 'archived' && invoice.status !== 'PAID');
    return matchesSearch && matchesFilter;
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Black Header */}
      <Box
        sx={{
          bgcolor: '#000000',
          color: '#FFFFFF',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600} color="inherit">
              Welcome back, {isAuthenticated ? 'User' : 'Guest'}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="text"
                sx={{
                  color: '#FFFFFF',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                Need help?
              </Button>
              {isAuthenticated ? (
                <Button
                  variant="outlined"
                  onClick={handleSignOut}
                  startIcon={<Icon icon="mdi:logout" />}
                  sx={{
                    color: '#FFFFFF',
                    borderColor: '#FFFFFF',
                    '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                  }}
                >
                  Sign out
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => setShowSignInModal(true)}
                  startIcon={<Icon icon="mdi:login" />}
                  sx={{
                    bgcolor: '#FFFFFF',
                    color: '#000000',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' },
                  }}
                >
                  Sign in
                </Button>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={4}>
          {/* Header Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Box>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Plans & billing
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage your plan and billing history here.
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Plans Section - Side by Side */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
            }}
          >
            {/* Monthly Plan */}
            <Card
              sx={{
                position: 'relative',
                border: subscription?.planId === 'premium_monthly' ? 2 : 1,
                borderColor: subscription?.planId === 'premium_monthly' ? '#000000' : 'divider',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)',
                },
              }}
            >
              {subscription?.planId === 'premium_monthly' && (
                <Chip
                  label="Current plan"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 1,
                    bgcolor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
              )}
              <CardContent
                sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, minHeight: 0 }}
              >
                <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <Typography variant="h5" fontWeight={600}>
                        Monthly Plan
                      </Typography>
                      <Icon icon="mdi:information-outline" width={20} color="#999" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Unlock all premium features
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="h3" fontWeight={700}>
                      {currencyFormat(monthlyPlan.monthlyPrice, 'en-US', { currency: 'USD' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      per month
                    </Typography>
                  </Box>

                  <Divider />

                  <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
                    {monthlyPlan.features.map((feature, idx) => (
                      <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                        <Icon
                          icon="mdi:check-circle"
                          color="#000000"
                          width={20}
                          style={{ marginTop: 2 }}
                        />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {feature}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>

                  <Button
                    variant={subscription?.planId === 'premium_monthly' ? 'outlined' : 'contained'}
                    fullWidth
                    disabled={subscription?.planId === 'premium_monthly' || isProcessing}
                    onClick={() => handleStripeCheckout('premium_monthly', 'MONTHLY')}
                    sx={{
                      mt: 'auto',
                      flexShrink: 0,
                      bgcolor:
                        subscription?.planId === 'premium_monthly' ? 'transparent' : '#000000',
                      color: subscription?.planId === 'premium_monthly' ? '#000000' : '#FFFFFF',
                      borderColor: '#000000',
                      '&:hover': {
                        bgcolor:
                          subscription?.planId === 'premium_monthly'
                            ? 'rgba(0, 0, 0, 0.05)'
                            : '#000000',
                      },
                    }}
                  >
                    {subscription?.planId === 'premium_monthly'
                      ? 'Current plan'
                      : isProcessing
                        ? 'Processing...'
                        : 'Switch to this plan'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* 6 Months Plan */}
            <Card
              sx={{
                position: 'relative',
                border: subscription?.planId === 'premium_6months' ? 2 : 1,
                borderColor: subscription?.planId === 'premium_6months' ? '#000000' : 'divider',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <Chip
                label="Save 17%"
                color="success"
                size="small"
                sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
              />
              {subscription?.planId === 'premium_6months' && (
                <Chip
                  label="Current plan"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 48,
                    right: 16,
                    zIndex: 1,
                    bgcolor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
              )}
              <CardContent
                sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, minHeight: 0 }}
              >
                <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <Typography variant="h5" fontWeight={600}>
                        6 Months Plan
                      </Typography>
                      <Icon icon="mdi:information-outline" width={20} color="#999" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Unlock all premium features
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="h3" fontWeight={700}>
                      {currencyFormat(sixMonthPlan.yearlyPrice, 'en-US', { currency: 'USD' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      per 6 months
                    </Typography>
                    <Typography
                      variant="caption"
                      color="success.main"
                      sx={{ mt: 0.5, display: 'block' }}
                    >
                      Save ${(monthlyPlan.monthlyPrice * 6 - sixMonthPlan.yearlyPrice).toFixed(2)}{' '}
                      compared to monthly
                    </Typography>
                  </Box>

                  <Divider />

                  <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
                    {sixMonthPlan.features.map((feature, idx) => (
                      <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                        <Icon
                          icon="mdi:check-circle"
                          color="#000000"
                          width={20}
                          style={{ marginTop: 2 }}
                        />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {feature}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>

                  <Button
                    variant={subscription?.planId === 'premium_6months' ? 'outlined' : 'contained'}
                    fullWidth
                    disabled={subscription?.planId === 'premium_6months' || isProcessing}
                    onClick={() => handleStripeCheckout('premium_6months', 'SIXMONTH')}
                    sx={{
                      mt: 'auto',
                      flexShrink: 0,
                      bgcolor:
                        subscription?.planId === 'premium_6months' ? 'transparent' : '#000000',
                      color: subscription?.planId === 'premium_6months' ? '#000000' : '#FFFFFF',
                      borderColor: '#000000',
                      '&:hover': {
                        bgcolor:
                          subscription?.planId === 'premium_6months'
                            ? 'rgba(0, 0, 0, 0.05)'
                            : '#000000',
                      },
                    }}
                  >
                    {subscription?.planId === 'premium_6months'
                      ? 'Current plan'
                      : isProcessing
                        ? 'Processing...'
                        : 'Switch to this plan'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Current Subscription & Payment Method */}
          {isAuthenticated && subscription && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              {/* Current Subscription Card */}
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={600}>
                        Current Subscription
                      </Typography>
                      <Chip
                        label={subscription.status}
                        color={getStatusColor(subscription.status) as any}
                        size="small"
                      />
                    </Stack>
                    <Divider />
                    <Box>
                      <Typography variant="h4" fontWeight={700}>
                        {currencyFormat(subscription.currentPrice, 'en-US', {
                          currency: subscription.currency,
                        })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        per {subscription.billingCycle === 'MONTHLY' ? 'month' : '6 months'}
                      </Typography>
                    </Box>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Next billing date
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {dayjs(subscription.currentPeriodEnd).format('MMM D, YYYY')}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Auto-renewal
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {subscription.autoRenew ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Payment Method Card */}
              {paymentMethod && (
                <Card sx={{ flex: 1 }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h6" fontWeight={600}>
                        Payment Method
                      </Typography>
                      <Divider />
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 56,
                            height: 36,
                            borderRadius: 1,
                            bgcolor: 'background.elevation2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon icon="logos:visa" width={40} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body1" fontWeight={500}>
                              Visa ending in {paymentMethod.cardLast4}
                            </Typography>
                            {paymentMethod.isDefault && (
                              <Chip label="Default" size="small" color="primary" />
                            )}
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            Expires {paymentMethod.cardExpMonth}/{paymentMethod.cardExpYear}
                          </Typography>
                        </Box>
                        <Button variant="outlined" size="small">
                          Edit
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}

          {/* Billing History */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Billing history
            </Typography>

            {/* Filters and Search */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              mb={3}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Tabs
                value={billingFilter}
                onChange={(_, newValue) => setBillingFilter(newValue)}
                sx={{
                  minHeight: 'auto',
                  '& .MuiTab-root': {
                    minHeight: 'auto',
                    py: 1,
                    px: 2,
                    textTransform: 'none',
                    fontSize: '0.875rem',
                  },
                }}
              >
                <Tab label="View all" value="all" />
                <Tab label="Active" value="active" />
                <Tab label="Archived" value="archived" />
              </Tabs>

              <Stack direction="row" spacing={2} sx={{ flex: 1, justifyContent: 'flex-end' }}>
                <TextField
                  placeholder="Search"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon icon="mdi:magnify" width={20} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ maxWidth: 300 }}
                />
                <Button variant="outlined" startIcon={<Icon icon="mdi:download" />}>
                  Download all
                </Button>
              </Stack>
            </Stack>

            {filteredInvoices.length === 0 ? (
              <Alert severity="info">No invoices found matching your criteria.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Invoice
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={600}>
                            Billing date
                          </Typography>
                          <Icon icon="mdi:chevron-down" width={16} />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Amount
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Plan
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Status
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" fontWeight={600}>
                          Actions
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Icon icon="mdi:file-pdf-box" width={20} color="#000000" />
                            <Typography variant="body2" fontWeight={500}>
                              {invoice.invoiceNumber}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {dayjs(invoice.paidAt || invoice.dueDate).format('MMM D, YYYY')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {currencyFormat(invoice.totalAmount, 'en-US', {
                              currency: invoice.currency,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {subscription?.plan.displayName || 'Premium Plan'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.status}
                            color={getStatusColor(invoice.status) as any}
                            size="small"
                            icon={<Icon icon="mdi:check" width={16} />}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small">
                            <Icon icon="mdi:download" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Stack>
      </Container>

      <SignInModal
        open={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSignIn={handleSignIn}
      />
    </Box>
  );
};

export default Billing;
