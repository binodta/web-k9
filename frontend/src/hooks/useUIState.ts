import { useState, useCallback } from 'react';

export function useUIState() {
    const [selectedResource, setSelectedResource] = useState<{ name: string, type: string, namespace?: string } | null>(null);
    const [logPod, setLogPod] = useState<any | null>(null);
    const [shellPod, setShellPod] = useState<any | null>(null);
    const [yamlResource, setYamlResource] = useState<{ name: string, type: string, readOnly: boolean } | null>(null);
    const [deleteResource, setDeleteResource] = useState<{ name: string, type: string } | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [commandMode, setCommandMode] = useState<'command' | 'filter' | null>(null);
    const [filterQuery, setFilterQuery] = useState('');

    const handleCloseAllModals = useCallback(() => {
        setShowHelp(false);
        setSelectedResource(null);
        setLogPod(null);
        setShellPod(null);
        setYamlResource(null);
        setDeleteResource(null);
        // Note: showConfigModal is handled specially based on context
    }, []);

    return {
        selectedResource,
        setSelectedResource,
        logPod,
        setLogPod,
        shellPod,
        setShellPod,
        yamlResource,
        setYamlResource,
        deleteResource,
        setDeleteResource,
        showConfigModal,
        setShowConfigModal,
        showHelp,
        setShowHelp,
        commandMode,
        setCommandMode,
        filterQuery,
        setFilterQuery,
        handleCloseAllModals,
    };
}
