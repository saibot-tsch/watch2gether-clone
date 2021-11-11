const errorEl = document.getElementById('error')
const errorText = document.getElementById('error__text')

if (sessionStorage.getItem('socket_disconnect_error')) {
    showError('socket_disconnect_error', "Disconnected from room. Please try again or contact me!");
} else if (sessionStorage.getItem('socket_reconnect_error')) {
    showError('socket_reconnect_error', "Something went wrong while reconnecting to room. Please try again or contact me!");
}  else if (sessionStorage.getItem('socket_connection_limit')) {
    showError('socket_connection_limit', "You can only be connected to one room at a time.");
}  else if (sessionStorage.getItem('socket_user_limit')) {
    showError('socket_user_limit', "Disconnected from room due to maximum user limit.");
}  else if (sessionStorage.getItem('socket_connection_ban')) {
    showError('socket_connection_ban', "Slow down. Banned due too many requests. Try again in one hour!");
}  else if (sessionStorage.getItem('socket_invalid_input')) {
    showError('socket_invalid_input', "Something went wrong. Try again or contact me!");
} else if (sessionStorage.getItem('browser_not_supported')) {
    showError('browser_not_supported', "Your browser does not support our video player. Please update your browser!");
} else if (sessionStorage.getItem('socket_user_kick')) {
    showError('socket_user_kick', "You have been kicked from the room.");
} else if (sessionStorage.getItem('socket_user_ban')) {
    showError('socket_user_ban', "You have been banned from the room.");
}

function showError(item, errorText) {
    sessionStorage.removeItem(item);
    errorEl.classList.remove('d-none');
    errorText.innerText = errorText;
}
