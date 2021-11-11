// Room
const DOMAIN = document.getElementById('DOMAIN').innerText
const ROOM_ID = document.getElementById('ROOM_ID').innerText

// Credits
const removeCreditBtn = document.getElementById('credits__close')

// Add Video
const ytLinkInp = document.getElementById('search__input')
const ytSearchBtn = document.getElementById('search__button')
const ytSearchForm = document.getElementById('search__form')
const ytSearchVideoLimit = document.getElementById('search__limit')

let canAddYTLink = true;

ytSearchBtn.disabled = true;

// Room Link
const roomLinkInp = document.getElementById('link__input')
const copyRoomLinkBtn = document.getElementById('link__copy')
const copyRoomLinkUserLimit = document.getElementById('link__limit')

let canCopyRoomLink = true;

roomLinkInp.value = DOMAIN + "/room/" + ROOM_ID;

// Users
const usersContainer = document.getElementById('main__users')

let userLength = 0;
let myRole = 'guest'
let myId = '';

// Chat
const chatForm = document.getElementById('chat__form')
const chatInp = document.getElementById('chat__input')
const chatContainer = document.getElementById('chat__container')
const chatSubmitBtn = document.getElementById('chat__button')
const chatEmptyMsg = document.getElementById('chat__empty-msg')

let canWriteMsg = true;

chatSubmitBtn.disabled = true;

// Playlist
const playlistContainer = document.getElementById('playlist__container')
const playlistEmptyMsg = document.getElementById('playlist__empty-message')

const playlist = []
let currentPlayingIndex = 0;

// Video Player
const supported = Plyr.supported('video', 'youtube', true);

if (!supported.api) {
    sessionStorage.setItem('browser_not_supported', true)

    window.location = DOMAIN
}

const userFromEurope = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/')[0] == "Europe"

const player = new Plyr('#player', {
    controls: [
        'play-large',
        'play', 
        'progress', 
        'current-time', 
        'mute',
        'volume',
        'captions', 
        'settings',
        'pip', 
        'airplay',
        'fullscreen', 
    ],
    tooltips: {
        controls: true,
        seek: true
    },
    keyboard: { 
        focused: true, 
        global: true 
    },
    storage: {
        enabled: false
    }, 
    youtube: {
        noCookie: userFromEurope
    }
});

let playerActionByMyself = true
let seekAllowed = true
let rateChangeAllowed = true

// Socket.io
const socket = io()

// Server & Socket Events
socket.on("socket_connection_limit", () => {
    addDisconnectMsg('socket_connection_limit');
})

socket.on("socket_user_limit", () => {
    addDisconnectMsg('socket_user_limit');
})

socket.on('socket_connection_ban', () => {
    addDisconnectMsg('socket_connection_ban');
})

socket.on("socket_invalid_input", () => {
    addDisconnectMsg('socket_invalid_input');
})

socket.on('disconnect', () => {
    addDisconnectMsg('socket_disconnect_error');
})

socket.io.on("reconnect_error", () => {
    addDisconnectMsg('socket_reconnect_error');
});

function addDisconnectMsg(msg) { 
    sessionStorage.setItem(msg, true)

    window.location = DOMAIN
}

// Myself Initialization
socket.on('user-init', (data) => {
    myRole = data.role;
    myId = data.profileId
    userLength++;

    appendUser(data.profilePic, data.username, data.profileId, true, data.role)

    // Other users
    if (data.otherUsers.length > 0) {
        data.otherUsers.forEach(user => {
            appendUser(user.profilePic, user.username, user.profileId, false, user.role)
            userLength++;
        })
    }

    checkRoomLinkAvailability()

    // Existing playlist
    if (data.playlist.length > 0) {
        data.playlist.forEach(video => {
            addVideoToPlaylist(video.ytId, video.thumbnail, video.title, video.addedBy, false)
        })
    }

    checkAddVideoAvailability()

    // Last Video Played if playlist empty
    if (data.lastVideoPlayed) {
        player.on("ready", () => {
            player.source = {
                type: 'video',
                sources: [
                    {
                        src: data.lastVideoPlayed,
                        provider: 'youtube',
                    }
                ],
            };

            player.currentTime = data.currentVideoTime
            player.speed = data.currentVideoSpeed
        })
    } else if (data.currentPlayingIndex > -1) {
        // If playlist not empty
        currentPlayingIndex = data.currentPlayingIndex

        const playingVideo = playlist[currentPlayingIndex]

        player.on("ready", () => {
            player.source = {
                type: 'video',
                sources: [
                    {
                        src: playingVideo.id,
                        provider: 'youtube',
                    }
                ],
            };

            player.currentTime = data.currentVideoTime
            player.speed = data.currentVideoSpeed
        })
    } else {
        // If playlist empty
        currentPlayingIndex = -1

        player.on("ready", () => {
            player.currentTime = data.currentVideoTime
            player.speed = data.currentVideoSpeed
        })
    }

    // Display last 20 messages if there are messages
    if (data.lastMessages.length > 0) {
        data.lastMessages.forEach((msgInfo) => {
            const { profilePic, msg, username, role } = msgInfo;
            
            appendChatMsg(profilePic, msg, username, false, role)
        })
    }
})

// Other User joined room
socket.on('user-join', (user) => {
    userLength++;
    checkRoomLinkAvailability()

    appendUser(user.profilePic, user.username, user.profileId, false, user.role)

    player.pause()
})

// Other User Message
socket.on('chat-msg', (data) => {
    appendChatMsg(data.profilePic, data.msg, data.username, false, data.role)
})

// My Message
socket.on('chat-msg-self', (data) => {
    appendChatMsg(data.profilePic, data.msg, data.username, true, data.role)
})

// Other User Playlist Add
socket.on('playlist-add', (video) => {
    addVideoToPlaylist(video.ytId, video.thumbnail, video.title, video.addedBy, false)
    checkAddVideoAvailability()
})

// My Playlist Add
socket.on('playlist-add-success', (video) => {
    addVideoToPlaylist(video.ytId, video.thumbnail, video.title, video.addedBy, true)
    checkAddVideoAvailability()
    changeSearchBtnStatus("Added!", 'success')
})

// My Playlist Add Error
socket.on('playlist-add-error', (err) => {
    changeSearchBtnStatus(err, 'danger')
})

// Any User Playlist remove
socket.on('playlist-remove', (id) => {
    removeVideo(id)
    checkAddVideoAvailability()
})

// Any User Change Playing Video
socket.on('playlist-change-playing', (index) => {
    changePlayingIndexFunction(index)
})

// Other User Play Video 
socket.on('video-play', (time) => {
    playerActionByMyself = false
    seekAllowed = false

    player.currentTime = time
    
    player.play()
})

// Other User Pause Video 
socket.on('video-pause', (time) => {
    playerActionByMyself = false
    seekAllowed = false

    player.currentTime = time
    
    player.pause()
})

// Other User Change Video Speed
socket.on('video-ratechange', (speed) => {
    rateChangeAllowed = false

    player.speed = speed
})

// Myself kick
socket.on('user-kick', () => {
    sessionStorage.setItem('socket_user_kick', true)

    window.location = DOMAIN
})

// Myself ban
socket.on('user-ban', () => {
    sessionStorage.setItem('socket_user_ban', true)

    window.location = DOMAIN
})

// Any User role change
socket.on('user-role-change', (profileId) => {
    document.getElementById(`user-${profileId}`).insertAdjacentHTML('beforeend', '<i class="bi bi-star-fill user__mid" title="Owner"></i>')

    const newOwnerEl = document.querySelector(`#user-${profileId} figcaption`)

    if (profileId == myId) {
        myRole = "owner"

        // Myself
        newOwnerEl.textContent = newOwnerEl.textContent.replace('(Guest)', '(Owner)')
    
        // Other Users
        document.querySelectorAll('.main__user').forEach((el) => {
            var userId = el.id.split('user-')[1]

            if (userId != myId) {
                el.insertAdjacentHTML('beforeend', `<i class="bi bi-person-x user__left" title="Ban User" onClick="punishUser('${userId}', 'ban')"></i>`)
                el.insertAdjacentHTML('beforeend', `<i class="bi bi-box-arrow-right user__right" title="Kick User" onClick="punishUser('${userId}', 'kick')"></i>`)
            }
        })
    } else {
        // other user
        newOwnerEl.textContent = newOwnerEl.textContent.replace('Guest-', 'Owner-')
    }
})

// Other User Disconnect
socket.on('user-disconnect', (profileId) => {
    userLength--;
    checkRoomLinkAvailability()
    removeUser(profileId)
})

// Remove Credit
removeCreditBtn.addEventListener('click', () => {
    setTimeout(() => {
        removeCreditBtn.parentElement.hidden = true;
    }, 950)

    removeCreditBtn.parentElement.classList.add('credits__close-animation')
})

// Helper Function
function escapeHTML (str) {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };

    return String(str).replace(/[&<>]/g, (tag) => {
        return tagsToReplace[tag] || tag;
    });
};

function uppercaseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

// Add Video
function getVideoIDFromYTURL(url) {
    // Extract Video ID if match
    var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);

    if (match && match[2].length == 11) {
        return match[2];
    } else {
        return false
    }
}

function checkAddVideoAvailability() {
    if (playlist.length <= 20) {
        // Available
        ytSearchBtn.hidden = false;
        ytLinkInp.hidden = false;
        ytSearchVideoLimit.style.display = 'none'
    } else {
        // Not Available
        ytSearchBtn.hidden = true;
        ytLinkInp.hidden = true;
        ytSearchVideoLimit.style.display = 'block'
    }
}

function changeSearchBtnStatus(newStatus, newColor) {
    // Display New Status
    ytSearchBtn.innerText = newStatus
    ytSearchBtn.classList.replace("btn-primary", `btn-${newColor}`);
    ytLinkInp.readOnly = true;
    canAddYTLink = false;

    // Display Default Status
    setTimeout(() => {
        ytSearchBtn.innerText = "Add"
        ytSearchBtn.classList.replace(`btn-${newColor}`, "btn-primary");
        ytLinkInp.readOnly = false;
        canAddYTLink = true;
    }, 3000)
}

ytLinkInp.addEventListener('keyup', () => {
    const ytLink = ytLinkInp.value.trim();

    if (ytLink.length > 0 && canAddYTLink) {
        ytSearchBtn.disabled = false;
    } else {
        ytSearchBtn.disabled = true;
    }
})

ytSearchForm.addEventListener('submit', async(e) => {
    e.preventDefault();

    const ytLink = ytLinkInp.value.trim();

    if (ytLink.length > 0 && canAddYTLink) {
        // Reset Inputs
        ytLinkInp.value = "";
        ytSearchBtn.disabled = true;

        // Check playlist limit
        if (playlist.length > 20) {
            return changeSearchBtnStatus("Playlist limit reached", 'danger')
        }

        const ytID = getVideoIDFromYTURL(ytLink)

        if (ytID === false) {
            return changeSearchBtnStatus("Video not found!", 'danger')
        } 
        
        // Check if video is already in playlist
        if (checkPlaylistDuplicate(ytID) == true) {
            return changeSearchBtnStatus("Video already in playlist!", 'danger')
        }

        socket.emit('playlist-add', ytID)
    }
})

// Room Link
function checkRoomLinkAvailability() {
    if (userLength < 10) {
        // Available
        copyRoomLinkUserLimit.style.display = 'none'
        roomLinkInp.hidden = false
        copyRoomLinkBtn.hidden = false
    } else {
        // Not Available
        copyRoomLinkUserLimit.style.display = 'block'
        roomLinkInp.hidden = true
        copyRoomLinkBtn.hidden = true
    }
}

function changeCopyRoomLinkStatus(newStatus, newColor) {
    // Display New Status
    copyRoomLinkBtn.innerText = newStatus
    copyRoomLinkBtn.classList.replace('btn-primary', `btn-${newColor}`);
    canCopyRoomLink = false;

    // Display Default Status
    setTimeout(() => {
        copyRoomLinkBtn.innerText = "Copy"
        copyRoomLinkBtn.classList.replace(`btn-${newColor}`, 'btn-primary');
        canCopyRoomLink = true;
    }, 3000)
}

function copyRoomLink() {
    // Browser supports clipboard
    if (!navigator.clipboard) {
        try {
            // Select Element
            roomLinkInp.focus();
            roomLinkInp.select();
    
            // Execute copy command
            document.execCommand('copy');
    
            changeCopyRoomLinkStatus("Copied!", "success")
        } catch (err) {
            console.log("Failed copying room link: ", err);
    
            changeCopyRoomLinkStatus("Error!", "danger")
        }

        return;
    }

    // Supports clipboard
    navigator.clipboard.writeText(roomLinkInp.value).then(() => {
        changeCopyRoomLinkStatus("Copied!", "success")
    }, (err) => {
        console.log("Failed copying room link: ", err);
    
        changeCopyRoomLinkStatus("Error!", "danger")
    });
}

copyRoomLinkBtn.addEventListener("click", () => {
    if (canCopyRoomLink) {
        copyRoomLink()
    }
})

// Chat
function appendChatMsg(profilePic, msg, username, myself, role) {
    const msgHTML = `
        <article class="msg-container ${myself ? "msg-self" : "msg-remote"} id="msg-0">
            <div class="msg-box">
                ${!myself ? `<img class="user-img" src="/assets/room/profile-${profilePic}.png" alt="" />` : ''}
                <div class="flr">
                    <div class="messages">
                        <p class="msg">
                            ${escapeHTML(msg)}
                        </p>
                    </div>
                    <span class="info">
                        <span class="username">
                            ${myself ? '<u>You</u>' : `${uppercaseFirstLetter(role)}-${username}`}
                        </span>
                    </span>
                </div>
                ${myself ? `<img class="user-img" src="/assets/room/profile-${profilePic}.png" alt="" />` : ''}
            </div>
        </article>
    `.trim();

    if (!chatEmptyMsg.hidden) {
        chatEmptyMsg.hidden = true;
    }

    chatContainer.insertAdjacentHTML('beforeend', msgHTML);

    // Scroll to bottom if chat container overflows
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatInp.addEventListener('keyup', () => {
    const chatMsg = chatInp.value.trim().replace(/\s{4,}/g, ' ');

    if (chatMsg.length > 0 && chatMsg.length < 256) {
        chatSubmitBtn.disabled = false;
    } else {
        chatSubmitBtn.disabled = true;
    }
})

chatForm.addEventListener('submit', (e) => {
    e.preventDefault()

    if (canWriteMsg) {
        const chatMsg = chatInp.value.trim().replace(/\s{4,}/g, ' ');
        
        if (chatMsg.length > 0 && chatMsg.length < 256) {
            socket.emit("chat-msg", chatMsg)
        }
        
        // Reset Inputs
        chatInp.value = ""
        chatSubmitBtn.disabled = true
    }
})

// Users
function punishUser(id, type) {
    if (myRole == "owner") {
        socket.emit(`user-${type}`, id)
    }
}

function appendUser(profilePic, username, id, myself, userRole) {
    const userHTML = `
        <figure class="main__user" id=${`user-${id}`}>
            <img src="/assets/room/profile-${profilePic}.png" alt="" />
            <figcaption class="text-white">
                ${myself ? 
                    `<strong>You</strong> (${uppercaseFirstLetter(userRole)})` : 
                    `${uppercaseFirstLetter(userRole)}-${username}`
                }
            </figcaption>
            ${!myself && myRole == "owner" ? `<i class="bi bi-person-x user__left" title="Ban User" onClick="punishUser('${id}', 'ban')"></i>` : ''}
            ${userRole == "owner" ? `<i class="bi bi-star-fill user__mid" title="Owner"></i>` : ''}
            ${!myself && myRole == "owner" ? `<i class="bi bi-box-arrow-right user__right" title="Kick User" onClick="punishUser('${id}', 'kick')"></i>` : ''}
        </figure>
    `.trim();

    usersContainer.insertAdjacentHTML('beforeend', userHTML);
}

function removeUser(id) {
    document.getElementById(`user-${id}`).remove();
}

// Playlist
function checkPlaylistDuplicate(id) {
    let isDuplicate = false;

    playlist.map((video) => {
        if (JSON.stringify(video.id) == JSON.stringify(id)) {
            isDuplicate = true
        }
    })

    return isDuplicate;
}

function updateVideoSrc() {
    const playingVideo = playlist[currentPlayingIndex]

    player.source = {
        type: 'video',
        sources: [
            {
                src: playingVideo.id,
                provider: 'youtube',
            }
        ],
    };
}

function changePlayingIndex(id) {
    for (let i = 0; i < playlist.length; i++) {
        if (playlist[i].id === id) {
            if (currentPlayingIndex != i) {
                socket.emit('playlist-change-playing', i)
                break;
            }
        }
    }
}

function addVideoToPlaylist(id, thumbnail, title, addedBy, myself) {
    playlist.push({
        id,
        thumbnail,
        title,
        addedBy
    });
    
    if (playlistEmptyMsg.hidden == false) {
        playlistEmptyMsg.hidden = true;
    }

    if (playlist.length == 1) {
        currentPlayingIndex = 0;
        updateVideoSrc()
    }

    const videoHTML = `
        <li class="playlist__item" id="playlist_video-${id}">
            <div class="playlist__item-left">
                <i class="bi bi-trash" onclick=removeVideoFromPlaylist("${id}") title="Remove from playlist" aria-label="Click here to remove this video from playlist"></i>
            </div>
            <div class="playlist__item-right ${playlist.length == 1 ? 'playlist__playing' : ''}" onclick=changePlayingIndex("${id}") title="Click to change playing video" aria-label="Click here to change playing video">
                <div class="post-thumb">
                    <img src="${thumbnail}" alt="">
                </div>
                <div class="post-content">
                    <h3 class="text-truncate" title="${title}" aria-label="${title}">${title}</h3>
                    <p class="text-truncate" aria-label="Video Added by">Added by: ${myself ? "<u>You</u>" : `User-${addedBy}`}</p>
                </div>
            </div>
        </li>
    `.trim();

    playlistContainer.insertAdjacentHTML('beforeend', videoHTML);
}

function removeVideoFromPlaylist(id) {
    socket.emit('playlist-remove', id)
}

function removeVideo(id) {
    let isPlaying = false;

    playlist.map((video, i) => {
        // If found splice it out from playlist
        if (JSON.stringify(video.id) === JSON.stringify(id)) {
            if (i == currentPlayingIndex) {
                isPlaying = true;
            }

            playlist.splice(i, 1)
        }
    })

    document.getElementById("playlist_video-" + id).remove();

    if (playlist.length == 0) {
        if (isPlaying) {
            currentPlayingIndex = -1;
        }

        playlistEmptyMsg.hidden = false
    } else if (playlist.length > 0) {
        // If not empty and isPlaying is removed, change playing video to the first video in playlist
        
        if (isPlaying) {
            currentPlayingIndex = 0;
            updateVideoSrc()
        }

        playlistContainer.children[1].children[1].classList.add('playlist__playing')
    }
}

function changePlayingIndexFunction(i) {
    const index = Number(i)
        
    if (!isNaN(index)) {
        if (index > playlist.length - 1 || (playlist.length > 0 && index < 0)) {
            return;
        } else {
            playlistContainer.children[currentPlayingIndex + 1].children[1].classList.remove('playlist__playing')
            playlistContainer.children[index + 1].children[1].classList.add('playlist__playing')

            currentPlayingIndex = index;
            updateVideoSrc()
        }
    }
}

// Video Events
player.on('play', () => {
    if (playerActionByMyself) {
        socket.emit('video-play', player.currentTime)
        
        player.currentTime = Number(player.currentTime.toFixed(4))

        seekAllowed = false
    } else {
        playerActionByMyself = true
    }
});

player.on('pause', () => {
    if (playerActionByMyself) {
        socket.emit('video-pause', player.currentTime)
        
        player.currentTime = Number(player.currentTime.toFixed(4))
        
        seekAllowed = false
    } else {
        playerActionByMyself = true
    }
});

player.on('seeked', () => {    
    if (seekAllowed) {
        player.pause()
    } else {
        seekAllowed = true
    }
})

player.on('ratechange', () => {
    if (rateChangeAllowed) {
        socket.emit('video-ratechange', player.speed)
    } else {
        rateChangeAllowed = true
    }
})

player.on('ended', () => {    
    if (playlist.length > 1) {
        const currentVideo = playlist[currentPlayingIndex]

        removeVideoFromPlaylist(currentVideo.id)
        checkAddVideoAvailability()
        updateVideoSrc()
    } else if (playlist.length == 1) {
        const currentVideo = playlist[currentPlayingIndex]
        removeVideoFromPlaylist(currentVideo.id)
        checkAddVideoAvailability()
    }
})
