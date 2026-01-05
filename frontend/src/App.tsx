import './index.css'
import { ResourceTable } from './components/ResourceTable'
import { ResourceDetail } from './components/ResourceDetail'
import { CommandBar } from './components/CommandBar'
import { LogViewer } from './components/LogViewer'
import { Header } from './components/Header'
import { HelpMenu } from './components/HelpMenu'
import { ShellView } from './components/ShellView'
import { YamlEditor } from './components/YamlEditor'
import { useK8s } from './hooks/useK8s'
import { useUIState } from './hooks/useUIState'
import { useKeyboard } from './hooks/useKeyboard'
import { k8sApi } from './services/api'
import { RESOURCE_ALIASES } from './utils/resources'



function App() {
  const k8s = useK8s()
  const ui = useUIState()

  const handleCommand = (cmd: string) => {
    const cleanCmd = cmd.trim().toLowerCase()

    // Build map from discovery info
    const discoveryMap: Record<string, string> = {}
    k8s.apiResources.forEach(res => {
      discoveryMap[res.name.toLowerCase()] = res.name.toLowerCase()
      discoveryMap[res.kind.toLowerCase()] = res.name.toLowerCase()
      if (res.shortNames) {
        res.shortNames.forEach((sn: string) => {
          discoveryMap[sn.toLowerCase()] = res.name.toLowerCase()
        })
      }
    })

    const finalAliases = { ...RESOURCE_ALIASES, ...discoveryMap }

    if (finalAliases[cleanCmd]) {
      k8s.setResourceType(finalAliases[cleanCmd])
      k8s.setLabelSelector('')
      k8s.setFieldSelector('')
      k8s.setDrillDownName(null)
      // Basic check for cluster-scoped resources (heuristic) -- namespaced: false is better
      const res = k8s.apiResources.find(r => r.name.toLowerCase() === finalAliases[cleanCmd])
      if (res && !res.namespaced) {
        k8s.setSelectedNamespace('')
      }
    } else if (cleanCmd.startsWith('ns ') || cleanCmd.startsWith('namespace ')) {
      const parts = cleanCmd.split(' ')
      const ns = parts[parts.length - 1]
      if (ns) {
        k8s.setSelectedNamespace(ns)
        k8s.setResourceType('pods')
        k8s.setLabelSelector('')
        k8s.setFieldSelector('')
        k8s.setDrillDownName(null)
      }
    } else if (cleanCmd === 'all' || cleanCmd === '0') {
      k8s.setSelectedNamespace('')
      k8s.setLabelSelector('')
      k8s.setFieldSelector('')
      k8s.setDrillDownName(null)
    }

    ui.setCommandMode(null)
  }

  const handleSelect = (resource: any) => {
    if (k8s.resourceType === 'deployments' || k8s.resourceType === 'statefulsets') {
      const selector = resource.spec?.selector?.matchLabels
      if (selector) {
        const selectorStr = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',')
        k8s.setFieldSelector('')
        k8s.setLabelSelector(selectorStr)
        k8s.setResourceType('pods')
        k8s.setDrillDownName(resource.metadata.name)
      }
    } else if (k8s.resourceType === 'services') {
      const selector = resource.spec?.selector
      if (selector) {
        const selectorStr = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',')
        k8s.setFieldSelector('')
        k8s.setLabelSelector(selectorStr)
        k8s.setResourceType('pods')
        k8s.setDrillDownName(resource.metadata.name)
      }
    } else if (k8s.resourceType === 'pods') {
      ui.setLogPod(resource)
    } else if (k8s.resourceType === 'namespaces') {
      k8s.setLabelSelector('')
      k8s.setFieldSelector('')
      k8s.setSelectedNamespace(resource.metadata.name)
      k8s.setResourceType('pods')
      k8s.setDrillDownName(null)
    } else if (k8s.resourceType === 'nodes') {
      k8s.setLabelSelector('')
      k8s.setFieldSelector(`spec.nodeName=${resource.metadata.name}`)
      k8s.setResourceType('pods')
      k8s.setSelectedNamespace('')
      k8s.setDrillDownName(resource.metadata.name)
    }
  }

  useKeyboard({
    onEscape: () => {
      ui.handleCloseAllModals()
      if (ui.showConfigModal && k8s.selectedContext) ui.setShowConfigModal(false)
      ui.setCommandMode(null)
      ui.setFilterQuery('')
      k8s.setLabelSelector('')
      k8s.setFieldSelector('')
      k8s.setDrillDownName(null)
    },
    onColon: () => {
      ui.handleCloseAllModals()
      ui.setCommandMode('command')
    },
    onSlash: () => {
      ui.handleCloseAllModals()
      ui.setCommandMode('filter')
    },
    onQuestionMark: () => ui.setShowHelp(prev => !prev),
    onKey: (key, ctrlKey, shiftKey) => {
      if (ui.showConfigModal || ui.selectedResource || ui.logPod || ui.shellPod || ui.yamlResource || ui.deleteResource) {
        if (shiftKey && key === 'C') ui.setShowConfigModal(prev => !prev)
        return
      }

      if (shiftKey && key === 'C') {
        ui.setShowConfigModal(true)
        return
      }

      if (key === '0' && !ctrlKey) {
        k8s.setSelectedNamespace('')
      } else if (key === 'l' && k8s.resourceType === 'pods') {
        const res = (window as any).webk9_selected_resource
        if (res) ui.setLogPod(res)
      } else if (key === 's' && k8s.resourceType === 'pods') {
        const res = (window as any).webk9_selected_resource
        if (res) ui.setShellPod(res)
      } else if (key === 'y') {
        const res = (window as any).webk9_selected_resource
        if (res) ui.setYamlResource({ name: res.metadata.name, type: k8s.resourceType, readOnly: true })
      } else if (key === 'e') {
        const res = (window as any).webk9_selected_resource
        if (res) ui.setYamlResource({ name: res.metadata.name, type: k8s.resourceType, readOnly: false })
      } else if (key === 'd' && ctrlKey) {
        const res = (window as any).webk9_selected_resource
        if (res) ui.setDeleteResource({ name: res.metadata.name, type: k8s.resourceType })
      }
    },
    disabledKeyboard: !!(ui.shellPod || ui.yamlResource)
  })

  // Modal visibility is now handled by the UI state and explicit user actions

  return (
    <div className="app-shell">
      {k8s.selectedContext && (
        <Header
          namespace={k8s.selectedNamespace}
          onSwitchContext={() => ui.setShowConfigModal(true)}
          onShowHelp={() => ui.setShowHelp(true)}
        />
      )}

      <div className="app-container">
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {k8s.selectedContext && (
            <div className="resource-table-wrapper">
              <div style={{ padding: '12px 20px', background: 'rgba(56, 189, 248, 0.05)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  {k8s.resourceType === 'pods' && k8s.drillDownName ? `PODS (${k8s.drillDownName})` : k8s.resourceType}
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: '500' }}>
                    {k8s.selectedNamespace ? `@ ${k8s.selectedNamespace}` : (['nodes', 'namespaces', 'persistentvolumes'].includes(k8s.resourceType) ? '' : '@ all-namespaces')}
                  </span>
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  {k8s.labelSelector || k8s.fieldSelector ? k8s.labelSelector || k8s.fieldSelector : 'no-filter'}
                </span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <ResourceTable
                  type={k8s.resourceType}
                  namespace={k8s.selectedNamespace}
                  labelSelector={k8s.labelSelector}
                  fieldSelector={k8s.fieldSelector}
                  filterQuery={ui.filterQuery}
                  onSelect={handleSelect}
                  onDescribe={(res) => {
                    const type = k8s.resourceType === 'all' ? (res.kind?.toLowerCase() + 's') : k8s.resourceType
                    ui.setSelectedResource({
                      name: res.metadata.name,
                      type: type || k8s.resourceType,
                      namespace: res.metadata.namespace
                    })
                  }}
                  onLogs={(pod) => ui.setLogPod(pod)}
                  disabled={!!(ui.showConfigModal || ui.selectedResource || ui.logPod || ui.shellPod || ui.yamlResource || ui.deleteResource || ui.showHelp)}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {ui.commandMode && (
        <CommandBar
          mode={ui.commandMode}
          apiResources={k8s.apiResources}
          initialValue={ui.commandMode === 'filter' ? ui.filterQuery : ''}
          onExecute={(val) => {
            if (ui.commandMode === 'command') handleCommand(val)
            else ui.setFilterQuery(val)
          }}
          onClose={() => ui.setCommandMode(null)}
        />
      )}

      {ui.selectedResource && (
        <ResourceDetail
          type={ui.selectedResource.type}
          name={ui.selectedResource.name}
          namespace={ui.selectedResource.namespace || k8s.selectedNamespace}
          onClose={() => ui.setSelectedResource(null)}
        />
      )}

      {ui.logPod && (
        <LogViewer
          pod={ui.logPod.metadata.name}
          namespace={ui.logPod.metadata.namespace || k8s.selectedNamespace}
          onClose={() => ui.setLogPod(null)}
        />
      )}

      {ui.shellPod && (
        <ShellView
          pod={ui.shellPod.metadata.name}
          namespace={ui.shellPod.metadata.namespace || k8s.selectedNamespace}
          onClose={() => ui.setShellPod(null)}
        />
      )}

      {ui.yamlResource && (
        <YamlEditor
          name={ui.yamlResource.name}
          type={ui.yamlResource.type}
          namespace={k8s.selectedNamespace}
          readOnly={ui.yamlResource.readOnly}
          onClose={() => ui.setYamlResource(null)}
        />
      )}

      {ui.deleteResource && (
        <div className="overlay">
          <div className="modal" style={{ border: '2px solid var(--accent-rose)' }}>
            <h2 style={{ color: 'var(--accent-rose)', marginBottom: '20px' }}>Delete {ui.deleteResource.type}?</h2>
            <div style={{ marginBottom: '30px' }}>
              Are you sure you want to delete <span style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>{ui.deleteResource.name}</span> in <span style={{ color: 'var(--accent-blue)' }}>{k8s.selectedNamespace}</span>?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button
                onClick={() => ui.setDeleteResource(null)}
                style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 20px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await k8sApi.deleteResource(ui.deleteResource!.type, ui.deleteResource!.name, k8s.selectedNamespace)
                  ui.setDeleteResource(null)
                }}
                style={{ background: 'var(--accent-rose)', color: '#fff', border: 'none', padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {ui.showHelp && <HelpMenu onClose={() => ui.setShowHelp(false)} />}

      {ui.showConfigModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '20px', color: 'var(--accent-blue)' }}>Select Kubeconfig</h2>
            {k8s.error && <div style={{ color: 'var(--accent-rose)', marginBottom: '10px' }}>{k8s.error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Config File</label>
                <select
                  style={{ width: '100%' }}
                  value={k8s.selectedPath}
                  onChange={(e) => {
                    k8s.handleSelectConfig(e.target.value, '')
                  }}
                >
                  <option value="">Select config...</option>
                  {k8s.configs.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {k8s.selectedPath && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Context</label>
                  <select
                    style={{ width: '100%' }}
                    value={k8s.selectedContext}
                    onChange={async (e) => {
                      const ctx = e.target.value;
                      await k8s.handleSelectConfig(k8s.selectedPath, ctx);
                      if (ctx) ui.setShowConfigModal(false);
                    }}
                  >
                    <option value="">Select context...</option>
                    {k8s.contexts.map(ctx => <option key={ctx} value={ctx}>{ctx}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginTop: '30px', textAlign: 'right' }}>
              <button
                onClick={() => ui.setShowConfigModal(false)}
                disabled={!k8s.selectedContext}
                style={{
                  background: k8s.selectedContext ? 'var(--accent-blue)' : '#333',
                  color: '#000',
                  border: 'none',
                  padding: '8px 24px',
                  fontWeight: 'bold',
                  cursor: (k8s.selectedContext && !k8s.loading) ? 'pointer' : 'not-allowed',
                  opacity: k8s.loading ? 0.7 : 1
                }}
              >
                {k8s.loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
