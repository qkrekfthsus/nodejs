// 라이브러리 추가 및 메소드 사용을 위한 객체 생성
var express = require("express");
var mysql = require("mysql");
var dbconfig = require("./config/database.js");
var connection = mysql.createConnection(dbconfig);
var schedule = require("node-schedule");
var mosca = require("mosca");
var mqtt = require("mqtt");


var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);

var cmd = new Array(3);

var hour = false;
// mosca mqtt 서버 설정
var settings = {
  port: 1883,
  bundle: true,
  persistence: mosca.persistence.Memory,
  static: './public'
};
// mosca 서버 생성
var server = new mosca.Server(settings, function(){
  console.log("Mosca server is up and running");
});

server.clientConnected = function(clinet){
  console.log("client connected", client.id);
}
server.published = function(packet, client, cb) {
 
  if (packet.topic.indexOf('echo') === 0) {
    //console.log('ON PUBLISHED', packet.payload.toString(), 'on topic', packet.topic);
    return cb();
  }
  var newPacket = {
    topic: 'echo/' + packet.topic,
    payload: packet.payload,
    retain: packet.retain,
    qos: packet.qos
  };
 
  console.log('newPacket', newPacket);
 
  server.publish(newPacket, cb);
 
};

var client = mqtt.connect("mqtt://localhost");  // Client 생성

client.on('connect', function () {  // MQTT 서버에 연결되었을 때
  client.subscribe('Cmd');
  client.subscribe('Cmd/Blind');
  client.subscribe('Cmd/Water');
  client.subscribe('Cmd/Fan');

  schedule.scheduleJob('*/1 * * * * *', function(){ //1초마다 한 번 처리
    // DB 데이터 조회
    console.log(cmd);
    var d = new Date();
    //if (d.getSeconds() == 0){
      hour = true;
   // }
    connection.query('SELECT DATE_FORMAT(`Time`, "%H:%i") AS `Hour`,'+
    'AVG(`Temp`) AS `Temp`, AVG(`Hum`) AS `Hum`, AVG(`Soil`) AS `Soil`, AVG(Illu) AS `Illu`'
      +'FROM `sensor` WHERE `Time` > CURRENT_DATE() GROUP BY MINUTE(`Time`) ORDER BY `Time` DESC LIMIT 5', function(err, rows) {
          if(err) throw err;
          client.publish("Data/Sensor/Avg", JSON.stringify(rows)); // "DB" Topic으로 데이터 송신
        });
    // DataBase(MySQL)에서 필요한 데이터 조회
    
    connection.query('SELECT * FROM `sensor` ORDER BY `Time` DESC LIMIT 1', function(err, rows) {
      if(err) throw err;
      client.publish("Data/Sensor/Now", JSON.stringify(rows)); // "Now" Topic으로 데이터 송신
    });
    connection.query('SELECT DATE_FORMAT(`Time`, "%H시") AS `Time`, `Dis1`, `Dis2`, `Dis3`'
    +' FROM `distance` WHERE `Time` > CURRENT_DATE() ORDER BY `Time` DESC LIMIT 5', function(err, rows) {
      if(err) throw err;
      console.log(rows);
      client.publish("Data/Dis", JSON.stringify(rows)); // "Now" Topic으로 데이터 송신
    });
    
  });
});




client.on('message', function (topic, message) { // Node.js에서 수신된 데이터 처리
  
  if (topic == "Cmd/Blind"){ // "Topic"이라는 Topic을 수신하였을 때
    if (message.toString() == "ON"){
      cmd[0] = "1";
    }
    else if (message.toString() == "OFF"){
      cmd[0] = "0";
    }
  }

  else if (topic == "Cmd/Water"){
    if (message.toString() == "ON"){
      cmd[1] = "1";
    }
    else if (message.toString() == "OFF"){
      cmd[1] = "0";
    }
  }

  else if (topic == "Cmd/Fan"){
    if (message.toString() == "ON"){
      cmd[2] = "1";
    }
    else if (message.toString() == "OFF"){
      cmd[2] = "0";
    }
  }
  
  else if (topic == "Cmd"){
    cmd = message.toString().split('');
  }

});
//data test

function getTimeStamp() {
  var d = new Date();
  var s =
    leadingZeros(d.getFullYear(), 4) + '-' +
    leadingZeros(d.getMonth() + 1, 2) + '-' +
    leadingZeros(d.getDate(), 2) + ' ' +

    leadingZeros(d.getHours(), 2) + ':' +
    leadingZeros(d.getMinutes(), 2) + ':' +
    leadingZeros(d.getSeconds(), 2);

  return s;
}

function getHourStamp() {
  var d = new Date();
  var s =
    leadingZeros(d.getFullYear(), 4) + '-' +
    leadingZeros(d.getMonth() + 1, 2) + '-' +
    leadingZeros(d.getDate(), 2) + ' ' +

    leadingZeros(d.getHours(), 2) + ':' +
    leadingZeros(d.getMinutes(), 2) + ':00';
    //':00:00'

  return s;
}

function leadingZeros(n, digits) {
  var zero = '';
  n = n.toString();

  if (n.length < digits) {
    for (i = 0; i < digits - n.length; i++)
      zero += '0';
  }
  return zero + n;
}
/*
////test
schedule.scheduleJob('*//*1 * * * * *', function(){ //1초마다 한 번 처리
  // DB 데이터 조회
  connection.query('INSERT INTO `data`(`Time`, `Temp`, `Hum`, `Rough`)VALUES' 
  + '("'+ getTimeStamp() +'", '+ 30 +', '+ 50 +', '+ 60 +')', function(err, rows) {
        if(err) throw err;
        console.log('Success!');
      });
});
*/
//////////////////

app.get('/Sensor', function(req, res){
  if(hour){ // 현재 1분마다로 되어있음
    res.redirect("/Dis");
  }
  /*
  else if(cmd != ""){
    res.redirect("/cmd");
  }
  */

  console.log("Sensor");
  console.log(cmd);
  var param_t = req.param('Temp');
  var param_h = req.param('Hum');
  var param_s = req.param('Soil');
  var param_i = req.param('Illu');
  
  connection.query('INSERT INTO `sensor` VALUES' 
    + '("'+ getTimeStamp() +'", ' + param_t +', '+ param_h +', '+ param_s + ', ' + param_i +')', function(err, rows) {
          if(err) throw err;
          console.log('Sensor Success!');
        });
        
});

app.get('/Dis', function(req, res){
  console.log("Distance data");
  var param_1 = req.param('Dis1');
  var param_2 = req.param('Dis2');
  var param_3 = req.param('Dis3');
  connection.query('INSERT INTO `distance` VALUES ("'+ getHourStamp() +'", '+ param_1 +', '+ param_2 +', '
      + param_3 + ')', function(err, rows) {
          if(err) throw err;
          console.log('Dis Success!');
        });
        hour = false;
});

app.get('/Cmd', function(req, res){
  res.send("[" + cmd.toString().replace(/,/g, "") + "]");
});


// 3000번 포트로 서버 열기
http.listen(3000, function(){
   console.log("listening on * 3000");
});



