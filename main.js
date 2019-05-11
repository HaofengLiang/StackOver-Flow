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
// app.use(bodyParser.json({ extended: true})); // to support JSON-encoded bodies
// app.use(bodyParser.urlencoded({  extended: true }));
app.use(bodyParser.json({limit: '50mb',extended: true}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
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
   requestTimeout: 3000  // ping usually has a 3000ms timeout
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
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'}, // poster's name
    body: { type: String, required: true },
    upvote: [ {type: String} ],
    downvote:  [ {type: String} ],
    is_accepted: { type: Boolean, default: false },
    timestamp: { type: Number, default: unixTime(new Date()) },
    media: [ { type: String } ] // media ID (array)
})
const Answer = mongoose.model('Answer', answerSchema) // Create Answer module for the created schema

const questionSchema = new mongoose.Schema({ // Create & Define a schema for 'Question'
    id: { type: String, unique: true, default: shortId.generate },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    title: { type: String, required: true },
    body: { type: String, required: true},
    tags: [ { type: String }  ],
    media: [ { type: String } ], // Media ID --- array
    upvote:  [ {type: String} ],
    downvote:  [ {type: String} ], //username
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
  // logger.info("Entering '/adduser': " + req.body.username);
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
  //  logger.info("Entering 'verify':" + req.body.email);
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
  // logger.info("Entering 'login': "+ req.body.username);
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
  res.clearCookie('userSession');
  return res.json(OK);
})
/********************************************** User Parts *******************************************************/
app.get('/user/:username', async (req, res)=>{
  var username =  req.params.username
  // logger.info("Entering 'user/username");
   User.findOne({username: username}, '-_id email reputation').then(user=>{
     if(user == null)
          return res.status(404).json({status: 'error', error: "Invalid Username: "+ username});
      else return res.json({status: 'OK', user: user});
    }).catch(err=>{
        res.status(400).json({status: 'error', error: err});
   })
})
app.get('/user/:username/questions', async (req, res)=>{
  var username = req.params.username
  // logger.info("Entering 'user/username/questions: " + username);
  try{
        var [user, questions ] = await Promise.all([
              User.findOne({username: username}),
              elasticClient.search({
                index: 'questions',
                type: 'questions_type',
                source:true,
                body: {
                  _source: {
                    includes: ["id"]
                    },
                  query: {
                    query_string: {
                      default_field : "user.username",
                      query:username
                  }
                }
              }
            })
        ])
        if(user == null ){
         return res.status(404).json({status: 'error', error: "Invalid Username: " + username})
        }
        if(questions.hits.total > 0){
            questions = questions.hits.hits.map(a=>a._source.id)
            return res.json({status: 'OK', question: questions})
          }
        else
          return res.json({status: 'OK', question: questions.hits.hits})
        }catch(err){
            return res.status(400).json({status: 'error', error: err});
        }
})
app.get('/user/:username/answers', async (req, res)=>{
  var username = req.params.username
  // logger.info("Entering 'user/username/answers: " + username);
  try{
      var user = await User.findOne({username:username});
      if(user == null ){
       return res.status(404).json({status: 'error', error: "Invalid Username: " + username})
      }
      var answers =  await Answer.find({user: user._id}, '-_id id')
        if(answers.length > 0)  answers =  answers.map(a=>a.id);
          return res.json({status: 'OK', answers: answers});
  }catch(err){
      return res.status(400).json({status: 'error', error: err});
  }
})
/***************************************** Questions Part ********************************************************/
app.post('/questions/add', async (req, res)=>{
  var user =  req.cookies['userSession']
  // logger.info("Entering 'questions/add");
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
                return res.status(400).json({status: 'error', error: media});
              }
            }
            var newQuestion  = new Question({
              user: user._id,
              title : req.body.title,
              body: req.body.body,
              tags: req.body.tags,
              media: media
              })
            if(media.length > 0){
              query = "update media.bigfile set flag = ?, poster = ? where id in ?;";
               await Promise.all([
                newQuestion.save(),
                client.execute(query,[1, user.username, media], {prepare: true}).catch(err=>{
                  logger.error("Update media in question failed: " , err )
                })
               ])
            }else{
              await newQuestion.save();
            }
          return res.json({status: 'OK', id: newQuestion.id});
        }catch(err){
          return res.status(400).json({status: 'error', error: err});
        }
    }else{
      return res.status(401).json(loginStatus);
    }
})

app.get('/questions/:id',  (req, res)=>{
  var id = req.params.id;
  // logger.info("Entering 'questions/:id: " +id);
  var viewID = req.ip;
  var user = req.cookies['userSession'];
  if(user)
    viewID =  user.username;
  Question.findOneAndUpdate({id: id}, {$addToSet: {viewers: viewID}}, {new: true}).then(doc=>{
    if(doc == null)
        return res.status(404).json({status: 'error', error:'Invalid questionId: ' +id});
        User.findById(doc.user).then(user=>{
          var score = doc.upvote - doc.downvote;
          if(score != 0)
            logger.info("Id: " + id + ", score: " + score)
          var question = { id: doc.id, user: { username: user.username, reputation: user.reputation }, title: doc.title, body: doc.body, score: score, view_count: doc.viewers.length, answer_count: doc.answers.length, timestamp: doc.timestamp, media: doc.media, tags: doc.tags, accepted_answer_id: doc.accepted_answer };
        return res.json({status: 'OK', question: question});
      }).catch(err=>{
          return res.status(400).json({status: 'error', error: err});
        })
  }).catch(err=>{
      return res.status(400).json({status: 'error', error: err});
    })
})
app.delete('/questions/:id', async function(req, res){
  var id = req.params.id;
  // logger.info("Entering 'delete questions/:id: " +id);
  var user =  req.cookies['userSession']
  if(user){
    try{
        var [question, answers] = await Promise.all([
          Question.findOneAndRemove({id: id, user: user._id}),
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
        // logger.info("Media Files: " , media);
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
  // logger.info("Entering '/questions/:id/upvote:  " + req.params.id);
var user =  req.cookies['userSession']
  if(user){
      var upvote = req.body.upvote;
      if(upvote == null) return res.status(400).json({status: 'error', error: "No upvote value"});
      Question.findOne({id: req.params.id}).populate('user').then(doc=>{
        if(doc == null)
              return res.status(404).json({status: 'error', error: "Invalid question id: " + req.params.id});
        else{
          var upvote_index = (doc.upvote).indexOf(user.username)
          var downvote_index =(doc.downvote).indexOf(user.username)
          var rep = doc.user.reputation
          if(upvote){ // want upvote
            if(upvote_index < 0){ // no upvote before,  upvote and increase rep
              (doc.upvote).push(user.username);
              rep += 1;
              if(downvote_index > -1 ){ // downvote before, recall it only
                (doc.downvote).splice(downvote_index, 1);
              }
            }else{ // repeat upvote, recall it and decrease rep
              (doc.upvote).splice(upvote_index, 1);
              if((doc.user.reputation) > 1){
                  rep  -= 1;
              }
            }
          }else{ // want downvote
            if(downvote_index < 0){ // no downvote before, downvote and decrease rep
                (doc.downvote).push(user.username);
                if((doc.user.reputation) > 1){
                  rep  -= 1;
                }
              if(upvote_index > -1 ){ // upvote before, recall it only
                (doc.upvote).splice(upvote_index, 1);
              }
            }else{ // repeat downvote, recall it and increase rep
               (doc.downvote).splice(downvote_index, 1);
                rep  += 1;
            }
          }
          doc.save().catch(err=>{
              logger.error("Save Question Error",err);
          })
          User.updateOne({_id: doc.user}, {$set: {reputation: rep}}).catch(err=>{
            logger.error("Update user's rep error", err);
          })
          return res.json(OK);
          }
        }).catch(err=>{
          return res.status(400).json({status: 'error', error: err});
        })
  }else{
      return res.status(401).json(loginStatus);
  }

})

app.post('/search',(req, res)=>{
  var timestamp, limit, sort_by, has_media, accepted, query, tags;
  if (req.body) {
       timestamp = req.body.timestamp // number
       limit = req.body.limit // number  >=25 && <=100
       sort_by = req.body.sort_by // string, default---> score
       has_media = req.body.has_media // boolean, default ---> false
       accepted = req.body.accepted // boolean, default ---> false
       query = req.body.q // string, support space
       tags = req.body.tags // array
   }
   if (timestamp== null) 
         timestamp = unixTime(new Date());
   if (limit == null) { limit = 25 }
   if (limit > 100) { return res.status(400).json({ status: 'error', error: 'limit should be less than 100' }) }
   if(sort_by == null) 
      sort_by = 'score:desc'
    else
       sort_by = 'timestamp:desc'
   if(tags == null) tags = [];
   if (has_media == null) { has_media = false }
   if (accepted == null) { accepted = false }
  var searchBody = {
    'query':{
      'bool':{
       'must': [
            {'range':{'timestamp': {'lte': timestamp}}}
          ]
      }
    }
  }
 if(query && query.length > 0) {
     (searchBody.query.bool.must).push({
       'multi_match': {
             'query': query,
             'type': "best_fields",
             'fields': ["title", "body"]
        }
     })
   }
    if(tags.length > 0)
      (searchBody.query.bool.must).put({'term': {"tags": tags}})
    if(has_media)
      (searchBody.query.bool.must).put( {'exists': {"field": "media"}})
    if(accepted)
      (searchBody.query.bool.must).put({'exists': {"field": "accepted_answer"}})
  // logger.info("my Search body: ", searchBody );
   elasticClient.search({
    index: 'questions',
    type: 'questions_type',
    source:true,
    size:limit,
    body: searchBody,
    sort:[sort_by]
   }).then(questions => {
     logger.info("questions", questions)
        return res.json({status: 'OK', question: questions.hits.hits})
    }).catch(err => {
        return res.json({status: 'error', error: err})
    })
})
/************************************** Answer Parts ************************************/
app.post('/questions/:id/answers/add', async function(req, res){
  var user =  req.cookies['userSession']
  var id = req.params.id
  // logger.info("Entering /questions/:id/answers/add: "+ id);
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
            // logger.info("QuestionObj", questionObj);
              var rowLen = docs.rowLength;
              if(rowLen == 0 ||  rowLen != media.length){
                return res.status(400).json({status: 'error', error: media});
              }
            }else{
                questionObj = await Question.findOne({id: id});
            }
            if(questionObj == null){
              return res.status(400).json({status: 'error', error: "Invalid Question ID: " +id});
            }
            var newAsnwer  = new Answer({
              question_id : req.params.id,
              user: user._id,
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
app.get('/questions/:id/answers', async (req, res) =>{
  var id = req.params.id;
  // logger.info("Entering 'questions/:id/answers: " + id);
  try{
      var [questionObj, answers] = await Promise.all([
        elasticClient.search({
          index: 'questions',
          type: 'questions_type',
          source:true,
          body: {
            _source: {
              includes: ["id"]
              },
            query: {
              query_string: {
                default_field : "id",
                query:id
            }
          }
        }
      }),
        Answer.find({question_id: id})
      ])
      if(questionObj == null)
           return res.status(404).json({ status: 'error', error: 'invalid questionID'  + id})
        var return_answers = [];
        var len = answers.length;
      var ele;
      var score;
      for(var i=0; i < len; i++){
         ele = answers[i];
         score = ele.upvote - ele.downvote;
         return_answers.push({ id: ele.id, user: ele.username, body:ele.body, score: score, is_accepted:ele.is_accepted, timestamp: ele.timestamp, media: ele.media });
      }
      res.json({ status: 'OK', answers: return_answers });
    }catch(err) {
        res.status(404).json({ status: 'error', error: err })
      }
  })

app.post('/answers/:id/accept', async function(req,res){
  var id = req.params.id;
  // logger.info("Entering '/answers/:id/accept:  " + id);
  var user =  req.cookies['userSession']
  if(user){
    try{
       var [answer, question] = await Promise.all([
         Answer.findOne({id: id}),
         Question.findOne({user: user._id, answers: { $in : [id]} })
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
  // logger.info("Entering '/answers/:id/upvote:  " + id);
  var user =  req.cookies['userSession']
  if(user){
      var upvote = req.body.upvote;
      var value = 0;
      Answer.findOne({id: id}).populate('user').exec().then(doc=>{
        if(doc == null)
            return res.status(404).json({status: 'error', error: "Invalid answer id"});
        else{
          var upvote_index = (doc.upvote).indexOf(user.username)
          var downvote_index =(doc.downvote).indexOf(user.username)
          if(upvote){ // want upvote
            if(upvote_index < 0){ // no upvote before,  upvote and increase rep
              (doc.upvote).push(user.username);
              (doc.user.reputation) += 1;
              if(downvote_index > -1 ){ // downvote before, recall it only
                (doc.downvote).splice(downvote_index, 1);
              }
            }else{ // repeat upvote, recall it and decrease rep
              (doc.upvote).splice(upvote_index, 1);
              if((doc.user.reputation) > 1)
                  doc.user.reputation  -= 1;
            }
          }else{ // want downvote
            if(downvote_index < 0){ // no downvote before, downvote and decrease rep
                (doc.downvote).push(user.username);
                if((doc.user.reputation) > 1)
                   doc.user.reputation  -= 1;
              if(upvote_index > -1 ){ // upvote before, recall it only
                (doc.upvote).splice(upvote_index, 1);
              }
            }else{ // repeat downvote, recall it and increase rep
               (doc.downvote).splice(downvote_index, 1);
                doc.user.reputation  += 1;
            }
          }
          doc.save().catch(err=>{
              logger.error("Save Question Error",err);
          })
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
  // logger.info("Entering 'addmedia -- cookies: ", user);
  if(user){
      var form = new formidable.IncomingForm();
      form.parse(req, function(err, fields, files) {
        var content = files.content;
          if(content == null || err ){
              return res.status(400).json({status:'error', error: err});
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
    // logger.info("Entering 'media/:id -- id: " + mediaID);
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
app.get('/flushMedia', (req,res) => {
  query = " truncate media.bigfile";
  client.execute(query, {prepare: true}).catch(err=>{
     logger.error("truncate media failed: " , err )
   })
   return res.send("Flush Media DB");
})

/***************************** Router Parts ***********************************/
app.listen(port, 'localhost', () => logger.info('Listening to ' + port))
