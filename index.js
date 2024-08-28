const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < Math.min(2, numCPUs); i++) { // Limiting to 2 replica sets
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Restart the worker on failure
    });
} else {
    require('./server'); // Load server.js to handle API requests
    console.log(`Worker ${process.pid} started`);
}