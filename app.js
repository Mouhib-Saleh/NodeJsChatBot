const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const Message = require('./models/message');
const Sentiment = require('sentiment');
const natural = require('natural');
const pos = require('pos');
require('dotenv').config();

const app = express();
app.use(cors());

const intents = {
  'weather': ['weather', 'forecast', 'temperature'],
  'news': ['news', 'headlines', 'articles'],
  'sports': ['sports', 'scores', 'games'],
  'greeting': ['hi', 'hello', 'hey'],
  'goodbye': ['bye', 'goodbye', 'see you']
};

// Connect to MongoDB
mongoose.set("strictQuery", true);
mongoose.connect(process.env.DB_CONNECTION)
  .then(() => {
    console.log('Connected to database');
  })
  .catch((error) => {
    console.error('Error connecting to database:', error.message);
  });


// Analyze des sentiment  
function getSentiment(text) {
  const sentiment = new Sentiment();
  const result = sentiment.analyze(text);
  return result.score;
}
// Intent
function getIntent(text) {
  // Tokenize the input text
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text);

  // Loop through each intent and check if any of its keywords are present in the input text
  for (const intent in intents) {
    for (const keyword of intents[intent]) {
      if (tokens.includes(keyword)) {
        return intent;
      }
    }
  }

  // If no intent is detected, return null
  return "sorry i didnt catch that part";
}
// get entity
function getEntity(text) {
  // Tokenize the text
  const words = new pos.Lexer().lex(text);
  // Tag the parts of speech
  const taggedWords = new pos.Tagger().tag(words);
  // Loop through the tagged words and look for named entities
  let entity = '';
  for (let i = 0; i < taggedWords.length; i++) {
    const word = taggedWords[i][0];
    const tag = taggedWords[i][1];
    if (tag === 'NNP' || tag === 'NNPS') {
      entity += `${word} `;
    } else if (entity !== '') {
      // We've reached the end of the named entity
      return entity.trim();
    }
  }
  // No named entity was found
  return '';
}
// Define the automated response function
function getAutoResponse(text) {
  const sentiment = getSentiment(text);
  const intent = getIntent(text);
  const entity = getEntity(text);

  if (sentiment > 0) {
    return 'That sounds great!';
  } else if (sentiment < 0) {
    return 'I am sorry to hear that.';
  }

  switch (intent) {
    case 'weather':
      return `Here is the weather forecast for ${entity}.`;
    case 'news':
      return `Here are the latest news articles about ${entity}.`;
    case 'sports':
      return `Here are the latest sports scores for ${entity}.`;
    case 'greeting':
      return 'Hello there!';
    case 'goodbye':
      return 'Goodbye!';
    default:
      return "I didn't quite catch that.";
  }
}

// Initialize socket.io
const server = require('http').createServer(app);
const io = socketio(server);

// Listen for new connections
io.on('connection', (socket) => {
  console.log('New client connected');

  // Listen for new messages
  socket.on('new-message', (data) => {
    console.log('New message:', data);
    const messageuser = new Message(data);
    messageuser.save().then(() => {
        console.log('message saved!');
      })
      .catch((error) => {
        console.error('Error saving message:', error);
      });
           console.log(getSentiment(data.message))  
           console.log(getIntent(data.message))  
           console.log("entities "+getEntity(data.message)) 

const autoResponse = getAutoResponse(data.message);
console.log(autoResponse)
 data.message = autoResponse;
 data.username ="Mastery bot"
  io.emit('new-message', data);
    // Save message to database
    const message = new Message(data);
    message.save().then(() => {
        console.log('message saved!');
      })
      .catch((error) => {
        console.error('Error saving message:', error);
      });
  });

  // Listen for disconnections
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

app.use(express.static(__dirname+'/public')); 
app.get("/",(req,res,next)=>{
    res.sendFile(__dirname + "/index.html");
});

module.exports = server;