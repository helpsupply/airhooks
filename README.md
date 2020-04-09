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

To be written!
