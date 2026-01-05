import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getWsUrl } from '../services/api'
import 'xterm/css/xterm.css'

interface ShellViewProps {
    pod: string
    namespace: string
    container?: string
    onClose: () => void
}

export const ShellView = ({ pod, namespace, container, onClose }: ShellViewProps) => {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!terminalRef.current) return

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#000',
                foreground: '#fff',
                cyan: '#38bdf8'
            },
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 14,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)
        fitAddon.fit()
        term.focus()

        xtermRef.current = term

        const socket = new WebSocket(getWsUrl(`/ws/exec?pod=${pod}&namespace=${namespace}&container=${container || ''}`))
        wsRef.current = socket

        const startTime = Date.now()
        socket.onopen = () => {
            term.writeln('\x1b[1;34mConnected to pod ' + pod + '\x1b[0m')
        }

        socket.onmessage = (event) => {
            term.write(event.data)
        }

        socket.onclose = () => {
            term.writeln('\n\x1b[1;31mSession closed.\x1b[0m')
            // Only auto-close if the session lasted more than 2 seconds (likely a real session)
            if (Date.now() - startTime > 2000) {
                setTimeout(onClose, 1000)
            }
        }

        term.onData((data) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(data)
            }
        })

        const handleResize = () => fitAddon.fit()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            socket.close()
            term.dispose()
        }
    }, [pod, namespace, container])

    return (
        <div className="overlay" style={{ background: 'rgba(0,0,0,0.9)' }}>
            <div className="modal" style={{ width: '90%', height: '80%', padding: '0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: 'var(--accent-blue)', color: '#000', padding: '8px 15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Shell: {pod} ({container || 'default'})</span>
                    <span style={{ cursor: 'pointer' }} onClick={onClose}>[Esc] Close</span>
                </div>
                <div ref={terminalRef} style={{ flex: 1, padding: '10px' }} />
            </div>
        </div>
    )
}
