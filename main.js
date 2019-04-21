const express = require('express')
// for serving static files lately
const path = require('path')
// for html parsing
const bodyParser = require('body-parser')
// for html parsing & uploading files
const multer = require('multer')
// for managing files system, like delete, read, write and so on
const fs = require('fs')
// for connecting MongoDB --- using mongoose
// MongoDB ---- Object-based NoSQL
const mongoose = require('mongoose')
// Generate id for the fields in the db
const shortId = require('shortid')
// for sending key to email
const nodemailer = require('nodemailer')
// for supporting cookies
const session = require('express-session')
// convert data to unix time
var unixTime = require('unix-time')

// Create an Application based on ExpressJS
const app = express()

/** ***************************** Connect to MongoDB -- mongoose ********************/
// Get Mongoose to use the gloabl promise library
mongoose.Promise = global.Promise
// set up default mongoose connection -- localhost/ 127.0.0.1
// mongoose.connect('mongodb://localhost:27017/project', { useNewUrlParser: true, useCreateIndex: true })
mongoose.connect('mongodb://64.52.86.95:27017/personal', { useNewUrlParser: true, useCreateIndex: true })

/** ****************************** Application Configuration PARTS ******************************/
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json()) // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
  extended: true
}))

// for redenering html files in dynamic way
app.set('view engine', 'ejs')
// for getting ip for couting views for questions
app.set('trust proxy')
// Configure the dir for keeping media files
// the dir used to keeping uploaded files
const upload_dir = path.join(__dirname + '/uploads/')
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, upload_dir)
  },
  filename: function (req, file, cb) {
    cb(null, shortId.generate() + ' ' + file.originalname)
  }
})
var upload = multer({ storage: storage })
// configuration about cookies
app.use(session({
  secret: 'cheryl',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 600000 }
}))

/** ******************************************** Database settings *********************************************/
// Create & Define a schema for 'User'
// User -- Question: one to many
// User -- Answer : one to many
const userSchema = new mongoose.Schema({
  // default --- ObjectID
  id: { type: String, unique: [true, "user's id must be unique"], default: shortId.generate },
  username: { type: String, required: true, unique: [true, 'username must be unique'] }, // username must be unique
  email: { type: String, required: true, unique: [true, 'email must be unique'] }, // email must be uniqeu
  password: { type: String, required: true },
  reputation: { type: Number, default: 1 },
  verify: { type: Boolean, default: false },
  key: { type: String, default: 'abracadabra' }
})
// Create User module for the created schema
const User = mongoose.model('User', userSchema)

// Create & Define a schema for 'Answer'
// Question -- Answer : one to many
const answerSchema = new mongoose.Schema({
  // default --- ObjectID
  id: { type: String, required: true, unique: [true, "answer's id must be unique"], default: shortId.generate },
  question_id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  body: { type: String, required: true },
  upvote: [ { type: String } ], // user's id
  downvote: [ { type: String } ], // user's id
  is_accepted: { type: Boolean, default: false },
  timestamp: { type: Number, default: unixTime(new Date()) },
  media: [ { type: String } ] // answer's media (array) ---save filename(media's id)
})
// Create Answer module for the created schema
const Answer = mongoose.model('Answer', answerSchema)

// Create & Define a schema for 'Question'
const questionSchema = new mongoose.Schema({
  // default --- ObjectID
  id: { type: String, unique: [true, "question's id must be unique"], default: shortId.generate },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // question's poster
  title: { type: String, required: true },
  body: { type: String, required: true },
  tags: [ { type: String } ],
  media: [ { type: String } ], // media's id && default is []
  upvote: [ { type: String } ], // the id of the user who already upvoted
  downvote: [ { type: String } ], // the id of the user who already downvoted
  timestamp: { type: Number, default: unixTime(new Date()) },
  viewers: [ { type: String } ], // question's viewers(users)' id or ip address
  answers: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' } ],
  accepted_answer: { type: String, require: true, default: null } // answer's id
})
// Create Question module for the created schema
const Question = mongoose.model('Question', questionSchema)

/** *************************** Use nodemailer for verfying email ********************/
var smtpTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cherylpub2019@gmail.com', // your gmail
    pass: 'cheryl630test' // your password
  }
})

/** *********************************** Global variable & helper methods ************************************/
var mailOptions, host, link // for sending mail
var mySession // for cookie-based system
var backdoor = 'abracadabra' // backdoor key for verifying user account

/** ************************************* GET && POST methods ************************************/
app.get(['/', '/index'], (req, res) => {
  res.send('Welcome, This is my homepage for CSE356 Stackover Flow Clone')
})
/**
  * /adduser ----POST
  * user&email must be unique
**/
app.post('/adduser', (req, res) => {
  // Instantiate one user object with json data
  var newUser = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  })

  // send email with the backdoor key
  host = req.get('host')
  link = 'http://' + host + '/verify?email=' + req.body.email + '&key=' + backdoor
  console.log('in /adduser ---> The link is: %s\n', link)
  mailOptions = {
    to: req.body.email,
    subject: 'Email Confirmation',
    text: 'validation key: <' + backdoor + '>',
    html: '<h3>The validation key: &lt;' + backdoor + '&gt; <br> The link is:  <a href=' + link + '>Click here to verify, please</a> </h3>'
  }

  smtpTransport.sendMail(mailOptions, function (error, response) {
    if (error) {
      console.log('in /adduser ---> failed to send mail: %s\n', JSON.stringify(error))
      res.status(400).send({ status: 'error', error: JSON.stringify(error) })
    }

  })
  // save the new user instance to db
  newUser.save().then(item => {
    // send email with the key
    console.log('create a new disabled uesr successfully!---> %s\n', JSON.stringify(newUser))
    res.json({ status: 'OK' })
  }).catch(err => {
    console.log('fail to create a new disabled uesr!---> %s\n', JSON.stringify(err))
    res.status(400).send({ status: 'error', error: err })
  })
})

/**
  * Verify the created user ----POST
**/
app.post('/verify', (req, res) => {
  // my backdoorkey : abracadabra
  console.log('email---> %s, key----> %s\n', req.body.email, req.body.key)
  User.updateOne({ email: req.body.email, key: req.body.key }, { $set: { verify: true } })
    .then((doc) => {
      console.log(' /verify after updating--> doc: %s\n', JSON.stringify(doc))
      // modified the user
      if (doc.nModified > 0) {
        res.json({ status: 'OK' })
      } else {
        res.status(404).send({ status: 'error', error: 'you did not modified anything!' })
      }
    }).catch((err) => {
      res.status(400).send({ status: 'error', error: err })
    })
})
/**
  * Login to account & start the session  /login---POST
**/
app.post('/login', async (req, res) => {
  console.log('mySession in login---POST: %s\n', JSON.stringify(req.session))
  await User.findOne({
    username: req.body.username,
    password: req.body.password,
    verify: 'true'
  }).exec(function (err, doc) {
    if (err) { res.status(400).send({ status: 'error', error: err }) } else {
      if (doc == null) {
        console.log('no active user is founded')
        res.status(404).send({ status: 'error', error: 'no active user founded!' })
      } else {
        req.session.username = req.body.username
        req.session.user = doc
        req.session.save()
        console.log('new session data--> ' + JSON.stringify(req.session))
        res.json({ status: 'OK' })
      }
    }
  })
})
/**
  * Logout  /logout----POST
**/
app.post('/logout', (req, res) => {
  req.session.destroy(function (err) {
    if (err) {
      return res.status(400).send({ status: 'error', error: err })
    }
  })
  // }
  res.json({ status: 'OK' })
})
/** ************************************** Main(Questions/Answers) Parts **************************************/
/**
  * /questions/add ----POST
**/
app.post('/questions/add', (req, res) => {
  mySession = req.session
  console.log('mySession in add---POST: %s\n', JSON.stringify(mySession))
  if (mySession.username) { // current logged in user
    var media = []
    if (req.body && req.body.media) {
      media = req.body.media
    }

    var newQuestion = new Question({
      user: mySession.user._id, // Object ID which used for refering User Object
      title: req.body.title,
      body: req.body.body,
      tags: req.body.tags,
      media: media
    })
    console.log('Post one new Question ---> %s \n', newQuestion)

    newQuestion.save().then(item => {
      res.json({ status: 'OK', id: newQuestion.id })
    }).catch(err => {
      res.status(400).send({ status: 'error', error: err })
    })
  } else {
    // Need to login firstly
    console.log('need to login in')
    res.status(401).send({ status: 'error', error: 'need to login firstly to post a new question' })
  }
})
/**
 * /questions/{id}----POST
**/
app.get('/questions/:id', (req, res) => {
  mySession = req.session
  var viewerID
  // views are unique by authenticated users, and for unauthenciated ip
  if (mySession.username) { // currrent logged user
    viewerID = mySession.user.id
  } else {
    viewerID = req.ip
  }
  console.log('Viewing question by viewerID-----> %s\n', viewerID)
  // $addToSet --avoid duplicated to add data in array
  Question.findOneAndUpdate({ id: req.params.id }, { $addToSet: { viewers: viewerID } }, { new: true }).populate('user').exec(function (err, doc) {
    if (err) {
      res.status(400).send({ status: 'error', error: err })
    } else { // Find the question
      if (doc == null) {
        res.status(404).send({ status: 'error', error: 'did not find any question you want to update-- doc is null' })
      } else {
        console.log('get question detail info----> %s\n', JSON.stringify(doc))
        var score = doc.upvote.length - doc.downvote.length
        var question = { id: doc.id, user: { username: doc.user.username, reputation: doc.user.reputation }, title: doc.title, body: doc.body, score: score, view_count: doc.viewers.length, answer_count: doc.answers.length, timestamp: doc.timestamp, media: doc.media, tags: doc.tags, accepted_answer_id: doc.accepted_answer }
        console.log('The question you are viewing is-----> %s\n', JSON.stringify(question))
        res.json({ status: 'OK', question: question })
      }
    }
  })
})
/*
*  Delete Question -- POST
*/
app.delete('/questions/:id', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    // Should only succeed deleting if logged in user is original asker
    Question.findOneAndRemove({ id: req.params.id }).populate('answer').exec(function (err, doc) {
      if (err) {
        console.log('find and remove question with error---> %s\n', JSON.stringify(err))
        res.status(400).send({ status: 'error', error: err })
      } else {
        if (doc == null) { // there's nothing to delte
          res.status(404).send({ status: 'error', error: 'without content, cannot to delete it' })
        } else {
          if (!(doc.user).equals(mySession.user._id)) {
            res.status(401).send({ status: 'error', error: 'you are not the original asker of the question, cannot to delete it' })
          } else {
            // Remove related media files for answers
            var answers = doc.answers // get answers object related the deleted question
            console.log('answers--->%s\n', JSON.stringify(asnwers))
            if (answers.length > 0) { // remove answers
              // loop each answer
              for (var i = 0; i < answers.length; i++) {
                // loop each media of one answer
                var answer_media = answers[i].media
                for (var j = 0; j < answer_media.length; j++) {
                  var answers_mediaPath = path.join(upload_dir, answer_media[j])
                  console.log('answers_mediaPath-----> %s\n', answers_mediaPath)
                  // remove media file
                  fs.unlinkSync(answers_mediaPath, function (remove_err) {
                    if (remove_err) {
                      return res.status(404).send({ status: 'error', error: remove_err })
                    }
                  })
                }
              }
            }

            // Remove related media files for question
            var media = doc.media // mediaID
            if (media.length > 0) {
              for (var i = 0; i < media.length; i++) {
                var mediaPath = path.join(upload_dir, media[i])
                console.log('mediaPath------> %s ; ', mediaPath)
                fs.unlinkSync(mediaPath, function (remove_err) {
                  if (remove_err) { return res.status(400).send({ status: 'error', error: remove_err }) }
                })
              }
            }
            Answer.remove({ _id: { $in: answers } }, (err_1, data) => {
              if (err_1) {
                return res.status(400).send({ status: 'error', error: err_1 })
              }
            })
            res.status(200).send({ status: 'OK' })
          }
        }
      }
    })
  } else {
    res.status(401).send({ status: 'error', error: 'to delete the question, you need to login firstly' })
  }
})

/** *************************************************** Answers Parts **************************************/
/*
 * add answer for specified question ---POST
*/
app.post('/questions/:id/answers/add', (req, res) => {
  mySession = req.session
  if (mySession.username) { // logged user
    var question_id = req.params.id
    console.log(' add one new answer to the question --->%s\n', question_id)
    var newAnswer = new Answer({
      question_id: question_id,
      body: req.body.body,
      user: mySession.user._id,
      media: req.body.media // optional
    })

    newAnswer.save().then(item => {
      console.log('Save a answer successfully! ----> %s\n', item)
    }).catch(err => {
      res.status(400).send({ status: 'error', error: err })
    })

    Question.findOneAndUpdate({ id: question_id }, { $addToSet: { answers: newAnswer._id } }).exec(function (err, doc) {
      if (err || doc == null) {
        // remove just created answer
        Answer.findOneAndRemove({ id: newAnswer.id }, function (err_1) {
          if (err_1) {
            console.log('faile to remove answer----> %s\n', JSON.stringify(err_1))
          }
        })
        if (err) { console.log('error --->%s\n', JSON.stringify(err)) }
        res.status(400).send({ status: 'error', error: 'faile to add new answer to the question' })
      } else {
        // Find the question adn update
        res.json({ status: 'OK', id: newAnswer.id })
      }
    })
  } else {
    res.status(401).send({ status: 'error', error: 'you need to log in firstly to post a new answer' })
  }
})

/**
* /questions/{id}/answers --- GET
**/
app.get('/questions/:id/answers', (req, res) => {
  console.log('get all asnwers of the question------>%s\n', req.params.id)
  Question.findOne({ id: req.params.id }).exec(function (err, doc) {
    if (err) {
      res.status(400).send({ status: 'error', error: err })
    } else {
      if (doc == null) { // did not find the question
        res.status(404).send({ status: 'error', error: 'doc is none' })
      } else {
        // find the question with specified id
        var answersObj = doc.answers// array of asnwers's _id
        console.log('answersObj------> %s\n', JSON.stringify(answersObj))
        Answer.find({ '_id': { $in: answersObj } }).populate({ path: 'user' }).exec(function (err_1, docs) {
          if (err_1) {
            console.log('failed to find users\n')
            res.status(400).send({ status: 'error', error: err_1 })
          } else {
            var return_answers = []
            for (var i = 0; i < docs.length; i++) {
              //   console.log(JSON.stringify(docs[i]))
              var ele_answer = { id: docs[i].id, user: docs[i].user.username, body: docs[i].body, score: (docs[i].upvote.length - docs[i].downvote.length), is_accepted: docs[i].is_accepted, timestamp: docs[i].timestamp, media: docs[i].media }
              return_answers.push(ele_answer)
            }
            res.json({ status: 'OK', answers: return_answers })
          }
        })
      }
    }
  })
})
/*
  * Gets a list of the lastest {limit } number of questions prior to (and including) the provided (timestamp)
*/
app.post('/search', (req, res) => {
  // with default values
  var timestamp, limit, sort_by, has_media, accepted, query, tags
  if (req.body) {
    timestamp = req.body.timestamp // number
    limit = req.body.limit // number  >=25 && <=100
    sort_by = req.body.sort_by // string, default---> score
    has_media = req.body.has_media // boolean, default ---> false
    accepted = req.body.accepted // boolean, default ---> false
    query = req.body.q // string, support space
    tags = req.body.tags // array
  }
  // check constains and assign default values
  if (!timestamp) { timestamp = unixTime(new Date()) }
  if (!limit) { limit = 25 }
  if (limit > 100) { return res.status(400).send({ status: 'error', error: 'limit should be less than 100' }) }
  if (!sort_by) { sort_by = 'score' }
  if (has_media == null) { has_media = false }
  if (accepted == null) { accepted = false }

  console.log('limitation: timestamp-->%s, limit -->%s, query-->%s, sort_by-->%s, tags-->%s, has_media-->%s, accepted-->%s', timestamp,
    limit, query, sort_by, JSON.stringify(tags), has_media, accepted)
  // get all questions firstly
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
/*
  * upvates or downvotes the question (in/decrements) score
*/
app.post('/questions/:id/upvote', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    Question.findOne({ id: req.params.id }).exec(function (err, doc) {
      if (err) {
        res.status(400).send({ status: 'error', error: err })
      } else {
        if (doc == null) {
          res.status(404).send({ status: 'error', error: 'did not find question with id:  ' + req.params.id })
        } else {
          // get a question
          var upvote = req.body.upvote
          var up_down_arr = doc.upvote
          var field_op = 'upvote'
          var new_op = 'downvote'
          if (upvote == false) {
            up_down_arr = doc.downvote
            field_op = 'downvote'
            new_op = 'upvote'
          }
          if (up_down_arr.indexOf(mySession.user.id) > -1) {
            // already upvoted or downvoted, need to downvoted or upvoted
            Question.findOne({ id: req.params.id }, { $push: { new_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.status(400).send({ status: 'error', error: err_1 })
              }
            })

            Question.findOne({ id: req.params.id }, { $pull: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.status(400).send({ status: 'error', error: JSON.stringify(err_1) })
              }
            })
          } else {
            // need to upvote or downvote
            Question.findOne({ id: req.params.id }, { $push: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.status(400).send({ status: 'error', error: err_1 })
              }
            })
          }
          res.json({ status: 'OK' })
        }
      }
    })
  } else {
    res.status(401).send({ status: 'error', error: 'you need to login firstly' })
  }
})
/*
  * upvotes or downvotes the answers (in/decrements) score
*/
app.post('/answers/:id/upvote', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    Answer.findOne({ id: req.params.id }).exec(function (err, doc) {
      if (err) {
        res.status(400).send({ status: 'error', error: err })
      } else {
        if (doc == null) {
          res.status(404).send({ status: 'error', error: 'did not find answer with id:  ' + req.params.id })
        } else {
          // get an answer
          var upvote = req.body.upvote
          var up_down_arr = doc.upvote
          var field_op = 'upvote'
          var new_op = 'downvote'
          if (upvote == false) {
            up_down_arr = doc.downvote
            field_op = 'downvote'
            new_op = 'upvote'
          }
          if (up_down_arr.indexOf(mySession.user.id) > -1) {
            // already upvoted or downvoted, need to downvoted or upvoted
            Answer.findOne({ id: req.params.id }, { $push: { new_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.status(400).send({ status: 'error', error: err_1 })
              }
            })

            Answer.findOne({ id: req.params.id }, { $pull: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.status(400).send({ status: 'error', error: JSON.stringify(err_1) })
              }
            })
          } else {
            // need to upvote or downvote
            Answer.findOne({ id: req.params.id }, { $push: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.status(400).send({ status: 'error', error: err_1 })
              }
            })
          }
          res.json({ status: 'OK' })
        }
      }
    })
  } else {
    res.status(401).send({ status: 'error', error: 'you need to login firstly' })
  }
})

/*
  * accepts an answer
  * if there's accepted answer for the question, it's error
  * should only succeed if logged in user is original asker of associated question
*/
app.get('/answers/:id/accept', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    Answer.findOne({ id: req.params.id }).populate('user').exec(function (err, doc) {
      if (err) {
        res.status(400).send({ status: 'error', error: err })
      } else {
        if (doc == null) {
          res.status(404).send({ status: 'error', error: "there's without any asnwer with id: " + req.params.id })
        } else {
          // find the answer
          // Haofeng: Check whether if we should move this check to some where else
          if (doc.is_accepted) {
            res.status(409).send({ status: 'error', error: "there's one accepted answer" })
          }
          // find a question related to the answer
          var question_id = doc.question_id
          Questions.findOne({ id: question_id }).populate('user').exec(function (err_1, doc_1) {
            if (err_1) {
              res.status(400).send({ status: 'error', error: err_1 })
            }
            if (doc_1.user.username == mySession.username) {
              // orginal asker of the question
              // Haofeng: Modified at 4/21 Need to CHECK
              if (!doc_1.accepted_answer) {
                Question.updateOne({ id: doc_1.id }, { $set: { accepted_answer: req.params.id } })
                .then((doc_2) => {
                  Answer.updateOne({ id: req.params.id }, { $set: { is_accepted: true } })
                  .then((doc_3) => {
                    res.json({ status: 'OK' })
                  }).catch((err_3) => {
                    res.status(400).send({ status: 'error', error: err_2 })
                  })
                }).catch((err_2) => {
                  res.status(400).send({ status: 'error', error: err_2 })
                })
              }
            } else {
              res.status(401).send({ status: 'error', error: 'you are not the original asker of the question' })
            }
          })
        }
      }
    })
  } else {
    res.status(401).send({ status: 'error', error: 'you need to login firstly' })
  }
})

/** ***************************************** Media **************************************/
/*
  * type is multipart/form-data
*/
app.post('/addmedia', upload.single('content'), (req, res) => {
  mySession = req.session
  if (mySession.username) {
    if (req.file) {
      console.log(JSON.stringify(req.file))
      console.log('filename: %s\n', req.file.filename)
      res.json({ status: 'OK', id: req.file.filename }) // filename = shortId + originalname
    } else {
      res.status(400).send({ status: 'error', error: 'Error in uploading file' })
    }
  } else {
    res.status(400).send({ status: 'error', error: 'Need to login firstly to upload a new file' })
  }
})

/*
  * type is multipart/form-data
*/
app.get('/media/:id', (req, res) => {
  var mimeTypes = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpg',
    png: 'image/png',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg'
  }
  mySession = req.session
  if (mySession.username) {
    var mediaID = req.params.id // filename
    console.log('media ID is---> %s\n', mediaID)
    var file_path = path.join(__dirname, '/uploads/' + mediaID)
    fs.readFile(file_path, { encoding: 'utf-8' }, function (err, data) { // in binary
      if (err) {
        res.status(400).send({ status: 'error', error: err })
      } else { // find one file
        var original = mediaID.split(' ')[1]
        var extension = original.split('.')[1]
        console.log('extension----->%s\n', extension)
        if (extension in mimeTypes) { res.writeHead(200, { 'Content-Type': mimeTypes[extension] }) }
        res.end(data)
      }
    })
  } else {
    res.status(401).send({ status: 'error', error: 'Need to login firstly to get all media files' })
  }
})

/** ************************************* User parts****************************************/
/*
 * Get user profile information for user with {username}
 */
app.get('/user/:username', (req, res) => {
  mySession = req.session
  // if (mySession.username && (mySession.username == req.params.username)) {
  User.findOne({
    username: req.params.username
  }).then((doc) => {
    if (doc == null) {
      res.status(404).send({ status: 'error', error: 'did not find this user with name: ' + req.params.username })
    } else {
      res.json({ status: 'OK', user: { email: doc.email, reputation: doc.reputation } })
    }
  }).catch((err) => {
    res.status(400).send({ status: 'error', error: err })
  })
  // } else {
  //   res.json({ status: 'error', error: 'need to log in' })
  // }
})

/*
 * Get questions posted by user with {username}
 */
app.get('/user/:username/questions', (req, res) => {
  // mySession = req.session
  // if (mySession.username && (mySession.username == req.params.username)) {
  User.findOne({ username: req.params.username }).exec(function (err, doc) {
    if (err) { res.status(400).send({ status: 'error', error: err }) } else {
      if (doc == null) {
        res.status(404).send({ status: 'error', error: 'did not find any user' })
      } else {
        Question.find({ user: doc._id }).populate('user').exec(function (err_1, docs) {
          if (err) {
            res.status(400).send({ status: 'error', error: err })
          } else {
            var questions = []
            docs.forEach(function (ele, index) {
              questions.push(ele.id)
            })
            console.log('%s has questions: %s\n', doc.username, questions)
            res.json({ status: 'OK', questions: questions })
          }
        })
      }
    }
  })
  // } else {
  //   res.json({ status: 'error', error: 'need to log in' })
  // }
})

/*
 * Get answers posted by user with {username}
 */
app.get('/user/:username/answers', (req, res) => {
  // mySession = req.session
  // if (mySession.username && (mySession.username == req.params.username)) {
  User.findOne({ username: req.params.username }).exec(function (err, doc) {
    if (err) { res.status(400).send({ status: 'error', error: err }) } else {
      if (doc == null) {
        res.status(404).send({ status: 'error', error: 'did not find any user' })
      } else {
        Answer.find({ user: doc._id }).populate('user').exec(function (err_1, docs) {
          if (err) {
            res.status(400).send({ status: 'error', error: err })
          } else {
            var answers = []
            docs.forEach(function (ele, index) {
              answers.push(ele.id)
            })
            console.log('%s has answers: %s\n', doc.username, answers)
            res.json({ status: 'OK', answers: answers })
          }
        })
      }
    }
  })
  // } else {
  //   res.json({ status: 'error', error: 'need to log in' })
  // }
})

app.listen(80, '0.0.0.0', () => console.log('Listening to 80'))
// app.listen(3000, 'localhost', () => console.log('Listening to 3000 on localhost'))
