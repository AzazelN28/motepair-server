// Generated by CoffeeScript 1.10.0
(function() {
  var Duplex, MOTEPAIR_CERT, MOTEPAIR_KEY, MessageHandler, Tracker, app, backend, certificate, connections, connectionsDuration, credentials, express, fs, getenv, httpServ, ip, livedb, livedbMongo, port, privateKey, server, share, sharejs, ws, wss;

  if (process.env.NEW_RELIC_LICENSE_KEY != null) {
    require('newrelic');
  }

  MessageHandler = require('./message_handler');

  Tracker = require('./tracker');

  Duplex = require('stream').Duplex;

  livedb = require('livedb');

  livedbMongo = require('livedb-mongo');

  sharejs = require('share');

  express = require('express');

  getenv = require('getenv');

  ws = require('ws');

  fs = require('fs');

  port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000;

  ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';

  app = express();

  app.use(express["static"](__dirname + '/../public'));

  MOTEPAIR_KEY = getenv('MOTEPAIR_KEY', '');

  MOTEPAIR_CERT = getenv('MOTEPAIR_CERT', '');

  if (MOTEPAIR_KEY !== '' && MOTEPAIR_CERT !== '') {
    httpServ = require('https');
    privateKey = fs.readFileSync(MOTEPAIR_KEY, 'utf8');
    certificate = fs.readFileSync(MOTEPAIR_CERT, 'utf8');
    credentials = {
      key: privateKey,
      cert: certificate
    };
    server = httpServ.createServer(credentials, app);
    console.log("Listening on https://localhost:" + port + "/");
  } else {
    httpServ = require('http');
    server = httpServ.createServer(app);
    console.log("Listening on http://localhost:" + port + "/");
  }

  server.listen(port, ip);

  wss = new ws.Server({
    server: server
  });

  backend = livedb.client(livedb.memory());

  share = sharejs.server.createClient({
    backend: backend
  });

  connections = [];

  connectionsDuration = [];

  wss.on('connection', function(client) {
    var handler, stream, tracker;
    tracker = new Tracker;
    stream = new Duplex({
      objectMode: true
    });
    stream._write = function(chunk, encoding, callback) {
      console.log('s->c ', JSON.stringify(chunk));
      if (client.state !== 'closed') {
        client.send(JSON.stringify(chunk));
      }
      return callback();
    };
    stream._read = function() {};
    stream.headers = client.upgradeReq.headers;
    stream.remoteAddress = client.upgradeReq.connection.remoteAddress;
    handler = new MessageHandler(client);
    client.sessionStarted = new Date();
    client.on('message', function(data) {
      if (data === 'ping') {
        return;
      }
      data = JSON.parse(data);
      console.log('c->s ', JSON.stringify(data));
      if (data.a === 'meta' && data.type !== 'init') {
        return handler.handle(data, connections[client.sessionId]);
      } else if (data.a === 'meta' && data.type === 'init') {
        return client.createSession(data);
      } else {
        return stream.push(data);
      }
    });
    stream.on('error', function(msg) {
      return client.stop();
    });
    client.on('close', function(reason) {
      var conn;
      console.log('client went away', connections.length);
      stream.push(null);
      stream.emit('close');
      tracker.connectionClosed(client, stream.remoteAddress);
      return connections[client.sessionId] = (function() {
        var i, len, ref, results;
        ref = connections[client.sessionId];
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          conn = ref[i];
          if (conn.getId() !== client.getId()) {
            results.push(conn);
          }
        }
        return results;
      })();
    });
    stream.on('end', function() {
      return client.close();
    });
    return share.listen(stream);
  });

  ws.prototype.createSession = function(data) {
    if (connections[data.sessionId] === void 0) {
      connections[data.sessionId] = [];
    }
    connections[data.sessionId].push(this);
    this.sessionId = data.sessionId;
    this.atomVersion = data.atomVersion;
    return this.motepairVersion = data.motepairVersion;
  };

  ws.prototype.getId = function() {
    return this.upgradeReq.headers["sec-websocket-key"];
  };

}).call(this);
