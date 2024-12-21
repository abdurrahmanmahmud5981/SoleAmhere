const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 9000
const app = express()


const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionsSuccessStatus: 200,

}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.yolij.mongodb.net/?retryWrites=true&w=majority&appName=Main`
const uri = "mongodb://localhost:27017"
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})


// verify token 
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  console.log('Token: ', token);
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).send({ message: "unauthorized access" });
    req.user = decoded
    console.log('Decoded: ', decoded);
    console.log("Email: ", req.user?.email);
    next()
  })
}


async function run() {
  try {
    const db = client.db('solo-db')
    const jobsCollection = db.collection('jobs')
    const bidsCollection = db.collection('bids')

    // generate jwt token
    app.post('/jwt', async (req, res) => {
      const email = req.body
      // create a token 
      const tokent = jwt.sign(email, process.env.SECRET_KEY, { expiresIn: '365d' })
      console.log(tokent);

      // send the token to the client
      // set a cookie with the token
      res.cookie("token", tokent, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
      }).send({ success: true })
    })

    // logout or clear the cookie from browser
    app.get('/logout', async (req, res) => {
      res.clearCookie("token", {
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
      }).send({ success: true })
    })


    //  app.post()
    // save a jobData in db
    app.post('/add-job', async (req, res) => {
      const jobData = req.body
      const result = await jobsCollection.insertOne(jobData)
      console.log(result)
      res.send(result)
    })

    // get all jobs data from db
    app.get('/jobs', async (req, res) => {
      const result = await jobsCollection.find().toArray()
      res.send(result)
    })

    // get all jobs posted by a specific user
    app.get('/jobs/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const decodedEmail = req.user?.email
      if (decodedEmail !== email) return res.status(401).send({ message: "unauthorized access" });
      const query = { 'buyer.email': email }
      const result = await jobsCollection.find(query).toArray()
      res.send(result)
    })

    // delete a job from db
    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.deleteOne(query)
      res.send(result)
    })

    // get a single job data by id from db
    app.get('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })

    // save a jobData in db
    app.put('/update-job/:id', async (req, res) => {
      const id = req.params.id
      const jobData = req.body
      const updated = {
        $set: jobData,
      }
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const result = await jobsCollection.updateOne(query, updated, options)
      console.log(result)
      res.send(result)
    })


    // save a bid data in db
    app.post('/add-bid', async (req, res) => {
      const bidbData = req.body
      // 0. if a user placed abid already in this job
      const query = { email: bidbData.email, jobId: bidbData.jobId }
      const alreadyExists = await bidsCollection.findOne(query)
      console.log(alreadyExists);
      if (alreadyExists)
        return res.status(400).send('You have already placed a bid in this job.')

      // 1. save data in bids collection

      const result = await bidsCollection.insertOne(bidbData)
      // 2.Increase bid count in jobs collection
      const fillter = { _id: new ObjectId(bidbData.jobId) }
      const update = {
        $inc: { bid_count: 1 }
      }
      const updateBidCount = await jobsCollection.updateOne(fillter, update)

      console.log(result)
      res.send(result)
    })



    // get all bids for a specific user
    app.get('/bids/:email', verifyToken, async (req, res) => {
      const isBuyer = req.query.buyer
      const email = req.params.email
      const decodedEmail = req.user?.email
      if (decodedEmail !== email) return res.status(401).send({ message: "unauthorized access" });
      let query = {}
      if (isBuyer) {
        query.buyer = email
      } else {
        query.email = email
      }
      const result = await bidsCollection.find(query).toArray()
      res.send(result)
    })

    // // get all bids requests for a specific user == this is optional---------
    // app.get('/bid-requests/:email', async (req, res) => {
    //   const email = req.params.email
    //   const query = { buyer: email }
    //   const result = await bidsCollection.find(query).toArray()
    //   res.send(result)
    // })

    // update bid status
    app.patch('/bid-status-update/:id', async (req, res,) => {
      const id = req.params.id;
      const { status } = req.body;
      // return console.log(id, status);
      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: { status }
      }
      const result = await bidsCollection.updateOne(filter, updated)
      res.send(result)

    })





    // Get All Jobs For AllJobs Page 
    app.get('/all-jobs', async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      const sort = req.query.sort;
      let options = {}
      // if (sort) options.sort = { [sort]: 1 }  // 1 for ascending, -1 for descending
      if (sort) options = { sort: { deadline: sort === "asc" ? 1 : -1 } }
      console.log(search);
      let query = {
        title: {
          $regex: `.*${search}.*`,
          // $regex: search,
          $options: 'i' // 'i' for case-insensitive search
        }
      }
      if (filter) query.category = filter
      const result = await jobsCollection.find(query, options).toArray()
      res.send(result)
    })





    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from SoleAmhere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
