package handlers

import (
	"github.com/binodta/web-k9/backend/pkg/k8s"
)

type Handler struct {
	K8sManager *k8s.ClientManager
}

func NewHandler(manager *k8s.ClientManager) *Handler {
	return &Handler{K8sManager: manager}
}
