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
    get: function(record, fieldName, gen) {
      var key = this.toKey(record, fieldName);
      return _.has(this._caches, key) ? this._caches[key] : this._caches[key] = gen();
    },
    deleteCache: function(record, fieldName) {
      var key = this.toKey(record, fieldName);
      if (_.has(this._caches, key)) delete this._caches[key];
    },
    toKey: function(record, fieldName) {
      if (!_.isString(fieldName)) fieldName = '';
      return record.getId() + ':' + fieldName;
    },
    clear: function() { this._caches = {}; }
  };

  // Functions
  // ---------

  // Creates a new record(s) in the `table`, populated with the given `obj`ect.
  var insert = function(table, obj) {
    return _insertOrUpdate('insert', table, obj, 0);
  };

  // Updates the record and its children with the given `obj`ect.
  var update = function(record, obj) {
    return _insertOrUpdate('update', record, obj);
  };

  // Changes a field's value.
  var set = function(record, fieldName, value) {
    var obj = {};
    obj[fieldName] = value;
    return update(record, obj);
  };

  // Internal function to insert given object into the table, or update records.
  var _insertOrUpdate = function(op, tableOrRecord, obj, depth) {
    var fieldValues = {};
    if (_.isNumber(depth)) fieldValues.depth = depth++;
    var existingFields = op === 'update'
      ? caches.get(tableOrRecord, null, function() { return tableOrRecord.getFields(); }) : null;
    _.each(_.keys(obj), function(fieldName) {
      if (op === 'update') {
        var table = tableOrRecord.getTable();
        var value = existingFields[fieldName];
        var newValue = obj[fieldName];
        if (value === undefined) {
          fieldValues[fieldName] = _visitObject('insert', table, fieldName, newValue, existingFields.depth + 1);
        } else if (isLink(value)) {
          var record = table.get(toId(value));
          value = fieldValues[fieldName] = _visitObject(op, record, fieldName, newValue, depth);
          if (!isLink(value)) deleteRecord(record);
        } else if (isList(value)) {
          fieldValues[fieldName] = _visitObject('insert', table, fieldName, newValue, depth);
          _.each(value.toArray(), function(element) {
            if (isLink(element)) {
              var record = table.get(toId(element));
              deleteRecord(record);
            }
          });
        } else {
          if (isObj(newValue)) {
            fieldValues[fieldName] = _visitObject('insert', table, fieldName, newValue, existingFields.depth + 1);
          } else {
            fieldValues[fieldName] = _visitObject(op, tableOrRecord, fieldName, newValue, depth);
          }
        }
        caches.deleteCache(tableOrRecord);
        caches.deleteCache(tableOrRecord, fieldName);
      } else {
        fieldValues[fieldName] = _visitObject(op, tableOrRecord, fieldName, obj[fieldName], depth);
      }
    });
    return op === 'insert' ? tableOrRecord.insert(fieldValues) : tableOrRecord.update(fieldValues);
  };

  // Internal function to visit the nested objects.
  var _visitObject = function(op, tableOrRecord, fieldName, value, depth) {
    if (isObj(value)) {
      var record = _insertOrUpdate(op, tableOrRecord, value, depth);
      value = 'id:' + record.getId();
    }
    if (_.isArray(value)) {
      value = _.map(value, function(element, index) {
        if (isObj(element)) {
          var record = _insertOrUpdate(op, tableOrRecord, element, depth);
          element = 'id:' + record.getId();
        }
        return element;
      });
    }
    return value;
  };

  // Returns an object that has the values of all the fields in the `record`.
  var getFields = function(record) {
    return _getOrDelete('get', record);
  };

  // Deletes `record` and its children from the datastore.
  var deleteRecord = function(record) {
    return _getOrDelete('delete', record);
  };

  // Returns a field's value, or null if the field does not exist. If no `fieldName` is given,
  // returns an object that has the values of all the fields in the `record` and its children.
  var get = function(record, fieldName) {
    if (fieldName) {
      return _visitRecord('get', record, fieldName);
    } else {
      return getFields(record);
    }
  };

  // Internal function to get the object from the table, or delete records.
  var _getOrDelete = function(op, record) {
    var obj = _.clone(caches.get(record, null, function() { return record.getFields(); }));
    _.each(_.keys(obj), function(fieldName) {
      obj[fieldName] = _visitRecord(op, record, fieldName);
    });
    if (_.has(obj, 'depth')) delete obj.depth;
    if (op === 'delete') {
      obj = record.deleteRecord();
      caches.deleteCache(record, null);
    }
    return obj;
  };

  // Internal function to visit the record through the link.
  var _visitRecord = function(op, record, fieldName) {
    var value = caches.get(record, fieldName, function() { return record.get(fieldName); });
    if (op === 'delete') caches.deleteCache(record, fieldName);
    var table = record.getTable();
    if (isLink(value)) {
      var record = table.get(toId(value));
      value = record ? _getOrDelete(op, record) : null;
    }
    if (isList(value)) {
      value = _.map(value.toArray(), function(element, index) {
        if (isLink(element)) {
          var record = table.get(toId(element));
          element = record ? _getOrDelete(op, record) : null;
        }
        return element;
      });
    }
    return value;
  };

  // Retrieves the records from the `table` whose field match values of `fieldValues` and `depth`.
  var query = function(table, fieldValues, depth) {
    if (_.isNumber(depth)) fieldValues['depth'] = depth;
    return table.query(fieldValues);
  };

  // Helpers
  // -------

  var toString = Object.prototype.toString;
  var isObj = function(value) { return value && toString.call(value) === '[object Object]'; };
  var isList = function(value) { return value && _.isFunction(value.toArray); };
  var isLink = function(value) { return _.isString(value) && value.substring(0, 3) === 'id:'; };
  var toId = function(value) { return value.slice(3); };

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
  var _funToMethod = function(target, names, mapper) {
    var obj = {};
    _.each(names, function(name) {
      obj[name] = function() {
        return mapper(objectbox[name].apply(this, [this[target]].concat(_.toArray(arguments))));
      };
    });
    return obj;
  };

  // Internal function to create objectbox.Record instance(s).
  var _createRecord = function(record) {
    if (_.isArray(record)) {
      return _.map(record, function(r) { return _createRecord(r); });
    } else {
      return new Record(record);
    }
  };

  // Attach inheritable methods to the objectbox.Table prototype.
  _.extend(Table.prototype, _funToMethod('table', ['insert', 'query'], _createRecord));

  // Attach inheritable methods to the objectbox.Record prototype.
  _.extend(Record.prototype, _funToMethod('record', ['set', 'update', 'deleteRecord'], _createRecord));
  _.extend(Record.prototype, _funToMethod('record', ['get', 'getFields'], _.identity));

})(this);