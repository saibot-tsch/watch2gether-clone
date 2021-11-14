<!-- PROJECT LOGO -->
<br />
<p align="center">
  <h3 align="center">Watch2Gether Clone</h3>

  <p align="center">
    Watch Youtube Videos synchronized with friends.
    <br />
    <br />
    <a href="https://watch2gether-clone.herokuapp.com"><strong>View Demo »</strong></a>
    <br />
    <a href="https://github.com/saibot-tsch/watch2gether-clone/issues">Report Bug</a>
    ·
    <a href="https://github.com/saibot-tsch/watch2gether-clone/issues">Request Feature</a>
  </p>
</p>

<br>

<!-- ABOUT THE PROJECT -->
## About The Project
I made this project because there are no good Watch2Gether / Youtube Video Synchronize Website Clones out there with that many features. Also I wanted to challenge  myself and test my Node.js and Socket.io skills. Worth mentioning I'm not a expert in Web Development, so I would love to get feedback from you.


Why you should use my Watch2Gether Clone:
* Reponsive, SEO friendly and easy to understand UI
* Secure (If you should find any bug please report it)
* Many Features like:
  - Chat
  - Playlist (Add, Remove, Change Playing Video)
  - Role based (Owner, Guest)
  - Owner can kick or ban users
  - Beautiful Video Player
  - Rate Limiting on every page (Socket can only be connected in one room)

### Built With
List of major frameworks I used within this project:
* [Node.js](https://nodejs.org)
* [Express](https://expressjs.com)
* [Socket.io](https://socket.io)
* [Mongoose](https://mongoosejs.com/)
* [Bootstrap](https://getbootstrap.com)


<!-- GETTING STARTED -->
## Getting Started
To get a local copy up and running follow these simple steps.

### Prerequisites
* Node.js installed (<a href="https://nodejs.org/en/download">Download here</a>)
* MongoDB installed & started (<a href="https://www.mongodb.com/try/download/community">Download here</a>)

### Installation
1. Get a free Google API Key [here](https://developers.google.com/youtube/v3/getting-started) and activate the Youtube Data API v3
2. Clone the repo
   ```sh
   git clone https://github.com/saibot-tsch/watch2gether-clone.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Enter your API Key, MongoDB and Server Configuration in `.env`


<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.


<!-- CONTACT -->
## Contact

Tobias Scharl - ScharlT.coding@gmail.com


<!-- ACKNOWLEDGEMENTS -->
## Acknowledgements
* [Nodemon](https://www.npmjs.com/package/nodemon)
* [Helmet](https://www.npmjs.com/package/helmet)
* [UUID](https://www.npmjs.com/package/uuid)
* [Heroku](https://heroku.com)

Also thanks to <a href="https://stackoverflow.com">Stackoverflow</a> ;)
