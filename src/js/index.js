import cluster from "cluster";
import Scheduler from "./scheduler.js";
import { getLogger } from "./logger.js";
import Queue from "./queue.js";
import Job from "./job.js";

const logger = getLogger("index");

if (cluster.isMaster) {
  const scheduler = new Scheduler({processJob: (job) => {
      logger.info(`Processing job ${JSON.stringify(job)}`);
  }});
  const queue = new Queue();
  queue.push(new Job({name: "sample-job", config: {greeting: "hello"}}));
  scheduler.listen(queue);
} else {
  logger.info(`Worker started on PID ${process.pid}`);
}
