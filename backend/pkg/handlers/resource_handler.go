package handlers

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

// ListResources returns resources of a specific type
func (h *Handler) ListResources(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}
	resourceType := c.Params("type")
	namespace := c.Query("namespace", "default")
	labelSelector := c.Query("labelSelector", "")
	fieldSelector := c.Query("fieldSelector", "")

	opts := metav1.ListOptions{
		LabelSelector: labelSelector,
		FieldSelector: fieldSelector,
	}

	var list interface{}
	var err error

	switch resourceType {
	case "pods":
		list, err = h.K8sManager.Clientset.CoreV1().Pods(namespace).List(context.Background(), opts)
	case "deployments":
		list, err = h.K8sManager.Clientset.AppsV1().Deployments(namespace).List(context.Background(), opts)
	case "services":
		list, err = h.K8sManager.Clientset.CoreV1().Services(namespace).List(context.Background(), opts)
	case "statefulsets":
		list, err = h.K8sManager.Clientset.AppsV1().StatefulSets(namespace).List(context.Background(), opts)
	case "namespaces", "ns":
		list, err = h.K8sManager.Clientset.CoreV1().Namespaces().List(context.Background(), opts)
	case "nodes", "no":
		list, err = h.K8sManager.Clientset.CoreV1().Nodes().List(context.Background(), opts)
	case "configmaps", "cm":
		list, err = h.K8sManager.Clientset.CoreV1().ConfigMaps(namespace).List(context.Background(), opts)
	case "secrets", "sec":
		list, err = h.K8sManager.Clientset.CoreV1().Secrets(namespace).List(context.Background(), opts)
	case "ingresses", "ing":
		list, err = h.K8sManager.Clientset.NetworkingV1().Ingresses(namespace).List(context.Background(), opts)
	case "persistentvolumes", "pv":
		list, err = h.K8sManager.Clientset.CoreV1().PersistentVolumes().List(context.Background(), opts)
	case "persistentvolumeclaims", "pvc":
		list, err = h.K8sManager.Clientset.CoreV1().PersistentVolumeClaims(namespace).List(context.Background(), opts)
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unsupported resource type"})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(list)
}

// GetResource returns the full detail of a specific resource
func (h *Handler) GetResource(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}
	resourceType := c.Params("type")
	name := c.Params("name")
	namespace := c.Query("namespace", "default")

	var resource interface{}
	var err error

	switch resourceType {
	case "pods":
		resource, err = h.K8sManager.Clientset.CoreV1().Pods(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "deployments":
		resource, err = h.K8sManager.Clientset.AppsV1().Deployments(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "services":
		resource, err = h.K8sManager.Clientset.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "statefulsets":
		resource, err = h.K8sManager.Clientset.AppsV1().StatefulSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "namespaces", "ns":
		resource, err = h.K8sManager.Clientset.CoreV1().Namespaces().Get(context.Background(), name, metav1.GetOptions{})
	case "nodes", "no":
		resource, err = h.K8sManager.Clientset.CoreV1().Nodes().Get(context.Background(), name, metav1.GetOptions{})
	case "configmaps", "cm":
		resource, err = h.K8sManager.Clientset.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "secrets", "sec":
		resource, err = h.K8sManager.Clientset.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "ingresses", "ing":
		resource, err = h.K8sManager.Clientset.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "persistentvolumes", "pv":
		resource, err = h.K8sManager.Clientset.CoreV1().PersistentVolumes().Get(context.Background(), name, metav1.GetOptions{})
	case "persistentvolumeclaims", "pvc":
		resource, err = h.K8sManager.Clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unsupported resource type"})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resource)
}

// GetResourceYaml returns the resource in YAML format
func (h *Handler) GetResourceYaml(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}
	resourceType := c.Params("type")
	name := c.Params("name")
	namespace := c.Query("namespace", "default")

	var resource interface{}
	var err error

	switch resourceType {
	case "pods":
		resource, err = h.K8sManager.Clientset.CoreV1().Pods(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "deployments":
		resource, err = h.K8sManager.Clientset.AppsV1().Deployments(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "services":
		resource, err = h.K8sManager.Clientset.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "statefulsets":
		resource, err = h.K8sManager.Clientset.AppsV1().StatefulSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "namespaces", "ns":
		resource, err = h.K8sManager.Clientset.CoreV1().Namespaces().Get(context.Background(), name, metav1.GetOptions{})
	case "nodes", "no":
		resource, err = h.K8sManager.Clientset.CoreV1().Nodes().Get(context.Background(), name, metav1.GetOptions{})
	case "configmaps", "cm":
		resource, err = h.K8sManager.Clientset.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "secrets", "sec":
		resource, err = h.K8sManager.Clientset.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "ingresses", "ing":
		resource, err = h.K8sManager.Clientset.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	case "persistentvolumes", "pv":
		resource, err = h.K8sManager.Clientset.CoreV1().PersistentVolumes().Get(context.Background(), name, metav1.GetOptions{})
	case "persistentvolumeclaims", "pvc":
		resource, err = h.K8sManager.Clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unsupported resource type"})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	y, err := yaml.Marshal(resource)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendString(string(y))
}

// UpdateResourceYaml updates a resource from YAML
func (h *Handler) UpdateResourceYaml(c *fiber.Ctx) error {
	return c.Status(501).JSON(fiber.Map{"error": "not implemented yet"})
}

// DeleteResource deletes a resource
func (h *Handler) DeleteResource(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}
	resourceType := c.Params("type")
	name := c.Params("name")
	namespace := c.Query("namespace", "default")

	var err error
	switch resourceType {
	case "pods":
		err = h.K8sManager.Clientset.CoreV1().Pods(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "deployments":
		err = h.K8sManager.Clientset.AppsV1().Deployments(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "services":
		err = h.K8sManager.Clientset.CoreV1().Services(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "statefulsets":
		err = h.K8sManager.Clientset.AppsV1().StatefulSets(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "namespaces", "ns":
		err = h.K8sManager.Clientset.CoreV1().Namespaces().Delete(context.Background(), name, metav1.DeleteOptions{})
	case "nodes", "no":
		err = h.K8sManager.Clientset.CoreV1().Nodes().Delete(context.Background(), name, metav1.DeleteOptions{})
	case "configmaps", "cm":
		err = h.K8sManager.Clientset.CoreV1().ConfigMaps(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "secrets", "sec":
		err = h.K8sManager.Clientset.CoreV1().Secrets(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "ingresses", "ing":
		err = h.K8sManager.Clientset.NetworkingV1().Ingresses(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	case "persistentvolumes", "pv":
		err = h.K8sManager.Clientset.CoreV1().PersistentVolumes().Delete(context.Background(), name, metav1.DeleteOptions{})
	case "persistentvolumeclaims", "pvc":
		err = h.K8sManager.Clientset.CoreV1().PersistentVolumeClaims(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	default:
		return c.Status(404).JSON(fiber.Map{"error": "unsupported resource type"})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "resource deleted"})
}

// GetEvents returns events for a resource
func (h *Handler) GetEvents(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}
	resourceType := c.Params("type")
	name := c.Params("name")
	namespace := c.Query("namespace", "default")

	kindMap := map[string]string{
		"pods":                   "Pod",
		"deployments":            "Deployment",
		"services":               "Service",
		"statefulsets":           "StatefulSet",
		"namespaces":             "Namespace",
		"ns":                     "Namespace",
		"nodes":                  "Node",
		"no":                     "Node",
		"configmaps":             "ConfigMap",
		"cm":                     "ConfigMap",
		"secrets":                "Secret",
		"sec":                    "Secret",
		"ingresses":              "Ingress",
		"ing":                    "Ingress",
		"persistentvolumes":      "PersistentVolume",
		"pv":                     "PersistentVolume",
		"persistentvolumeclaims": "PersistentVolumeClaim",
		"pvc":                    "PersistentVolumeClaim",
	}

	kind, ok := kindMap[resourceType]
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "unsupported resource type for events"})
	}

	fieldSelector := fmt.Sprintf("involvedObject.kind=%s,involvedObject.name=%s,involvedObject.namespace=%s", kind, name, namespace)
	if resourceType == "namespaces" || resourceType == "ns" || resourceType == "nodes" || resourceType == "no" || resourceType == "persistentvolumes" || resourceType == "pv" {
		fieldSelector = fmt.Sprintf("involvedObject.kind=%s,involvedObject.name=%s", kind, name)
	}

	events, err := h.K8sManager.Clientset.CoreV1().Events(namespace).List(context.Background(), metav1.ListOptions{
		FieldSelector: fieldSelector,
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(events)
}

// GetDiscovery returns available resources in the cluster
func (h *Handler) GetDiscovery(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}

	resources, err := h.K8sManager.GetAPIResources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resources)
}
