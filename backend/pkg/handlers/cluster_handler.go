package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ListNamespaces returns namespaces in the current cluster
func (h *Handler) ListNamespaces(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(fiber.StatusPreconditionFailed).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}
	nsList, err := h.K8sManager.Clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var namespaces []string
	for _, ns := range nsList.Items {
		namespaces = append(namespaces, ns.Name)
	}

	return c.JSON(fiber.Map{"namespaces": namespaces})
}

// GetTopPods returns metrics for pods in a namespace
func (h *Handler) GetTopPods(c *fiber.Ctx) error {
	namespace := c.Query("namespace", "default")

	if h.K8sManager.MetricsClientset == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "metrics server not initialized"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	podMetrics, err := h.K8sManager.MetricsClientset.MetricsV1beta1().PodMetricses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return c.Status(fiber.StatusGatewayTimeout).JSON(fiber.Map{"error": "failed to fetch pod metrics: " + err.Error()})
	}

	return c.JSON(podMetrics)
}

// GetTopNodes returns metrics for all nodes
func (h *Handler) GetTopNodes(c *fiber.Ctx) error {
	if h.K8sManager.MetricsClientset == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "metrics server not initialized"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nodeMetrics, err := h.K8sManager.MetricsClientset.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return c.Status(fiber.StatusGatewayTimeout).JSON(fiber.Map{"error": "failed to fetch node metrics: " + err.Error()})
	}

	return c.JSON(nodeMetrics)
}

// GetClusterInfo returns information about the current cluster
func (h *Handler) GetClusterInfo(c *fiber.Ctx) error {
	if h.K8sManager.Clientset == nil {
		return c.Status(400).JSON(fiber.Map{"error": "kubeconfig not loaded"})
	}

	version, err := h.K8sManager.Clientset.Discovery().ServerVersion()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	contextName := h.K8sManager.SelectedContext
	if contextName == "" && h.K8sManager.RawConfig != nil {
		contextName = h.K8sManager.RawConfig.CurrentContext
	}

	clusterName := ""
	userName := ""
	if h.K8sManager.RawConfig != nil {
		if context, ok := h.K8sManager.RawConfig.Contexts[contextName]; ok {
			clusterName = context.Cluster
			userName = context.AuthInfo
		}
	}

	return c.JSON(fiber.Map{
		"context": contextName,
		"version": version.GitVersion,
		"cluster": clusterName,
		"user":    userName,
	})
}
