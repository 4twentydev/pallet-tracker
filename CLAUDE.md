# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pallet-tracker** is a Next.js 16+ application built with React 19, TypeScript, and Tailwind CSS 4. The project uses the App Router architecture and is configured with shadcn/ui components following the "New York" style variant. The application tracks manufacturing pallet data stored in a Vercel Postgres database.

**Note**: The package.json lists the project name as "pallet-router" but the repository and application are referred to as "pallet-tracker".

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm installed
- Vercel Postgres database (or compatible PostgreSQL database)

### Initial Setup
1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables:
   Create a `.env.local` file in the project root:
   ```env
   POSTGRES_URL=your_postgres_connection_string
   IMPORT_SECRET_KEY=optional_secret_for_import_api  # Optional
   ```

3. Set up the database schema:
   ```bash
   pnpm db:push
   ```

4. (Optional) Import initial data from Excel:
   ```bash
   # Ensure data/Release-CheckList.xlsx exists first
   curl -X POST http://localhost:3000/api/import
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

## Development Commands

### Essential Commands
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run ESLint
pnpm lint
```

### Database Commands
```bash
# Generate database migrations from schema
pnpm db:generate

# Push schema changes to database
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

### Testing
- **No test framework is currently configured**
- Use `pnpm lint` for code quality checks
- Manual testing via `pnpm dev` is the current testing approach

### Package Management
- **Package Manager**: pnpm (evidenced by pnpm-lock.yaml)
- Use `pnpm install` to install dependencies
- Use `pnpm add <package>` to add new dependencies

## Architecture & Structure

### Technology Stack
- **Framework**: Next.js 16.1.1 with App Router
- **React**: Version 19.2.3
- **TypeScript**: Version 5
- **Database**: Vercel Postgres with Drizzle ORM 0.45.1
- **Styling**: Tailwind CSS 4 with custom theme
- **UI Components**: shadcn/ui (New York style)
- **Fonts**: Geist Sans and Geist Mono from next/font/google
- **Animation**: Framer Motion
- **Validation**: Zod
- **Date Utilities**: date-fns

### Directory Structure
```
app/
  layout.tsx          # Root layout with font configuration
  page.tsx            # Home page
  globals.css         # Global styles and Tailwind config
  actions/            # Next.js Server Actions
    pallets.ts        # Server actions for pallet data operations
  api/                # API Routes
    import/           # Excel import endpoint
      route.ts
  components/         # Feature-specific UI components
    pallet-tracker.tsx
    pallet-card.tsx
    job-group.tsx
    filter-bar.tsx
    bulk-actions.tsx
    conflict-dialog.tsx
    progress-indicator.tsx
    theme-toggle.tsx
lib/
  utils.ts            # Utility functions (cn helper)
  db/                 # Database configuration and queries
    index.ts          # Drizzle client initialization
    schema.ts         # Database schema definition
    queries.ts        # Database query functions
  excel/              # Excel import/export utilities
    reader.ts
    writer.ts
    utils.ts
    server-utils.ts
types/
  pallet.ts           # TypeScript type definitions
components/           # shadcn/ui components
  ui/                 # UI component directory (created when first shadcn component is added)
drizzle/              # Database migrations (created after first `pnpm db:generate`)
```

### Path Aliases
The following import aliases are configured in tsconfig.json and components.json:
```typescript
@/*           // Maps to project root
@/components  // Maps to components directory
@/lib         // Maps to lib directory
@/utils       // Maps to lib/utils
@/ui          // Maps to components/ui
@/hooks       // Maps to hooks directory
```

Always use these aliases for imports instead of relative paths.

## Styling System

### Tailwind CSS 4
This project uses Tailwind CSS 4 with the new `@theme inline` directive in globals.css. Key differences from Tailwind CSS 3:
- Uses `@import "tailwindcss"` instead of `@tailwind` directives
- Theme configuration is inline in globals.css using `@theme inline {}`
- Custom dark mode variant defined with `@custom-variant dark (&:is([data-theme="dark"] *))`

### Design System
The project has a comprehensive style guide in **STYLE_GUIDE.md** that documents:
- Color system (light/dark themes with custom CSS variables)
- Typography patterns (Geist Sans primary, Geist Mono for code)
- Component patterns (buttons, cards, forms, badges, etc.)
- Layout structures (two-column grids, responsive patterns)
- Spacing system and border radius conventions
- Animation patterns using Framer Motion
- Accessibility guidelines

**Important**: When creating new components or pages, refer to STYLE_GUIDE.md for consistent design patterns. The style guide uses custom CSS variables for theming:
- Use `var(--background)`, `var(--foreground)`, `var(--surface)`, etc.
- Use semantic color classes like `text-strong`, `text-muted`, `border-subtle`
- Follow the established border radius scale: `rounded-2xl` for inputs, `rounded-3xl` for cards, `rounded-full` for buttons

### shadcn/ui Configuration
- **Style**: new-york
- **Base Color**: neutral
- **CSS Variables**: Enabled
- **Icon Library**: lucide-react
- **Component Directory**: `components/ui/` (created when first component is added)
- **Note**: No shadcn/ui components are currently installed; the project is configured and ready to add them as needed

### Theme Colors
Both light and dark themes are preconfigured with semantic color tokens defined in globals.css:
- Core: `--background`, `--foreground`, `--surface`, `--surface-muted`
- Borders: `--border`, `--border-strong`
- Text: `--muted`, `--muted-strong`
- Accents: `--accent-primary`, `--accent-secondary`
- Status: `--success`, `--error`, `--warning`

**Theme Control:**
- Default theme: Light mode (`data-theme="light"` set in layout.tsx)
- Theme toggle: Available via `ThemeToggle` component in `app/components/theme-toggle.tsx`
- Theme switching: Set the `data-theme` attribute on the HTML element to `"dark"` or `"light"`

### Utility Function
The `cn()` helper in `lib/utils.ts` combines clsx and tailwind-merge for conditional className composition:
```typescript
import { cn } from "@/lib/utils"

<div className={cn("base-class", condition && "conditional-class")} />
```

## TypeScript Configuration

- **Target**: ES2017
- **JSX**: react-jsx
- **Module Resolution**: bundler
- **Strict Mode**: Enabled
- All TypeScript files use `.ts` or `.tsx` extensions
- Type checking is strict; ensure all new code is properly typed

## Application Architecture

### Data Flow & Database Integration
This application manages pallet tracking data stored in a Vercel Postgres database using Drizzle ORM.

**Key Architecture Patterns:**

1. **Database as Source of Truth**: The Vercel Postgres database is the single source of truth. All reads and writes go through Drizzle ORM queries defined in `lib/db/queries.ts`.

2. **Server Actions for Data Mutations**: All data operations (reading, updating) are handled via Next.js Server Actions in `app/actions/pallets.ts`:
   - `getPalletData()` - Reads all pallet data from database
   - `togglePalletStatus()` - Toggles a single pallet's "Made" status
   - `bulkTogglePallets()` - Bulk updates multiple pallets

3. **Database Schema** (`lib/db/schema.ts`):
   - Table: `pallets`
   - Columns:
     - `id` (serial, primary key)
     - `jobNumber` (text, required)
     - `releaseNumber` (text, required)
     - `palletNumber` (text, required)
     - `size` (text, optional)
     - `elevation` (text, optional)
     - `made` (boolean, default false)
     - `accList` (text, optional - accessories list)
     - `shippedDate` (text, optional)
     - `notes` (text, optional)
     - `createdAt` (timestamp, auto-generated)
     - `updatedAt` (timestamp, auto-updated)

4. **Type Safety**: The `types/pallet.ts` file defines all domain types:
   - `PalletTask` - Individual pallet item with computed status
   - `JobGroup` - Grouped pallets by job/release with progress metrics
   - `PalletData` - Full dataset with metadata
   - `FileMetadata` - Metadata for versioning (legacy interface from Excel-based system, maintained for backwards compatibility)
   - `ServerActionResult<T>` - Standardized server action response

5. **Pallet ID Format**: `${jobNumber}::${releaseNumber}::${palletNumber}`
   - Uses `::` delimiter to handle hyphens in release numbers
   - Parsed in database queries to identify individual pallets
   - Example: `"24-101::R1::1"` represents Job 24-101, Release R1, Pallet 1

6. **Versioning**: Server actions accept a `version` parameter for potential conflict detection:
   - `metadata.version` contains a timestamp string generated on each read
   - Server actions accept `expectedVersion` parameter (legacy interface)
   - **Note**: Version checking is not currently enforced in database queries; updates always succeed

### Database Layer (`lib/db/`)

**`lib/db/index.ts`**: Drizzle client initialization
```typescript
import { drizzle } from 'drizzle-orm/vercel-postgres';
export const db = drizzle(sql, { schema });
```

**`lib/db/schema.ts`**: Database table definitions using Drizzle ORM
- Exports `pallets` table schema
- Exports inferred types: `Pallet`, `NewPallet`

**`lib/db/queries.ts`**: Database query functions
- `getPallets()` - Fetches all pallets, converts to `PalletTask[]`
- `updatePalletMade()` - Updates single pallet's made status
- `bulkUpdatePalletsMade()` - Updates multiple pallets
- `insertPallet()` - Inserts single pallet
- `insertPallets()` - Batch inserts (used for Excel import)
- `deleteAllPallets()` - Truncates pallets table (used before re-import)

### Configuration Files

**`drizzle.config.ts`**: Drizzle Kit configuration
```typescript
{
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!
  }
}
```

**Environment Variables**:
- `POSTGRES_URL` - Vercel Postgres connection string (required)
- `IMPORT_SECRET_KEY` - Optional secret key to protect the Excel import API endpoint (recommended for production)

### Component Structure
Components in `app/components/` are feature-specific and follow these patterns:
- **pallet-tracker.tsx**: Main orchestrator component managing state and data fetching
- **job-group.tsx**: Displays grouped pallets by job/release with progress tracking
- **pallet-card.tsx**: Individual pallet display with toggle functionality
- **filter-bar.tsx**: Search and filter controls
- **bulk-actions.tsx**: Bulk selection and update controls
- **conflict-dialog.tsx**: Handles conflicts when data changes externally
- **progress-indicator.tsx**: Visual progress bars for job completion
- **theme-toggle.tsx**: Light/dark theme switcher

### Data Import Flow
The application supports importing Excel files to populate the database:

1. **Excel Import API** (`app/api/import/route.ts`):
   - Reads Excel file from `data/Release-CheckList.xlsx`
   - Parses data using ExcelJS
   - Clears existing database records via `deleteAllPallets()`
   - Batch inserts new records via `insertPallets()`
   - Protected by optional `IMPORT_SECRET_KEY` environment variable

   **Usage:**
   ```bash
   # Import Excel data (without authentication)
   curl -X POST http://localhost:3000/api/import

   # Import Excel data (with authentication if IMPORT_SECRET_KEY is set)
   curl -X POST http://localhost:3000/api/import \
     -H "Authorization: Bearer your-secret-key"

   # Check import endpoint info
   curl http://localhost:3000/api/import
   ```

2. **Excel Utilities** (`lib/excel/`):
   - `reader.ts` - Reads Excel files and parses pallet data
   - `writer.ts` - Exports database data to Excel format
   - `utils.ts` - Shared Excel parsing utilities
   - `server-utils.ts` - Server-side Excel operations

## Component Development

### Adding shadcn/ui Components
Use the shadcn CLI to add new components:
```bash
pnpm dlx shadcn@latest add <component-name>
```

Components will be installed in `components/ui/` with the New York style variant.

### Font Loading
Fonts are loaded in the root layout using next/font/google:
```typescript
import { Geist, Geist_Mono } from "next/font/google";
```

Both fonts are available as CSS variables:
- `--font-geist-sans` for body text
- `--font-geist-mono` for code/monospace content

## Common Workflows

### Making Schema Changes
1. Update the schema in `lib/db/schema.ts`
2. Generate migration files: `pnpm db:generate`
3. Review generated migration in `drizzle/` directory
4. Apply migration to database: `pnpm db:push`
5. Update related types in `types/pallet.ts` if needed
6. Update query functions in `lib/db/queries.ts` to use new schema

### Adding a New Server Action
1. Add the function to `app/actions/pallets.ts`
2. Import required query functions from `lib/db/queries.ts`
3. Implement error handling with try/catch
4. Return a `ServerActionResult` object
5. Call `revalidatePath('/')` after mutations to update cached data
6. Add corresponding UI handler in component

### Importing Data from Excel
1. **Ensure Excel file exists** at `data/Release-CheckList.xlsx` (must be present before import)
2. Ensure `POSTGRES_URL` environment variable is set
3. Optionally set `IMPORT_SECRET_KEY` for authentication
4. Start the dev server: `pnpm dev`
5. Run: `curl -X POST http://localhost:3000/api/import`
6. Check response for success/error status

### Updating Application Metadata
The `app/layout.tsx` file contains default Next.js metadata that should be updated:
```typescript
export const metadata: Metadata = {
  title: "Pallet Tracker",  // Currently "Create Next App"
  description: "Manufacturing pallet tracking application",
};
```

### Adding a New Component
1. Create component file in `app/components/` (for feature components) or `components/ui/` (for shadcn components)
2. Use `'use client'` directive only if needed (hooks, events, browser APIs)
3. Import styling utilities: `import { cn } from "@/lib/utils"`
4. Reference STYLE_GUIDE.md for consistent styling patterns
5. Use path aliases (`@/`) for all imports
6. Test in both light and dark themes

## Best Practices

### Database Operations
- Always use server actions for database mutations
- Use Drizzle queries from `lib/db/queries.ts` instead of raw SQL
- Handle database errors gracefully with try/catch
- Return standardized `ServerActionResult` from server actions
- Use `revalidatePath()` after mutations to update cached data

### Imports
- Always use path aliases (`@/`) instead of relative imports
- Import only what you need from libraries

### Styling
- Use the `cn()` utility for combining class names
- Prefer Tailwind classes over custom CSS
- Reference STYLE_GUIDE.md for consistent component patterns
- Use CSS variables for theme colors to support light/dark mode
- Follow the established border radius conventions from the style guide

### Components
- Use React Server Components by default (no 'use client' directive unless needed)
- Add 'use client' only when using hooks, event handlers, or browser APIs
- Follow the shadcn/ui patterns for component composition

### Code Quality
- Write type-safe TypeScript
- Use semantic HTML elements
- Ensure accessibility (ARIA labels, keyboard navigation)
- Test components in both light and dark themes

## Important Files

- `STYLE_GUIDE.md` - Comprehensive design system documentation
- `AGENTS.md` - Repository guidelines and conventions
- `components.json` - shadcn/ui configuration
- `drizzle.config.ts` - Drizzle ORM configuration
- `app/globals.css` - Tailwind config and theme variables
- `lib/utils.ts` - Shared utility functions
- `lib/db/schema.ts` - Database schema definition
- `lib/db/queries.ts` - Database query functions
- `types/pallet.ts` - Domain type definitions
- `tsconfig.json` - TypeScript configuration with path aliases
