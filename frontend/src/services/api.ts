export interface KubeConfig {
    configs: string[];
}

export interface KubeContexts {
    message: string;
    contexts: string[];
}

export interface ClusterInfo {
    context: string;
    version: string;
    cluster: string;
    user: string;
}

const API_BASE = '/api';

export const getWsUrl = (path: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3030';
    return `${protocol}//${host}${path}`;
};

export const k8sApi = {
    getConfigs: async (): Promise<KubeConfig> => {
        const res = await fetch(`${API_BASE}/configs`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    selectConfig: async (path: string, context?: string): Promise<KubeContexts> => {
        const res = await fetch(`${API_BASE}/select-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, context }),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getNamespaces: async (): Promise<{ namespaces: string[] }> => {
        const res = await fetch(`${API_BASE}/namespaces`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getClusterInfo: async (): Promise<ClusterInfo> => {
        const res = await fetch(`${API_BASE}/cluster-info`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getResources: async (type: string, namespace: string, labelSelector = '', fieldSelector = ''): Promise<any> => {
        const params = new URLSearchParams({ namespace, labelSelector, fieldSelector });
        const res = await fetch(`${API_BASE}/resources/${type}?${params}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getResource: async (type: string, name: string, namespace: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/resources/${type}/${name}?namespace=${namespace}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    deleteResource: async (type: string, name: string, namespace: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/resources/${type}/${name}?namespace=${namespace}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getResourceYaml: async (type: string, name: string, namespace: string): Promise<string> => {
        const res = await fetch(`${API_BASE}/resources/${type}/${name}/yaml?namespace=${namespace}`);
        if (!res.ok) throw new Error(await res.text());
        return res.text();
    },

    updateResourceYaml: async (type: string, name: string, namespace: string, yaml: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/resources/${type}/${name}/yaml?namespace=${namespace}`, {
            method: 'PUT',
            body: yaml,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getEvents: async (type: string, name: string, namespace: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/resources/${type}/${name}/events?namespace=${namespace}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    getTopPods: async (namespace: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/top/pods?namespace=${namespace}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    getTopNodes: async (): Promise<any> => {
        const res = await fetch(`${API_BASE}/top/nodes`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    getDiscovery: async (): Promise<any[]> => {
        const res = await fetch(`${API_BASE}/discovery`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
};
