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
    _id: {unique: true},
    username: { type: String, required: true, unique: [true, "user's username must be unique"] }, // username must be unique
    email: { type: String, required: true, unique: [[true, "user's email must be unique"]] }, // email must be uniqeu
    password: { type: String, required: true },
    reputation: { type: Number, default: 1},
    verify: { type: Boolean, default: false },
    key: { type: String, default: 'abracadabra' }
})
const User = mongoose.model('User', userSchema) // Create User module for the created schema

// Create & Define a schema for 'Answer'
const answerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, default: shortId.generate },
    question_id: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'}, // answer's poster's ObejctID
    body: { type: String, required: true },
    upvote: [ { type: String } ], // the id of user who did upvoting
    downvote: [ { type: String } ], // the id of user who did downting
    is_accepted: { type: Boolean, default: false },
    timestamp: { type: Number, default: unixTime(new Date()) },
    media: [ { type: String } ] // answer's media (array) ---save filename(media's id)
})
const Answer = mongoose.model('Answer', answerSchema) // Create Answer module for the created schema

const questionSchema = new mongoose.Schema({ // Create & Define a schema for 'Question'
    // default --- ObjectID
    id: { type: String, unique: [true, "question's id must be unique"], default: shortId.generate },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', autopopulate: true}, // question's poster
    title: { type: String, required: true },
    body: { type: String, required: true },
    tags: [ { type: String } ],
    media: [ { type: String } ], // media's id && default is []
    upvote: [ { type: String } ], // the id of the user who already upvoted
    downvote: [ { type: String } ], // the id of the user who already downvoted
    score:{ type: Number, default: 0},
    timestamp: { type: Number, default: unixTime(new Date()) },
    viewers: [ { type: String } ], // question's viewers(users)' id or ip address
    answers: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' } ],
    accepted_answer: { type: String, require: true, default: null } // answer's id
  });
questionSchema.index({ title: 'text', body: 'text'});
const Question = mongoose.model('Question', questionSchema)// Create Question module for the created schema

// Get all answers of the question with the specified id
app.get(['/','/index'], function (req, res) {
  memcached.flush(function (err, result) { // for clearing all cached data
     if (err) console.error(err)
     logger.error('flush: ' + result);
   })
   res.send('Welcome to my Mini-StackoverFlow homepage');
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
    await transporter.sendMail(mailOptions);
     res.json({ status: 'OK' });
   }catch(err){
       logger.error("Faield to add user: "+ err)
       res.status(400).json({ status: 'error', error: err});
   }
})

app.post('/verify', async function(req, res){
try{
     var verifyUser = await User.updateOne({ email: req.body.email, key: req.body.key }, { $set: { verify: true } });
     if(verifyUser.nModified > 0)
           res.json({ status: 'OK' })
     logger.info("you already verified it");
     res.status(400).json({ status: 'error', error: 'you did not modified anything!' }) // Bad Request
   }catch(err){
       logger.error("Verify faield:" + JSON.stringify(err));
       res.status(404).json({ status: 'error', error: err })
   }
})

app.post('/login', async function(req, res){
 logger.info("Get session in login"+ JSON.stringify(req.signedCookies['user']));
 try{
       var logged_user = await User.findOne({username: req.body.username, password: req.body.password, verify:true});
       if(logged_user == null){
           res.status(404).json({ status: 'error', error: 'no active user founded!' });
       }else{
            res.cookie('user', logged_user, { signed: true,  maxAge:  1800000 });
            res.json({status:'OK'});
       }
   }catch(err){
       logger.error("Faield to add user:"+ JSON.stringify(err));
       res.status(400).send({ status: 'error', error: err });
   }
})
app.post('/logout', function(req, res){
 logger.info('Session info in logout: '+ JSON.stringify(req.signedCookies['user']));
 try{
     res.clearCookie("user");
     res.json({ status: 'OK' })
   }catch(err){
     logger.error("Failed to logout: " + JSON.stringify(err));
     res.status(400).json("failed to log out: "+ JSON.stringify(err));
   }
})
// Get user profile info for user with 'username'
app.get('/user/:username', async function (req, res) {
  try{
    var getUser = await User.findOne({username: req.params.username });
    if(getUser == null){
          res.status(404).send({ status: 'error', error: 'did not find this user with name: ' + req.params.username })
      }
      res.json({ status: 'OK', user: { email: getUser.email, reputation: getUser.reputation } })
    }catch(err) {
      logger.error("failed to get user profile:  "+ JSON.stringify(err));
      res.status(400).send({ status: 'error', error: err })
    }
  })
// Get questions posted by user with 'username
app.get('/user/:username/questions', async function (req, res) {
  try{
      var getUser = await User.findOne({username: req.params.username});
      if(getUser == null){
            res.status(404).send({ status: 'error', error: 'did not find any user' })
       }
      var getQuestions = await Question.find({user: getUser._id}, '-_id id');
      logger.info("see: "+JSON.stringify(getQuestions));
      if(getQuestions == null)
          getQuestions = [];
      else
         getQuestions = getQuestions.map(a => a.id);
    res.json({ status: 'OK', questions: getQuestions });
    }catch(err){
        logger.error("failed to find one user's questions: "+ req.params.username );
        res.status(400).send({ status: 'error', error: err })
    }
  })

// // Get answers posted by user with 'username
app.get('/user/:username/answers', async function (req, res) {
  try{
    var getUser = await User.findOne({username: req.params.username});
       if(getUser == null){
          res.status(404).send({ status: 'error', error: 'did not find any user' })
       }
       var getAnswers = await Answer.find({user: getUser._id}, '-_id id');
        if(getAnswers == null)
            getAnswers = [];
        else
            getAnswers = getAnswers.map(a => a.id);
         res.json({ status: 'OK', answers: getAnswers });
  }catch(err){
      logger.error("failed to find one user's anwers: "+ req.params.username );
      res.status(400).send({ status: 'error', error: err })
  }
})


///***************************** Question Router Parts ************************************/
// app.post('/questions/add', async function (req, res) {
//   if(req.signedCookies['user']){
//     try{
//         var media = [];
//         if(req.body && req.body.media) // Media optional
//           {
//                 media = req.body.media;
//                 var query = 'select poster from  media.bigfile where id= ? and flag = ? allow filtering;';
//                 for(var i =0;  i < media.length; i++){
//                   let result = await client.execute(query, [media[i], 'true'], {prepare: true});
//                   logger.info(result.first());
//                   if((result.first()  == null)|| (result.first().poster != req.signedCookies['user'].id))
//                       throw new Error("Media already is selected or not the media's poster");
//                 }
//           }
//           var newQuestion = new Question({
//               user: req.signedCookies['user']._id, // Object ID which used for refering User Object
//               title: req.body.title,
//               body: req.body.body,
//               tags: req.body.tags,
//               media: media
//             })
//           var saveQuestion =  await newQuestion.save();
//           var query = 'update media.bigfile set flag = ? , poster = ? where id = ?;';
//           for(var i =0;  i < media.length; i++){
//               let result = await client.execute(query, [ 'true',req.signedCookies['user'].id], {prepare: true});
//               if(result.first()  == null)
//                 throw new Error("media does not exist");
//           }
//             res.json({status:'OK', id: saveQuestion.id});
//           }catch(err){
//               logger.error("Add question failed:" + JSON.stringify(err));
//               res.status(400).send({ status: 'error', error: err });
//           }
//     }else{
//       logger.error("Need to log In to add question");
//       res.status(401).json({ status: 'error', error: 'need to login firstly to post a new question' });
//   }
// })

// // Get the question with the specified id
// app.get('/questions/:id', function (req, res) {
//   var viewerID = req.ip;   // views are unique by authenticated users, and for unauthenciated ip
//   if (req.signedCookies['user']) // currrent logged user
//       viewerID =req.signedCookies['user'].id;
//     Question.findOneAndUpdate({ id: req.params.id }, { $addToSet: { viewers: viewerID }} ,{ new: true }).populate('user').exec(function (err, doc){
//       if(err)
//           res.status(400).send({ status: 'error', error: err })
//       if(doc == null)
//             res.status(404).send({ status: 'error', error: 'did not find any question you want to update' });
//           else{
//               var score = doc.upvote.length - doc.downvote.length;
//               var question = { id: doc.id, user: { username: doc.user.username, reputation: doc.user.reputation }, title: doc.title, body: doc.body, score: score, view_count: doc.viewers.length, answer_count: doc.answers.length, timestamp: doc.timestamp, media: doc.media, tags: doc.tags, accepted_answer_id: doc.accepted_answer };
//               logger.info('The question you are viewing is-----> '+  question.id +' score: '+ question.score, +'view: '+ question.view_count+ 'answer: '+ question.answer_count);
//             res.json({ status: 'OK', question: question });
//        }
//     })
// })


// // // Delete the question with the specified id
// app.delete('/questions/:id', async function (req, res) {
//   if (req.signedCookies['user']) {
//     try{   // Should only succeed deleting if logged in user is original asker
//       var getQuestion = await Question.findOneAndRemove({ id: req.params.id, user:req.signedCookies['user']._id }).populate('answer');
//       if(getQuestion == null){
//           res.status(404).send({ status: 'error', error: 'without content, cannot to delete it or you do not have right to delete it' })
//       }else{ // remove related answers to media files
//         var removeMedia = (getAnswers.media).concat(getQuestion.media);
//         logger.info("media ened to be remove: "+  JSON.stringify(removeMedia));
//         query = 'delete from media.bigfile where id = ?;';
//         client.execute(query, removeMedia, { prepare: true });
//         Answer.deleteMany({ question_id: getQuestion.id});
//         res.status(200).send({ status: 'OK' })
//       }
//     }catch(err) {
//       console.log('find and remove question with error---> ' + JSON.stringify(err));
//       res.status(400).send({ status: 'error', error: err });
//   }
//   }else{
//       res.status(404).send({ status: 'error', error: 'you need to log in for deleting' });
//   }
// })

// //   /***************************** Answers Router Parts ************************************/
// // Add one new answer to the question with the specified id
// app.post('/questions/:id/answers/add', async function (req, res) {
//   if(req.signedCookies['user']){
//     try{
//       var media = [];
//       if(req.body && req.body.media) // Media optional
//         {
//               media = req.body.media;
//               var query = 'select poster from  media.bigfile where id= ? and flag = ? allow filtering;';
//               for(var i =0;  i < media.length; i++){
//                 var results = await client.execute(query, [media[i], true], {prepare: true});
//                 logger.info(results.first());
//                 if((result.first()  == null)|| (result.first().poster != req.signedCookies['user'].id))
//                     throw new Error("Media already is selected or not the media's poster");
//               }
//         }
//         var newAnswer = new Answer({
//            question_id: question_id,
//            body: req.body.body,
//            user: req.signedCookies['user']._id,
//            media: media // optional
//         })
//        var temp =  await Question.findOneAndUpdate({ id: question_id }, { $push: { answers: newAnswer._id } });
//        if(temp == null){
//           res.status(404).send({ status: 'error', error: 'You did not find any valid question to add one answer' })
//        }
//        var query = 'update media.bigfile set flag = ? , poster = ? where id = ?;';
//        for(var i =0;  i < media.length; i++){
//            let result = await client.execute(query, [ 'true',req.signedCookies['user'].id], {prepare: true});
//            if(result.first()  == null)
//                 throw new Error("media does not exist");
//        }
//        await newAnswer.save();
//         res.json({ status: 'OK', id: newAnswer.id })
//       }catch(err){
//             logger.error('Failed to add answer for question: '+ questionId +"---> "+ JSON.stringify(err));
//             res.status(404).send({ status: 'error', error: err })
//         }
//     } else{
//       res.status(401).send({ status: 'error', error: 'you need to log in firstly to post a new answer' })
//     }
//   })

// //  // // Get all answers of the question with the specified id
// app.get('/questions/:id/answers', async function (req, res) {
//   try{
//       var getQuestion = await Question.findOne({ id: req.params.id }).populate({ path: 'answers' ,populate: { path: 'user', model: 'User'}}).exec();
//       if(getQuestion == null)
//            res.status(404).send({ status: 'error', error: 'doc is none' })
//       var getAnswers = getQuestion.answers;
//       var return_answers = [];
//       for (let i = 0; i < getAnswers.length; i++) {
//           let ele_answer = { id: getAnswers[i].id, user: getAnswers[i].user.username, body: getAnswers[i].body, score: (getAnswers[i].upvote.length - getAnswers[i].downvote.length), is_accepted: getAnswers[i].is_accepted, timestamp: getAnswers[i].timestamp, media: getAnswers[i].media }
//            return_answers.push(ele_answer);
//       }
//       logger.info("get ansers: "+ return_answers.length);
//       res.json({ status: 'OK', answers: return_answers });
//     }catch(err) {
//       logger.error("Get answers from one question: " + JSON.stringify(err));
//         res.status(404).send({ status: 'error', error: err })
//       }
//   })

//   app.post('/answers/:id/accept', async function (req, res) {
//     if (req.signedCookies['user'] ) {
//       try{
//           var getAnswer = await Answer.findOne({ id: req.params.id });
//           if (getAnswer == null || getAnswer.is_accepted)
//               res.status(409).json({ status: 'error', error: "there's without any asnwer with id: or anwer is accpted: " + req.params.id });
//           var getQuestion = await Questions.findOneAndUpdate({ id: getAnswer.question_id, accepted_answer: null, user: req.signedCookies['user']._id }, {new: true});
//           if(getQuestion == null)
//                 res.status(409).json({ status: 'error', error: "This question has been accepted or not poster" });
//             res.json({status: 'OK'});
//         }catch(err){
//           logger.error("accpet error: "+ JSON.stringify(err));
//           res.status(404).json({ status: 'error', error: err });
//         }
//     } else
//         res.status(401).send({ status: 'error', error: 'you need to login firstly' })      
// })
// //upvates or downvotes the question (in/decrements) score
// app.post('/questions/:id/upvote', async (req, res) => {
//   if (req.signedCookies['user'] ) {
//     try{
//           var id = req.param.id;
//           var user= req.signedCookies['user']
//           var getQuestion = await memcached.get(id+'getQ');
//           if(getQuestion != null){
//                   getQuestion = Question.findOne({ id: questionId });
//                   await memcached.set(id+'getQ', getQuestion, 180); // 3 minitues
//             }
//           if(getQuestion == null)
//               res.status(404).send({ status: 'error', error: 'did not find question with id:  ' + req.params.id })
//           var upvoteArr = getQuestion.upvote;
//           var downArr = getQuestion.downvote;
//           var upvote =req.body.upvote; // default : true
//           if(upvote){
//               if(upvoteArr.indexOf(user.id) > -1 &&  user.reputation>1 ){ // need to remove from  upvote, -1
//                   getQuestion = await Question.findOne({ id: req.params.id }, { $pull: {upvote: user.id}}, { $inc: {'user.reputation': -1}} , {new: true}).populate('user');
//                   res.json({status:'OK'});
//               }
//               if(upvoteArr.index(user.id) < 0){ // need to upvote  + 1
//                 getQuestion =  await Question.findOne({ id: req.params.id }, { $push: { upvote :user.id }},{ $inc: {'user.reputation': 1}} , {new: true}).populate('user');
//                 res.json({status:'OK'});
//               }
//           }else{ // upvote = false,---> downvote
//             if(downArr.indexOf(user.id) > -1 ){ // need to upvote + 1
//               getQuestion =  await Question.findOne({ id: req.params.id }, { $pull: {downArr: user.id}},{ $inc: {'user.reputation': 1}} , {new: true}).populate('user');
//                 res.json({status:'OK'});
//             }
//             if(downArr.index(user.id) < 0 && user.reputation > 1) {// need to downvote; - 1
//                 await Question.findOne({ id: req.params.id }, { $push: { downArr :user.id }},{ $inc: {'user.reputation': -1}} , {new: true}).populate('user');
//                 res.json({status:'OK'});
//             }
//           }
//             memcached.set(req.params.id+'getQ', getQuestion, 180);
//         }catch(err){
//             logger.error("question upvote error: " +err);
//             res.status(404).send({ status: 'error', error: err })
//         }
//     } else
//       res.status(401).send({ status: 'error', error: 'you need to login firstly' })
//   })


// app.post('/search', function(req, res){
//       // with default values
//   var timestamp, limit, sort_by, has_media, accepted, query, tags
//   if (req.body) {
//     timestamp = req.body.timestamp // number
//     limit = req.body.limit // number  >=25 && <=100
//     sort_by = req.body.sort_by // string, default---> score
//     has_media = req.body.has_media // boolean, default ---> false
//     accepted = req.body.accepted // boolean, default ---> false
//     query = req.body.q // string, support space
//     tags = req.body.tags // array
//   }
//   // check constains and assign default values
//   if (!timestamp) { timestamp = unixTime(new Date()) }
//   if (!limit) { limit = 25 }
//   if (limit > 100) { return res.status(400).send({ status: 'error', error: 'limit should be less than 100' }) }
//   if(!tags) tags = [];
//   if (!sort_by) { sort_by = 'score' }
//   if (has_media == null) { has_media = false }
//   if (accepted == null) { accepted = false }
//   logger.info('limitation: timestamp-->%s, limit -->%s, query-->%s, sort_by-->%s, tags-->%s, has_media-->%s, accepted-->%s', timestamp,
//     limit, query, sort_by, JSON.stringify(tags), has_media, accepted, tags);
//     var query_m =[{'timestamp': { "$lte": timestamp}},{"tags": {"$elemMatch": tags}} ];
//     if(has_media)
//         query_m.push({"media.0": { "$exists": true }});
//     if(accepted)
//         query_m .push({"accepted_answer":  { $exists: true }});
//     if (query && query.length > 0) {
//        query = query.toLowerCase()
//       var words = '/'+query.replace(' ','|')+'/i';
//       logger.info("my query words: "+ words);
//       query_m.push({"$text": {"$search": words}});
//     }

//       logger.info("Final query string: " + query_m);
//       await  Question.find(query_m).limit(limit).sort({ score: -1 });

//       var return_questions = []
//       for (var i = 0; i < all_questions.length; i++) {
//         var ele = all_questions[i]
//         var question = { id: ele.id, user: { username: ele.user.username, reputation: ele.user.reputation }, title: ele.title, body: ele.body, score: ele.score, view_count: ele.viewers.length, answer_count: ele.answers.length, timestamp: ele.timestamp, media: ele.media, tags: ele.tags, accepted_answer_id: ele.accepted_answer }
//         return_questions.push(question)
//       }
//       logger.info('question------> '+ JSON.stringify(question))
//       res.json({ status: 'OK', questions: return_questions })
// })
// // /***************************** Answer Router Parts ************************************/
// app.post('/answers/:id/upvote', async (req, res) => {
//   if (req.signedCookies['user'] ) {
//     try{
//           var id = req.param.id;
//           var user= req.signedCookies['user']
//           var getAnswer = await memcached.get(id+'getA');
//           if(getAnswer != null){
//                   getAnswer = Answer.findOne({ id: id });
//                   await memcached.set(id+'getA', getAnswer, 180); // 3 minitues
//             }
//           if(getAnswer == null)
//               res.status(404).send({ status: 'error', error: 'did not find answer with id:  ' + id })
//           var upvoteArr = getAnswer.upvote;
//           var downArr = getAnswer.downvote;
//           var upvote =req.body.upvote; // default : true
//           if(upvote){
//               if(upvoteArr.indexOf(user.id) > -1 &&  user.reputation>1 ){ // need to remove from  upvote, -1
//                   getAnswer = await Answer.findOne({ id: req.params.id }, { $pull: {upvote: user.id}}, { $inc: {'user.reputation': -1}} , {new: true}).populate('user');
//                   res.json({status:'OK'});
//               }
//               if(upvoteArr.index(user.id) < 0){ // need to upvote  + 1
//                 getAnswer =  await Answer.findOne({ id: req.params.id }, { $push: { upvote :user.id }},{ $inc: {'user.reputation': 1}} , {new: true}).populate('user');
//                 res.json({status:'OK'});
//               }
//           }else{ // upvote = false,---> downvote
//             if(downArr.indexOf(user.id) > -1 ){ // need to upvote + 1
//               getAnswer =  await Answer.findOne({ id: req.params.id }, { $pull: {downArr: user.id}},{ $inc: {'user.reputation': 1}} , {new: true}).populate('user');
//                 res.json({status:'OK'});
//             }
//             if(downArr.index(user.id) < 0 && user.reputation > 1) {// need to downvote; - 1
//                 await Answer.findOne({ id: req.params.id }, { $push: { downArr :user.id }},{ $inc: {'user.reputation': -1}} , {new: true}).populate('user');
//                 res.json({status:'OK'});
//             }
//           }
//             memcached.set(req.params.id+'getA', getAnswer, 180);
//         }catch(err){
//             logger.error("question upvote error: " +err);
//             res.status(404).send({ status: 'error', error: err })
//         }
//     } else
//       res.status(401).send({ status: 'error', error: 'you need to login firstly' })
//   })


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
