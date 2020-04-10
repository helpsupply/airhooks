const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const deepEqual = require('deep-equal');
Promise.allSettled = require('promise.allsettled'); // Firebase runs an ancient Node with no Promise.allSettled


const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || functions.config().airtable.key;
const AIRTABLE_CONFIG_BASE = process.env.AIRTABLE_CONFIG_BASE || functions.config().airtable.base;
const SERVICE_KEY = process.env.SERVICE_KEY;

// Airtable Configuration
var Airtable = require('airtable');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: AIRTABLE_API_KEY
});

// Firebase Configuration (to store snapshots)
if (SERVICE_KEY) {
	var serviceAccount = require('./' + SERVICE_KEY);
	admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
	admin.initializeApp();
}
var storage = admin.storage();
var bucket = storage.bucket();

// This is called on a scheduled basis by firebase
async function checkForUpdates() {
  // First get all of the hooks as listed in the configuration base.
  let hookQuery = (await Airtable.base(AIRTABLE_CONFIG_BASE).table('Hooks').select());
  let hooks = (await hookQuery.all()).map((h) => Object.assign(h.fields, {id: h.id}));

  // Get unique tables that we need to pull (so we don't overload a single base)
  let tables = [...new Set(hooks.filter((hook) => hook['Can Read']).map((hook) => [hook['Base'], hook['Table']]))]

  // Pull all the data from Airtable
  let cache = {};
  let data = await Promise.allSettled(tables.map(async (table) => {
  	return [table, (await (await Airtable.base(table[0]).table(table[1]).select()).all()).map((r) => Object.assign(r.fields, {id: r.id}))];
  }));
  data.map((row) => {
	if (row.status === 'fulfilled') {
		let key = row.value[0][0] + ':' + row.value[0][1];
		cache[key] = {};
		row.value[1].map((r) => {
			cache[key][r.id] = r;
			return null;
		});
	}
	return null;
  });

  // For each hook, pull the latest sent data from storage
  let lastCache = await Promise.allSettled(hooks.map(async (hook) => {
  	return JSON.parse((await bucket.file('cache_' + hook.id + '.json').download())[0].toString());
  }));

  // Now actually compute the diffs
  let status = await Promise.allSettled(hooks.map(async (hook, i) => {
	let added = [];
	let updated = [];
	let deleted = [];

	let previous = (lastCache[i].status === 'fulfilled') ? lastCache[i].value : {};
	let current = cache[hook['Base'] + ':' + hook['Table']];

	for (let key in current) {
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
	for (let key in previous) {
		if (!current[key]) {
			deleted.push(key);
		}
	}

	// If no diffs, nothing to update
	if (added.length === 0 && updated.length === 0 && deleted.length === 0) {
		console.log("No changes");
		return "working";
	}

	// Push changes to the webhook
	let changes = { added, updated, deleted };
	try {
		let res = await fetch(hook['Callback URL'], {
			method: 'post',
			body: JSON.stringify(changes),
			headers: { 'Content-Type': 'application/json' },
			timeout: 5000
		});
		if (!res.ok) throw new Error("Failed to call callback");

  		await bucket.file('cache_' + hook.id + '.json').save(JSON.stringify(current));
		return "working";
	} catch (e) {
		return "failed to post";
	}
  }));

  // Update Airtable with the latest status
  let statusChanges = [];
  hooks.map((hook, i) => {
	  if (hook['Status'] !== status[i].value || status[i].status !== 'fulfilled') {
		  statusChanges.push({
			"id": hook["id"],
			"fields": {
				"Status": (status[i].value || "failed to post")
			}
		  });
	  }
	  return null;
  });
  if (statusChanges.length > 0) {
  	await Airtable.base(process.env.AIRTABLE_CONFIG_BASE).table('Hooks').update(statusChanges);
  }
}

exports.processHooks = functions.https.onRequest(async (request, response) => {
  await checkForUpdates();
  response.send("OK");
});

exports.scheduledProcessing = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  await checkForUpdates();
});

// This is called by consumers/publishers to publish something
exports.hook = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});

// This is called by consumers/publishers to reset their state (and get a full copy of everything next update)
exports.reset = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});
