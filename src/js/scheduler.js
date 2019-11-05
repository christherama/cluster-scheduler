import cluster from "cluster";
import os from "os";

const DONE = "done";

class Scheduler {
  /**
   * Create a scheduler
   * @param {*} processMessage Function for running process
   */
  constructor(processMessage) {
    this.processMessage = processMessage
    this.startWorkers();
  }

  startWorkers() {
    for (let i = 0; i < os.cpus().length; i++) {
        let worker = cluster.fork();
        worker.on("message", async ({name, config}) => {
            process.stdout.write(`Worker ${worker.process.pid} processing message ${name}`);
            const result = await this.processMessage(config);
            process.send({status: DONE, result});
        });
      }
  }

  listen(queue) {
    
  }
}

export default Scheduler;
