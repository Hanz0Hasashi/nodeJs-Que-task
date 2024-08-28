const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

// Connect to MongoDB
//need to add your database
mongoose.connect('mongodb://localhost:27017/your_database', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('connection error:', err);
    process.exit(1);
});








// Mongoose Schemas
const taskSchema = new mongoose.Schema({
    user_id: String,
    createdAt: { type: Date, default: Date.now },
});

const rateLimitSchema = new mongoose.Schema({
    user_id: String,
    timestamps: [Date], // Store timestamps of user requests
});

const Task = mongoose.model('Task', taskSchema);
const RateLimit = mongoose.model('RateLimit', rateLimitSchema);






// Express App Setup
const app = express();
app.use(express.json());

// Rate Limiting Logic
async function isRateLimited(user_id) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneSecondAgo = new Date(now.getTime() - 1000);

    let rateLimit = await RateLimit.findOne({ user_id });

    if (!rateLimit) {
        rateLimit = new RateLimit({ user_id, timestamps: [now] });
        await rateLimit.save();
        return false;
    }

    // Remove timestamps older than 1 minute
    rateLimit.timestamps = rateLimit.timestamps.filter(ts => ts > oneMinuteAgo);

    // Check if more than 1 request in the last second
    if (rateLimit.timestamps.filter(ts => ts > oneSecondAgo).length >= 1) {
        return true; // Block request: 1 request per second
    }

    // Check if more than 20 requests in the last minute
    if (rateLimit.timestamps.length >= 20) {
        return true;
    }

    // Allow request and update timestamps
    rateLimit.timestamps.push(now);
    await rateLimit.save();
    return false;
}

// Task Processing Logic
async function processTask(user_id) {
    const logMessage = `${user_id}-task completed at-${new Date().toISOString()}\n`;
    fs.appendFileSync('task_log.txt', logMessage);
    console.log(logMessage);
}

// API Route for Task Submission
app.post('/task', async (req, res) => {
    const user_id = req.body.user_id;

    if (!user_id) {
        return res.status(400).send('Invalid request: user_id is required');
    }

    const rateLimited = await isRateLimited(user_id);

    if (rateLimited) {
        return res.status(429).send('Too Many Requests');
    }

    // Add task to queue (stored in MongoDB)
    const task = new Task({ user_id });
    await task.save();

    res.status(200).send('Task is being processed');
});

// Background Task Processor
async function processTasks() {
    const tasks = await Task.find({}).sort('createdAt').limit(10); // Process tasks in batches

    for (const task of tasks) {
        await processTask(task.user_id);
        await Task.deleteOne({ _id: task._id });
    }

    setTimeout(processTasks, 1000); // Run every second
}

processTasks();

// Start Express Server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});


//To connect make sure to alter the mongoDb API here i used Atlas.