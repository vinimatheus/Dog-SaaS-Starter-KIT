# Deployment Checklist - Stripe Integration

This checklist ensures proper deployment of the Stripe integration with trial functionality across all environments.

## 🚀 Pre-Deployment Checklist

### Code Quality & Testing
- [ ] All unit tests passing (`npm test`)
- [ ] Integration tests passing (`npm test src/test/stripe/`)
- [ ] End-to-end tests completed
- [ ] Code review completed and approved
- [ ] Security review completed
- [ ] Performance testing completed

### Documentation
- [ ] API documentation updated
- [ ] Environment configuration documented
- [ ] Troubleshooting guide updated
- [ ] Deployment procedures documented
- [ ] Rollback procedures documented

## 🔧 Environment Configuration

### Development Environment

#### Stripe Configuration
- [ ] Stripe test account created
- [ ] Test API keys obtained (`sk_test_*`, `pk_test_*`)
- [ ] Products created in test mode
- [ ] Webhook endpoints configured for local development
- [ ] Stripe CLI installed and configured

#### Environment Variables
```bash
# Required variables
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # From Stripe CLI
STRIPE_PRO_PLAN_PRICE_ID="price_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Optional variables
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_TOLERANCE="600"
STRIPE_TIMEOUT="120000"
```

#### Setup Commands
```bash
# Install dependencies
npm install

# Setup Stripe products
npm run setup:stripe-products

# Start webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Run health check
npm run stripe:health
```

#### Verification
- [ ] Health check endpoint responds (`/api/admin/stripe-health`)
- [ ] Trial signup flow works end-to-end
- [ ] Webhook processing works with Stripe CLI
- [ ] Customer portal accessible
- [ ] Error handling works correctly

### Staging Environment

#### Stripe Configuration
- [ ] Same Stripe test account as development
- [ ] Test API keys configured
- [ ] Products verified in test mode
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] SSL certificate valid

#### Environment Variables
```bash
# Required variables
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # From Stripe Dashboard
STRIPE_PRO_PLAN_PRICE_ID="price_..."
NEXT_PUBLIC_APP_URL="https://staging.yourdomain.com"
NODE_ENV="production"

# Security variables
STRIPE_WEBHOOK_TOLERANCE="300"
STRIPE_TIMEOUT="80000"
STRIPE_MAX_RETRIES="3"
```

#### Deployment Steps
```bash
# Deploy application
npm run build
npm run deploy:staging

# Verify deployment
curl https://staging.yourdomain.com/api/admin/stripe-health

# Test webhook endpoint
npm run test:webhooks:staging
```

#### Verification
- [ ] Application deployed successfully
- [ ] Health check endpoint responds
- [ ] Webhook endpoint accessible from Stripe
- [ ] SSL certificate valid and trusted
- [ ] Trial flow works end-to-end
- [ ] Customer portal works
- [ ] Error logging functional

### Production Environment

#### Stripe Configuration
- [ ] Stripe account activated for live payments
- [ ] Business verification completed
- [ ] Live API keys obtained (`sk_live_*`, `pk_live_*`)
- [ ] Products created in live mode
- [ ] Webhook endpoints configured in live mode
- [ ] SSL certificate valid and trusted

#### Environment Variables
```bash
# Required variables
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # From live webhook
STRIPE_PRO_PLAN_PRICE_ID="price_..." # Live price ID
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"

# Security variables
STRIPE_WEBHOOK_TOLERANCE="300"
STRIPE_TIMEOUT="80000"
STRIPE_MAX_RETRIES="3"
```

#### Pre-Production Setup
```bash
# Create live products
STRIPE_SECRET_KEY="sk_live_..." npm run setup:stripe-products

# Configure live webhooks
STRIPE_SECRET_KEY="sk_live_..." npm run setup:stripe-webhooks

# Verify configuration
npm run test:stripe-config:production
```

#### Deployment Steps
```bash
# Final testing in staging
npm run test:e2e:staging

# Deploy to production
npm run build:production
npm run deploy:production

# Verify deployment
curl https://yourdomain.com/api/admin/stripe-health

# Monitor initial traffic
npm run monitor:production
```

#### Post-Deployment Verification
- [ ] Application deployed successfully
- [ ] Health check endpoint responds
- [ ] Webhook processing working
- [ ] Trial signup flow functional
- [ ] Customer portal accessible
- [ ] Payment processing working
- [ ] Error logging and monitoring active

## 🔍 Testing Checklist

### Automated Testing
- [ ] Unit tests pass (`npm test`)
- [ ] Integration tests pass (`npm test src/test/stripe/`)
- [ ] Security tests pass (`npm run test:security`)
- [ ] Performance tests pass (`npm run test:performance`)

### Manual Testing

#### Trial Flow Testing
- [ ] **New Organization Trial**
  - [ ] Create new organization
  - [ ] Start Pro trial subscription
  - [ ] Verify 7-day trial period set
  - [ ] Check trial status in UI
  - [ ] Verify full Pro access during trial

- [ ] **Trial Eligibility**
  - [ ] Verify ineligible organization gets error
  - [ ] Test organization with existing subscription
  - [ ] Test organization that already used trial

- [ ] **Trial Conversion**
  - [ ] Wait for trial to expire (or simulate)
  - [ ] Verify automatic conversion to paid
  - [ ] Check payment processing
  - [ ] Verify continued Pro access

#### Subscription Management Testing
- [ ] **Customer Portal**
  - [ ] Access customer portal from app
  - [ ] Update payment method
  - [ ] View billing history
  - [ ] Download invoices
  - [ ] Cancel subscription
  - [ ] Verify data synchronization after portal use

- [ ] **Subscription Status**
  - [ ] Verify status updates in real-time
  - [ ] Test payment failure scenarios
  - [ ] Test subscription reactivation
  - [ ] Verify access control based on status

#### Webhook Testing
- [ ] **Event Processing**
  - [ ] Test `checkout.session.completed`
  - [ ] Test `customer.subscription.created`
  - [ ] Test `customer.subscription.updated`
  - [ ] Test `customer.subscription.trial_will_end`
  - [ ] Test `invoice.payment_succeeded`
  - [ ] Test `invoice.payment_failed`
  - [ ] Test `customer.subscription.deleted`

- [ ] **Error Scenarios**
  - [ ] Invalid webhook signature
  - [ ] Malformed webhook payload
  - [ ] Network timeouts
  - [ ] Database connection failures

#### Error Handling Testing
- [ ] **Trial Errors**
  - [ ] Trial already used
  - [ ] Trial not eligible
  - [ ] Invalid trial state

- [ ] **Payment Errors**
  - [ ] Card declined
  - [ ] Insufficient funds
  - [ ] Expired card
  - [ ] Network errors

- [ ] **API Errors**
  - [ ] Stripe API unavailable
  - [ ] Rate limiting
  - [ ] Invalid requests

## 🔒 Security Checklist

### Configuration Security
- [ ] All API keys stored securely (environment variables)
- [ ] No hardcoded secrets in code
- [ ] Webhook secrets properly configured
- [ ] HTTPS enforced for all endpoints
- [ ] Rate limiting configured

### Webhook Security
- [ ] Webhook signature verification enabled
- [ ] Timestamp validation active (5-minute tolerance)
- [ ] Webhook endpoint only accepts POST requests
- [ ] Proper error handling without information leakage
- [ ] Idempotency handling implemented

### Data Security
- [ ] Sensitive data encrypted at rest
- [ ] PCI compliance requirements met
- [ ] Audit logging enabled
- [ ] Data retention policies implemented
- [ ] Backup and recovery procedures tested

### Access Control
- [ ] Subscription management restricted to organization owners
- [ ] Customer portal access properly authenticated
- [ ] Admin endpoints protected
- [ ] Role-based access control implemented

## 📊 Monitoring & Alerting

### Metrics to Monitor
- [ ] **Business Metrics**
  - [ ] Trial signup rate
  - [ ] Trial to paid conversion rate
  - [ ] Monthly recurring revenue (MRR)
  - [ ] Churn rate
  - [ ] Payment failure rate

- [ ] **Technical Metrics**
  - [ ] Webhook processing success rate
  - [ ] API response times
  - [ ] Error rates by type
  - [ ] Database query performance

### Alerting Setup
- [ ] **Critical Alerts**
  - [ ] Webhook failure rate > 5%
  - [ ] Payment failure rate > 10%
  - [ ] API error rate > 1%
  - [ ] Database connection failures

- [ ] **Warning Alerts**
  - [ ] Trial conversion rate < 20%
  - [ ] High API response times
  - [ ] Unusual error patterns
  - [ ] Configuration issues

### Logging Configuration
- [ ] Structured logging implemented
- [ ] Log levels properly configured
- [ ] Log rotation configured
- [ ] Centralized log aggregation
- [ ] Log retention policies set

## 🚨 Rollback Procedures

### Rollback Triggers
- [ ] Critical bugs in production
- [ ] Payment processing failures
- [ ] Data corruption issues
- [ ] Security vulnerabilities
- [ ] Performance degradation

### Rollback Steps
1. **Immediate Actions**
   - [ ] Stop new deployments
   - [ ] Assess impact and scope
   - [ ] Notify stakeholders
   - [ ] Document the issue

2. **Application Rollback**
   - [ ] Revert to previous stable version
   - [ ] Verify application functionality
   - [ ] Check database consistency
   - [ ] Validate webhook processing

3. **Stripe Configuration**
   - [ ] Revert webhook configurations if needed
   - [ ] Verify product/price configurations
   - [ ] Check API key configurations
   - [ ] Validate portal configurations

4. **Post-Rollback Verification**
   - [ ] Health check passes
   - [ ] Trial flow works
   - [ ] Payment processing works
   - [ ] Customer portal accessible
   - [ ] Monitoring shows normal metrics

### Communication Plan
- [ ] Internal team notification
- [ ] Customer communication (if needed)
- [ ] Status page updates
- [ ] Post-mortem scheduling

## 📋 Post-Deployment Tasks

### Immediate (0-2 hours)
- [ ] Monitor error rates and performance
- [ ] Verify webhook processing
- [ ] Check trial signup flow
- [ ] Monitor payment processing
- [ ] Validate customer portal access

### Short-term (2-24 hours)
- [ ] Review monitoring dashboards
- [ ] Analyze conversion metrics
- [ ] Check for any error patterns
- [ ] Validate data synchronization
- [ ] Review customer feedback

### Medium-term (1-7 days)
- [ ] Analyze trial conversion rates
- [ ] Review payment success rates
- [ ] Monitor customer portal usage
- [ ] Check webhook delivery rates
- [ ] Validate business metrics

### Long-term (1-4 weeks)
- [ ] Comprehensive performance review
- [ ] Business metrics analysis
- [ ] Customer satisfaction survey
- [ ] Technical debt assessment
- [ ] Documentation updates

## 🔧 Maintenance Tasks

### Daily
- [ ] Monitor error logs
- [ ] Check webhook processing
- [ ] Review payment failures
- [ ] Validate system health

### Weekly
- [ ] Review conversion metrics
- [ ] Analyze error patterns
- [ ] Check performance trends
- [ ] Update documentation

### Monthly
- [ ] Security review
- [ ] Performance optimization
- [ ] Dependency updates
- [ ] Backup verification

### Quarterly
- [ ] Comprehensive security audit
- [ ] Performance benchmarking
- [ ] Disaster recovery testing
- [ ] Documentation review

---

## 📞 Emergency Contacts

### Internal Team
- **Development Lead**: [Contact Info]
- **DevOps Engineer**: [Contact Info]
- **Product Manager**: [Contact Info]
- **Security Team**: [Contact Info]

### External Services
- **Stripe Support**: https://support.stripe.com
- **Hosting Provider**: [Contact Info]
- **SSL Certificate Provider**: [Contact Info]

### Escalation Procedures
1. **Level 1**: Development team member
2. **Level 2**: Development lead + DevOps
3. **Level 3**: CTO + Product manager
4. **Level 4**: Executive team

---

**Checklist Version**: 2.0  
**Last Updated**: October 2024  
**Next Review**: January 2025