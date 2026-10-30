export function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>
}

export function SectionTitle({ title, subtitle }: { title: string, subtitle: string }) {
  return <div className="mb-6"><h3 className="text-lg font-bold">{title}</h3>{subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}</div>
}

export function Stat({ label, value }: { label: string, value: string }) {
  return <div className="min-w-0 rounded-xl bg-stone-100 p-3 sm:p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 sm:text-xs">{label}</p><p className="mt-1 break-words text-base font-bold text-stone-900 sm:text-xl">{value}</p></div>
}
