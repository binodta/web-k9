package k8s

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	metricsv1beta1 "k8s.io/metrics/pkg/client/clientset/versioned"
)

type ClientManager struct {
	Config           *rest.Config
	Clientset        *kubernetes.Clientset
	MetricsClientset *metricsv1beta1.Clientset
	RawConfig        *api.Config
	ConfigPath       string
	SelectedContext  string
}

func NewClientManager() *ClientManager {
	return &ClientManager{}
}

// DiscoverKubeconfigs looks for potential kubeconfig files in ~/.kube/
func (cm *ClientManager) DiscoverKubeconfigs() ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	kubeDir := filepath.Join(home, ".kube")
	if _, err := os.Stat(kubeDir); os.IsNotExist(err) {
		return []string{}, nil
	}

	var configs []string
	entries, err := os.ReadDir(kubeDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		path := filepath.Join(kubeDir, entry.Name())
		// Basic check if it's a kubeconfig
		if _, err := clientcmd.LoadFromFile(path); err == nil {
			configs = append(configs, path)
		}
	}

	return configs, nil
}

// LoadConfig loads a specific kubeconfig file and context
func (cm *ClientManager) LoadConfig(path string, context string) error {
	fmt.Printf("DEBUG: Loading config path=%s, context=%s\n", path, context)

	if path == "" {
		return fmt.Errorf("kubeconfig path is empty")
	}

	raw, err := clientcmd.LoadFromFile(path)
	if err != nil {
		fmt.Printf("DEBUG: Failed to load file: %v\n", err)
		return fmt.Errorf("failed to load kubeconfig file %s: %w", path, err)
	}

	if raw == nil {
		return fmt.Errorf("loaded kubeconfig is nil")
	}

	activeContext := context
	if activeContext == "" {
		activeContext = raw.CurrentContext
	}

	if activeContext != "" {
		if _, ok := raw.Contexts[activeContext]; !ok {
			fmt.Printf("DEBUG: Context %q not found in %s. Falling back to first available context.\n", activeContext, path)
			// Fallback to first available context
			if len(raw.Contexts) > 0 {
				for first := range raw.Contexts {
					activeContext = first
					break
				}
				fmt.Printf("DEBUG: Using fallback context: %s\n", activeContext)
			} else {
				return fmt.Errorf("no contexts found in config %s", path)
			}
		}
		raw.CurrentContext = activeContext
	} else if len(raw.Contexts) > 0 {
		// No current-context and none provided, pick first
		for first := range raw.Contexts {
			activeContext = first
			break
		}
		raw.CurrentContext = activeContext
		fmt.Printf("DEBUG: No context specified, using first available: %s\n", activeContext)
	} else {
		return fmt.Errorf("no contexts found in config %s", path)
	}

	// Use standard non-interactive client config
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*raw, raw.CurrentContext, &clientcmd.ConfigOverrides{}, nil)
	config, err := clientConfig.ClientConfig()
	if err != nil {
		fmt.Printf("DEBUG: Failed to get REST config for context %q: %v\n", raw.CurrentContext, err)
		return fmt.Errorf("failed to get client config for context %q: %w", raw.CurrentContext, err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	metricsClientset, err := metricsv1beta1.NewForConfig(config)
	if err != nil {
		// Log but don't fail, metrics might not be available
		fmt.Printf("DEBUG: Metrics clientset warning: %v\n", err)
	}

	cm.Config = config
	cm.Clientset = clientset
	cm.MetricsClientset = metricsClientset
	cm.RawConfig = raw.DeepCopy()
	cm.ConfigPath = path
	cm.SelectedContext = raw.CurrentContext

	fmt.Printf("DEBUG: Successfully loaded config. Context: %s, Cluster: %s\n",
		cm.SelectedContext, cm.RawConfig.Contexts[cm.SelectedContext].Cluster)

	return nil
}

// GetContexts returns all contexts in the current raw config
func (cm *ClientManager) GetContexts() []string {
	if cm.RawConfig == nil {
		return []string{}
	}
	var contexts []string
	for name := range cm.RawConfig.Contexts {
		contexts = append(contexts, name)
	}
	return contexts
}

type ResourceEvent struct {
	Type   string      `json:"type"` // ADDED, MODIFIED, DELETED
	Object interface{} `json:"object"`
}

func (cm *ClientManager) getListerWatcher(ctx context.Context, resourceType string, namespace string, labelSelector string, fieldSelector string) (cache.ListerWatcher, error) {
	switch resourceType {
	case "pods":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Pods(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Pods(namespace).Watch(ctx, options)
			},
		}, nil
	case "deployments":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.AppsV1().Deployments(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.AppsV1().Deployments(namespace).Watch(ctx, options)
			},
		}, nil
	case "services":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Services(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Services(namespace).Watch(ctx, options)
			},
		}, nil
	case "statefulsets":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.AppsV1().StatefulSets(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.AppsV1().StatefulSets(namespace).Watch(ctx, options)
			},
		}, nil
	case "namespaces", "ns":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Namespaces().List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Namespaces().Watch(ctx, options)
			},
		}, nil
	case "nodes", "no":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Nodes().List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Nodes().Watch(ctx, options)
			},
		}, nil
	case "configmaps", "cm":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().ConfigMaps(namespace).Watch(ctx, options)
			},
		}, nil
	case "secrets", "sec":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Secrets(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().Secrets(namespace).Watch(ctx, options)
			},
		}, nil
	case "ingresses", "ing":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.NetworkingV1().Ingresses(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.NetworkingV1().Ingresses(namespace).Watch(ctx, options)
			},
		}, nil
	case "persistentvolumes", "pv":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().PersistentVolumes().List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().PersistentVolumes().Watch(ctx, options)
			},
		}, nil
	case "persistentvolumeclaims", "pvc":
		return &cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.LabelSelector = labelSelector
				options.FieldSelector = fieldSelector
				return cm.Clientset.CoreV1().PersistentVolumeClaims(namespace).Watch(ctx, options)
			},
		}, nil
	}
	return nil, fmt.Errorf("unsupported resource type: %s", resourceType)
}

// WatchResources watches a specific resource type in a namespace
func (cm *ClientManager) WatchResources(ctx context.Context, resourceType string, namespace string, labelSelector string, fieldSelector string, eventChan chan ResourceEvent) error {
	listWatch, err := cm.getListerWatcher(ctx, resourceType, namespace, labelSelector, fieldSelector)
	if err != nil {
		return err
	}

	_, controller := cache.NewInformer(
		listWatch,
		nil, // object type is handled by the list/watch functions
		0,   // resync period
		cache.ResourceEventHandlerFuncs{
			AddFunc: func(obj interface{}) {
				eventChan <- ResourceEvent{Type: "ADDED", Object: obj}
			},
			UpdateFunc: func(oldObj, newObj interface{}) {
				eventChan <- ResourceEvent{Type: "MODIFIED", Object: newObj}
			},
			DeleteFunc: func(obj interface{}) {
				eventChan <- ResourceEvent{Type: "DELETED", Object: obj}
			},
		},
	)

	go controller.Run(ctx.Done())
	return nil
}

type APIResource struct {
	Name       string   `json:"name"`
	Kind       string   `json:"kind"`
	Namespaced bool     `json:"namespaced"`
	Verbs      []string `json:"verbs"`
	ShortNames []string `json:"shortNames"`
}

func (cm *ClientManager) GetAPIResources() ([]APIResource, error) {
	if cm.Clientset == nil {
		return nil, fmt.Errorf("clientset not initialized")
	}

	resourceLists, err := cm.Clientset.Discovery().ServerPreferredResources()
	if err != nil {
		return nil, err
	}

	var resources []APIResource
	for _, group := range resourceLists {
		for _, res := range group.APIResources {
			// Skip subresources (like pods/log, deployments/status)
			if contains(res.Name, "/") {
				continue
			}

			resources = append(resources, APIResource{
				Name:       res.Name,
				Kind:       res.Kind,
				Namespaced: res.Namespaced,
				Verbs:      res.Verbs,
				ShortNames: res.ShortNames,
			})
		}
	}

	return resources, nil
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
