import { useState, useEffect, useRef, useMemo } from 'react'
import { k8sApi, getWsUrl } from '../services/api'
import { parseCpu, parseMem } from '../utils/metrics'

interface ResourceTableProps {
    type: string
    namespace: string
    labelSelector?: string
    fieldSelector?: string
    filterQuery?: string
    onSelect: (resource: Resource) => void
    onDescribe: (resource: Resource) => void
    onLogs?: (resource: Resource) => void
    disabled?: boolean
}

interface Resource {
    metadata: {
        name: string
        creationTimestamp: string
        labels?: Record<string, string>
        namespace?: string
    }
    kind?: string
    status?: any
    spec?: any
    data?: Record<string, any>
}

interface ResourceEvent {
    type: 'ADDED' | 'MODIFIED' | 'DELETED'
    object: Resource
}

interface PodMetrics {
    metadata: { name: string }
    containers: {
        name: string
        usage: {
            cpu: string
            memory: string
        }
    }[]
}

type SortField = 'name' | 'cpu' | 'mem' | 'age' | 'restarts'

// Metrics utility functions are now imported from ../utils/metrics

export const ResourceTable = ({ type, namespace, labelSelector = '', fieldSelector = '', filterQuery = '', onSelect, onDescribe, onLogs, disabled = false }: ResourceTableProps) => {
    const [resources, setResources] = useState<Resource[]>([])
    const [metrics, setMetrics] = useState<Record<string, { cpu: number, mem: number }>>({})
    const [loading, setLoading] = useState(true)
    const [metricsError, setMetricsError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDesc, setSortDesc] = useState(false)
    const ws = useRef<WebSocket | null>(null)
    const metricsIntervalRef = useRef<any>(null)

    const calculatePodMetrics = (pod: any) => {
        const usage = metrics[pod.metadata.name] || { cpu: 0, mem: 0 }

        let reqCpu = 0
        let reqMem = 0
        let limCpu = 0
        let limMem = 0

        pod.spec?.containers?.forEach((c: any) => {
            if (c.resources?.requests) {
                reqCpu += parseCpu(c.resources.requests.cpu)
                reqMem += parseMem(c.resources.requests.memory)
            }
            if (c.resources?.limits) {
                limCpu += parseCpu(c.resources.limits.cpu)
                limMem += parseMem(c.resources.limits.memory)
            }
        })

        return {
            cpu: usage.cpu,
            mem: usage.mem,
            cpuReqPct: reqCpu > 0 ? Math.round((usage.cpu / reqCpu) * 100) : 0,
            cpuLimPct: limCpu > 0 ? Math.round((usage.cpu / limCpu) * 100) : 0,
            memReqPct: reqMem > 0 ? Math.round((usage.mem / reqMem) * 100) : 0,
            memLimPct: limMem > 0 ? Math.round((usage.mem / limMem) * 100) : 0,
            restarts: pod.status?.containerStatuses?.reduce((acc: number, s: any) => acc + s.restartCount, 0) || 0
        }
    }

    const processedResources = useMemo(() => {
        let list = [...resources]

        // Filter
        if (filterQuery) {
            const query = filterQuery.toLowerCase()
            list = list.filter(res =>
                res.metadata.name.toLowerCase().includes(query) ||
                (res.status?.phase && res.status.phase.toLowerCase().includes(query))
            )
        }

        // Sort
        list.sort((a, b) => {
            let valA: any, valB: any

            switch (sortField) {
                case 'name':
                    valA = a.metadata.name
                    valB = b.metadata.name
                    break
                case 'age':
                    valA = new Date(a.metadata.creationTimestamp).getTime()
                    valB = new Date(b.metadata.creationTimestamp).getTime()
                    break
                case 'cpu':
                    valA = calculatePodMetrics(a).cpu
                    valB = calculatePodMetrics(b).cpu
                    break
                case 'mem':
                    valA = calculatePodMetrics(a).mem
                    valB = calculatePodMetrics(b).mem
                    break
                case 'restarts':
                    valA = calculatePodMetrics(a).restarts
                    valB = calculatePodMetrics(b).restarts
                    break
                default:
                    valA = a.metadata.name
                    valB = b.metadata.name
            }

            if (valA < valB) return sortDesc ? 1 : -1
            if (valA > valB) return sortDesc ? -1 : 1
            return 0
        })

        return list
    }, [resources, filterQuery, sortField, sortDesc, metrics])

    useEffect(() => {
        fetchInitial()
        const socket = connectWebSocket()
        setMetricsError(null)

        if (type === 'pods' || type === 'nodes') {
            fetchMetrics()
            metricsIntervalRef.current = setInterval(fetchMetrics, 5000)
        }

        return () => {
            if (socket) socket.close()
            if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current)
        }
    }, [type, namespace, labelSelector, fieldSelector])

    useEffect(() => {
        if (processedResources[selectedIndex]) {
            (window as any).webk9_selected_resource = processedResources[selectedIndex]
        }
    }, [processedResources, selectedIndex])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (disabled) return
            const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
            if (isInputFocused) return

            // Navigation
            if (e.key === 'j' || e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, processedResources.length - 1))
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
                if (processedResources[selectedIndex]) {
                    onSelect(processedResources[selectedIndex])
                }
            } else if (e.key === 'd') {
                if (processedResources[selectedIndex]) {
                    onDescribe(processedResources[selectedIndex])
                }
            } else if (e.key === 'l') {
                if (processedResources[selectedIndex] && type === 'pods' && onLogs) {
                    onLogs(processedResources[selectedIndex])
                }
            }

            // Sorting
            if (e.shiftKey) {
                switch (e.key) {
                    case 'C': setSortField('cpu'); setSortDesc(true); break
                    case 'M': setSortField('mem'); setSortDesc(true); break
                    case 'N': setSortField('name'); setSortDesc(false); break
                    case 'A': setSortField('age'); setSortDesc(true); break
                    case 'T': setSortField('restarts'); setSortDesc(true); break
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [processedResources, selectedIndex, onDescribe, onSelect, onLogs, type])

    useEffect(() => {
        setSelectedIndex(0)
    }, [filterQuery, type, namespace])

    const fetchInitial = async () => {
        setLoading(true)
        try {
            const res = await k8sApi.getResources(type, namespace, labelSelector, fieldSelector)
            let items = res.items || []
            if (type === 'namespaces') {
                const allItem = {
                    metadata: {
                        name: 'all',
                        creationTimestamp: new Date().toISOString()
                    },
                    status: { phase: 'Active' },
                    kind: 'Namespace'
                }
                items = [allItem, ...items]
            }
            setResources(items)
            setSelectedIndex(0)
        } catch (err) {
            console.error('Failed to fetch initial resources', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchMetrics = async () => {
        try {
            if (type === 'pods') {
                const data = await k8sApi.getTopPods(namespace)
                if (data.items) {
                    const metricsMap: Record<string, { cpu: number, mem: number }> = {}
                    data.items.forEach((m: PodMetrics) => {
                        let totalCpu = 0
                        let totalMem = 0
                        m.containers.forEach(c => {
                            totalCpu += parseCpu(c.usage.cpu)
                            totalMem += parseMem(c.usage.memory)
                        })
                        metricsMap[m.metadata.name] = { cpu: totalCpu, mem: totalMem }
                    })
                    setMetrics(metricsMap)
                }
            } else if (type === 'nodes') {
                const data = await k8sApi.getTopNodes()
                if (data.items) {
                    const metricsMap: Record<string, { cpu: number, mem: number }> = {}
                    data.items.forEach((m: any) => {
                        metricsMap[m.metadata.name] = {
                            cpu: parseCpu(m.usage.cpu),
                            mem: parseMem(m.usage.memory)
                        }
                    })
                    setMetrics(metricsMap)
                }
            }
        } catch (err: any) {
            console.error('Failed to fetch metrics', err)
            setMetricsError(err.message || 'Metrics unavailable')
            // Stop polling if metrics server is not available or times out
            if (metricsIntervalRef.current) {
                clearInterval(metricsIntervalRef.current)
                metricsIntervalRef.current = null
            }
        }
    }

    const connectWebSocket = () => {
        if (ws.current) ws.current.close()
        const socket = new WebSocket(getWsUrl(`/ws/resources?type=${type}&namespace=${namespace}&labelSelector=${encodeURIComponent(labelSelector)}&fieldSelector=${encodeURIComponent(fieldSelector)}`))
        ws.current = socket
        socket.onmessage = (event) => {
            const data: ResourceEvent = JSON.parse(event.data)
            setResources(prev => {
                switch (data.type) {
                    case 'ADDED':
                        if (prev.find(r => r.metadata.name === data.object.metadata.name)) return prev
                        return [...prev, data.object]
                    case 'MODIFIED':
                        return prev.map(r => r.metadata.name === data.object.metadata.name ? data.object : r)
                    case 'DELETED':
                        return prev.filter(r => r.metadata.name !== data.object.metadata.name)
                    default:
                        return prev
                }
            })
        }
        return socket
    }

    const formatAge = (timestamp: string) => {
        const start = new Date(timestamp).getTime()
        const now = new Date().getTime()
        const diff = Math.floor((now - start) / 1000)
        if (diff < 60) return `${diff}s`
        if (diff < 3600) return `${Math.floor(diff / 60)}m`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`
        return `${Math.floor(diff / 86400)}d`
    }

    const getColumns = () => {
        const showNamespace = namespace === ''
        const nsHeader = showNamespace ? <th>NAMESPACE {sortField === 'name' && (sortDesc ? '↓' : '↑')}</th> : null

        switch (type) {
            case 'pods':
                return (
                    <tr>
                        {nsHeader}
                        <th>NAME</th>
                        <th>READY</th>
                        <th>STATUS</th>
                        <th>RESTARTS</th>
                        <th>CPU</th>
                        <th>MEM</th>
                        <th>%CPU/R</th>
                        <th>%CPU/L</th>
                        <th>%MEM/R</th>
                        <th>%MEM/L</th>
                        <th>IP</th>
                        <th>NODE</th>
                        <th>AGE</th>
                    </tr>
                )
            case 'services':
                return (
                    <tr>
                        {nsHeader}
                        <th>NAME</th>
                        <th>TYPE</th>
                        <th>CLUSTER-IP</th>
                        <th>EXTERNAL-IP</th>
                        <th>PORTS</th>
                        <th>AGE</th>
                    </tr>
                )
            case 'nodes':
                return (
                    <tr>
                        <th>NAME</th>
                        <th>STATUS</th>
                        <th>ROLES</th>
                        <th>VERSION</th>
                        <th>CPU CORE</th>
                        <th>MEM Mi</th>
                        <th>%CPU</th>
                        <th>%MEM</th>
                        <th>INTERNAL-IP</th>
                        <th>AGE</th>
                    </tr>
                )
            case 'namespaces':
                return (
                    <tr>
                        <th>NAME</th>
                        <th>STATUS</th>
                        <th>AGE</th>
                    </tr>
                )
            default:
                return (
                    <tr>
                        {nsHeader}
                        <th>NAME</th>
                        <th>STATUS</th>
                        {['configmaps', 'secrets'].includes(type) && <th>DATA</th>}
                        <th>AGE</th>
                    </tr>
                )
        }
    }

    if (loading) return (
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--bg-accent)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>Streaming {type}...</div>
        </div>
    )

    const showNamespace = namespace === ''

    return (
        <>
            {metricsError && (
                <div style={{
                    padding: '8px 16px',
                    marginBottom: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    color: 'var(--accent-rose)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <div>
                        <strong>Metrics server unavailable:</strong> {metricsError}.
                        Resource usage information will be hidden.
                    </div>
                </div>
            )}
            <table className="resource-table">
                <thead>
                    {getColumns()}
                </thead>
                <tbody>
                    {processedResources.length === 0 ? (
                        <tr>
                            <td colSpan={20} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                <div style={{ opacity: 0.5, marginBottom: '8px' }}>No items discovered</div>
                                <div style={{ fontSize: '0.75rem' }}>{filterQuery ? `No results for "${filterQuery}"` : `No ${type} found in this context`}</div>
                            </td>
                        </tr>
                    ) : (
                        processedResources.map((res, index) => {
                            const podMetrics = type === 'pods' ? calculatePodMetrics(res) : null
                            const isSuccess = ['Running', 'Active', 'Bound', 'True', 'Ready', 'Succeeded'].includes(res.status?.phase) ||
                                res.status?.conditions?.some((c: any) => (c.type === 'Available' || c.type === 'Ready') && c.status === 'True')

                            const isAllNs = type === 'namespaces' && res.metadata.name === 'all'

                            return (
                                <tr
                                    key={`${res.metadata.namespace || ''}-${res.metadata.name}`}
                                    onClick={() => { setSelectedIndex(index) }}
                                    onDoubleClick={() => {
                                        if (isAllNs) {
                                            onSelect({ ...res, metadata: { ...res.metadata, name: '' } })
                                        } else {
                                            onSelect(res)
                                        }
                                    }}
                                    className={index === selectedIndex ? 'focused-row' : ''}
                                >
                                    {showNamespace && !['nodes', 'namespaces'].includes(type) && (
                                        <td style={{ color: 'var(--accent-blue)', fontWeight: '500', fontSize: '0.75rem' }}>{res.metadata.namespace}</td>
                                    )}
                                    <td style={{ fontWeight: '600', color: isAllNs ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                                        {isAllNs ? '★ ALL NAMESPACES' : res.metadata.name}
                                    </td>

                                    {type === 'pods' && (
                                        <>
                                            <td style={{ fontWeight: '500' }}>{res.status?.containerStatuses?.filter((s: any) => s.ready).length || 0}/{res.status?.containerStatuses?.length || 0}</td>
                                            <td>
                                                <span className={`badge ${isSuccess ? 'badge-success' : 'badge-warning'}`}>
                                                    {res.status?.phase || 'Pending'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{podMetrics?.restarts}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '500' }}>{Math.round(podMetrics?.cpu || 0)}m</td>
                                            <td style={{ textAlign: 'right', fontWeight: '500' }}>{Math.round((podMetrics?.mem || 0) / 1024)} Mi</td>
                                            <td style={{ textAlign: 'right', color: (podMetrics?.cpuReqPct || 0) > 100 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>{podMetrics?.cpuReqPct}%</td>
                                            <td style={{ textAlign: 'right', color: (podMetrics?.cpuLimPct || 0) > 100 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>{podMetrics?.cpuLimPct}%</td>
                                            <td style={{ textAlign: 'right', color: (podMetrics?.memReqPct || 0) > 100 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>{podMetrics?.memReqPct}%</td>
                                            <td style={{ textAlign: 'right', color: (podMetrics?.memLimPct || 0) > 100 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>{podMetrics?.memLimPct}%</td>
                                            <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{res.status?.podIP || '---'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{res.spec?.nodeName || '---'}</td>
                                        </>
                                    )}

                                    {type === 'services' && (
                                        <>
                                            <td>{res.spec?.type}</td>
                                            <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>{res.spec?.clusterIP}</td>
                                            <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>{res.status?.loadBalancer?.ingress?.[0]?.ip || '<none>'}</td>
                                            <td>{res.spec?.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(',')}</td>
                                        </>
                                    )}

                                    {type === 'nodes' && (
                                        <>
                                            <td>
                                                <span className={`badge ${isSuccess ? 'badge-success' : 'badge-warning'}`}>
                                                    {res.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.75rem' }}>{Object.keys(res.metadata.labels || {}).filter(l => l.includes('node-role')).map(l => l.split('/').pop()).join(',') || '<none>'}</td>
                                            <td style={{ fontSize: '0.75rem' }}>{res.status?.nodeInfo?.kubeletVersion}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '500' }}>{Math.round(metrics[res.metadata.name]?.cpu || 0)}m</td>
                                            <td style={{ textAlign: 'right', fontWeight: '500' }}>{Math.round((metrics[res.metadata.name]?.mem || 0) / 1024)} Mi</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {res.status?.capacity ? Math.round((metrics[res.metadata.name]?.cpu || 0) / (parseCpu(res.status.capacity.cpu) || 1) * 100) : 0}%
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {res.status?.capacity ? Math.round((metrics[res.metadata.name]?.mem || 0) / (parseMem(res.status.capacity.memory) || 1) * 100) : 0}%
                                            </td>
                                            <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>{res.status?.addresses?.find((a: any) => a.type === 'InternalIP')?.address}</td>
                                        </>
                                    )}

                                    {type === 'namespaces' && (
                                        <td>
                                            <span className={`badge ${res.status?.phase === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                                                {res.status?.phase}
                                            </span>
                                        </td>
                                    )}

                                    {(!['pods', 'services', 'nodes', 'namespaces'].includes(type)) && (
                                        <>
                                            <td>
                                                <span className={`badge ${isSuccess ? 'badge-success' : 'badge-warning'}`}>
                                                    {res.status?.phase || 'Active'}
                                                </span>
                                            </td>
                                            {['configmaps', 'secrets'].includes(type) && (
                                                <td style={{ textAlign: 'center' }}>{Object.keys(res.data || {}).length}</td>
                                            )}
                                        </>
                                    )}

                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'right' }}>{formatAge(res.metadata.creationTimestamp)}</td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </>
    )
}
