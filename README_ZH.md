# 动态 New URL 插件

> 一个增强 Webpack 5 处理 new URL() 构造函数的插件，支持静态和动态 URL 解析

## 功能特性

✅ 静态 URL 解析：在构建时解析静态 URL 字符串
✅ 动态 URL 支持：处理带有 import.meta.url 的动态 URL 构造
✅ 详细日志：可配置的日志输出，便于调试

## 安装

`npm install @uedc/dynamic-new-url-plugin -D`

## 使用方式

### 基本配置

在你的 webpack.config.js 中添加插件：

```js
const WebpackDynamicURLPlugin = require('@uedc/dynamic-new-url-plugin');

module.exports = {
  // ... 其他配置
  plugins: [
    new WebpackDynamicURLPlugin({
      enabled: true,              // 是否启用插件，默认 true
      enableStaticUrl: true,      // 是否启用静态 URL 处理，默认 false
      enableLogging: true,        // 是否启用日志输出，默认 false
      logLevel: 'info'            // 日志级别：'debug', 'info', 'warn', 'error'
    })
  ]
};
```

### 代码中使用

#### 静态 URL 解析（推荐直接使用官方的即可）

```js
// 构建时会被解析为完整的文件路径 URL
const assetUrl = new URL('./assets/logo.png', import.meta.url);
console.log(assetUrl.href);
```

#### 动态 URL 解析

```js
// 支持动态路径，会在运行时解析
const fileName = 'config.json';
const configUrl = new URL(`./data/${fileName}`, import.meta.url);
```

## 目录结构
```
dynamic-new-url-plugin/
├── src/                           # 源代码目录
│   ├── index.js                   # 主插件文件 (WebpackDynamicURLPlugin)
│   └── url-context-dependency.js  # URL 上下文依赖处理模块
├── dist/                          # 构建输出目录
│   ├── index.js                   # CommonJS 格式输出
│   └── index.mjs                  # ES Module 格式输出
└── package.json                   # 项目配置文件
```

## 开发与测试
- 开发环境：Node.js 14+
- Webpack 5

## 构建与部署
- 构建命令：`pnpm run build`
- 发布流程：

### 构建插件

`pnpm build`

#### 发布版本

```
pnpm release-patch   # 补丁版本
pnpm release-minor   # 次版本  
pnpm release-major   # 主版本
```

## 兼容性
- Webpack: 5.x
- Node.js: 14+
- 浏览器: 支持 ES2020+ 的现代浏览器
- 模块系统: ES Module, CommonJS

## 注意事项

1. 启用静态处理: 默认情况下 enableStaticUrl 为 false，需要手动启用，推荐直接使用官方的即可；
2. 路径解析: 使用 import.meta.url 作为 base URL 进行相对路径解析
3. 性能考虑: 启用日志输出可能影响构建性能，生产环境建议关闭
4. 依赖管理: 插件会自动处理 URL 相关的依赖关系，无需手动管理

## 参考链接

https://github.com/webpack/webpack/pull/19046/files

