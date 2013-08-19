(function () {

var _;

// try to require underscore
try { _ = require('vendor/underscore'); } catch (e) {}
try { _ = require('underscore'); } catch (e) {}
try { _ = require('../underscore'); } catch (e) {}
try { _ = require('../../underscore'); } catch (e) {}

// ## defaultApply
// Does a default-apply into dest from src
function defaultApply (dest, src) {
  for (var iter in src)
    if (src.hasOwnProperty(iter) && !dest.hasOwnProperty(iter))
      dest[iter] = src[iter];
}

// ## apply
// applies into dest from src
function apply (dest, src) {
  if (!dest) {
    console.log("Apply called with falsy dest");
    console.log(arguments);
    console.log(new Error().stack);
    return;
  }

  for (var iter in src)
    if (src.hasOwnProperty(iter))
      dest[iter] = src[iter];
}

// ## strip
// strips whitespace from string
function strip (str) {
  return str.split(' ').reduce(function (memo, item) {
    if (item) memo += item;
    return memo;
  }, "");
}

// ## resolveMedia
// Resolves media queries
function resolveMedia (node, properties) {
  if (node.$media) {
    node.$styles = node.$styles || {};
    node.$media.forEach(function (media) {
      if (media.query(properties)) apply(node.$styles, media.styles);
    });
  }
}

// ## howSpecific
// Returns a number corresponding to how specific the selector is
function howSpecific (selector) {
  if (selector[0] == ".") return 10;
  if (selector[0] == "#") return 100;
  return 1;
}

// ## collapse
// Collapses an array of styles according to their specificity
function collapse (styles) {
  styles.sort(function (a, b) { return a.specificity - b.specificity; });

  return styles.reduce(function (memo, item) {
    apply(memo, item.styles);
    return memo;
  }, {});
}

// ## resolveSubtree
// Recursively resolves styles while walking down a tree of styles
function resolveSubtree (subtree, properties, out, selectors, specificity) {
  var selector = selectors.shift();
  if (!selector) return;

  (Array.isArray(selector)? selector : [selector]).forEach(function (iter) {
    var newSubtree = subtree[iter];

    // update specificity
    specificity += howSpecific(iter);

    if (newSubtree) {
      resolveMedia(newSubtree, properties);
      out.push({specificity: specificity, styles: newSubtree.$styles});

      resolveSubtree(newSubtree, properties, out, selectors, specificity);
    }
  });
}

// ## buildSelectorList
// Builds a list of lists of selectors based on a type and set of attributes. 
// Return will look like this:
// [
//   ['Label', '#foosomeId', ['.class', '.names']],
//   ['Label', ['.class', '.names']],
//   ['#foosomeId', ['.class', '.names']],
//   [['.class', '.names']]
// ]

function buildSelectorList (type, attributes) {
  // Full is the 'full selector', containing type, id, and classes
  var full = [type];
  var classes;
  var ret = [full];

  // Add the id to the full selector
  if (attributes.id) {
    full.push('#' + attributes.id);
    ret.push(['#' + attributes.id]);
  }

  if (attributes['class']) {
    classes = attributes['class'].split(' ').map(function (iter) {
      return '.' + strip(iter);
    });
    // Add the classes to the full selector
    full.push(classes);

    // if there's an id, we need a separate [type, classes] selector. Otherwise
    // the full selector will be just [type, classes] since there's no id.
    if (attributes.id) ret.push([type, classes]);

    // Add the bare classes selector
    ret.push([classes]);
  }

  if (attributes.id && attributes['class'])
    ret.push(['#' + attributes.id, classes]);

  return ret;
}

var resolveMemo = {};

// ## resolve
// Resolve styles
//  * `stylesheets`: output of the stylesheet compiler
//  * `properties`: props used for media queries
//  * `type`: type of the object we're resolving styles for
//  * `attributes`: attributes of the object. these override all styles we
//    compute. also this is where we get id and class from
//  Don't worry its memoized   :  ]

function resolve (stylesheets, properties, type, attributes) {
  var memoKey = type + "#" + attributes.id + "." + attributes['class'];

  var collapsed;

  if (resolveMemo[memoKey]) {
    collapsed = resolveMemo[memoKey];
  } 
  
  else {
    var selectorList = buildSelectorList(type, attributes);
    var out = [];

    selectorList.forEach(function (iter) {
      resolveSubtree(stylesheets, properties, out, iter.concat(), 0);
    });

    // Collapse the styles according to specificty
    collapsed = collapse(out);

    if (_) for (var prop in collapsed) if (collapsed.hasOwnProperty(prop)) {
      // we replace the computed style string with a template function
      // this way we generate the template function once instead of
      // every time

      if (typeof(collapsed[prop]) == "string") {
        collapsed[prop] = _.template(collapsed[prop]);
        collapsed[prop].__templatefn = true; // mark it as a template function
      }
    }

    resolveMemo[memoKey] = collapsed;
  }

  var styles = {};
  apply(styles, collapsed);
  //apply(styles, attributes);
  
  if (_) for (var ii in styles) 
    if (styles[ii] && styles[ii].__templatefn)
      styles[ii] = styles[ii](properties);

  return styles;
}

function clearResolveMemo () {
  resolveMemo = {};
}

exports.clearResolveMemo = clearResolveMemo;
exports.resolve = resolve;
exports.buildSelectorList = buildSelectorList;
exports.defaultApply = defaultApply;
exports.apply = apply;
exports.strip = strip;
exports.resolveMedia = resolveMedia;

}());
