const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 9000
const app = express()

app.use(cors())
app.use(express.json())

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

async function run() {
  try {
    const db = client.db('solo-db')
    const jobsCollection = db.collection('jobs')
    const bidsCollection = db.collection('bids')

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
    app.get('/jobs/:email', async (req, res) => {
      const email = req.params.email
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
    app.get('/bids/:email', async (req, res) => {
      const isBuyer = req.query.buyer
      const email = req.params.email
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
      const {status} = req.body;
      // return console.log(id, status);
      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: { status }
      }
      const result = await bidsCollection.updateOne(filter, updated)
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
