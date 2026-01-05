package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListConfigs returns available kubeconfig files
func (h *Handler) ListConfigs(c *fiber.Ctx) error {
	configs, err := h.K8sManager.DiscoverKubeconfigs()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"configs": configs})
}

// SelectConfig loads a specific config and context
func (h *Handler) SelectConfig(c *fiber.Ctx) error {
	var body struct {
		Path    string `json:"path"`
		Context string `json:"context"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	fmt.Printf("DEBUG: Selecting config path=%s, context=%s\n", body.Path, body.Context)
	if err := h.K8sManager.LoadConfig(body.Path, body.Context); err != nil {
		fmt.Printf("DEBUG: ERROR loading config: %v\n", err)
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":  "config loaded",
		"contexts": h.K8sManager.GetContexts(),
	})
}
