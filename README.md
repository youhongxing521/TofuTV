# TofuTV

<img src="assets/app-icon.png" width="96" height="96" alt="TofuTV 应用图标">

AI 视频创作工作台。写剧本、做分镜、生成镜头，在一张画布上完成。

[English](README.en.md) · [项目文档](docs/index.md) · [Gitee 仓库](https://gitee.com/hongxingyou/beeftv)

## 创作工作台

- 在画布上组织剧本、分镜和素材，串联图片、视频、文本和音频模型。
- 在项目和资产库中管理创作内容，将常用步骤保存为工作流。
- 在「模型配置」中添加自己的模型服务，例如本地 Ollama 或阿里云百炼。上游算力是独立的模型服务，使用其原有账号与计费方式。

## 本地运行

Windows 在仓库根目录运行以下命令。脚本需要 Go 和 Bun。

```powershell
.\scripts\start-local.ps1
```

启动后打开 [http://localhost:3000](http://localhost:3000)。手工启动和 Docker 配置见[本地开发文档](docs/content/docs/backend/local-development.mdx)和 [Docker Compose 配置](docker-compose.dev.yml)。

模型密钥和项目数据保存在本地工作区。请按[安全说明](SECURITY.md)管理凭证和网络访问。

## 上游与许可

TofuTV 基于 [glanderness/BeefTV](https://github.com/glanderness/BeefTV) 修改。此版本更换了工作台品牌、应用图标、桌面窗口标题及项目入口。上游文档中的 BeefTV 名称、安装包和发行记录指向原项目。

上游新增原创内容适用 [BeefTV Source Available License 1.0](LICENSE) 的相应条款。历史 MIT 内容及第三方组件仍适用各自许可。商业分发、向第三方提供托管服务等活动请查阅许可第 5 节。版权和来源见 [NOTICE](NOTICE) 和[第三方许可](THIRD_PARTY_NOTICES.md)。
