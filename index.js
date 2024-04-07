const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
const port = 3001

app.use(express.json());
app.use(cors());

const con = mysql.createConnection({
    user: "db_admin",
    host: "localhost",
    password: "Qwerty1!",
    database: "nodejsdb"
})

con.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ', err);
        return;
    }
    console.log('Connected to MySQL');
});

app.post('/register', (req, res) => {
    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;

    // Query to check if the user already exists
    const checkUserQuery = "SELECT * FROM users WHERE email = ?";
    
    con.query(checkUserQuery, [email], (checkErr, checkResult) => {
        if (checkErr) {
            console.error("Error checking user:", checkErr);
            res.status(500).send({ message: "Internal server error" });
            return;
        }
        
        // If the user already exists, send a response indicating user already exists
        if (checkResult.length > 0) {
            res.status(409).send({ message: "User already exists" });
            return;
        }

        // If the user does not exist, proceed with registration
        const userQuery = "INSERT INTO users (email, name, password) VALUES (?, ?, ?)";
        
        // Execute the query to insert user into the users table
        con.query(userQuery, [email, name, password], (err, userResult) => {
            if (err) {
                console.error("Error registering user:", err);
                res.status(500).send({ message: "Internal server error" });
                return;
            }
            
            // If user registration is successful, insert the user into the patients table
            const patientQuery = "INSERT INTO patients (name, email) VALUES (?, ?)";
            con.query(patientQuery, [name, email], (patientErr, patientResult) => {
                if (patientErr) {
                    console.error("Error adding user to patients table:", patientErr);
                    res.status(500).send({ message: "Internal server error" });
                    return;
                }
                
                // Both user registration and addition to patients table are successful
                res.status(200).send({ message: "User registered successfully" });
            });
        });
    });
});

app.post("/login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    con.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], 
        (err, result) => {
            if(err){
                req.setEncoding({err: err});
            }else{
                if(result.length > 0){
                    res.send(result);
                }else{
                    res.send({message: "WRONG Email OR PASSWORD!"})
                }
            }
        }
    )
})


app.post('/addBooking', (req, res) => {
    const { cartCourses, user_email } = req.body;
    console.log(cartCourses);

    // Iterate through the cartCourses and insert each item into the database
    cartCourses.forEach(item => {
        const id = item.product.id;
        const total_price = item.product.price*item.quantity;
        const quantity = item.quantity;
        const courseTime = item.courseTime;
        // Insert query to add booking details to the database
        const query = `INSERT INTO bookings (product_id, quantity, course_time, user_email, total_price) VALUES (?, ?, ?, ?,?)`;
        con.query(query, [id, quantity, courseTime, user_email, total_price], (err, result) => {
            if (err) {
                console.error("Error adding booking to database:", err);
                 res.status(500).json({ message: 'Error adding booking to database' });
            } else {
                console.log("Booking added to database successfully:", result);
                res.status(200).json({ message: 'Booking details added to database successfully.' });
            }
        });
    });

    // Respond with success message
   
});


app.get("/feedbacks", (req, res) => {
    con.query("SELECT id, user_email, doctor_name, img, text FROM feedbacks", (err, result) => {
        if (err) {
            res.status(500).json({ error: err });
        } else {
            res.send(result);
        }
    });
});



app.post("/createFeedback", (req, res) => {
    const { user_email, doctor_name, img, text } = req.body;

    con.query("INSERT INTO feedbacks (user_email, doctor_name, img, text) VALUES (?, ?, ?, ?)", [user_email, doctor_name, img, text], (err, result) => {
        if (err) {
            console.error("Error creating feedback:", err);
            res.status(500).json({ error: "Error creating feedback" });
        } else {
            console.log("Feedback created successfully");
            res.status(200).json({ message: "Feedback created successfully" });
        }
    });
});






app.post("/patients", (req, res) => {
    con.query("SELECT id, name, email, phone, date_of_birth, created_at FROM patients", (err, result) => {
        if (err) {
            res.status(500).json({ error: err });
        } else {
            res.send(result);
        }
    });
});


app.get("/feedbacks/stats", (req, res) => {
    // Get today's date in MySQL format (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // Query to get today's new feedbacks
    const newFeedbacksQuery = `SELECT COUNT(*) AS new_feedbacks FROM feedbacks WHERE DATE(created_at) = '${today}'`;

    // Query to get total number of feedbacks
    const totalFeedbacksQuery = 'SELECT COUNT(*) AS total_feedbacks FROM feedbacks';

    con.query(newFeedbacksQuery, (err1, result1) => {
        if (err1) {
            res.status(500).json({ error: err1.message });
            return;
        }

        con.query(totalFeedbacksQuery, (err2, result2) => {
            if (err2) {
                res.status(500).json({ error: err2.message });
                return;
            }

            const stats = {
                new_feedbacks: result1[0].new_feedbacks,
                total_feedbacks: result2[0].total_feedbacks
            };
            res.json(stats);
        });
    });
});



app.get("/doctors", (req, res) => {
    con.query("SELECT * FROM doctors", (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(result);
        }
    });
});


app.post("/doctors_create", (req, res) => {
    const { email, name, specialization } = req.body;

    // Check if the user with this email already exists
    con.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, userResult) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (userResult.length > 0) {
                // If the user with this email already exists, proceed to create the doctor
                createDoctor(email, name, specialization, res);
            } else {
                // If the user with this email doesn't exist, create a new user with a default password
                const defaultPassword = '1234'; // Default password
                // Insert the new user into the users table
                con.query(
                    "INSERT INTO users (email, name, password) VALUES (?, ?, ?)",
                    [email, name, defaultPassword],
                    (userInsertErr, userInsertResult) => {
                        if (userInsertErr) {
                            res.status(500).json({ error: userInsertErr.message });
                        } else {
                            // After creating the user, proceed to create the doctor
                            createDoctor(email, name, specialization, res);
                        }
                    }
                );
            }
        }
    );
});

function createDoctor(email, name, specialization, res) {
    // Insert the new doctor into the doctors table
    con.query(
        "INSERT INTO doctors (email, name, specialization) VALUES (?, ?, ?)",
        [email, name, specialization],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.status(201).json({ message: "Doctor created successfully", doctorId: result.insertId });
            }
        }
    );
}

app.put("/doctors/:email", (req, res) => {
    const email = req.params.email;
    const { name, specialization } = req.body;

    con.query(
        "UPDATE doctors SET name = ?, specialization = ? WHERE email = ?",
        [name, specialization, email],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (result.affectedRows === 0) {
                res.status(404).json({ message: "Doctor not found" });
            } else {
                res.json({ message: "Doctor updated successfully" });
            }
        }
    );
});


app.delete("/doctors/:email", (req, res) => {
    const email = req.params.email;

    // Disable foreign key checks temporarily
    con.query("SET FOREIGN_KEY_CHECKS = 0", (err1, result1) => {
        if (err1) {
            console.error("Error disabling foreign key checks:", err1);
            res.status(500).json({ error: "An error occurred while deleting the doctor" });
            return;
        }

        // Delete the row from the doctors table
        con.query(
            "DELETE FROM doctors WHERE email = ?",
            [email],
            (err2, result2) => {
                // Enable foreign key checks
                con.query("SET FOREIGN_KEY_CHECKS = 1", (err3, result3) => {
                    if (err3) {
                        console.error("Error enabling foreign key checks:", err3);
                        res.status(500).json({ error: "An error occurred while deleting the doctor" });
                        return;
                    }

                    if (err2) {
                        console.error("Error deleting doctor:", err2);
                        res.status(500).json({ error: "An error occurred while deleting the doctor" });
                    } else if (result2.affectedRows === 0) {
                        console.log("Doctor not found");
                        res.status(404).json({ message: "Doctor not found" });
                    } else {
                        console.log("Doctor deleted successfully");
                        res.json({ message: "Doctor deleted successfully" });
                    }
                });
            }
        );
    });
});


// Express.js routes for managing products (services)

// Get all products
app.get("/products", (req, res) => {
    const sql = `
        SELECT 
            p.id,
            p.name,
            p.price,
            p.image,
            d.name AS doctor_name
        FROM 
            products p
        INNER JOIN
            doctors d
        ON 
            p.doctor_id = d.id
    `;

    con.query(sql, (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            rslt = res.json(result);
	    console.log(result.data);	
        }
    });
});


const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Specify the upload directory

// Endpoint for creating a new product with image file upload
app.post("/products_create", upload.single('image'), (req, res) => {
    const { name, price, doctor_id } = req.body;
    
    const imageFile = req.file ? req.file.path : null;
    console.log(name,req.file );
	
    if (!imageFile) {
        return res.status(400).json({ error: "No image file provided" });
    }

    // Read the image file as binary data
    fs.readFile(imageFile, (err, data) => {
        if (err) {
            return res.status(500).json({ error: "Error reading image file" });
        }

        // Insert the product with image data into the database
        con.query(
            "INSERT INTO products (name, price, image_data, doctor_id) VALUES (?, ?, ?, ?)",
            [name, price, data, doctor_id],
            (dbErr, result) => {
                if (dbErr) {
                    res.status(500).json({ error: dbErr.message });
                } else {
                    res.status(201).json({ message: "Product created successfully", productId: result.insertId });
                }
            }
        );
    });
});

// Update an existing product
app.put("/products/:id", (req, res) => {
    const id = req.params.id;
    const { name, price, image, doctor_id } = req.body;
    con.query(
        "UPDATE products SET name = ?, price = ?, image = ?, doctor_id = ? WHERE id = ?",
        [name, price, image, doctor_id, id],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (result.affectedRows === 0) {
                res.status(404).json({ message: "Product not found" });
            } else {
                res.json({ message: "Product updated successfully" });
            }
        }
    );
});

// Delete a product by ID
app.delete("/products/:id", (req, res) => {
    const id = req.params.id;
    con.query(
        "DELETE FROM products WHERE id = ?",
        [id],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (result.affectedRows === 0) {
                res.status(404).json({ message: "Product not found" });
            } else {
                res.json({ message: "Product deleted successfully" });
            }
        }
    );
});

// Endpoint to get list of bookings
app.get("/bookings", (req, res) => {
    con.query(
        "SELECT bookings.id, products.name AS product_name, bookings.quantity, bookings.course_time, bookings.user_email, bookings.total_price FROM bookings INNER JOIN products ON bookings.product_id = products.id",
        (err, results) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: err.message });
            } 
            res.json(results);
        }
    );
});



app.get('/bookingsByEmail/:email', (req, res) => {
  const { email } = req.params; // Access email from URL parameters
  console.log(email);
	
  // Query to fetch bookings by email
  const query = `SELECT * FROM bookings WHERE user_email = ?`; // Assuming 'user_email' is the column name in your database table

  // Execute the query with the provided email parameter
  con.query(query, [email], (error, results) => {
    if (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Internal server error" });
    } else {
      console.log("Bookings fetched successfully:", results);
      res.json(results);
    }
  });
});



app.post('/submit-feedback', (req, res) => {
  const { name, phone, email, message, doctor_name } = req.body;
  const img = 'default_image.jpg'; // Default image value
  
  // Check if user exists
  const userSql = 'SELECT * FROM users WHERE email = ?';
  con.query(userSql, [email], (userErr, userResult) => {
    if (userErr) {
      console.error('Error checking user existence:', userErr);
      res.status(500).send('Error checking user existence');
    } else {
      if (userResult.length > 0) {
        // User exists, insert feedback directly
	console.log(req.body);	
        insertFeedback(name, phone, email, message, img, res,doctor_name);
      } else {
        // User does not exist, insert user first and then insert feedback
        const insertUserSql = 'INSERT INTO users (name, email, password) VALUES (?, ?, "pass1234")';
        con.query(insertUserSql, [name, email], (insertUserErr, insertUserResult) => {
          if (insertUserErr) {
            console.error('Error inserting user:', insertUserErr);
            res.status(500).send('Error inserting user');
          } else {
            insertFeedback(name, phone, email, message, img, res, doctor_name);
          }
        });
      }
    }
  });
});

function insertFeedback(name, phone, email, message, img, res, doctor_name) {
  const feedbackSql = 'INSERT INTO feedbacks (name, phone_number, user_email, text, img, doctor_name) VALUES (?, ?, ?, ?, ?,?)';
  con.query(feedbackSql, [name, phone, email, message, img, doctor_name], (feedbackErr, feedbackResult) => {
    if (feedbackErr) {
      console.error('Error inserting feedback:', feedbackErr);
      res.status(500).send('Error inserting feedback');
    } else {
      console.log('Feedback inserted successfully');
      res.status(200).send('Feedback submitted successfully');
    }
  });
}



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
