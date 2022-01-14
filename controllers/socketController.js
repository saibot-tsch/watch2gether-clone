const {v4: uuidv4} = require('uuid')
const axios = require('axios');

const SocketBanRecord = require('../models/SocketBanRecord')

const randomString = require('../helpers/randomString')
const validYTID = require('../helpers/validYTID')
const randomInt = require('../helpers/randomInt')
const parseYTDuration = require('../helpers/parseYTDuration')

const videoRates = new Set([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2])
const ipDuplicates = {}

module.exports = function(io) {
    io.on('connection', async (socket) => {
        const ip = socket.handshake.address;
        
        // Check if client ip has a connection already
        const isDuplicate = ipDuplicates[ip]

        if (isDuplicate) {
            socket.emit('socket_connection_limit')
    
            return socket.disconnect(1);
        } else {
            isDuplicate[ip] = true;
        }

        // Check if Client IP is banned due too many requests
        const isBanned = await SocketBanRecord.findOne({ ip })

        if (isBanned) {
            socket.emit('socket_connection_ban')
    
            return socket.disconnect(1);
        }
    
        // Socket Variables
        socket.username = randomString(5)
        socket.profileId = uuidv4()
        socket.profilePic = randomInt(1, 9)
        socket.roomId = socket.handshake.headers.referer.split(process.env.DOMAIN + "/room/")[1]
        socket.requestInfo = {
            datetime: null,
            requests: 0
        }

        var roomObj = io.sockets.adapter.rooms.get(socket.roomId)
    
        if (roomObj) {
            // Room is full
            if (roomObj.size + 1 > 10) { 
                socket.emit('socket_user_limit')
    
                return socket.disconnect(1);
            } // Client is banned from room 
            else if (roomObj.bannedUsers.has(ip)) { 
                socket.emit('user-ban')
    
                return socket.disconnect(1);
            }
        } 
        
        socket.join(socket.roomId)
    
        roomObj = io.sockets.adapter.rooms.get(socket.roomId)
    
        // Socket Role
        if (roomObj.size == 1) {
            socket.role = 'owner'
        } else {
            socket.role = 'guest'
        }

        // Room Banned Users
        if (roomObj.bannedUsers == undefined) {
            roomObj.bannedUsers = new Set()
        }
        
        // Room Playlist
        if (roomObj.playlist == undefined) {
            roomObj.playlist = []
        }

        // Get other Users in Room
        async function getOtherUsers() {
            const otherUsers = []

            const connectedSockets = await io.in(socket.roomId).fetchSockets()

            connectedSockets.forEach((connectedSocket) => {
                if (socket.id != connectedSocket.id) {
                    const { profileId, profilePic, username, role } = connectedSocket

                    otherUsers.push({
                        profileId,
                        profilePic,
                        username,
                        role
                    })
                }
            });
    
            return otherUsers;
        }
    
        // Rate Limiter
        async function rateLimit() {
            const now = new Date().getTime()
    
            // If first request
            if (socket.requestInfo.requests == 0) {   
                socket.requestInfo.datetime = now
                socket.requestInfo.requests++;
            } // If socket datetime expired
            else if (now - socket.requestInfo.datetime > 300000) {   
                socket.requestInfo.datetime = now;
                socket.requestInfo.requests = 1
            } // If 100 requests in last 5 minutes ban ip (1h)
            else if (socket.requestInfo.requests > 99) {   
                socket.emit('socket_connection_ban')

                await SocketBanRecord.create({ ip })

                socket.disconnect(1)

                return false
            } // Else Increase request count
            else {
                socket.requestInfo.requests++;
            }

            return true
        }
    
        // Myself Initialization
        socket.emit('user-init', {
            username: socket.username,
            role: socket.role,
            profilePic: socket.profilePic,
            profileId: socket.profileId,
            otherUsers: await getOtherUsers(),
            playlist: roomObj.playlist,
            currentPlayingIndex: roomObj.currentPlayingIndex > -1 ? roomObj.currentPlayingIndex : -1,
            currentVideoTime: roomObj.currentVideoTime || 0,
            currentVideoSpeed: roomObj.currentVideoSpeed || 1,
            lastVideoPlayed: roomObj.lastVideoPlayed || false,
            lastMessages: roomObj.lastMessages || []
        })
    
        // Other User joined room
        socket.to(socket.roomId).emit('user-join', {
            username: socket.username,
            profilePic: socket.profilePic,
            profileId: socket.profileId,
            role: socket.role
        })
    
        // Chat Message
        socket.on('chat-msg', (msg) => {
            if (!rateLimit()) {
                return;
            }
    
            const chatMsg = msg.trim().replace(/\s{4,}/g, ' ');
    
            // If valid chat message
            if (chatMsg.length > 0 && chatMsg.length < 256) {
                let roomObj = io.sockets.adapter.rooms.get(socket.roomId)
    
                let msgPayload = {
                    username: socket.username,
                    profilePic: socket.profilePic,
                    role: socket.role,
                    msg
                }
    
                // Add to last messages
                if (roomObj.lastMessages) {
                    if (roomObj.lastMessages.length < 20) {
                        roomObj.lastMessages.push(msgPayload)
                    } else {
                        roomObj.lastMessages.shift()
                        roomObj.lastMessages.push(msgPayload)
                    }
                } else {
                    roomObj.lastMessages = [msgPayload]
                }
    
                // Emit message
                socket.emit("chat-msg-self", msgPayload)
        
                socket.to(socket.roomId).emit("chat-msg", msgPayload)
            } else {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
        })
    
        // Add to Playlist
        socket.on("playlist-add", async(id) => {
            if (!rateLimit()) {
                return;
            }
    
            let roomObj = io.sockets.adapter.rooms.get(socket.roomId);
    
            // If Playlist full
            if (roomObj.playlist && roomObj.playlist.length > 19) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
    
            // Valid YT Video ID
            if (!validYTID(id)) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
    
            // Fetch video Snippet
            let videoSnippet = false;

            await axios.get(`https://www.googleapis.com/youtube/v3/videos?key=${process.env.GOOGLE_YOUTUBE_API_KEY}&part=snippet&id=${id}`)
                .then(({ data }) => {
                    if (data.items.length > 0) {
                        videoSnippet = data.items[0].snippet;
                    } else {
                        socket.emit('playlist-add-error', 'Video not found')
                    }
                })
                .catch(() => {
                    socket.emit('playlist-add-error', 'Something went wrong')
                });
    
            if (!videoSnippet) {
                return
            }

            // Fetch video Duration
            let videoDuration = false

            await axios.get(`https://www.googleapis.com/youtube/v3/videos?key=${process.env.GOOGLE_YOUTUBE_API_KEY}&part=contentDetails&id=${id}`)
                .then(({ data }) => {
                    if (data.items.length > 0) {
                        videoDuration = data.items[0].contentDetails.duration;
                    } else {
                        socket.emit('playlist-add-error', 'Video not found')
                    }
                })
                .catch(() => {
                    socket.emit('playlist-add-error', 'Something went wrong')
                });

            if (!videoDuration) {
                return
            }

            const thumbnails = videoSnippet.thumbnails

            const videoInfo = {
                addedBy: socket.username,
                ytId: id,
                thumbnail: thumbnails.maxres?.url || thumbnails.high?.url || thumbnails?.medium.url || thumbnails.standard.url,
                title: videoSnippet.title,
                duration: parseYTDuration(videoDuration)
            }

            // Push video to playlist
            roomObj.playlist.push(videoInfo)

            if (roomObj.playlist.length == 1) {
                roomObj.currentPlayingIndex = 0;
            }

            // Emit
            socket.to(socket.roomId).emit('playlist-add', videoInfo)
            socket.emit("playlist-add-success", videoInfo)
        })
    
        // Remove from playlist
        socket.on('playlist-remove', (id) => {
            if (!rateLimit()) {
                return;
            }
    
            // Check valid YT Video ID
            if (!validYTID(id)) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
    
            let roomObj = io.sockets.adapter.rooms.get(socket.roomId);
            let newPlaylist = []
            let latestVideoPlayed = false
            let isPlaying = false;
            let gotDeleted = false
    
            if (roomObj.playlist.length > 0) {
                roomObj.playlist.forEach((playlist, i) => {
                    if (playlist.ytId != id) {
                        newPlaylist.push(playlist)
                    } else {
                        if (roomObj.currentPlayingIndex == i) {
                            isPlaying = true;
                        }
    
                        gotDeleted = true
    
                        latestVideoPlayed = id
                    }
                })
            } else {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
    
            // Remove video if found
            if (gotDeleted) {
                roomObj.playlist = newPlaylist;
    
                if (roomObj.playlist.length == 0) {
                    if (isPlaying) {
                        roomObj.currentPlayingIndex = -1;
                    }
    
                    roomObj.latestVideoPlayed = latestVideoPlayed;
                } else if (roomObj.playlist.length > 0) {                
                    if (isPlaying) {
                        roomObj.currentPlayingIndex = 0;
                    }
                }
    
                io.in(socket.roomId).emit('playlist-remove', id)
            } else {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
        })
    
        // Change Playing Video
        socket.on('playlist-change-playing', (i) => {
            if (!rateLimit()) {
                return;
            }
    
            const index = Number(i)
            
            if (!isNaN(index)) {
                let roomObj = io.sockets.adapter.rooms.get(socket.roomId);
    
                if (index > roomObj.playlist.length - 1 || (roomObj.playlist.length > 0 && index < 0)) {
                    // Not valid
                    socket.emit("socket_invalid_input")
    
                    return socket.disconnect(1)
                } else {
                    // Change playing Index
                    if (roomObj.currentPlayingIndex != index) {
                        roomObj.currentPlayingIndex = index
        
                        io.in(socket.roomId).emit('playlist-change-playing', index)
                    }
                }
            } else {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
        })

        // Video Play
        socket.on('video-play', (time) => {
            if (!rateLimit()) {
                return;
            }

            const playedAt = Number(Number(time).toFixed(4))

            if (isNaN(playedAt) || playedAt < 0) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            } 

            let roomObj = io.sockets.adapter.rooms.get(socket.roomId);

            // Check if playedAt is not greater than video duration
            if (roomObj.playlist.length > 0) {
                if (playedAt > roomObj.playlist[roomObj.currentPlayingIndex].duration) {
                    socket.emit("socket_invalid_input")
    
                    return socket.disconnect(1)
                }
            } else {
                // Default video duration at room join
                if (playedAt > 184) {
                    socket.emit("socket_invalid_input")
    
                    return socket.disconnect(1)
                }
            }

            roomObj.currentVideoTime = playedAt

            socket.to(socket.roomId).emit('video-play', playedAt)
        })

        // Video Pause
        socket.on('video-pause', (time) => {
            if (!rateLimit()) {
                return;
            }

            const pausedAt = Number(Number(time).toFixed(4))

            if (isNaN(pausedAt) || pausedAt < 0) {
                socket.emit("socket_invalid_input")

                return socket.disconnect(1)
            } 

            let roomObj = io.sockets.adapter.rooms.get(socket.roomId);
            
            // Check if pausedAt is not greater than video duration
            if (roomObj.playlist.length > 0) {
                if (pausedAt > roomObj.playlist[roomObj.currentPlayingIndex].duration) {
                    socket.emit("socket_invalid_input")

                    return socket.disconnect(1)
                }
            } else {
                // Default video duration at room join
                if (pausedAt > 184) {
                    socket.emit("socket_invalid_input")

                    return socket.disconnect(1)
                }
            }

            roomObj.currentVideoTime = pausedAt

            socket.to(socket.roomId).emit('video-pause', pausedAt)
        })

        // Video Speed Change
        socket.on('video-ratechange', (speed) => {
            if (!rateLimit()) {
                return;
            }

            // If speed is invalid
            if (isNaN(speed) || !videoRates.has(speed)) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            } 

            let roomObj = io.sockets.adapter.rooms.get(socket.roomId);

            roomObj.currentVideoSpeed = speed

            socket.to(socket.roomId).emit('video-ratechange', speed)
        })

        // Kick User
        socket.on('user-kick', async(profileId) => {
            if (!rateLimit()) {
                return;
            }
            
            // Permission
            if (socket.role != 'owner') {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1) 
            }
    
            // Myself
            if (profileId == socket.profileId) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1) 
            }

            let userKicked = false
            const connectedSockets = await io.in(socket.roomId).fetchSockets()

            for (let i = 0; i < connectedSockets.length; i++) {
                if (connectedSockets[i].profileId == profileId) {
                    socket.broadcast.to(connectedSockets[i].id).emit('user-kick');

                    connectedSockets[i].disconnect(1)
                    
                    userKicked = true

                    break;
                }
            }
    
            if (!userKicked) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
        })

        // Ban User
        socket.on('user-ban', async(profileId) => {
            if (!rateLimit()) {
                return;
            }

            // Permission
            if (socket.role != 'owner') {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1) 
            }

            // Myself
            if (profileId == socket.profileId) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1) 
            }

            let userBanned = false
            let roomObj = io.sockets.adapter.rooms.get(socket.roomId);
            const connectedSockets = await io.in(socket.roomId).fetchSockets()

            for (let i = 0; i < connectedSockets.length; i++) {
                if (connectedSockets[i].profileId == profileId) {
                    socket.broadcast.to(connectedSockets[i].id).emit('user-ban');
                    
                    roomObj.bannedUsers.add(connectedSockets[i].handshake.address)
                    
                    connectedSockets[i].disconnect(1)
                    
                    userBanned = true

                    break;
                }
            }

            if (!userBanned) {
                socket.emit("socket_invalid_input")
    
                return socket.disconnect(1)
            }
        })
    
        // Disconnected
        socket.on('disconnect', async () => {
            io.in(socket.roomId).emit('user-disconnect', socket.profileId);
    
            const isOwner = socket.role == 'owner'

            // If new Owner needed
            if (isOwner) {   
                let roomObj = io.sockets.adapter.rooms.get(socket.roomId)

                if (roomObj && roomObj.size > 0) {
                    const connectedSockets = await io.in(socket.roomId).fetchSockets()

                    const newOwner = connectedSockets[0]

                    newOwner.role = "owner"

                    io.in(socket.roomId).emit('user-role-change', newOwner.profileId)
                }
            }

            ipDuplicates[ip] = false
        })
    })
}
