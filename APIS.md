### Basic API descriptiop

_**Updated:** For all requests that return "status: error" set the response status code to 4xx. ._

---

#### /adduser ---- POST
	- Request Params
		- username: string
		- email: string
		- password: string
	- Description
		- Register new disabled user account
		- username and email must be unique
		- send email w/ verification key
	- Return(JSON)
		- status:'OK'
		- if error: status:'error', error:'...'

#### /login ---- POST
	- Request Params
		- username: string
		- password: string
	- Description
		- Login to account
		- start session
	- Return(JSON)
		- status:'OK'
		- if error: status:'error', error:'...'

#### /logout ---- POST
	- Request Params
		- None
	- Description
		- Loutout of account
	- Return(JSON)
		- status:'OK'
		- if error: status:'error', error:'...'

#### /verify ---- POST
	- Request Params
		- email: string
		- key: string(verification key)
	- Description
		- verifies account
		- email should include the text: validation key: <key_goes_here>(including < and > characters)
	- Return(JSON)
		- status:'OK'
		- if error: status:'error', error:'...'

---
#### /questions/add ---- POST
	- Request Params
		- title: title of the question
		- body: body of the question
		- tags: array of tags(strings)
        - media: array of media IDs
            optinal
	- Description
		- Post a new question
		- Only allowed if logged in
	- Return(JSON)
		- status:'OK', id: unique question ID string
		- if error: status:'error', error:'...'

#### /questions/{id} ---- GET
	- Request Params
		- None
	- Description
		- Get contetns of a single question with id, and increments view_count
		- views are unique by authenticated users, and for unauthenticated users, unique by IP address
	- Return(JSON)
		- status:'OK', question:{
			id: string,
			user: {
				username: string,
				reputation: int
			},
			title: string,
			body: string,
			score: int,
			view_count: int,
			answer_count: int,
			timestamp: timestamp, represented as Unix time,
			media: array of associated media IDs,
			tags: array of tags,
			accepted_answer_id: id o accepted answer, if there exists one, Null otherwise
		}
		- if error: status:'error', error:'...'

#### /questions/{id}---- DELETE
	- Request Params
		- None
	- Description
		- using id to delete question and its associated media files and answers 
		- only allowed if logged in user is original asker
	- Return(JSON)
		- return in HTTP status code
			- 200 OK on Success, 4xx on failure
    - Delete associated media files, and answers
---
#### /questions/{id}/answers/add---- POST
	- Request Params
		- body: string
		- media: array of associated media IDs, -- optional

	- Description
		- add an new answer to the question with specified id
		- only allowed if logged in user 
	- Return(JSON)
		- status: "OK", or "error"
		- id: unique answer ID string(if OK)
		- error: if error

#### /questions/{id}/answers---- GET
	- Request Params
		- None
	- Description
		- get all answers to the question with specified id
	- Return(JSON)
		- status: "OK", or "error"
		-if ok,  array of answers: "answers": 
		{
			id: string
			user: username of poster
			body: string
			score: int
			is_accepted: boolean
			timestamp: timestamp, represented as Unix time
			media: array of associated media IDs
		}, ...
		- error: if error

#### /search POST
	- Request Params
        - timestamp: search questions from this time and earlier
            - Represented as Unix time in seconds
            - Integer, optional
            - Default: Current time
	    - limit: number of questions to return
			- Integer, optional
			- Default: 25
			- Max: 100
		- q: search query,
			- String, optional
			Should support spaces:
			For example: “hello world” should return questions with titles OR bodies which contain the phrase “hello world”.
		- sort_by: Order returned questions by “time” or by “score”
			String, optional
			Default: score
		- tags: Return only questions which have all of these tags (AND).
			Array of strings, optional
		- has_media: Return questions with media only
			Boolean - if true, exclude all questions that do not have an associated media, optional
			Default: false
		- accepted: only return questions with accepted answers
			boolean, optional
			Default: false 
	- Description
	- Return(JSON)
		status: “OK” or “error”
		questions: Array of question objects (see /question/{id})
		error: error message (if error)
---
#### /user/{username} ---- GET
	- Params
		None
	- Description
		Gets user profile information for user with {username}
	- Return(JSON)
		status: “OK” or “error”
		user: {
		email: string
		reputation: int
		}

#### /user/{username}/questions---- GET
	- Params
		None
	- Description
		Gets questions posted by user with {username}
	- Return(JSON)
		status: “OK” or “error”
		questions: array of question ids posted by this user

#### /user/{username}/answers---- GET
	- Params
		None
	- Description
		Gets answers posted by user with {username}
	- Return(JSON)
		status: “OK” or “error”
		questions: array of answers ids posted by this user

#### /questions/{id}/upvote ---- POST
	- Params
		upvote:Boolean Default: true
	- Description
		Upvotes or downvotes the question (in/decrements) score
		Upvoting an already upvoted question (by the same user) should undo the upvote, and vice versa.
		Increments/decrements the reputation of the asker. Reputation must always be >=1.
	- Return(JSON)
		status: “OK” or “error”

#### /answers/{id}/upvote ---- POST
	- Params
		upvote:Boolean Default: true
	- Description
		Upvotes or downvotes the answers (in/decrements) score
		Upvoting an already upvoted question (by the same user) should undo the upvote, and vice versa.
		Increments/decrements the reputation of the asker. Reputation must always be >=1.
	- Return(JSON)
		status: “OK” or “error”

#### /answers/{id}/accept ---- POST
	- Params
		None
	- Description
		Accepts an answer
		Should only succeed if logged in user is original asker of associated question. 
	- Return(JSON)
		status: “OK” or “error”

#### /addmedia ---- POST
	- Params
		content: binary content of file being uploaded
	- Description
		Type is multipart/form-data
		Adds a media file (photo or video)
	- Return(JSON)
		status: “OK” or “error”
		id: ID of uploaded media


#### /media/{id} ----GET
	- Params
		None
	- Description
		Type is multipart/form-data
		Gets media file by {id}
	- Return(JSON)
		Returns media file (image or video)
