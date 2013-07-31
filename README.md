Objectbox.js
============

Objectbox.js is a JavaScript library for storing and retrieving a JavaScript object in Dropbox's [Datastore](https://www.dropbox.com/developers/datastore) with its nested structure using `RecordId`-based linking of the records.

# Installation

## Node.js

Add this line to `dependencies` field in your package.json:

```javascript
"objectbox": "git://github.com/thunder9/objectbox.js.git"
```

Then run the following:

```
npm install
```

## Browser

Include `objectbox.js` in your html.

# Example

```javascript

var dropbox = require('dropbox-datastores-0.1.0-b2.js'); // Datastore API
var objectbox = require('objectbox');

var appKey = { /* your setting */ };
var authOptions = { /* your setting */ };

var client = new dropbox.Client(appKey);

client.authDriver(new dropbox.AuthDriver.NodeServer(authOptions));

client.authenticate(function(error, data) {
  if (error) {
    console.log('Error authentication: ' + error);
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

    // Create an instance of the `objectbox.Table`.
    var table = new objectbox.Table(datastore.getTable('object'));

    // Insert an object to the datastore.
    var record = table.insert({ a: 'a', b: { c: [1, { d: 'd' }] } });

    // Fig.1

    // Retrieve the object from the datastore.
    var retrieved = record.get(); // => { a: 'a', b: { c: [1, { d: 'd' }] } }

    // Update the object in the datastore.
    record.update({ b: { c: 'c2' }, e: 'e' });

    // Fig.2

    // Retrieve the object from the datastore again.
    retrieved = record.get(); // => { a: 'a', b: { c: 'c2' }, e: 'e' }

  }
}

```

Fig.1

![Fig.1](https://raw.github.com/thunder9/objectbox.js/master/docs/fig1.png)

Fig.2

![Fig.2](https://raw.github.com/thunder9/objectbox.js/master/docs/fig2.png)

# FP style APIs

```javascript

table // instance of Dropbox.Datastore.Table
record// instance of Dropbox.Datastore.Record
ary   // array of instances of Dropbox.Datastore.Record
obj   // object that is retrieved from the datastore, or passed to the datastore
val   // value that retrieved form the datastore

o = objectbox

// Creates a new record(s) in the `table`, populated with the given `obj`ect.
record = o.insert(table, obj)

// Retrieves the records from the `table` whose field match values of `fieldValues` and `depth`.
ary = o.query(table, fieldValues, depth)

// Returns a field's value, or null if the field does not exist. If no `fieldName` is given,
// returns an object that has the values of all the fields in the `record` and its children.
val = o.get(record, fieldName)
obj = o.get(record)

// Changes a field's value.
record = o.set(recordfieldName, value)

// Updates the record and its children with the given `obj`ect.
record = o.update(record, obj)

// Deletes `record` and its children from the datastore.
record = o.deleteRecord(record)

// Returns an object that has the values of all the fields in the `record`.
obj = o.getFields(record)
```

# OOP style APIs

```javascript

table // instance of Dropbox.Datastore.Table
t     // instance of objectbox.Table
r     // instance of objectbox.Record
ary   // array of instances of objectbox.Record
obj   // object that is retrieved from the datastore, or passed to the datastore
val   // value that retrieved form the datastore

t   = new objectbox.Table(table)
r   = t.insert(obj)
ary = t.query(fieldValues, depth)

val = r.get(fieldName)
obj = r.get()
r   = r.set(fieldName, value)
r   = r.update(obj)
r   = r.deleteRecord()
obj = r.getFields()
```

# License

Copyright (c) 2013 thunder9 licensed under the MIT license.