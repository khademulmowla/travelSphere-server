require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
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
        const usersCollection = db.collection('users')
        const packagesCollection = db.collection('packages')
        const storiesCollection = db.collection('stories')
        const booksCollection = db.collection('books')
        const applicationCollection = db.collection('applications')

        // verify admin 
        // verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            // console.log('data from verifyToken middleware--->', req.user?.email)
            const email = req.user?.email
            const query = { email }
            const result = await usersCollection.findOne(query)
            if (!result || result?.role !== 'admin')
                return res
                    .status(403)
                    .send({ message: 'Forbidden Access! Admin Only Actions!' })

            next()
        }
        // verify seller middleware
        const verifyGuide = async (req, res, next) => {
            // console.log('data from verifyToken middleware--->', req.user?.email)
            const email = req.user?.email
            const query = { email }
            const result = await usersCollection.findOne(query)
            if (!result || result?.role !== 'guide')
                return res
                    .status(403)
                    .send({ message: 'Forbidden Access! Guide Only Actions!' })

            next()
        }



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



        // save or update a user in db //
        app.post('/all-users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = req.body
            // check if user exists in db //
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                return res.send(isExist)
            }
            const result = await usersCollection.insertOne({ ...user, role: 'tourist', timestamp: Date.now() })
            res.send(result)
        })
        // get all user data and search function //
        app.get('/all-users/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const search = req.query.search || "";
            const role = req.query.role || "";

            // Search query using regex for case-insensitive search
            const searchQuery = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            };

            // Role filter condition
            const roleFilter = role ? { role: role } : {};

            // Exclude the logged-in user
            const query = { email: { $ne: email }, ...searchQuery, ...roleFilter };

            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });


        // // get all user data //
        // app.get('/all-users/:email', verifyToken, async (req, res) => {
        //     const email = req.params.email
        //     const query = { email: { $ne: email } }
        //     const result = await usersCollection.find(query).toArray()
        //     res.send(result)
        // })

        app.get('/all-users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin';
            }
            res.send({ admin })
        })
        // app.delete('/all-users/:id', verifyToken, async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) }
        //     const result = await usersCollection.deleteOne(query)
        //     res.send(result);
        // })
        // app.patch('/all-users/admin/:id', verifyToken, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: new ObjectId(id) }
        //     const updatedDoc = {
        //         $set: {
        //             role: 'admin'
        //         }
        //     }
        //     const result = await usersCollection.updateOne(filter, updatedDoc)
        //     res.send(result)
        // })
        // get user role //
        app.get('/all-users/role/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send({ role: result?.role })
        })

        // update user info in profile
        app.patch("/update-user/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const user = req.body;

            const query = { email };
            const updateDoc = {
                $set: user
            };

            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        });








        // Get all tour guides
        app.get('/tour-guides', async (req, res) => {
            try {
                const query = { role: "guide" };
                const tourGuides = await usersCollection.find(query).toArray();
                res.send(tourGuides);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch tour guides" });
            }
        });
        // random tour guide //
        app.get('/random-tour-guides', async (req, res) => {
            try {
                const result = await usersCollection.aggregate([
                    { $match: { role: "guide" } },
                    { $sample: { size: 6 } }
                ]).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch tour guides" });
            }
        });

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
        // Get random 3 packages
        app.get('/random-packages', async (req, res) => {
            try {
                const result = await packagesCollection.aggregate([{ $sample: { size: 3 } }]).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch packages" });
            }
        });

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
        //get all story posted by a specific user
        app.get('/stories/:email', async (req, res) => {
            const email = req.params.email
            const query = { email }
            const result = await storiesCollection.find(query).toArray()
            res.send(result)

        })
        // delete a single story data by id from db //
        app.delete('/story/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await storiesCollection.deleteOne(query)
            res.send(result)
        })
        // get story by id
        app.get('/story/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const query = { _id: new ObjectId(id) };
                const story = await storiesCollection.findOne(query);
                if (!story) {
                    return res.status(404).send({ error: "Story not found" });
                }
                res.send(story);
            } catch (error) {
                res.status(400).send({ error: "Invalid ID format" });
            }
        });
        // edit story 
        app.patch("/story/:id", async (req, res) => {
            const { id } = req.params;
            const { action, photoUrl } = req.body;

            const query = { _id: new ObjectId(id) };
            let update;

            if (action === "removePhoto") {
                update = { $pull: { images: photoUrl } };
            } else if (action === "addPhoto") {
                update = { $push: { images: photoUrl } };
            } else {
                return res.status(400).send({ error: "Invalid action" });
            }

            try {
                const result = await storiesCollection.updateOne(query, update);
                if (result.modifiedCount > 0) {
                    res.send(result);
                } else {
                    res.status(400).send({ error: "Failed to update story" });
                }
            } catch (error) {
                res.status(500).send({ error: "Error updating story" });
            }
        });
        // random stories ///
        app.get('/random-stories', async (req, res) => {
            try {
                const result = await storiesCollection.aggregate([{ $sample: { size: 4 } }]).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch stories" });
            }
        });

        // bookings //
        // save a booking data in db //
        app.post('/books', async (req, res) => {
            const bookInfo = req.body;
            const result = await booksCollection.insertOne(bookInfo)
            res.send(result)
        })
        // transaction id //
        app.patch('/books/:id', async (req, res) => {
            const { id } = req.params;
            const { transactionId } = req.body;

            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        transactionId: transactionId,
                        status: 'in-review', // Update status to "in-review"
                    },
                };

                const result = await booksCollection.updateOne(filter, updateDoc);

                if (result.modifiedCount > 0) {
                    res.json({ success: true, message: 'Payment successful, status updated to in-review.' });
                } else {
                    res.status(400).json({ success: false, message: 'Booking not found or already updated.' });
                }
            } catch (error) {
                console.error('Error updating booking status:', error);
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        });

        // app.patch('/books/:id', async (req, res) => {
        //     try {
        //         const id = req.params.id;
        //         const { transactionId } = req.body;

        //         // Ensure transactionId is provided
        //         if (!transactionId) {
        //             return res.status(400).send({ message: 'Transaction ID is required' });
        //         }

        //         const filter = { _id: new ObjectId(id) };
        //         const updateDoc = {
        //             $set: { transactionId },
        //         };

        //         const result = await booksCollection.updateOne(filter, updateDoc);

        //         if (result.modifiedCount === 0) {
        //             return res.status(404).send({ message: 'Booking not found or already updated' });
        //         }

        //         res.send({ success: true, message: 'Booking updated successfully', result });
        //     } catch (error) {
        //         console.error('Error updating booking:', error);
        //         res.status(500).send({ message: 'Internal server error', error });
        //     }
        // });

        // get all bookings for a specific tourists //
        app.get('/tourist-books/:email', async (req, res) => {
            const email = req.params.email
            const query = { 'userEmail': email }
            const result = await booksCollection.find(query).toArray()
            res.send(result)
        })
        // Get all assigned tours for a specific guide
        app.get('/guide-assignments/:email', async (req, res) => {
            const email = req.params.email;
            const query = { 'guideEmail': email };
            const result = await booksCollection.find(query).toArray();
            res.send(result);
        });
        // for status change //
        // Route to update the status of a booking (Accept/Reject)
        app.patch('/update-status/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;  // status will be either 'Accepted' or 'Rejected'

            try {
                const result = await booksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: status } }
                );

                if (result.modifiedCount > 0) {
                    res.status(200).send('Status updated successfully');
                } else {
                    res.status(400).send('No updates made');
                }
            } catch (err) {
                res.status(500).send('Error updating status');
            }
        });


        // Delete a Booking & Assigned Tour
        app.delete('/books/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                // Validate the ID
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ error: 'Invalid booking ID' });
                }

                const query = { _id: new ObjectId(id) };

                // Delete the booking
                const deleteResult = await booksCollection.deleteOne(query);

                if (deleteResult.deletedCount > 0) {
                    return res.json({ success: true, message: 'Booking deleted successfully' });
                } else {
                    return res.status(404).json({ success: false, message: 'Booking not found' });
                }
            } catch (error) {
                console.error('Error deleting booking:', error);
                return res.status(500).json({ error: 'Failed to delete booking' });
            }
        });

        // applicationCollection //
        // save a application in db //
        app.post('/applications', async (req, res) => {
            const application = req.body;
            const existingApplication = await applicationCollection.findOne({ "tourist.email": application.tourist.email });

            if (existingApplication) {
                return res.status(400).send({ message: "You have already applied once." });
            }

            const result = await applicationCollection.insertOne(application);
            res.send(result);
        });

        // get all application data //
        app.get('/all-applications', async (req, res) => {
            const result = await applicationCollection.find().toArray();
            res.send(result);
        });

        //////////////////////////
        app.patch('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const updateRole = { role: "guide" };

            const result = await usersCollection.updateOne(
                { email: email },
                { $set: updateRole }
            );

            res.send(result);
        });
        app.delete('/applications/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await applicationCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });





        //////////////////////


        // app.patch('/all-users/admin/:id', verifyToken, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: new ObjectId(id) };
        //     const updateRole = {
        //         $set: { role: 'guide' }
        //     };
        //     const result = await usersCollection.updateOne(filter, updateRole);
        //     res.send(result);
        // });
        // app.delete('/applications/:id', verifyToken, async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await applicationCollection.deleteOne(query);
        //     res.send(result);
        // });





        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { packageId } = req.body;
                const package = await booksCollection.findOne({ _id: new ObjectId(packageId) });

                if (!package) {
                    return res.status(400).send({ message: 'Package Not Found' });
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: package.price * 100, // Convert to cents
                    currency: 'usd',
                    automatic_payment_methods: { enabled: true },
                });

                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });







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
