# Microsoft Graph Webhook Integration - Complete Guide

This document provides a comprehensive guide to the Microsoft Graph webhook integration for real-time Excel synchronization.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Azure AD Setup](#azure-ad-setup)
5. [Excel File Setup](#excel-file-setup)
6. [Database Setup](#database-setup)
7. [Environment Configuration](#environment-configuration)
8. [Deployment](#deployment)
9. [Webhook Management](#webhook-management)
10. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
11. [Maintenance](#maintenance)

---

## Overview

This integration enables **real-time synchronization** between an Excel file hosted in OneDrive/SharePoint and your application database. When rows are added, updated, or deleted in Excel, Microsoft Graph sends webhook notifications that automatically update your database and trigger notifications.

### Key Features

- ✅ **Real-time updates** from Excel to database
- ✅ **Bi-directional sync** (database changes can be written back to Excel)
- ✅ **No polling** - event-driven architecture
- ✅ **No file corruption** - uses Microsoft Graph API
- ✅ **Handles concurrent edits** via Excel Online
- ✅ **Notification system** (SMS, email, in-app)
- ✅ **Automatic webhook renewal** (webhooks expire after 3 days)
- ✅ **Audit trail** for all changes

---

## Architecture

### Data Flow

```
Excel in OneDrive/SharePoint
    ↓ (user edits)
Microsoft Graph API
    ↓ (webhook notification)
Your App (Next.js API Route)
    ↓ (validate & process)
PostgreSQL Database (Neon)
    ↓ (trigger notifications)
Notification Queue (SMS/Email/In-app)
```

### Components

1. **Excel Table** (OneDrive/SharePoint) - Source of truth for pallet data
2. **Microsoft Graph Webhooks** - Real-time change notifications
3. **Next.js API Routes** - Webhook endpoints (`/api/webhooks/graph`)
4. **Drizzle ORM + Neon PostgreSQL** - Database for todos and subscriptions
5. **Notification Service** - Sends SMS/email/in-app notifications
6. **Admin UI** - Manage webhook subscriptions (`/admin/webhooks`)
7. **Cron Jobs** - Auto-renewal and notification processing

---

## Prerequisites

Before starting, ensure you have:

- [ ] Microsoft 365 account with OneDrive or SharePoint
- [ ] Azure AD tenant (or ability to create one)
- [ ] Neon PostgreSQL database (free tier works)
- [ ] Public URL for webhook callbacks (use ngrok for local dev)
- [ ] Node.js 18+ and pnpm installed

---

## Azure AD Setup

### Step 1: Register Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App Registrations**
3. Click **New Registration**
4. Fill in:
   - **Name**: `pallet-router-webhooks`
   - **Supported account types**: Single tenant
   - **Redirect URI**: Leave blank
5. Click **Register**

### Step 2: Configure API Permissions

1. In your app registration, go to **API Permissions**
2. Click **Add a permission** > **Microsoft Graph** > **Application permissions**
3. Add these permissions:
   - `Files.ReadWrite.All` - Read/write all files
   - `Sites.ReadWrite.All` - Read/write SharePoint sites (if using SharePoint)
4. Click **Grant admin consent** (requires admin)

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `webhook-integration`
4. Expiration: 24 months (set reminder to renew)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately (you won't see it again)

### Step 4: Note Your Credentials

Copy these values from the **Overview** page:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Client secret**: `(from previous step)`

---

## Excel File Setup

### Step 1: Prepare Your Excel File

Your Excel file must have this exact structure:

**Sheet Name**: `PalletTracker`

**Columns** (must be in this order):

| Column | Name | Type | Description |
|--------|------|------|-------------|
| A | task_id | Text (UUID) | Unique identifier (generate with `=NEWID()` or manually) |
| B | job_number | Text | Job number |
| C | release_number | Text | Release number |
| D | pallet_number | Text | Pallet number |
| E | size | Text | Pallet size (e.g., "48x96") |
| F | elevation | Text | Elevation |
| G | status | Text | Status: "new", "in_progress", or "done" |
| H | assigned_to | Text | User ID or email of assignee |
| I | due_date | Date | Due date (ISO format) |
| J | acc_list | Text | Accessories list |
| K | shipped_date | Text | Shipped date |
| L | notes | Text | Additional notes |

### Step 2: Convert to Excel Table

1. Select all your data (including headers)
2. Go to **Insert** > **Table**
3. Check "My table has headers"
4. Click **OK**
5. Name your table: Right-click the table > **Table** > **Table Name**: `PalletTable`

### Step 3: Upload to OneDrive/SharePoint

**For OneDrive:**
1. Upload your Excel file to OneDrive
2. Note the file path (e.g., `/Documents/ReleaseCheckList.xlsx`)

**For SharePoint:**
1. Upload to a SharePoint document library
2. Note the site URL and file path

### Step 4: Get Workbook ID

**Method 1: Using Microsoft Graph Explorer** (recommended)

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your account
3. Run this query:
   ```
   GET https://graph.microsoft.com/v1.0/me/drive/root:/path/to/your/file.xlsx
   ```
4. Copy the `id` from the response

**Method 2: Using Graph API directly**

```bash
curl -X GET \
  'https://graph.microsoft.com/v1.0/me/drive/root:/Documents/ReleaseCheckList.xlsx' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Save the `id` value - this is your `EXCEL_WORKBOOK_ID`

---

## Database Setup

### Step 1: Create Neon Database

1. Sign up at [Neon.tech](https://neon.tech) (free tier available)
2. Create a new project
3. Copy the connection string:
   ```
   postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

### Step 2: Run Database Migrations

```bash
# Generate migration files
pnpm db:generate

# Push schema to database
pnpm db:push
```

This creates these tables:
- `todos` - Task data synced from Excel
- `webhook_subscriptions` - Active webhook registrations
- `webhook_notifications` - Incoming notification log
- `notification_queue` - Outgoing notifications (SMS/email/in-app)

### Step 3: Verify Database

```bash
# Open Drizzle Studio (visual database browser)
pnpm db:studio
```

Visit http://localhost:4983 to browse your database.

---

## Environment Configuration

### Step 1: Create `.env` File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Step 2: Fill in Configuration

```env
# Microsoft Graph API (from Azure AD setup)
MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_here
MICROSOFT_TENANT_ID=your_tenant_id_here

# Excel Configuration (from Excel setup)
EXCEL_WORKBOOK_ID=your_workbook_id_here
EXCEL_WORKSHEET_NAME=PalletTracker
EXCEL_TABLE_NAME=PalletTable

# Webhook Configuration
WEBHOOK_CLIENT_STATE=random_string_for_verification_12345
WEBHOOK_NOTIFICATION_URL=https://your-domain.com/api/webhooks/graph

# Database (from Neon setup)
DATABASE_URL=postgresql://user:password@your-neon-host.neon.tech/dbname?sslmode=require

# Twilio (Optional - for SMS notifications)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Cron Security (optional)
CRON_SECRET=random_secret_for_cron_endpoints
```

### Important Notes

- **WEBHOOK_CLIENT_STATE**: Generate a random string (e.g., `openssl rand -hex 32`)
- **WEBHOOK_NOTIFICATION_URL**: Must be publicly accessible HTTPS URL
- **For local development**: Use [ngrok](https://ngrok.com) to expose your local server

---

## Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   pnpm add -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add MICROSOFT_CLIENT_ID
   vercel env add MICROSOFT_CLIENT_SECRET
   # ... add all env vars from .env
   ```

4. **Configure Cron Jobs**

   Create `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron?task=renew",
         "schedule": "0 */12 * * *"
       },
       {
         "path": "/api/cron?task=notifications",
         "schedule": "*/5 * * * *"
       },
       {
         "path": "/api/cron?task=reprocess",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```

5. **Deploy Again**
   ```bash
   vercel --prod
   ```

### Option 2: Self-Hosted (Docker)

1. **Build Docker Image**
   ```bash
   docker build -t pallet-router .
   ```

2. **Run Container**
   ```bash
   docker run -p 3000:3000 \
     --env-file .env \
     pallet-router
   ```

3. **Set Up Cron Jobs**

   Use system cron or external service:
   ```cron
   # Renew webhooks every 12 hours
   0 */12 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron?task=renew

   # Process notifications every 5 minutes
   */5 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron?task=notifications

   # Reprocess failed notifications hourly
   0 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron?task=reprocess
   ```

---

## Webhook Management

### Creating Your First Subscription

1. **Start your application**
   ```bash
   pnpm dev  # or your production URL
   ```

2. **Visit Admin UI**
   ```
   http://localhost:3000/admin/webhooks
   ```

3. **Click "Create Subscription"**

   This will:
   - Register webhook with Microsoft Graph
   - Store subscription in database
   - Start receiving notifications

4. **Verify Subscription**

   You should see:
   - Status: Active (green checkmark)
   - Expiration: ~3 days from now
   - No errors

### Testing the Integration

1. **Make a change in Excel**
   - Open your Excel file in Excel Online or desktop app
   - Edit a row (e.g., change status from "new" to "in_progress")
   - Save the file

2. **Check webhook notification**

   Within a few seconds, you should see:
   - A log entry in your app console
   - The change reflected in your database
   - (Optional) A notification queued

3. **Verify in Admin UI**
   - Refresh `/admin/webhooks`
   - Check "Last Notification" timestamp

### Manual Sync (Initial Import)

If you need to import existing Excel data:

```typescript
// In your app or via admin UI
import { syncFromExcel } from '@/app/actions/todos';

await syncFromExcel();
```

This reads all Excel rows and syncs to database.

---

## Monitoring & Troubleshooting

### Common Issues

#### 1. Webhook Validation Fails

**Symptom**: Subscription creation fails with "Validation failed"

**Solution**:
- Verify `WEBHOOK_NOTIFICATION_URL` is publicly accessible
- Test webhook endpoint: `curl https://your-domain.com/api/webhooks/graph?validationToken=test`
- Should return `test` in plain text

#### 2. Notifications Not Received

**Symptom**: Excel changes don't trigger database updates

**Solutions**:
- Check subscription is "Active" in admin UI
- Verify subscription hasn't expired
- Check webhook endpoint logs for errors
- Ensure Excel file is in Table format (not just range)

#### 3. Authentication Errors

**Symptom**: "401 Unauthorized" or "403 Forbidden"

**Solutions**:
- Verify client secret hasn't expired
- Check API permissions are granted
- Ensure admin consent is granted
- Regenerate client secret if needed

#### 4. Database Connection Issues

**Symptom**: "Failed to connect to database"

**Solutions**:
- Verify `DATABASE_URL` is correct
- Check Neon database is running
- Ensure IP allowlist is configured (if applicable)
- Test connection with `pnpm db:studio`

### Monitoring Tools

**1. Admin Dashboard** (`/admin/webhooks`)
- View all subscriptions
- Check expiration dates
- See error messages
- Manually renew or delete

**2. Database Logs**

```sql
-- Recent webhook notifications
SELECT * FROM webhook_notifications
ORDER BY received_at DESC
LIMIT 50;

-- Failed notifications
SELECT * FROM webhook_notifications
WHERE processed = false
  AND processing_error IS NOT NULL;

-- Notification queue status
SELECT status, COUNT(*)
FROM notification_queue
GROUP BY status;
```

**3. Application Logs**

Search for these log prefixes:
- `[Webhook:GET]` - Validation requests
- `[Webhook:POST]` - Incoming notifications
- `[processWebhookNotification]` - Processing logic
- `[Cron]` - Scheduled tasks

---

## Maintenance

### Webhook Renewal

Webhooks expire after **3 days**. Auto-renewal runs every 12 hours via cron job.

**Manual renewal**:
1. Go to `/admin/webhooks`
2. Click refresh icon next to subscription
3. Verify new expiration date

**Emergency renewal** (if cron fails):
```bash
curl -X GET "https://your-domain.com/api/cron?task=renew" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Client Secret Rotation

Client secrets expire after 24 months. To rotate:

1. **Create new secret in Azure AD**
   - Go to app registration > Certificates & secrets
   - Create new client secret
   - Copy value

2. **Update environment variable**
   ```bash
   vercel env add MICROSOFT_CLIENT_SECRET production
   # Enter new secret value
   ```

3. **Delete old subscriptions**
   - Go to `/admin/webhooks`
   - Delete old subscriptions
   - Create new ones (will use new credentials)

4. **Remove old secret from Azure AD**

### Database Maintenance

**Clean up old notifications** (run monthly):

```sql
-- Archive notifications older than 30 days
DELETE FROM webhook_notifications
WHERE received_at < NOW() - INTERVAL '30 days';

-- Archive sent notifications older than 7 days
DELETE FROM notification_queue
WHERE status = 'sent'
  AND sent_at < NOW() - INTERVAL '7 days';
```

### Backup Strategy

**1. Database Backups**
- Neon provides automatic backups
- Or use `pg_dump`:
  ```bash
  pg_dump $DATABASE_URL > backup.sql
  ```

**2. Excel File Backups**
- OneDrive/SharePoint has version history (30 days)
- Download manual backups periodically

**3. Configuration Backups**
- Store `.env.example` in repo (without secrets)
- Document Azure AD settings
- Export webhook subscriptions list

---

## API Reference

### Webhook Endpoints

**`GET /api/webhooks/graph`**
- **Purpose**: Webhook validation
- **Query Params**: `validationToken` (string)
- **Response**: Plain text echo of validation token

**`POST /api/webhooks/graph`**
- **Purpose**: Receive webhook notifications
- **Body**: Microsoft Graph notification payload
- **Response**: `202 Accepted`

### Cron Endpoints

**`GET /api/cron?task=renew`**
- **Purpose**: Auto-renew expiring subscriptions
- **Auth**: Bearer token (`CRON_SECRET`)
- **Schedule**: Every 12 hours

**`GET /api/cron?task=notifications`**
- **Purpose**: Process notification queue
- **Auth**: Bearer token (`CRON_SECRET`)
- **Schedule**: Every 5 minutes

**`GET /api/cron?task=reprocess`**
- **Purpose**: Retry failed notifications
- **Auth**: Bearer token (`CRON_SECRET`)
- **Schedule**: Every hour

---

## Security Considerations

1. **Client State Validation** - All webhooks verify clientState
2. **Authentication** - All Graph API calls use OAuth 2.0
3. **HTTPS Only** - Webhooks only work with HTTPS endpoints
4. **Cron Security** - Cron endpoints require bearer token
5. **Environment Variables** - Never commit secrets to git
6. **Database Security** - Use SSL connections to Neon
7. **Audit Trail** - All changes logged in database

---

## Performance Optimization

1. **Batch Processing** - Notifications processed in batches of 50
2. **Async Processing** - Webhook endpoint responds immediately (< 3s)
3. **Connection Pooling** - Database uses connection pool
4. **Indexes** - Key fields indexed for fast queries
5. **Soft Deletes** - Preserve data integrity

---

## Support

For issues or questions:

1. Check this documentation first
2. Review application logs
3. Check database state
4. Test webhook endpoint manually
5. Validate Azure AD configuration
6. Check Microsoft Graph API status

---

## Next Steps

After deployment:

- [ ] Create first webhook subscription
- [ ] Test with Excel edit
- [ ] Set up monitoring/alerting
- [ ] Configure notification providers (Twilio for SMS)
- [ ] Schedule client secret renewal reminder
- [ ] Document team processes
- [ ] Train users on Excel structure

---

**Congratulations!** 🎉 You now have a fully integrated real-time Excel webhook system.
