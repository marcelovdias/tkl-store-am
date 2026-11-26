import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed right-5 bottom-5 z-50 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all bg-white border-[#E7E1D6]">
      {isError ? (
        <AlertCircle className="h-5 w-5 shrink-0 text-[#B8293D]" />
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0F5C48]" />
      )}
      <p className="text-sm font-medium text-[#1C1B19]">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 rounded-md p-1 text-[#6E695F] hover:bg-[#F3EFE6]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
