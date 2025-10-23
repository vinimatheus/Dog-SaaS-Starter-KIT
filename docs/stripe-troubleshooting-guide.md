# Stripe Integration - Troubleshooting Guide

This guide provides solutions for common issues with the Stripe integration, including trial functionality, webhooks, and subscription management.

## 🚨 Quick Diagnosis

### Health Check First
Always start with the health check endpoint:

```bash
curl https://yourdomain.com/api/admin/stripe-health
```

This will show:
- ✅ Configuration status
- ✅ API connectivity
- ✅ Webhook status
- ✅ Product/price validation

### Common Symptoms & Quick Fixes

| Symptom | Quick Check | Quick Fix |
|---------|-------------|-----------|
| "Trial already used" error | Check `trialUsed` in database | Reset trial status if appropriate |
| Webhooks not processing | Check webhook signature | Verify `STRIPE_WEBHOOK_SECRET` |
| Subscription status wrong | Check webhook logs | Force sync from Stripe |
| Portal not working | Check `stripeCustomerId` | Recreate customer if missing |
| Payments failing | Check Stripe Dashboard | Update payment method |

## 🔍 Detailed Troubleshooting

### Trial-Related Issues

#### Issue: "Trial already used" Error
**Symptoms**: 
- User gets error when trying to start trial
- Error message: "Esta organização já utilizou o período de teste gratuito"

**Diagnosis**:
```sql
-- Check trial status
SELECT 
  id, 
  trialUsed, 
  trialStartDate, 
  trialEndDate,
  plan,
  stripeSubscriptionId
FROM Organization 
WHERE id = 'org-id';
```

**Possible Causes**:
1. Organization previously used trial
2. Database inconsistency
3. Failed trial cleanup

**Solutions**:
```sql
-- If trial was never actually used (data inconsistency)
UPDATE Organization 
SET trialUsed = FALSE, 
    trialStartDate = NULL, 
    trialEndDate = NULL 
WHERE id = 'org-id';

-- If trial was used but subscription was canceled, allow new trial (business decision)
UPDATE Organization 
SET trialUsed = FALSE 
WHERE id = 'org-id' 
  AND plan = 'FREE' 
  AND stripeSubscriptionId IS NULL;
```

**Prevention**:
- Implement proper trial cleanup on subscription cancellation
- Add validation to prevent data inconsistencies
- Monitor trial usage patterns

#### Issue: Trial Not Converting to Paid
**Symptoms**:
- Trial period ends but subscription remains in trial status
- No payment attempt made
- User still has trial access after 7 days

**Diagnosis**:
```bash
# Check subscription in Stripe
stripe subscriptions retrieve sub_xxx

# Check webhook events
stripe events list --type customer.subscription.trial_will_end
stripe events list --type invoice.payment_succeeded
```

**Possible Causes**:
1. Webhook processing failed
2. Payment method invalid
3. Stripe configuration issue

**Solutions**:
```bash
# Force webhook reprocessing
stripe events resend evt_xxx

# Check payment method
stripe payment_methods list --customer cus_xxx

# Manually trigger conversion
stripe subscriptions update sub_xxx --trial_end now
```

#### Issue: Trial Status Not Updating in UI
**Symptoms**:
- Database shows correct trial status
- UI shows incorrect information
- Trial countdown not working

**Diagnosis**:
```typescript
// Check trial status calculation
import { getTrialStatus } from '@/lib/trial-utils';

const organization = await prisma.organization.findUnique({
  where: { id: 'org-id' }
});

const trialStatus = getTrialStatus(organization);
console.log('Trial Status:', trialStatus);
```

**Possible Causes**:
1. Frontend caching issues
2. Trial calculation logic error
3. Data synchronization delay

**Solutions**:
```bash
# Clear frontend cache
# In browser: Hard refresh (Ctrl+Shift+R)

# Clear server cache (if using Redis)
redis-cli FLUSHDB

# Force data refresh
# Restart application or clear specific cache keys
```

### Webhook Issues

#### Issue: Webhook Signature Verification Failed
**Symptoms**:
- Webhooks return 400 error
- Error: "Invalid signature for webhook"
- Events not processed

**Diagnosis**:
```bash
# Check webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Test webhook endpoint
curl -X POST https://yourdomain.com/api/webhooks/stripe \
  -H "stripe-signature: test" \
  -d "test payload"

# Check webhook configuration in Stripe
stripe webhooks list
```

**Possible Causes**:
1. Wrong webhook secret
2. Clock skew between servers
3. Payload modification by proxy/CDN

**Solutions**:
```bash
# Get correct webhook secret from Stripe Dashboard
# Update environment variable
export STRIPE_WEBHOOK_SECRET="whsec_correct_secret"

# For development, use Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Check server time synchronization
date
ntpdate -s time.nist.gov
```

**Prevention**:
- Use environment variables for webhook secrets
- Implement proper time synchronization
- Monitor webhook delivery in Stripe Dashboard

#### Issue: Webhooks Processing But Not Updating Database
**Symptoms**:
- Webhooks return 200 OK
- Stripe shows successful delivery
- Database not updated

**Diagnosis**:
```bash
# Check webhook processing logs
tail -f logs/stripe-webhooks.log

# Check for database errors
tail -f logs/application.log | grep -i error

# Test database connection
npm run test:db-connection
```

**Possible Causes**:
1. Database connection issues
2. Transaction rollback
3. Validation errors

**Solutions**:
```typescript
// Add detailed logging to webhook handler
console.log('Processing webhook:', event.type, event.id);
console.log('Organization ID:', organizationId);
console.log('Update data:', updateData);

// Check database transaction
await prisma.$transaction(async (tx) => {
  const result = await tx.organization.update({
    where: { id: organizationId },
    data: updateData
  });
  console.log('Database update result:', result);
});
```

#### Issue: Duplicate Webhook Processing
**Symptoms**:
- Same webhook processed multiple times
- Duplicate database entries
- Inconsistent data state

**Diagnosis**:
```sql
-- Check for duplicate events in logs
SELECT event_id, COUNT(*) 
FROM webhook_logs 
GROUP BY event_id 
HAVING COUNT(*) > 1;
```

**Solutions**:
```typescript
// Implement idempotency
const processedEvents = new Set();

export async function handleWebhook(event) {
  if (processedEvents.has(event.id)) {
    console.log('Event already processed:', event.id);
    return { success: true };
  }
  
  // Process event
  await processEvent(event);
  
  processedEvents.add(event.id);
}

// Or use database-based idempotency
const existingEvent = await prisma.webhookEvent.findUnique({
  where: { eventId: event.id }
});

if (existingEvent) {
  return { success: true };
}
```

### Subscription Management Issues

#### Issue: Subscription Status Not Syncing
**Symptoms**:
- Stripe shows different status than database
- UI shows incorrect subscription information
- Access control not working properly

**Diagnosis**:
```bash
# Compare Stripe vs Database
stripe subscriptions retrieve sub_xxx

# Check database
SELECT subscriptionStatus, currentPeriodStart, currentPeriodEnd 
FROM Organization 
WHERE stripeSubscriptionId = 'sub_xxx';
```

**Solutions**:
```typescript
// Force sync from Stripe
async function syncSubscriptionFromStripe(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  await prisma.organization.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
  });
}
```

#### Issue: Customer Portal Not Working
**Symptoms**:
- Portal link doesn't work
- Error: "Customer not found"
- Portal shows no subscription

**Diagnosis**:
```sql
-- Check customer ID
SELECT stripeCustomerId, stripeSubscriptionId 
FROM Organization 
WHERE id = 'org-id';
```

**Possible Causes**:
1. Missing customer ID
2. Customer deleted in Stripe
3. Portal configuration issues

**Solutions**:
```typescript
// Recreate customer if missing
if (!organization.stripeCustomerId) {
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      organizationId: organization.id
    }
  });
  
  await prisma.organization.update({
    where: { id: organization.id },
    data: { stripeCustomerId: customer.id }
  });
}

// Verify customer exists in Stripe
try {
  await stripe.customers.retrieve(organization.stripeCustomerId);
} catch (error) {
  if (error.code === 'resource_missing') {
    // Recreate customer
  }
}
```

### Payment Issues

#### Issue: Payments Failing
**Symptoms**:
- Subscription becomes past_due
- Users lose access to Pro features
- Payment failure notifications

**Diagnosis**:
```bash
# Check failed payments
stripe charges list --customer cus_xxx --limit 10

# Check payment method
stripe payment_methods list --customer cus_xxx

# Review subscription status
stripe subscriptions retrieve sub_xxx
```

**Possible Causes**:
1. Invalid payment method
2. Insufficient funds
3. Bank restrictions
4. Card expired

**Solutions**:
```bash
# Update payment method via portal
# User should access customer portal to update

# Retry payment
stripe invoices pay in_xxx

# Check for payment method issues
stripe payment_methods retrieve pm_xxx
```

#### Issue: Trial Not Charging After 7 Days
**Symptoms**:
- Trial period ends
- No payment attempt
- Subscription remains in trial

**Diagnosis**:
```bash
# Check subscription trial end
stripe subscriptions retrieve sub_xxx

# Check upcoming invoices
stripe invoices upcoming --customer cus_xxx
```

**Solutions**:
```bash
# Force trial end
stripe subscriptions update sub_xxx --trial_end now

# Check payment method before trial ends
stripe payment_methods list --customer cus_xxx --type card
```

### Configuration Issues

#### Issue: Environment Variables Not Loading
**Symptoms**:
- Error: "STRIPE_SECRET_KEY is not defined"
- Configuration validation fails
- Health check fails

**Diagnosis**:
```bash
# Check environment variables
env | grep STRIPE

# Check .env file
cat .env | grep STRIPE

# Test variable loading
node -e "console.log(process.env.STRIPE_SECRET_KEY)"
```

**Solutions**:
```bash
# Ensure .env file exists and is readable
ls -la .env

# Check file permissions
chmod 600 .env

# Restart application after changes
npm run dev
```

#### Issue: Wrong Stripe Environment (Test vs Live)
**Symptoms**:
- Test transactions in production
- Live transactions in development
- Configuration mismatch errors

**Diagnosis**:
```bash
# Check API key prefix
echo $STRIPE_SECRET_KEY | cut -c1-7
# Should be "sk_test" for test or "sk_live" for live

# Check webhook secret
echo $STRIPE_WEBHOOK_SECRET | cut -c1-6
# Should be "whsec_"
```

**Solutions**:
```bash
# Development
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..." # From Stripe CLI

# Production
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..." # From Stripe Dashboard
```

## 🛠️ Debug Tools & Commands

### Stripe CLI Commands
```bash
# Listen to webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.trial_will_end
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed

# View events
stripe events list --limit 10
stripe events retrieve evt_xxx

# Check subscriptions
stripe subscriptions list --customer cus_xxx
stripe subscriptions retrieve sub_xxx

# Check customers
stripe customers list --limit 10
stripe customers retrieve cus_xxx

# Check products and prices
stripe products list
stripe prices list --product prod_xxx
```

### Database Queries
```sql
-- Check trial status
SELECT 
  id,
  plan,
  trialUsed,
  trialStartDate,
  trialEndDate,
  CASE 
    WHEN trialEndDate > NOW() THEN 'Active'
    WHEN trialEndDate < NOW() THEN 'Expired'
    ELSE 'Not Started'
  END as trial_status,
  DATEDIFF(trialEndDate, NOW()) as days_remaining
FROM Organization 
WHERE trialStartDate IS NOT NULL;

-- Check subscription status
SELECT 
  id,
  plan,
  subscriptionStatus,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd
FROM Organization 
WHERE plan = 'PRO';

-- Find problematic subscriptions
SELECT *
FROM Organization 
WHERE plan = 'PRO' 
  AND (stripeSubscriptionId IS NULL OR subscriptionStatus IS NULL);

-- Check recent webhook processing
SELECT 
  created_at,
  event_type,
  metadata,
  success
FROM audit_logs 
WHERE event_type LIKE 'stripe_%' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Application Debug Commands
```bash
# Health check
curl https://yourdomain.com/api/admin/stripe-health

# Test configuration
npm run test:stripe-config

# Sync specific subscription
npm run stripe:sync-subscription sub_xxx

# Force webhook reprocessing
npm run stripe:reprocess-webhook evt_xxx

# Check logs
tail -f logs/stripe-webhooks.log
tail -f logs/application.log | grep -i stripe
```

### Browser Debug Tools
```javascript
// Check trial status in browser console
fetch('/api/trial-status/org-id')
  .then(r => r.json())
  .then(console.log);

// Check subscription details
fetch('/api/subscription-details/org-id')
  .then(r => r.json())
  .then(console.log);

// Clear local storage
localStorage.clear();
sessionStorage.clear();
```

## 📊 Monitoring & Alerts

### Key Metrics to Monitor
- Webhook success rate (should be > 95%)
- Payment success rate (should be > 90%)
- Trial conversion rate (should be > 20%)
- API response times (should be < 2s)
- Error rates (should be < 1%)

### Setting Up Alerts
```bash
# Webhook failure alert
if webhook_success_rate < 95% then alert

# Payment failure alert
if payment_success_rate < 90% then alert

# API error alert
if api_error_rate > 1% then alert

# Trial conversion alert
if trial_conversion_rate < 20% then alert
```

### Log Analysis
```bash
# Find webhook failures
grep "webhook.*failed" logs/stripe-webhooks.log

# Find payment failures
grep "payment.*failed" logs/application.log

# Find API errors
grep "stripe.*error" logs/application.log

# Count error types
grep "error" logs/application.log | cut -d' ' -f3 | sort | uniq -c
```

## 🚨 Emergency Procedures

### Critical Issues Response

#### Payment Processing Down
1. **Immediate**: Check Stripe status page
2. **Assess**: Determine scope of impact
3. **Communicate**: Notify users if widespread
4. **Monitor**: Watch for Stripe updates
5. **Test**: Verify when service restored

#### Webhook Processing Failed
1. **Stop**: Prevent further webhook processing
2. **Identify**: Find root cause
3. **Fix**: Apply immediate fix
4. **Replay**: Reprocess failed webhooks
5. **Monitor**: Ensure processing resumed

#### Data Corruption
1. **Isolate**: Stop affected processes
2. **Backup**: Create current state backup
3. **Assess**: Determine corruption scope
4. **Restore**: From last known good backup
5. **Sync**: Reconcile with Stripe data

### Rollback Procedures
```bash
# Application rollback
git checkout previous-stable-tag
npm run build
npm run deploy

# Database rollback
mysql -u user -p database < backup-file.sql

# Webhook configuration rollback
stripe webhooks update we_xxx --url old-url
```

## 📞 Getting Help

### Internal Escalation
1. **Level 1**: Check this troubleshooting guide
2. **Level 2**: Contact development team
3. **Level 3**: Escalate to technical lead
4. **Level 4**: Contact external support

### External Resources
- **Stripe Support**: https://support.stripe.com
- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Status**: https://status.stripe.com
- **Community**: https://stackoverflow.com/questions/tagged/stripe-payments

### Information to Provide
When seeking help, include:
- Error messages (exact text)
- Stripe event IDs
- Organization/customer IDs
- Timestamp of issue
- Steps to reproduce
- Environment (dev/staging/prod)

---

**Last Updated**: October 2024  
**Version**: 2.0  
**Next Review**: January 2025