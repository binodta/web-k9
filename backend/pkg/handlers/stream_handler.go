package handlers

import (
	"context"
	"io"

	"github.com/binodta/web-k9/backend/pkg/k8s"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/remotecommand"
)

// StreamResources handles WebSocket connections for real-time resource updates
func (h *Handler) StreamResources(c *websocket.Conn) {
	if h.K8sManager.Clientset == nil {
		c.WriteJSON(fiber.Map{"error": "kubeconfig not loaded"})
		return
	}
	resourceType := c.Query("type", "pods")
	namespace := c.Query("namespace", "default")
	labelSelector := c.Query("labelSelector", "")
	fieldSelector := c.Query("fieldSelector", "")

	eventChan := make(chan k8s.ResourceEvent)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err := h.K8sManager.WatchResources(ctx, resourceType, namespace, labelSelector, fieldSelector, eventChan)
	if err != nil {
		c.WriteJSON(fiber.Map{"error": err.Error()})
		return
	}

	for {
		event := <-eventChan
		if err := c.WriteJSON(event); err != nil {
			break
		}
	}
}

// StreamLogs handles WebSocket connections for real-time log streaming
func (h *Handler) StreamLogs(c *websocket.Conn) {
	if h.K8sManager.Clientset == nil {
		c.WriteJSON(fiber.Map{"error": "kubeconfig not loaded"})
		return
	}
	namespace := c.Query("namespace", "default")
	pod := c.Query("pod")
	container := c.Query("container")
	tailLines := int64(100)

	if pod == "" {
		c.WriteJSON(fiber.Map{"error": "pod name is required"})
		return
	}

	opts := &v1.PodLogOptions{
		Container: container,
		Follow:    true,
		TailLines: &tailLines,
	}

	req := h.K8sManager.Clientset.CoreV1().Pods(namespace).GetLogs(pod, opts)
	stream, err := req.Stream(context.Background())
	if err != nil {
		c.WriteJSON(fiber.Map{"error": err.Error()})
		return
	}
	defer stream.Close()

	buf := make([]byte, 4096)
	for {
		n, err := stream.Read(buf)
		if n > 0 {
			if err := c.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
				return
			}
		}
		if err != nil {
			if err != io.EOF {
				c.WriteJSON(fiber.Map{"error": err.Error()})
			}
			return
		}
	}
}

// ExecShell handles WebSocket connections for interactive pod shell
func (h *Handler) ExecShell(c *websocket.Conn) {
	if h.K8sManager.Clientset == nil || h.K8sManager.Config == nil {
		c.WriteJSON(fiber.Map{"error": "kubeconfig not loaded"})
		return
	}
	namespace := c.Query("namespace", "default")
	pod := c.Query("pod")
	container := c.Query("container")
	command := c.Query("command", "/bin/sh")

	if pod == "" {
		c.WriteJSON(fiber.Map{"error": "pod name is required"})
		return
	}

	req := h.K8sManager.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(pod).
		Namespace(namespace).
		SubResource("exec").
		Param("container", container).
		Param("stdin", "true").
		Param("stdout", "true").
		Param("stderr", "true").
		Param("tty", "true")

	// Add command params
	for _, arg := range []string{command} {
		req.Param("command", arg)
	}

	exec, err := remotecommand.NewSPDYExecutor(h.K8sManager.Config, "POST", req.URL())
	if err != nil {
		c.WriteMessage(websocket.TextMessage, []byte("\x1b[1;31mError: "+err.Error()+"\x1b[0m\n"))
		return
	}

	// Wrapper to bridge WebSocket and SPDY stream
	handler := &streamHandler{conn: c}

	err = exec.Stream(remotecommand.StreamOptions{
		Stdin:  handler,
		Stdout: handler,
		Stderr: handler,
		Tty:    true,
	})

	if err != nil {
		c.WriteJSON(fiber.Map{"error": err.Error()})
	}
}

type streamHandler struct {
	conn     *websocket.Conn
	leftover []byte
}

func (s *streamHandler) Read(p []byte) (n int, err error) {
	if len(s.leftover) > 0 {
		n = copy(p, s.leftover)
		s.leftover = s.leftover[n:]
		return n, nil
	}

	_, msg, err := s.conn.ReadMessage()
	if err != nil {
		return 0, err
	}

	n = copy(p, msg)
	if n < len(msg) {
		s.leftover = msg[n:]
	}
	return n, nil
}

func (s *streamHandler) Write(p []byte) (n int, err error) {
	err = s.conn.WriteMessage(websocket.TextMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}
