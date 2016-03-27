'use strict';

/* eslint-env node, es6 */

const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const initialize = require('./src/js/common/initialize');

// sources variables
const sources_dir = 'src';
const content_dir = path.join(sources_dir, 'content');
const pages_dir = path.join(content_dir, 'pages');
const layouts_dir = path.join(sources_dir, 'layouts');
const helpers_dir = path.join(sources_dir, 'helpers');
const partials_dir = path.join(layouts_dir, 'partials');
const sass_sources_dir = path.join(sources_dir, 'sass');
const pictures_sources_dir = path.join(sources_dir, 'pictures');
const js_sources_dir = path.join(sources_dir, 'js');
const applications_sources_dir = path.join(js_sources_dir, 'apps');

// destinations variables
const dest_dir = 'public';
const assets_dest_dir = path.join(dest_dir, 'assets');
const style_dest_dir = path.join(assets_dest_dir, 'css');
const pictures_dest_dir = path.join(assets_dest_dir, 'pictures');
const applications_dest_dir = path.join(assets_dest_dir, 'js');

function is_dev() {
    switch (process.env.NODE_ENV) {
    case 'development':
    case 'dev':
        return true;
    default:
        return false;
    }
}

function is_prod() {
    return !is_dev()
}

function create_target(app, apps_source_dir, apps_dest_dir) {
    const sources_dir = path.join(apps_source_dir, app);
    const dest_dir = path.join(apps_dest_dir, app);
    const options = Object.assign(
        {browserifyOptions: {
            debug: true,
            paths: ['node_modules', js_sources_dir]
        }},
        {transform: [['babelify', {
            presets: ['es2015']
        }]]},
        is_prod() ? {plugin: [['minifyify', {map: false, minify: true}]]} : {}
    );
    return _.object([[app, {
        options,
        src: [`${sources_dir}/main.js`],
        dest: `${dest_dir}/app.js`
    }]]);
}

function create_browserify_targets(apps_sources_dir, apps_dest_dir) {
    return fs.readdirSync(apps_sources_dir)
        .filter((entry) => fs.statSync(path.join(apps_sources_dir, entry)).isDirectory())
        .reduce((targets, app) => Object.assign(
            targets,
            create_target(app, apps_sources_dir, apps_dest_dir)
        ), {});
}

function post_description(file) {
    return `<h1>${file.title}</h1><p>${file.resume}</p>`;
}

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        ///////////////////////////////////////////////////////////////////////
        // Variables
        sources_dir,
        content_dir,
        pages_dir,
        layouts_dir,
        helpers_dir,
        partials_dir,
        sass_sources_dir,
        pictures_sources_dir,
        js_sources_dir,
        applications_sources_dir,
        dest_dir,
        assets_dest_dir,
        style_dest_dir,
        pictures_dest_dir,
        applications_dest_dir,
        ///////////////////////////////////////////////////////////////////////
        // Configure tasks
        clean: {
            'all': ['<%= dest_dir %>']
        },
        browserify: create_browserify_targets(
            applications_sources_dir,
            applications_dest_dir
        ),
        metalsmith: {
            content: {
                options: {
                    clean: false,
                    metadata: Object.assign(
                        grunt.file.readJSON('config.json'),
                        {year: (new Date()).getFullYear()}
                    ),
                    plugins: [
                        {'metalsmith-discover-helpers': {
                            directory: '<%= helpers_dir %>',
                            pattern: /\.js$/
                        }},
                        {'metalsmith-each': (file) => {
                            if (file.date == null) {
                                file.date = file.stats.mtime;
                            }
                        }},
                        {'metalsmith-collections': {
                            pages: {
                                pattern: 'pages/*.md'
                            },
                            posts: {
                                pattern: 'posts/*.md',
                                sortBy: 'date',
                                reverse: false
                            }
                        }},
                        {'metalsmith-markdown': {
                            highlight: (code) => require('highlight.js').highlightAuto(code).value
                        }},
                        {'metalsmith-permalinks': {
                            pattern: ':collection/:title'
                        }},
                        {'metalsmith-pagination': {
                            'collections.posts': {
                                perPage: 5,
                                layout: 'blog.html',
                                path: 'blog/:num/index.html'
                            }
                        }},
                        {'metalsmith-layouts': {
                            directory: '<%= layouts_dir %>',
                            engine: 'handlebars',
                            partials: '<%= partials_dir %>',
                            default: 'index.html'
                        }},
                        {'metalsmith-feed': {
                            collection: 'posts',
                            postDescription: post_description
                        }}
                    ]
                },
                dest: '<%= dest_dir %>',
                src: '<%= content_dir %>'
            }
        },
        sass: {
            compile: {
                options: {
                    includePaths: [
                        '<%= sass_sources_dir %>',
                        'node_modules/foundation-sites/scss',
                        'node_modules/highlight.js/styles'
                    ],
                    outputStyle: is_dev() ? 'nested' : 'compressed',
                    sourceMap: is_dev()
                },
                files: [{
                    expand: true,
                    cwd: '<%= sass_sources_dir %>',
                    src: ['**/style.scss'],
                    dest: '<%= style_dest_dir %>',
                    ext: '.css'
                }]
            }
        },
        autoprefixer: {
            compile: {
                files: [{
                    expand: true,
                    cwd: '<%= style_dest_dir %>',
                    src: ['**/style.css'],
                    dest: '<%= style_dest_dir %>',
                    ext: '.css'
                }]
            }
        },
        imagemin: {
            compile: {
                files: [{
                    expand: true,
                    cwd: '<%= pictures_sources_dir %>',
                    src: ['**/*.{png,jpg,gif}'],
                    dest: '<%= pictures_dest_dir %>'
                }]
            }
        },
        watch: {
            content: {
                files: [
                    '<%= content_dir %>/**/*.md',
                    '<%= helpers_dir %>/**/*.js',
                    '<%= layouts_dir %>/**/*.html'
                ],
                tasks: ['metalsmith'],
                options: {
                    livereload: true,
                    spawn: true
                }
            },
            scripts: {
                files: [
                    '<%= js_sources_dir %>/**/*.js'
                ],
                tasks: ['browserify'],
                options: {
                    livereload: true,
                    spawn: true
                }
            },
            styles: {
                files: [
                    '<%= sass_sources_dir %>/**/*.scss',
                    '<%= sass_sources_dir %>/**/*.sass'
                ],
                tasks: ['sass', 'autoprefixer'],
                options: {
                    livereload: true,
                    spawn: true
                }
            },
            imagemin: {
                files: ['<%= pictures_sources_dir %>/**/*.{png,jpg,gif}'],
                tasks: ['imagemin'],
                options: {
                    livereload: true,
                    spawn: true
                }
            }
        },
        prompt: {
            init: initialize
        }
    });
    grunt.loadNpmTasks('grunt-autoprefixer');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-imagemin');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-metalsmith');
    grunt.loadNpmTasks('grunt-notify');
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-prompt');
    ///////////////////////////////////////////////////////////////////////
    // Register macro task(s).
    grunt.registerTask('default', ['clean', 'metalsmith', 'sass', 'autoprefixer', 'browserify', 'imagemin']);
};
