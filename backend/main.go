package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"

	"github.com/binodta/web-k9/backend/pkg/handlers"
	"github.com/binodta/web-k9/backend/pkg/k8s"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/websocket/v2"
)

//go:embed all:frontend/dist
var frontendDist embed.FS

func main() {
	app := fiber.New()

	// Middleware
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path} ${error}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	k8sManager := k8s.NewClientManager()
	h := handlers.NewHandler(k8sManager)

	// API Routes
	api := app.Group("/api")
	api.Get("/configs", h.ListConfigs)
	api.Post("/select-config", h.SelectConfig)
	api.Get("/namespaces", h.ListNamespaces)
	api.Get("/resources/:type", h.ListResources)
	api.Get("/resources/:type/:name", h.GetResource)
	api.Delete("/resources/:type/:name", h.DeleteResource)
	api.Get("/resources/:type/:name/events", h.GetEvents)
	api.Get("/cluster-info", h.GetClusterInfo)
	api.Get("/resources/:type/:name/yaml", h.GetResourceYaml)
	api.Put("/resources/:type/:name/yaml", h.UpdateResourceYaml)
	api.Get("/top/pods", h.GetTopPods)
	api.Get("/top/nodes", h.GetTopNodes)
	api.Get("/discovery", h.GetDiscovery)

	// WebSocket Routes
	app.Get("/ws/resources", websocket.New(h.StreamResources))
	app.Get("/ws/logs", websocket.New(h.StreamLogs))
	app.Get("/ws/exec", websocket.New(h.ExecShell))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	// Serve Static Files From Frontend
	distFS, err := fs.Sub(frontendDist, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	app.Use("/", filesystem.New(filesystem.Config{
		Root:   http.FS(distFS),
		Browse: false,
	}))

	// Fallback for SPA
	app.Use(func(c *fiber.Ctx) error {
		// If it's not an API call and not a static file, serve index.html
		content, err := frontendDist.ReadFile("frontend/dist/index.html")
		if err != nil {
			return c.Status(fiber.StatusNotFound).SendString("Not Found")
		}
		c.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
		return c.Send(content)
	})

	log.Fatal(app.Listen(":3030"))
}
