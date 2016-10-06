/*!
 * Copyright (c) 2015 All Rights Reserved by the SDL Group.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var gutil = require('gulp-util');
var through = require('through2');
var path = require('path');
var DOMParser = require('xmldom').DOMParser;
var SVGO = require('svgo');
var svgo = new SVGO();

module.exports = function (options) {
    options = options || {};

    // Init default options
    if (!options.fileName) {
        options.fileName = 'icons';
    }
    if (!options.cssPrefix) {
        options.cssPrefix = 'icon-';
    }
    if (!options.cssSelector) {
        options.cssSelector = '.';
    }
    if (!options.addSize) {
        options.addSize = false;
    }
    if (!options.defaultWidth) {
        options.defaultWidth = '16px';
    }
    if (!options.defaultHeight) {
        options.defaultHeight = '16px';
    }
    if (!options.fileExt) {
        options.fileExt = 'css';
    }
    if (!options.fillColors) {
        options.fillColors = [];
    }


    /**
     * Returns css rule for svg file.
     * @method buildCssRule
     * @param {String} normalizedFileName rule for svg file.
     * @param {String} encodedSvg Encoded svg content.
     * @param {String} width Image width.
     * @param {String} height Image height.
     */
    function buildCssRule(normalizedFileName, encodedSvg, width, height) {

        var dimensions = (options.addSize) ? `width:${width}; height:${height}` : ``;

        var cssRule = `
            ${options.cssSelector} ${options.cssPrefix} ${normalizedFileName} {
                background-image: url(" ${encodedSvg} ");
                ${dimensions}
            }
        `;

        // var cssRule = [];
        // cssRule.push(`${options.cssSelector} ${options.cssPrefix} ${normalizedFileName} {`);
        // cssRule.push(`background-image: url("${encodedSvg}");`);
        //
        // if (options.addSize) {
        //     cssRule.push(`width:${width};`);
        //     cssRule.push(`height:${height};`);
        // }
        // cssRule.push('}');
        return cssRule; //.join('\n');
    }


    /**
     * Get svg image dimensions.
     * @method getDimensions
     * @param {String} data Contents of svg file.
     */
    function getDimensions(svgContent) {
        var doc = new DOMParser().parseFromString(svgContent, 'text/xml');
        var svgel = doc.getElementsByTagName('svg')[0];
        var width = svgel.getAttribute('width');
        var height = svgel.getAttribute('height');

        if (width && !isNaN(width)) {
            width = width + 'px';
        }

        if (height && !isNaN(height)) {
            height = height + 'px';
        }

        return {width: width, height: height};
    }


    /**
     * Set the global fill color for the content
     * @param svgContent
     * @param color
     * @returns {string}
     */
    function setFillColor(svgContent, colors) {
        colors.forEach((item, key) => {
            const doc = new DOMParser().parseFromString(svgContent, 'text/xml');
            doc.getElementsByTagName('svg')[0].setAttribute('fill', item);
            return doc.toString();
        });
    }


    var cssRules = [];

    return through.obj((file, enc, cb) => {
        if (file.isNull()) {
            cb(null, file);
            return;
        }

        if (file.isStream()) {
            cb(new gutil.PluginError('gulp-svg-css', 'Streaming not supported'));
            return;
        }

        var svgContent = file.contents.toString();

        // Set the color
        svgContent = (options.fillColors.length > 0) ? setFillColor(svgContent, options.fillColors) : svgContent;

        // Put it inside a css file
        var normalizedFileName = path.normalize(path.basename(file.path, '.svg')).toLowerCase();

        // Replace dots / spaces with hypens inside file name
        normalizedFileName = normalizedFileName.replace(/(\.|\s)/gi, '-');

        // Encode svg data
        svgo.optimize(svgContent, (result) => {
            // console.log(result);
            var encodedSvg = 'data:image/svg+xml,' + encodeURIComponent(result.data);

            // Get dimensions
            var dimensions = getDimensions(svgContent);

            // Push rule
            cssRules.push(buildCssRule(normalizedFileName, encodedSvg,
                dimensions.width || options.defaultWidth, dimensions.height || options.defaultHeight));

            // Don't pipe svg image
            cb();

        })


    }, (cb) => {
        const cssFile = new gutil.File({
            path: options.fileName + '.' + options.fileExt,
            contents: new Buffer(cssRules.join('\n'))
        });
        this.push(cssFile);
        cb();
    });
};
