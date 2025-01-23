require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 8000;

// middleware //
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iuytv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const db = client.db('travelDb')
        const packagesCollection = db.collection('packages')
        const storiesCollection = db.collection('stories')


        // jwt related api //
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })

        // middlewares //
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })

        }

        // save a package in db //
        app.post('/packages', verifyToken, async (req, res) => {
            const package = req.body
            const result = await packagesCollection.insertOne(package)
            res.send(result)
        })
        // get all package from db //
        app.get('/packages', async (req, res) => {
            const result = await packagesCollection.find().limit(20).toArray()
            res.send(result)
        })
        // get a package by id //
        app.get('/package/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await packagesCollection.findOne(query)
            res.send(result)
        })

        ///////////////////////////////// stories db ///////////////////////////

        // save a story in db //
        app.post('/add-story', async (req, res) => {
            const storyData = req.body;
            const result = await storiesCollection.insertOne(storyData)
            res.send(result)
        })
        // get all story data //
        app.get('/stories', async (req, res) => {
            const result = await storiesCollection.find().toArray()
            res.send(result)
        })




        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from travelsphere Server..')
})

app.listen(port, () => {
    console.log(`travelsphere is running on port ${port}`)
})
