# Local Assets Manager 开发者指南

## 开发环境设置

### 前置要求
- Node.js >= 16.0.0
- npm >= 7.0.0
- Git
- 熟悉 TypeScript 和 Obsidian API

### 开发环境搭建
1. 克隆仓库
```bash
git clone https://github.com/Qyet/obsidian-local-assets-manager.git
cd obsidian-local-assets-manager
```

2. 安装依赖
```bash
npm install
```

3. 构建项目
```bash
npm run build
```

4. 开发模式（热重载）
```bash
npm run dev
```

## 项目结构
```
obsidian-local-assets-manager/
├── src/                    # 源代码目录
│   ├── main.ts            # 插件主入口
│   ├── settings.ts        # 设置相关代码
│   └── utils/            # 工具函数
├── manifest.json          # 插件清单
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── versions.json         # 版本兼容信息
└── README.md            # 项目说明
```

## 代码规范
- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 提交前运行测试

## Git 工作流
1. 创建功能分支
```bash
git checkout -b feature/your-feature-name
```

2. 提交代码
```bash
git add .
git commit -m "feat: your commit message"
```

3. 推送分支
```bash
git push origin feature/your-feature-name
```

## 提交规范
遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式（不影响代码运行的变动）
- refactor: 重构（既不是新增功能，也不是修改bug的代码变动）
- test: 增加测试
- chore: 构建过程或辅助工具的变动

## 发布流程
1. 更新版本号
```bash
npm version patch|minor|major
```

2. 更新 manifest.json 和 versions.json

3. 构建项目
```bash
npm run build
```

4. 提交更改
```bash
git add .
git commit -m "chore: release v0.1.x"
git tag v0.1.x
git push origin main --tags
```

## 调试技巧
1. 控制台日志
```typescript
console.log('Debug:', data);
```

2. 性能分析
```typescript
console.time('操作名称');
// 代码...
console.timeEnd('操作名称');
```

## 常见问题
1. 构建失败
- 检查 Node.js 版本
- 删除 node_modules 并重新安装
- 检查 TypeScript 配置

2. 热重载不生效
- 检查 Obsidian 开发者模式是否开启
- 检查文件监听配置

## 性能优化建议
1. 使用防抖和节流
2. 优化资源加载
3. 使用缓存机制
4. 避免不必要的DOM操作

## 测试指南
1. 单元测试
```bash
npm run test
```

2. 端到端测试
```bash
npm run test:e2e
```

## 文档维护
- 及时更新 README.md
- 保持 CHANGELOG.md 最新
- 编写清晰的代码注释
- 更新 API 文档

## 联系方式
如有问题，请通过以下方式联系：
- GitHub Issues
- 电子邮件：[your-email@example.com]

## 许可证
MIT License 