import { useState, useEffect, isValidElement } from 'react'
import { k8sApi } from '../services/api'
import { parseCpu, parseMem } from '../utils/metrics'

interface ResourceDetailProps {
    type: string
    name: string
    namespace: string
    onClose: () => void
}

export const ResourceDetail = ({ type, name, namespace, onClose }: ResourceDetailProps) => {
    const [data, setData] = useState<any>(null)
    const [events, setEvents] = useState<any[]>([])
    const [nodePods, setNodePods] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [view, setView] = useState<'describe' | 'json'>('describe')
    const [showDecoded, setShowDecoded] = useState(false)

    useEffect(() => {
        fetchData()
    }, [type, name, namespace])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
            if (e.key === 'x' || e.key === 'X') {
                setShowDecoded(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [jsonData, jsonEvents] = await Promise.all([
                k8sApi.getResource(type, name, namespace),
                k8sApi.getEvents(type, name, namespace)
            ])

            setData(jsonData)
            setEvents(jsonEvents?.items || [])

            if (type === 'nodes') {
                const pods = await k8sApi.getResources('pods', '', '', `spec.nodeName=${name}`)
                setNodePods(pods?.items || [])
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const renderSection = (title: string, content: React.ReactNode) => (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ color: 'var(--accent-blue)', fontWeight: 'bold', borderBottom: '1px solid var(--bg-accent)', marginBottom: '10px', paddingBottom: '4px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>
                {title}
            </div>
            {content}
        </div>
    )

    const renderPair = (label: string, value: any) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px', marginBottom: '4px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}:</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                {isValidElement(value) ? value : (typeof value === 'object' && value !== null ? JSON.stringify(value) : (value || '<none>'))}
            </div>
        </div>
    )

    const syntaxHighlight = (json: string) => {
        if (!json) return null
        return json.split('\n').map((line, i) => {
            const highlighted = line
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
                    let cls = 'json-number'
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'json-key'
                        } else {
                            cls = 'json-string'
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'json-boolean'
                    } else if (/null/.test(match)) {
                        cls = 'json-null'
                    }
                    return `<span class="${cls}">${match}</span>`
                })
            return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted }} />
        })
    }

    const formatAge = (timestamp: string) => {
        if (!timestamp) return 'N/A'
        const start = new Date(timestamp).getTime()
        const now = new Date().getTime()
        const diff = Math.floor((now - start) / 1000)

        if (diff < 60) return `${diff}s`
        if (diff < 3600) return `${Math.floor(diff / 60)}m`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`
        return `${Math.floor(diff / 86400)}d`
    }

    const formatProbe = (probe: any) => {
        if (!probe) return 'none'
        const parts = []
        if (probe.httpGet) {
            parts.push(`http-get http://:${probe.httpGet.port}${probe.httpGet.path || ''}`)
        } else if (probe.exec) {
            parts.push(`exec [${probe.exec.command?.join(' ')}]`)
        } else if (probe.tcpSocket) {
            parts.push(`tcp-socket :${probe.tcpSocket.port}`)
        } else if (probe.grpc) {
            parts.push(`grpc :${probe.grpc.port}`)
        }

        if (probe.initialDelaySeconds) parts.push(`delay=${probe.initialDelaySeconds}s`)
        if (probe.timeoutSeconds) parts.push(`timeout=${probe.timeoutSeconds}s`)
        if (probe.periodSeconds) parts.push(`period=${probe.periodSeconds}s`)
        if (probe.successThreshold) parts.push(`#success=${probe.successThreshold}`)
        if (probe.failureThreshold) parts.push(`#failure=${probe.failureThreshold}`)

        return parts.join(' ')
    }

    const renderContainer = (container: any, status: any): React.ReactNode => {
        const cStatus = status?.containerStatuses?.find((s: any) => s.name === container.name)
        return (
            <div key={container.name} style={{ marginLeft: '10px' }}>
                {renderPair('Image', container.image)}
                {renderPair('Image ID', cStatus?.imageID)}
                {renderPair('Port', container.ports?.map((p: any) => `${p.containerPort}/${p.protocol}`).join(', '))}
                {renderPair('Ready', cStatus?.ready ? 'True' : 'False')}
                {renderPair('Restart Count', cStatus?.restartCount || 0)}

                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ gridColumn: '1 / span 2' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-blue)', marginBottom: '4px' }}>Probes:</div>
                        {renderPair('Liveness', formatProbe(container.livenessProbe))}
                        {renderPair('Readiness', formatProbe(container.readinessProbe))}
                        {renderPair('Startup', formatProbe(container.startupProbe))}
                    </div>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-blue)', marginBottom: '4px' }}>Resources:</div>
                        {renderPair('Limits', container.resources?.limits ? JSON.stringify(container.resources.limits) : 'none')}
                        {renderPair('Requests', container.resources?.requests ? JSON.stringify(container.resources.requests) : 'none')}
                    </div>
                </div>

                <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>Environment:</div>
                <div style={{ marginLeft: '10px', fontSize: '0.85rem' }}>
                    {container.env ? container.env.map((e: any) => {
                        let value = e.value || '<none>'
                        if (e.valueFrom) {
                            if (e.valueFrom.secretKeyRef) {
                                const ref = e.valueFrom.secretKeyRef
                                value = (
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        {`<set to the key '${ref.key}' in secret '${ref.name}'>`}
                                        <span style={{ marginLeft: '20px' }}>Optional: {ref.optional ? 'true' : 'false'}</span>
                                    </span>
                                )
                            } else if (e.valueFrom.configMapKeyRef) {
                                const ref = e.valueFrom.configMapKeyRef
                                value = (
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        {`<set to the key '${ref.key}' in configmap '${ref.name}'>`}
                                        <span style={{ marginLeft: '20px' }}>Optional: {ref.optional ? 'true' : 'false'}</span>
                                    </span>
                                )
                            } else if (e.valueFrom.fieldRef) {
                                value = <span style={{ color: 'var(--text-secondary)' }}>{`<fieldRef: ${e.valueFrom.fieldRef.fieldPath}>`}</span>
                            } else if (e.valueFrom.resourceFieldRef) {
                                value = <span style={{ color: 'var(--text-secondary)' }}>{`<resourceFieldRef: ${e.valueFrom.resourceFieldRef.resource}>`}</span>
                            }
                        }
                        return <div key={e.name}><span style={{ color: 'var(--accent-blue)' }}>{e.name}</span>: {value}</div>
                    }) : '<none>'}
                </div>

                <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>Mounts:</div>
                <div style={{ marginLeft: '10px', fontSize: '0.85rem' }}>
                    {container.volumeMounts ? container.volumeMounts.map((m: any) => (
                        <div key={m.name}><span style={{ color: 'var(--text-secondary)' }}>{m.mountPath}</span> from {m.name} ({m.readOnly ? 'ro' : 'rw'})</div>
                    )) : '<none>'}
                </div>
            </div>
        )
    }

    const renderDescribe = () => {
        if (!data || !data.metadata) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>No resource data available.</div>
        const { metadata, status = {}, spec = {}, data: resourceData } = data

        return (
            <div style={{ padding: '10px' }}>
                {renderSection('Overview', (
                    <>
                        {renderPair('Name', metadata.name)}
                        {renderPair('Namespace', metadata.namespace)}
                        {renderPair('Kind', data.kind)}
                        {renderPair('API Version', data.apiVersion)}
                        {renderPair('Creation', new Date(metadata.creationTimestamp).toLocaleString())}
                        {renderPair('Labels', metadata.labels ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {Object.entries(metadata.labels as Record<string, string>).map(([k, v]) => (
                                    <span key={k} style={{ background: 'var(--bg-accent)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{k}={v}</span>
                                ))}
                            </div>
                        ) : 'none')}
                        {renderPair('Annotations', metadata.annotations ? (
                            <div style={{ fontSize: '0.8rem' }}>
                                {Object.entries(metadata.annotations as Record<string, string>).filter(([k]) => !k.includes('kubectl.kubernetes.io')).map(([k, v]) => (
                                    <div key={k} style={{ marginBottom: '2px' }}><span style={{ color: 'var(--accent-blue)' }}>{k}</span>: {v}</div>
                                ))}
                            </div>
                        ) : 'none')}
                        {renderPair('Controlled By', metadata.ownerReferences?.[0]?.name ? `${metadata.ownerReferences[0].kind}/${metadata.ownerReferences[0].name}` : 'none')}
                        {type === 'nodes' && (
                            <>
                                {renderPair('Taints', spec.taints?.map((t: any) => `${t.key}${t.value ? `=${t.value}` : ''}:${t.effect}`).join(', ') || '<none>')}
                                {renderPair('Unschedulable', spec.unschedulable ? 'true' : 'false')}
                            </>
                        )}
                    </>
                ))}

                {type === 'pods' && (
                    <>
                        {renderSection('Status', (
                            <>
                                {renderPair('Status', status.phase)}
                                {renderPair('Reason', status.reason)}
                                {renderPair('Message', status.message)}
                                {renderPair('IP', status.podIP)}
                                {renderPair('Host IP', status.hostIP)}
                                {renderPair('QoS Class', status.qosClass)}
                                {renderPair('Node', spec.nodeName)}
                            </>
                        ))}

                        {spec.initContainers && spec.initContainers.map((container: any) => (
                            renderSection(`Init-Container: ${container.name}`, renderContainer(container, status))
                        ))}

                        {spec.containers && spec.containers.map((container: any) => (
                            renderSection(`Container: ${container.name}`, renderContainer(container, status))
                        ))}
                    </>
                )}

                {type === 'services' && (
                    <>
                        {renderSection('Service Details', (
                            <>
                                {renderPair('Type', spec.type)}
                                {renderPair('IP', spec.clusterIP)}
                                {renderPair('LoadBalancer IP', status.loadBalancer?.ingress?.[0]?.ip || status.loadBalancer?.ingress?.[0]?.hostname || 'none')}
                                {renderPair('External IPs', spec.externalIPs?.join(', ') || 'none')}
                                {renderPair('Selector', spec.selector ? Object.entries(spec.selector).map(([k, v]) => `${k}=${v}`).join(', ') : 'none')}
                                {renderPair('Ports', spec.ports ? spec.ports.map((p: any) => `${p.port}/${p.protocol}${p.targetPort ? ` -> ${p.targetPort}` : ''}`).join(', ') : 'none')}
                                {renderPair('Session Affinity', spec.sessionAffinity || 'none')}
                            </>
                        ))}
                    </>
                )}

                {type === 'nodes' && (
                    <>
                        {renderSection('Node Info', (
                            <>
                                {renderPair('Addresses', status.addresses?.map((a: any) => `${a.type}: ${a.address}`).join(', '))}
                                {renderPair('Kernel Version', status.nodeInfo?.kernelVersion)}
                                {renderPair('OS Image', status.nodeInfo?.osImage)}
                                {renderPair('Container Runtime', status.nodeInfo?.containerRuntimeVersion)}
                                {renderPair('Kubelet Version', status.nodeInfo?.kubeletVersion)}
                                {renderPair('Architecture', status.nodeInfo?.architecture)}
                            </>
                        ))}
                        {renderSection('Resource Capacity', (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-accent)' }}>
                                        <th style={{ padding: '8px' }}>Resource</th>
                                        <th style={{ padding: '8px' }}>Capacity</th>
                                        <th style={{ padding: '8px' }}>Allocatable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {['cpu', 'memory', 'pods', 'ephemeral-storage'].map(res => (
                                        <tr key={res} style={{ borderBottom: '1px solid var(--bg-accent)' }}>
                                            <td style={{ padding: '8px', textTransform: 'capitalize' }}>{res}</td>
                                            <td style={{ padding: '8px' }}>{status.capacity?.[res]}</td>
                                            <td style={{ padding: '8px' }}>{status.allocatable?.[res]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ))}

                        {renderSection('Non-terminated Pods', (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-accent)' }}>
                                        <th style={{ padding: '8px' }}>Namespace</th>
                                        <th style={{ padding: '8px' }}>Name</th>
                                        <th style={{ padding: '8px' }}>CPU Req</th>
                                        <th style={{ padding: '8px' }}>CPU Lim</th>
                                        <th style={{ padding: '8px' }}>Mem Req</th>
                                        <th style={{ padding: '8px' }}>Mem Lim</th>
                                        <th style={{ padding: '8px' }}>Age</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nodePods.map(pod => {
                                        let cpuReq = 0, cpuLim = 0, memReq = 0, memLim = 0
                                        pod.spec?.containers?.forEach((c: any) => {
                                            cpuReq += parseCpu(c.resources?.requests?.cpu)
                                            cpuLim += parseCpu(c.resources?.limits?.cpu)
                                            memReq += parseMem(c.resources?.requests?.memory)
                                            memLim += parseMem(c.resources?.limits?.memory)
                                        })
                                        return (
                                            <tr key={pod.metadata.name} style={{ borderBottom: '1px solid var(--bg-accent)' }}>
                                                <td style={{ padding: '8px' }}>{pod.metadata.namespace}</td>
                                                <td style={{ padding: '8px', color: 'var(--accent-blue)' }}>{pod.metadata.name}</td>
                                                <td style={{ padding: '8px' }}>{Math.round(cpuReq)}m</td>
                                                <td style={{ padding: '8px' }}>{cpuLim ? `${Math.round(cpuLim)}m` : '0'}</td>
                                                <td style={{ padding: '8px' }}>{Math.round(memReq / 1024)}Mi</td>
                                                <td style={{ padding: '8px' }}>{memLim ? `${Math.round(memLim / 1024)}Mi` : '0'}</td>
                                                <td style={{ padding: '8px' }}>{formatAge(pod.metadata.creationTimestamp)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        ))}

                        {(() => {
                            let totalCpuReq = 0, totalCpuLim = 0, totalMemReq = 0, totalMemLim = 0
                            nodePods.forEach(pod => {
                                pod.spec?.containers?.forEach((c: any) => {
                                    totalCpuReq += parseCpu(c.resources?.requests?.cpu)
                                    totalCpuLim += parseCpu(c.resources?.limits?.cpu)
                                    totalMemReq += parseMem(c.resources?.requests?.memory)
                                    totalMemLim += parseMem(c.resources?.limits?.memory)
                                })
                            })
                            const allocCpu = parseCpu(status.allocatable?.cpu) || 1
                            const allocMem = parseMem(status.allocatable?.memory) || 1

                            return renderSection('Allocated Resources', (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-accent)' }}>
                                            <th style={{ padding: '8px' }}>Resource</th>
                                            <th style={{ padding: '8px' }}>Requests</th>
                                            <th style={{ padding: '8px' }}>Limits</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid var(--bg-accent)' }}>
                                            <td style={{ padding: '8px' }}>CPU</td>
                                            <td style={{ padding: '8px' }}>{Math.round(totalCpuReq)}m ({Math.round(totalCpuReq / allocCpu * 100)}%)</td>
                                            <td style={{ padding: '8px' }}>{Math.round(totalCpuLim)}m ({Math.round(totalCpuLim / allocCpu * 100)}%)</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid var(--bg-accent)' }}>
                                            <td style={{ padding: '8px' }}>Memory</td>
                                            <td style={{ padding: '8px' }}>{Math.round(totalMemReq / 1024)}Mi ({Math.round(totalMemReq / allocMem * 100)}%)</td>
                                            <td style={{ padding: '8px' }}>{Math.round(totalMemLim / 1024)}Mi ({Math.round(totalMemLim / allocMem * 100)}%)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ))
                        })()}
                    </>
                )}

                {['configmaps', 'secrets'].includes(type) && resourceData && (
                    renderSection(`Data ${type === 'secrets' && showDecoded ? '(Decoded)' : ''}`, (
                        <div style={{ marginLeft: '10px' }}>
                            {Object.entries(resourceData).map(([key, value]) => (
                                <div key={key} style={{ marginBottom: '15px' }}>
                                    <div style={{ color: 'var(--accent-blue)', fontWeight: 'bold', marginBottom: '5px' }}>{key}: ({typeof value === 'string' ? (type === 'secrets' && !showDecoded ? Math.round(value.length * 0.75) : value.length) : 'N/A'} bytes)</div>
                                    <pre style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'auto', maxHeight: '200px', fontSize: '0.85rem' }}>
                                        {type === 'secrets' ? (showDecoded ? atob(value as string) : '[masked binary data or secret value]') : (typeof value === 'string' ? value : JSON.stringify(value, null, 2))}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    ))
                )}

                {status.conditions && renderSection('Conditions', (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-accent)' }}>
                                <th style={{ padding: '8px' }}>Type</th>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px' }}>Reason</th>
                                <th style={{ padding: '8px' }}>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            {status.conditions.map((c: any) => (
                                <tr key={c.type} style={{ borderBottom: '1px solid var(--bg-accent)' }}>
                                    <td style={{ padding: '8px' }}>{c.type}</td>
                                    <td style={{ padding: '8px', color: c.status === 'True' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>{c.status}</td>
                                    <td style={{ padding: '8px' }}>{c.reason}</td>
                                    <td style={{ padding: '8px' }}>{c.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}

                {spec.volumes && renderSection('Volumes', (
                    <div style={{ marginLeft: '10px' }}>
                        {spec.volumes.map((v: any) => (
                            <div key={v.name} style={{ marginBottom: '10px' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{v.name}:</div>
                                <div style={{ marginLeft: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {JSON.stringify(Object.values(v).find((_, idx) => Object.keys(v)[idx] !== 'name'))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {renderSection('Events', (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-accent)' }}>
                                <th style={{ padding: '8px' }}>Type</th>
                                <th style={{ padding: '8px' }}>Reason</th>
                                <th style={{ padding: '8px' }}>Age</th>
                                <th style={{ padding: '8px' }}>From</th>
                                <th style={{ padding: '8px' }}>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>No events found.</td></tr>
                            ) : (
                                events.sort((a, b) => new Date(b.lastTimestamp || b.eventTime).getTime() - new Date(a.lastTimestamp || a.eventTime).getTime()).map((e: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--bg-accent)' }}>
                                        <td style={{ padding: '8px', color: e.type === 'Warning' ? 'var(--accent-rose)' : 'inherit' }}>{e.type}</td>
                                        <td style={{ padding: '8px' }}>{e.reason}</td>
                                        <td style={{ padding: '8px' }}>{formatAge(e.lastTimestamp || e.eventTime)}</td>
                                        <td style={{ padding: '8px' }}>{e.source?.component || e.reportingComponent}</td>
                                        <td style={{ padding: '8px' }}>{e.message}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                ))}
            </div>
        )
    }

    return (
        <div className="overlay" style={{ zIndex: 2000 }}>
            <div className="modal" style={{ width: '90%', height: '90%', maxWidth: 'none', display: 'flex', flexDirection: 'column', background: 'rgba(5, 7, 10, 0.95)', border: '1px solid var(--bg-accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 20px', borderBottom: '1px solid var(--bg-accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                        <h3 style={{ textTransform: 'capitalize', margin: 0, color: 'var(--accent-emerald)' }}>{type}: {name}</h3>
                        <div className="tab-group" style={{ display: 'inline-flex', gap: '5px' }}>
                            <button
                                onClick={() => setView('describe')}
                                style={{ ...tabStyle, borderBottom: view === 'describe' ? '2px solid var(--accent-blue)' : 'none', color: view === 'describe' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                            >DESCRIBE</button>
                            <button
                                onClick={() => setView('json')}
                                style={{ ...tabStyle, borderBottom: view === 'json' ? '2px solid var(--accent-blue)' : 'none', color: view === 'json' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                            >JSON</button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {type === 'secrets' && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '15px' }}>
                                <span><span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>&lt;x&gt;</span> {showDecoded ? 'Mask' : 'Decode'} Secret</span>
                            </div>
                        )}
                        <button onClick={onClose} style={closeButtonStyle}>✕ Close</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
                    {loading && <div className="loading">Fetching details...</div>}
                    {error && <div style={{ color: 'var(--accent-rose)', padding: '20px' }}>Error: {error}</div>}

                    {!loading && !error && data && (
                        <div style={{ background: '#000', padding: '20px', borderRadius: '8px', minHeight: '100%' }}>
                            {view === 'json' ? (
                                <pre className="json-pre" style={{ margin: 0, fontFamily: 'JetBrains Mono', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                    {syntaxHighlight(JSON.stringify(data, null, 2))}
                                </pre>
                            ) : (
                                renderDescribe()
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const closeButtonStyle = {
    background: 'var(--bg-accent)',
    color: 'var(--text-primary)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600'
}

const tabStyle = {
    background: 'transparent',
    border: 'none',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    letterSpacing: '1px',
    transition: 'all 0.2s'
}
