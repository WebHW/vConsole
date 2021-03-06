/**
 * vConsole Basic Log Tab
 *
 * @author WechatFE
 */

import * as tool from '../lib/tool.js';
import $ from '../lib/query.js';
import VConsolePlugin from '../lib/plugin.js';
import tplItem from './item.html';
import tplFold from './item_fold.html';
import tplFoldCode from './item_fold_code.html';

class VConsoleLogTab extends VConsolePlugin {

  constructor(...args) {
    super(...args);
    
    this.tplTabbox = ''; // MUST be overwrite in child class
    this.allowUnformattedLog = true; // `[xxx]` format log

    this.isReady = false;
    this.$tabbox = null;
    this.console = {};
    this.logList = [];

    this.mockConsole();
  }

  /**
   * when vConsole is ready, 
   * this event will be triggered (after 'add' event)
   * @public
   */
  onInit() {
    this.isReady = true;
    this.$tabbox = $.render(this.tplTabbox, {});
    for (let i=0; i<this.logList.length; i++) {
      this.printLog(this.logList[i]);
    }
    this.logList = [];
  }

  /**
   * this event will make this plugin be registered as a tab
   * @public
   */
  onRenderTab(callback) {
    callback(this.$tabbox);
  }

  onAddTool(callback) {
    var that = this;
    var toolList = [{
      name: 'Clear',
      global: false,
      onClick: function(e) {
        that.clearLog();
      }
    }];
    callback(toolList);
  }

  /**
   * after init
   * @public
   */
  onReady() {
    let that = this;

    let $subTabs = $.all('.vc-subtab', that.$tabbox);
    $.bind($subTabs, 'click', function(e) {
      e.preventDefault();
      if ($.hasClass(this, 'vc-actived')) {
        return false;
      }
      $.removeClass($subTabs, 'vc-actived');
      $.addClass(this, 'vc-actived');

      let logType = this.dataset.type,
          $log = $.one('.vc-log', that.$tabbox);
      $.removeClass($log, 'vc-log-partly-log');
      $.removeClass($log, 'vc-log-partly-info');
      $.removeClass($log, 'vc-log-partly-warn');
      $.removeClass($log, 'vc-log-partly-error');
      if (logType == 'all') {
        $.removeClass($log, 'vc-log-partly');
      } else {
        $.addClass($log, 'vc-log-partly');
        $.addClass($log, 'vc-log-partly-' + logType);
      }
    });
  }

  /**
   * replace window.console with vConsole method
   * @private
   */
  mockConsole() {
    let that = this;
    if (!window.console) {
      window.console = {};
    } else {
      this.console.log = window.console.log;
      this.console.info = window.console.info;
      this.console.warn = window.console.warn;
      this.console.debug = window.console.debug;
      this.console.error = window.console.error;
    }
    window.console.log = function() { that.printLog({logType:'log', logs:arguments}); };
    window.console.info = function() { that.printLog({logType:'info', logs:arguments}); };
    window.console.warn = function() { that.printLog({logType:'warn', logs:arguments}); };
    window.console.debug = function() { that.printLog({logType:'debug', logs:arguments}); };
    window.console.error = function() { that.printLog({logType:'error', logs:arguments}); };
  }

  clearLog() {
    $.one('.vc-log', this.$tabbox).innerHTML = '';
  }

  /**
   * print log to origin console
   * @protected
   */
  printOriginLog(item) {
    if (typeof this.console[item.logType] === 'function') {
      this.console[item.logType].apply(window.console, item.logs);
    }
  }

  /**
   * print a log to log box
   * @protected
   * @param  string  tabName    auto|default|system
   * @param  string  logType    log|info|debug|error|warn
   * @param  array   logs       `logs` or `content` can't be empty
   * @param  object  content    `logs` or `content` can't be empty
   * @param  boolean noOrigin
   * @param  boolean noMeta
   * @param  int     date
   * @param  string  style
   * @param  string  meta
   */
  printLog(item) {
    let logs = item.logs || [];
    if (!logs.length && !item.content) {
      return;
    }

    // convert logs to a real array
    logs = [].slice.call(logs || []);

    // check `[default]` format
    let shouldBeHere = true;
    let pattern = /^\[(\w+)\] ?/i;
    let targetTabName = '';
    if (tool.isString(logs[0])) {
      let match = logs[0].match(pattern);
      if (match !== null && match.length > 0) {
        targetTabName = match[1].toLowerCase();
      }
    }
    if (targetTabName) {
      shouldBeHere = (targetTabName == this.id);
    } else if (this.allowUnformattedLog == false) {
      shouldBeHere = false;
    }

    if (!shouldBeHere) {
      // ignore this log and throw it to origin console
      if (!item.noOrigin) {
        this.printOriginLog(item);
      }
      return;
    }

    // save log date
    if (!item.date) {
      item.date = (+new Date());
    }

    // if vConsole is not ready, save current log to logList
    if (!this.isReady) {
      this.logList.push(item);
      return;
    }

    // remove `[xxx]` format
    if (tool.isString(logs[0])) {
      logs[0] = logs[0].replace(pattern, '');
      if (logs[0] === '') {
        logs.shift();
      }
    }

    // use date as meta
    if (!item.meta) {
      let date = tool.getDate(item.date);
      item.meta = date.hour + ':' + date.minute + ':' + date.second;
    }

    // create line
    let $line = $.render(tplItem, {
      logType: item.logType,
      noMeta: !!item.noMeta,
      meta: item.meta,
      style: item.style || ''
    });

    let $content = $.one('.vc-item-content', $line);
    // generate content from item.logs
    for (let i=0; i<logs.length; i++) {
      let $log = document.createElement('SPAN');
      try {
        if (logs[i] === '') {
          // ignore empty string
          continue;
        } else if (tool.isFunction(logs[i])) {
          // convert function to string
          $log.innerHTML = ' ' + logs[i].toString();
        } else if (tool.isObject(logs[i]) || tool.isArray(logs[i])) {
          // object or array
          $log = this.getFoldedLine(logs[i]);
        } else {
          // default
          $log.innerHTML = ' ' + tool.htmlEncode(logs[i]).replace(/\n/g, '<br/>');
        }
      } catch (e) {
        $log.innerHTML = ' [' + (typeof logs[i]) + ']';
      }
      if ($log) {
        $content.appendChild($log);
      }
    }
    // generate content from item.content
    if (tool.isObject(item.content)) {
      $content.appendChild(item.content);
    }

    // render to panel
    $.one('.vc-log', this.$tabbox).appendChild($line);
    $.one('.vc-content').scrollTop = $.one('.vc-content').scrollHeight;

    // print log to origin console
    if (!item.noOrigin) {
      this.printOriginLog(item);
    }
  }

  /**
   * generate the HTML element of a folded line
   * @protected
   */
  getFoldedLine(obj, outer) {
    let that = this;
    if (!outer) {
      let json = tool.JSONStringify(obj);
      let preview = json.substr(0, 26);
      outer = tool.getObjName(obj);
      if (json.length > 26) {
        preview += '...';
      }
      outer += ' ' + preview;
    }
    let $line = $.render(tplFold, {outer: outer, lineType: 'obj'});
    $.bind($.one('.vc-fold-outer', $line), 'click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if ($.hasClass($line, 'vc-toggle')) {
        $.removeClass($line, 'vc-toggle');
        $.removeClass($.one('.vc-fold-inner', $line), 'vc-toggle');
        $.removeClass($.one('.vc-fold-outer', $line), 'vc-toggle');
      } else {
        $.addClass($line, 'vc-toggle');
        $.addClass($.one('.vc-fold-inner', $line), 'vc-toggle');
        $.addClass($.one('.vc-fold-outer', $line), 'vc-toggle');
      }
      let $content = $.one('.vc-fold-inner', $line);
      if ($content.children.length == 0 && !!obj) {
        // render object's keys
        let keys = tool.getObjAllKeys(obj);
        for (let i=0; i<keys.length; i++) {
          let val = obj[keys[i]],
              valueType = 'undefined',
              keyType = '',
              $line;
          // handle value
          if (tool.isString(val)) {
            valueType = 'string';
            val = '"' + val + '"';
          } else if (tool.isNumber(val)) {
            valueType = 'number';
          } else if (tool.isBoolean(val)) {
            valueType = 'boolean';
          } else if (tool.isNull(val)) {
            valueType = 'null';
            val = 'null';
          } else if (tool.isUndefined(val)) {
            valueType = 'undefined';
            val = 'undefined';
          } else if (tool.isFunction(val)) {
            valueType = 'function';
            val = 'function()';
          } else if (tool.isSymbol(val)) {
            valueType = 'symbol';
          }
          // render
          let $sub;
          if (tool.isArray(val)) {
            let name = tool.getObjName(val) + '[' + val.length + ']';
            $sub = that.getFoldedLine(val, $.render(tplFoldCode, {
              key: keys[i], keyType: keyType, value: name, valueType: 'array'
            }, true));
          } else if (tool.isObject(val)) {
            let name = tool.getObjName(val);
            $sub = that.getFoldedLine(val, $.render(tplFoldCode, {
              key: keys[i], keyType: keyType, value: name, valueType: 'object'
            }, true));
          } else {
            if (!obj.hasOwnProperty(keys[i])) {
              keyType = 'private';
            }
            let renderData = {lineType: 'kv', key: keys[i], keyType: keyType, value: val, valueType: valueType};
            $sub = $.render(tplFold, renderData);
          }
          $content.appendChild($sub);
        }
        // render object's prototype
        if (tool.isObject(obj)) {
          let proto = obj.__proto__,
              $proto;
          if (tool.isObject(proto)) {
            $proto = that.getFoldedLine(proto, $.render(tplFoldCode, {
              key: '__proto__',
              keyType: 'private',
              value: tool.getObjName(proto),
              valueType: 'object'
            }, true));
          } else {
            // if proto is not an object, it should be `null`
            $proto = $.render(tplFoldCode, {
              key: '__proto__',
              keyType: 'private',
              value: 'null',
              valueType: 'null'
            });
          }
          $content.appendChild($proto);
        }
      }
      return false;
    });
    return $line;
  }

} // END class


export default VConsoleLogTab;