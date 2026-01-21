# Pallet Tracker

A Next.js application for tracking manufacturing pallets with PIN-based authentication and admin capabilities.

## Features

- 🔐 **PIN Authentication** - Secure login with hashed PIN codes
- 👤 **User Roles** - Admin and regular user access levels
- ➕ **Manual Entry** - Admin interface to add pallets one at a time
- 📁 **File Import** - Bulk import from XLSX or CSV files
- ✅ **Status Tracking** - Mark pallets as completed/pending
- 🎨 **Dark Mode** - Toggle between light and dark themes
- 💾 **PostgreSQL** - Reliable data storage with Drizzle ORM

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm installed
- PostgreSQL database (Vercel Postgres recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pallet-router
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```

   Update `.env.local` with your values:
   ```env
   # Database connection string (get from Vercel Postgres or your PostgreSQL provider)
   POSTGRES_URL=postgresql://username:password@host:port/database

   # Session secret (generate with: openssl rand -base64 32)
   SESSION_SECRET=your_random_secret_here
   ```

4. **Set up the database**

   Push the database schema:
   ```bash
   pnpm db:push
   ```

5. **Create an admin user**

   ```bash
   pnpm dlx tsx scripts/create-admin.ts "Admin Name" "1234"
   ```

   Replace "Admin Name" and "1234" with your desired name and PIN (minimum 4 characters).

6. **Start the development server**
   ```bash
   pnpm dev
   ```

7. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) and sign in with your admin PIN!

## Usage

### Signing In

1. Enter your PIN on the login screen
2. Click "Sign In"

### Admin Features

Admins have access to the Admin Panel with two main features:

#### Manual Entry
- Add pallets one at a time
- Fill in job number, release number, pallet number
- Optional: size, elevation, accessories, notes
- Mark as completed immediately if needed

#### File Import
- Upload XLSX or CSV files
- Expected columns: Job Number, Release Number, Pallet Number, Size, Elevation, Made, Acc List, Shipped Date, Notes
- Option to replace all existing pallets or add to existing data
- Supports bulk imports of hundreds or thousands of pallets

### Tracking Pallets

All users can:
- View all pallets grouped by job and release
- Toggle individual pallet completion status
- Use bulk actions to mark multiple pallets at once
- Filter and search through pallets
- See progress indicators for each job/release

## File Format for Imports

### XLSX Format
- Sheet name: "PalletTracker" (or first sheet will be used)
- Columns (in order):
  1. Job Number (required)
  2. Release Number (required)
  3. Pallet Number (required)
  4. Size (optional)
  5. Elevation (optional)
  6. Made (use "X" or "true" for completed, empty for pending)
  7. Acc List (optional)
  8. Shipped Date (optional)
  9. Notes (optional)

### CSV Format
- Same column order as XLSX
- First row is header (will be skipped)
- Use commas as separators
- Quote values that contain commas

### Example

```csv
Job Number,Release Number,Pallet Number,Size,Elevation,Made,Acc List,Shipped Date,Notes
24-101,R1,1,48x40,A,X,Straps,2024-01-15,Completed
24-101,R1,2,48x40,A,,Straps,,In progress
24-101,R2,1,48x48,B,,,2024-01-16,Rush order
```

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Database commands
pnpm db:generate  # Generate migrations from schema
pnpm db:push      # Push schema changes to database
pnpm db:studio    # Open Drizzle Studio (database GUI)
```

## Managing Users

### Create Additional Users

You can create more users (admin or regular) using the script:

```bash
# Create an admin
pnpm dlx tsx scripts/create-admin.ts "Admin Name" "adminPIN"

# The script creates admin users by default
# To create regular users, modify the script or add them via database
```

### User Roles

- **Admin**: Full access including Admin Panel, manual entry, and file imports
- **User**: Can view and toggle pallet status, but cannot add new pallets

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **React**: Version 19
- **TypeScript**: Version 5
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: iron-session with bcryptjs for PIN hashing
- **File Processing**: ExcelJS for XLSX, custom CSV parser
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui compatible (New York style)

## Project Structure

```
app/
  actions/          # Server actions
    auth.ts         # Authentication actions
    pallets.ts      # Pallet CRUD actions
  components/       # UI components
    admin-panel.tsx # Admin interface
    auth-status.tsx # Auth display
    login-form.tsx  # PIN login
    pallet-*.tsx    # Pallet UI components
  page.tsx          # Home page
  layout.tsx        # Root layout
lib/
  db/               # Database layer
    schema.ts       # Drizzle schema
    queries.ts      # Pallet queries
    user-queries.ts # User queries
  session.ts        # Session management
  import-utils.ts   # File parsing
scripts/
  create-admin.ts   # Admin creation script
```

## Security Notes

- PINs are hashed with bcryptjs (10 salt rounds)
- Sessions are encrypted with iron-session
- Admin-only actions are protected by `requireAdmin()` middleware
- All database queries use parameterized statements (Drizzle ORM)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `POSTGRES_URL` (from Vercel Postgres)
   - `SESSION_SECRET` (generate with `openssl rand -base64 32`)
4. Deploy!
5. After deployment, create admin user:
   ```bash
   vercel env pull .env.local
   pnpm dlx tsx scripts/create-admin.ts "Admin" "yourpin"
   ```

## Support

For issues or questions, please open an issue in the repository.

## License

This project is proprietary software for Elward Systems.
