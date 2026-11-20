package generation

import (
	"context"
	"encoding/json"
	"testing"

	"infinite-canvas/backend/internal/modelcatalog"
	"infinite-canvas/backend/internal/protocol"
)

// openai-videos 的生成声音开关要保留显式 false；节点未设置时不能替上游补值。
func TestOpenAIVideosSendsExplicitGenerateAudioOnly(t *testing.T) {
	adapter := unifiedVideoAdapter(t, "openai-videos")
	for _, tc := range []struct {
		name    string
		value   string
		want    any
		present bool
	}{
		{name: "explicit false", value: "false", want: false, present: true},
		{name: "explicit true", value: "true", want: true, present: true},
		{name: "unset", value: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := ProtocolRequestFromInput(Input{Mode: "video", Prompt: "move", Config: Config{Model: "seedance-2.0-fast", VideoGenerateAudio: tc.value}})
			spec, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: request})
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(spec.Body)
			if err != nil {
				t.Fatal(err)
			}
			var body map[string]any
			if err := json.Unmarshal(encoded, &body); err != nil {
				t.Fatal(err)
			}
			got, ok := body["generate_audio"]
			if ok != tc.present {
				t.Fatalf("generate_audio presence = %v, want %v: %#v", ok, tc.present, body)
			}
			if tc.present && got != tc.want {
				t.Fatalf("generate_audio = %#v, want %#v", got, tc.want)
			}
		})
	}
}

// 同样的显式语义适用于声明式 seedance-videos-compatible 插件：未设置不补值，false 原样发送。
func TestSeedanceVideosCompatibleManifestSendsExplicitGenerateAudioOnly(t *testing.T) {
	adapter := unifiedVideoAdapter(t, "seedance-videos-compatible")
	for _, tc := range []struct {
		name    string
		value   string
		want    any
		present bool
	}{
		{name: "explicit false", value: "false", want: false, present: true},
		{name: "explicit true", value: "true", want: true, present: true},
		{name: "unset", value: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := ProtocolRequestFromInput(Input{Mode: "video", Prompt: "move", Config: Config{Model: "seedance-2.0-fast", VideoGenerateAudio: tc.value}})
			spec, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: request})
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(spec.Body)
			if err != nil {
				t.Fatal(err)
			}
			var body map[string]any
			if err := json.Unmarshal(encoded, &body); err != nil {
				t.Fatal(err)
			}
			got, ok := body["generate_audio"]
			if ok != tc.present {
				t.Fatalf("generate_audio presence = %v, want %v: %#v", ok, tc.present, body)
			}
			if tc.present && got != tc.want {
				t.Fatalf("generate_audio = %#v, want %#v", got, tc.want)
			}
		})
	}
}

// 比例写法额外发送 aspect_ratio；像素尺寸只走 size，不冒充比例。
func TestOpenAIVideosSendsAspectRatioOnlyForRatioLiterals(t *testing.T) {
	adapter := unifiedVideoAdapter(t, "openai-videos")
	for _, tc := range []struct {
		name    string
		size    string
		want    any
		present bool
	}{
		{name: "ratio", size: "9:16", want: "9:16", present: true},
		{name: "adaptive", size: "adaptive", want: "adaptive", present: true},
		{name: "pixels", size: "720x1280"},
		{name: "unset", size: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := ProtocolRequestFromInput(Input{Mode: "video", Prompt: "move", Config: Config{Model: "seedance-2.0-fast", Size: tc.size}})
			spec, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: request})
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(spec.Body)
			if err != nil {
				t.Fatal(err)
			}
			var body map[string]any
			if err := json.Unmarshal(encoded, &body); err != nil {
				t.Fatal(err)
			}
			got, ok := body["aspect_ratio"]
			if ok != tc.present {
				t.Fatalf("aspect_ratio presence = %v, want %v: %#v", ok, tc.present, body)
			}
			if tc.present && got != tc.want {
				t.Fatalf("aspect_ratio = %#v, want %#v", got, tc.want)
			}
		})
	}
}

// 节点 metadata.vquality 经生成配置进入协议请求，并作为上游 resolution_name 发出。
func TestVideoResolutionReachesProtocolRequest(t *testing.T) {
	profile := &modelcatalog.VideoCapabilityConfig{Resolutions: []string{"480p", "720p"}, DefaultResolution: "480p"}
	request := ProtocolRequestFromInput(Input{Mode: "video", Prompt: "move", Config: Config{Model: "video-model", VQuality: "720p"}, VideoCapability: profile})
	if request.Resolution != "720p" {
		t.Fatalf("protocol resolution = %q, want 720p", request.Resolution)
	}
	spec, err := unifiedVideoAdapter(t, "openai-videos").BuildCreate(context.Background(), protocol.RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(spec.Body)
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatal(err)
	}
	if body["resolution_name"] != "720p" {
		t.Fatalf("resolution_name = %#v, want 720p", body["resolution_name"])
	}
}

// 模型没有声明视频能力时，能力表里没有可对齐的档位，纯数字档位必须补上 p
// 再发上游。Seedance 只接受 720p 这类写法，直接发 720 会被判 invalid_params。
func TestVideoResolutionWithoutCapabilityGetsSuffix(t *testing.T) {
	cases := []struct {
		quality string
		want    string
	}{
		{"720", "720p"},
		{"1080", "1080p"},
		{"720p", "720p"},
		{"1080P", "1080P"},
		{"", ""},
		{"auto", "auto"},
	}
	for _, tc := range cases {
		t.Run(tc.quality, func(t *testing.T) {
			request := ProtocolRequestFromInput(Input{
				Mode:   "video",
				Prompt: "move",
				Config: Config{Model: "bytedance/doubao-seedance-2-0-fast-260128", VQuality: tc.quality, Size: "1:1"},
			})
			if request.Resolution != tc.want {
				t.Fatalf("protocol resolution = %q, want %q", request.Resolution, tc.want)
			}
		})
	}
}

// 能力表声明了带 p 的档位时，仍然以声明值为准，不被后缀补齐改写。
func TestVideoResolutionPrefersDeclaredCapability(t *testing.T) {
	profile := &modelcatalog.VideoCapabilityConfig{Resolutions: []string{"480p", "720p", "1080p"}}
	request := ProtocolRequestFromInput(Input{Mode: "video", Prompt: "move", Config: Config{Model: "seedance", VQuality: "720"}, VideoCapability: profile})
	if request.Resolution != "720p" {
		t.Fatalf("declared resolution = %q, want 720p", request.Resolution)
	}
}
