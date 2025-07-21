# RSBuild Plugin VFD

A plugin for RSBuild that automatically applies the `toNative` function from `vue-facing-decorator` to any class-style Vue components.

## The Problem

The `vue-facing-decorator` package, starting with version 3.0.0, requires that class-based components be exported using the `toNative` function. This is crucial for ensuring that these components are correctly transformed into a format that Vue's internal systems can understand, especially when they are imported by other components or libraries.

While this is a necessary step for technical correctness, it introduces a significant quality-of-life issue for developers. As of now, no major IDEs provide out-of-the-box support for this syntax. This also means developers have to manually wrap their exports, which can be cumbersome and easy to forget.

## The Solution

This RSBuild plugin seamlessly resolves this issue by automating the process.  

During compilation, after `@rsbuild/plugin-vue` has processed the files, this plugin identifies class-style components based on a set of predefined rules. Then, it proceeds to wrap said components' default export with the required `toNative` function.  

This facilitates both technical correctness and a great developer experience.

## Installation

First, install the plugin as a development dependency in your project using your preferred package manager.

```bash
# Using Bun
bun add --dev @julesmons/rsbuild-plugin-vfd

# Using PNPM
pnpm add --save-dev @julesmons/rsbuild-plugin-vfd

# Using Yarn
yarn add --dev @julesmons/rsbuild-plugin-vfd

# Using NPM
npm install --save-dev @julesmons/rsbuild-plugin-vfd
```

## Configuration

After installation, add the plugin to the `plugins` array in the project's RSBuild configuration file.  
_(Probably `rsbuild.config.ts`)_

```typescript
import { defineConfig } from "@rsbuild/core";

import { pluginVue } from "@rsbuild/plugin-vue";
import { pluginVfd } from "@julesmons/rsbuild-plugin-vfd";

export default defineConfig({
  plugins: [
    // 1. Ensure the Vue plugin is setup.
    pluginVue(),
    // 2. Append the VFD plugin.
    pluginVfd(),
  ],
});
```

The plugin will now automatically handle the `toNative` transformation for any Vue components matched by its rules.

## Attribution

This project was heavily inspired by [this](https://github.com/Arakmar/vite-plugin-vue-facing-decorator-hmr) awesome Vite plugin by [Arakmar](https://github.com/Arakmar).

## License

This project is licensed under the `Mozilla Public License
Version 2.0`.  
See the [LICENSE](LICENSE) file for details.
