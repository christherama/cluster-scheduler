class Job {
    /**
     * Create a job
     * @param {Object} o
     * @param {string} o.name Name to associate with job
     * @param {*} o.config Object to be used by job-specific processor
     */
    constructor({name, config}) {
        this.name = name;
        this.config = config
    }
}

export default Job;