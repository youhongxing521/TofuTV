package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"infinite-canvas/backend/internal/agentops"
)

func TestBrowserCanvasEditorCommitsAcrossProxy(t *testing.T) {
	env := newAssistantTestEnv(t, nil)
	router := gin.New()
	router.Use(RuntimeDependenciesMiddleware(defaultRuntimeDependencies(env.service)))
	api := router.Group("/api")
	registry := RegisterAgentOpsRoutes(api, env.service, agentops.NewStore(env.service.Database()), env.clients)
	registerCanvasEditorRoutes(api, env.service, registry)

	request := func(path, token string) *httptest.ResponseRecorder {
		body := `{"opId":"browser-doc","params":{"canvasId":"` + env.canvasID + `","expectedRevision":1,"document":{"title":"浏览器提交","nodes":[{"id":"n1","type":"text"}],"connections":[]}}}`
		req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/"+path, strings.NewReader(body))
		req.RemoteAddr = "172.18.0.1:40001"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Beeftv-Client", token)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	for _, path := range []string{"ops/canvas.document.commit", "canvas-editor/document"} {
		if response := request(path, "external"); response.Code != http.StatusForbidden {
			t.Fatalf("%s: external request status %d: %s", path, response.Code, response.Body)
		}
	}
	for _, replayed := range []string{"false", "true"} {
		response := request("canvas-editor/document", "")
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"replayed":`+replayed) {
			t.Fatalf("manual commit status %d, expected replayed=%s: %s", response.Code, replayed, response.Body)
		}
	}
}
