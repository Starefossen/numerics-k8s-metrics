'use strict';

const fs = require('fs');
const K8s = require('k8s');
const request = require('request');
const schedule = require('node-schedule');

const kubeapi = K8s.api({
  endpoint: process.env.K8S_API_URL,
  version: '/api/v1',
  auth: {
    clientKey: fs.readFileSync(process.env.K8S_CLIENT_KEY),
    clientCert: fs.readFileSync(process.env.K8S_CLIENT_CERT),
    caCert: fs.readFileSync(process.env.K8S_CA_CERT),
  },
});

console.log('Starting cron task', process.env.CRON_TIME);

schedule.scheduleJob(process.env.CRON_TIME, () => {
  console.log('Running cron task...');

  kubeapi.get('nodes')
    .catch(err => { throw err })
    .then(data => {
      const nodes = data.items.map(item => ({
        name: item.metadata.name,
        status: item.status.conditions.reduce((status, item) => (
          item.status === "True" ? item.type : status
        ), 'Unknown'),
      }));

      console.log(`Found "${nodes.length}" nodes`);

      const opts = {
        method: 'PUT',
        json: true,
        uri: `${process.env.NUMERICS_API_URL}/node`,
        body: nodes,
      };

      request.put(opts, (err, res, body) => {
        if (err) { throw err; }

        console.log('Numerics API Status Code', res.statusCode);

        if (res.statusCode !== 200) {
          console.log(body);
        }
      });
    });
});

process.on('SIGINT', () => process.exit());
