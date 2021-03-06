# AirHooks - Webhooks to/from Airtable

## Why?

Airtable is great for standing up small-scale database needs, but provides no triggers out of the box so that you can program things to happen when data changes. You can use glue services like Zapier or Integromat, but they're amazingly expensive. For most use-cases you can run AirHooks on Google Firebase and pay next-to-nothing as you'll be under the free tier limits.

## Features

- Authenticated webhooks to add data to an Airtable
- Webhooks to receive updates from an airtable
- Easy management via an Airtable
- Easy deployment via Firebase Functions
- Guaranteed reliable (if your Web Hook errors out, the package won't drop the data but send it next time).

## How it works

A Firebase Function runs at a fixed interval (i.e. once a minute) and compares the current Airtable state to the previous state (which it will hold a hash of for comparison purposes rather than the raw data). Any changes that match a particular pattern are pushed to a webhook as configured in a master Airtable base.

The config airtable base has the following fields:
- Name: Human readable identifier/name
- Hook Name: identifier used in Webhook url's
- Callback URL: webhook to post changes to
- Callback Pattern: Regular expression to match in a potential update
- Status: current status of the webhook (as reported by AirHooks, don't modify this)
- Base: Airtable Base ID (from https://airtable.com/api).
- Table: Table name to monitor/edit
- Webhook Auth Token: string to authenticate webhook calls to create new rows

**Creating a new row**

To create a new row, post a JSON payload with a Content-Type header equal to "application/json" and an "X-Auth-Token" header equal to the "Webhook Auth Token" from the config airtable. Here's how to do this with the command-line utility`curl`:

1. To create a new row, get some sample data in the format that is expected by Airtable by going to the appropriate Airtable API page on https://airtable.com/api.
2. Save this to a file `payload.json`
3. Get the webhook URL from the Firebase Console in the Functions section, it should look something like "https://us-central1-projectname.cloudfunctions.net/hook"
4. Run the following command `curl --data-binary @payload.json -H "Content-Type:application/json" -H "x-auth-token:WebhookAuthToken" https://us-central1-projectname.cloudfunctions.net/hook/HookName` 
5. Verify that Airtable has received the row!

## Deployment

1. Clone this repository
2. Install the firebase tools (`npm install -g firebase-tools`)
3. Initialize this project to a new project (`firebase init`, configure with Functions, Pubsub and Storage).
4. Clone the config Airtable Base: https://airtable.com/shrOZoREOcb5ERv1Q
5. Get your Airtable API key from https://airtable.com/account and the Base ID from https://airtable.com/api
6. Configure firebase with the above: `firebase functions:config:set airtable.key="XXXX" airtable.base="XXXX"`
7. Deploy with `firebase deploy`

## Tips

**Exporting a Table's Schema**

Airtable unfortunately does not expose a Table's schema via its API, but you can use a script as follows to get a programmatic description of everything (that a developer can use to integrate with their application).

1. Create a new Script Block in the relevant Base with the following code:
```
output.markdown('# Table Format Exporter');

let table = await input.tableAsync("Pick a table to describe")

let fields = {};
for (let field of table.fields) {
    fields[field.name] = {
        description: field.description,
        type: field.type,
        options: field.options,
        isComputed: field.isComputed
    }
}

output.markdown('# Copy and Paste the below text (triple-click to select-all) and send to whomever');
output.text(JSON.stringify({
    baseName: base.name,
    base: base.id,
    table: table.name,
    exporter: {
        name: session.currentUser.name,
        email: session.currentUser.email
    },
    exportTime: (new Date()).toJSON(),
    fields: fields
}))
```
2. Run it and send the output to the person who needs it!

**Local Webhook Testing**

You can use something like https://ngrok.com/ to expose a dummy webhook to the internet. I've included `dummy_server.js` in the functions directory, you can run with `node dummy_server.js` that just prints all payloads.

**Performance**

This tool takes advantage of the fact that Airtable bases are small (max 50k rows, 2k rows for the free edition). Because Airtable exposes no change history, we just pull the whole table and diff it against the last seen revision for each webhook (and we cache the last seen revision per webhook once we've successfully delivered it). Further, because Airtable has proper row IDs we can use a dictionary based lookup for comparison resulting in a runtime of `O(number of rows * number of columns)`.

