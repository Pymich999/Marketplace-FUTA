const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv').config();
const port = process.env.PORT || 3000;
const { errorHandler } = require('./middleware/errorMiddleware');
const connectDB = require('./connect/database');

connectDB();
const app = express();

app.use(cors({
    origin: 'http://localhost:5173', // Allow requests from your frontend
    credentials: true, 
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/Adminroutes')); 
app.use('/api/products', require('./routes/ProductRoutes'))
app.use('/api/order', require('./routes/orderRoutes'))
app.use('/api/cart', require('./routes/cartRoutes'))
app.use('/api/chats', require('./routes/chatRoutes'));

app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server listening on port: ${port}`);
});