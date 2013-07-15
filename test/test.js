var dropbox = require('./vendor/dropbox-datastores-0.1.0-b2.js');
var objectbox = require('../objectbox.js');
var settings = require('./settings.js');
var assert = require('assert');

var client = new dropbox.Client(settings.appKey);

client.authDriver(new dropbox.AuthDriver.NodeServer(settings.authOptions));

client.authenticate(function(error, data) {
  if (error) {
    console.log('Error authenticating: ' + error);
    return;
  }
  console.log('The user is now authenticated');

  var datastoreManager = client.getDatastoreManager();

  datastoreManager.openDefaultDatastore(function(error, datastore) {
    if (error) {
      console.log('Error openning default datastore: ' + error);
      return;
    }
    console.log('The datastore is now opened');

    var table = datastore.getTable('object');

    var clearAllRecords = function() {
      var records = table.query();
      for (var i = 0; i < records.length; i++) {
        records[i].deleteRecord();
      }
    };

    // FP style APIs

    clearAllRecords();

    var obj = { a: 'a', b: { c: [1, { d: 'd' }] } };
    var record = objectbox.insert(table, obj);
    var retrieved = objectbox.getFields(record);
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: 'c2' } };
    record = objectbox.update(record, obj);
    retrieved = objectbox.getFields(record);
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: 'c2' }, d: 'd' };
    record = objectbox.update(record, obj);
    retrieved = objectbox.getFields(record);
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: 'c2' }, d: { e: 'e'} };
    record = objectbox.update(record, obj);
    retrieved = objectbox.getFields(record);
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: 'b', d: { e: 'e'} };
    record = objectbox.update(record, obj);
    retrieved = objectbox.getFields(record);
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: { f: 'f'} }, d: { e: 'e'} };
    record = objectbox.set(record, 'b', obj.b);
    retrieved = objectbox.getFields(record);
    assert.deepEqual(retrieved, obj);

    var records = objectbox.query(table, {}, 2);
    objectbox.deleteRecord(records[0]);
    retrieved = objectbox.getFields(record);
    obj = { a: 'a2', b: { c: null }, d: { e: 'e'} };
    assert.deepEqual(retrieved, obj);

    retrieved = objectbox.get(record, 'b');
    obj = { c: null };
    assert.deepEqual(retrieved, obj);

    // OOP style APIs

    clearAllRecords();

    var table2 = new objectbox.Table(table);
    obj = { a: 'a', b: { c: [1, { d: 'd' }] } };
    var record2 = table2.insert(obj);
    retrieved = record2.getFields();
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: 'c2' } };
    record2.update(obj);
    retrieved = record2.getFields();
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: 'c2' }, d: 'd' };
    record2.update(obj);
    retrieved = record2.getFields();
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: 'c2' }, d: { e: 'e'} };
    record2.update(obj);
    retrieved = record2.getFields();
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: 'b', d: { e: 'e'} };
    record2.update(obj);
    retrieved = record2.getFields();
    assert.deepEqual(retrieved, obj);

    obj = { a: 'a2', b: { c: { f: 'f'} }, d: { e: 'e'} };
    record2.set('b', obj.b);
    retrieved = record2.getFields();
    assert.deepEqual(retrieved, obj);

    var records2 = table2.query({}, 2);
    records2[0].deleteRecord();
    retrieved = record2.getFields();
    obj = { a: 'a2', b: { c: null }, d: { e: 'e'} };
    assert.deepEqual(retrieved, obj);

    retrieved = record2.get('b');
    obj = { c: null };
    assert.deepEqual(retrieved, obj);

  });

});