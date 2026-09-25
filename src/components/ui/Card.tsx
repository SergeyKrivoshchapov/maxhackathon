export function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-secondary)',
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {children}
    </div>
  );
}