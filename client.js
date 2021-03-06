/*
    Vending machine physical controller */ 
var Gpio = require('onoff').Gpio; 

var WebSocket = require('ws');
var t_ = require('./jTime.js');

var PING_TIME = 20000; 
var DELAY_TIME = 1.5; 
var MAX_RETRIES = 10;

var LED_PIN = 26; 
var BEAN_PIN = 16; 

// pi only 
if (process.env.TEST) {
  var wsurl = 'ws://127.0.0.1:8080'
}
else {
  var wsurl = 'wss://beans4bits.com';
}

var connection; 
openSocket(0);

// Dispense goods
function dispense (qty, pin) {
  startMotor (LED_PIN, qty);
  startMotor (pin, qty);
}

function startMotor (p, time) {
  var pin = new Gpio(p, 'out')
  pin.writeSync(1);
  console.log("writing to " + p.toString() + " for " + time);
  setTimeout(function() { stopMotor(pin); }, time);  
}
function stopMotor(p) {
  p.writeSync(0);
  p.unexport();
}

function isConnected() {
  connection.send('ping!');
  if (connection.readyState != 1) {
    console.log('Disconnected. Reconnecting...');
    openSocket(0);
  }
}

t_.setInterval(600000, isConnected)

function openSocket(reconnectAttempts){
  if (reconnectAttempts > MAX_RETRIES) {
    console.log('Max retries reached');
    return
  }
  connection = new WebSocket(wsurl);

  var localConn = connection;

  var timeout = setTimeout(function() {
                  console.log('ReconnectingWebSocket timed out');
                  localConn.close();
                  openSocket(reconnectAttempts++);
                }, PING_TIME*10);

  connection.on('open', function() {

    clearTimeout(timeout);
    console.log('Connected');
    connection.send('Hello from client');
  });

  connection.on('message', function(data, flags) {
    console.log(data);
    
    try {
      var obj = JSON.parse(data);
      var amount = parseInt(obj.amount);
      if (obj.item == "beans") var item = BEAN_PIN;
      else return;
    }
    catch (e) {
      var amount = 1; 
      var item = LED_PIN;
    }
          
    // not on the pi
    if (process.env.TEST) return;

    amount = amount*100;
    dispense(amount, item);
  });

  connection.on('ping', function () {
  });

  connection.on('error', function (error) {
    clearTimeout(timeout);
    var longTime = PING_TIME * Math.pow(DELAY_TIME, reconnectAttempts);
    setTimeout (openSocket(reconnectAttempts++), longTime);
  });

  connection.on('close', function () {
    console.log('closed, reconnecting');
    setTimeout (openSocket(0), PING_TIME);
  });
}
