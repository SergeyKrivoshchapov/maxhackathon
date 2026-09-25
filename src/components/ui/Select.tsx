export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{
    width: '100%', padding: 12, borderRadius: 10,
    border: '1px solid var(--separator, #e5e7eb)',
    background: 'var(--bg-secondary)', color: 'var(--text)',
    fontSize: 15, marginBottom: 10,
    ...props.style,
  }} />;
}