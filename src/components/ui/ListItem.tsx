export function ListItem({
  title, subtitle, right, onClick,
}: {
  title: string; subtitle?: string; right?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--separator, rgba(0,0,0,0.06))',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}