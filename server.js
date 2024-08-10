const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { GridFSBucket } = require('mongodb');
const app = express();
const port = 3000;

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection string
const dbPassword = 'arjunpk22';
const dbName = 'Node-API';
const dbUser = 'arjunpk004';
const dbCluster = 'backenddb.csjpcsj.mongodb.net';
const dbConnectionString = `mongodb+srv://${dbUser}:${dbPassword}@${dbCluster}/${dbName}?retryWrites=true&w=majority`;

// Connect to MongoDB
mongoose.connect(dbConnectionString, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB!'))
    .catch((err) => console.error('Connection failed', err));

// Initialize GridFSBucket
const conn = mongoose.connection;
let bucket;
conn.once('open', () => {
    bucket = new GridFSBucket(conn.db, {
        bucketName: 'uploads'
    });
});

// User models
const Student = mongoose.model('Student', new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    address: { type: String, required: true },
    role: { type: String, default: 'Student' }
}));

const Instructor = mongoose.model('Instructor', new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    address: { type: String, required: true },
    role: { type: String, default: 'Instructor' }
}));

// Course model with pdf field
const Course = mongoose.model('Course', new mongoose.Schema({
    title: String,
    description: String,
    category: String,
    image: String,
    pdf: String
}));

// Enrollment model
const Enrollment = mongoose.model('Enrollment', new mongoose.Schema({
    studentId: String, // Hardcoded for simplicity, no authentication
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    date: { type: Date, default: Date.now }
}));

// Serve static files (like your HTML, CSS, and JavaScript files)
app.use(express.static('public'));

// Student Signup Route
app.post('/student-signup', async (req, res) => {
    const { name, email, phone, password, address } = req.body;

    try {
        const newStudent = new Student({ name, email, phone, password, address });
        await newStudent.save();
        res.status(201).json({ success: true, message: 'Student registered successfully!' });
    } catch (err) {
        if (err.code === 11000) { // MongoDB duplicate key error
            res.status(400).json({ success: false, message: 'Email already registered' });
        } else {
            res.status(400).json({ success: false, message: err.message });
        }
    }
});

// Instructor Signup Route
app.post('/instructor-signup', async (req, res) => {
    const { name, email, phone, password, address } = req.body;

    try {
        const newInstructor = new Instructor({ name, email, phone, password, address });
        await newInstructor.save();
        res.status(201).json({ success: true, message: 'Instructor registered successfully!' });
    } catch (err) {
        if (err.code === 11000) { // MongoDB duplicate key error
            res.status(400).json({ success: false, message: 'Email already registered' });
        } else {
            res.status(400).json({ success: false, message: err.message });
        }
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    let user;
    if (role === 'Student') {
        user = await Student.findOne({ email, password });
    } else if (role === 'Instructor') {
        user = await Instructor.findOne({ email, password });
    }

    if (user) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid email, password, or role' });
    }
});

// API routes for courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find();
        res.json(courses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Use multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Handle course creation with file upload
app.post('/api/courses', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    const { title, description, category } = req.body;
    const imageFile = req.files['image'] ? req.files['image'][0] : null;
    const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;

    let imageFileName = '';
    let pdfFileName = '';

    if (imageFile) {
        imageFileName = crypto.randomBytes(16).toString('hex') + path.extname(imageFile.originalname);

        const uploadStream = bucket.openUploadStream(imageFileName, {
            contentType: imageFile.mimetype
        });

        uploadStream.on('error', (err) => {
            console.error('Error uploading image file:', err.message);
            res.status(500).json({ message: 'Error uploading image file' });
        });

        uploadStream.on('finish', () => {
            console.log('Image file uploaded successfully:', imageFileName);
        });

        uploadStream.end(imageFile.buffer);
    }

    if (pdfFile) {
        pdfFileName = crypto.randomBytes(16).toString('hex') + path.extname(pdfFile.originalname);

        const uploadStream = bucket.openUploadStream(pdfFileName, {
            contentType: pdfFile.mimetype
        });

        uploadStream.on('error', (err) => {
            console.error('Error uploading PDF file:', err.message);
            res.status(500).json({ message: 'Error uploading PDF file' });
        });

        uploadStream.on('finish', () => {
            console.log('PDF file uploaded successfully:', pdfFileName);
        });

        uploadStream.end(pdfFile.buffer);
    }

    const newCourse = new Course({ title, description, category, image: imageFileName, pdf: pdfFileName });

    try {
        const savedCourse = await newCourse.save();
        res.status(201).json(savedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update course route
app.put('/api/courses/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    const { id } = req.params;
    const { title, description, category } = req.body;
    const imageFile = req.files['image'] ? req.files['image'][0] : null;
    const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;

    try {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        let imageFileName = course.image;
        let pdfFileName = course.pdf;

        if (imageFile) {
            imageFileName = crypto.randomBytes(16).toString('hex') + path.extname(imageFile.originalname);

            const uploadStream = bucket.openUploadStream(imageFileName, {
                contentType: imageFile.mimetype
            });

            uploadStream.on('error', (err) => {
                console.error('Error uploading image file:', err.message);
                res.status(500).json({ message: 'Error uploading image file' });
            });

            uploadStream.on('finish', () => {
                console.log('Image file uploaded successfully:', imageFileName);
            });

            uploadStream.end(imageFile.buffer);
        }

        if (pdfFile) {
            pdfFileName = crypto.randomBytes(16).toString('hex') + path.extname(pdfFile.originalname);

            const uploadStream = bucket.openUploadStream(pdfFileName, {
                contentType: pdfFile.mimetype
            });

            uploadStream.on('error', (err) => {
                console.error('Error uploading PDF file:', err.message);
                res.status(500).json({ message: 'Error uploading PDF file' });
            });

            uploadStream.on('finish', () => {
                console.log('PDF file uploaded successfully:', pdfFileName);
            });

            uploadStream.end(pdfFile.buffer);
        }

        const updatedCourse = await Course.findByIdAndUpdate(id, { title, description, category, image: imageFileName, pdf: pdfFileName }, { new: true });
        res.json(updatedCourse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete course route
app.delete('/api/courses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.image) {
            const deleteStream = bucket.openDownloadStreamByName(course.image);
            deleteStream.on('error', (err) => {
                console.error('Error deleting image file:', err.message);
            });
            deleteStream.pipe(bucket.openUploadStream(course.image, { chunkSizeBytes: 1024 }));
        }

        if (course.pdf) {
            const deleteStream = bucket.openDownloadStreamByName(course.pdf);
            deleteStream.on('error', (err) => {
                console.error('Error deleting PDF file:', err.message);
            });
            deleteStream.pipe(bucket.openUploadStream(course.pdf, { chunkSizeBytes: 1024 }));
        }

        await Course.findByIdAndDelete(id);
        res.json({ message: 'Course deleted successfully' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Enroll in a course
app.post('/api/enroll', async (req, res) => {
    const { studentId, courseId } = req.body;

    try {
        const enrollment = new Enrollment({ studentId, courseId });
        await enrollment.save();
        res.status(201).json({ success: true, message: 'Enrolled successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Fetch enrollments for a student
app.get('/api/enrollments/:studentId', async (req, res) => {
    const { studentId } = req.params;

    try {
        const enrollments = await Enrollment.find({ studentId }).populate('courseId').exec();
        res.json(enrollments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    res.redirect('index.html');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
