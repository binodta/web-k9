import { useState, useEffect } from 'react'
import { k8sApi } from '../services/api'

interface YamlEditorProps {
    type: string
    name: string
    namespace: string
    onClose: () => void
    readOnly?: boolean
}

export const YamlEditor = ({ type, name, namespace, onClose, readOnly = false }: YamlEditorProps) => {
    const [yaml, setYaml] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchYaml()
    }, [type, name, namespace])

    const fetchYaml = async () => {
        setLoading(true)
        try {
            const text = await k8sApi.getResourceYaml(type, name, namespace)
            setYaml(text)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (readOnly) return
        setSaving(true)
        try {
            await k8sApi.updateResourceYaml(type, name, namespace, yaml)
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="overlay" style={{ background: 'rgba(0,0,0,0.9)' }}>
            <div className="modal" style={{ width: '800px', height: '80%', padding: '0', display: 'flex', flexDirection: 'column', border: '2px solid var(--accent-blue)' }}>
                <div style={{ background: 'var(--accent-blue)', color: '#000', padding: '8px 15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{readOnly ? 'VIEW' : 'EDIT'}: {type}/{name}</span>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        {!readOnly && <span style={{ cursor: 'pointer' }} onClick={handleSave}>{saving ? 'Saving...' : '[Ctrl+S] Save'}</span>}
                        <span style={{ cursor: 'pointer' }} onClick={onClose}>[Esc] Close</span>
                    </div>
                </div>

                <div style={{ flex: 1, position: 'relative', background: '#000' }}>
                    {loading ? (
                        <div style={{ padding: '20px', color: 'var(--accent-blue)' }}>Loading YAML...</div>
                    ) : error ? (
                        <div style={{ padding: '20px', color: 'var(--accent-rose)' }}>{error}</div>
                    ) : (
                        <textarea
                            value={yaml}
                            onChange={(e) => setYaml(e.target.value)}
                            readOnly={readOnly}
                            spellCheck={false}
                            style={{
                                width: '100%',
                                height: '100%',
                                background: 'transparent',
                                color: '#fff',
                                border: 'none',
                                padding: '20px',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.9rem',
                                lineHeight: '1.4',
                                outline: 'none',
                                resize: 'none',
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault()
                                    handleSave()
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
