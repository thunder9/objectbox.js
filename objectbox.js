// Objectbox.js
// (c) 2013 thunder9 (https://github.com/thunder9)
// Objectbox may be freely distributed under the MIT license.

(function(root) {

  // Baseline setup
  // --------------

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = root._ || require('underscore');

  // The top-level namespace. Exported for both the browser and the server.
  var objectbox;
  if (typeof exports !== 'undefined') {
    objectbox = exports;
  } else {
    objectbox = root.objectbox = {};
  }

  // Internal object for caching.
  var caches = {
    _caches: {},
    get: function(record) {
      var key = record.getId();
      return _.has(this._caches, key) ? this._caches[key] : this._caches[key] = record.getFields();
    },
    deleteCache: function(record) {
      var key = record.getId();
      if (_.has(this._caches, key)) delete this._caches[key];
    },
    clear: function() { this._caches = {}; }
  };

  // Functions
  // ---------

  // Creates a new record(s) in the `table`, populated with the given `obj`ect.
  var insert = function(table, obj) {
    var memo = {};
    memo.table = table;
    memo.fields = {};
    memo.depth = 0;
    return visit(inserter, getInsertedRecord, memo, obj);
  };

  // Updates the record and its children with the given `obj`ect.
  var update = function(record, obj) {
    var memo = {};
    memo.table = record.getTable();
    memo.record = record;
    memo.fields = {};
    memo.depth = 0;
    return visit(updater, getUpdatedRecord, memo, obj);
  };

  // Changes a field's value.
  var set = function(record, fieldName, value) {
    var obj = {};
    obj[fieldName] = value;
    return update(record, obj);
  };

  // Returns an object that has the values of all the fields in the `record`.
  var getFields = function(record) {
    var memo = {};
    memo.table = record.getTable();
    memo.record = record;
    memo.fields = {};
    return visit(getter, postGet, memo, caches.get(record));
  };

  // Deletes `record` and its children from the datastore.
  var deleteRecord = function(record) {
    var memo = {};
    memo.table = record.getTable();
    memo.record = record;
    memo.fields = {};
    return visit(deleter, postDelete, memo, caches.get(record));
  };

  // Returns a field's value, or null if the field does not exist. If no `fieldName` is given,
  // returns an object that has the values of all the fields in the `record` and its children.
  var get = function(record, fieldName) {
    var fields = getFields(record);
    if (fieldName) {
      return fields[fieldName];
    } else {
      return fields;
    }
  };

  // Retrieves the records from the `table` whose field match values of `fieldValues` and `depth`.
  var query = function(table, fieldValues, depth) {
    if (_.isNumber(depth)) fieldValues['depth'] = depth;
    return table.query(fieldValues);
  };

  // Internal functions
  // ------------------

  var visit = function(reduceFun, resultFun, memo, value) {
    if (isObj(value)) {
      return resultFun(_.reduce(value, reduceFun, memo));
    } else {
      return value;
    }
  };

  var inserter = function(memo, value, fieldName) {
    if (isObj(value)) {
      var m = cloneMemo(memo);
      m.depth = memo.depth + 1;
      value = visit(inserter, getLinkOfInsertedRecord, m, value);
    }
    if (_.isArray(value)) {
      value = _.map(value, function(element) {
        if (isObj(element)) {
          var m = cloneMemo(memo);
          m.depth = memo.depth + 1;
          element = visit(inserter, getLinkOfInsertedRecord, m, element);
        }
        return element;
      });
    }
    memo.fields[fieldName] = value;
    return memo;
  };

  var updater = function(memo, newValue, fieldName) {
    var existingFields = caches.get(memo.record);
    var oldValue = existingFields[fieldName];
    if (isLink(oldValue)) {
      var record = memo.table.get(toId(oldValue));
      if (isObj(newValue)) {
        var m = cloneMemo(memo);
        m.record = record;
        m.depth = memo.depth + 1;
        memo.fields[fieldName] = visit(updater, getLinkOfUpdatedRecord, m, newValue);
        return memo;
      } else {
        deleteRecord(record);
      }
    }
    if (isList(oldValue)) {
      _.each(oldValue.toArray(), function(element) {
        if (isLink(element)) {
          var record = memo.table.get(toId(element));
          deleteRecord(record);
        }
      });
    }
    return inserter(memo, newValue, fieldName);
  };

  var fieldsReducer = function(reduceFun, resultFun, memo, value, fieldName) {
    memo.fields[fieldName] = value;
    if (isLink(value)) {
      var m = cloneMemo(memo);
      m.record = memo.table.get(toId(value));
      var fields = m.record ? caches.get(m.record) : null;
      memo.fields[fieldName] = visit(funs[reduceFun], funs[resultFun], m, fields);
    }
    if (isList(value)) {
      memo.fields[fieldName] = _.map(value.toArray(), function(element) {
        if (isLink(element)) {
          var m = cloneMemo(memo);
          m.record = memo.table.get(toId(element));
          var fields = m.record ? caches.get(m.record) : null;
          element = visit(funs[reduceFun], funs[resultFun], m, fields);
        }
        return element;
      });
    }
    return memo;
  };

  var funs = {};

  var getter = funs.getter = _.partial(fieldsReducer, 'getter', 'postGet');
  var deleter = funs.deleter = _.partial(fieldsReducer, 'deleter', 'postDelete');

  var postInsert = function(memo) {
    memo.fields.depth = memo.depth;
    memo.record = memo.table.insert(memo.fields);
    return memo;
  };

  var postUpdate = function(memo) {
    caches.deleteCache(memo.record);
    memo.record = memo.record.update(memo.fields);
    return memo;
  };

  var postGet = funs.postGet = function(memo) {
    if (_.has(memo.fields, 'depth')) delete memo.fields.depth;
    return memo.fields;
  };

  var postDelete = funs.postDelete = function(memo) {
    caches.deleteCache(memo.record);
    return memo.record.deleteRecord();
  };

  var getLink = function(memo) {
    return 'id:' + memo.record.getId();
  }

  var getRecord = function(memo) {
    return memo.record;
  }

  var getLinkOfInsertedRecord = _.compose(getLink, postInsert);
  var getInsertedRecord = _.compose(getRecord, postInsert);
  var getLinkOfUpdatedRecord = _.compose(getLink, postUpdate);
  var getUpdatedRecord = _.compose(getRecord, postUpdate);

  // Helpers
  // -------

  var toString = Object.prototype.toString;
  var isObj = function(value) { return value && toString.call(value) === '[object Object]'; };
  var isList = function(value) { return value && _.isFunction(value.toArray); };
  var isLink = function(value) { return _.isString(value) && value.substring(0, 3) === 'id:'; };
  var toId = function(value) { return value.slice(3); };

  var cloneMemo = function(memo) {
    cloned = _.clone(memo);
    cloned.fields = {};
    return cloned;
  };

  // objectbox.Table
  // ---------------

  var Table = function(table) {
    if (!(this instanceof Table)) return new Table(Table);
    this.table = table;
  };

  // objectbox.Record
  // ----------------

  var Record = function(record) {
    if (!(this instanceof Record)) return new Record(record);
    this.record = record;
  };

  // Exports
  // -------

  objectbox.insert = insert;
  objectbox.query = query;
  objectbox.get = get;
  objectbox.set = set;
  objectbox.update = update;
  objectbox.deleteRecord = deleteRecord;
  objectbox.getFields = getFields;
  objectbox.clearChache = caches.clear;
  objectbox.Table = Table;
  objectbox.Record = Record;

  // Methods
  // -------

  // Internal function to convert function to method.
  var funToMethod = function(target, names, mapFun) {
    var obj = {};
    _.each(names, function(name) {
      obj[name] = function() {
        return mapFun(objectbox[name].apply(this, [this[target]].concat(_.toArray(arguments))));
      };
    });
    return obj;
  };

  // Internal function to create objectbox.Record instance(s).
  var createRecord = function(record) {
    if (_.isArray(record)) {
      return _.map(record, function(r) { return createRecord(r); });
    } else {
      return new Record(record);
    }
  };

  // Attach inheritable methods to the objectbox.Table prototype.
  _.extend(Table.prototype, funToMethod('table', ['insert', 'query'], createRecord));

  // Attach inheritable methods to the objectbox.Record prototype.
  _.extend(Record.prototype, funToMethod('record', ['set', 'update', 'deleteRecord'], createRecord));
  _.extend(Record.prototype, funToMethod('record', ['get', 'getFields'], _.identity));

})(this);