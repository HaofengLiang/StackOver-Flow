const express = require('express'); // require expressJS framework
const bodyParser = require('body-parser'); // for html parsing
const path = require('path') // for serving static files lately
const compression = require('compression') // can greately decrease the size of the response body, and hence increase the sepeed of a web app
const cassandra = require('cassandra-driver');
const mongoose = require('mongoose');
const elasticsearch = require('elasticsearch');
const mexp = require('mongoose-elasticsearch-xp');
const cookieParser = require('cookie-parser');
const Memcached = require('memcached');
const memcached = new Memcached();
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
/**************************************************** Global Parameters *****************************/
const OK = {status: 'OK'};
const loginStatus = {status: 'error', error: "Need Login"}
var mailOptions = {from: 'testcse311@gmail.com', to:  '', text: 'validation key:<'+backdoor+'>'}
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
mongoose.connect('mongodb://130.245.170.235:27017/firewall', { useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false }).catch(err=> {
  if (err) { return res.status(400).json({status:'error', error: err}) }
});
const elasticClient = new elasticsearch.Client({ host: 'localhost:9200'}, function(err, conn){
      if(err){return res.status(400).json({status:'error', error: err})}
});
const client = new cassandra.Client({ contactPoints: ['192.168.122.32'], localDataCenter: 'datacenter1', keySpace: 'media' });
client.connect(function(err, result) {
    if (err) { return res.status(400).json({status:'error', error: err}) }
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
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'}, // answer's poster's ObejctID
    body: { type: String, required: true },
    upvote: [ { type: String } ], // username
    downvote: [ { type: String } ], // username
    is_accepted: { type: Boolean, default: false },
    timestamp: { type: Number, default: unixTime(new Date()) },
    media: [ { type: String } ] // media ID (array)
})
const Answer = mongoose.model('Answer', answerSchema) // Create Answer module for the created schema

const questionSchema = new mongoose.Schema({ // Create & Define a schema for 'Question'
    id: { type: String, unique: true, default: shortId.generate, es_indexed: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', es_indexed: true},
    title: { type: String, required: true,  es_indexed:true },
    body: { type: String, required: true, es_indexed:true},
    tags: [ { type: String ,  es_indexed:true }  ],
    media: [ { type: String,  es_indexed:true } ], // Media ID
    upvote: [ { type: String } ], // username
    downvote: [ { type: String } ], // username
    timestamp: { type: Number, default: unixTime(new Date()),  es_indexed:true },
    viewers: [ { type: String } ], //username
    answers: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' } ],
    accepted_answer: { type: String, require: true, default: null,  es_indexed:true}
    }, // Answers' ID
    {
      es_extend: {
        score: {
          es_type: 'integer',
          es_value: function (doc) {
            return (doc.upvote.length - doc.downvote.length);
          }
        },
        view_count: {
          es_type: 'integer',
          es_value: function (doc) {
            return doc.viewers.length;
          }
        },
        answer_count: {
          es_type: 'integer',
          es_value: function (doc) {
            return doc.answers.length;
          }
        }
    }
  });

questionSchema.plugin(mexp,{ client: elasticClient, populate: [{ path: 'user', select: 'username reputation'}]});
const Question = mongoose.model('Question', questionSchema)// Create Question module for the created schema
/**************************************************** ROUTES *******************************************/
app.get(['/','/index'], function (req, res) {
  var user = req.cookies['userSession'];
  return res.render('index.ejs', {user: user});
 })
app.post('/adduser', function (req, res) {
  logger.info("Entering '/adduser' " + req.body.username);
  mailOptions.to = req.body.email;
  // sendmail(mailOptions, function(err, reply) {
  //   if(err)
  //     logger.error("Mail failed", err);
  // });
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
app.get('/verify', (req, res) =>{
  var user = req.cookies['userSession'];
  return res.render('verify.ejs', {user: user});
})
app.post('/verify', (req, res)=>{
   logger.info("Entering 'verify'" + req.body.email);
   User.updateOne({email: req.body.email, key: req.body.key}, { $set: { verify: true}}).then(doc=>{
        if(doc.n > 0 ){  //doc.nModified > 0
          return res.json(OK);
        }else{
            return res.status(404).json({status: 'error', error: "Not find email " + req.body.email});
        }
   }).catch(err=>{
     return res.status(400).json({status: 'error', error: err});
   })
})
app.post('/login', (req, res) =>{
  logger.info("Entering 'login': "+ req.body.username);
  User.findOne({username: req.body.username, password: req.body.password, verify: true}, "_id id username reputation").then(doc=>{
      if(doc == null)
        return res.status(404).json({status: 'error', error: 'No Active user founded'});
      else{
        res.cookie('userSession', doc, { maxAge: 24 * 60 * 60 * 1000 * 7 } );
        return res.json(OK);
       }
  }).catch(err=>{
       return  res.status(400).json({status:' error', error: err})
  })
})
app.post('/logout', (req, res)=>{
  logger.info("Entering 'logout --> cookies: '", req.cookies['userSession']);
  res.clearCookie('userSession');
  return res.json({status:'OK'})
})
/********************************************** User Parts *******************************************************/
app.get('/user', (req, res) =>{
  var user = req.cookies['userSession'];
  return res.render('user.ejs', {user: user});
})
app.get('/user/:username', function (req, res){
  logger.info("Entering 'user/username --> username: " + req.params.username);
   User.findOne({username: req.params.username}, '-_id email reputation').then(user=>{
     if(user == null)
          return res.status(404).json({status: 'error', error: "This user does not exist!!!"});
      else return res.json({status: 'OK', user: user});
    }).catch(err=>{
        res.status(400).json({status: 'error', error: err});
   })
})
app.get('/user/:username/questions', async function (req, res){
  logger.info("Entering 'user/username/questions --> username: " + req.params.username);
  try{

        var user =  User.findOne({username: req.params.username}, '_id')
        var query = {
          "bool": {
            "must": [
              {
                "nested": {
                  "path": "user", 
                    "query": {
                     "bool": {
                        "must": [ 
                           {
                          "match": {
                            "user.username": req.params.username
                          }
                        }
                      ]
                    }
                  }
        }
      }]}}
      //  var [user, questions] = await Promise.all([
      //     User.findOne({username: req.params.username}, '_id'),
      //     // Question.findOne({'user.username': req.params.username}).populate('user')
      //      Question.esSearch(query)
      //   ])
      var questions = await Question.esSearch(query)
      if(user == null ){
          res.status(404).json({status: 'error', error: "This user does not exist!!!"})
      }else{
          //  if(questions.length> 0)
          //       questions =  questions.map(a=>a.id);
           return res.json({status: 'OK', questions: questions});
      }
  }catch(err){
      return res.status(400).json({status: 'error', error: err});
  }
})
app.get('/user/:username/answers', async function (req, res){
  logger.info("Entering 'user/username/answers --> username: " + req.params.username);
  try{
      var [user, answers] = await Promise.all([
          User.findOne({username: req.params.username}, '_id'),
          Answer.find({"user.username": req.params.username}, '_id id')
      ])
      if(user == null ){
          res.status(404).json({status: 'error', error: "This user does not exist!!!"})
      }else{
           if(answers.length > 0){
            answers =  answers.map(a=>a.id);
           }
          res.json({status: 'OK', answers: answers});
      }
  }catch(err){
      res.status(400).json({status: 'error', error: err});
  }
})
/***************************************** Questions Part ********************************************************/
app.post('/questions/add', async function(req, res){
  var user =  req.cookies['userSession']
  logger.info("Entering 'questions/add --> cookies: ", user);
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
              user: user._id,
              title : req.body.title,
              body: req.body.body,
              tags: req.body.tags,
              media: media
              })
            await newQuestion.save(function(err){
              if(err) throw err;
              newQuestion.on('es-indexed', function(err, res){
                  if(err) throw err;
              })
            });
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
      return res.status(401).json({status: 'error', error: "Login /questions/add "});
    }
})

app.get('/questions/:id', function(req, res){
  logger.info("Entering 'questions/:id ---> id: " + req.params.id);
  var viewID = req.ip;
  var user = req.cookies['userSession'];
  if(user)
    viewID =  user.username;
  logger.info("viewId: " + viewID);
  Question.findOneAndUpdate({id: req.params.id}, {$addToSet: {viewers: viewID}}, {new: true}).populate('user').then(doc=>{
    if(doc == null)
        return res.status(404).json({status: 'error', error:'Invalid questionId'});
      var score = doc.upvote - doc.downvote;
      var question = { id: doc.id, user: { username: doc.user.username, reputation: doc.user.reputation }, title: doc.title, body: doc.body, score: score, view_count: doc.viewers.length, answer_count: doc.answers.length, timestamp: doc.timestamp, media: doc.media, tags: doc.tags, accepted_answer_id: doc.accepted_answer };
      return res.json({status: 'OK', question: question});
  }).catch(err=>{
      return res.status(400).json({status: 'error', error: err});
    })
})
app.delete('/questions/:id', async function(req, res){
  logger.info("Entering 'delete questions/:id ----> id: " + req.params.id);
  var user =  req.cookies['userSession']
  if(user){
    Question.findOneAndRemove({id: req.params.id, user: user._id}).populate('answers').then(question=>{
      if(question == null)
            return res.status(404).json({status: 'error', error:"invalid questioID: "+ req.params.id});
      else{
         var media = question.media;
         var len = question.answers.length;
         for(var i=0; i < len; i++) media.push((question.answers)[i]);
         logger.info("Media Files: " , media);
         var query = "delete from media.bigfile where id in ?";
         if(media.length > 0){
              client.execute(query, [media], {prepare:true}).catch(err=>{
                logger.error("Update media in delete question: ", err);
              })
          }
        if(question.answers.length > 0)
            Answer.deleteMany({question_id: question.id}).catch(err=>{
              logger.error("Delete answers in delete question: ", err);
            })
        return res.status(200).json(OK);
      }
    }).catch(err=>{
      return res.status(400).json({status: 'error', error:err}); 
    })
   }else{
     return res.status(401).json({status: 'error', error: "Login /questions/:id --delete "});
  }
})
app.post('/questions/:id/upvote', async function(req, res){
  logger.info("Entering '/questions/:id/upvote--> " + req.params.id);
  var user = req.signedCookies['username'];
  if(user){
      var upvote = req.body.upvote;
      if(upvote == null)
            return res.status(400).json({status: 'error', error: "No upvote value"});
      var flag = false;
      var value;
      Question.findOne({id: req.params.id}).populate('user').then(doc=>{
        if(doc == null)
              return res.status(404).json({status: 'error', error: "Invalid question id"});
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
                      logger.info("Save Question Error: "+ JSON.stringify(err));
                })
                User.updateOne({$inc: {reputation: flag}}).catch(err=>{
                  logger.info("Update user repputation error: "+ JSON.stringify(err));
                })
            }
            return res.status({status: 'OK'});
          }
        }).catch(err=>{
          return res.status(400).json({status: 'error', error: JSON.stringify(err)});
        })
  }else{
      return res.status(401).json("You need to login firstly to upvote a question! ");
  }
})

// // app.get('/search', function(req, res){

// // })
/************************************** Answer Parts ************************************/
app.get('/answers', (req, res) =>{
  var user = req.cookies['userSession'];
  return res.render('answer.ejs', {user: user});
})
app.post('/questions/:id/answers/add', async function(req, res){
  var user =  req.cookies['userSession']
  logger.info("Entering /questions/:id/answers/add --> id: "+ req.params.id);
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
                 Question.findOne({id: req.params.id})
              ])
              var rowLen = docs.rowLength;
              if(rowLen == 0 ||  rowLen != media.length){
                logger.info("Failed Media in add answer: ", media)
                return res.status(400).json({status: 'error', error: "Invalid Media"});
              }
            }else{
                questionObj = await Question.findOne({id: req.params.id});
            }
            if(questionObj == null){
              return res.status(400).json({status: 'error', error: "Invalid Question ID: " + req.params.id});
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
            questionObj.answers.push(newAsnwer._id);
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
      return res.status(401).json({status: 'error', error: "Login /questions/:id/answers/add "});
    }
})
app.get('/questions/:id/answers', async function (req, res) {
  logger.info("Entering 'questions/:id/answers --> id: " + req.params.id);
  try{
      var getQuestion = await Question.findOne({ id: req.params.id }).populate({ path: 'answers' ,populate: { path: 'user'}});
      if(getQuestion == null)
           return res.status(404).json({ status: 'error', error: 'invalid question id'  + req.params.id})
      var getAnswers = getQuestion.answers;
      var return_answers = [];
      var len = getAnswers.length;
      var ele;
      for(var i=0; i < len; i++){
         ele = getAnswers[i];
        return_answers.push({ id: ele.id, user: ele.user.username, body:ele.body, score: (ele.upvote-ele.downvote), is_accepted:ele.is_accepted, timestamp: ele.timestamp, media: ele.media });
      }
      res.json({ status: 'OK', answers: return_answers });
    }catch(err) {
        res.status(404).json({ status: 'error', error: err })
      }
  })

app.post('/answers/:id/accept', async function(req,res){
  logger.info("Entering '/answers/:id/accept --> answer's id : " + req.params.id);
  var user =  req.cookies['userSession']
  if(user){
    try{
       var [answer, question] = await Promise.all([
         Answer.findOne({id: req.params.id}),
         Question.findOne({user: user._id, "answer.id": req.params.id}).populate('answers') // poster can only accept
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
    return res.status(401).json({status:'error', error: "Need Login to accept one asnwer"} );
  }
})

// app.post('/answers/:id/upvote', async function(req, res){
//   logger.info("Entering '/answers/:id/upvote--> " + req.params.id);
//   var user = req.signedCookies['username'];
//   if(user){
//       var upvote = req.body.upvote;
//       if(upvote == null)
//             return res.status(400).json({status: 'error', error: "No upvote value"});
//       var flag = false;
//       var value;
//       Answer.findOne({id: req.params.id}).populate('user').then(doc=>{
//         if(doc == null)
//               return res.status(404).json({status: 'error', error: "Invalid answer id"});
//         else{
//           if(upvote){
//               var index = (doc.upvote).indexOf(user.username)
//               if(index > -1 && user.reputation > 1 ){ // recall upvote
//                   logger.info("Recall upvote action")
//                     flag = true;
//                     value = -1;
//                     (doc.upvote).splice(index, 1);
//               }else{ // do 'upvote'
//                   logger.info("upvote action")
//                     flag = true;
//                     value = 1;
//                     (doc.upvote).push(user.username);
//               }
//           }else{
//             var index = (doc.downvote).indexOf(user.username)
//             if(index > -1 ){ // recall 'downvote'
//               logger.info("Recall downvote action")
//                     flag = true;
//                     value = 1;
//                   (doc.downvote).splice(index, 1);
//             }else if(index < 0 && user.reputation > 1){ // do 'downvote'
//                 logger.info("downvote action")
//                     flag = true;
//                     value = -1;
//                   (doc.downvote).push(user.username);
//             }
//           }
//           if(flag){
//                 doc.save().catch(err=>{
//                       logger.info("Save Question Error: "+ JSON.stringify(err));
//                 })
//                 User.updateOne({$inc: {reputation: flag}}).catch(err=>{
//                   logger.info("Update user repputation error: "+ JSON.stringify(err));
//                 })
//             }
//             return res.status({status: 'OK'});
//           }
//         }).catch(err=>{
//           return res.status(400).json({status: 'error', error: JSON.stringify(err)});
//         })
//   }else{
//       return res.status(401).json("You need to login firstly to upvote a answer! ");
//   }
// })
/********************************** Media Parts*****************************/
app.get('/media', (req, res)=>{
  logger.info("here")
  var user = req.cookies['userSession'];
  return res.render('media.ejs', {user: user});
})
app.post('/addmedia', (req, res)=>{
  var user = req.cookies['userSession']
  logger.info("Entering 'addmedia -- cookies: ", user);
  if(user){
      var form = new formidable.IncomingForm();
      form.parse(req, function(err, fields, files) {
        var content = files.content;
          if(content == null || err ){
              return res.status(400).json({status:'error', error: 'Empty File ' + err});
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
       return res.status(401).json({status: "error", error: "Need Log In "});
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
app.get('/flush', function (req, res) {

  User.remove({}).catch(err=>{
    logger.info("remove user faield", err)
  })
  Question.remove({}).catch(err=>{
    logger.info("remove questions faield", err)
  })
  Answer.remove({}).catch(err=>{
    logger.info("remove answers faield", err)
  })
})
/***************************** Router Parts ***********************************/
app.listen(port, 'localhost', () => logger.info('Listening to ' + port))
