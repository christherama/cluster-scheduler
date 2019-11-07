# cluster-scheduler

[![npm version](http://img.shields.io/npm/v/cluster-scheduler.svg?style=flat)](https://npmjs.org/package/cluster-scheduler "View this project on npm")

This is a nodejs package for scheduling tasks to be distributed among cluster workers that are optionally CPU-bound.

## Use this package

Here is a sample of how you can use this npm package.

**Install the package**

With `yarn`...

```bash
yarn add cluster-scheduler
```

With `npm`...

```bash
npm i cluster-scheduler
```

**Use the package in your code**

_main.js_

```javascript
// Include this for forking processes
const cluster = require("cluster");

const { Scheduler, getLogger, Job, READY } = require("cluster-scheduler");
const logger = getLogger("index");

/*
 * Declare a function that a worker will use for processing a job. This function will be
 * called by a worker when it receives a message from the master process.
 *
 * This function takes one argument, which is the `Job` object scheduled below
 */
const processJob = job => {
  logger.info(`Processing job '${job.name}'`);

  // Do something that takes awhile
  setTimeout(() => {
    process.send({
      workerStatus: READY,
      results: job.config.greeting // this is the argument passed to the `handleResult` function below
    });
  }, 2000);
};

/*
 * Declare a function to handle the result of the job. This function will be called
 * upon receiving a message back from a cluster worker.
 *
 * This function accepts one argument, which is a arbitrary object sent as the `results`
 * property in the message sent by the worker above
 */
const handleResult = results => {
  logger.info(`Results are in: ${results}`);
};

if (cluster.isMaster) {
  // Start the scheduler on the master process, with one worker per underlying core
  const scheduler = new Scheduler({});
  logger.info(`Scheduler started. Spawning ${scheduler.numWorkers} processes.`);

  // Schedule a job now and every 2s
  scheduler
    .schedule(
      new Job({
        name: "sample-job",
        config: { greeting: "hello" },
        callback: handleResult
      })
    )
    .now()
    .and()
    .every({ s: 2 });
} else {
  // For worker processes, listen for messages (jobs) from the master process
  logger.info(`Worker started on PID ${process.pid}`);
  process.on("message", processJob);
}
```

_Note: You can find this source code in [samples/main.js](samples/main.js)_

**Run your code**

```bash
node main.js
```
