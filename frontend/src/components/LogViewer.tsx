import { useState, useEffect, useRef } from 'react'
import { getWsUrl } from '../services/api'

interface LogViewerProps {
    pod: string
    namespace: string
    container?: string
    onClose: () => void
}

export const LogViewer = ({ pod, namespace, container = '', onClose }: LogViewerProps) => {
    const [logs, setLogs] = useState<string[]>([])
    const [autoScroll, setAutoScroll] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)
    const ws = useRef<WebSocket | null>(null)

    useEffect(() => {
        connect()
        return () => {
            if (ws.current) ws.current.close()
        }
    }, [pod, namespace, container])

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs, autoScroll])

    const connect = () => {
        setLoading(true)
        setError(null)
        setLogs([])

        const socket = new WebSocket(getWsUrl(`/ws/logs?pod=${pod}&namespace=${namespace}&container=${container}`))
        ws.current = socket

        socket.onopen = () => {
            setLoading(false)
        }

        socket.onmessage = (event) => {
            setLogs(prev => [...prev, event.data])
        }

        socket.onerror = () => {
            setError('WebSocket error')
            setLoading(false)
        }

        socket.onclose = (event) => {
            if (event.code !== 1000) {
                setError(`Disconnected: ${event.reason || 'Unexpected closure'}`)
            }
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose()
        }
    }

    return (
        <div className="overlay" style={{ zIndex: 3000 }} onKeyDown={handleKeyDown}>
            <div className="modal" style={{ width: '90%', height: '80%', display: 'flex', flexDirection: 'column', background: '#000', border: '1px solid var(--bg-accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #333' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Logs: {pod}</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
                            Auto-scroll
                        </label>
                    </div>
                    <button onClick={onClose} style={{ background: '#333', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}>✕ Close</button>
                </div>

                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '20px',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.85rem',
                        color: '#d1d5db',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.4'
                    }}
                >
                    {loading && <div style={{ color: 'var(--accent-blue)' }}>Connecting to log stream...</div>}
                    {error && <div style={{ color: 'var(--accent-rose)' }}>Error: {error}</div>}
                    {logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
                    ))}
                    {logs.length === 0 && !loading && !error && <div style={{ color: '#666' }}>No logs found yet. Tailing...</div>}
                </div>
            </div>
        </div>
    )
}
