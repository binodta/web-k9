export const HelpMenu = ({ onClose }: { onClose: () => void }) => {
    const shortcuts = [
        { key: ':', desc: 'Enter command mode' },
        { key: '/', desc: 'Enter filter mode' },
        { key: 'j/k', desc: 'Navigate up/down' },
        { key: 'Enter', desc: 'Drill down / Open logs' },
        { key: 'd', desc: 'Describe resource' },
        { key: 'l', desc: 'View logs' },
        { key: 'y/e', desc: 'YAML View/Edit (soon)' },
        { key: 's', desc: 'Interactive Shell (soon)' },
        { key: 'Shift-C', desc: 'Sort by CPU' },
        { key: 'Shift-M', desc: 'Sort by Memory' },
        { key: 'Shift-N', desc: 'Sort by Name' },
        { key: 'Shift-A', desc: 'Sort by Age' },
        { key: 'Shift-T', desc: 'Sort by Restarts' },
        { key: 'x', desc: 'Toggle Secret Decode' },
        { key: '0', desc: 'All namespaces' },
        { key: 'Esc', desc: 'Close / Go back' },
        { key: '?', desc: 'This help menu' },
    ]

    return (
        <div className="overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="modal" style={{ width: '400px', padding: '0', border: '2px solid var(--accent-blue)' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'var(--accent-blue)', color: '#000', padding: '8px 15px', fontWeight: 'bold' }}>HELP</div>
                <div style={{ padding: '20px' }}>
                    {shortcuts.map(s => (
                        <div key={s.key} style={{ display: 'flex', marginBottom: '8px', lineHeight: '1.5' }}>
                            <div style={{ width: '100px', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>{s.key}</div>
                            <div style={{ color: '#fff' }}>{s.desc}</div>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-secondary)', fontSize: '0.8rem', borderTop: '1px solid #333' }}>
                    Press any key to close
                </div>
            </div>
        </div>
    )
}
