const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
//middleware 
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0r9jhzc.mongodb.net/?retryWrites=true&w=majority`;

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
        // Connect the client to the server	(optional starting in v4.7)
        // client.connect();

        const menuCollection = client.db("bossDb").collection("menu")
        const reviewsCollection = client.db("bossDb").collection("reviews")
        const cartsCollection = client.db("bossDb").collection("carts")
        const usersCollection = client.db("bossDb").collection("users")
        const paymentsCollection = client.db("bossDb").collection("payments")


        // jwt related  api 
        app.post('/jwt', async (req, res) => {
            try {
                const user = req.body;
                const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' });
                res.send({ token });
            } catch {
                error => console.log(error)
            }

        })

        //middlewares 
        const verifyToken = (req, res, next) => {
            try {
                // console.log('inside verify token', req.headers.authorization)
                if (!req.headers.authorization) {
                    return res.status(401).send({ message: 'Unauthorize access' })
                }
                const token = req.headers.authorization.split(' ')[1];
                jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                    if (err) {
                        return res.status(403).send({ message: 'forbidden access' })
                    }
                    req.decoded = decoded;
                    next()
                })
            } catch {
                error => console.log(error)
            }
        }
        //use verify after verify token 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        //menu related api

        app.get('/menu', async (req, res) => {
            try {
                const result = await menuCollection.find().toArray()
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        app.patch('/menu/:id', async (req, res) => {
            try {
                const item = req.body;
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        name: item.name,
                        category: item.category,
                        price: item.price,
                        recipe: item.recipe,
                        image: item.image
                    }
                }
                const result = await menuCollection.updateOne(filter, updatedDoc)
                res.send(result);
            } catch {
                error => console.log(error)
            }
        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await menuCollection.deleteOne(query)
                res.send(result)
            }
            catch {
                error => console.log(error)
            }
        })

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const item = req.body;
                const result = await menuCollection.insertOne(item);
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })

        app.get('/reviews', async (req, res) => {
            try {
                const result = await reviewsCollection.find().toArray()
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })
        //cart section backend

        app.post('/carts', async (req, res) => {
            try {
                const cartItem = req.body;
                const result = await cartsCollection.insertOne(cartItem)
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })
        app.get('/carts', async (req, res) => {
            try {
                const email = req.query.email;
                const query = { email: email };
                const result = await cartsCollection.find(query).toArray();
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })

        app.delete('/carts/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await cartsCollection.deleteOne(query)
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })

        //users related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            try {
                console.log(req.headers)
                const result = await usersCollection.find().toArray();
                res.send(result)
            } catch {
                error => console.log(error)
            }
        })

        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                //insert email if user does not exists: 
                //you can do this many ways (1.email unique , 2.upsert , 3.simple checking)
                const query = { email: user.email }
                const existingUser = await usersCollection.findOne(query)
                if (existingUser) {
                    return res.send({ message: 'user already exist', insertedId: null })
                }
                const result = await usersCollection.insertOne(user);
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })



        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await usersCollection.deleteOne(query);
                res.send(result)
            } catch {
                error => console.log(error)
            }

        })



        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id
                const filter = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        role: 'admin'

                    }
                }
                const result = await usersCollection.updateOne(filter, updatedDoc)
                res.send(result)
            } catch {
                error => console.log(error)
            }
        })


        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        //payment related api 

        app.get('/payments',verifyToken,verifyAdmin, async (req, res) => {

            const result = await paymentsCollection.find().toArray();
            res.send(result);
        })

        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await paymentsCollection.find(query).toArray();
            res.send(result);
        })


        app.post('/payments', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const payment = req.body;
                const paymentResult = await paymentsCollection.insertOne(payment)
                console.log('payment info', payment)
                //carefully delete each item from cart
                const query = {
                    _id: {
                        $in: payment.cartIds.map(id => new ObjectId(id))
                    }
                }
                const deleteResult = await cartsCollection.deleteMany(query)
                res.send({ paymentResult, deleteResult })
            }
            catch {
                error => console.log(error)
            }
        })



        //states or analytics 
        app.get('/admin-stats', async (req, res) => {
            try {
                const users = await usersCollection.estimatedDocumentCount();
                const menuItems = await menuCollection.estimatedDocumentCount();
                const orders = await paymentsCollection.estimatedDocumentCount();
                //this is not the best way
                // const payments =await paymentsCollection.find().toArray();
                // const revenue =payments.reduce((total , payment)=>total +payment.price ,0)

                //better way 
                const result = await paymentsCollection.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalRevenue: {
                                $sum: '$price'
                            }
                        }
                    }
                ]).toArray();
                const revenue = result.length > 0 ? result[0].totalRevenue : 0;

                res.send({
                    users,
                    menuItems,
                    orders,
                    revenue
                })

            }
            catch {
                error => console.log(error)
            }
        })

        //using aggregate pipeline 
        app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentsCollection.aggregate([
                {
                    $unwind: '$menuItemIds'
                },
                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemIds',
                        foreignField: '_id',
                        as: 'menuItems'
                    },

                },
                {
                    $unwind: '$menuItems'
                },
                {
                    $group: {
                        _id: '$menuItems.category',
                        quantity: { $sum: 1 },
                        revenue: { $sum: '$menuItems.price' }
                    }

                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        revenue: '$revenue'
                    }
                }


            ]).toArray();
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }

}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('boss is running ')
})

app.listen(port, () => {
    console.log(`Bistro Boss is sitting on port ${port}`)
})
