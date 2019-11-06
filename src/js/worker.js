const READY = "ready";
const BUSY = "busy";

const _workers = [];

class Worker {
  constructor({ status = READY, clusterWorker }) {
    this.status = status;
    this._worker = clusterWorker;
    this.pid = clusterWorker.process.pid;
  }

  send(message) {
    this._worker.send(message);
    return getAvailableWorker();
  }
}

const getAvailableWorker = () => {
  return _workers.find(({ status }) => status === READY);
};

const getWorkerByPid = id => {
  return _workers.find(({ pid }) => pid == id);
};

const workers = {
    add: clusterWorker => {
        _workers.push(new Worker({clusterWorker}));
    },
    byPid: id => {
        return _workers.find(({ pid }) => pid == id);
    },
    nextAvailable: () => {
        return _workers.find(({ status }) => status === READY);
    }
};

export { workers, READY, BUSY };
