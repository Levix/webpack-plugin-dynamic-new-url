'use strict';

const { pathToFileURL } = require('url');
const CommentCompilationWarning = require('webpack/lib/CommentCompilationWarning');
const UnsupportedFeatureWarning = require('webpack/lib/UnsupportedFeatureWarning');
const RuntimeGlobals = require('webpack/lib/RuntimeGlobals');
const ConstDependency = require('webpack/lib/dependencies/ConstDependency');
const { approve } = require('webpack/lib/javascript/JavascriptParserHelpers');
const BasicEvaluatedExpression = require('webpack/lib/javascript/BasicEvaluatedExpression');
const ContextDependencyHelpers = require('webpack/lib/dependencies/ContextDependencyHelpers');
const URLDependency = require('webpack/lib/dependencies/URLDependency');
const InnerGraph = require('webpack/lib/optimize/InnerGraph');
const URLContextDependency = require('./url-context-dependency');

/** @typedef {import("webpack/lib/NormalModule")} NormalModule */
/** @typedef {import("webpack/lib/javascript/JavascriptParser")} Parser */
/** @typedef {import("estree").MemberExpression} MemberExpression */
/** @typedef {import("estree").NewExpression} NewExpressionNode */
/** @typedef {import("webpack/lib/Compiler")} Compiler */
/** @typedef {[number, number]} Range */
/** @typedef {import("webpack/lib/Dependency").DependencyLocation} DependencyLocation */
/** @typedef {import("webpack").JavascriptParserOptions} JavascriptParserOptions */

/**
 * Logger interface
 * @typedef {Object} Logger
 * @property {(msg: string, ...args: any[]) => void} debug - Debug level log output
 * @property {(msg: string, ...args: any[]) => void} info - Info level log output
 * @property {(msg: string, ...args: any[]) => void} warn - Warning level log output
 * @property {(msg: string, ...args: any[]) => void} error - Error level log output
 */

const PLUGIN_NAME = 'WebpackDynamicURLPlugin';

/**
 * Convert module path to file URL
 * @param {NormalModule} module - webpack module object
 * @returns {URL} File URL object
 */
const getUrl = module => pathToFileURL(module.resource);

/**
 * WeakMap cache for evaluated expressions to avoid duplicate calculations
 */
const getEvaluatedExprCache = new WeakMap();

/**
 * Check if argument is import.meta.url expression
 * @param {Parser} parser - webpack parser
 * @param {MemberExpression} arg - Argument to check
 * @returns {boolean} Whether it is import.meta.url
 */
const isMetaUrl = (parser, arg) => {
    const chain = parser.extractMemberExpressionChain(arg);

    if (
        chain.members.length !== 1 ||
        chain.object.type !== 'MetaProperty' ||
        chain.object.meta.name !== 'import' ||
        chain.object.property.name !== 'meta' ||
        chain.members[0] !== 'url'
    )
        return false;

    return true;
};

/**
 * Get evaluation result of expression with caching mechanism
 * @param {NewExpressionNode} expr - Expression to evaluate
 * @param {Parser} parser - webpack parser
 * @returns {BasicEvaluatedExpression | undefined} Evaluation result
 */
const getEvaluatedExpr = (expr, parser) => {
    // Try to get result from cache
    let result = getEvaluatedExprCache.get(expr);
    if (result !== undefined) return result;

    const evaluate = () => {
        if (expr.arguments.length !== 2) return;

        const [arg1, arg2] = expr.arguments;

        if (arg2.type !== 'MemberExpression' || arg1.type === 'SpreadElement') return;
        if (!isMetaUrl(parser, arg2)) return;

        return parser.evaluateExpression(arg1);
    };

    result = evaluate();
    getEvaluatedExprCache.set(expr, result);

    return result;
};

/**
 * Webpack Dynamic URL Plugin
 * Used to handle static and dynamic URL resolution for new URL() constructor
 */
class WebpackDynamicURLPlugin {
    /**
     * Constructor
     * @param {Object} options - Plugin configuration options
     * @param {boolean} options.enabled - Whether to enable plugin, default true
     * @param {boolean} options.enableStaticUrl - Whether to enable static URL processing, default false
     * @param {boolean} options.enableLogging - Whether to enable log output, default false
     * @param {string} options.logLevel - Log level ('debug', 'info', 'warn', 'error'), default 'info'
     */
    constructor(options = {}) {
        this.options = {
            enabled: true,
            enableStaticUrl: false,
            enableLogging: false,
            logLevel: 'info',
            ...options,
        };

        // Initialize logging functions
        this.logger = this.createLogger();
    }

    /**
     * Create log output functions
     * @returns {Logger} Object containing log methods for each level
     */
    createLogger() {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };

        const currentLevel = levels[this.options.logLevel] || 1;
        const prefix = `[${PLUGIN_NAME}]`;

        return {
            debug: (msg, ...args) => {
                if (this.options.enableLogging && currentLevel <= 0) {
                    console.debug(`${prefix} [DEBUG]`, msg, ...args);
                }
            },
            info: (msg, ...args) => {
                if (this.options.enableLogging && currentLevel <= 1) {
                    console.info(`${prefix} [INFO]`, msg, ...args);
                }
            },
            warn: (msg, ...args) => {
                if (this.options.enableLogging && currentLevel <= 2) {
                    console.warn(`${prefix} [WARN]`, msg, ...args);
                }
            },
            error: (msg, ...args) => {
                if (this.options.enableLogging && currentLevel <= 3) {
                    console.error(`${prefix} [ERROR]`, msg, ...args);
                }
            },
        };
    }

    /**
     * Apply plugin to webpack compiler
     * @param {Compiler} compiler - webpack compiler instance
     */
    apply(compiler) {
        if (!this.shouldEnable()) {
            this.logger.info('Plugin is disabled, skipping application');
            return;
        }

        this.logger.info('Starting to apply plugin', {
            enableStaticUrl: this.options.enableStaticUrl,
            enableLogging: this.options.enableLogging,
            logLevel: this.options.logLevel,
        });

        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory, contextModuleFactory }) => {
            // Register custom dependency template
            compilation.dependencyTemplates.set(URLContextDependency, new URLContextDependency.Template());
            this.logger.debug('Registered URLContextDependency template');

            // Register custom dependency factory
            compilation.dependencyFactories.set(URLContextDependency, contextModuleFactory);
            this.logger.debug('Registered URLContextDependency factory');

            const handler = (parser, parserOptions) => {
                this.logger.debug('Setting up parser', { parserOptions });
                this.setupParser(parser, parserOptions);
            };

            // Register parser hooks for different JavaScript module types
            normalModuleFactory.hooks.parser.for('javascript/auto').tap(PLUGIN_NAME, handler);
            normalModuleFactory.hooks.parser.for('javascript/esm').tap(PLUGIN_NAME, handler);
        });
    }

    /**
     * Check if plugin should be enabled
     * @returns {boolean} Whether to enable
     */
    shouldEnable() {
        if (!this.options.enabled) return false;
        return true;
    }

    /**
     * Set up parser hooks and processing logic
     * @param {Parser} parser - webpack parser instance
     * @param {JavascriptParserOptions} parserOptions - Parser options
     */
    setupParser(parser, parserOptions) {
        this.logger.debug('Starting to set up parser hooks');

        // If static URL processing is enabled, register related hooks
        if (this.options.enableStaticUrl) {
            // Allow renaming URL constructor
            parser.hooks.canRename.for('URL').tap(PLUGIN_NAME, approve);

            // Handle evaluation of new URL() expressions
            parser.hooks.evaluateNewExpression.for('URL').tap(PLUGIN_NAME, expr => {
                const evaluatedExpr = getEvaluatedExpr(expr, parser);
                const request = evaluatedExpr && evaluatedExpr.asString();

                if (!request) {
                    this.logger.debug('Unable to get static URL request string');
                    return;
                }

                try {
                    const url = new URL(request, getUrl(parser.state.module));
                    this.logger.debug('Successfully resolved static URL', { request, resolved: url.toString() });

                    return new BasicEvaluatedExpression()
                        .setString(url.toString())
                        .setRange(/** @type {Range} */ (expr.range));
                } catch (error) {
                    this.logger.error('Failed to resolve static URL', { request, error: error.message });
                    return;
                }
            });
        }

        // Handle new URL() constructor calls
        parser.hooks.new.for('URL').tap('WebpackDynamicURLPlugin', _expr => {
            const relative = parserOptions.url === 'relative';
            const expr = _expr;

            // Parse magic comment options
            const { options: importOptions, errors: commentErrors } = parser.parseCommentOptions(
                /** @type {Range} */ (expr.range),
            );

            // If static URL processing is enabled, handle comment errors and ignore options
            if (this.options.enableStaticUrl) {
                if (commentErrors) {
                    for (const e of commentErrors) {
                        const { comment } = e;
                        parser.state.module.addWarning(
                            new CommentCompilationWarning(
                                `Compilation error while processing magic comment(-s): /*${comment.value}*/: ${e.message}`,
                                /** @type {DependencyLocation} */ (comment.loc),
                            ),
                        );
                    }
                }

                // Handle webpackIgnore option
                if (importOptions && importOptions.webpackIgnore !== undefined) {
                    if (typeof importOptions.webpackIgnore !== 'boolean') {
                        parser.state.module.addWarning(
                            new UnsupportedFeatureWarning(
                                `\`webpackIgnore\` expected a boolean, but received: ${importOptions.webpackIgnore}.`,
                                /** @type {DependencyLocation} */ (expr.loc),
                            ),
                        );
                        return;
                    } else if (importOptions.webpackIgnore) {
                        if (expr.arguments.length !== 2) return;

                        const [, arg2] = expr.arguments;

                        if (arg2.type !== 'MemberExpression' || !isMetaUrl(parser, arg2)) return;

                        const dep = new ConstDependency(RuntimeGlobals.baseURI, /** @type {Range} */ (arg2.range), [
                            RuntimeGlobals.baseURI,
                        ]);
                        dep.loc = /** @type {DependencyLocation} */ (expr.loc);
                        parser.state.module.addPresentationalDependency(dep);

                        return true;
                    }
                }
            }

            // Evaluate expression
            const evaluatedExpr = getEvaluatedExpr(expr, parser);
            if (!evaluatedExpr) {
                return;
            }

            let request;

            // Handle static URL requests
            if ((request = evaluatedExpr.asString())) {
                this.logger.debug('Detected static URL request', { request });

                if (this.options.enableStaticUrl) {
                    const [arg1, arg2] = expr.arguments;
                    const dep = new URLDependency(
                        request,
                        [/** @type {Range} */ (arg1.range)[0], /** @type {Range} */ (arg2.range)[1]],
                        /** @type {Range} */ (expr.range),
                        relative,
                    );
                    dep.loc = /** @type {DependencyLocation} */ (expr.loc);
                    parser.state.current.addDependency(dep);
                    InnerGraph.onUsage(parser.state, e => (dep.usedByExports = e));
                    return true;
                } else {
                    return;
                }
            }

            // Handle include/exclude options for dynamic URLs
            let include;
            let exclude;

            if (importOptions) {
                // Handle webpackInclude option
                if (importOptions.webpackInclude !== undefined) {
                    if (!importOptions.webpackInclude || !(importOptions.webpackInclude instanceof RegExp)) {
                        parser.state.module.addWarning(
                            new UnsupportedFeatureWarning(
                                `\`webpackInclude\` expected a regular expression, but received: ${importOptions.webpackInclude}.`,
                                /** @type {DependencyLocation} */ (expr.loc),
                            ),
                        );
                    } else {
                        include = importOptions.webpackInclude;
                    }
                }

                // Handle webpackExclude option
                if (importOptions.webpackExclude !== undefined) {
                    if (!importOptions.webpackExclude || !(importOptions.webpackExclude instanceof RegExp)) {
                        parser.state.module.addWarning(
                            new UnsupportedFeatureWarning(
                                `\`webpackExclude\` expected a regular expression, but received: ${importOptions.webpackExclude}.`,
                                /** @type {DependencyLocation} */ (expr.loc),
                            ),
                        );
                    } else {
                        exclude = importOptions.webpackExclude;
                    }
                }
            }

            // Create dynamic URL context dependency
            const dep = ContextDependencyHelpers.create(
                URLContextDependency,
                /** @type {Range} */ (expr.range),
                evaluatedExpr,
                expr,
                parserOptions,
                {
                    include,
                    exclude,
                    mode: 'sync',
                    typePrefix: 'new URL with import.meta.url',
                    category: 'url',
                },
                parser,
            );

            if (!dep) {
                return;
            }

            dep.loc = /** @type {DependencyLocation} */ (expr.loc);
            dep.optional = Boolean(parser.scope.inTry);
            parser.state.current.addDependency(dep);

            return true;
        });

        // If static URL processing is enabled, register purity check hooks
        if (this.options.enableStaticUrl) {
            parser.hooks.isPure.for('NewExpression').tap(PLUGIN_NAME, _expr => {
                const expr = _expr;
                const { callee } = expr;

                if (callee.type !== 'Identifier') return;
                const calleeInfo = parser.getFreeInfoFromVariable(callee.name);
                if (!calleeInfo || calleeInfo.name !== 'URL') return;

                const evaluatedExpr = getEvaluatedExpr(expr, parser);
                const request = evaluatedExpr && evaluatedExpr.asString();

                if (request) {
                    return true;
                }
            });
        }
    }
}

module.exports = WebpackDynamicURLPlugin;