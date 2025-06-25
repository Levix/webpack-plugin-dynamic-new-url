interface PluginOptions {
    enabled?: boolean;
    enableStaticUrl?: boolean;
    enableLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

declare class WebpackDynamicURLPlugin {
    options: Required<PluginOptions>;

    constructor(options?: PluginOptions);
}

export { WebpackDynamicURLPlugin as default };
