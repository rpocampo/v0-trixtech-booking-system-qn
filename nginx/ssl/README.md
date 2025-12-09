# SSL Certificates Directory

This directory should contain your SSL certificates for production deployment.

## Required Files:
- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key

## How to obtain certificates:
1. **Let's Encrypt (Free)**: Use Certbot on your server
2. **Purchased certificates**: Place files provided by your CA
3. **Self-signed (Development only)**: Generate with OpenSSL

## Example Certbot command:
```bash
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/
```

## Permissions:
Ensure certificates have correct permissions:
```bash
sudo chmod 600 nginx/ssl/privkey.pem
sudo chmod 644 nginx/ssl/fullchain.pem