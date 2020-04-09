const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const deepEqual = require('deep-equal');

// Airtable Configuration
var Airtable = require('airtable');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_API_KEY
});

// Firebase Configuration (to store snapshots)
if (process.env.SERVICE_KEY) {
	var serviceAccount = require('./' + process.env.SERVICE_KEY);
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp();
}
var storage = admin.storage();
var bucket = storage.bucket();

// This is called on a scheduled basis by firebase
exports.processHooks = functions.https.onRequest(async (request, response) => {
  // First get all of the hooks as listed in the configuration base.
  let hookQuery = (await Airtable.base(process.env.AIRTABLE_CONFIG_BASE).table('Hooks').select());
  let hooks = (await hookQuery.all()).map((h) => Object.assign(h.fields, {id: h.id}));

  // Get unique tables that we need to pull (so we don't overload a single base)
  let tables = [...new Set(hooks.filter((hook) => hook['Can Read']).map((hook) => [hook['Base'], hook['Table']]))]

  // Pull all the data from Airtable
  let cache = {};
  let data = await Promise.allSettled(tables.map(async (table) => {
  	return [table, (await (await Airtable.base(table[0]).table(table[1]).select()).all()).map((r) => Object.assign(r.fields, {id: r.id}))];
  }));
  data.map((row) => {
	if (row.status == 'fulfilled') {
		let key = row.value[0][0] + ':' + row.value[0][1];
		cache[key] = {};
		row.value[1].map((r) => {
			cache[key][r.id] = r;
		});
	}
  });

  // For each hook, pull the latest sent data from storage
  let lastCache = await Promise.allSettled(hooks.map(async (hook) => {
  	return JSON.parse((await bucket.file('cache_' + hook.id + '.json').download())[0].toString());
  }));

  // Now actually compute the diffs
  await Promise.allSettled(hooks.map(async (hook, i) => {
	console.log(hook);

	let added = [];
	let updated = [];
	let deleted = [];

	let previous = (lastCache[i].status === 'fulfilled') ? lastCache[i].value : {};
	let current = cache[hook['Base'] + ':' + hook['Table']];

	for (var key in current) {
		if (!previous[key]) {
			added.push(current[key]);
		} else {
			// In the future we can perhaps, push only
			// updated columns
			if (!deepEqual(current[key], previous[key])) {
				updated.push(current[key]);
			}
		}
	}
	for (var key in previous) {
		if (!current[key]) {
			deleted.push(key);
		}
	}

	// If no diffs, nothing to update
	if (added.length == 0 && updated.length == 0 && deleted.length == 0) {
		console.log("No changes");
		return;
	}

	// Push changes to the webhook
	let changes = { added, updated, deleted };
	try {
		await fetch(hook['Callback URL'], {
			method: 'post',
			body: JSON.stringify(changes),
			headers: { 'Content-Type': 'application/json' }
		});
  		await bucket.file('cache_' + hook.id + '.json').save(JSON.stringify(current));
	} catch (e) {
		// TODO: Mark this as not succeeding in Airbase
	}
  }));
  response.send("OK");
});

// This is called by consumers/publishers to publish something
exports.hook = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});

// This is called by consumers/publishers to reset their state (and get a full copy of everything next update)
exports.reset = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});
