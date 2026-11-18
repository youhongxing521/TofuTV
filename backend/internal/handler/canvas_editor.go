package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"infinite-canvas/backend/internal/agentops"
	"infinite-canvas/backend/internal/canvas"
)

type canvasEditorAccess interface {
	workspaceOwners
	runtimePolicies
}

// The editor uses the workspace HTTP surface for manual writes. These two
// fixed operations share the registry with Agent callers, including receipts
// and revision checks, without exposing the Agent routes to the editor.
func registerCanvasEditorRoutes(api *gin.RouterGroup, access canvasEditorAccess, registry *agentops.Registry) {
	register := func(path, operation string, maxBody func() int64) {
		api.POST(path, func(c *gin.Context) {
			if _, external := externalBusiness(c); external || c.GetHeader(assistantHostTokenHeader) != "" {
				fail(c, http.StatusForbidden, errors.New("此操作仅供画布界面使用"))
				return
			}
			if !requireTrustedDesktopWritePrincipal(c, "此操作仅供画布界面使用") {
				return
			}
			user, err := currentUser(c, access)
			if err != nil {
				failService(c, err)
				return
			}
			policy, available := loadRuntimePolicy(c, access)
			if !available || !enforceRateLimit(c, "canvas-write:"+user.ID, policy.Request.CanvasWritePerMinute, time.Minute) {
				return
			}
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBody())
			var body struct {
				OpID   string          `json:"opId"`
				Params json.RawMessage `json:"params"`
			}
			if err := c.ShouldBindJSON(&body); err != nil {
				var tooLarge *http.MaxBytesError
				if errors.As(err, &tooLarge) {
					fail(c, http.StatusRequestEntityTooLarge, errors.New("请求体超过容量上限"))
				} else {
					fail(c, http.StatusBadRequest, errors.New("请求体不是合法 JSON"))
				}
				return
			}
			result, err := registry.Execute(agentops.Request{
				Context: c.Request.Context(), OpID: body.OpID, Op: operation, Params: body.Params,
				UserID: user.ID, Caller: agentops.ManualCaller(false),
			})
			if err != nil {
				opErr := agentops.AsError(err)
				status := agentops.HTTPStatus(opErr.Code)
				c.JSON(status, gin.H{"code": status, "reason": opErr.Reason, "msg": opErr.Message, "details": opErr.Details})
				return
			}
			ok(c, result)
		})
	}
	register("/canvas-editor/document", "canvas.document.commit", func() int64 { return max(int64(agentOpsMaxBody), canvas.EffectiveRequestMaxBodyBytes()) })
	register("/canvas-editor/task-output", "canvas.task.bind", func() int64 { return 64 << 10 })
}
