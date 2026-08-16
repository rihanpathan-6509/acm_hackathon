export default function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 text-ink-soft">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-400 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
