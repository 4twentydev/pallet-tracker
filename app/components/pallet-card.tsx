'use client';

import { cn } from '@/lib/utils';
import type { PalletTask } from '@/types/pallet';

interface PalletCardProps {
  pallet: PalletTask;
  onToggleStatus: () => void;
  isPending: boolean;
}

export default function PalletCard({
  pallet,
  onToggleStatus,
  isPending,
}: PalletCardProps) {
  return (
    <div
      className={cn(
        'card-pad rounded-2xl border border-subtle bg-transparent transition-all',
        pallet.made ? 'opacity-70' : ''
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Pallet Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-strong">Pallet {pallet.palletNumber}</span>
            {pallet.made && (
              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Made
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {pallet.size && <span>Size: {pallet.size}</span>}
            {pallet.elevation && <span>Elevation: {pallet.elevation}</span>}
            {pallet.accList && <span>Acc: {pallet.accList}</span>}
          </div>
          {pallet.notes && <p className="mt-2 text-xs text-subtle">{pallet.notes}</p>}
          {pallet.shippedDate && (
            <p className="mt-1 text-xs text-muted">Shipped: {pallet.shippedDate}</p>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggleStatus}
          disabled={isPending}
          title={pallet.made ? 'Mark as not made' : 'Mark as made'}
          className={cn(
            'button-pad rounded-full text-sm font-semibold transition-all',
            pallet.made
              ? 'border border-subtle bg-[color:var(--surface)] text-subtle hover:border-strong hover:text-strong'
              : 'btn-primary hover:brightness-95',
            isPending && 'cursor-not-allowed opacity-50'
          )}
        >
          {pallet.made ? 'Undo' : 'Mark Made'}
        </button>
      </div>
    </div>
  );
}
