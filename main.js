const express = require('express'); // require expressJS framework
const bodyParser = require('body-parser'); // for html parsing
const path = require('path') // for serving static files lately
const compression = require('compression') // can greately decrease the size of the response body, and hence increase the sepeed of a web app
const cassandra = require('cassandra-driver');
const mongoose = require('mongoose');
const elasticsearch = require('elasticsearch');
const cookieParser = require('cookie-parser');
const unixTime = require('unix-time');
const shortId = require('shortid');
const formidable = require('formidable');
const fs = require('fs');
const backdoor ='abracadabra';
const app = express(); // Create an Application based on ExpressJS
const winston = require('winston'); //A logger for just about everything
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [ new winston.transports.Console()]
});
const sendmail = require('sendmail')({silent: true});
const port = process.env.PORT || 3000;
/*********************************Basic Configuration **********************************************/
app.use(compression()) // gzip
app.use(bodyParser.json({ extended: true})); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({  extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); // for static files, like css, images
app.set('view engine', 'ejs'); // for rendering html files in ejs format
app.set('views', './views');
app.set('trust proxy');// for getting ip for couting views for questions
/************************************************ DB ***********************************/
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://192.168.122.41:27017/firewall', { useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false }).catch(err=> {
  if (err) { return logger.error("MongoDB connection Faield", err) }
});
const client = new cassandra.Client({ contactPoints: ['192.168.122.32'], localDataCenter: 'datacenter1', keySpace: 'media' });
client.connect(function(err, result) {
    if (err) {  return logger.error("cassandra connection Faield", err) }
});
const elasticClient = new elasticsearch.Client({ host: '192.168.122.41:9200'}, function(err, conn){
  if(err){ return logger.error("elasticClient  connection Faield", err)}
});
elasticClient.ping({// Send a HEAD request to / and allow up to 1 second for it to complete.
  requestTimeout: 1000  // ping usually has a 3000ms timeout
}, function (error) {if (error) logger.error('elasticsearch cluster is down!');
});
/*********************************** DB--- Schema ************************************/
const userSchema = new mongoose.Schema({ //Create & Define a schema for 'User'
    id: { type: String, required: true, unique: true, default: shortId.generate },
    username: { type: String, required: true, unique: true}, // username must be unique
    email: { type: String, required: true, unique: true }, // email must be unique
    password: { type: String, required: true },
    reputation: { type: Number, default: 1},
    verify: { type: Boolean, default: false },
    key: { type: String, default: 'abracadabra' }
})
const User = mongoose.model('User', userSchema) // Create User module for the created schema

const answerSchema = new mongoose.Schema({ //Create & Define a schema for 'Answer'
    id: { type: String, required: true, unique: true, default: shortId.generate },
    question_id: { type: String, required: true },
    username: { type: String, required: true }, // poster's name
    body: { type: String, required: true },
    upvote: [ { type: String } ], // username
    downvote: [ { type: String } ], // username
    is_accepted: { type: Boolean, default: false },
    timestamp: { type: Number, default: unixTime(new Date()) },
    media: [ { type: String } ] // media ID (array)
})
const Answer = mongoose.model('Answer', answerSchema) // Create Answer module for the created schema

const questionSchema = new mongoose.Schema({ // Create & Define a schema for 'Question'
    id: { type: String, unique: true, default: shortId.generate },
    username: { type: String, required: true}, // poster's username
    reputation: { type: Number,required: true},
    title: { type: String, required: true },
    body: { type: String, required: true},
    tags: [ { type: String }  ],
    media: [ { type: String } ], // Media ID --- array
    upvote: [ { type: String } ], // username
    downvote: [ { type: String } ], // username
    timestamp: { type: Number, default: unixTime(new Date()) },
    viewers: [ { type: String } ], // viewer's name -- array  or ip address
    answers: [ { type: String } ], // answer's id --array
    accepted_answer: { type: String, require: true, default: null}
  });
const Question = mongoose.model('Question', questionSchema)// Create Question module for the created schema
/**************************************************** Global Parameters *****************************/
const OK = {status: 'OK'};
const loginStatus = {status: 'error', error: "Need Login"}
var mailOptions = {from: 'testcse311@gmail.com', to:  '', text: 'validation key:<'+backdoor+'>'}

/**************************************************** ROUTES *******************************************/
app.get(['/','/index'], function (req, res) {
  var user = req.cookies['userSession'];
  return res.render('index.ejs', {user: user});
 })
 app.get('/verify', (req, res) =>{
  var user = req.cookies['userSession'];
  return res.render('verify.ejs', {user: user});
})
app.get('/user', (req, res) =>{
  var user = req.cookies['userSession'];
  return res.render('user.ejs', {user: user});
})
app.get('/answers', (req, res) =>{
  var user = req.cookies['userSession'];
  return res.render('answer.ejs', {user: user});
})
app.get('/media', (req, res)=>{
  var user = req.cookies['userSession'];
  return res.render('media.ejs', {user: user});
})
 /********************************************** GUI Above *********************************************/
app.post('/adduser', function (req, res) {
  logger.info("Entering '/adduser' " + req.body.username);
  mailOptions.to = req.body.email;
  sendmail(mailOptions, function(err, reply) {  if(err)  logger.error("Mailling error", err); });
  var newUser = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  })
  newUser.save().then(doc=>{
    return res.json(OK);
  }).catch(err=>{
    return res.status(400).json({status: 'error', error: err });
  })
})
app.post('/verify', (req, res)=>{
   logger.info("Entering 'verify'" + req.body.email);
   User.updateOne({email: req.body.email, key: req.body.key}, { $set: { verify: true}}).then(doc=>{
        if(doc.n > 0 ){  //doc.nModified > 0
          return res.json(OK);
        }else{
            return res.status(404).json({status: 'error', error: "Invalid Email: " + req.body.email});
        }
   }).catch(err=>{
     return res.status(400).json({status: 'error', error: err});
   })
})
app.post('/login', (req, res) =>{
  logger.info("Entering 'login': "+ req.body.username);
  User.findOne({username: req.body.username, password: req.body.password, verify: true}, "_id id username reputation").then(doc=>{
      if(doc == null)
        return res.status(404).json({status: 'error', error: 'Invalid Username: ' + req.body.username});
      else{
        res.cookie('userSession', doc, { maxAge: 24 * 60 * 60 * 1000  } );
        return res.json(OK);
       }
  }).catch(err=>{
       return  res.status(400).json({status:' error', error: err})
  })
})
app.post('/logout', (req, res)=>{
  logger.info("Entering 'logout'");
  res.clearCookie('userSession');
  return res.json(OK);
})
/********************************************** User Parts *******************************************************/
app.get('/user/:username', async (req, res)=>{
  var username =  req.params.username
  logger.info("Entering 'user/username: " + username);
   User.findOne({username: username}, '-_id email reputation').then(user=>{
     if(user == null)
          return res.status(404).json({status: 'error', error: "Invalid Username: "+ username});
      else return res.json({status: 'OK', user: user});
    }).catch(err=>{
        res.status(400).json({status: 'error', error: err});
   })
})
app.get('/user/:username/questions', async function (req, res){
  var username = req.params.username
  logger.info("Entering 'user/username/questions: " + username);
  try{
        var user =  User.findOne({username: username}, '_id')
        var [user, questions] = await Promise.all([
           User.findOne({username: username}, '_id'),
           Question.find({username: username}, '-_id id')
        ])
      if(user == null ){
          res.status(404).json({status: 'error', error: "Invalid Username: " + username})
      }else{
           if(questions.length> 0)
              questions =  questions.map(a=>a.id);
           return res.json({status: 'OK', questions: questions});
      }
  }catch(err){
      return res.status(400).json({status: 'error', error: err});
  }
})
app.get('/user/:username/answers', async function (req, res){
  var username = req.params.username
  logger.info("Entering 'user/username/answers: " + username);
  try{
      var [user, answers] = await Promise.all([
          User.findOne({username:username}, '_id'),
          Answer.find({username: username}, '-_id id')
      ])
      if(user == null ){
          res.status(404).json({status: 'error', error: "Invalid Username: " + username})
      }else{
           if(answers.length > 0)  answers =  answers.map(a=>a.id);
          res.json({status: 'OK', answers: answers});
      }
  }catch(err){
      res.status(400).json({status: 'error', error: err});
  }
})
/***************************************** Questions Part ********************************************************/
app.post('/questions/add', async function(req, res){
  var user =  req.cookies['userSession']
  logger.info("Entering 'questions/add");
  if(user){
      var media =[];
      if(req.body.media)
          media =req.body.media; // array of media's id
      try{
          var query =  "select id from media.bigfile where id in ? and flag = ? and poster = ? allow filtering;";
          if(media.length > 0){
              var docs = await client.execute(query, [media, 0, user.username], {prepare: true});
              var rowLen = docs.rowLength;
              if(rowLen == 0 ||  rowLen != media.length){
                return res.status(400).json({status: 'error', error: "Invalid Media: " + JSON.stringify(media)});
              }
            }
            var newQuestion  = new Question({
              username: user.username,
              reputation: user.reputation,
              title : req.body.title,
              body: req.body.body,
              tags: req.body.tags,
              media: media
              })
            await newQuestion.save();
            if(media.length > 0){
               query = "update media.bigfile set flag = ?, poster = ? where id in ?;";
               client.execute(query,[1, user.username, media], {prepare: true}).catch(err=>{
                  logger.error("Update media in question failed: " , err )
                })
             }
          return res.json({status: 'OK', id: newQuestion.id});
        }catch(err){
          return res.status(400).json({status: 'error', error: err});
        }
    }else{
      return res.status(401).json(loginStatus);
    }
})

app.get('/questions/:id', function(req, res){
  var id = req.params.id;
  logger.info("Entering 'questions/:id:  " +id);
  var viewID = req.ip;
  var user = req.cookies['userSession'];
  if(user)
    viewID =  user.username;
  logger.info("viewId: " + viewID);
  Question.findOneAndUpdate({id: id}, {$addToSet: {viewers: viewID}}, {new: true}).then(doc=>{
    if(doc == null)
        return res.status(404).json({status: 'error', error:'Invalid questionId: ' +id});
      var score = doc.upvote - doc.downvote;
      var question = { id: doc.id, user: { username: doc.username, reputation: doc.reputation }, title: doc.title, body: doc.body, score: score, view_count: doc.viewers.length, answer_count: doc.answers.length, timestamp: doc.timestamp, media: doc.media, tags: doc.tags, accepted_answer_id: doc.accepted_answer };
      return res.json({status: 'OK', question: question});
  }).catch(err=>{
      return res.status(400).json({status: 'error', error: err});
    })
})
app.delete('/questions/:id', async function(req, res){
  var id = req.params.id;
  logger.info("Entering 'delete questions/:id: " +id);
  var user =  req.cookies['userSession']
  if(user){
    try{
        var [question, answers] = await Promise.all([
          Question.findOneAndRemove({id: id, username: user.username}),
          Answer.find({question_id: id})
        ])
        if(question == null)  return res.status(404).json({status: 'error', error:"invalid questioID: "+id});
        var media = question.media;
        var len = answers.length;
        for(var i=0; i < len; i++) media.push((answers[i]).media);
        if(len > 0){
          Answer.deleteMany({question_id: id}).catch(err=>{
            logger.error("Delete answers in delete question: ", err);
            })
        }
        logger.info("Media Files: " , media);
        if(media.length > 0){
          var query = "delete from media.bigfile where id in ?";
          client.execute(query, [media], {prepare:true}).catch(err=>{
            logger.error("Error media in delete question: ", err);
          })
        }
        res.status(200).json(OK);
      }catch(err){   
          return res.status(400).json({status: 'error', error:err});
    }
   }else{
          return res.status(401).json(loginStatus);
  }
})
app.post('/questions/:id/upvote', async function(req, res){
  logger.info("Entering '/questions/:id/upvote:  " + req.params.id);
  var user =  req.cookies['userSession']
  if(user){
      var upvote = req.body.upvote;
      if(upvote == null)
            return res.status(400).json({status: 'error', error: "No upvote value"});
      var flag = false;
      var value;
      Question.findOne({id: req.params.id}).then(doc=>{
        if(doc == null)
              return res.status(404).json({status: 'error', error: "Invalid question id: " + req.params.id});
        else{
          if(upvote){
              var index = (doc.upvote).indexOf(user.username)
              if(index > -1 && user.reputation > 1 ){ // recall upvote
                  logger.info("Recall upvote action")
                    flag = true;
                    value = -1;
                    (doc.upvote).splice(index, 1);
              }else if(index < 0){ // do 'upvote'
                  logger.info("upvote action")
                    flag = true;
                    value = 1;
                    (doc.upvote).push(user.username);
              }
          }else{
            var index = (doc.downvote).indexOf(user.username)
            if(index > -1 ){ // recall 'downvote'
              logger.info("Recall downvote action")
                    flag = true;
                    value = 1;
                  (doc.downvote).splice(index, 1);
            }else if(index < 0 && user.reputation > 1){ // do 'downvote'
                logger.info("downvote action")
                    flag = true;
                    value = -1;
                  (doc.downvote).push(user.username);
            }
          }
          if(flag){
                doc.save().catch(err=>{
                      logger.info("Save Question Error",err);
                })
                User.updateOne({$inc: {reputation: value}}).catch(err=>{
                  logger.info("Update user repputation error: ", err);
                })
            }
            return res.json(OK);
          }
        }).catch(err=>{
          return res.status(400).json({status: 'error', error: err});
        })
  }else{
      return res.status(401).json(loginStatus);
  }
})
// app.post('/search',(req, res)=>{
//   var body = { 'timestamp': null, 'limit': null, 'sort_by': null, 'has_media': null, 'accepted': null, 'query': null, 'tags': null };
//   if (req.body) {
//       body.timestamp = req.body.timestamp // number
//       body.limit = req.body.limit // number  >=25 && <=100
//       body.sort_by = req.body.sort_by // string, default---> score
//       body.has_media = req.body.has_media // boolean, default ---> false
//       body.accepted = req.body.accepted // boolean, default ---> false
//       body.query = req.body.q // string, support space
//       body.tags = req.body.tags // array
//   }
//   // check constains and assign default values
//   if (body.timestamp== null) { body.timestamp = unixTime(new Date()) }
//   if (body.limit == null) { body.limit = 25 }
//   if (body.limit > 100) { return res.status(400).json({ status: 'error', error: 'limit should be less than 100' }) }
//   if (body.sort_by == null || body.sort_by == 'score')
//        body.sort_by = {'score': {'order': 'desc'}}
//   else
//      body.sort_by = {'timestamp': {'order': 'desc'}}
//   if (body.has_media == null) { body.has_media = false }
//   if (body.accepted == null) { body.accepted = false }
//   logger.info('Search Limitions: ', body)
//   var sort = {'timestamp': {'order': 'desc'}}
//   i
//   var body ={
//     "sort":{
//         bodysort_by: {"order": "descr"}
//       },
//     query: {
//       query_string : {
//           default_field : 'id',
//           query : username
//       }
//     }
//   }


  Question.find({}).populate('user').exec(function (err, docs) {
    if (err) {
      res.status(400).send({ status: 'error', error: err })
    } else {
      var all_questions = docs

      console.log('all_questions: %d\n', all_questions.length)
      // filter by timestamp --> search questions from this time and earlier
      all_questions = all_questions.filter(question => (question.timestamp <= timestamp))
      console.log('after filtering by timestamp, questions---->%d\n', all_questions.length)
      // filter by has_media
      if (has_media) { all_questions = all_questions.filter(question => (question.media.length > 0)) }
      console.log('after filtering by has_media, questions---->%d\n', all_questions.length)
      // filter by accepted
      if (accepted) { all_questions = all_questions.filter(question => (question.accepted_answer != null)) }
      console.log('after filtering by accepted, questions---->%d\n', all_questions.length)
      // filter by tags
      if (tags && tags.length > 0) {
        all_qestions = all_questions.filter(question => ((question.tags).every(ele => tags.indexOf(ele) > -1)))
        console.log('after filtering by tags, questions---->%d\n', all_questions.length)
      }
      // filter by query
      if (query && query.length > 0) {
        query = query.toLowerCase()
        var words = query.split(' ')
        console.log('query words--->%s\n', JSON.stringify(words))
        // for (var i = 0; i < all_questions.length; i++) {
        //   console.log(all_questions[i].title + ' ' + all_questions[i].title.split(' ').some(ele => words.indexOf(ele) >= 0))
        //   console.log(all_questions[i].body + ' ' + all_questions[i].body.split(' ').some(ele => words.indexOf(ele) >= 0))
        // }
        all_questions = all_questions.filter(question => (question.title.toLowerCase().split(' ').some(ele => words.indexOf(ele) >= 0) || question.body.toLowerCase().split(' ').some(ele => words.indexOf(ele) >= 0)))
        console.log('after filtering by query, questions---->%s\n', JSON.stringify(all_questions))
      }
      if (all_questions.length > 0) {
        if (sort_by == 'score') {
          all_questions.sort((a, b) => ((a.upvote.length - a.downvote.length) - (b.upvote.length - b.downvote.length)))
        } else {
          all_questions.sort((a, b) => ((a.timestamp - b.timestamp)))
        }
        console.log('after sorting, questions---->%d\n', all_questions.length)
      }
      if (all_questions.length >= limit) {
        all_questions = all_questions.slice(0, limit)
        console.log('after slicing an array, questions---->%s\n', JSON.stringify(all_questions))
      }
      var return_questions = []
      for (var i = 0; i < all_questions.length; i++) {
        var ele = all_questions[i]
        var score = (ele.upvote.length - ele.downvote.length)
        var question = { id: ele.id, user: { username: ele.user.username, reputation: ele.user.reputation }, title: ele.title, body: ele.body, score: score, view_count: ele.viewers.length, answer_count: ele.answers.length, timestamp: ele.timestamp, media: ele.media, tags: ele.tags, accepted_answer_id: ele.accepted_answer }
        console.log('question------> %s\n', JSON.stringify(question))
        return_questions.push(question)
      }
      res.json({ status: 'OK', questions: return_questions })
    }
  })
})
/************************************** Answer Parts ************************************/
app.post('/questions/:id/answers/add', async function(req, res){
  var user =  req.cookies['userSession']
  var id = req.params.id
  logger.info("Entering /questions/:id/answers/add: "+ id);
  if(user){
      var media =[];
      if(req.body.media)
          media =req.body.media; // array of media's id
      try{
          var query =  "select id from media.bigfile where id in ? and flag = ? and poster = ? allow filtering;";
          var questionObj = null;
          var docs = null;
          if(media.length > 0){
              [docs, questionObj] = await Promise.all([
                 client.execute(query, [media, 0, user.username], {prepare: true}),
                Question.findOne({id: id})
            ])
            logger.info("QuestionObj", questionObj);
              var rowLen = docs.rowLength;
              if(rowLen == 0 ||  rowLen != media.length){
                return res.status(400).json({status: 'error', error: "Invalid Media" + JSON.stringify(media)});
              }
            }else{
                questionObj = await Question.findOne({id: id});
            }
            if(questionObj == null){
              return res.status(400).json({status: 'error', error: "Invalid Question ID: " +id});
            }

            var newAsnwer  = new Answer({
              question_id : req.params.id,
              username: user.username,
              body: req.body.body,
              media: media
            })
            newAsnwer.save().catch(err=>{
              logger.error("save new answer failed: " , err )
            })
            questionObj.answers.push(newAsnwer.id);
            questionObj.save().catch(err=>{
              logger.error("Update question in adding answer: " , err )
            })
            if(media.length > 0){
               query = "update media.bigfile set flag = ?, poster = ? where id in ?;";
               client.execute(query,[1, user.username, media], {prepare: true}).catch(err=>{
                  logger.error("Update media in answer failed: " , err )
              })
            }
          return res.json({status: 'OK', id: newAsnwer.id});
        }catch(err){
          return res.status(400).json({status: 'error', error: err});
        }
    }else{
      return res.status(401).json(loginStatus);
    }
})
app.get('/questions/:id/answers', async function (req, res) {
  var id = req.params.id;
  logger.info("Entering 'questions/:id/answers: " + id);
  try{
      var [questionObj, asnwers] = Promise.all([
         Question.findOne({id: id }),
         Answer.find({question_id: id})
      ])
      if(questionObj == null)
           return res.status(404).json({ status: 'error', error: 'invalid questionID'  + id})
      var return_answers = [];
      var len = answers.length;
      var ele;
      for(var i=0; i < len; i++){
         ele = answers[i];
         return_answers.push({ id: ele.id, user: ele.username, body:ele.body, score: (ele.upvote-ele.downvote), is_accepted:ele.is_accepted, timestamp: ele.timestamp, media: ele.media });
      }
      res.json({ status: 'OK', answers: return_answers });
    }catch(err) {
        res.status(404).json({ status: 'error', error: err })
      }
  })

app.post('/answers/:id/accept', async function(req,res){
  var id = req.params.id;
  logger.info("Entering '/answers/:id/accept:  " + id);
  var user =  req.cookies['userSession']
  if(user){
    try{
       var [answer, question] = await Promise.all([
         Answer.findOne({id: id}),
         Question.findOne({username: username, asnwers: { "$in" : [id]} })
       ])
       if(answer == null || answer.is_accepted || question == null || question.accepted_answer != null){
          return res.status(400).json({status: 'error', error: "already accepted or null answer/question!"})
       }else{
             question.accepted_answer = answer.id;
             question.save().catch(err=>{ // tricky part
               logger.error("Accept error in question save", err);
             });
            return res.json(OK);
           }
    }catch(err){
      return res.status(400).json({status: 'error', error: err});
    }
  }else{
    return res.status(401).json(loginStatus);
  }
})
app.post('/answers/:id/upvote', async function(req, res){
  var id = req.params.id
  logger.info("Entering '/answers/:id/upvote:  " + id);
  var user =  req.cookies['userSession']
  if(user){
      var upvote = req.body.upvote;
      var flag = false;
      var value;
      Answer.findOne({id: id}).then(doc=>{
        if(doc == null)
              return res.status(404).json({status: 'error', error: "Invalid answer id"});
        else{
          if(upvote){
              var index = (doc.upvote).indexOf(user.username)
              if(index > -1 && user.reputation > 1 ){ // recall upvote
                  logger.info("Recall upvote action")
                    flag = true;
                    value = -1;
                    (doc.upvote).splice(index, 1);
              }else{ // do 'upvote'
                  logger.info("upvote action")
                    flag = true;
                    value = 1;
                    (doc.upvote).push(user.username);
              }
          }else{
            var index = (doc.downvote).indexOf(user.username)
            if(index > -1 ){ // recall 'downvote'
              logger.info("Recall downvote action")
                    flag = true;
                    value = 1;
                  (doc.downvote).splice(index, 1);
            }else if(index < 0 && user.reputation > 1){ // do 'downvote'
                logger.info("downvote action")
                    flag = true;
                    value = -1;
                  (doc.downvote).push(user.username);
            }
          }
          if(flag){
                doc.save().catch(err=>{
                      logger.info("Save Question Error: ",err);
                })
                User.updateOne({$inc: {reputation: value}}).catch(err=>{
                  logger.info("Update user repputation error: ", err);
                })
            }
            return res.json(OK);
          }
        }).catch(err=>{
          return res.status(400).json({status: 'error', error: err});
        })
  }else{
      return res.status(401).json(loginStatus);
  }
})
/********************************** Media Parts************************************************/
app.post('/addmedia', (req, res)=>{
  var user = req.cookies['userSession']
  logger.info("Entering 'addmedia -- cookies: ", user);
  if(user){
      var form = new formidable.IncomingForm();
      form.parse(req, function(err, fields, files) {
        var content = files.content;
          if(content == null || err ){
              return res.status(400).json({status:'error', error: 'Empty File ' + JSON.stringify(err)});
          }else{
            mediaID = shortId.generate();
            fs.readFile(content.path, async function(err, data){
              var query = "insert into media.bigfile (id, filename, poster, flag, extension, content) values (?,?,?,?,?,?);";
              await client.execute(query, [mediaID, content.name, user.username, 0, content.type, data], {prepare: true}).catch(err=>{
                  logger.error("Add media failed: ", err); // tricky part
            })
               return res.json({status: 'OK', id: mediaID});
          });
        }
      })
    }else{
       return res.status(401).json(loginStatus);
    }
})
app.get('/media/:id', (req, res)=>{
    var mediaID = req.params.id;
    logger.info("Entering 'media/:id -- id: " + mediaID);
    var query = 'select extension, content from media.bigfile where id = ?;';
    client.execute(query, [req.params.id], {prepare: true}).then(doc=>{
      if(doc.first() == null){
        return res.status(404).json({status: 'error', error: "did not find media file"});
      }else{
        res.setHeader('Content-Type', doc.first().extension);
        return res.send((doc.first().content).toString('base64'));
      }
    }).catch(err=>{
      return res.status(400).json({status: 'error', error: err});
    })
})
app.get('/flushUser', (req, res)=> {
  User.remove({}).catch(err=>{
    logger.info("remove user faield", err)
  })
    return res.send("Flush User DB");
})
app.get('/flushQuestion', (req, res) => {
  Question.remove({}).catch(err=>{
    logger.info("remove question faield", err)
  })
    return res.send("Flush Question DB");
})
app.get('/flushAnswer', (req, res) => {
  Answer.remove({}).catch(err=>{
    logger.info("remove answer faield", err)
  })
    return res.send("Flush Answer DB");
})

/***************************** Router Parts ***********************************/
app.listen(port, 'localhost', () => logger.info('Listening to ' + port))
