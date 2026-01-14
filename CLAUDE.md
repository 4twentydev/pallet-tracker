# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pallet-router** is a Next.js 16+ application built with React 19, TypeScript, and Tailwind CSS 4. The project uses the App Router architecture and is configured with shadcn/ui components following the "New York" style variant.

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

### Package Management
- **Package Manager**: pnpm (evidenced by pnpm-lock.yaml)
- Use `pnpm install` to install dependencies
- Use `pnpm add <package>` to add new dependencies

## Architecture & Structure

### Technology Stack
- **Framework**: Next.js 16.1.1 with App Router
- **React**: Version 19.2.3
- **TypeScript**: Version 5
- **Styling**: Tailwind CSS 4 with custom theme
- **UI Components**: shadcn/ui (New York style)
- **Fonts**: Geist Sans and Geist Mono from next/font/google
- **Excel Integration**: ExcelJS for reading/writing Excel files
- **Animation**: Framer Motion
- **Validation**: Zod

### Directory Structure
```
app/
  layout.tsx          # Root layout with font configuration
  page.tsx            # Home page
  globals.css         # Global styles and Tailwind config
  actions/            # Next.js Server Actions
    pallets.ts        # Server actions for pallet data operations
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
  excel/              # Excel file I/O operations
    reader.ts         # Read data from Excel file
    writer.ts         # Write data to Excel file
    utils.ts          # Shared Excel utilities
types/
  pallet.ts           # TypeScript type definitions
data/
  *.xlsx              # Excel data files (source of truth)
components/           # shadcn/ui components go here
  ui/                 # UI component directory
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
- Components are installed in `components/ui/`

### Theme Colors
Both light and dark themes are preconfigured with semantic color tokens defined in globals.css:
- Core: `--background`, `--foreground`, `--surface`, `--surface-muted`
- Borders: `--border`, `--border-strong`
- Text: `--muted`, `--muted-strong`
- Accents: `--accent-primary`, `--accent-secondary`
- Status: `--success`, `--error`, `--warning`

Dark mode is toggled via the `data-theme` attribute on the HTML element (`data-theme="dark"` or `data-theme="light"`).

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

### Data Flow & Excel Integration
This application manages pallet tracking data stored in Excel files located in the `data/` directory.

**Key Architecture Patterns:**
1. **Excel as Source of Truth**: The Excel file in `data/` is the single source of truth. All reads and writes go through the `lib/excel/` modules.

2. **Server Actions for Data Mutations**: All data operations (reading, updating) are handled via Next.js Server Actions in `app/actions/pallets.ts`:
   - `getPalletData()` - Reads all pallet data from Excel
   - `togglePalletStatus()` - Toggles a single pallet's "Made" status
   - `bulkTogglePallets()` - Bulk updates multiple pallets

3. **Optimistic Locking**: The application uses file modification timestamps (`mtime`) for conflict detection:
   - Each read operation includes the file's `mtime` in metadata
   - Write operations verify the `mtime` hasn't changed before writing
   - If changed, returns a `conflict` error prompting the user to refresh

4. **Type Safety**: The `types/pallet.ts` file defines all domain types:
   - `PalletTask` - Individual pallet item
   - `JobGroup` - Grouped pallets by job/release
   - `PalletData` - Full dataset with metadata
   - `ServerActionResult<T>` - Standardized server action response

5. **Excel File Structure**:
   - File location: `data/Release-CheckList.xlsx`
   - Sheet name: `PalletTracker`
   - Columns: Job Number | Release Number | Pallet Number | Size | Elevation | Made (X/empty) | Acc List | Shipped Date | Notes
   - Row 1 is the header, data starts at row 2
   - Pallet ID format: `${jobNumber}::${releaseNumber}::${palletNumber}` (uses `::` delimiter to handle hyphens in release numbers)

### Component Structure
Components in `app/components/` are feature-specific and follow these patterns:
- **pallet-tracker.tsx**: Main orchestrator component managing state and data fetching
- **job-group.tsx**: Displays grouped pallets by job/release with progress tracking
- **pallet-card.tsx**: Individual pallet display with toggle functionality
- **filter-bar.tsx**: Search and filter controls
- **bulk-actions.tsx**: Bulk selection and update controls
- **conflict-dialog.tsx**: Handles merge conflicts when Excel file changes externally

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

## Best Practices

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
- `app/globals.css` - Tailwind config and theme variables
- `lib/utils.ts` - Shared utility functions
- `types/pallet.ts` - Domain type definitions
- `tsconfig.json` - TypeScript configuration with path aliases
