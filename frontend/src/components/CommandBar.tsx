import { useState, useEffect, useRef } from 'react'
import { RESOURCE_ALIASES } from '../utils/resources'

interface CommandBarProps {
    mode: 'command' | 'filter'
    onExecute: (cmd: string) => void
    onClose: () => void
    apiResources: any[]
    initialValue?: string
}

const COMMON_COMMANDS = ['all', '0', 'ns ']

export const CommandBar = ({ mode, onExecute, onClose, apiResources, initialValue = '' }: CommandBarProps) => {
    const [value, setValue] = useState(initialValue)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        if (mode === 'command' && value.trim()) {
            const query = value.toLowerCase().trim()

            // Build dynamic aliases from apiResources
            const dynamicAliases: string[] = []
            apiResources.forEach(res => {
                dynamicAliases.push(res.name.toLowerCase())
                if (res.shortNames) {
                    res.shortNames.forEach((sn: string) => dynamicAliases.push(sn.toLowerCase()))
                }
                dynamicAliases.push(res.kind.toLowerCase())
            })

            const matches = [
                ...dynamicAliases,
                ...Object.keys(RESOURCE_ALIASES), // Keep old ones for backward compatibility
                ...COMMON_COMMANDS
            ].filter(cmd => cmd.toLowerCase().startsWith(query))

            const uniqueMatches = Array.from(new Set(matches)).sort()
            setSuggestions(uniqueMatches)
            setSelectedIndex(0)
        } else {
            setSuggestions([])
        }
    }, [value, mode, apiResources])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (suggestions.length > 0 && selectedIndex >= 0) {
                const selected = suggestions[selectedIndex]
                onExecute(selected)
            } else {
                onExecute(value)
            }
            onClose()
        } else if (e.key === 'Escape') {
            onClose()
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => (prev + 1) % suggestions.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
        } else if (e.key === 'Tab') {
            e.preventDefault()
            if (suggestions.length > 0) {
                setValue(suggestions[selectedIndex])
            }
        }
    }

    return (
        <div className="command-bar-wrapper">
            {mode === 'command' && suggestions.length > 0 && (
                <div className="command-suggestions">
                    {suggestions.map((s, i) => (
                        <div
                            key={s}
                            className={`suggestion-item ${i === selectedIndex ? 'active' : ''}`}
                            onClick={() => {
                                onExecute(s)
                                onClose()
                            }}
                        >
                            <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>:</span>
                            {s}
                        </div>
                    ))}
                </div>
            )}
            <div className="command-bar">
                <div className="command-mode-indicator">
                    {mode === 'command' ? 'CMD :' : 'FIL /'}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === 'command' ? 'type a command...' : 'filter resources...'}
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', marginLeft: '12px', borderLeft: '1px solid var(--glass-border)', paddingLeft: '12px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ background: 'var(--bg-accent)', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>TAB</span>
                        <span>complete</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ background: 'var(--bg-accent)', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>ENTER</span>
                        <span>go</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

