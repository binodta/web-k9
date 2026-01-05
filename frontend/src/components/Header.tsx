import { useState, useEffect } from 'react'
import { k8sApi } from '../services/api'
import type { ClusterInfo } from '../services/api'
import { parseCpu, parseMem } from '../utils/metrics'



export const Header = ({ namespace, onSwitchContext, onShowHelp }: {
    namespace: string,
    onSwitchContext: () => void,
    onShowHelp: () => void
}) => {
    const [info, setInfo] = useState<ClusterInfo | null>(null)
    const [metrics, setMetrics] = useState({ cpu: 0, mem: 0, cpuPct: 0, memPct: 0 })

    useEffect(() => {
        fetchInfo()
        fetchClusterMetrics()
        const interval = setInterval(fetchClusterMetrics, 10000)
        return () => clearInterval(interval)
    }, [])

    const fetchInfo = async () => {
        try {
            const data = await k8sApi.getClusterInfo()
            setInfo(data)
        } catch (err) {
            console.error('Failed to fetch cluster info', err)
        }
    }

    const fetchClusterMetrics = async () => {
        try {
            const [nodes, usage] = await Promise.all([
                k8sApi.getResources('nodes', ''),
                k8sApi.getTopNodes()
            ])

            let totalCpu = 0
            let totalMem = 0
            let usedCpu = 0
            let usedMem = 0

            nodes.items?.forEach((n: any) => {
                totalCpu += parseCpu(n.status.capacity.cpu)
                totalMem += parseMem(n.status.capacity.memory)
            })

            usage.items?.forEach((u: any) => {
                usedCpu += parseCpu(u.usage.cpu)
                usedMem += parseMem(u.usage.memory)
            })

            setMetrics({
                cpu: usedCpu,
                mem: usedMem,
                cpuPct: totalCpu > 0 ? Math.round((usedCpu / totalCpu) * 100) : 0,
                memPct: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0
            })
        } catch (err) {
            console.error('Failed to fetch cluster metrics', err)
        }
    }

    return (
        <div className="header-container">
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/logo.png" alt="WebK9 Logo" style={{ height: '32px', width: 'auto' }} />
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', paddingLeft: '20px', borderLeft: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Context</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--accent-blue)', fontWeight: '700', fontSize: '0.9rem' }}>{info?.context || '...'}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSwitchContext();
                                }}
                                style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    color: 'var(--accent-blue)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.6rem',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    transition: 'all 0.2s'
                                }}
                            >SWITCH</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cluster</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{info?.cluster || '...'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</span>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: '700', fontSize: '0.9rem' }}>{info?.user || '...'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>K8s Version</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>{info?.version || '...'}</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cluster CPU</div>
                        <div style={{ color: metrics.cpuPct > 80 ? 'var(--accent-rose)' : 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>
                            {metrics.cpuPct}% <span style={{ fontSize: '0.7rem', fontWeight: '400', color: 'var(--text-secondary)' }}>({Math.round(metrics.cpu)}m)</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cluster MEM</div>
                        <div style={{ color: metrics.memPct > 80 ? 'var(--accent-rose)' : 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>
                            {metrics.memPct}% <span style={{ fontSize: '0.7rem', fontWeight: '400', color: 'var(--text-secondary)' }}>({Math.round(metrics.mem / 1024)}Mi)</span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right', borderLeft: '1px solid var(--glass-border)', paddingLeft: '20px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Namespace</div>
                    <div style={{ color: 'var(--accent-emerald)', fontWeight: '600', fontSize: '0.9rem' }}>{namespace || 'all-namespaces'}</div>
                </div>
                <div style={{ height: '32px', width: '32px', background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-emerald) 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', color: '#000' }}>
                    K9
                </div>
                <button
                    onClick={onShowHelp}
                    className="help-button"
                    title="Keyboard Shortcuts (?)"
                    style={{ marginLeft: '10px' }}
                >
                    ?
                </button>
            </div>
        </div>
    )
}
