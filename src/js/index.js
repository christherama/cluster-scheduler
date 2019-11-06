import cluster from "cluster";
import Scheduler from "./scheduler.js";
import { getLogger } from "./logger.js";
import Queue from "./queue.js";
import {Job, READY} from "./job.js";

const logger = getLogger("index");

const processJob = ({ job }) => {
  logger.info(`Processing job ${JSON.stringify(job)}`);
  process.send({ status: READY, result: "success" })
};

if (cluster.isMaster) {
  const scheduler = new Scheduler();
  const queue = new Queue();
  queue.push(new Job({ name: "sample-job", config: { greeting: "hello" } }));
  scheduler.listen(queue);
} else {
  logger.info(`Worker started on PID ${process.pid}`);
  process.on("message", processJob);
}
