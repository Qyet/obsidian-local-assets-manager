# Local Assets Manager (v0.1.0)

<div align="center">
  <h3>Obsidian 本地资源管理器</h3>
  <p>
    将笔记中的图片、视频下载到本地进行永久化储存和管理的插件
    <br />
    <a href="https://github.com/qyet/obsidian-local-assets-manager/issues">报告Bug</a>
    ·
    <a href="https://github.com/qyet/obsidian-local-assets-manager/issues">功能建议</a>
  </p>
</div>

## 目录

- [项目介绍](#项目介绍)
  - [主要特性](#主要特性)
- [快速开始](#快速开始)
  - [前置要求](#前置要求)
  - [安装步骤](#安装步骤)
- [使用说明](#使用说明)
- [配置选项](#配置选项)
- [开发相关](#开发相关)
- [问题反馈](#问题反馈)
- [许可证](#许可证)
- [联系方式](#联系方式)

## 项目介绍

Local Assets Manager 是一个强大的 Obsidian 插件，专注于解决笔记中外部资源的本地化和管理问题。它能自动下载、组织和优化您的笔记中的媒体资源，确保内容的长期可访问性。

### 主要特性

*   **本地化下载**: 自动将笔记中的图片、视频等媒体文件下载到本地
*   **永久化存储**: 将外部媒体资源保存到 Obsidian Vault 内，确保长期可访问
*   **防盗链支持**: 通过配置自定义 `Referer` 规则，解决防盗链限制
*   **路径管理**: 支持使用 `{title}` 占位符，根据笔记标题自动组织资源文件
*   **原始链接**: 可选保留媒体资源的原始网址作为参考
*   **自动清理**: 支持删除笔记时自动清理关联的资源文件
*   **资源检测**: 提供命令检测和清理未被引用的媒体文件
*   **下载管理**: 支持超时设置和失败重试，确保下载成功率
*   **自动同步**: 笔记重命名时自动更新资源路径，保持链接有效
*   **并发下载**: 多线程下载提升处理效率

## 快速开始

### 前置要求

* Obsidian 版本 >= 0.15.0

### 安装步骤

1. 从 [Releases](https://github.com/qyet/obsidian-local-assets-manager/releases) 页面下载最新版本
2. 在您的 Obsidian Vault 的插件目录 (`VaultFolder/.obsidian/plugins/`) 下创建 `local-assets-manager` 文件夹
3. 将下载的文件复制到新创建的文件夹中
4. 重新启动 Obsidian 或刷新插件列表
5. 在 Obsidian 的设置中启用 "Local Assets Manager"

## 使用说明

1. **资源下载**: 复制包含资源的链接
2. **执行命令**: 在 Obsidian 中打开命令面板 (`Cmd/Ctrl + P`)，输入 "Local Assets Manager"
3. **选择操作**: 选择相应的命令执行操作
4. 插件将自动处理资源下载和链接更新
5. **清理附件**: 使用清理命令可以查找并删除未使用的资源文件

## 配置选项

在 Obsidian 设置 -> 第三方插件 -> Local Assets Manager 中可以找到以下选项：

*   **使用相对路径**: 选择是否在笔记中使用相对路径引用资源
*   **保留原始 URL**: 是否在资源下方注释其原始地址
*   **资源保存路径**: 定义资源文件的保存位置
    *   支持 `{title}` 占位符，会被替换为笔记标题
    *   例如 `assets/{title}` 将在 `assets/笔记标题/` 目录下保存资源
    *   留空则保存在 Vault 根目录的 `assets` 文件夹
*   **删除笔记时删除资源**: 当路径包含 `{title}` 时，删除笔记会同步删除资源
*   **下载超时时间**: 单个资源的下载超时时间（默认30秒）
*   **自定义 Referer 规则**: JSON格式的防盗链规则配置
    ```json
    {
      "*.example.com": "https://example.com/",
      "assets.example.com": "https://example.com/"
    }
    ```

## 开发相关

详细的开发说明请参考 [DEVELOPER.md](./DEVELOPER.md)。

已知问题请参考 [CHANGELOG.md](./CHANGELOG.md)。

## 问题反馈

如果您遇到问题或有建议，欢迎在 [GitHub Issues](https://github.com/qyet/obsidian-local-assets-manager/issues) 中提出。

## 许可证

基于 MIT 许可证发布。详细信息请参阅 [LICENSE](./LICENSE) 文件。

## 联系方式

作者: Qyet

项目链接: [https://github.com/qyet/obsidian-local-assets-manager](https://github.com/qyet/obsidian-local-assets-manager) 