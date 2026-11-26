export function StatCard({ title, value, subtitle, icon: Icon, tone = 'neutral', onClick }) {
  const toneStyles = {
    neutral: 'bg-white border-[#E7E1D6] text-[#1C1B19]',
    emerald: 'bg-white border-[#0F5C48]/20 text-[#0F5C48]',
    urucum: 'bg-white border-[#B8293D]/20 text-[#B8293D]',
    gold: 'bg-white border-[#C89B3C]/30 text-[#8F6B1E]'
  };

  const iconBg = {
    neutral: 'bg-[#F3EFE6] text-[#1C1B19]',
    emerald: 'bg-[#0F5C48]/10 text-[#0F5C48]',
    urucum: 'bg-[#B8293D]/10 text-[#B8293D]',
    gold: 'bg-[#C89B3C]/15 text-[#8F6B1E]'
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-5 shadow-xs transition-all ${toneStyles[tone]} ${
        onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6E695F]">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-[#1C1B19]">
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-[#6E695F]">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`rounded-xl p-2.5 ${iconBg[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Tag>
  );
}
