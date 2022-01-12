const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');

// Utils
const rateLimiter = require('./utils/rateLimiter')
const secureHeaders = require('./utils/secureHeaders')

// Models
const SocketBanRecord = require('./models/SocketBanRecord')
const SocketDuplicateRecord = require('./models/SocketDuplicateRecord')

// Express & Socket.io Server
const app = express();
const server = http.createServer(app);
const io = socketio(server)

require('./controllers/socketController')(io);

// Middleware
require('dotenv').config();

secureHeaders(app)
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.set('view engine', 'ejs');

// Routes
const homeRoutes = require('./routes/homeRoutes');
const roomRoutes = require('./routes/roomRoutes');

app.use('/room', rateLimiter(60, 25), roomRoutes)
app.use('/', rateLimiter(60, 45), homeRoutes)

app.use(rateLimiter(60, 45), (req, res, next) => {
    res.status(404).render("404/404")
})

// Error Handler
function shutDown(e) {
    console.log(e);
    
    console.log('Shutting down...');

    server.close(() => {
        console.log('Closed server in time');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close server in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Database Connection
require('./utils/db').then(async() => {
    // Remove Socket Duplicate & Ban Records
    await SocketBanRecord.deleteMany({})
    await SocketDuplicateRecord.deleteMany({})

    // Error Handling
    process.on('uncaughtException', shutDown); 
    process.on('SIGINT', shutDown)

    // Listener
    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    })    
})
