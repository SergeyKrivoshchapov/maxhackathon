export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{
    width: '100%', padding: 12, borderRadius: 10,
    border: '1px solid var(--separator, #e5e7eb)',
    background: 'var(--bg-secondary)', color: 'var(--text)',
    fontSize: 15, marginBottom: 10, resize: 'vertical',
    ...props.style,
  }} />;
}