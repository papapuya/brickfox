# 📦 Storage Configuration - Deutschland/Europa

## 🌍 Region-Konfiguration für Deutschland

### **AWS S3 Regionen (Empfohlen für Deutschland)**

**Standard-Region:** `eu-central-1` (Frankfurt, Deutschland)

**Verfügbare Regionen:**
- ✅ **`eu-central-1`** - Frankfurt (Deutschland) - **EMPFOHLEN**
- `eu-west-1` - Irland
- `eu-west-3` - Paris (Frankreich)
- `eu-north-1` - Stockholm (Schweden)

**Warum `eu-central-1`?**
- ✅ Niedrigste Latenz für Deutschland
- ✅ GDPR-Compliance (Daten bleiben in EU)
- ✅ Beste Performance für deutsche Nutzer
- ✅ Geringste Kosten (keine Data Transfer Costs innerhalb EU)

---

## 🔧 Konfiguration

### **1. Local Storage (Standard)**

```env
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./uploads
```

**Verwendung:**
- ✅ Einzelne Instanz
- ✅ Entwicklung
- ✅ Kleine Deployments

---

### **2. AWS S3 Storage (Multi-Instance)**

```env
STORAGE_TYPE=s3
S3_BUCKET=your-bucket-name
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

**AWS S3 Bucket erstellen:**
1. Gehen Sie zu [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Wählen Sie Region: **EU (Frankfurt) eu-central-1**
3. Erstellen Sie einen neuen Bucket
4. Aktivieren Sie Versioning (optional)
5. Konfigurieren Sie CORS (falls benötigt)

**Bucket-Policy (Beispiel):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT:user/YOUR_USER"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

---

### **3. NFS Storage (On-Premise)**

```env
STORAGE_TYPE=nfs
NFS_MOUNT_POINT=/mnt/nfs/uploads
```

**NFS Server Setup:**
```bash
# Auf NFS Server
sudo apt-get install nfs-kernel-server
sudo mkdir -p /mnt/nfs/uploads
sudo chown nobody:nogroup /mnt/nfs/uploads
sudo chmod 777 /mnt/nfs/uploads

# /etc/exports
/mnt/nfs/uploads 192.168.1.0/24(rw,sync,no_subtree_check)

# NFS Server starten
sudo systemctl restart nfs-kernel-server
```

**NFS Client Setup (auf App-Server):**
```bash
# NFS Client installieren
sudo apt-get install nfs-common

# Mount NFS
sudo mkdir -p /mnt/nfs/uploads
sudo mount -t nfs nfs-server-ip:/mnt/nfs/uploads /mnt/nfs/uploads

# Automatisch mounten (fstab)
echo "nfs-server-ip:/mnt/nfs/uploads /mnt/nfs/uploads nfs defaults 0 0" | sudo tee -a /etc/fstab
```

---

### **4. Azure Blob Storage**

```env
STORAGE_TYPE=azure
AZURE_STORAGE_ACCOUNT_NAME=your-account-name
AZURE_STORAGE_ACCOUNT_KEY=your-account-key
AZURE_STORAGE_CONTAINER=your-container-name
```

**Azure Region (Empfohlen für Deutschland):**
- ✅ **Germany West Central** (Frankfurt)
- ✅ **Germany Central** (Frankfurt)

---

## 📊 Vergleich

| Storage Type | Latenz (DE) | Kosten | Skalierbarkeit | Multi-Instance |
|-------------|-------------|--------|-----------------|----------------|
| **Local** | ⚡ Sehr niedrig | 💰 Kostenlos | ⚠️ Begrenzt | ❌ Nein |
| **S3 (eu-central-1)** | ⚡ Niedrig | 💰 Günstig | ✅ Unbegrenzt | ✅ Ja |
| **NFS** | ⚡ Sehr niedrig | 💰 Kostenlos | ⚠️ Begrenzt | ✅ Ja |
| **Azure Blob** | ⚡ Niedrig | 💰 Günstig | ✅ Unbegrenzt | ✅ Ja |

---

## 🎯 Empfehlung für Deutschland

### **Für Produktion (Multi-Instance):**
```env
STORAGE_TYPE=s3
S3_BUCKET=pimpilot-uploads-prod
S3_REGION=eu-central-1  # Frankfurt
```

### **Für On-Premise (Firmenserver):**
```env
STORAGE_TYPE=nfs
NFS_MOUNT_POINT=/mnt/nfs/pimpilot-uploads
```

### **Für Entwicklung:**
```env
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./uploads
```

---

## 🔒 GDPR & Datenschutz

**Wichtig für Deutschland:**
- ✅ Daten müssen in EU bleiben (GDPR)
- ✅ `eu-central-1` (Frankfurt) erfüllt Anforderungen
- ✅ Keine Datenübertragung außerhalb EU
- ✅ DSGVO-konform

**AWS S3 GDPR-Compliance:**
- ✅ Daten bleiben in `eu-central-1`
- ✅ Keine automatische Replikation außerhalb EU
- ✅ Verschlüsselung möglich (SSE-S3, SSE-KMS)

---

## 📋 Checkliste

- [x] Standard-Region auf `eu-central-1` gesetzt
- [x] Storage Service unterstützt alle Typen
- [x] Environment Variables dokumentiert
- [x] GDPR-konforme Konfiguration

---

**Letzte Aktualisierung:** 2025-01-XX
**Status:** ✅ Für Deutschland/Europa optimiert

