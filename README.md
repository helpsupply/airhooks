# AirHooks - Webhooks to/from Airtable

**Why?**

Airtable is great for standing up small-scale database needs, but provides no triggers out of the box so that you can program things to happen when data changes. You can use glue services like Zapier or Integromat, but they're amazingly expensive. For most use-cases you can run AirHooks on Google Firebase and pay nothing as you'll be under the free tier limits.

**Features**

- Easy management via an Airtable
- Easy deployment via Firebase Functions
- Guaranteed reliable (if your Web Hook errors out, the package won't drop the data but send it next time).

**How it works**

A Firebase Function runs at a fixed interval (i.e. once a minute) and compares the current Airtable state to the previous state (which is has cached). Any changes are pushed to a webhook as configured in a master Airtable base.

**Deployment**

1. Clone this repository
2. Install the firebase tools (`npm install -g firebase-tools`)
3. Initialize this project to a new project (`firebase init`, configure with Functions, Pubsub and Storage).
4. Clone the config Airtable Base: https://airtable.com/shrOZoREOcb5ERv1Q
5. Get your Airtable API key from https://airtable.com/account and the Base ID from https://airtable.com/api
6. Configure firebase with the above: `firebase functions:config:set airtable.key="XXXX" airtable.base="XXXX"`
7. Deploy with `firebase deploy`

**Tips**

You can use something like https://ngrok.com/ to expose a dummy webhook to the internet. I've included `dummy_server.js` in the functions directory, you can run with `node dummy_server.js` that just prints all payloads.
 
