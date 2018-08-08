var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');
var fetch = require('node-fetch');
var wasStreaming = new Array();
var homeChannel = "453304304426549279";
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    bot.setPresence({game:{name:"~help", type:"3"}});

    var intervalId = setInterval(checkStreamerAPI, 60000);
    checkStreamerAPI();
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `~`
    if (message.substring(0, 1) == '~') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
            break;
            // Just add any case commands if you want to..
            case 'add_streamer':
                logger.info((new Date()).toUTCString() + ": trying to add " + args[0]);

                fetch('https://api.twitch.tv/helix/users?login=' + args[0], {headers:{'Client-ID': 'm0rdmtnk9m9xs4al5brwgb690oscek'}})
                  .then(function(response) {
                    return response.json();
                  })
                  .then(function(json) {
                    if(json.data[0] != null) {
                      fs.readFile("streamerList.json", function(err, content) {
                        if(err) throw err;
                        var parseJson = JSON.parse(content);
                        console.log(parseJson);
                        var streamer = {'name':args[0], 'id':json.data[0].id};
                        var isDuplicate = false;
                        parseJson.data.forEach(function(element) {
                          if(element.id == streamer.id) {
                            isDuplicate = true;
                          }
                        });

                        if(!isDuplicate) {
                          parseJson.data.push(streamer);
                          logger.info(json.data[0]);
                          fs.writeFile('streamerList.json',JSON.stringify(parseJson) , function(err) {
                            if(err) throw err;
                          });
                          bot.sendMessage({
                            to: channelID,
                            message:'Added ' + args[0] + ' to my list of streamers!'
                          });
                          logger.info((new Date()).toUTCString() + ": successfuly added " + args[0]);
                        }
                        else {
                          bot.sendMessage({
                            to: channelID,
                            message:'That streamer is already on my list.'

                          })
                          logger.info((new Date()).toUTCString() + ": failed adding " + args[0]);
                        }
                      });
                    }
                    else {
                      bot.sendMessage({
                        to:channelID,
                        message:'Sorry, that is not a valid streamer. Please check spelling and try again.'
                      });
                      logger.info((new Date()).toUTCString() + ": failed adding " + args[0]);
                    }
                  })
            break;

            case 'list_streamers':
                fs.readFile("streamerList.json", function(err, content) {
                  if(err) throw err;
                  var parseJson = JSON.parse(content);
                  bot.sendMessage({
                    to:channelID,
                    message: "The streamers currently on my list are " + parseJson.data.map(streamer => streamer.name).join(", ")
                  });
                });
            break;

            case 'remove_streamer':
                fs.readFile("streamerList.json", function(err, content) {
                  if(err) throw err;
                  var parseJson = JSON.parse(content);
                  var nameList = parseJson.data.map(streamer => streamer.name)
                  index = nameList.indexOf(args[0]);
                  if(index != -1) {
                    parseJson.data.splice(index,1);
                    fs.writeFile('streamerList.json',JSON.stringify(parseJson) , function(err) {
                      if(err) throw err;
                    });
                    bot.sendMessage({
                      to:channelID,
                      message: args[0] + " has been removed from my list."
                    });
                  }
                  else {
                    bot.sendMessage({
                      to:channelID,
                      message: args[0] + " is not on my list."
                    });
                  }
                });
            break;

            case 'set_home_channel':
                homeChannel = channelID;
                bot.sendMessage({
                  to:channelID,
                  message: "Home channel has been set!"
                });
                logger.info((new Date()).toUTCString() + ": home channel changed to: " + channelID);
            break;

            case 'currently_streaming':
                fs.readFile("streamerList.json", function(err, content) {
                  if(err) throw err;
                  var parseJson = JSON.parse(content);
                  var currentlyStreaming = new Array();
                  for(var i = 0; i < wasStreaming.length; i++) {
                    for(var j = 0; j < parseJson.data.length; j++) {
                      if(parseJson.data[j].id == wasStreaming[i]) {
                        currentlyStreaming.push(parseJson.data[j].name);
                        break;
                      }
                    }
                  }
                  if(currentlyStreaming.length == 0) {
                    currentlyStreaming[0] = "None";
                  }
                  bot.sendMessage({
                    to:channelID,
                    message: "The streamers on my list who are online are " + currentlyStreaming.join(", ")
                  });
                });
            break;

            case 'help':
                fs.readFile("help.txt", function(err, content) {
                if(err) throw err;
                bot.sendMessage({
                  to: channelID,
                  message: content
                });
              });
            break;
         }
     }
});

async function checkStreamerAPI() {
  logger.info((new Date()).toUTCString() + ": starting calls" );
  var userCall = "";
  var first = true;
  fs.readFile('streamerList.json', 'utf8', async function(err, data) {
    if (err) throw err;
    var parseJson = JSON.parse(data);
    if(parseJson.data.length == 0) {
      return;
    }
      var nowStreaming = [];
    for(const streamer of parseJson.data) {
      fetch('https://api.twitch.tv/helix/streams?user_id=' + streamer.id, {headers:{'Client-ID': 'm0rdmtnk9m9xs4al5brwgb690oscek'}})
        .then(function(response) {
          return response.json();
        })
        .then(function(json) {

          //checks to see if the stream is live. If the stream is not on the list of current streamers (aka, they started recently), it sends a message out.
          if(json.data[0] != null) {
            nowStreaming.push(streamer.id);
            index = wasStreaming.indexOf(streamer.id);
            if(index == -1) {
              bot.sendMessage({
                to: homeChannel,
                message: "twitch.tv/" + streamer.name + " is now streaming! Go check them out!"
              });
            }
          }
          if(streamer.id == parseJson.data[parseJson.data.length-1].id) {
            logger.info((new Date()).toUTCString() + ": " + (parseJson.data.length) + " calls made. Currently Streaming: " + nowStreaming.join(", "));
            wasStreaming = nowStreaming;

          }
        });
      }
  });
}
