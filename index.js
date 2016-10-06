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


/**
 * Set the global fill color for the content
 * @param svgContent
 * @param color
 * @returns {string}
 */
function setFillColor(svgContent, color) {
    const doc = new DOMParser().parseFromString(svgContent, 'text/xml');
    doc.getElementsByTagName('svg')[0].setAttribute('fill', color);
    return doc.toString();
}


/**
 * Returns css rule for svg file.
 * @method buildCssRule
 * @param {String} normalizedFileName rule for svg file.
 * @param {String} encodedSvg Encoded svg content.
 * @param {String} width Image width.
 * @param {String} height Image height.
 */
function buildCssRule(normalizedFileName, color, encodedSvg, width, height, options) {

    var dimensions = (options.addSize) ? `width:${width}; height:${height};` : ``;

    var cssRule = `
        ${options.cssSelector}${options.cssPrefix}${normalizedFileName}${color.replace('#','')} {
            background-image: url("${encodedSvg}");
            ${dimensions}
        }
    `;

    return cssRule;
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

    return { width: width, height: height };
}


/**
 * Plugin
 * @returns {*}
 */
module.exports = function(options) {

    // Init default options

    options = options || {};

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


    // Store for our svgFiles
    var svgFiles = [];

    return through.obj( function(file, enc, cb) {

        if (file.isNull()) {
            cb(null, file);
            return;
        }

        if (file.isStream()) {
            cb(new gutil.PluginError('gulp-svg-css', 'Streaming not supported'));
            return;
        }

        // Get the file contents
        var svgContent = file.contents.toString();

        // Get dimensions
        var dimensions = getDimensions(svgContent);

        // Put it inside a css file
        var normalizedFileName = path.normalize(path.basename(file.path, '.svg')).toLowerCase();

        // Replace dots / spaces with hypens inside file name
        normalizedFileName = normalizedFileName.replace(/(\.|\s)/gi, '-');

        // Create multiple copies of the file for each color
        if (options.fillColors.length > 0) {

            var encodedSvg = [];

            options.fillColors.forEach( (color, key) => {

                // Color the svg
                var coloredSVG = setFillColor(svgContent, color);

                // Optimise the svg data
                svgo.optimize(coloredSVG, (result) => {

                    encodedSvg.push(`data:image/svg+xml,${encodeURIComponent(result.data)}`);

                    if (key === options.fillColors.length - 1) {

                        // Push each rule into the array
                        encodedSvg.forEach( (rule, id) => {
                            var colorClass = `.${options.fillColors[id].replace('#','')}`;
                            svgFiles.push(buildCssRule(normalizedFileName, colorClass, rule, dimensions.width || options.defaultWidth, dimensions.height || options.defaultHeight, options));
                        });

                        // Next
                        cb();
                    }

                });


            });
        }

        else {

            // Optimise the svg data
            svgo.optimize(svgContent, (result) => {

                var rule = `data:image/svg+xml,${encodeURIComponent(result.data)}`;

                // Push each rule into the array
                svgFiles.push(buildCssRule(normalizedFileName, '', rule, dimensions.width || options.defaultWidth, dimensions.height || options.defaultHeight, options));

                // Next
                cb();

            });

        }



    }, function(cb) {

        var svgFile = new gutil.File({
            path: 'svg.css',
            contents: new Buffer(svgFiles.join('\n'))
        });

        this.push(svgFile);

        cb();
    });
};
