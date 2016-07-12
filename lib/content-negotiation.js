// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: strong-error-handler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var accepts = require('accepts');
var debug = require('debug')('strong-error-handler:http-response');
var sendJson = require('./send-json');
var sendHtml = require('./send-html');
var util = require('util');

module.exports = negotiateContentProducer;

/**
 * Handles req.accepts and req.query._format and options.defaultType
 * to resolve the correct operation
 *
 * @param req request object
 * @param {Object} options options of strong-error-handler
 * @returns {Function} Opeartion function with signature `fn(res, data)`
 */
function negotiateContentProducer(req, options) {
  var SUPPORTED_TYPES = [
    'application/json', 'json',
    'text/html', 'html',
  ];

  options = options || {};
  var defaultType = 'json';

  // checking if user provided defaultType is supported
  if (options.defaultType) {
    if (SUPPORTED_TYPES.indexOf(options.defaultType) > -1) {
      debug('Accepting options.defaultType `%s`', options.defaultType);
      defaultType = options.defaultType;
    } else {
      debug('defaultType: `%s` is not supported, ' +
        'falling back to defaultType: `%s`', options.defaultType, defaultType);
    }
  }

  // decide to use resolvedType or defaultType
  // Please note that accepts assumes the order of content-type is provided
  // in the priority returned
  // example
  // Accepts: text/html, */*, application/json ---> will resolve as text/html
  // Accepts: application/json, */*, text/html ---> will resolve as application/json
  // Accepts: */*, application/json, text/html ---> will resolve as application/json
  // eg. Chrome accepts defaults to `text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*`
  // In this case `resolvedContentType` will result as: `text/html` due to the order given
  var resolvedContentType = accepts(req).types(SUPPORTED_TYPES);
  debug('Resolved content-type', resolvedContentType);
  var contentType = resolvedContentType || defaultType;

  // to receive _format from user's url param to overide the content type
  // req.query (eg /api/Users/1?_format=json will overide content negotiation
  // https://github.com/strongloop/strong-remoting/blob/ac3093dcfbb787977ca0229b0f672703859e52e1/lib/http-context.js#L643-L645
  var query = req.query || {};
  if (query._format) {
    if (SUPPORTED_TYPES.indexOf(query._format) > -1) {
      contentType = query._format;
    } else {
      // format passed through query but not supported
      var msg = util.format('Response _format "%s" is not supported' +
        'used "%s" instead"', query._format, defaultType);
      res.header('X-Warning', msg);
      debug(msg);
    }
  }

  debug('Content-negotiation: req.headers.accept: `%s` Resolved as: `%s`',
    req.headers.accept, contentType);
  return resolveOperation(contentType);
}

function resolveOperation(contentType) {
  switch (contentType) {
    case 'application/json':
    case 'json':
      return sendJson;
    case 'text/html':
    case 'html':
      return sendHtml;
  }
}