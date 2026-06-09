-- =============================================
-- QuickBite Canteen System Database Script
-- =============================================

-- 1. Create Database if not exists
CREATE DATABASE IF NOT EXISTS quickbite_canteen;
USE quickbite_canteen;

-- 2. Drop existing tables if they exist (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS menu;
DROP TABLE IF EXISTS users;

-- 3. Create Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Will store hashed password (bcrypt)
    role ENUM('student', 'admin') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Menu Table
CREATE TABLE menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    description TEXT,
    prep_time VARCHAR(20) NOT NULL,
    veg TINYINT(1) DEFAULT 1, -- 1 for Veg, 0 for Non-veg
    available TINYINT(1) DEFAULT 1, -- 1 for Available, 0 for Out of Stock
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Orders Table
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY, -- e.g. QB-1780688680596
    token INT NOT NULL,
    user_id INT NOT NULL,
    total INT NOT NULL,
    status ENUM('pending', 'preparing', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
    note TEXT,
    payment_method VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Create Order Items Table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    menu_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    qty INT NOT NULL,
    price INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id) REFERENCES menu(id) ON DELETE RESTRICT
);

-- 7. Seed Initial Menu Items
INSERT INTO menu (name, image, category, price, description, prep_time, veg, available) VALUES
-- Breakfast
('Idli', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80', 'Breakfast', 45, 'Fluffy idli with sambar and chutneys', '8 min', 1, 1),
('Masala Dosa', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80', 'Breakfast', 30, 'Soft steamed idlis with piping hot sambar & chutneys', '5 min', 1, 1),
('Poha', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu2BnTkCPRNCCOQDdQ-x5fhnu6OYAEGEp_9Q&s', 'Breakfast', 25, 'Flattened rice with peanuts, onion & lemon', '5 min', 1, 1),
('Upma', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR62An25qATwuE83QS6U4uid1_fK5kigq9gMQ&s', 'Breakfast', 25, 'Semolina cooked with vegetables & curry leaves', '6 min', 1, 1),
-- Lunch
('Thali (Veg)', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80', 'Lunch', 90, 'Dal, sabzi, rice, roti, salad & pickle — full meal', '10 min', 1, 1),
('Chicken Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80', 'Lunch', 120, 'Aromatic basmati rice with tender chicken & spices', '12 min', 0, 1),
('Rajma Rice', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80', 'Lunch', 75, 'Kidney beans curry served with steamed rice', '8 min', 1, 1),
('Egg Curry Rice', 'https://www.ruchikrandhap.com/wp-content/uploads/2017/06/EggPepperCurry_RuchikRandhap28229-1-1-500x427.jpg', 'Lunch', 80, 'Eggs in rich masala gravy with plain rice', '8 min', 0, 1),
-- Snacks
('Samosa (2 pcs)', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80', 'Snacks', 20, 'Golden crispy pastry stuffed with spiced potatoes', '3 min', 1, 1),
('Pav Bhaji', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80', 'Snacks', 18, 'Mumbai''s iconic street-style potato vada burger', '3 min', 1, 1),
('Bread Omelette', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80', 'Snacks', 35, 'Fluffy omelette sandwiched in buttered bread slices', '5 min', 0, 1),
('Momos', 'https://images.unsplash.com/photo-1626776876729-bab4369a5a5a?w=400&q=80', 'Snacks', 55, 'Spiced vegetable mash with buttered pav', '7 min', 1, 0),
-- Drinks
('Masala Chai', 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80', 'Drinks', 12, 'Hot ginger-cardamom spiced tea', '2 min', 1, 1),
('Cold Coffee', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80', 'Drinks', 40, 'Rich blended iced coffee with milk', '3 min', 1, 1),
('Lassi (Sweet)', 'https://www.indianveggiedelight.com/wp-content/uploads/2023/01/sweet-lassi-recipe-featured.jpg', 'Drinks', 35, 'Chilled thick yoghurt drink with rose syrup', '3 min', 1, 1),
('Lemon Soda', 'https://images.unsplash.com/photo-1523371054106-bbf80586c38c?w=400&q=80', 'Drinks', 22, 'Fresh lime with sparkling water & black salt', '2 min', 1, 1),
-- Desserts
('Gulab Jamun (2)', 'https://static.toiimg.com/thumb/63799510.cms?imgsize=1091643&width=800&height=800', 'Desserts', 30, 'Soft milk-solid dumplings soaked in rose sugar syrup', '2 min', 1, 1),
('Ice Cream', 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80', 'Desserts', 35, 'Two scoops of seasonal flavour', '2 min', 1, 1);

select * from orders;