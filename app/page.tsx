import { getPalletData } from './actions/pallets';
import PalletTracker from './components/pallet-tracker';
import ThemeToggle from './components/theme-toggle';

// Force dynamic rendering - file hash must be computed fresh on each request
export const dynamic = 'force-dynamic';

export default async function Home() {
  let initialData;

  try {
    initialData = await getPalletData();
    console.log('[Home] Loaded pallets:', initialData.pallets.length);
  } catch (error) {
    console.error('[Home] Failed to load initial data:', error);
    throw error;
  }

  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Header */}
      <header className="border-b border-subtle bg-[color:var(--surface)]">
        <div className="app-shell app-shell-header flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-secondary">
              Elward Systems
            </p>
            <h1 className="text-lg font-semibold text-strong">
              Pallet Tracker
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="app-shell app-shell-main">
          <PalletTracker initialData={initialData} />
        </div>
      </main>
    </div>
  );
}
