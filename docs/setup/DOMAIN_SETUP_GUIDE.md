# 🌐 TRIXTECH Domain Setup Guide for Hostinger

## 📋 Overview
This guide provides step-by-step instructions for purchasing and configuring a domain name to work with your TRIXTECH booking system on Hostinger.

## 🛒 Step 1: Domain Registration

### Option 1: Purchase Domain Through Hostinger (Recommended)
**Best for:** Simplified management, automatic DNS configuration

1. **Go to Hostinger Domain Registration**
   - Visit: [https://www.hostinger.com/domain-checker](https://www.hostinger.com/domain-checker)
   - Search for your desired domain name (e.g., `trixtech.com`, `mybookingsystem.com`)

2. **Check Availability**
   - Enter your preferred domain name
   - Hostinger will show availability and pricing
   - Choose `.com`, `.net`, or `.org` for professional appearance

3. **Complete Purchase**
   - Add domain to cart
   - Create Hostinger account or login
   - Complete payment
   - **Important:** Select "Hostinger Hosting" during checkout for automatic DNS setup

### Option 2: Purchase Domain from Other Registrars
**Best for:** If you already have a preferred registrar

Popular registrars:
- **Namecheap** (affordable, good support)
- **GoDaddy** (widely known, good for beginners)
- **Google Domains** (clean interface, good privacy)
- ** Porkbun** (cheap, no upsells)

## ⚙️ Step 2: DNS Configuration

### For Hostinger-Purchased Domains
**Automatic Setup** - No action needed! Hostinger automatically configures DNS when you purchase hosting and domain together.

### For Externally Purchased Domains
You need to point your domain to Hostinger's nameservers.

#### Find Your Hostinger Nameservers
1. **Login to Hostinger Account**
   - Go to [https://www.hostinger.com](https://www.hostinger.com)
   - Login to your account

2. **Navigate to Domain Settings**
   - Click on "Domains" in the top menu
   - Select your domain
   - Go to "DNS/Nameservers"

3. **Copy Nameserver Information**
   - Hostinger nameservers typically look like:
     ```
     ns1.hostinger.com
     ns2.hostinger.com
     ns3.hostinger.com
     ns4.hostinger.com
     ```

#### Update Nameservers at Your Registrar

##### For Namecheap:
1. Login to Namecheap account
2. Go to "Domain List"
3. Click "Manage" next to your domain
4. Go to "Nameservers" section
5. Select "Custom DNS"
6. Enter Hostinger nameservers:
   - `ns1.hostinger.com`
   - `ns2.hostinger.com`
   - `ns3.hostinger.com`
   - `ns4.hostinger.com`
7. Click "Save Changes"

##### For GoDaddy:
1. Login to GoDaddy account
2. Click "My Products"
3. Select your domain
4. Click "DNS" or "Manage DNS"
5. Click "Change" next to Nameservers
6. Select "Custom"
7. Enter Hostinger nameservers
8. Click "Save"

##### For Google Domains:
1. Login to Google Domains
2. Select your domain
3. Click "DNS" in the left menu
4. Scroll to "Name servers"
5. Click "Use custom name servers"
6. Enter Hostinger nameservers
7. Click "Save"

## 🔍 Step 3: Verify Domain Propagation

### Check DNS Propagation
DNS changes can take 24-48 hours to propagate globally.

#### Online DNS Checkers:
- **DNS Checker**: [https://dnschecker.org](https://dnschecker.org)
- **WhatIsMyDNS**: [https://www.whatsmydns.net](https://www.whatsmydns.net)
- **DNS Propagation Checker**: [https://www.dnspropagation.net](https://www.dnspropagation.net)

#### Test Your Domain:
1. Enter your domain name in the checker
2. Select "A" record type
3. Check if it resolves to your Hostinger IP address

### What to Look For:
- **A Record**: Should point to your VPS IP address (e.g., `123.456.789.0`)
- **NS Records**: Should show Hostinger nameservers
- **TTL**: Time To Live (usually 14400 seconds = 4 hours)

## 🌐 Step 4: Subdomain Setup (Recommended)

For better organization, set up these subdomains:

### 1. Main Domain (yourdomain.com)
- Points to your frontend application
- Used by customers for booking

### 2. API Subdomain (api.yourdomain.com)
- Points to your backend API
- Used for API calls from frontend

### 3. Optional: Monitor Subdomain (monitor.yourdomain.com)
- Points to Grafana monitoring dashboard
- For system monitoring

### DNS Records Setup in Hostinger:

1. **Login to Hostinger hPanel**
2. **Go to Domains → DNS Zone**
3. **Add A Records:**

   | Type | Name          | Points to     | TTL    |
   |------|---------------|---------------|--------|
   | A    | @            | YOUR_VPS_IP  | 14400  |
   | A    | api          | YOUR_VPS_IP  | 14400  |
   | A    | monitor      | YOUR_VPS_IP  | 14400  |

4. **Add CNAME Records (if needed):**
   - `www.yourdomain.com` → `yourdomain.com`

## 🔒 Step 5: SSL Certificate Setup

### Option 1: Hostinger SSL (Free)
1. **Login to hPanel**
2. **Go to SSL → Free SSL**
3. **Click "Issue SSL Certificate"**
4. **Select your domain and subdomains**
5. **Hostinger automatically installs SSL**

### Option 2: Let's Encrypt (Manual)
If using Docker deployment, SSL is handled by the nginx container.

## 🧪 Step 6: Testing Domain Configuration

### 1. Test Main Domain
```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://yourdomain.com

# Test HTTPS
curl -I https://yourdomain.com
```

### 2. Test API Subdomain
```bash
# Test API health endpoint
curl https://api.yourdomain.com/api/health
```

### 3. Test SSL Certificate
- Visit [https://www.sslshopper.com/ssl-checker.html](https://www.sslshopper.com/ssl-checker.html)
- Enter your domain
- Verify certificate is valid

## 🚀 Step 7: Update Application Configuration

After domain is set up, update your environment files:

### Backend (.env.production)
```env
FRONTEND_URL=https://yourdomain.com
# ... other settings
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
# ... other settings
```

## 🐛 Troubleshooting Domain Issues

### Domain Not Resolving
1. **Check DNS Propagation**: Use online DNS checkers
2. **Verify Nameservers**: Ensure correct Hostinger nameservers are set
3. **Wait for Propagation**: Can take up to 48 hours

### SSL Certificate Issues
1. **Check Certificate Validity**: Use SSL checker tools
2. **Verify Domain Ownership**: Ensure domain points to correct IP
3. **Check Firewall**: Ensure ports 80 and 443 are open

### API Not Working
1. **Check DNS**: Ensure api.yourdomain.com resolves correctly
2. **Verify Backend**: Check if backend service is running
3. **Check Nginx Config**: Ensure nginx is proxying correctly

## 📞 Support Resources

### Hostinger Support
- **24/7 Live Chat**: Available in hPanel
- **Knowledge Base**: [support.hostinger.com](https://support.hostinger.com)
- **Ticket System**: For complex issues

### Domain Registrar Support
- **Namecheap**: [namecheap.com/support](https://www.namecheap.com/support/)
- **GoDaddy**: [godaddy.com/help](https://www.godaddy.com/help)
- **Google Domains**: [domains.google/support](https://domains.google/support/)

## ⏱️ Timeline Expectations

- **Domain Registration**: Instant (if available)
- **DNS Changes**: 24-48 hours propagation
- **SSL Certificate**: 5-10 minutes (Hostinger) or 1-2 hours (Let's Encrypt)
- **Full Setup**: 1-2 days total

## ✅ Checklist

- [ ] Domain purchased and registered
- [ ] Nameservers updated to Hostinger
- [ ] DNS records configured (A records for @, api, monitor)
- [ ] DNS propagation verified
- [ ] SSL certificate installed
- [ ] HTTPS working on all domains
- [ ] Application environment files updated
- [ ] Domain connectivity tested

---

**🎉 Once your domain is set up and pointing to Hostinger, you can proceed with the VPS deployment following the `DEPLOYMENT_HOSTINGER.md` guide!**