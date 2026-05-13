# 🚀 FriImage Production Deployment Guide

**Complete step-by-step guide untuk deploy setelah `git clone` di server production**

---

## 📋 Pre-Deployment Checklist

- [ ] Server dengan Docker & Docker Compose terinstall
- [ ] Minimal 4GB RAM (production stable)
- [ ] 20GB storage untuk uploaded files & logs
- [ ] Network akses SSH ke server
- [ ] Git terinstall

---

## 🔧 Step-by-Step Deployment

### **STEP 1: Clone Repository**

```bash
cd /opt  # atau directory production kamu
git clone https://github.com/yourusername/frimage.git
cd frimage
```

---

### **STEP 2: Setup Environment Variables**

```bash
# Copy template .env
cp apps/api/.env.example .env.api || cat > .env.api << 'EOF'
NODE_ENV=production
PORT=4000
REDIS_URL=redis://redis:6379
EOF

cp apps/web/.env.example .env.web || cat > .env.web << 'EOF'
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://api:4000
EOF

cp apps/worker/.env.example .env.worker || cat > .env.worker << 'EOF'
NODE_ENV=production
REDIS_URL=redis://redis:6379
EOF
```

**⚠️ PENTING:** Jangan commit `.env` files! Mereka di `.gitignore`

---

### **STEP 3: Setup Storage Directories**

```bash
# Buat directory untuk uploads & outputs
mkdir -p storage/uploads storage/outputs

# Set proper permissions
chmod 755 storage/uploads storage/outputs

# (Optional) Buat placeholder agar folder tidak hilang
touch storage/uploads/.gitkeep storage/outputs/.gitkeep
```

---

### **STEP 4: Configure Docker (BuildKit - PENTING untuk speed)**

```bash
# Enable Docker BuildKit (untuk faster builds)
# Edit atau create ~/.docker/daemon.json

cat > ~/.docker/daemon.json << 'EOF'
{
  "features": {
    "buildkit": true
  }
}
EOF

# Restart Docker daemon
sudo systemctl restart docker

# Verify BuildKit enabled
docker buildx version
```

---

### **STEP 5: Build Docker Images**

```bash
# Build semua services (pertama kali ~3-5 menit)
docker compose build

# Atau dengan no-cache jika perlu fresh build
DOCKER_BUILDKIT=1 docker compose build --no-cache
```

**Output yang diharapkan:**
```
[+] Building 3.5s (45/45) FINISHED
 => [api] ...
 => [web] ...
 => [worker] ...
```

---

### **STEP 6: Start Services**

```bash
# Start di background
docker compose up -d

# Verify semua container running
docker compose ps
```

**Output yang diharapkan:**
```
NAME            STATUS                 PORTS
frimage-redis   Up 2 seconds           6379/tcp
frimage-api     Up 1 second            0.0.0.0:4000->4000/tcp
frimage-web     Up 1 second            0.0.0.0:3000->3000/tcp
frimage-worker  Up 1 second            (healthy)
```

---

### **STEP 7: Verify Services Health**

```bash
# Check API health
curl -s http://localhost:4000/health | jq .

# Check Web (should return HTML)
curl -s http://localhost:3000 | head -20

# Check Redis connection
docker compose exec redis redis-cli ping
# Should return: PONG

# Check Worker logs
docker compose logs worker
```

---

### **STEP 8: Setup Reverse Proxy (Nginx)**

```bash
# Install Nginx (if not installed)
sudo apt-get update
sudo apt-get install -y nginx

# Create config
sudo tee /etc/nginx/sites-available/frimage > /dev/null << 'EOF'
upstream frimage_api {
    server localhost:4000;
}

upstream frimage_web {
    server localhost:3000;
}

server {
    listen 80;
    server_name frimage.yourdomain.com;

    # API route
    location /api/ {
        proxy_pass http://frimage_api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Web frontend
    location / {
        proxy_pass http://frimage_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable config
sudo ln -s /etc/nginx/sites-available/frimage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### **STEP 9: Setup SSL/TLS (Let's Encrypt)**

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d frimage.yourdomain.com

# Auto-renewal (already enabled by Certbot)
sudo systemctl status certbot.timer
```

---

### **STEP 10: Setup Automatic Backups**

```bash
# Create backup script
mkdir -p /opt/frimage/backups

cat > /opt/frimage/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/frimage/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/frimage/storage/uploads/

# Backup Redis data
docker compose exec -T redis redis-cli BGSAVE
cp /var/lib/docker/volumes/frimage_redis-data/_data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Delete old backups (keep last 7 days)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/frimage/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/frimage/backup.sh") | crontab -
```

---

### **STEP 11: Setup Monitoring & Logs**

```bash
# View live logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f worker

# Backup logs (optional)
mkdir -p logs && docker compose logs > logs/$(date +%Y%m%d).log
```

---

### **STEP 12: Setup Auto-Restart on Reboot**

```bash
# Create systemd service
sudo tee /etc/systemd/system/frimage.service > /dev/null << 'EOF'
[Unit]
Description=FriImage MicroSaaS Application
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/frimage
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable frimage
sudo systemctl status frimage
```

---

## 📊 Production Verification Checklist

```bash
# 1. All containers running
docker compose ps | grep "Up"

# 2. API responsive
curl -s http://localhost:4000/health

# 3. Web accessible
curl -s http://localhost:3000 | grep -q "<!DOCTYPE" && echo "✓"

# 4. Redis connected
docker compose exec redis redis-cli dbsize

# 5. File uploads work
test -d storage/uploads && echo "✓ Uploads directory exists"

# 6. Nginx running
sudo systemctl status nginx | grep active

# 7. Disk space
df -h storage/

# 8. Database backups exist
ls -lh backups/ 2>/dev/null | grep -q "tar.gz" && echo "✓ Backups exist"
```

---

## 🔄 Update Deployment

```bash
# Update code dari repository
git pull

# Rebuild images (hanya jika ada perubahan)
docker compose build

# Restart services
docker compose up -d

# Verify
docker compose logs --tail=50
```

---

## 🚨 Troubleshooting

### **Build fails dengan "BuildKit not enabled"**
```bash
# Solution: Enable BuildKit
echo '{"features":{"buildkit":true}}' | sudo tee ~/.docker/daemon.json
sudo systemctl restart docker
```

### **Port sudah dipakai**
```bash
# Find process
sudo lsof -i :3000  # atau :4000

# Kill process
sudo kill -9 <PID>

# Atau ubah port di docker-compose.yaml
```

### **Storage space penuh**
```bash
# Check size
du -sh storage/

# Clean old uploads (keep last 30 days)
find storage/uploads -mtime +30 -delete
```

### **Worker tidak process jobs**
```bash
# Check Redis connection
docker compose exec redis redis-cli INFO

# Check worker logs
docker compose logs worker --tail=100

# Restart worker
docker compose restart worker
```

---

## 📦 Folder Structure di Server

```
/opt/frimage/
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
├── storage/
│   ├── uploads/        ← User uploaded files
│   └── outputs/        ← Processed images
├── backups/            ← Daily backups
├── logs/               ← Application logs
├── docker-compose.yaml
├── .env.api           ← JANGAN COMMIT
├── .env.web           ← JANGAN COMMIT
├── .env.worker        ← JANGAN COMMIT
└── .gitignore         ← Production safe
```

---

## 🎯 Performance Tuning

### **Increase Redis Memory**
```yaml
# docker-compose.yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### **Scale Worker Instances**
```yaml
# docker-compose.yaml
worker:
  deploy:
    replicas: 2  # Run 2 worker instances
```

### **Optimize Image Conversion**
```bash
# In worker/src/index.ts, adjust density
convert "${input}[0]" -density 150 -quality 85 "${output}"
# Turun density/quality jika perlu lebih cepat
```

---

## 📞 Support

Jika ada error, check:
1. `docker compose logs` - lihat error messages
2. `/opt/frimage/.env*` - verify environment variables
3. `df -h` - check disk space
4. `docker compose ps` - verify container status

---

**Last Updated:** 2025-05-14
**Status:** Production Ready ✅
