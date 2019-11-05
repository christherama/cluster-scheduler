import cluster from "cluster";
import Scheduler from "./scheduler.js";
import { getLogger } from "./logger.js";

const logger = getLogger("index");

if (cluster.isMaster) {
  new Scheduler();
} else {
  logger.info(`Worker started on PID ${process.pid}`);
}
