'use strict';

var download = require('download');
var exec = require('child_process').exec;
var fs = require('fs');
var isbin = require('isbin');
var mout = require('mout');
var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;
var which = require('which');

/**
 * Initialize BinWrapper with options
 *
 * @param {Object} opts
 * @api public
 */

function BinWrapper(opts) {
    opts = opts || {};
    this.opts = this._parse(opts);
    this.name = this.opts.name;
    this.bin = this.opts.bin;
    this.dest = this.opts.path;
    this.path = path.join(this.dest, this.bin);
    this.url = this.opts.url;
    this.src = this.opts.src;
    this.buildScript = this.opts.buildScript;
    this.proxy = process.env.http_proxy ||
         process.env.HTTP_PROXY ||
         process.env.https_proxy ||
         process.env.HTTPS_PROXY ||
         null;
}

/**
 * Check if a binary is present and working
 *
 * @param {String|Array} cmd
 * @param {Function} cb
 * @api public
 */

BinWrapper.prototype.check = function (cmd, cb) {
    var self = this;

    if (!cb && mout.lang.isFunction(cmd)) {
        cb = cmd;
        cmd = ['--help'];
    }

    cmd = cmd;
    cmd = Array.isArray(cmd) ? cmd : [cmd];

    if (fs.existsSync(this.path)) {
        return self._test(cmd, cb);
    }

    if (isbin(this.bin)) {
        self.path = which.sync(self.bin);
        return self._test(cmd, cb);
    }

    download(this.url, this.dest, { mode: '0755', proxy: this.proxy }).on('close', function () {
        return self._test(cmd, cb);
    });
};

/**
 * Download source and build a binary
 *
 * @param {Function} cb
 * @api public
 */

BinWrapper.prototype.build = function (cb) {
    var self = this;
    var tmpDir = os.tmpdir ? os.tmpdir() : os.tmpDir();
    var tmp = path.join(tmpDir, this.name);
    var get = download(this.src, tmp, { extract: true, strip: '1', proxy: this.proxy });

    if (!cb || !mout.lang.isFunction(cb)) {
        cb = function () {};
    }

    if (!isbin('make')) {
        throw new Error('failed to find make');
    }

    return get.on('close', function () {
        exec(self.buildScript, { cwd: tmp }, function (err) {
            if (err) {
                return cb(err);
            }

            return cb();
        });
    });
};

/**
 * Test if a binary is working by checking its exit code
 *
 * @param {Array} cmd
 * @param {Function} cb
 * @api private
 */

BinWrapper.prototype._test = function (cmd, cb) {
    var working;
    var bin = spawn(this.path, cmd);

    bin.on('error', function () {
        working = false;
        return cb(working);
    });

    bin.on('exit', function (code) {
        working = code === 0 ? true : false;
        return cb(working);
    });

    return bin;
};

/**
 * Parse options
 *
 * @param {Object} opts
 * @api private
 */

BinWrapper.prototype._parse = function (opts) {
    opts.platform = opts.platform || {};
    opts.arch = opts.arch || {};

    var platform = process.platform;
    var arch = process.arch === 'x64' ? 'x64' : 'x86';
    var required = [
        'bin',
        'name',
        'path',
        'url'
    ];

    if (mout.object.hasOwn(opts.platform, [platform])) {
        opts = mout.object.mixIn(opts, opts.platform[platform]);
    }

    if (mout.object.hasOwn(opts.arch, [arch])) {
        opts = mout.object.mixIn(opts, opts.arch[arch]);
    }

    required.forEach(function (val) {
        if (!mout.object.hasOwn(opts, val)) {
            throw new Error(val + ' option is required');
        }
    });

    delete opts.platform;
    delete opts.arch;

    return opts;
};

/**
 * Module exports
 */

module.exports = BinWrapper;
