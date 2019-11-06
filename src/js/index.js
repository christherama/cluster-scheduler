import cluster from "cluster";
import Scheduler from "./scheduler.js";
import { getLogger } from "./logger.js";
import Queue from "./queue.js";
import { READY } from "./worker.js";
import Job from "./job.js";

const logger = getLogger("index");

const processJob = ({ job }) => {
  logger.info(`Processing job ${JSON.stringify(job)}`);
  setTimeout(() => {
      process.send({ status: READY, result: "success" });
  }, 2000);
};

if (cluster.isMaster) {
  const scheduler = new Scheduler({ numWorkers: 2 });
  const queue = new Queue();
  queue.push(new Job({ name: "sample-job", config: { greeting: "hello #1" } }));
  queue.push(new Job({ name: "sample-job", config: { greeting: "hello #2" } }));
  scheduler.listen(queue);
} else {
  logger.info(`Worker started on PID ${process.pid}`);
  process.on("message", processJob);
}
