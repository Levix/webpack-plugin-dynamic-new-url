'use strict';

const ContextDependency = require('webpack/lib/dependencies/ContextDependency');
const ContextDependencyTemplateAsRequireCall = require('webpack/lib/dependencies/ContextDependencyTemplateAsRequireCall');

/** @typedef {import("webpack/lib/ContextModule").ContextOptions} ContextOptions */
/** @typedef {import("webpack/lib/serialization/ObjectMiddleware").ObjectDeserializerContext} ObjectDeserializerContext */
/** @typedef {import("webpack/lib/serialization/ObjectMiddleware").ObjectSerializerContext} ObjectSerializerContext */
/** @typedef {ContextOptions & { request: string }} ContextDependencyOptions */
/** @typedef {[number, number]} Range */

class URLContextDependency extends ContextDependency {
    /**
     * @param {ContextDependencyOptions} options options
     * @param {Range} range range
     * @param {Range} valueRange value range
     */
    constructor(options, range, valueRange) {
        super(options);
        this.range = range;
        this.valueRange = valueRange;
    }

    get type() {
        return 'new URL() context';
    }

    get category() {
        return 'url';
    }

    /**
     * @param {ObjectSerializerContext} context context
     */
    serialize(context) {
        const { write } = context;
        write(this.valueRange);
        super.serialize(context);
    }

    /**
     * @param {ObjectDeserializerContext} context context
     */
    deserialize(context) {
        const { read } = context;
        this.valueRange = read();
        super.deserialize(context);
    }
}

URLContextDependency.Template = ContextDependencyTemplateAsRequireCall;

module.exports = URLContextDependency;
