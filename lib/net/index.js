
var Worker = require("./worker")
var Stream = require("./stream")

module.exports = {
  Server:Worker.Server,
  createServer:Worker.createServer,
  Socket:Stream.Socket
}
