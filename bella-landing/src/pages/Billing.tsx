import SignInModal from 'components/SignInModal';
import { API_BASE_URL, getAuthToken, removeAuthToken } from 'config/api';
import { currencyFormat } from 'lib/utils';
import { billingApi, plansApi, subscriptionsApi } from 'services/api';
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

const Billing = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingFilter, setBillingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Real data states
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Loading states
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plans on mount (public endpoint) - only web pricing plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        setError(null);
        const fetchedPlans = await plansApi.getAll();
        // Filter to only show web pricing plans (plans with '_web' in name)
        const webPlans = fetchedPlans.filter((plan) => plan.name.includes('_web'));
        setPlans(webPlans);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to load subscription plans. Please try again later.';
        setError(errorMessage);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  // Check authentication and fetch user data, handle URL parameters from mobile app
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Token is already handled by getAuthToken() in config/api.ts, which stores it
    const token = getAuthToken();
    if (token) {
      setIsAuthenticated(true);
      fetchUserData();
    } else {
      setIsAuthenticated(false);
      setSubscription(null);
      setInvoices([]);
      setPaymentMethods([]);
    }

    // Handle plan selection from URL (if passed from mobile app)
    const planIdFromUrl = urlParams.get('planId');
    const billingCycleFromUrl = urlParams.get('billingCycle');
    if (planIdFromUrl && billingCycleFromUrl && token) {
      // Auto-select the plan if coming from mobile app
      // This could trigger auto-checkout or just highlight the plan
      // For now, we'll just ensure the user is authenticated and can see the plans
    }
  }, []);

  // Refetch user data when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserData();
    }
  }, [isAuthenticated]);

  const fetchUserData = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      // Fetch subscription
      setLoadingSubscription(true);
      const currentSubscription = await subscriptionsApi.getCurrent();
      setSubscription(currentSubscription);

      // Fetch invoices (backend max limit is 50)
      setLoadingInvoices(true);
      const invoicesData = await billingApi.getInvoices(1, 50);
      setInvoices(invoicesData.data);

      // Fetch payment methods
      setLoadingPaymentMethods(true);
      const paymentMethodsData = await billingApi.getPaymentMethods();
      setPaymentMethods(paymentMethodsData);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      setError('Failed to load your subscription data. Please try again.');
    } finally {
      setLoadingSubscription(false);
      setLoadingInvoices(false);
      setLoadingPaymentMethods(false);
    }
  };

  const handleSignIn = () => {
    setIsAuthenticated(true);
    fetchUserData();
  };

  const handleSignOut = () => {
    removeAuthToken();
    setIsAuthenticated(false);
  };

  const handleStripeCheckout = async (
    planId: string,
    billingCycle: 'MONTHLY' | 'SIXMONTH' | 'YEARLY'
  ) => {
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

      // Find the plan by ID first, then fallback to matching by billing cycle
      let selectedPlan = plans.find((p) => p.id === planId);

      if (!selectedPlan) {
        // Fallback: try to find by billing cycle
        selectedPlan = plans.find((p) => {
          if (billingCycle === 'MONTHLY') {
            return (
              p.displayName.toLowerCase().includes('monthly') ||
              (p.monthlyPrice > 0 &&
                !p.displayName.toLowerCase().includes('6') &&
                !p.displayName.toLowerCase().includes('year'))
            );
          } else {
            return (
              p.displayName.toLowerCase().includes('6') ||
              p.displayName.toLowerCase().includes('year') ||
              p.displayName.toLowerCase().includes('yearly')
            );
          }
        });
      }

      if (!selectedPlan) {
        throw new Error('Selected plan not found');
      }

      // Create Stripe checkout session
      const response = await fetch(`${API_BASE_URL}/api/subscriptions/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          billingCycle: billingCycle,
          successUrl: `${window.location.origin}/?session_id={CHECKOUT_SESSION_ID}`,
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

  // Get monthly and 6-month plans from fetched plans
  const monthlyPlan =
    plans.find(
      (p) =>
        p.displayName.toLowerCase().includes('monthly') ||
        (p.monthlyPrice > 0 &&
          !p.displayName.toLowerCase().includes('6') &&
          !p.displayName.toLowerCase().includes('year') &&
          !p.displayName.toLowerCase().includes('yearly'))
    ) || plans[0];

  const sixMonthPlan =
    plans.find(
      (p) =>
        p.displayName.toLowerCase().includes('6') ||
        p.displayName.toLowerCase().includes('year') ||
        p.displayName.toLowerCase().includes('yearly')
    ) ||
    plans[1] ||
    plans[0];

  const defaultPaymentMethod =
    paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null;

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

          {/* Error Message */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Plans Section - Side by Side */}
          {loadingPlans ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Typography>Loading plans...</Typography>
            </Box>
          ) : plans.length === 0 ? (
            <Alert severity="info">No subscription plans available.</Alert>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: plans.length >= 2 ? '1fr 1fr' : '1fr' },
                gap: 3,
              }}
            >
              {/* Monthly Plan */}
              {monthlyPlan && (
                <Card
                  sx={{
                    position: 'relative',
                    border: subscription?.planId === monthlyPlan.id ? 2 : 1,
                    borderColor: subscription?.planId === monthlyPlan.id ? '#000000' : 'divider',
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
                  {subscription?.planId === monthlyPlan.id && (
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
                            {monthlyPlan.displayName}
                          </Typography>
                          <Icon icon="mdi:information-outline" width={20} color="#999" />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {monthlyPlan.description || 'Unlock all premium features'}
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
                        {monthlyPlan.features && monthlyPlan.features.length > 0 ? (
                          monthlyPlan.features.map((feature, idx) => (
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
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No features listed
                          </Typography>
                        )}
                      </Stack>

                      <Button
                        variant={subscription?.planId === monthlyPlan.id ? 'outlined' : 'contained'}
                        fullWidth
                        disabled={subscription?.planId === monthlyPlan.id || isProcessing}
                        onClick={() => handleStripeCheckout(monthlyPlan.id, 'MONTHLY')}
                        sx={{
                          mt: 'auto',
                          flexShrink: 0,
                          bgcolor:
                            subscription?.planId === monthlyPlan.id ? 'transparent' : '#000000',
                          color: subscription?.planId === monthlyPlan.id ? '#000000' : '#FFFFFF',
                          borderColor: '#000000',
                          '&:hover': {
                            bgcolor:
                              subscription?.planId === monthlyPlan.id
                                ? 'rgba(0, 0, 0, 0.05)'
                                : '#000000',
                          },
                        }}
                      >
                        {subscription?.planId === monthlyPlan.id
                          ? 'Current plan'
                          : isProcessing
                            ? 'Processing...'
                            : 'Switch to this plan'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* 6 Months/Yearly Plan */}
              {sixMonthPlan && sixMonthPlan.id !== monthlyPlan?.id && (
                <Card
                  sx={{
                    position: 'relative',
                    border: subscription?.planId === sixMonthPlan.id ? 2 : 1,
                    borderColor: subscription?.planId === sixMonthPlan.id ? '#000000' : 'divider',
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
                  {sixMonthPlan.yearlyDiscount > 0 && (
                    <Chip
                      label={`Save ${sixMonthPlan.yearlyDiscount}%`}
                      color="success"
                      size="small"
                      sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
                    />
                  )}
                  {subscription?.planId === sixMonthPlan.id && (
                    <Chip
                      label="Current plan"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: sixMonthPlan.yearlyDiscount > 0 ? 48 : 16,
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
                            {sixMonthPlan.displayName}
                          </Typography>
                          <Icon icon="mdi:information-outline" width={20} color="#999" />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {sixMonthPlan.description || 'Unlock all premium features'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="h3" fontWeight={700}>
                          {currencyFormat(sixMonthPlan.yearlyPrice, 'en-US', { currency: 'USD' })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          per{' '}
                          {sixMonthPlan.displayName.toLowerCase().includes('year')
                            ? 'year'
                            : '6 months'}
                        </Typography>
                        {monthlyPlan && monthlyPlan.monthlyPrice > 0 && (
                          <Typography
                            variant="caption"
                            color="success.main"
                            sx={{ mt: 0.5, display: 'block' }}
                          >
                            Save $
                            {(monthlyPlan.monthlyPrice * 6 - sixMonthPlan.yearlyPrice).toFixed(2)}{' '}
                            compared to monthly
                          </Typography>
                        )}
                      </Box>

                      <Divider />

                      <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
                        {sixMonthPlan.features && sixMonthPlan.features.length > 0 ? (
                          sixMonthPlan.features.map((feature, idx) => (
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
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No features listed
                          </Typography>
                        )}
                      </Stack>

                      <Button
                        variant={
                          subscription?.planId === sixMonthPlan.id ? 'outlined' : 'contained'
                        }
                        fullWidth
                        disabled={subscription?.planId === sixMonthPlan.id || isProcessing}
                        onClick={() => handleStripeCheckout(sixMonthPlan.id, 'SIXMONTH')}
                        sx={{
                          mt: 'auto',
                          flexShrink: 0,
                          bgcolor:
                            subscription?.planId === sixMonthPlan.id ? 'transparent' : '#000000',
                          color: subscription?.planId === sixMonthPlan.id ? '#000000' : '#FFFFFF',
                          borderColor: '#000000',
                          '&:hover': {
                            bgcolor:
                              subscription?.planId === sixMonthPlan.id
                                ? 'rgba(0, 0, 0, 0.05)'
                                : '#000000',
                          },
                        }}
                      >
                        {subscription?.planId === sixMonthPlan.id
                          ? 'Current plan'
                          : isProcessing
                            ? 'Processing...'
                            : 'Switch to this plan'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {/* Current Subscription & Payment Method */}
          {isAuthenticated && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              {/* Current Subscription Card */}
              {loadingSubscription ? (
                <Card sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography>Loading subscription...</Typography>
                  </CardContent>
                </Card>
              ) : subscription ? (
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
                          per{' '}
                          {subscription.billingCycle === 'MONTHLY'
                            ? 'month'
                            : subscription.billingCycle === 'SIXMONTH'
                              ? '6 months'
                              : 'year'}
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
              ) : null}

              {/* Payment Method Card */}
              {loadingPaymentMethods ? (
                <Card sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography>Loading payment methods...</Typography>
                  </CardContent>
                </Card>
              ) : (
                defaultPaymentMethod && (
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
                            <Icon
                              icon={
                                defaultPaymentMethod.cardBrand === 'visa'
                                  ? 'logos:visa'
                                  : defaultPaymentMethod.cardBrand === 'mastercard'
                                    ? 'logos:mastercard'
                                    : 'mdi:credit-card'
                              }
                              width={40}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body1" fontWeight={500}>
                                {defaultPaymentMethod.cardBrand
                                  ? defaultPaymentMethod.cardBrand.charAt(0).toUpperCase() +
                                    defaultPaymentMethod.cardBrand.slice(1)
                                  : 'Card'}{' '}
                                ending in {defaultPaymentMethod.cardLast4}
                              </Typography>
                              {defaultPaymentMethod.isDefault && (
                                <Chip label="Default" size="small" color="primary" />
                              )}
                            </Stack>
                            {defaultPaymentMethod.cardExpMonth &&
                              defaultPaymentMethod.cardExpYear && (
                                <Typography variant="body2" color="text.secondary">
                                  Expires {defaultPaymentMethod.cardExpMonth}/
                                  {defaultPaymentMethod.cardExpYear}
                                </Typography>
                              )}
                          </Box>
                          <Button variant="outlined" size="small">
                            Edit
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                )
              )}
            </Stack>
          )}

          {/* Billing History */}
          {isAuthenticated && (
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

              {loadingInvoices ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <Typography>Loading invoices...</Typography>
                </Box>
              ) : filteredInvoices.length === 0 ? (
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
                              {invoice.lineItems?.[0]?.description ||
                                subscription?.plan?.displayName ||
                                'Premium Plan'}
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
          )}
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
