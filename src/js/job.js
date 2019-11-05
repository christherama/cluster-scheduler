class Job {
    /**
     * Create a job
     * @param {string} name Name to associate with job
     * @param {*} config Object to be used by job-specific processor
     */
    constructor(name, config) {
        this.name = name;
        this.config = config
    }
}