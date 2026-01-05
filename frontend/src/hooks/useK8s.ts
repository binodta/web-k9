import { useState, useEffect, useCallback } from 'react';
import { k8sApi } from '../services/api';

export function useK8s() {
    const [configs, setConfigs] = useState<string[]>([]);
    const [selectedPath, setSelectedPath] = useState<string>('');
    const [contexts, setContexts] = useState<string[]>([]);
    const [selectedContext, setSelectedContext] = useState<string>('');
    const [selectedNamespace, setSelectedNamespace] = useState<string>('default');
    const [resourceType, setResourceType] = useState<string>('pods');
    const [labelSelector, setLabelSelector] = useState<string>('');
    const [fieldSelector, setFieldSelector] = useState<string>('');
    const [drillDownName, setDrillDownName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiResources, setApiResources] = useState<any[]>([]);

    const fetchDiscovery = useCallback(async () => {
        try {
            const resources = await k8sApi.getDiscovery();
            setApiResources(resources);
        } catch (err) {
            console.error('Failed to fetch discovery info', err);
        }
    }, []);

    const fetchConfigs = useCallback(async () => {
        try {
            const data = await k8sApi.getConfigs();
            setConfigs(data.configs);
        } catch (err) {
            setError('Failed to fetch kubeconfigs');
        }
    }, []);

    const handleSelectConfig = useCallback(async (path: string, context: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await k8sApi.selectConfig(path, context);
            setContexts(data.contexts);
            setSelectedPath(path);
            setSelectedContext(context);
            if (context) {
                localStorage.setItem('WEBK9_LAST_PATH', path);
                localStorage.setItem('WEBK9_LAST_CONTEXT', context);
                fetchDiscovery();
            }
        } catch (err) {
            setError('Failed to load config');
        } finally {
            setLoading(false);
        }
    }, [fetchDiscovery]);

    useEffect(() => {
        const init = async () => {
            await fetchConfigs();
            const lastPath = localStorage.getItem('WEBK9_LAST_PATH');
            const lastContext = localStorage.getItem('WEBK9_LAST_CONTEXT');
            if (lastPath) {
                setSelectedPath(lastPath);
                handleSelectConfig(lastPath, lastContext || '');
            }
        };
        init();
    }, [fetchConfigs, handleSelectConfig]);

    return {
        configs,
        selectedPath,
        contexts,
        selectedContext,
        selectedNamespace,
        setSelectedNamespace,
        resourceType,
        setResourceType,
        labelSelector,
        setLabelSelector,
        fieldSelector,
        setFieldSelector,
        drillDownName,
        setDrillDownName,
        loading,
        error,
        apiResources,
        handleSelectConfig,
        fetchConfigs,
    };
}
