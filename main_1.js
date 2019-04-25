// Call the packages that all we need & make configuration
const express = require('express'); // require expressJS framework
const bodyParser = require('body-parser'); // for html parsing
const path = require('path') // for serving static files lately
const winston = require('winston'); //A logger for just about everything
const compression = require('compression') // can greately decrease the size of the response body, and hence increase the sepeed of a web app
const Memcached = require('memcached'); //is a fully featured memcached client for Node.js: scaling, high availability & exceptional performance
const unixTime = require('unix-time');
//const sendmail = require('sendmail')({silent: false});
const nodemailer = require('nodemailer');
const shortId = require('shortid'); // generate id forthe fields in the db
const fs = require('fs'); // manipulate file system
const cassandra = require('cassandra-driver');
const mongoose = require('mongoose');
const mexp = require('mongoose-elasticsearch-xp'); // mongoose + elasticsearch
const app = express(); // Create an Application based on ExpressJS
const backdoor = 'abracadabra' // backdoor key for verifying user account
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
// Packages Configuration & modules export
app.use(fileUpload());
app.use(compression()) // gzip
const logger = winston.createLogger({
    transports: [
        new winston.transports.Console()
    ]
});
app.use(express.static(path.join(__dirname, 'public'))); // for ejs
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
   extended: true
}));
app.set('view engine', 'ejs'); // for redenering html files in ejs format
app.set('trust proxy');// for getting ip for couting views for questions

const transporter = nodemailer.createTransport({
  port: 587,
  sendmail: true,
  path: '/usr/sbin/sendmail'
});

// /*********************************** DB *****************************/
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://64.52.86.95:27018/project', { useNewUrlParser: true, useCreateIndex: true });
var memcached = new Memcached();
memcached.connect('127.0.0.1:11211', function (err, conn) { // conenct memecacehd
    if( err ) throw new Error( err );
  });
const client = new cassandra.Client({ contactPoints: ['209.50.57.68'], localDataCenter: 'datacenter1', keySpace: 'media' });
client.connect(function(err, result) {
    if (err) { logger.info(err); }
});
app.use(cookieParser('firewall'));

// /*********************************** DB--- Schema *******************/
  // Create & Define a schema for 'User'
const userSchema = new mongoose.Schema({
    id: { type: String, unique: true, default: shortId.generate },
    username: { type: String, required: true, unique: [true, "user's username must be unique"] }, // username must be unique
    email: { type: String, required: true, unique: [[true, "user's email must be unique"]] }, // email must be uniqeu
    password: { type: String, required: true },
    reputation: { type: Number, default: 1},
    verify: { type: Boolean, default: false },
    key: { type: String, default: 'abracadabra' }
});
const User = mongoose.model('User', userSchema) // Create User module for the created schema

// Create & Define a schema for 'Answer'
const answerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: shortId.generate },
    question_id: { type: String, required: true },
    username: { type: String, required: true}, // answers's poster's username
    body: { type: String, required: true },
    upvote: [ { type: String } ], // the id of user who did upvoting
    downvote: [ { type: String } ], // the id of user who did downting
    is_accepted: { type: Boolean, default: false },
    timestamp: { type: Number, default: unixTime(new Date()) },
    media: [ { type: String } ] // answer's media (array) ---save filename(media's id)
  });
const Answer = mongoose.model('Answer', answerSchema) // Create Answer module for the created schema

const questionSchema = new mongoose.Schema({ // Create & Define a schema for 'Question'
    id: { type: String, unique: [true, "question's id must be unique"], default: shortId.generate , es_indexed: true},
    username:  {type: String, required : true, es_indexed: true},
    reputation: {type: String, required: true, es_indexed: true},
    title: { type: String, required: true, es_indexed: true },
    body: { type: String, required: true, es_indexed: true },
    tags: [ { type: String , es_indexed: true } ],
    media: [ { type: String } ], // media's id && default is []
    upvote: [ { type: String } ], // the id of the user who already upvoted
    downvote: [ { type: String } ], // the id of the user who already downvoted
    timestamp: { type: Number, default: unixTime(new Date()) , es_indexed: true},
    viewers: [ { type: String } ], // question's viewers(users)' id or ip address
    answers: [ { type: String , es_extend: true} ], // array of asnwers' id
    accepted_answer: { type: String, require: true, default: null, es_indexed: true } // answer's id
  },{
      es_extend:{
          score: {
            es_type: 'integer',
            es_value : function (document) {
                return document.upvote.length - downvote.length;
            },
            view_count:{
              es_type: 'integer',
              es_value: function(document){
                  return document.viewers.length;
              }
            },
            answer_count:{
               es_type: 'integer',
               es_value : function(document){
                  return document.answers.length;
               }
            }
          }
     }
});
questionSchema.plugin(mexp);
const Question = mongoose.model('Question', questionSchema)// Create Question module for the created schema

// Get all answers of the question with the specified id
app.get(['/','/index'], function (req, res) {
   memcached.flush(function (err, result) { // for clearing all cached data
      if (err) console.error(err)
        logger.error('flush: ' + result);
    })
    res.json('Welcome to my Mini-StackoverFlow homepage');
  })
/****************************** Users Part */
app.post('/adduser', async function(req, res){
  try{
      var newUser = new User({
            username: req.body.username,
            email: req.body.email,
            password: req.body.password
        })
      var saveUser = await newUser.save();
      logger.info('create a new disabled uesr successfully! with Name:'+ saveUser.username);
      mailOptions = {
        from: 'testcse311@gmail.com',
        to: req.body.email,
        subject: 'Email Confirmation',
        text: 'validation key: <' + backdoor + '>'
      }
      transporter.sendMail(mailOptions); //not use await
      res.json({ status: 'OK' });
    }catch(err){
        logger.error("Faield to add user: "+ JSON.stringify(err));
        res.status(400).json({ status: 'error', error: err});
    }
})

app.post('/verify', async function(req, res){
try{
      var verifyUser = await User.updateOne({ email: req.body.email, key: req.body.key }, { $set: { verify: true } });
      if(verifyUser.nModified > 0){
            logger.info('Verify Successfully! : '+req.body.email);
            res.json({ status: 'OK' })
        }else{
            logger.info("you already verified it");
            res.status(400).json({ status: 'error', error: 'you did not modified anything!' }) // Bad Request
        }
    }catch(err){
        logger.error("Verify faield:" + JSON.stringify(err));
        res.status(400).json({ status: 'error', error: err })
    }
})

app.post('/login', async function(req, res){
  try{
        var logged_user = await User.findOne({username: req.body.username, password: req.body.password, verify:true});
        if(logged_user == null){
            logger.error("Failed to login in: no active user founded!");
            res.status(404).json({ status: 'error', error: 'no active user founded!' });
        }else{
             res.cookie('user', logged_user, { signed: true,  maxAge:  1800000 });
             res.json({status:'OK'});
        }
    }catch(err){
        logger.error("Faield to log in:"+ JSON.stringify(err));
        res.status(400).send({ status: 'error', error: err });
    }
 })
app.post('/logout', async function(req, res){
    try{
        await res.clearCookie("user");
        res.json({ status: 'OK' })
    }catch(err){
        logger.error("Failed to logout: " + JSON.stringify(err));
        res.status(400).json({status:'error', error: err});
    }
})
// Get user profile info for user with 'username'
app.get('/user/:username', async function (req, res) {
  try{
    var getUser = await memcached.get(req.params.username +'getU');
    logger.info("get username in memcacehd: "+ getUser());
    if(getUser == null){
        getUser = await User.findOne({username: req.params.username });
        await memcached.set(req.params.username+'getU', getUser, 120) // keep 2 minutes
    }
    if(getUser == null){
          logger.error('did not find this user with name: ' + req.params.username);
          res.status(404).send({ status: 'error', error: 'did not find this user with name: ' + req.params.username })
      }
      res.json({ status: 'OK', user: { email: getUser.email, reputation: getUser.reputation } })
    }catch(err) {
      logger.error("failed to get user profile:  "+ JOSN.stringify(err));
      res.status(400).send({ status: 'error', error: err })
    }
  })
// Get questions posted by user with 'username
app.get('/user/:username/questions', async function (req, res) {
    var getUser = await memcached.get(req.params.username+'getU');
    if(getUser == null){
        getUser = await User.findOne({username: req.params.username });
        await memcached.set(req.params.username+'getU', getUser, 120) // keep 2 minutes
    }
    if(getUser == null){
      logger.error("You did not find any valid user to get questions: "+ req.params.username);
      res.status(404).send({ status: 'error', error: 'did not find any user' })
    }else{
        Question.esSearch({
          bool: {
              filter: {
                term : { "username":   req.params.username }
              }
          }
        }).then(function (err, results) {
          if(err)
            res.status(400).send({ status: 'error', error: err })
          else{
                if(results == null || results.length == 0)
                        result = [];
                res.json({ status: 'OK', questions: results });
            }
      });
  }
})

// // Get answers posted by user with 'username
app.get('/user/:username/answers', async function (req, res) {
  try{
      var getUser = await  memcached.get(req.params.username+'getU');
      if(getUser == null){
          getUser = await User.findOne({username: req.params.username });
          await memcached.set(req.params.username+'getU', getUser, 120) // keep 2 minutes
      }
       if(getUser == null){
          logger.error("You did not find any valid user to get answers: "+ req.params.username);
          res.status(404).send({ status: 'error', error: 'did not find any user' })
       }
        var getAnswers = await Answer.find({user: username}, 'id');
          if(getAnswers == null)
              getAnswers = [];
         res.json({ status: 'OK', answers: getAnswers });
  }catch(err){
      logger.error("failed to find one user's anwers: "+ req.params.username );
      res.status(400).send({ status: 'error', error: err })
  }
})

///***************************** Question Router Parts ************************************/
// Add one new questions
// app.post('/questions/add', async function (req, res) {
//     if(req.signedCookies['user']){
//         var media = [];
//         if(req.body && req.body.media) // Media optional
//           {
//                 media = req.body.media;
//                 for(var i =0;  i < media.length; i++){
//                   var query = 'select id from  media.bigfile where id = ? and flag = ? allow filtering;';
//                   var results = await client.execute(query, [media[i], 'true'], {prepare: true});
//             		  var counter = 0;
//             		  for (var row of results)
//             			counter = counter+1
//                   logger.info("add q result: "+ counter );
//                   if(counter > 0)
//                      res.status(400).json({status:'error', error: "media add more than once"})
//                 }
//           }
//       try{
//             var newQuestion = new Question({
//                 user: req.signedCookies['user']._id, // Object ID which used for refering User Object
//                 title: req.body.title,
//                 body: req.body.body,
//                 tags: req.body.tags,
//                 media: media
//               })
//             var saveQuestion =  await newQuestion.save();
//             if(saveQuestion){
//               for(var i =0;  i < media.length; i++){
//                 var query = 'update media.bigfile set flag = ? where id = ?;';
//                  await client.execute(query, [ 'true',media[i]], {prepare: true});
//               }
//                 res.json({status:'OK', id: saveQuestion.id});
//               }
//             }catch(err){
//                 logger.error("Add question failed:" + err);
//                 res.status(400).send({ status: 'error', error: err });
//             }
//     }else{
//         logger.error("Need to log In to add question");
//         res.status(401).json({ status: 'error', error: 'need to login firstly to post a new question' });
//     }
// })

// // Get the question with the specified id
// app.get('/questions/:id', async function (req, res) {
//   var viewerID = req.ip;   // views are unique by authenticated users, and for unauthenciated ip
//   if (req.signedCookies['user']) // currrent logged user
//       viewerID =req.signedCookies['user'].id;
//     logger.info('Viewing question by viewerID' + viewerID);
//   try{
//       var getQuestion = await memcached.get(req.params.id);
//       if(getQuestion){
//         logger.info("get Questions from memcacehd successfully  with id : "+req.params.id);
//         res.json({ status: 'OK', question: getQuestions });
//        }else{
//           getQuestion = null;
//           getQuestion =  await Question.findOneAndUpdate({ id: req.params.id }, { $addToSet: { viewers: viewerID }} ,{ new: true })
//           if(getQuestion == null){
//             logger.info('did not find any question you want to update');
//             res.status(404).send({ status: 'error', error: 'did not find any question you want to update' });
//         }else{
//           var getUser =  await User.findById(getQuestion.user,'-_id username reputation');
//           var score = getQuestion.upvote.length - getQuestion.downvote.length;
//           var question = { id: getQuestion.id, user: { username: getUser.username, reputation: getUser.reputation }, title: getQuestion.title, body: getQuestion.body, score: score, view_count: getQuestion.viewers.length, answer_count: getQuestion.answers.length, timestamp: getQuestion.timestamp, media: getQuestion.media, tags: getQuestion.tags, accepted_answer_id: getQuestion.accepted_answer };
//             logger.info('The question you are viewing is-----> '+  question.id);
//             memcached.set(req.params.id, question, 300);
//             res.json({ status: 'OK', question: question });
//       }
//     }
//   }catch(err){
//         logger.error("Get question faield: " + err);
//         res.status(400).send({ status: 'error', error: err })
//     }
// })

// //   /***************************** Answers Router Parts ************************************/
// // Add one new answer to the question with the specified id
// app.post('/questions/:id/answers/add', async function (req, res) {
//   if(req.signedCookies['user']){
//     try{
//         var media = [];
//         if(req.body && req.body.media) // Media optional
//           {
//                 media = req.body.media;
//                 for(var i =0;  i < media.length; i++){
//                   var query = 'select id from media.bigfile where id = ? and flag = ? allow filtering;';
//                   var results = await client.execute(query, [media[i], 'true'], {prepare: true});
//                   // rowLength
//                   logger.info("rowLength --> " + results.rowLength)
//                   var counter = 0;
//                   for (var row of results)
//                     counter = counter+1
//                   logger.info("add q result: "+ counter );
//                   if(counter > 0)
//                      res.status(400).json({status:'error', error: "media add more than once"})
//                 }
//           }
//         var question_id = req.params.id
//         logger.info(' add one new answer to the question'+ question_id);
//         var newAnswer = new Answer({
//            question_id: question_id,
//            body: req.body.body,
//            user: req.signedCookies['user']._id,
//            media: media // optional
//         })
//         for(var i =0;  i < media.length; i++){
//           var query = 'update media.bigfile set flag = ? where id = ?;';
//            await client.execute(query, ['true', media[i]], {prepare: true});
//       }
//        var temp =  await Question.findOneAndUpdate({ id: question_id }, { $push: { answers: newAnswer._id } });
//        if(temp == null){
//           logger.error("You did not find any valid question to add one answer "+ req.params.id);
//           res.status(404).send({ status: 'error', error: 'You did not find any valid question to add one answer' })
//        }
//        await newAnswer.save();
//         res.json({ status: 'OK', id: newAnswer.id })
//       }catch(err){
//             logger.error('Failed to add answer for question: '+ questionId +"---> "+ err);
//             res.status(404).send({ status: 'error', error: err })
//         }
//     } else{
//       logger.error("you need to log in to add answer");
//       res.status(401).send({ status: 'error', error: 'you need to log in firstly to post a new answer' })
//     }
//   })

//  // // Get all answers of the question with the specified id
// app.get('/questions/:id/answers', async function (req, res) {
//   try{
//       var getAnswers = await memcached.get(req.params.id+'getA');
//       if(getAnswers){
//         logger.info("get Answers from memcacehd successfully  with id : "+req.params.id);
//         res.json({ status: 'OK', question: getAnswers });
//       }else{
//            getQuestion = await Question.findOne({ id: req.params.id }).populate({ path: 'answers' ,populate: { path: 'user', model: 'User'}}).exec();
//             if(getQuestion == null){
//               logger.info("there's without answers for questions with id: " + req.params.id);
//               res.status(404).send({ status: 'error', error: 'doc is none' })
//             }else{
//               getAnswers = getQuestion.answers;
//             let return_answers = [];
//             for (let i = 0; i < getAnswers.length; i++) {
//                 let ele_answer = { id: getAnswers[i].id, user: getAnswers[i].user.username, body: getAnswers[i].body, score: (getAnswers[i].upvote.length - getAnswers[i].downvote.length), is_accepted: getAnswers[i].is_accepted, timestamp: getAnswers[i].timestamp, media: getAnswers[i].media }
//                 return_answers.push(ele_answer);
//             }
//             memcached.set(req.params.id+'getA', return_answers, 300);
//             logger.info("get ansers: "+ return_answers.length);
//             res.json({ status: 'OK', answers: return_answers });
//           }
//       }
//     }catch(err) {
//       logger.error("Get answers from one question: " + JSON.stringify(err));
//         res.status(404).send({ status: 'error', error: err })
//       }
//   })

// // // Delete the question with the specified id
// app.delete('/questions/:id', async function (req, res) {
//     if (req.signedCookies['user']) {
//       try{   // Should only succeed deleting if logged in user is original asker
//         var getQuestion = await Question.findOneAndRemove({ id: req.params.id, user:req.signedCookies['user']._id }).populate('answer');
//         if(getQuestion == null){
//             logger.info("without content, cannot to delete the question: %s", req.params.id);
//             res.status(404).send({ status: 'error', error: 'without content, cannot to delete it or you do not have right to delete it' })
//         }else{ // remove related answers to media files
//           memcached.del(getQuestion.id);
//           var getAnswers = getQuestion.answers;  // get answers object related the deleted question
//           var getQuestionMedia = getQuestion.media;
//           var getAnswerMedia = getAnswers.media;
//           var query = 'delete from media.bigfile where id = ?;';
//           for(var i =0; i< getQuestionMedia.length; i++){
//              client.execute(query, [getQuestionMedia[i]], { prepare: true })
//           }
//           for(var i =0; i< getAnswerMedia.length; i++){
//             client.execute(query, [getAnswerMedia[i]], { prepare: true })
//          }
//          await Answer.deleteMany({ question_id: getQuestion.id});
//           res.status(200).send({ status: 'OK' })
//         }
//       }catch(err) {
//         console.log('find and remove question with error---> ' + JSON.stringify(err));
//         res.status(400).send({ status: 'error', error: err });
//     }
//     }else{
//         res.status(404).send({ status: 'error', error: 'you need to log in for deleting' });
//     }
//   })

// // //upvates or downvotes the question (in/decrements) score
// // app.post('/questions/:id/upvote', async (req, res) => {
// //     mySession = req.session
// //     if (mySession.username) {
// //         try{
// //             let questionId = req.param.id;
// //             let getQuestion = null;
// //             memcached.get(questionId, function(err, data){
// //                 if(data){
// //                     getQuestion = data;
// //                 }
// //             })
// //             logger.info("After memcacehd, question's id in upvote; %s", getQuestion.id);
// //             if(getQuestion == null){
// //                  getQuestion = Question.findOne({ id: questionId }).exec();
// //                 if(getQuestion == null){
// //                     logger.info("did not find question to be upvoted/downvoted");
// //                     res.status(404).send({ status: 'error', error: 'did not find question with id:  ' + req.params.id })
// //                 }else{
// //                     let up_down_op = 'downvote';
// //                     let opUsers = getQuestion.downvote;
// //                     if(req.body.upvote) {// default: true
// //                         up_down_bool = 'upvote';
// //                         opUsers = getQuestion.upvote;

// //                     }
// //                     let new_op = 'downvote' ;
// //                     if(opUsers.indexOf(mySession.user.id) > -1 ) {
// //                         if(up_down_bool == 'downvote'){
// //                             new_op = 'upvote';
// //                         }else if(getQuestion.upvote.length > getQuestion.downvote.length){
// //                              await Question.findOne({ id: req.params.id }, { $push: { new_op: mySession.user.id } , $pull: {up_down_bool: mySession.user.id}}).populate('user').exec();
// //                         }
// //                     }else{
// //                         if((up_down_bool =='downvote' && getQuestion.upvote.length > getQuestion.downvote.length)|| (up_down_bool =='upvote')){
// //                                 await Question.findOne({ id: req.params.id }, { $push: { up_down_bool: mySession.user.id }}).populate('user').exec();
// //                              }
// //                          }
// //                     }
// //                 res.json({ status: 'OK' })
// //             }
// //         }catch(err){
// //             logger.error(err);
// //             res.status(404).send({ status: 'error', error: err })
// //         }
// //     } else
// //       res.status(401).send({ status: 'error', error: 'you need to login firstly' })
// //   })


// // // Get all answers of the question with the specified id
// // router.get('/questions/:id/answers', async function (req, res) {
// //     try{
// //         let getQuestion = await Question.findOne({ id: req.params.id }).populate({ path: 'answer' }).exec();
// //         if(getQuestion)
// //         if(getQuestion == null){
// //             logger.info("there's without answers for questions with id: %s", req.params.id);
// //             res.status(400).send({ status: 'error', error: 'doc is none' })
// //         }else{
// //             let getAnswers = getQuestion.answers;
// //             let return_answers = [];
// //             for (let i = 0; i < getAnswers.length; i++) {
// //                 let ele_answer = { id: getAnswers[i].id, user: getAnswers[i].user.username, body: getAnswers[i].body, score: (getAnswers[i].upvote.length - getAnswers[i].downvote.length), is_accepted: getAnswers[i].is_accepted, timestamp: getAnswers[i].timestamp, media: getAnswers[i].media }
// //                 return_answers.push(ele_answer);
// //             }
// //             res.json({ status: 'OK', answers: return_answers });
// //         }
// //     }catch(err) {
// //         res.status(404).send({ status: 'error', error: err })
// //       }
// //   })

// // app.post('/search', function(req, res){
// //       // with default values
// //   var timestamp, limit, sort_by, has_media, accepted, query, tags
// //   if (req.body) {
// //     timestamp = req.body.timestamp // number
// //     limit = req.body.limit // number  >=25 && <=100
// //     sort_by = req.body.sort_by // string, default---> score
// //     has_media = req.body.has_media // boolean, default ---> false
// //     accepted = req.body.accepted // boolean, default ---> false
// //     query = req.body.q // string, support space
// //     tags = req.body.tags // array
// //   }
// //   // check constains and assign default values
// //   if (!timestamp) { timestamp = unixTime(new Date()) }
// //   if (!limit) { limit = 25 }
// //   if (limit > 100) { return res.status(400).send({ status: 'error', error: 'limit should be less than 100' }) }
// //   if (!sort_by) { sort_by = 'score' }
// //   if (has_media == null) { has_media = false }
// //   if (accepted == null) { accepted = false }

// //   console.log('limitation: timestamp-->%s, limit -->%s, query-->%s, sort_by-->%s, tags-->%s, has_media-->%s, accepted-->%s', timestamp,
// //     limit, query, sort_by, JSON.stringify(tags), has_media, accepted)
// //   // get all questions firstly
// //   Question.find({}).populate('user').exec(function (err, docs) {
// //     if (err) {
// //       res.status(400).send({ status: 'error', error: err })
// //     } else {
// //       var all_questions = docs

// //       console.log('all_questions: %d\n', all_questions.length)
// //       // filter by timestamp --> search questions from this time and earlier
// //       all_questions = all_questions.filter(question => (question.timestamp <= timestamp))
// //       console.log('after filtering by timestamp, questions---->%d\n', all_questions.length)
// //       // filter by has_media
// //       if (has_media) { all_questions = all_questions.filter(question => (question.media.length > 0)) }
// //       console.log('after filtering by has_media, questions---->%d\n', all_questions.length)
// //       // filter by accepted
// //       if (accepted) { all_questions = all_questions.filter(question => (question.accepted_answer != null)) }
// //       console.log('after filtering by accepted, questions---->%d\n', all_questions.length)
// //       // filter by tags
// //       if (tags && tags.length > 0) {
// //         all_qestions = all_questions.filter(question => ((question.tags).every(ele => tags.indexOf(ele) > -1)))
// //         console.log('after filtering by tags, questions---->%d\n', all_questions.length)
// //       }
// //       // filter by query
// //       if (query && query.length > 0) {
// //         query = query.toLowerCase()
// //         var words = query.split(' ')
// //         console.log('query words--->%s\n', JSON.stringify(words))
// //         // for (var i = 0; i < all_questions.length; i++) {
// //         //   console.log(all_questions[i].title + ' ' + all_questions[i].title.split(' ').some(ele => words.indexOf(ele) >= 0))
// //         //   console.log(all_questions[i].body + ' ' + all_questions[i].body.split(' ').some(ele => words.indexOf(ele) >= 0))
// //         // }
// //         all_questions = all_questions.filter(question => (question.title.toLowerCase().split(' ').some(ele => words.indexOf(ele) >= 0) || question.body.toLowerCase().split(' ').some(ele => words.indexOf(ele) >= 0)))
// //         console.log('after filtering by query, questions---->%s\n', JSON.stringify(all_questions))
// //       }
// //       if (all_questions.length > 0) {
// //         if (sort_by == 'score') {
// //           all_questions.sort((a, b) => ((a.upvote.length - a.downvote.length) - (b.upvote.length - b.downvote.length)))
// //         } else {
// //           all_questions.sort((a, b) => ((a.timestamp - b.timestamp)))
// //         }
// //         console.log('after sorting, questions---->%d\n', all_questions.length)
// //       }
// //       if (all_questions.length >= limit) {
// //         all_questions = all_questions.slice(0, limit)
// //         console.log('after slicing an array, questions---->%s\n', JSON.stringify(all_questions))
// //       }
// //       var return_questions = []
// //       for (var i = 0; i < all_questions.length; i++) {
// //         var ele = all_questions[i]
// //         var score = (ele.upvote.length - ele.downvote.length)
// //         var question = { id: ele.id, user: { username: ele.user.username, reputation: ele.user.reputation }, title: ele.title, body: ele.body, score: score, view_count: ele.viewers.length, answer_count: ele.answers.length, timestamp: ele.timestamp, media: ele.media, tags: ele.tags, accepted_answer_id: ele.accepted_answer }
// //         console.log('question------> %s\n', JSON.stringify(question))
// //         return_questions.push(question)
// //       }
// //       res.json({ status: 'OK', questions: return_questions })
// //     }
// //   })
// // })


// // /***************************** Answer Router Parts ************************************/

// // app.post('/answers/:id/upvote', async (req, res) => {
// //     mySession = req.session
// //     if (mySession.username) {
// //         try{
// //             let answerId = req.param.id;
// //             let getAnswers = null;
// //             memcached.get(answerId, function(err, data){
// //                 if(data){
// //                     getAnswer = data;
// //                 }
// //             })
// //             logger.info("After memcacehd, answer's id in upvote; %s", getQuestion.id);
// //             if(getAnswer == null){
// //                  getAnswer = Answer.findOne({ id: questionId }).exec();
// //                 if(getAnswer == null){
// //                     logger.info("did not find answer to be upvoted/downvoted");
// //                     res.status(404).send({ status: 'error', error: 'did not find answer with id:  ' + req.params.id })
// //                 }else{
// //                     let up_down_op = 'downvote';
// //                     let opUsers = getAnswer.downvote;
// //                     if(req.body.upvote) {// default: true
// //                         up_down_bool = 'upvote';
// //                         opUsers = getAnswer.upvote;

// //                     }
// //                     let new_op = 'downvote' ;
// //                     if(opUsers.indexOf(mySession.user.id) > -1 ) {
// //                         if(up_down_bool == 'downvote'){
// //                             new_op = 'upvote';
// //                         }else if(getAnswer.upvote.length > getAnswer.downvote.length){
// //                              await Answer.findOne({ id: req.params_id }, { $push: { new_op: mySession.user._id } , $pull: {up_down_bool: mySession.user.id}}).exec();
// //                         }
// //                     }else{
// //                         if((up_down_bool =='downvote' && getAnswer.upvote.length > getAnswer.downvote.length)|| (up_down_bool =='upvote')){
// //                                 await Question.findOne({ id: req.params.id }, { $push: { up_down_bool: mySession.user._id }}).exec();
// //                              }
// //                          }
// //                     }
// //                 res.json({ status: 'OK' })
// //             }
// //         }catch(err){
// //             logger.error(err);
// //             res.status(404).send({ status: 'error', error: err })
// //         }
// //     } else
// //       res.status(401).send({ status: 'error', error: 'you need to login firstly' })
// //   })

// // // Accept the answer with the specified id
//   app.post('/answers/:id/accept', async function (req, res) {
//     if (req.signedCookies['user']) {
//       try{
//           var getAnswer = await Answer.findOne({ id: req.params.id });
//         if (getAnswer == null || getAnswer.is_accepted)
//           res.status(409).json({ status: 'error', error: "there's without any asnwer with id: or anwer is accpted: " + req.params.id });
//         else{
//              var getQuestion =  memcached.get(getAnswer.question_id);
//              if(getQuestion == nulll)
//                 getQuestion = await Questions.findOne({ id: getAnswer.question_id }).populate('user').exec();
//              if(getQuestion == null || getQuestion.accepted_answer || getQuestion.user != req.signedCookies['user']._id)
//                 res.status(409).json({ status: 'error', error: "This question has been accepted or not poster" });
//              else{
//                 Question.updateOne({ id: getQuestion.id }, { $set: { accepted_answer: req.params.id } });
//                 await memcached.set(req.params.id, getQuestion, 300) // keep
//                 res.json({status: 'OK'});
//             }
//           }
//         }catch(err){
//           logger.error("accpet error: "+ JSON.stringify(err));
//           res.status(404).json({ status: 'error', error: err });
//         }
//     } else
//         res.status(401).send({ status: 'error', error: 'you need to login firstly' })      
// })

// // //Adds a media file
// app.post('/addmedia', async function (req, res) {
//   logger.info("Addmedia's cookie info: "+ JSON.stringify(req.signedCookies));
//   if(req.signedCookies['user']){
//       try{
//         var uploadfile = req.files.content;
//         //logger.info(JSON.stringify(uploadfile));
//         if(uploadfile == null)
//           throw new Error("empty file");
//         logger.info('Add media: filename:  '+ uploadfile['name'] + 'mimeType: '+ uploadfile['mimetype']);
//         var id  = shortId.generate() + uploadfile.name;
//         var query = ' INSERT INTO media.bigfile (id, extension, content) VALUES (?,?,?);';
//         await client.execute(query, [id, uploadfile.mimetype, uploadfile.data], { prepare: true });
//         logger.info("add medai's id: "+id);
//         res.json({status: 'OK', id: id});
//       }catch(err){
//         logger.error("Failed to add media: "+ err);
//         res.status(400).json({status:'error', error:err});
//       }
//   }else{
//     logger.error("you need to sign in for adding media");
//     res.status(401).json({status:'error', error:"you need to sign in for adding media"});
//     }
//   })
// //Gets the media file with specified id
// app.get('/media/:id', async function(req, res){
//   var id = req.params.id;
//   logger.info(id);
//   var query = 'select * from media.bigfile where id = ?;';
//   try{
//     var result = await client.execute(query, [id], { prepare: true });
//    if(result == null)
//         res.status('404').json({status:'error', error: "did not find the media file with id : "+ id });
//     var stream;
//     var extension;
//     for (var row of result) {
//       stream = row['content']
//       extension = row['extension'];
//     }
//     res.setHeader("Content-Type", extension);
//     res.send(stream);
//   }catch(err){
//     logger.error("failed to get media: "+ JSON.stringify(err));
//      res.status(400).json({status:"error", error: err});
//   }
// });
//***************************** Router Parts ************************************
app.listen(3000, 'localhost', () => logger.info('Listening to 3000'))
