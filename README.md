





server
---server.js




server.js 

  1. create server in websocket - (wss)

  2."connection" --> establishing connection between peer and server

  3."message" --> triggers when peer send message to server

  4."join" --> peer send message to server to join room

  5."offer | answer | candidate" --> peer send those to server and server send message to all peer except this peer

  6."close" --> server checks disconnected peer and remove it by storing existing peer in new array | if array is 
     empty server close the connection