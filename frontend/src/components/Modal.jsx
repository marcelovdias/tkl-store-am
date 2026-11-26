import { X } from 'lucide-react';

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E7E1D6] bg-white shadow-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#EFEAE0] bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1C1B19]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-[#6E695F]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6E695F] hover:bg-[#F3EFE6] hover:text-[#1C1B19]"
            aria-label="Fechar janela"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
