# Dynamic New URL Plugin

> A Webpack 5 plugin that enhances the new URL() constructor handling, supporting both static and dynamic URL resolution

## Features

✅ Static URL resolution: Resolves static URL strings at build time
✅ Dynamic URL support: Handles dynamic URL construction with import.meta.url
✅ Detailed logging: Configurable logging output for debugging

## Installation

`pnpm add webpack-plugin-dynamic-new-url -D`

## Usage

### Basic Configuration

Add the plugin to your webpack.config.js:

```js
const WebpackDynamicURLPlugin = require('@uedc/dynamic-new-url-plugin');

module.exports = {
  // ... other configurations
  plugins: [
    new WebpackDynamicURLPlugin({
      enabled: true,              // Whether to enable the plugin, default true
      enableStaticUrl: true,      // Whether to enable static URL processing, default false
      enableLogging: true,        // Whether to enable logging, default false
      logLevel: 'info'            // Log level: 'debug', 'info', 'warn', 'error'
    })
  ]
};
```

### Code Examples

#### Static URL Resolution (Recommended to use official implementation)

```js
// Will be resolved to full file path URL at build time
const assetUrl = new URL('./assets/logo.png', import.meta.url);
console.log(assetUrl.href);
```

#### Dynamic URL Resolution

```js
// Supports dynamic paths, resolved at runtime
const fileName = 'config.json';
const configUrl = new URL(`./data/${fileName}`, import.meta.url);
```

## Project Structure
```
dynamic-new-url-plugin/
├── src/                           # Source code
│   ├── index.js                   # Main plugin file (WebpackDynamicURLPlugin)
│   └── url-context-dependency.js  # URL context dependency module
├── dist/                          # Build output
│   ├── index.js                   # CommonJS output
│   └── index.mjs                  # ES Module output
└── package.json                   # Project configuration
```

## Development & Testing
- Development environment: Node.js 14+
- Webpack 5

## Build & Deployment
- Build command: `pnpm run build`
- Release process:

### Build Plugin

`pnpm build`

#### Version Release

```
pnpm release-patch   # Patch version
pnpm release-minor   # Minor version  
pnpm release-major   # Major version
```

## Compatibility
- Webpack: 5.x
- Node.js: 14+
- Browsers: Modern browsers supporting ES2020+
- Module systems: ES Module, CommonJS

## Notes

1. Static processing: enableStaticUrl is false by default, needs manual enabling (recommended to use official implementation)
2. Path resolution: Uses import.meta.url as base URL for relative path resolution
3. Performance: Enabling logging may impact build performance, recommended to disable in production
4. Dependency management: Plugin automatically handles URL-related dependencies, no manual management needed

## References

https://github.com/webpack/webpack/pull/19046/files
